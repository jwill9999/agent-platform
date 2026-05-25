import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { cpSync, createWriteStream, existsSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { get } from 'node:http';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import type { DesktopRuntimePaths } from './runtimePaths.js';

export type DesktopBackendMode = 'disabled' | 'managed';

export interface DesktopBackendPaths {
  repoRoot: string;
  apiEntry: string;
  stdoutLog: string;
  stderrLog: string;
  sqlitePath: string;
  configPath: string;
  tempDir: string;
  macosVmPackagedAssetsDir: string;
  macosVmPackagedHelperPath: string;
}

export interface DesktopBackendHandle {
  url: string;
  readyUrl: string;
  logs: {
    stdout: string;
    stderr: string;
  };
  stop: () => Promise<void>;
}

interface StartDesktopBackendOptions {
  paths: DesktopBackendPaths;
  nodePath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxLogBytes?: number;
  secretsMasterKeyB64?: string;
}

export interface DesktopBackendEnvironment {
  readonly HOST: string;
  readonly NODE_ENV: string;
  readonly PORT: string;
  readonly SCHEDULER_ENABLED: string;
  readonly SECRETS_MASTER_KEY?: string;
  readonly SQLITE_PATH: string;
  readonly AGENT_PLATFORM_DESKTOP_CONFIG_PATH: string;
  readonly AGENT_PLATFORM_DESKTOP_CONFIG_DIR: string;
  readonly AGENT_PLATFORM_DESKTOP_DATA_DIR: string;
  readonly AGENT_PLATFORM_DESKTOP_LOG_DIR: string;
  readonly AGENT_PLATFORM_DESKTOP_TEMP_DIR: string;
  readonly AGENT_PLATFORM_COMMAND_RUNNER: string;
  readonly AGENT_PLATFORM_MACOS_VM_RUNNER_PATH?: string;
  readonly AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: string;
}

const defaultBackendPort = 4310;
const defaultMaxLogBytes = 1024 * 1024;

export function resolveDesktopBackendMode(env: NodeJS.ProcessEnv): DesktopBackendMode {
  return env.AGENT_PLATFORM_DESKTOP_BACKEND === 'managed' ? 'managed' : 'disabled';
}

export function getDesktopBackendPaths(
  repoRoot: string,
  runtimePaths: DesktopRuntimePaths,
): DesktopBackendPaths {
  return {
    repoRoot,
    apiEntry: join(repoRoot, 'apps/api/dist/index.js'),
    stdoutLog: join(runtimePaths.logDir, 'backend.stdout.log'),
    stderrLog: join(runtimePaths.logDir, 'backend.stderr.log'),
    sqlitePath: runtimePaths.sqlitePath,
    configPath: runtimePaths.configPath,
    tempDir: runtimePaths.tempDir,
    macosVmPackagedAssetsDir: runtimePaths.macosVmPackagedAssetsDir,
    macosVmPackagedHelperPath: runtimePaths.macosVmPackagedHelperPath,
  };
}

export function getDesktopBackendUrl(env: NodeJS.ProcessEnv): string {
  const port = env.AGENT_PLATFORM_DESKTOP_BACKEND_PORT ?? String(defaultBackendPort);
  return `http://127.0.0.1:${port}`;
}

export function resolveDesktopBackendNodePath(
  env: NodeJS.ProcessEnv,
  fallbackPath: string,
): string {
  return env.AGENT_PLATFORM_DESKTOP_NODE_PATH ?? env.npm_node_execpath ?? fallbackPath;
}

export function desktopBackendAvailable(paths: DesktopBackendPaths): boolean {
  return existsSync(paths.apiEntry);
}

export function buildDesktopBackendEnvironment({
  env,
  paths,
  port,
  secretsMasterKeyB64,
}: {
  env: NodeJS.ProcessEnv;
  paths: DesktopBackendPaths;
  port: string;
  secretsMasterKeyB64?: string;
}): DesktopBackendEnvironment {
  const secretsMasterKey = secretsMasterKeyB64 ?? env.SECRETS_MASTER_KEY?.trim();
  const macosVmHelperPath =
    env.AGENT_PLATFORM_MACOS_VM_RUNNER_PATH ??
    (existsSync(paths.macosVmPackagedHelperPath) ? paths.macosVmPackagedHelperPath : undefined);
  return {
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
    PORT: port,
    SCHEDULER_ENABLED: env.SCHEDULER_ENABLED ?? 'false',
    ...(secretsMasterKey ? { SECRETS_MASTER_KEY: secretsMasterKey } : {}),
    SQLITE_PATH: paths.sqlitePath,
    AGENT_PLATFORM_DESKTOP_CONFIG_PATH: paths.configPath,
    AGENT_PLATFORM_DESKTOP_CONFIG_DIR: dirname(paths.configPath),
    AGENT_PLATFORM_DESKTOP_DATA_DIR: dirname(paths.sqlitePath),
    AGENT_PLATFORM_DESKTOP_LOG_DIR: dirname(paths.stdoutLog),
    AGENT_PLATFORM_DESKTOP_TEMP_DIR: paths.tempDir,
    AGENT_PLATFORM_COMMAND_RUNNER: env.AGENT_PLATFORM_COMMAND_RUNNER ?? 'disabled',
    AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR:
      env.AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR ?? join(dirname(paths.sqlitePath), 'vm'),
    ...(macosVmHelperPath ? { AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: macosVmHelperPath } : {}),
  };
}

export async function startDesktopBackend({
  paths,
  nodePath,
  env = process.env,
  timeoutMs = 15_000,
  maxLogBytes = defaultMaxLogBytes,
  secretsMasterKeyB64,
}: StartDesktopBackendOptions): Promise<DesktopBackendHandle> {
  if (!desktopBackendAvailable(paths)) {
    throw new Error(
      `Desktop backend build was not found at ${paths.apiEntry}. Run pnpm --filter @agent-platform/api... build first.`,
    );
  }

  mkdirSync(dirname(paths.stdoutLog), { recursive: true });
  ensurePackagedMacosVmAssets(paths, env);
  rotateLogIfNeeded(paths.stdoutLog, maxLogBytes);
  rotateLogIfNeeded(paths.stderrLog, maxLogBytes);

  const url = getDesktopBackendUrl(env);
  const child = spawnBackendProcess({
    nodePath,
    paths,
    env,
    port: env.AGENT_PLATFORM_DESKTOP_BACKEND_PORT ?? String(defaultBackendPort),
    secretsMasterKeyB64,
  });
  let processError: Error | undefined;
  child.once('error', (error: Error) => {
    processError = error;
  });
  const stdout = createWriteStream(paths.stdoutLog, { flags: 'w' });
  const stderr = createWriteStream(paths.stderrLog, { flags: 'w' });

  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);

  try {
    await waitForBackendReady(`${url}/health/ready`, timeoutMs, child, () => processError);
  } catch (error) {
    await stopDesktopChild(child, stdout, stderr);
    throw error;
  }

  return {
    url,
    readyUrl: `${url}/health/ready`,
    logs: {
      stdout: paths.stdoutLog,
      stderr: paths.stderrLog,
    },
    stop: () => stopDesktopChild(child, stdout, stderr),
  };
}

export function ensurePackagedMacosVmAssets(
  paths: DesktopBackendPaths,
  env: NodeJS.ProcessEnv,
): void {
  const mode = env.AGENT_PLATFORM_COMMAND_RUNNER ?? env.AGENT_COMMAND_RUNNER;
  if (mode !== 'macos-vm') return;

  const runtimeDir =
    env.AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR ?? join(dirname(paths.sqlitePath), 'vm');
  const runtimeImagesDir = join(runtimeDir, 'images');
  const manifestPath = join(paths.macosVmPackagedAssetsDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    throw new Error(
      `Packaged macOS VM assets are missing at ${paths.macosVmPackagedAssetsDir}. Run native:vm:package before packaging the desktop app.`,
    );
  }

  mkdirSync(runtimeImagesDir, { recursive: true });
  cpSync(paths.macosVmPackagedAssetsDir, runtimeImagesDir, { recursive: true, force: true });
}

function spawnBackendProcess({
  nodePath,
  paths,
  env,
  port,
  secretsMasterKeyB64,
}: {
  nodePath: string;
  paths: DesktopBackendPaths;
  env: NodeJS.ProcessEnv;
  port: string;
  secretsMasterKeyB64?: string;
}): ChildProcess {
  const desktopEnv = buildDesktopBackendEnvironment({ env, paths, port, secretsMasterKeyB64 });

  return spawn(nodePath, [paths.apiEntry], {
    cwd: paths.repoRoot,
    env: {
      ...env,
      ...desktopEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function waitForBackendReady(
  readyUrl: string,
  timeoutMs: number,
  child: Pick<ChildProcess, 'exitCode'>,
  getProcessError?: () => Error | undefined,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const processError = getProcessError?.();
    if (processError) {
      throw new Error(`Desktop backend failed to start: ${processError.message}`);
    }

    if (child.exitCode !== null) {
      throw new Error(`Desktop backend exited before becoming ready with code ${child.exitCode}.`);
    }

    if (await canReachReadyEndpoint(readyUrl)) {
      return;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for desktop backend at ${readyUrl}.`);
}

function canReachReadyEndpoint(url: string): Promise<boolean> {
  return new Promise((resolveReachable) => {
    let settled = false;
    const resolveOnce = (reachable: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolveReachable(reachable);
    };

    const request = get(url, (response) => {
      response.resume();
      resolveOnce(response.statusCode === 200);
    });

    request.on('error', () => {
      resolveOnce(false);
    });
    request.setTimeout(1_000, () => {
      request.destroy();
      resolveOnce(false);
    });
  });
}

function rotateLogIfNeeded(logPath: string, maxLogBytes: number): void {
  if (!existsSync(logPath)) {
    return;
  }

  if (statSync(logPath).size > maxLogBytes) {
    rmSync(logPath, { force: true });
  }
}

function stopDesktopChild(
  child: ChildProcess,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): Promise<void> {
  const closeLogs = (): void => {
    stdout.end();
    stderr.end();
  };

  if (child.exitCode !== null || child.killed) {
    closeLogs();
    return Promise.resolve();
  }

  return new Promise((resolveStopped) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      closeLogs();
      resolveStopped();
    }, 2_000);

    child.once('exit', () => {
      clearTimeout(timeout);
      closeLogs();
      resolveStopped();
    });

    child.kill('SIGTERM');
  });
}
