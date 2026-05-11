import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ensureStandaloneRendererAssets,
  getRepoRootFromMainDir,
  getStandaloneRendererPaths,
  resolveDesktopDevServerUrl,
  resolveDesktopRendererMode,
  standaloneRendererAvailable,
} from '../src/main/rendererServer.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-desktop-test-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n');
  return dir;
}

describe('desktop renderer server helpers', () => {
  it('keeps bootstrap mode as the default renderer target', () => {
    expect(resolveDesktopRendererMode({})).toBe('bootstrap');
    expect(resolveDesktopRendererMode({ AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone' })).toBe(
      'standalone',
    );
    expect(
      resolveDesktopRendererMode({ AGENT_PLATFORM_DESKTOP_DEV_SERVER_URL: 'http://x.test' }),
    ).toBe('dev-server');
  });

  it('defaults the desktop dev renderer to the web dev port', () => {
    expect(resolveDesktopDevServerUrl({})).toBe('http://127.0.0.1:3001');
    expect(
      resolveDesktopDevServerUrl({
        AGENT_PLATFORM_DESKTOP_DEV_SERVER_URL: 'http://localhost:4000',
      }),
    ).toBe('http://localhost:4000');
  });

  it('finds the repo root from the compiled Electron main directory', () => {
    const repoRoot = makeTempRepo();
    const mainDir = join(repoRoot, 'apps/desktop/dist/main');
    mkdirSync(mainDir, { recursive: true });

    expect(getRepoRootFromMainDir(mainDir)).toBe(repoRoot);
  });

  it('detects and prepares the Next standalone renderer assets', () => {
    const repoRoot = makeTempRepo();
    const paths = getStandaloneRendererPaths(repoRoot);

    mkdirSync(join(paths.standaloneRoot, 'apps/web'), { recursive: true });
    mkdirSync(paths.staticSource, { recursive: true });
    mkdirSync(paths.publicSource, { recursive: true });
    writeFileSync(paths.serverEntry, 'console.log("server");\n');
    writeFileSync(join(paths.staticSource, 'build-id.txt'), 'static');
    writeFileSync(join(paths.publicSource, 'favicon.ico'), 'public');

    expect(standaloneRendererAvailable(paths)).toBe(true);

    ensureStandaloneRendererAssets(paths);

    expect(existsSync(join(paths.staticTarget, 'build-id.txt'))).toBe(true);
    expect(existsSync(join(paths.publicTarget, 'favicon.ico'))).toBe(true);
  });
});
