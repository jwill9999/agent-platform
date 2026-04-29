import { test, expect } from '@playwright/test';

const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';

test('agent and model selectors reflect available chat inputs', async ({ page, request }) => {
  const configRes = await request.get(`${apiURL}/v1/model-configs`);
  expect(configRes.ok()).toBeTruthy();
  const configBody = (await configRes.json()) as {
    data: { hasApiKey: boolean }[];
  };
  const hasSavedModelConfig = configBody.data.some((config) => config.hasApiKey);

  await page.goto('/');
  await page.getByRole('heading', { name: 'AI Studio', level: 2 }).waitFor({ timeout: 10000 });
  const input = page.locator('textarea[placeholder*="Send a message"]');
  await expect(input).toBeVisible();

  const agentSelector = page.locator('[aria-label="Active agent"]').first();
  await expect(agentSelector).toBeVisible();

  const modelSelector = page.locator('[aria-label="Active model"]');
  if (hasSavedModelConfig) {
    await expect(modelSelector.first()).toBeVisible();
  } else {
    await expect(modelSelector).toHaveCount(0);
  }
});
