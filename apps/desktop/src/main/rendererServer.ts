import { ownDesktopChild } from './ownedDesktopChild.js';
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { get } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export type DesktopRendererMode = 'bootstrap' | 'dev-server' | 'standalone';

export interface StandaloneRendererPaths {
  repoRoot: string;
  standaloneRoot: string;
  serverEntry: string;
  staticSource: string;
  staticTarget: string;
  publicSource: string;
  publicTarget: string;
}

export interface StandaloneRendererHandle {
  url: string;
  stop: () => Promise<void>;
}

interface StartStandaloneRendererOptions {
  paths: StandaloneRendererPaths;
  electronPath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const defaultStandalonePort = 4301;

export function resolveDesktopRendererMode(env: NodeJS.ProcessEnv): DesktopRendererMode {
  const configuredMode = env.AGENT_PLATFORM_DESKTOP_RENDERER;

  if (configuredMode === 'standalone' || configuredMode === 'dev-server') {
    return configuredMode;
  }

  if (env.AGENT_PLATFORM_DESKTOP_DEV_SERVER_URL) {
    return 'dev-server';
  }

  return 'bootstrap';
}

export function resolveDesktopDevServerUrl(env: NodeJS.ProcessEnv): string {
  return env.AGENT_PLATFORM_DESKTOP_DEV_SERVER_URL ?? 'http://127.0.0.1:3001';
}

export function getRepoRootFromMainDir(mainDir: string): string {
  let currentDir = resolve(mainDir);

  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return resolve(mainDir, '../../../..');
}

export function getStandaloneRendererPaths(repoRoot: string): StandaloneRendererPaths {
  const standaloneRoot = join(repoRoot, 'apps/web/.next/standalone');

  return {
    repoRoot,
    standaloneRoot,
    serverEntry: join(standaloneRoot, 'apps/web/server.js'),
    staticSource: join(repoRoot, 'apps/web/.next/static'),
    staticTarget: join(standaloneRoot, 'apps/web/.next/static'),
    publicSource: join(repoRoot, 'apps/web/public'),
    publicTarget: join(standaloneRoot, 'apps/web/public'),
  };
}

export function standaloneRendererAvailable(paths: StandaloneRendererPaths): boolean {
  return existsSync(paths.standaloneRoot) && existsSync(paths.serverEntry);
}

export function ensureStandaloneRendererAssets(paths: StandaloneRendererPaths): void {
  if (existsSync(paths.staticSource)) {
    mkdirSync(dirname(paths.staticTarget), { recursive: true });
    cpSync(paths.staticSource, paths.staticTarget, { recursive: true, force: true });
  }

  if (existsSync(paths.publicSource)) {
    mkdirSync(dirname(paths.publicTarget), { recursive: true });
    cpSync(paths.publicSource, paths.publicTarget, { recursive: true, force: true });
  }
}

export async function startStandaloneRenderer({
  paths,
  electronPath,
  env = process.env,
  timeoutMs = 15_000,
  signal,
}: StartStandaloneRendererOptions): Promise<StandaloneRendererHandle> {
  signal?.throwIfAborted();
  if (!standaloneRendererAvailable(paths)) {
    throw new Error(
      `Next standalone renderer build was not found at ${paths.serverEntry}. Run pnpm --filter @agent-platform/web build first.`,
    );
  }

  ensureStandaloneRendererAssets(paths);
  signal?.throwIfAborted();

  const port = env.AGENT_PLATFORM_DESKTOP_RENDERER_PORT ?? String(defaultStandalonePort);
  const hostname = '127.0.0.1';
  const url = `http://${hostname}:${port}`;
  const child = spawnStandaloneServer({
    electronPath,
    paths,
    env,
    hostname,
    port,
  });

  const owned = ownDesktopChild(child);
  try {
    await waitForHttp(url, timeoutMs, child, owned.processError, signal);
    signal?.throwIfAborted();
  } catch (error) {
    await owned.stop();
    throw error;
  }

  return {
    url,
    stop: owned.stop,
  };
}

function spawnStandaloneServer({
  electronPath,
  paths,
  env,
  hostname,
  port,
}: {
  electronPath: string;
  paths: StandaloneRendererPaths;
  env: NodeJS.ProcessEnv;
  hostname: string;
  port: string;
}): ChildProcess {
  return spawn(electronPath, [paths.serverEntry], {
    cwd: paths.standaloneRoot,
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: '1',
      HOSTNAME: hostname,
      DIAGNOSTICS_WEB_HOST: `${hostname}:${port}`,
      DIAGNOSTICS_LOCAL_TOPOLOGY: 'loopback',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: port,
    },
    stdio: 'ignore',
  });
}

async function waitForHttp(
  url: string,
  timeoutMs: number,
  child: ChildProcess,
  processError: () => Error | undefined,
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  // Each attempt completes before scheduling its successor; never overlap health probes.
  async function attempt(): Promise<void> {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for standalone renderer at ${url}.`);
    }
    signal?.throwIfAborted();
    if (processError()) throw processError();
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Standalone renderer exited before becoming ready with code ${child.exitCode}.`,
      );
    }

    if (await canReachHttp(url, signal)) {
      return;
    }

    await delay(250, undefined, { signal });
    return attempt();
  }

  return attempt();
}

function canReachHttp(url: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolveReachable) => {
    let settled = false;
    const resolveOnce = (reachable: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolveReachable(reachable);
    };

    const request = get(url, { signal }, (response) => {
      response.resume();
      resolveOnce((response.statusCode ?? 500) < 500);
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
