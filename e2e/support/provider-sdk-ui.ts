import { expect, type Page } from '@playwright/test';
import { SDK_FIXTURE_KEY } from './provider-sdk.mjs';

export type SdkSavedConfig = {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseURL?: string;
  hasApiKey: boolean;
};
export type SdkApi = <T>(route: string, init?: RequestInit) => Promise<T>;

export async function openProviderSdkModels(page: Page) {
  await page.getByRole('button', { name: 'Open settings menu' }).click();
  await page.getByRole('menuitem', { name: /Models/ }).click();
  await expect(page.getByRole('heading', { name: 'Models & API Keys' })).toBeVisible();
}

export function providerSdkCard(page: Page, name: string) {
  return page.getByRole('heading', { name, exact: true, level: 3 }).locator('..');
}

export async function saveProviderSdkConfig(
  page: Page,
  api: SdkApi,
  options: { provider: string; name: string; baseURL: string; rejected?: boolean },
): Promise<SdkSavedConfig> {
  await page.getByRole('button', { name: 'Add Model', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(options.name);
  await page.getByLabel('Provider', { exact: true }).selectOption(options.provider);
  const model = `SdkCase${options.rejected ? 'Rejected' : ''}-${options.provider}`;
  await page.getByLabel('Model', { exact: true }).fill(model);
  await page
    .getByLabel('API endpoint (optional)', { exact: true })
    .fill(`${options.baseURL}/${options.provider}/v1`);
  await page.getByLabel('API Key', { exact: false }).fill(SDK_FIXTURE_KEY);
  const savedResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/model-configs') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await savedResponse;
  expect(response.status(), 'Saving a provider must return HTTP 201').toBe(201);
  await expect(providerSdkCard(page, options.name)).toBeVisible();
  const records = await api<SdkSavedConfig[]>('model-configs');
  const saved = records.find((row) => row.name === options.name);
  expect(saved).toMatchObject({
    provider: options.provider,
    model,
    baseURL: `${options.baseURL}/${options.provider}/v1`,
    hasApiKey: true,
  });
  expect(JSON.stringify(saved)).not.toContain(SDK_FIXTURE_KEY);
  return saved!;
}

export async function testProviderSdkConfig(page: Page, config: SdkSavedConfig, rejected = false) {
  const card = providerSdkCard(page, config.name);
  const responded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(`/model-configs/${config.id}/test`) &&
      response.request().method() === 'POST',
  );
  await card.getByRole('button', { name: 'Test Connection', exact: true }).click();
  const response = await responded;
  expect(response.ok()).toBe(true);
  const result = (await response.json()) as { data: { ok: boolean; category?: string } };
  expect(result.data.ok).toBe(!rejected);
  if (rejected) {
    await expect(card.getByRole('alert')).toContainText('Failed:');
    await expect(card.getByRole('alert')).not.toContainText('PRIVATE_SDK_ERROR_CANARY');
  } else await expect(card.getByText(/^[0-9]+ms$/, { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Test Connection', exact: true })).toBeEnabled();
  return { requestId: response.headers()['x-request-id'], outcome: result.data };
}

export async function selectProviderSdkModel(page: Page, config: SdkSavedConfig) {
  const selector = page.getByRole('combobox', { name: 'Active model', exact: true });
  await expect(selector).toBeEnabled();
  await selector.click();
  await page
    .getByRole('option')
    .filter({ has: page.getByText(config.name, { exact: true }) })
    .click();
  await expect(selector).toContainText(config.name);
}

export async function sendProviderSdkChat(
  page: Page,
  provider: string,
  observedRequests: () => number,
) {
  const priorRequests = observedRequests();
  const input = page.getByPlaceholder('Ask about this Project...');
  const replies = page.getByText(`SDK ${provider} completed.`, { exact: true });
  const priorReplies = await replies.count();
  await expect(input).toBeEnabled();
  const responded = page
    .waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/chat' && response.request().method() === 'POST',
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  await input.fill(`PROVIDER_SDK_PROMPT_CANARY use ${provider}`);
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
  await input.press('Enter');
  const response = await responded;
  expect(
    response,
    'A successful chat must have one actual browser/BFF POST response',
  ).toBeDefined();
  expect(response!.ok()).toBe(true);
  await expect(replies).toHaveCount(priorReplies + 1, { timeout: 30_000 });
  await expect(replies.last()).toBeVisible();
  await expect(input).toBeEnabled();
  expect(
    observedRequests(),
    'One successful text send must cause exactly one external SDK request',
  ).toBe(priorRequests + 1);
}

export async function editProviderSdkModel(page: Page, api: SdkApi, config: SdkSavedConfig) {
  await providerSdkCard(page, config.name)
    .getByRole('button', { name: `Actions for ${config.name}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const model = `SdkCaseEdited-${config.provider}`;
  await page.getByLabel('Model', { exact: true }).fill(model);
  // Empty on an unchanged provider explicitly retains the encrypted credential.
  await expect(page.getByLabel('API Key', { exact: false })).toHaveValue('');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(providerSdkCard(page, config.name)).toContainText(model);
  const saved = await api<SdkSavedConfig>(`model-configs/${config.id}`);
  expect(saved).toMatchObject({
    id: config.id,
    name: config.name,
    provider: config.provider,
    model,
    baseURL: config.baseURL,
    hasApiKey: true,
  });
  return saved;
}
