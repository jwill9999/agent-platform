import { test, expect } from '@playwright/test';

test('agent and model selectors are inside chat input', async ({ page }) => {
  await page.goto('/');
  // wait for app to render and input to load
  await page.getByRole('heading', { name: 'AI Studio' }).waitFor({ timeout: 10000 });
  const input = page.locator('textarea[placeholder*="Send a message"]');
  await expect(input).toBeVisible();

  // selectors should be visible below the input area
  const agentSelector = page.locator('[aria-label="Active agent"]').first();
  const modelSelector = page.locator('[aria-label="Active model"]').first();

  await expect(agentSelector).toBeVisible();
  await expect(modelSelector).toBeVisible();
});
