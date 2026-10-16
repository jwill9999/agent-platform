import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dockerFixtureBinary } from '../git-delivery/docker-command.js';
import type { StopProvider, StopReply, StopLedger } from './provider.mjs';

/** Starts only in the explicitly selected isolated Compose API container. */
export async function dockerStopProvider(apiURL: string, model: string) {
  const container = process.env.STOP_API_CONTAINER ?? process.env.GIT_DELIVERY_API_CONTAINER;
  if (!container) throw new Error('Set STOP_API_CONTAINER to the owned disposable API container');
  const binary = dockerFixtureBinary();
  const inspect = (format: string) =>
    execFileSync(binary, ['inspect', '--format', format, container], {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();
  const ports = JSON.parse(inspect('{{json .NetworkSettings.Ports}}')) as Record<
    string,
    Array<{ HostPort: string }>
  >;
  const url = new URL(apiURL);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !ports['3000/tcp']?.some((row) => row.HostPort === (url.port || '80')) ||
    inspect('{{index .Config.Labels "com.docker.compose.service"}}') !== 'api'
  )
    throw new Error('Stop API URL does not match selected Compose container');
  const source = readFileSync(new URL('./provider.mjs', import.meta.url), 'utf8');
  const runner = `
import { createInterface } from 'node:readline';
const emit=(event)=>process.stdout.write(JSON.stringify(event)+'\\n');
if(process.env.OLLAMA_BASE_URL!=='http://127.0.0.1:11434/v1')throw new Error('Stop loopback provider overlay required');
const fixture=await startStopProvider({model:process.argv[1],port:11434,observe:emit});
const input=createInterface({input:process.stdin});
input.on('line',line=>{const command=JSON.parse(line);if(command.kind==='enqueue'){fixture.enqueue(command.reply);emit({kind:'enqueued',index:command.index});}else if(command.kind==='release')fixture.release(command.index);else throw new Error('Invalid Stop fixture command');});
input.once('close',()=>{const deadline=setTimeout(()=>process.exit(1),5000);void fixture.close().then(()=>{clearTimeout(deadline);emit({kind:'closed'});process.stdin.destroy();});});
emit({kind:'ready'});
`;
  const child = spawn(
    binary,
    ['exec', '-i', container, 'node', '--input-type=module', '-e', `${source}\n${runner}`, model],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const ledger: StopLedger[] = [];
  const errors: string[] = [];
  const requests: StopProvider['requests'] = [];
  const enqueued = new Map<number, () => void>();
  let ready!: () => void;
  let reject!: (error: Error) => void;
  let closed = false;
  const waiting = new Promise<void>((resolve, fail) => {
    ready = resolve;
    reject = fail;
  });
  child.stderr.on('data', () => {
    errors.push('Owned Stop provider process error');
  });
  child.stdin.on('error', (error) => {
    errors.push(error.message);
    reject(error);
  });
  let bytes = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    try {
      bytes += Buffer.byteLength(line);
      if (bytes > 1024 * 1024) throw new Error('Stop provider ledger exceeded limit');
      const event = JSON.parse(line) as {
        kind: string;
        value?: StopLedger;
        body?: StopProvider['requests'][number];
        message?: string;
        index?: number;
      };
      if (event.kind === 'ready') ready();
      else if (event.kind === 'closed') closed = true;
      else if (event.kind === 'enqueued' && event.index !== undefined) {
        enqueued.get(event.index)?.();
        enqueued.delete(event.index);
      } else if (event.kind === 'request' && event.body) requests.push(event.body);
      else if (event.kind === 'error') errors.push(event.message ?? 'Stop provider failure');
      else if (event.kind === 'ledger' && event.value) {
        ledger[event.value.index] = event.value;
      } else throw new Error('Unexpected Stop provider event');
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
  const exited = new Promise<number | null>((resolve) => {
    child.once('error', (error) => {
      reject(error);
      resolve(null);
    });
    child.once('close', (code) => {
      if (!closed) reject(new Error('Stop provider exited unexpectedly'));
      resolve(code);
    });
  });
  const bounded = async <T>(promise: Promise<T>, label: string) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, fail) => {
          timer = setTimeout(() => fail(new Error(label)), 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  let closePromise: Promise<void> | undefined;
  const close = () =>
    (closePromise ??= (async () => {
      child.stdin.end();
      const code = await bounded(exited, 'Owned Stop provider did not exit');
      lines.close();
      if (code !== 0 || !closed) throw new Error('Owned Stop provider cleanup failed');
    })());
  try {
    await bounded(waiting, 'Stop provider did not become ready');
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Stop provider setup/cleanup failed');
    }
    throw error;
  }
  let count = 0;
  return {
    container,
    requests,
    errors,
    ledger,
    baseURL: 'http://127.0.0.1:11434/v1',
    enqueue: (reply: StopReply) => {
      const index = count++;
      return bounded(
        new Promise<void>((resolve) => {
          enqueued.set(index, resolve);
          child.stdin.write(JSON.stringify({ kind: 'enqueue', reply, index }) + '\n');
        }),
        'Stop provider did not accept queued response',
      );
    },
    release: (index: number) =>
      child.stdin.write(JSON.stringify({ kind: 'release', index }) + '\n'),
    close,
    exec: (args: string[]) =>
      execFileSync(binary, ['exec', container, ...args], { encoding: 'utf8', timeout: 10_000 }),
  } satisfies StopProvider & { container: string; exec(args: string[]): string };
}
