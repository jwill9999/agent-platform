import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ensureDesktopRuntimeDirectories,
  resolveDesktopRuntimePaths,
  resolveDesktopRuntimePathsFromApp,
} from '../src/main/runtimePaths.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-runtime-paths-test-'));
  tempDirs.push(dir);
  return dir;
}

describe('desktop runtime path resolution', () => {
  it('uses Electron OS paths for desktop app data by default', () => {
    const paths = resolveDesktopRuntimePaths({
      userDataDir: '/Users/test/Library/Application Support/Agent Platform',
      logDir: '/Users/test/Library/Logs/Agent Platform',
      tempDir: '/var/folders/test/T',
      env: {},
    });

    expect(paths.appDataDir).toBe('/Users/test/Library/Application Support/Agent Platform');
    expect(paths.configDir).toBe('/Users/test/Library/Application Support/Agent Platform/config');
    expect(paths.dataDir).toBe('/Users/test/Library/Application Support/Agent Platform/data');
    expect(paths.logDir).toBe('/Users/test/Library/Logs/Agent Platform');
    expect(paths.tempDir).toBe('/var/folders/test/T');
    expect(paths.sqlitePath).toBe(
      '/Users/test/Library/Application Support/Agent Platform/data/agent.sqlite',
    );
    expect(paths.configPath).toBe(
      '/Users/test/Library/Application Support/Agent Platform/config/runtime.json',
    );
    expect(paths.secretsMasterKeyPath).toBe(
      '/Users/test/Library/Application Support/Agent Platform/config/secrets-master-key.json',
    );
  });

  it('supports explicit development/runtime overrides without changing Docker defaults', () => {
    const root = makeTempDir();
    const repoRuntime = resolve(root, '.agent-platform/desktop-runtime');
    const logDir = join(root, 'logs');
    const tempOverride = join(root, 'agent-platform-temp');
    const paths = resolveDesktopRuntimePaths({
      userDataDir: join(root, 'user-data'),
      logDir,
      tempDir: join(root, 'os-temp'),
      env: {
        AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: repoRuntime,
        AGENT_PLATFORM_DESKTOP_TEMP_DIR: tempOverride,
      },
    });

    expect(paths.appDataDir).toBe(repoRuntime);
    expect(paths.configDir).toBe(join(repoRuntime, 'config'));
    expect(paths.dataDir).toBe(join(repoRuntime, 'data'));
    expect(paths.logDir).toBe(logDir);
    expect(paths.tempDir).toBe(tempOverride);
    expect(paths.sqlitePath).toBe(join(repoRuntime, 'data/agent.sqlite'));
  });

  it('allows individual desktop SQLite, config, and log path overrides', () => {
    const root = makeTempDir();
    const sqlitePath = join(root, 'custom/db.sqlite');
    const configPath = join(root, 'custom/runtime.json');
    const logDir = join(root, 'custom/logs');
    const paths = resolveDesktopRuntimePaths({
      userDataDir: join(root, 'app-data'),
      logDir: join(root, 'logs'),
      tempDir: join(root, 'temp'),
      env: {
        AGENT_PLATFORM_DESKTOP_SQLITE_PATH: sqlitePath,
        AGENT_PLATFORM_DESKTOP_CONFIG_PATH: configPath,
        AGENT_PLATFORM_DESKTOP_LOG_DIR: logDir,
      },
    });

    expect(paths.sqlitePath).toBe(sqlitePath);
    expect(paths.configPath).toBe(configPath);
    expect(paths.logDir).toBe(logDir);
  });

  it('ignores generic Docker SQLite overrides when resolving desktop app data', () => {
    const root = makeTempDir();
    const paths = resolveDesktopRuntimePaths({
      userDataDir: join(root, 'app-data'),
      logDir: join(root, 'logs'),
      tempDir: join(root, 'temp'),
      env: {
        SQLITE_PATH: '/data/agent.sqlite',
      },
    });

    expect(paths.sqlitePath).toBe(join(root, 'app-data/data/agent.sqlite'));
  });

  it('can resolve paths from the Electron app abstraction', () => {
    const paths = resolveDesktopRuntimePathsFromApp(
      {
        getPath: (name) => {
          const values: Record<string, string> = {
            userData: '/electron/user-data',
            logs: '/electron/logs',
            temp: '/electron/temp',
          };
          return values[name] ?? `/unexpected/${name}`;
        },
      },
      {},
    );

    expect(paths.appDataDir).toBe('/electron/user-data');
    expect(paths.logDir).toBe('/electron/logs');
    expect(paths.tempDir).toBe('/electron/temp');
  });

  it('creates runtime directories used by config, SQLite, logs, and temp files', () => {
    const root = makeTempDir();
    const paths = resolveDesktopRuntimePaths({
      userDataDir: join(root, 'user-data'),
      logDir: join(root, 'logs'),
      tempDir: join(root, 'temp'),
      env: {},
    });

    ensureDesktopRuntimeDirectories(paths);

    expect(existsSync(paths.configDir)).toBe(true);
    expect(existsSync(paths.dataDir)).toBe(true);
    expect(existsSync(paths.logDir)).toBe(true);
    expect(existsSync(paths.tempDir)).toBe(true);
  });
});
