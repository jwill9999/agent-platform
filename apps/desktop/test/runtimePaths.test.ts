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
  });

  it('supports explicit development/runtime overrides without changing Docker defaults', () => {
    const repoRuntime = resolve('/repo/.agent-platform/desktop-runtime');
    const paths = resolveDesktopRuntimePaths({
      userDataDir: '/Users/test/Library/Application Support/Agent Platform',
      logDir: '/Users/test/Library/Logs/Agent Platform',
      tempDir: '/var/folders/test/T',
      env: {
        AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: repoRuntime,
        AGENT_PLATFORM_DESKTOP_TEMP_DIR: '/tmp/agent-platform',
      },
    });

    expect(paths.appDataDir).toBe(repoRuntime);
    expect(paths.configDir).toBe(join(repoRuntime, 'config'));
    expect(paths.dataDir).toBe(join(repoRuntime, 'data'));
    expect(paths.logDir).toBe('/Users/test/Library/Logs/Agent Platform');
    expect(paths.tempDir).toBe('/tmp/agent-platform');
    expect(paths.sqlitePath).toBe(join(repoRuntime, 'data/agent.sqlite'));
  });

  it('allows individual SQLite, config, and log path overrides', () => {
    const paths = resolveDesktopRuntimePaths({
      userDataDir: '/app-data',
      logDir: '/logs',
      tempDir: '/tmp',
      env: {
        SQLITE_PATH: '/custom/db.sqlite',
        AGENT_PLATFORM_DESKTOP_CONFIG_PATH: '/custom/runtime.json',
        AGENT_PLATFORM_DESKTOP_LOG_DIR: '/custom/logs',
      },
    });

    expect(paths.sqlitePath).toBe('/custom/db.sqlite');
    expect(paths.configPath).toBe('/custom/runtime.json');
    expect(paths.logDir).toBe('/custom/logs');
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
