import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';

type WebViewBoundsMatchResult =
  | { matches: true }
  | {
      matches: false;
      reason: string;
      actual?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      expected?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };

test.describe('Electron workspace WebView runtime', () => {
  test('opens repository, chat, and local preview URLs inside the visible WebView panel', async () => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-webview-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const projectDir = join(tempRoot, 'client', 'webview-project');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const backendPort = await getOpenPort();
    const rendererPort = await getOpenPort();
    const previewPort = await getOpenPort();
    const previewUrl = `http://127.0.0.1:${previewPort}/`;
    let app: ElectronApplication | undefined;

    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'README.md'), '# WebView Project\n');
    execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'e2e@example.com'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Electron E2E'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync(
      GIT_BINARY,
      ['remote', 'add', 'origin', 'https://github.com/jwill9999/node1.git'],
      {
        cwd: projectDir,
        stdio: 'ignore',
      },
    );
    seedDesktopDatabase(sqlitePath);
    const previewServer = await startPreviewServer(previewPort);

    try {
      app = await electron.launch({
        cwd: desktopDir,
        args: ['.'],
        env: {
          ...process.env,
          AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
          AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(backendPort),
          AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
          AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
          AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(rendererPort),
          AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtimeDir,
          AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(runtimeDir, 'tmp'),
          AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([projectDir]),
          CI: process.env.CI,
        },
      });

      const page = await app.firstWindow();
      await openProject(page);
      await expectDesktopWorkspaceBridge(page);

      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await expect(gitPanel.getByRole('link', { name: 'Open remote repository' })).toBeVisible({
        timeout: 15_000,
      });
      await gitPanel.getByRole('link', { name: 'Open remote repository' }).click();

      const previewPanel = page.getByRole('complementary', { name: 'Workspace preview' });
      await expect(previewPanel).toBeVisible({ timeout: 10_000 });
      await expectAnyWebViewUrl(page, 'https://github.com/jwill9999/node1');
      await expectUsableViewport(page, 480);
      await expectWebViewBoundsToMatchViewport(page);

      await gitPanel.getByTitle('Close Git and GitHub panel').click();
      await expect(gitPanel.getByTitle('Open Git and GitHub panel')).toBeVisible();
      await expectWebViewBoundsToMatchViewport(page);

      await previewPanel.getByTitle('Make the side preview wider').click();
      await expect(gitPanel).toHaveCount(0);
      await expectUsableViewport(page, 640);

      const localOpened = await page.evaluate(async (url) => {
        const workspace = globalThis.agentPlatformDesktop?.workspace;
        const uri = `workspace://project/project-1/webview/${encodeURIComponent(url)}`;
        return workspace?.openResource({ uri });
      }, previewUrl);
      expect(localOpened?.handled).toBe(true);
      await expectAnyWebViewUrl(page, previewUrl);

      const httpFallback = await page.evaluate(async () =>
        globalThis.agentPlatformDesktop?.workspace.openWebView({ url: 'http://example.com/' }),
      );
      expect(httpFallback).toMatchObject({
        handled: false,
        externalFallbackUrl: 'http://example.com/',
      });

      await previewPanel.getByTitle('Open preview in a focused overlay').click();
      const focusedPreview = page.getByRole('dialog', { name: 'Focused workspace preview' });
      await expect(focusedPreview).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(focusedPreview).toHaveCount(0);

      const countBeforeClose = await webViewCount(page);
      await previewPanel.getByTitle('Close preview').click();
      await expect
        .poll(() => webViewCount(page), { timeout: 10_000 })
        .toBe(Math.max(0, countBeforeClose - 1));

      await page.evaluate(async () => {
        const workspace = globalThis.agentPlatformDesktop?.workspace;
        const webviews = (await workspace?.listWebViews()) ?? [];
        await Promise.all(
          webviews.map((webview) => workspace?.closeWebView({ webviewId: webview.webviewId })),
        );
      });
      await expect.poll(() => webViewCount(page), { timeout: 10_000 }).toBe(0);
    } finally {
      await app?.close();
      await new Promise<void>((resolveClose) => previewServer?.close(() => resolveClose()));
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

async function expectDesktopWorkspaceBridge(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const workspace = globalThis.agentPlatformDesktop?.workspace;
      return Boolean(
        workspace &&
        typeof workspace.openWebView === 'function' &&
        typeof workspace.listWebViews === 'function' &&
        typeof workspace.setWebViewBounds === 'function' &&
        typeof workspace.onWebViewUpdated === 'function',
      );
    },
    undefined,
    { timeout: 10_000 },
  );
}

async function expectWebViewBoundsToMatchViewport(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const viewport = document.querySelector('[data-testid="project-webview-viewport"]');
          if (!viewport) return { matches: false, reason: 'missing viewport' };

          const rect = viewport.getBoundingClientRect();
          const expected = {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
          return globalThis.agentPlatformDesktop.workspace.listWebViews().then((webviews) => {
            const activeWebView = webviews[0];
            if (!activeWebView) return { matches: false, reason: 'missing webview state' };
            if (!activeWebView.bounds) return { matches: false, reason: 'missing bounds state' };

            const actual = activeWebView.bounds;
            const matches =
              Math.abs(actual.x - expected.x) <= 2 &&
              Math.abs(actual.y - expected.y) <= 2 &&
              Math.abs(actual.width - expected.width) <= 2 &&
              Math.abs(actual.height - expected.height) <= 2;
            return matches
              ? { matches: true }
              : {
                  matches: false,
                  reason: 'bounds mismatch',
                  actual,
                  expected,
                };
          });
        }),
      { timeout: 10_000 },
    )
    .toEqual({ matches: true } satisfies WebViewBoundsMatchResult);
}

async function expectAnyWebViewUrl(page: Page, expectedUrlPrefix: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const webviews = await page.evaluate(() =>
          globalThis.agentPlatformDesktop?.workspace.listWebViews(),
        );
        return webviews?.some((webview) => webview.url.startsWith(expectedUrlPrefix)) ?? false;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

async function webViewCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const webviews = await globalThis.agentPlatformDesktop?.workspace.listWebViews();
    return webviews?.length ?? 0;
  });
}

async function expectUsableViewport(page: Page, minimumWidth: number): Promise<void> {
  const viewport = page.getByTestId('project-webview-viewport');
  await expect(viewport).toBeVisible();
  const box = await viewport.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(minimumWidth);
  expect(box?.height).toBeGreaterThanOrEqual(500);
}

async function openProject(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Open Project' }).click();
  await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
}

function seedDesktopDatabase(sqlitePath: string): void {
  execFileSync(process.execPath, [join(repoRoot, 'packages/db/dist/seed/run.js')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SQLITE_PATH: sqlitePath,
      E2E_SEED: '1',
    },
    stdio: 'inherit',
  });
}

function getOpenPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) {
          resolvePort(address.port);
          return;
        }
        reject(new Error('Failed to allocate a local port.'));
      });
    });
  });
}

function startPreviewServer(port: number): Promise<Server> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Workspace Preview E2E</title><h1>Preview ready</h1>');
  });
  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolveServer(server));
  });
}
