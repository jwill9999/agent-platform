import { createServer } from 'node:net';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getDesktopBackendPaths,
  startDesktopBackend,
  type DesktopBackendHandle,
} from '../src/main/backendSupervisor.js';
import { resolveDesktopRuntimePathsFromApp } from '../src/main/runtimePaths.js';

const sentinel = {
  stdout: Buffer.from([0, 255, 13, 10, 83, 69, 78, 84, 73, 78, 69, 76]),
  stderr: Buffer.from('unrelated stderr remains byte-identical\n'),
};

async function freePort(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture port allocation failed');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return String(address.port);
}

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'desktop-log-ownership-'));
  const unrelatedLogs = join(root, 'unrelated-profile', 'logs');
  mkdirSync(unrelatedLogs, { recursive: true });
  for (const channel of ['stdout', 'stderr'] as const)
    writeFileSync(join(unrelatedLogs, `backend.${channel}.log`), sentinel[channel]);
  const runtime = join(root, 'disposable-runtime');
  const env = {
    HOME: join(runtime, 'home'),
    AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime,
    // Simulate an ambient owner's override, then apply the exact fixture override after it.
    ...{ AGENT_PLATFORM_DESKTOP_LOG_DIR: unrelatedLogs },
    AGENT_PLATFORM_COMMAND_RUNNER: 'disabled',
    AGENT_PLATFORM_DESKTOP_BACKEND_PORT: await freePort(),
  };
  const isolatedEnv = { ...env, AGENT_PLATFORM_DESKTOP_LOG_DIR: join(runtime, 'logs') };
  const app = {
    getPath: (name: string) => {
      if (name === 'logs') return unrelatedLogs;
      if (name === 'temp') return join(root, 'app-temp');
      return join(root, 'unrelated-profile');
    },
  };
  // This production resolver deliberately does not derive logs from HOME or runtimeDir.
  const unsafePaths = resolveDesktopRuntimePathsFromApp(app, env);
  expect(unsafePaths.logDir).toBe(unrelatedLogs);
  const paths = getDesktopBackendPaths(root, resolveDesktopRuntimePathsFromApp(app, isolatedEnv));
  mkdirSync(join(root, 'apps/api/dist'), { recursive: true });
  return {
    root,
    runtime,
    unrelatedLogs,
    paths,
    env: isolatedEnv,
    handles: [] as DesktopBackendHandle[],
    pending: [] as Promise<DesktopBackendHandle>[],
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

function checkSentinels(f: Fixture): void {
  for (const channel of ['stdout', 'stderr'] as const)
    expect(readFileSync(join(f.unrelatedLogs, `backend.${channel}.log`))).toEqual(
      sentinel[channel],
    );
}
function fakeApi(f: Fixture, mode: 'ready' | 'failure' | 'never-ready', run: string): void {
  mkdirSync(join(f.runtime, 'config'), { recursive: true });
  writeFileSync(f.paths.configPath, JSON.stringify({ mode, run }));
  // Static owned code; fixture values travel as JSON data, never generated JavaScript.
  writeFileSync(
    f.paths.apiEntry,
    `
    const http = require('node:http');
    const fs = require('node:fs');
    const {mode, run} = JSON.parse(fs.readFileSync(process.env.AGENT_PLATFORM_DESKTOP_CONFIG_PATH, 'utf8'));
    process.stdout.write(JSON.stringify({pid: process.pid, run}) + '\\n');
    process.stderr.write('owned stderr ' + run + '\\n');
    if (mode === 'failure') {
      process.stdout.write('owned failure evidence\\n', () => process.stderr.write('failed before ready\\n', () => process.exit(23)));
    } else {
      const server = http.createServer((req, res) => {res.writeHead(mode === 'never-ready' ? 503 : 200); res.end('ready');});
      server.listen(Number(process.env.PORT), '127.0.0.1');
      process.once('SIGTERM', () => server.close(() => process.stdout.write('owned close ' + run + '\\n', () => process.exit(0))));
    }
  `,
  );
}
function expectGoneFromLog(f: Fixture): void {
  const firstLine = readFileSync(f.paths.stdoutLog, 'utf8').split('\n')[0];
  const { pid } = JSON.parse(firstLine ?? '{}') as { pid: number };
  expect(Number.isSafeInteger(pid)).toBe(true);
  expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
}
function launch(f: Fixture, signal: AbortSignal): Promise<DesktopBackendHandle> {
  const pending = startDesktopBackend({
    paths: f.paths,
    nodePath: process.execPath,
    env: f.env,
    signal,
  });
  f.pending.push(pending);
  return pending.then((handle) => {
    f.handles.push(handle);
    return handle;
  });
}
async function stopAndRetain(f: Fixture, passed: boolean): Promise<void> {
  // A failed stop preserves paths/evidence. Never delete a live child's directory.
  await Promise.allSettled(f.pending);
  await Promise.all(f.handles.map((handle) => handle.stop()));
  checkSentinels(f);
  if (passed) rmSync(f.root, { recursive: true, force: true });
}

describe('real managed backend fixture log isolation', () => {
  it('preserves unrelated logs through ready, confirmed close, restart and owned cleanup', async ({
    signal,
  }) => {
    const f = await fixture();
    let passed = false;
    try {
      fakeApi(f, 'ready', 'first');
      const first = await launch(f, signal);
      expect(first.logs).toEqual({
        stdout: join(f.runtime, 'logs/backend.stdout.log'),
        stderr: join(f.runtime, 'logs/backend.stderr.log'),
      });
      expect((await fetch(first.readyUrl)).status).toBe(200);
      checkSentinels(f);
      await first.stop();
      expectGoneFromLog(f);
      expect(readFileSync(f.paths.stdoutLog, 'utf8')).toContain('owned close first');
      expect(readFileSync(f.paths.stderrLog, 'utf8')).toBe('owned stderr first\n');
      const retained = join(f.root, 'retained-fixture-evidence');
      mkdirSync(retained);
      copyFileSync(f.paths.stdoutLog, join(retained, 'first.stdout.log'));
      fakeApi(f, 'ready', 'restart');
      const restarted = await launch(f, signal);
      await restarted.stop();
      expectGoneFromLog(f);
      expect(readFileSync(f.paths.stdoutLog, 'utf8')).toContain('owned close restart');
      expect(readFileSync(f.paths.stdoutLog, 'utf8')).not.toContain('first');
      expect(readFileSync(join(retained, 'first.stdout.log'), 'utf8')).toContain(
        'owned close first',
      );
      rmSync(f.runtime, { recursive: true, force: true });
      expect(existsSync(f.runtime)).toBe(false);
      checkSentinels(f);
      passed = true;
    } finally {
      await stopAndRetain(f, passed);
    }
  });

  it('joins early failure and preserves its owned evidence before cleanup without touching sentinel bytes', async ({
    signal,
  }) => {
    const f = await fixture();
    let passed = false;
    try {
      fakeApi(f, 'failure', 'failed');
      await expect(launch(f, signal)).rejects.toThrow('exited before becoming ready with code 23');
      expectGoneFromLog(f);
      expect(readFileSync(f.paths.stdoutLog, 'utf8')).toContain('owned failure evidence');
      expect(readFileSync(f.paths.stderrLog, 'utf8')).toContain('failed before ready');
      const retained = join(f.root, 'retained-fixture-evidence');
      mkdirSync(retained);
      copyFileSync(f.paths.stdoutLog, join(retained, 'failed.stdout.log'));
      copyFileSync(f.paths.stderrLog, join(retained, 'failed.stderr.log'));
      checkSentinels(f);
      rmSync(f.runtime, { recursive: true, force: true });
      expect(readFileSync(join(retained, 'failed.stdout.log'), 'utf8')).toContain(
        'owned failure evidence',
      );
      expect(readFileSync(join(retained, 'failed.stderr.log'), 'utf8')).toContain(
        'failed before ready',
      );
      checkSentinels(f);
      passed = true;
    } finally {
      await stopAndRetain(f, passed);
    }
  });
  it('aborts a never-ready owned child and joins close before deleting its paths', async ({
    signal,
  }) => {
    const f = await fixture();
    const controller = new AbortController();
    let passed = false;
    try {
      fakeApi(f, 'never-ready', 'cancelled');
      const pending = launch(f, AbortSignal.any([signal, controller.signal]));
      const rejected = expect(pending).rejects.toHaveProperty('name', 'AbortError');
      await expect
        .poll(
          () =>
            existsSync(f.paths.stdoutLog) &&
            readFileSync(f.paths.stdoutLog, 'utf8').includes('cancelled'),
        )
        .toBe(true);
      checkSentinels(f);
      controller.abort();
      await rejected;
      expectGoneFromLog(f);
      expect(readFileSync(f.paths.stdoutLog, 'utf8')).toContain('owned close cancelled');
      rmSync(f.runtime, { recursive: true, force: true });
      checkSentinels(f);
      passed = true;
    } finally {
      controller.abort();
      await stopAndRetain(f, passed);
    }
  });
});
