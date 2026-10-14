import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  startStandaloneRenderer,
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

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener.');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function createRendererFixture(alwaysUnhealthy = false) {
  const root = makeTempRepo();
  const paths = getStandaloneRendererPaths(root);
  mkdirSync(join(paths.standaloneRoot, 'apps/web'), { recursive: true });
  writeFileSync(
    paths.serverEntry,
    `
    const http = require('node:http');
    const fs = require('node:fs');
    let probes = 0;
    let active = 0;
    let maximumActive = 0;
    http.createServer((_request, response) => {
      probes += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      setTimeout(() => {
        fs.writeFileSync('probe-count.json', JSON.stringify({ probes, maximumActive }));
        response.writeHead(process.env.FIXTURE_UNHEALTHY === '1' || probes < 3 ? 500 : 200);
        response.end();
        active -= 1;
      }, 15);
    }).listen(Number(process.env.PORT), '127.0.0.1');
  `,
  );
  return { paths, env: { FIXTURE_UNHEALTHY: alwaysUnhealthy ? '1' : '0' } };
}

describe('sequential standalone renderer readiness', () => {
  it('waits for failed probes before retrying and confirms actual child shutdown', async () => {
    const { paths, env } = createRendererFixture();
    const port = await availablePort();
    const handle = await startStandaloneRenderer({
      paths,
      electronPath: process.execPath,
      env: { ...env, AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(port) },
      timeoutMs: 3_000,
    });
    try {
      expect(
        JSON.parse(readFileSync(join(paths.standaloneRoot, 'probe-count.json'), 'utf8')),
      ).toEqual({ probes: 3, maximumActive: 1 });
    } finally {
      await handle.stop();
    }
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('cleans up on the unchanged readiness deadline and on cancellation', async () => {
    const { paths, env } = createRendererFixture(true);
    const port = await availablePort();
    const options = {
      paths,
      electronPath: process.execPath,
      env: { ...env, AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(port) },
    };
    await expect(startStandaloneRenderer({ ...options, timeoutMs: 300 })).rejects.toThrow(
      'Timed out',
    );
    const controller = new AbortController();
    const pending = startStandaloneRenderer({ ...options, signal: controller.signal });
    const cancel = setTimeout(() => controller.abort(), 25);
    try {
      await expect(pending).rejects.toHaveProperty('name', 'AbortError');
    } finally {
      clearTimeout(cancel);
    }
  });
});
