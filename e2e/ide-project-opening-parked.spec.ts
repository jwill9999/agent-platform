import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.describe('IDE Project opening is parked for desktop', () => {
  test('does not expose browser folder or manual path Project opening', async ({ page }) => {
    await page.goto('/ide', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: /Open Folder/i })).toHaveCount(0);
    await expect(page.getByLabel('Project folder path')).toHaveCount(0);
    await expect(page.getByLabel('Project binding')).toContainText('Desktop required');
    await expect(page.getByRole('button', { name: 'Open Project' })).toBeVisible();
    await expect(page.getByText('Use the desktop app to choose a folder')).toBeVisible();
    await expect(page.getByText('Recent Projects', { exact: true })).toBeVisible();
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
    const projectRoot = mkdtempSync(join(tmpdir(), 'agent-platform-e2e-project-'));
    const projectName = `Desktop E2E Project ${Date.now()}`;
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    mkdirSync(join(projectRoot, 'node_modules', 'hidden'), { recursive: true });
    writeFileSync(join(projectRoot, 'docs', 'guide.md'), '# Guide\n\nhello from desktop project\n');
    writeFileSync(join(projectRoot, 'node_modules', 'hidden', 'index.js'), 'hidden\n');

    try {
      await page.addInitScript(
        ({ path, name }) => {
          Object.defineProperty(window, 'agentPlatformDesktop', {
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
        { path: projectRoot, name: projectName },
      );

      await page.goto('/ide', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Open Project' }).click();

      await expect(page.getByLabel('Project binding').getByText(projectName).first()).toBeVisible();
      await expect(page.getByText('Desktop required')).toHaveCount(0);
      await expect(page.getByText('node_modules')).toHaveCount(0);
      await expect(page.getByText(projectRoot)).toHaveCount(0);
      await expect(page.getByText('/workspace')).toHaveCount(0);

      await page.getByText('guide.md').click();
      await expect(page.getByText('hello from desktop project')).toBeVisible();
      await expect(page.getByText('docs/guide.md')).toBeVisible();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
