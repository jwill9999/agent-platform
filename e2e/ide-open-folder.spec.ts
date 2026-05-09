import { expect, test } from '@playwright/test';

/**
 * Exercises the IDE Project entry surface. The normal user-facing folder entry is the Project
 * binding panel; browser-only folder picker controls are intentionally hidden from this flow.
 */
test.describe('IDE open folder', () => {
  test('loads /ide with one Project opening path', async ({ page }) => {
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/ide?fsDebug=1', { waitUntil: 'networkidle' });

    await expect(page.getByLabel('Project binding')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Open Project' })).toBeVisible();
    await expect(page.getByText('Use folder path')).toBeVisible();
    await expect(page.getByLabel('Project folder path')).toBeHidden();
    await expect(page.getByRole('button', { name: /Open Folder/i })).toHaveCount(0);

    // Snapshot: FS API available in this browser context
    const fsProbe = await page.evaluate(() => ({
      hasPicker: globalThis.window !== undefined && 'showDirectoryPicker' in globalThis.window,
      href: globalThis.location.href,
    }));
    expect(fsProbe.hasPicker).toBeTruthy();

    // Opt-in [fs] debug channel should emit at least restore lifecycle lines
    const fsDebugLines = consoleMessages.filter((m) => m.includes('[fs]'));
    expect(fsDebugLines.some((m) => /restore:/.test(m))).toBeTruthy();

    await page.getByRole('button', { name: 'Open Project' }).click();

    // Allow any microtasks / error state to settle (picker may reject in automation)
    await page.waitForTimeout(1500);

    expect(consoleMessages.some((m) => m.includes('[fs] picker:'))).toBeTruthy();

    const explorerPanel = page.locator('text=Explorer').first();
    await expect(explorerPanel).toBeVisible();

    const destructiveError = page.locator('.text-destructive');
    const errorVisible = await destructiveError.isVisible().catch(() => false);
    const errorText = errorVisible ? await destructiveError.textContent() : null;

    console.log('[ide-open-folder] explorer error visible:', errorVisible, 'text:', errorText);
    console.log('[ide-open-folder] pageErrors:', pageErrors);
    console.log('[ide-open-folder] console (last 15):', consoleMessages.slice(-15).join('\n'));

    // Attach diagnostics for the report
    test.info().attach('console', {
      body: consoleMessages.join('\n'),
      contentType: 'text/plain',
    });
    test.info().attach('pageerrors', {
      body: pageErrors.join('\n') || '(none)',
      contentType: 'text/plain',
    });
    test.info().attach('fs-probe', {
      body: JSON.stringify(fsProbe, null, 2),
      contentType: 'application/json',
    });
    test.info().attach('explorer-error-text', {
      body: errorText ?? '(no .text-destructive visible)',
      contentType: 'text/plain',
    });
  });

  test('Project open controls are stable immediately after domcontentloaded', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('/ide', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Open Project' })).toBeVisible();
    await expect(page.getByText('Use folder path')).toBeVisible();
    await expect(page.getByLabel('Project folder path')).toBeHidden();
    await expect(page.getByRole('button', { name: /Open Folder/i })).toHaveCount(0);

    console.log('[ide-open-folder fast] console lines:', consoleMessages.slice(-15).join('\n'));

    test.info().attach('console-fast', {
      body: consoleMessages.join('\n'),
      contentType: 'text/plain',
    });
  });

  test('fsDebug=1 surfaces structured [fs] logs (no picker completion in CI)', async ({ page }) => {
    const fsLines: string[] = [];
    page.on('console', (msg) => {
      const t = msg.text();
      if (t.includes('[fs]')) fsLines.push(t);
    });
    await page.goto('/ide?fsDebug=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    expect(fsLines.some((l) => l.includes('restore:'))).toBeTruthy();
    test.info().attach('fs-debug-lines', {
      body: fsLines.join('\n') || '(none)',
      contentType: 'text/plain',
    });
  });

  test('selected browser folder is reflected in the Project card', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => ({
          kind: 'directory',
          name: 'picked-project',
          async *entries() {
            yield [
              'README.md',
              {
                kind: 'file',
                name: 'README.md',
              },
            ];
          },
        }),
      });
    });

    await page.goto('/ide', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Open Project' }).click();

    const binding = page.getByLabel('Project binding');
    await expect(binding.getByText('Folder selected')).toBeVisible();
    await expect(page.getByText('picked-project').first()).toBeVisible();
    await expect(page.getByText('README.md')).toBeVisible();
    await page.getByPlaceholder('Ask about your code...').fill('Can you assess my project?');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
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
});
