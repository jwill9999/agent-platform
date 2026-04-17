import { expect, test } from '@playwright/test';

/**
 * Exercises the IDE page and "Open Folder" (File System Access API).
 * Native directory pickers are not fully automatable; we capture UI/console signals.
 */
test.describe('IDE open folder', () => {
  test('loads /ide and records Open Folder interaction', async ({ page }) => {
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/ide?fsDebug=1', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: /Open Folder/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Snapshot: FS API available in this browser context
    const fsProbe = await page.evaluate(() => ({
      hasPicker:
        typeof globalThis.window !== 'undefined' && 'showDirectoryPicker' in globalThis.window,
      href: globalThis.location.href,
    }));
    expect(fsProbe.hasPicker).toBeTruthy();

    // Opt-in [fs] debug channel should emit at least restore lifecycle lines
    const fsDebugLines = consoleMessages.filter((m) => m.includes('[fs]'));
    expect(fsDebugLines.some((m) => /restore:/.test(m))).toBeTruthy();

    // Click first "Open Folder" (toolbar or explorer empty state)
    await page
      .getByRole('button', { name: /Open Folder/i })
      .first()
      .click();

    // Allow any microtasks / error state to settle (picker may reject in automation)
    await page.waitForTimeout(1500);

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

  test('Open Folder click immediately after domcontentloaded (may race isSupported)', async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('/ide', { waitUntil: 'domcontentloaded' });
    await page
      .getByRole('button', { name: /Open Folder/i })
      .first()
      .click({ force: true });

    await page.waitForTimeout(800);

    const destructiveError = page.locator('.text-destructive');
    const errorVisible = await destructiveError.isVisible().catch(() => false);
    const errorText = errorVisible ? await destructiveError.textContent() : null;

    console.log('[ide-open-folder fast] explorer error visible:', errorVisible, 'text:', errorText);

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
