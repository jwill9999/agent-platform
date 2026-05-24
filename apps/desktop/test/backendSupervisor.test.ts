import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildDesktopBackendEnvironment,
  desktopBackendAvailable,
  getDesktopBackendPaths,
  getDesktopBackendUrl,
  resolveDesktopBackendNodePath,
  resolveDesktopBackendMode,
  waitForBackendReady,
} from '../src/main/backendSupervisor.js';
import type { DesktopRuntimePaths } from '../src/main/runtimePaths.js';

const tempDirs: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-desktop-backend-test-'));
  tempDirs.push(dir);
  return dir;
}

function makeRuntimePaths(runtimeRoot: string): DesktopRuntimePaths {
  return {
    appDataDir: runtimeRoot,
    configDir: join(runtimeRoot, 'config'),
    dataDir: join(runtimeRoot, 'data'),
    logDir: join(runtimeRoot, 'logs'),
    tempDir: join(runtimeRoot, 'tmp'),
    sqlitePath: join(runtimeRoot, 'data/agent.sqlite'),
    configPath: join(runtimeRoot, 'config/runtime.json'),
    secretsMasterKeyPath: join(runtimeRoot, 'config/secrets-master-key.json'),
  };
}

async function startReadyServer(statusCode: number): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(statusCode, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: statusCode === 200 ? 'healthy' : 'unhealthy' }));
  });
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Expected server to listen on a TCP address.');
  }

  return `http://127.0.0.1:${address.port}/health/ready`;
}

describe('desktop backend supervisor helpers', () => {
  it('keeps the desktop backend disabled unless managed mode is requested', () => {
    expect(resolveDesktopBackendMode({})).toBe('disabled');
    expect(resolveDesktopBackendMode({ AGENT_PLATFORM_DESKTOP_BACKEND: 'managed' })).toBe(
      'managed',
    );
  });

  it('resolves backend runtime paths under the desktop runtime directory', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));

    expect(paths.apiEntry).toBe(join(repoRoot, 'apps/api/dist/index.js'));
    expect(paths.stdoutLog).toBe(join(runtimeRoot, 'logs/backend.stdout.log'));
    expect(paths.stderrLog).toBe(join(runtimeRoot, 'logs/backend.stderr.log'));
    expect(paths.sqlitePath).toBe(join(runtimeRoot, 'data/agent.sqlite'));
    expect(paths.configPath).toBe(join(runtimeRoot, 'config/runtime.json'));
    expect(paths.tempDir).toBe(join(runtimeRoot, 'tmp'));
  });

  it('builds a managed backend environment from resolved desktop paths', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    const env = buildDesktopBackendEnvironment({
      env: {
        SCHEDULER_ENABLED: 'true',
        SQLITE_PATH: '/data/agent.sqlite',
      },
      paths,
      port: '4500',
      secretsMasterKeyB64: 'managed-key',
    });

    expect(env).toMatchObject({
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: '4500',
      SCHEDULER_ENABLED: 'true',
      SECRETS_MASTER_KEY: 'managed-key',
      SQLITE_PATH: join(runtimeRoot, 'data/agent.sqlite'),
      AGENT_PLATFORM_DESKTOP_CONFIG_PATH: join(runtimeRoot, 'config/runtime.json'),
      AGENT_PLATFORM_DESKTOP_CONFIG_DIR: join(runtimeRoot, 'config'),
      AGENT_PLATFORM_DESKTOP_DATA_DIR: join(runtimeRoot, 'data'),
      AGENT_PLATFORM_DESKTOP_LOG_DIR: join(runtimeRoot, 'logs'),
      AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(runtimeRoot, 'tmp'),
      AGENT_PLATFORM_COMMAND_RUNNER: 'disabled',
    });
  });

  it('detects when the compiled API backend is available', () => {
    const repoRoot = makeTempRepo();
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(join(repoRoot, 'runtime')));

    expect(desktopBackendAvailable(paths)).toBe(false);

    mkdirSync(join(repoRoot, 'apps/api/dist'), { recursive: true });
    writeFileSync(paths.apiEntry, 'console.log("api");\n');

    expect(existsSync(paths.apiEntry)).toBe(true);
    expect(desktopBackendAvailable(paths)).toBe(true);
  });

  it('resolves the managed backend URL from the desktop backend port', () => {
    expect(getDesktopBackendUrl({})).toBe('http://127.0.0.1:4310');
    expect(getDesktopBackendUrl({ AGENT_PLATFORM_DESKTOP_BACKEND_PORT: '4500' })).toBe(
      'http://127.0.0.1:4500',
    );
  });

  it('prefers a configured backend Node executable over the Electron fallback', () => {
    expect(
      resolveDesktopBackendNodePath(
        {
          AGENT_PLATFORM_DESKTOP_NODE_PATH: '/opt/node/bin/node',
          npm_node_execpath: '/usr/local/bin/node',
        },
        '/Applications/Agent Platform.app/Contents/MacOS/Agent Platform',
      ),
    ).toBe('/opt/node/bin/node');
    expect(
      resolveDesktopBackendNodePath(
        { npm_node_execpath: '/usr/local/bin/node' },
        '/Applications/Agent Platform.app/Contents/MacOS/Agent Platform',
      ),
    ).toBe('/usr/local/bin/node');
  });

  it('waits for a healthy backend readiness endpoint', async () => {
    const readyUrl = await startReadyServer(200);

    await expect(waitForBackendReady(readyUrl, 1_000, { exitCode: null })).resolves.toBeUndefined();
  });

  it('fails if the backend exits before readiness', async () => {
    const readyUrl = await startReadyServer(503);

    await expect(waitForBackendReady(readyUrl, 1_000, { exitCode: 1 })).rejects.toThrow(
      'Desktop backend exited before becoming ready with code 1.',
    );
  });

  it('reports backend process startup errors during readiness', async () => {
    const readyUrl = await startReadyServer(503);

    await expect(
      waitForBackendReady(readyUrl, 1_000, { exitCode: null }, () => new Error('spawn ENOENT')),
    ).rejects.toThrow('Desktop backend failed to start: spawn ENOENT');
  });
});
