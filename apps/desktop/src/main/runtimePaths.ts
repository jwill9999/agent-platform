import type { App } from 'electron';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface DesktopRuntimePaths {
  appDataDir: string;
  configDir: string;
  dataDir: string;
  logDir: string;
  tempDir: string;
  sqlitePath: string;
  configPath: string;
}

export interface ResolveDesktopRuntimePathsOptions {
  userDataDir: string;
  logDir: string;
  tempDir: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveDesktopRuntimePaths({
  userDataDir,
  logDir,
  tempDir,
  env = process.env,
}: ResolveDesktopRuntimePathsOptions): DesktopRuntimePaths {
  const appDataDir = resolve(env.AGENT_PLATFORM_DESKTOP_RUNTIME_DIR ?? userDataDir);
  const configDir = resolve(env.AGENT_PLATFORM_DESKTOP_CONFIG_DIR ?? join(appDataDir, 'config'));
  const dataDir = resolve(env.AGENT_PLATFORM_DESKTOP_DATA_DIR ?? join(appDataDir, 'data'));
  const resolvedLogDir = resolve(env.AGENT_PLATFORM_DESKTOP_LOG_DIR ?? logDir);
  const resolvedTempDir = resolve(env.AGENT_PLATFORM_DESKTOP_TEMP_DIR ?? tempDir);

  return {
    appDataDir,
    configDir,
    dataDir,
    logDir: resolvedLogDir,
    tempDir: resolvedTempDir,
    sqlitePath: resolve(env.SQLITE_PATH?.trim() || join(dataDir, 'agent.sqlite')),
    configPath: resolve(env.AGENT_PLATFORM_DESKTOP_CONFIG_PATH ?? join(configDir, 'runtime.json')),
  };
}

export function resolveDesktopRuntimePathsFromApp(
  app: Pick<App, 'getPath'>,
  env: NodeJS.ProcessEnv = process.env,
): DesktopRuntimePaths {
  return resolveDesktopRuntimePaths({
    userDataDir: app.getPath('userData'),
    logDir: app.getPath('logs'),
    tempDir: app.getPath('temp'),
    env,
  });
}

export function ensureDesktopRuntimeDirectories(paths: DesktopRuntimePaths): void {
  mkdirSync(paths.configDir, { recursive: true });
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.logDir, { recursive: true });
  mkdirSync(paths.tempDir, { recursive: true });
}
