import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildDesktopBackendEnvironment,
  desktopBackendAvailable,
  ensurePackagedMacosVmAssets,
  getDesktopBackendPaths,
  getDesktopBackendUrl,
  repairPackagedMacosVmRuntime,
  resolveDesktopBackendNodePath,
  resolveDesktopBackendMode,
  waitForBackendReady,
} from '../src/main/backendSupervisor.js';
import type { DesktopRuntimePaths } from '../src/main/runtimePaths.js';

const tempDirs: string[] = [];
const servers: Server[] = [];
const childProcesses: ChildProcess[] = [];

afterEach(async () => {
  for (const child of childProcesses.splice(0)) {
    child.kill('SIGTERM');
  }

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
    resourcesDir: join(runtimeRoot, 'resources'),
    macosVmPackagedAssetsDir: join(runtimeRoot, 'resources/macos-vm/images'),
    macosVmPackagedHelperPath: join(runtimeRoot, 'resources/macos-vm/macos-vm-runner'),
  };
}

function writePackagedMacosVmResources(
  paths: DesktopBackendPaths,
  runtimeRoot: string,
  options: { assets?: boolean; helper?: boolean } = {},
): void {
  const { assets = true, helper = true } = options;
  mkdirSync(join(runtimeRoot, 'resources/macos-vm'), { recursive: true });
  if (helper) {
    writeFileSync(paths.macosVmPackagedHelperPath, '#!/bin/sh\n');
    chmodSync(paths.macosVmPackagedHelperPath, 0o755);
  }
  if (assets) {
    mkdirSync(paths.macosVmPackagedAssetsDir, { recursive: true });
    writeFileSync(join(paths.macosVmPackagedAssetsDir, 'manifest.json'), '{"schemaVersion":2}\n');
  }
}

function expectPackagedMacosVmEnvironment(
  env: ReturnType<typeof buildDesktopBackendEnvironment>,
  paths: DesktopBackendPaths,
  runtimeRoot: string,
): void {
  expect(env.AGENT_PLATFORM_COMMAND_RUNNER).toBe('macos-vm');
  expect(env.AGENT_PLATFORM_MACOS_VM_RUNNER_PATH).toBe(paths.macosVmPackagedHelperPath);
  expect(env.AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR).toBe(join(runtimeRoot, 'data/vm'));
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
    expect(paths.macosVmPackagedAssetsDir).toBe(join(runtimeRoot, 'resources/macos-vm/images'));
    expect(paths.macosVmPackagedHelperPath).toBe(
      join(runtimeRoot, 'resources/macos-vm/macos-vm-runner'),
    );
  });

  it('builds a managed backend environment from resolved desktop paths', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    const env = buildDesktopBackendEnvironment({
      env: {
        SCHEDULER_ENABLED: 'true',
        SQLITE_PATH: '/data/agent.sqlite',
        AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: '/app/macos-vm-runner',
        AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: 'E2E response',
        AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: '{"name":"sys_get_current_time","args":{}}',
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
      AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: join(runtimeRoot, 'data/vm'),
      AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: '/app/macos-vm-runner',
      AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: 'E2E response',
      AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: '{"name":"sys_get_current_time","args":{}}',
    });
  });

  it('uses the packaged macOS VM helper path when no developer override is set', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    writePackagedMacosVmResources(paths, runtimeRoot, { assets: false });

    const env = buildDesktopBackendEnvironment({
      env: {
        AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
      },
      paths,
      port: '4500',
    });

    expectPackagedMacosVmEnvironment(env, paths, runtimeRoot);
  });

  it('selects packaged macOS VM mode when packaged helper and assets exist', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    writePackagedMacosVmResources(paths, runtimeRoot);

    const env = buildDesktopBackendEnvironment({
      env: {},
      paths,
      port: '4500',
    });

    expectPackagedMacosVmEnvironment(env, paths, runtimeRoot);
  });

  it('copies packaged macOS VM assets into the app-owned runtime directory', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    writePackagedMacosVmResources(paths, runtimeRoot);

    ensurePackagedMacosVmAssets(paths, {});

    expect(existsSync(join(runtimeRoot, 'data/vm/images/manifest.json'))).toBe(true);
  });

  it('repairs only app-owned macOS VM runtime state and preserves diagnostics', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    const vmRuntimeDir = join(runtimeRoot, 'data/vm');
    writePackagedMacosVmResources(paths, runtimeRoot);
    mkdirSync(join(vmRuntimeDir, 'state/commands/jobs'), { recursive: true });
    mkdirSync(join(vmRuntimeDir, 'images'), { recursive: true });
    mkdirSync(join(vmRuntimeDir, 'logs'), { recursive: true });
    writeFileSync(join(vmRuntimeDir, 'state/daemon.pid'), '999999\n');
    writeFileSync(join(vmRuntimeDir, 'images/manifest.json'), '{"corrupt":true}\n');
    writeFileSync(join(vmRuntimeDir, 'logs/last-error.log'), 'boot failed\n');

    const result = repairPackagedMacosVmRuntime({ paths, env: {} });

    expect(result).toMatchObject({
      ok: true,
      runtimeDir: vmRuntimeDir,
      stoppedRunningVm: false,
      repairedAssets: true,
      preservedDiagnostics: true,
      preservedProjectFolders: true,
    });
    expect(result.deletedPaths).toEqual([
      join(vmRuntimeDir, 'state'),
      join(vmRuntimeDir, 'images'),
    ]);
    expect(existsSync(join(vmRuntimeDir, 'state'))).toBe(false);
    expect(existsSync(join(vmRuntimeDir, 'logs/last-error.log'))).toBe(true);
    expect(existsSync(join(vmRuntimeDir, 'images/manifest.json'))).toBe(true);
  });

  it('refuses to repair arbitrary or symlinked macOS VM runtime paths', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const projectRoot = join(makeTempRepo(), 'project');
    const projectFile = join(projectRoot, 'README.md');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    writePackagedMacosVmResources(paths, runtimeRoot);
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(projectFile, '# Project\n');

    expect(() =>
      repairPackagedMacosVmRuntime({
        paths,
        env: { AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: projectRoot },
      }),
    ).toThrow('Refusing to repair unsafe macOS VM runtime path');
    expect(existsSync(projectFile)).toBe(true);

    const symlinkPath = join(runtimeRoot, 'data/vm-link');
    mkdirSync(join(runtimeRoot, 'data'), { recursive: true });
    symlinkSync(projectRoot, symlinkPath);
    expect(() =>
      repairPackagedMacosVmRuntime({
        paths,
        env: { AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: symlinkPath },
      }),
    ).toThrow('Refusing to repair symlinked macOS VM runtime path');
    expect(existsSync(projectFile)).toBe(true);
  });

  it('stops a running macOS VM daemon before repairing runtime state', async () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    const vmRuntimeDir = join(runtimeRoot, 'data/vm');
    writePackagedMacosVmResources(paths, runtimeRoot);
    mkdirSync(join(vmRuntimeDir, 'state'), { recursive: true });
    const child = spawn('/bin/sh', ['-c', 'sleep 30'], { stdio: 'ignore' });
    childProcesses.push(child);
    await new Promise<void>((resolve) => {
      child.once('spawn', () => resolve());
    });
    writeFileSync(join(vmRuntimeDir, 'state/daemon.pid'), `${child.pid}\n`);
    writeFileSync(
      paths.macosVmPackagedHelperPath,
      `#!/bin/sh\nkill ${child.pid}\nrm -f "$3/state/daemon.pid"\n`,
    );
    chmodSync(paths.macosVmPackagedHelperPath, 0o755);

    const result = repairPackagedMacosVmRuntime({ paths, env: {} });

    expect(result.stoppedRunningVm).toBe(true);
    expect(existsSync(join(vmRuntimeDir, 'state'))).toBe(false);
  });

  it('fails closed when macOS VM mode is selected but packaged assets are missing', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    writePackagedMacosVmResources(paths, runtimeRoot, { assets: false });

    expect(() =>
      ensurePackagedMacosVmAssets(paths, { AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm' }),
    ).toThrow('Packaged macOS VM assets are missing');
  });

  it('fails closed when macOS VM mode is selected but the packaged helper is missing', () => {
    const repoRoot = makeTempRepo();
    const runtimeRoot = join(repoRoot, 'runtime');
    const paths = getDesktopBackendPaths(repoRoot, makeRuntimePaths(runtimeRoot));
    writePackagedMacosVmResources(paths, runtimeRoot, { helper: false });

    expect(() =>
      ensurePackagedMacosVmAssets(paths, { AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm' }),
    ).toThrow('Packaged macOS VM helper is missing');
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
