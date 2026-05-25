import type { App } from 'electron';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface DesktopRuntimePaths {
  appDataDir: string;
  configDir: string;
  dataDir: string;
  logDir: string;
  resourcesDir: string;
  tempDir: string;
  sqlitePath: string;
  configPath: string;
  secretsMasterKeyPath: string;
  macosVmPackagedAssetsDir: string;
  macosVmPackagedHelperPath: string;
}

export interface ResolveDesktopRuntimePathsOptions {
  userDataDir: string;
  logDir: string;
  resourcesDir?: string;
  tempDir: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveDesktopRuntimePaths({
  userDataDir,
  logDir,
  resourcesDir,
  tempDir,
  env = process.env,
}: ResolveDesktopRuntimePathsOptions): DesktopRuntimePaths {
  const appDataDir = resolve(env.AGENT_PLATFORM_DESKTOP_RUNTIME_DIR ?? userDataDir);
  const configDir = resolve(env.AGENT_PLATFORM_DESKTOP_CONFIG_DIR ?? join(appDataDir, 'config'));
  const dataDir = resolve(env.AGENT_PLATFORM_DESKTOP_DATA_DIR ?? join(appDataDir, 'data'));
  const resolvedLogDir = resolve(env.AGENT_PLATFORM_DESKTOP_LOG_DIR ?? logDir);
  const resolvedResourcesDir = resolve(
    env.AGENT_PLATFORM_DESKTOP_RESOURCES_DIR ?? resourcesDir ?? appDataDir,
  );
  const resolvedTempDir = resolve(env.AGENT_PLATFORM_DESKTOP_TEMP_DIR ?? tempDir);
  const sqliteOverride = env.AGENT_PLATFORM_DESKTOP_SQLITE_PATH?.trim();
  const macosVmResourceDir = join(resolvedResourcesDir, 'macos-vm');

  return {
    appDataDir,
    configDir,
    dataDir,
    logDir: resolvedLogDir,
    resourcesDir: resolvedResourcesDir,
    tempDir: resolvedTempDir,
    sqlitePath: resolve(sqliteOverride || join(dataDir, 'agent.sqlite')),
    configPath: resolve(env.AGENT_PLATFORM_DESKTOP_CONFIG_PATH ?? join(configDir, 'runtime.json')),
    secretsMasterKeyPath: resolve(join(configDir, 'secrets-master-key.json')),
    macosVmPackagedAssetsDir: resolve(join(macosVmResourceDir, 'images')),
    macosVmPackagedHelperPath: resolve(join(macosVmResourceDir, 'macos-vm-runner')),
  };
}

export function resolveDesktopRuntimePathsFromApp(
  app: Pick<App, 'getPath'>,
  env: NodeJS.ProcessEnv = process.env,
): DesktopRuntimePaths {
  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  return resolveDesktopRuntimePaths({
    userDataDir: app.getPath('userData'),
    logDir: app.getPath('logs'),
    resourcesDir: electronProcess.resourcesPath,
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
