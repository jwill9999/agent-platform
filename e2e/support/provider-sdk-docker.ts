import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type { SdkFixtureRequest } from './provider-sdk.mjs';

const dockerExecutable =
  process.platform === 'darwin'
    ? '/Applications/Docker.app/Contents/Resources/bin/docker'
    : '/usr/bin/docker';
const dockerEnvironment = { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' };

function fixtureErrorMessage(value: unknown): string {
  return typeof value === 'string' ? value : 'Fixture reported a non-text error';
}

/** The service listens only on loopback inside the explicitly identified disposable API. */
export async function startDockerProviderSdk(apiURL: string) {
  const container =
    process.env.PROVIDER_SDK_API_CONTAINER ??
    (process.env.CI
      ? execFileSync(dockerExecutable, ['compose', 'ps', '-q', 'api'], {
          encoding: 'utf8',
          env: dockerEnvironment,
          timeout: 10_000,
        }).trim()
      : '');
  if (!container)
    throw new Error('Set PROVIDER_SDK_API_CONTAINER to the owned disposable Compose API');
  const info = JSON.parse(
    execFileSync(dockerExecutable, ['inspect', container], {
      encoding: 'utf8',
      env: dockerEnvironment,
      timeout: 10_000,
    }),
  )[0] as {
    Config: { Labels: Record<string, string> };
    NetworkSettings: { Ports: Record<string, Array<{ HostPort: string }> | null> };
  };
  const api = new URL(apiURL);
  if (
    !['127.0.0.1', 'localhost'].includes(api.hostname) ||
    info.Config.Labels['com.docker.compose.service'] !== 'api' ||
    !info.NetworkSettings.Ports['3000/tcp']?.some(({ HostPort }) => HostPort === api.port)
  )
    throw new Error('API URL does not match the owned Compose API');
  const source = readFileSync(new URL('./provider-sdk.mjs', import.meta.url), 'utf8');
  const runner = providerSdkRunnerSource();
  const child = spawn(
    dockerExecutable,
    [
      'exec',
      '-i',
      '-e',
      'PATH=/usr/local/bin:/usr/bin:/bin',
      container,
      '/usr/local/bin/node',
      '--input-type=module',
      '-e',
      `${source}\n${runner}`,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'], env: dockerEnvironment },
  );
  const requests: SdkFixtureRequest[] = [];
  const errors: string[] = [];
  let readyResolve: (value: string) => void;
  let readyReject: (error: Error) => void;
  const ready = new Promise<string>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  let stderr = '';
  let bytes = 0;
  let closed = false;
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4096);
  });
  child.stdin.on('error', (error) => readyReject(error));
  child.on('error', (error) => readyReject(error));
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    try {
      bytes += Buffer.byteLength(line);
      if (bytes > 128_000) throw new Error('Fixture evidence exceeds bound');
      const event = JSON.parse(line) as { kind: string; value: SdkFixtureRequest | string };
      if (
        event.kind === 'ready' &&
        typeof event.value === 'string' &&
        /^http:\/\/127\.0\.0\.1:\d+$/.test(event.value)
      )
        readyResolve(event.value);
      else if (event.kind === 'request') requests.push(event.value as SdkFixtureRequest);
      else if (event.kind === 'error') errors.push(fixtureErrorMessage(event.value));
      else if (event.kind === 'closed') closed = true;
      else throw new Error('Unexpected fixture event');
    } catch (error) {
      readyReject(error instanceof Error ? error : new Error('Fixture event invalid'));
      child.stdin.end();
    }
  });
  const exited = new Promise<number | null>((resolve) =>
    child.once('close', (code) => {
      if (!closed) readyReject(new Error(`Fixture exited unexpectedly: ${stderr}`));
      resolve(code);
    }),
  );
  async function bounded<T>(promise: Promise<T>, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function close() {
    child.stdin.end();
    const code = await bounded(exited, 'Fixture did not close');
    lines.close();
    if (code !== 0 || !closed) throw new Error(`Fixture cleanup failed: ${stderr}`);
  }
  try {
    return {
      container,
      baseURL: await bounded(ready, 'Fixture did not start'),
      requests,
      errors,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export function providerSdkRunnerSource() {
  return String.raw`
const emit = event => process.stdout.write(JSON.stringify(event)+'\n');
process.stdin.resume();
const ended = new Promise(resolve => process.stdin.once('end',resolve));
const fixture = await startProviderSdkFixture({ onRecord: value=>emit({kind:'request',value}), onError:value=>emit({kind:'error',value}) });
emit({kind:'ready',value:fixture.baseURL});
await ended;
await fixture.close();
emit({kind:'closed'});
`;
}
