import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { SDK_PROVIDERS } from './support/provider-sdk.mjs';
import { startDockerProviderSdk } from './support/provider-sdk-docker.js';
import {
  openProviderSdkModels,
  editProviderSdkModel,
  saveProviderSdkConfig,
  selectProviderSdkModel,
  sendProviderSdkChat,
  testProviderSdkConfig,
  type SdkApi,
  type SdkSavedConfig,
} from './support/provider-sdk-ui.js';

const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
// All credentials are synthetic; real provider traffic is confined to owned container loopback.
test.use({ actionTimeout: 15_000 });
test('Models saves native providers, reports rejected parameters and switches Project chat through real SDK protocols', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const provider = await startDockerProviderSdk(apiURL);
  const prefix = `provider-sdk-${randomUUID()}`;
  const configs: SdkSavedConfig[] = [];
  const ids: { agent?: string; project?: string; session?: string } = {};
  const directory = `/tmp/${prefix}`;
  const api: SdkApi = async <T>(route: string, init?: RequestInit) => {
    const response = await fetch(`${apiURL}/v1/${route}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`Owned API ${route.split('/')[0]} returned ${response.status}`);
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as { data: T }).data;
  };
  let passed = false;
  const failures: unknown[] = [];
  try {
    const catalogue = await api<Array<{ id: string }>>('model-configs/providers');
    expect(catalogue.map(({ id }) => id).sort()).toEqual([...SDK_PROVIDERS].sort());
    await page.goto('/');
    await openProviderSdkModels(page);
    for (const family of SDK_PROVIDERS) {
      const config = await saveProviderSdkConfig(page, api, {
        provider: family,
        name: `${prefix}-${family}`,
        baseURL: provider.baseURL,
      });
      configs.push(config);
      await testProviderSdkConfig(page, config);
      expect(
        provider.requests.filter((row) => row.provider === family && !row.stream),
      ).toHaveLength(1);
    }
    configs[0] = await editProviderSdkModel(page, api, configs[0]!);
    await testProviderSdkConfig(page, configs[0]!);
    expect(
      provider.requests.filter((row) => row.provider === 'openai' && !row.stream),
    ).toHaveLength(2);
    const rejected = await saveProviderSdkConfig(page, api, {
      provider: 'openai',
      name: `${prefix}-rejected`,
      baseURL: provider.baseURL,
      rejected: true,
    });
    configs.push(rejected);
    await testProviderSdkConfig(page, rejected, true);
    expect(provider.requests.filter((row) => row.model.includes('Rejected'))).toHaveLength(1);
    await page.reload();
    await expect(page.getByRole('heading', { name: configs[0]!.name, exact: true })).toBeVisible();
    for (const config of configs)
      expect(await api<SdkSavedConfig>(`model-configs/${config.id}`)).toMatchObject({
        provider: config.provider,
        model: config.model,
        baseURL: config.baseURL,
        hasApiKey: true,
      });
    execFileSync(
      'docker',
      [
        'exec',
        provider.container,
        'node',
        '--input-type=module',
        '-e',
        "import{mkdirSync,writeFileSync}from'node:fs';mkdirSync(process.argv[1]);writeFileSync(process.argv[1]+'/README.md','# SDK disposable Project');",
        directory,
      ],
      { timeout: 10_000 },
    );
    const agent = await api<{ id: string }>('agents', {
      method: 'POST',
      body: JSON.stringify({
        name: prefix,
        systemPrompt: 'Return the fixture response.',
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [],
        pluginAllowlist: [],
        modelConfigId: configs[0]!.id,
        executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 30_000 },
      }),
    });
    ids.agent = agent.id;
    const registered = await api<{ project: { id: string } }>('projects/desktop/register', {
      method: 'POST',
      headers: { 'x-agent-platform-desktop-bridge': '1' },
      body: JSON.stringify({ name: prefix, path: directory }),
    });
    ids.project = registered.project.id;
    const session = await api<{ id: string }>('sessions', {
      method: 'POST',
      body: JSON.stringify({ agentId: ids.agent, mode: 'project', projectId: ids.project }),
    });
    ids.session = session.id;
    await page.goto(`/?projectId=${ids.project}&sessionId=${ids.session}`);
    const input = page.getByPlaceholder('Ask about this Project...');
    await expect(
      page.getByRole('status').filter({ hasText: 'Press Enter to send, Shift+Enter for new line' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Active agent', exact: true })).toContainText(
      prefix,
    );
    await expect(input).toBeEnabled();
    await input.fill('/init');
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await input.press('Enter');
    await page.getByRole('button', { name: 'Approve instructions', exact: true }).click();
    await expect(page.getByText('Project instructions approved').last()).toBeVisible();
    // Every configured family is exercised through a real saved-model selection and harness stream.
    for (const config of configs.filter((row) => !row.model.includes('Rejected'))) {
      await selectProviderSdkModel(page, config);
      await sendProviderSdkChat(page, config.provider, () => provider.requests.length);
      expect(
        provider.requests.filter((row) => row.provider === config.provider && row.stream),
      ).toHaveLength(1);
    }
    const messages = await api<Array<{ role: string; content: string }>>(
      `sessions/${ids.session}/messages`,
    );
    for (const family of SDK_PROVIDERS)
      expect(
        messages.some(
          (row) => row.role === 'assistant' && row.content === `SDK ${family} completed.`,
        ),
      ).toBe(true);
    expect(provider.errors).toEqual([]);
    for (const row of provider.requests.filter((row) => ['openai', 'xai'].includes(row.provider)))
      expect(row).toMatchObject({ legacyMaxTokens: false, store: false, credentialMatched: true });
    passed = true;
  } catch (error) {
    failures.push(error);
  } finally {
    const evidence = info.outputPath('provider-sdk-browser-evaluation.json');
    writeFileSync(
      evidence,
      JSON.stringify(
        {
          passed,
          requests: provider.requests,
          errors: provider.errors,
          scope: ids,
          limits: [
            'Real browser/BFF/API/DB/harness/SDK; external native HTTP providers are deterministic doubles.',
            'No live credentials, paid inference, account access or provider model quality established.',
          ],
        },
        null,
        2,
      ),
    );
    await info.attach('provider-sdk-browser-evaluation', {
      path: evidence,
      contentType: 'application/json',
    });
    const cleanup: unknown[] = [];
    for (const [kind, id] of [
      ['sessions', ids.session],
      ['agents', ids.agent],
      ['projects', ids.project],
      ...configs.map((row) => ['model-configs', row.id]),
    ] as Array<[string, string | undefined]>) {
      if (id)
        try {
          await api(`${kind}/${id}`, { method: 'DELETE' });
        } catch (error) {
          cleanup.push(error);
        }
    }
    try {
      await provider.close();
    } catch (error) {
      cleanup.push(error);
    }
    try {
      execFileSync(
        'docker',
        [
          'exec',
          provider.container,
          'node',
          '--input-type=module',
          '-e',
          "import{rmSync}from'node:fs';rmSync(process.argv[1],{recursive:true,force:true});",
          directory,
        ],
        { timeout: 10_000 },
      );
    } catch (error) {
      cleanup.push(error);
    }
    failures.push(...cleanup);
  }
  if (failures.length)
    throw new AggregateError(failures, 'Provider SDK browser journey failed', {
      cause: failures[0],
    });
});
