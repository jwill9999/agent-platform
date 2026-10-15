import { dockerFixtureBinary } from './docker-command.js';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

export type GitProviderRequest = {
  model: string;
  messages: Array<{ role: string; content?: unknown; tool_call_id?: string }>;
  tools?: Array<{ type: string; function: { name: string } }>;
};

/** Owns only a loopback listener inside the explicitly selected disposable API container. */
export async function startDockerGitProvider(options: {
  apiURL: string;
  model: string;
  replies: unknown[];
}) {
  const container = process.env.GIT_DELIVERY_API_CONTAINER;
  if (!container) throw new Error('Select an isolated GIT_DELIVERY_API_CONTAINER');
  const inspect = (format: string) =>
    execFileSync(dockerFixtureBinary(), ['inspect', '--format', format, container], {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();
  const url = new URL(options.apiURL);
  const ports = JSON.parse(inspect('{{json .NetworkSettings.Ports}}')) as Record<
    string,
    { HostPort: string }[]
  >;
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !ports['3000/tcp']?.some(({ HostPort }) => HostPort === (url.port || '80')) ||
    inspect('{{index .Config.Labels "com.docker.compose.service"}}') !== 'api'
  )
    throw new Error('API URL does not match selected owned Compose API container');
  const source = readFileSync(new URL('./model-provider.mjs', import.meta.url), 'utf8');
  const runner = `
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\\n');
if (process.env.OLLAMA_BASE_URL !== 'http://127.0.0.1:11434/v1') throw new Error('Owned provider overlay required');
const ended = new Promise((resolve) => process.stdin.once('end', resolve));
process.stdin.resume();
let fixture;
try {
  fixture = await startGitDeliveryProvider({...JSON.parse(process.argv[1]), port:11434});
  for (const key of ['requests','errors']) {
    const original = fixture[key].push.bind(fixture[key]);
    fixture[key].push = (...values) => {
      const length = original(...values);
      for (const value of values) emit({event:key,value});
      return length;
    };
  }
  emit({event:'ready',baseURL:fixture.baseURL});
  await ended;
} catch(error) {
  emit({event:'fatal',message:error instanceof Error ? error.message : String(error)});
  process.exitCode=1;
} finally {
  const deadline=setTimeout(()=>process.exit(1),5000);
  if(fixture) await fixture.close();
  process.stdin.destroy();
  clearTimeout(deadline);
  emit({event:'closed'});
}
`;
  const child = spawn(
    dockerFixtureBinary(),
    [
      'exec',
      '-i',
      container,
      'node',
      '--input-type=module',
      '-e',
      `${source}\n${runner}`,
      JSON.stringify({ model: options.model, replies: options.replies }),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const requests: GitProviderRequest[] = [];
  const errors: string[] = [];
  let stderr = '';
  let bytes = 0;
  let fatal: Error | undefined;
  let closed = false;
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const fail = (error: Error) => {
    fatal ??= error;
    rejectReady(error);
    child.stdin.end();
  };
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-8192);
  });
  child.stdin.on('error', (error) => {
    fatal ??= error;
    rejectReady(error);
  });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    bytes += Buffer.byteLength(line);
    if (bytes > 4 * 1024 * 1024) {
      fail(new Error('Owned provider evidence exceeded byte bound'));
      return;
    }
    try {
      const event = JSON.parse(line) as {
        event: string;
        value?: unknown;
        baseURL?: string;
        message?: string;
      };
      if (event.event === 'ready') {
        if (event.baseURL !== 'http://127.0.0.1:11434/v1')
          throw new Error('Unexpected owned provider listener');
        resolveReady();
      } else if (event.event === 'requests') requests.push(event.value as GitProviderRequest);
      else if (event.event === 'errors') errors.push(String(event.value));
      else if (event.event === 'fatal') fail(new Error(event.message ?? 'Owned provider failed'));
      else if (event.event === 'closed') closed = true;
      else throw new Error('Unexpected owned provider event');
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('error', (error) => {
      fail(error);
      resolve({ code: null, signal: null });
    });
    child.once('close', (code, signal) => {
      if (!closed) rejectReady(new Error(`Owned provider exited before ready/cleanup: ${stderr}`));
      resolve({ code, signal });
    });
  });
  const bounded = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(label)), ms);
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
      const result = await bounded(exited, 10_000, 'Owned provider did not close after stdin EOF');
      lines.close();
      if (fatal || !closed || result.code !== 0)
        throw (
          fatal ??
          new Error(`Owned provider cleanup failed (${result.code}/${result.signal}): ${stderr}`)
        );
    })());
  try {
    await bounded(ready, 10_000, 'Owned provider did not become ready');
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Owned provider setup/cleanup failed');
    }
    throw error;
  }
  return { requests, errors, close };
}
