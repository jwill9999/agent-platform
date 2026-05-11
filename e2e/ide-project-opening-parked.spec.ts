import { expect, test } from '@playwright/test';

test.describe('IDE Project opening is parked for desktop', () => {
  test('does not expose browser folder or manual path Project opening', async ({ page }) => {
    await page.goto('/ide', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: /Open Folder/i })).toHaveCount(0);
    await expect(page.getByLabel('Project folder path')).toHaveCount(0);
    await expect(page.getByLabel('Project binding')).toContainText('Desktop required');
    await expect(page.getByText('Project opening is parked in the web preview.')).toBeVisible();
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
});
