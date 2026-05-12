import { expect, test } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test.describe('IDE Project opening is parked for desktop', () => {
  test('opens desktop Project into Project chat by default and keeps IDE available', async ({
    page,
  }) => {
    const projectId = `agent-platform-e2e-project-chat-${Date.now()}`;
    const projectRoot = join(process.cwd(), '.agent-platform', 'workspaces', 'default', projectId);
    const backendProjectRoot = `/workspace/${projectId}`;
    const projectName = `Desktop Project Chat ${Date.now()}`;
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    writeFileSync(join(projectRoot, 'docs', 'guide.md'), '# Guide\n\nhello from project chat\n');

    try {
      await page.addInitScript(
        ({ path, name }) => {
          Object.defineProperty(globalThis, 'agentPlatformDesktop', {
            configurable: true,
            value: {
              projects: {
                selectFolder: async () => ({
                  canceled: false,
                  folder: { path, name },
                }),
              },
            },
          });
        },
        { path: backendProjectRoot, name: projectName },
      );

      await page.goto('/', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Open Project/ }).click();

      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByText(projectName).first()).toBeVisible();
      await expect(page.getByText('Project / Chat', { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page.getByText(backendProjectRoot)).toHaveCount(0);
      await expect(page.getByText('/workspace')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Open IDE' })).toHaveAttribute(
        'href',
        /\/ide\?projectId=.*&sessionId=.+/,
      );

      await page.getByRole('link', { name: 'Open IDE' }).click();
      await page.waitForURL(/\/ide/);
      await expect(page.getByLabel('Project binding').getByText(projectName).first()).toBeVisible();
      await expect(page.getByText('guide.md')).toBeVisible();
      await expect(page.getByRole('link', { name: /Project .* IDE/ })).toHaveAttribute(
        'href',
        /\/\?projectId=.*&sessionId=.+/,
      );
      await page.getByRole('link', { name: /Project .* IDE/ }).click();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByText(projectName).first()).toBeVisible();
      await expect(page.getByText('Project / Chat', { exact: true })).toBeVisible();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('does not expose browser folder or manual path Project opening', async ({ page }) => {
    await page.goto('/ide', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: /Open Folder/i })).toHaveCount(0);
    await expect(page.getByLabel('Project folder path')).toHaveCount(0);
    await expect(page.getByLabel('Project binding')).toContainText('Desktop app required');
    await expect(page.getByRole('button', { name: 'Open Project' })).toHaveCount(0);
    await expect(
      page.getByText('Open this app on desktop to choose a Project folder'),
    ).toBeVisible();
    await expect(page.getByText('/workspace')).toHaveCount(0);
    await expect(page.getByText(/backend accessible/i)).toHaveCount(0);
  });

  test('does not restore persisted browser folder handles into the product IDE', async ({
    page,
  }) => {
    await page.goto('/ide?fsDebug=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const fsProbe = await page.evaluate(() => ({
      hasPicker: globalThis.window !== undefined && 'showDirectoryPicker' in globalThis.window,
    }));
    expect(fsProbe.hasPicker).toBeTruthy();

    await expect(page.getByRole('button', { name: /Open Folder/i })).toHaveCount(0);
    await expect(page.getByText('Restore folder')).toHaveCount(0);
    await expect(page.getByText('No folder open', { exact: true })).toBeVisible();
  });

  test('/IDE uppercase returns 404 (route is /ide)', async ({ page }) => {
    const res = await page.goto('/IDE', { waitUntil: 'domcontentloaded' });
    const status = res?.status() ?? 0;
    const url = page.url();
    test.info().attach('result', {
      body: JSON.stringify({ status, url }, null, 2),
      contentType: 'application/json',
    });
    expect(status).toBe(404);
  });

  test('opens desktop Project files through the backend-bound Project root', async ({ page }) => {
    const projectId = `agent-platform-e2e-project-${Date.now()}`;
    const projectRoot = join(process.cwd(), '.agent-platform', 'workspaces', 'default', projectId);
    const backendProjectRoot = `/workspace/${projectId}`;
    const projectName = `Desktop E2E Project ${Date.now()}`;
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    mkdirSync(join(projectRoot, 'node_modules', 'hidden'), { recursive: true });
    writeFileSync(join(projectRoot, 'docs', 'guide.md'), '# Guide\n\nhello from desktop project\n');
    writeFileSync(join(projectRoot, 'node_modules', 'hidden', 'index.js'), 'hidden\n');

    try {
      await page.addInitScript(
        ({ path, name }) => {
          Object.defineProperty(globalThis, 'agentPlatformDesktop', {
            configurable: true,
            value: {
              projects: {
                selectFolder: async () => ({
                  canceled: false,
                  folder: { path, name },
                }),
              },
            },
          });
        },
        { path: backendProjectRoot, name: projectName },
      );

      await page.goto('/ide', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Open Project' }).click();

      await expect(page.getByLabel('Project binding').getByText(projectName).first()).toBeVisible();
      await expect(page.getByText('Desktop required')).toHaveCount(0);
      await expect(page.getByText('node_modules')).toHaveCount(0);
      await expect(page.getByText(projectRoot)).toHaveCount(0);
      await expect(page.getByText(backendProjectRoot)).toHaveCount(0);
      await expect(page.getByText('/workspace')).toHaveCount(0);

      await expect(async () => {
        const guideFile = page.getByRole('button', { name: /^guide\.md$/ }).first();
        await expect(guideFile).toBeVisible();
        await guideFile.click();
        await expect(page.getByText('hello from desktop project')).toBeVisible({
          timeout: 1_000,
        });
      }).toPass({ timeout: 10_000 });
      await expect(page.getByText('docs/guide.md')).toBeVisible();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('runs slash init against the opened desktop Project session', async ({ page }) => {
    const projectId = `agent-platform-e2e-slash-init-${Date.now()}`;
    const projectRoot = join(process.cwd(), '.agent-platform', 'workspaces', 'default', projectId);
    const backendProjectRoot = `/workspace/${projectId}`;
    const projectName = `Desktop Slash Init ${Date.now()}`;
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    writeFileSync(join(projectRoot, 'package.json'), '{"scripts":{"test":"vitest"}}\n');
    writeFileSync(join(projectRoot, 'src', 'index.ts'), 'export const ok = true;\n');

    try {
      await page.addInitScript(
        ({ path, name }) => {
          Object.defineProperty(globalThis, 'agentPlatformDesktop', {
            configurable: true,
            value: {
              projects: {
                selectFolder: async () => ({
                  canceled: false,
                  folder: { path, name },
                }),
              },
            },
          });
        },
        { path: backendProjectRoot, name: projectName },
      );

      await page.goto('/ide', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Open Project' }).click();

      await expect(page.getByLabel('Project binding').getByText(projectName).first()).toBeVisible();
      await expect(page.getByTestId('chat-status-label')).toHaveText('Ready');

      await page.getByPlaceholder('Ask about your code...').fill('/init');
      await page.getByPlaceholder('Ask about your code...').press('Enter');

      await expect(page.getByText('/init')).toBeVisible();
      await expect(
        page.getByText(
          'I started Project setup and prepared a Project instructions draft. Review the draft, then approve it when you are ready to enable file edits.',
        ),
      ).toBeVisible();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
