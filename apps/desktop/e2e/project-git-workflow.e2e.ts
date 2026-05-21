import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';

test.describe('Electron Project Git workflow panel', () => {
  test('reveals only useful Git workflow steps as local changes move toward commit', async () => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-git-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const projectDir = join(tempRoot, 'client', 'workflow-project');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const backendPort = await getOpenPort();
    const rendererPort = await getOpenPort();
    let app: ElectronApplication | undefined;

    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'README.md'), '# Workflow Project\n');
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
    seedDesktopDatabase(sqlitePath);

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

      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await expect(gitPanel.getByRole('button', { name: 'Overview' })).toBeVisible();
      await expect(gitPanel.getByRole('button', { name: 'Changes' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'PRs' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'Checks' })).toHaveCount(0);

      writeFileSync(join(projectDir, 'scratch.txt'), 'created during Git workflow e2e\n');
      await gitPanel.getByRole('button', { name: 'Refresh Git state' }).click();

      await expect(gitPanel.getByRole('button', { name: /Changes/ })).toBeVisible({
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: 'Commit' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'PRs' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'Checks' })).toHaveCount(0);

      await gitPanel.getByRole('button', { name: /Changes/ }).click();
      await gitPanel.getByRole('button', { name: 'Stage all' }).click();
      await expect(gitPanel.getByRole('button', { name: 'Continue to commit' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: /Commit/ })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Continue to commit' }).click();
      await expect(gitPanel.getByText('Commit staged changes')).toBeVisible();
      await gitPanel.getByPlaceholder('Commit message').fill('test: add workflow scratch file');
      await gitPanel.getByRole('button', { name: 'Commit', exact: true }).click();

      await expect(gitPanel.getByRole('button', { name: 'Commit' })).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: 'Publish' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        gitPanel.getByText(/^Committed .*test: add workflow scratch file$/).first(),
      ).toBeVisible();
      await expect(gitPanel.getByText('Connect this project to GitHub')).toBeVisible();
      await expect(gitPanel.getByText('Not connected', { exact: true })).toBeVisible();
      await expect(gitPanel.getByText('Pushed')).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'Publish branch' })).toHaveCount(0);

      writeFileSync(join(projectDir, 'server.log'), 'generated runtime log\n');
      await gitPanel.getByRole('button', { name: 'Refresh Git state' }).click();
      await expect(gitPanel.getByRole('button', { name: /Changes/ })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: /Changes/ }).click();
      await gitPanel.getByRole('button', { name: /server\.log/ }).click();
      await expect(gitPanel.getByRole('button', { name: 'Stash file' })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Stash file' }).click();
      await expect(gitPanel.getByText('server.log')).toHaveCount(0, { timeout: 10_000 });
      await expect(gitPanel.getByRole('button', { name: /Changes/ })).toHaveCount(0, {
        timeout: 10_000,
      });
    } finally {
      await app?.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

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
