import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { test } from './support/mcp-test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Credential entry is intentionally excluded from browser recording. Safe terminal
// screenshots and boolean-only backend evidence are attached after the form is gone.
test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 15_000 });
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
const fixtureScript =
  process.env.MCP_FIXTURE_SCRIPT ?? '/app/packages/mcp-adapter/test/fixtures/protocol-server.mjs';
type ServerRecord = {
  id: string;
  name: string;
  configurationRevision: number;
  needsReconfiguration: boolean;
  credentialStatus: { env: Record<string, boolean>; headers: Record<string, boolean> };
};
type JournalEvent = { event: string; pid?: number; explicitEnv?: boolean };

async function attachEvidence(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(name);
  writeFileSync(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}

function apiContainer() {
  const container =
    process.env.MCP_ONBOARDING_API_CONTAINER ??
    execFileSync('docker', ['compose', 'ps', '-q', 'api'], { encoding: 'utf8' }).trim();
  if (!container)
    throw new Error(
      'MCP browser acceptance requires the owned Compose API container. Set MCP_ONBOARDING_API_CONTAINER for a non-default project.',
    );
  return container;
}
function containerNode(container: string, script: string, ...args: string[]) {
  return execFileSync(
    'docker',
    ['exec', container, 'node', '--input-type=module', '-e', script, ...args],
    { encoding: 'utf8' },
  );
}
function journal(container: string, file: string): JournalEvent[] {
  const host = process.env.MCP_E2E_WORKSPACE_PATH;
  const text = host
    ? existsSync(join(host, file))
      ? readFileSync(join(host, file), 'utf8')
      : ''
    : containerNode(
        container,
        "import{existsSync,readFileSync}from'node:fs';const p=process.argv[1];process.stdout.write(existsSync(p)?readFileSync(p,'utf8'):'')",
        `/workspace/${file}`,
      );
  return text.trim()
    ? text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as JournalEvent)
    : [];
}
function processesSettled(container: string, events: JournalEvent[]) {
  const pids = events.flatMap((event) => (event.pid ? [event.pid] : []));
  return JSON.parse(
    containerNode(
      container,
      'const pids=JSON.parse(process.argv[1]);console.log(pids.every(pid=>{try{process.kill(pid,0);return false}catch{return true}}))',
      JSON.stringify(pids),
    ),
  ) as boolean;
}
function credentialState(container: string, id: string) {
  // Read only the disposable server and its owned secret rows; return no stored bytes.
  return JSON.parse(
    containerNode(
      container,
      `
    import {openDatabase} from './packages/db/dist/index.js';
    const {sqlite}=openDatabase(process.env.SQLITE_PATH);
    const row=sqlite.prepare('select metadata_json from mcp_servers where id=?').get(process.argv[1]);
    const metadata=JSON.parse(row?.metadata_json ?? '{}');
    const refs=Object.values(metadata.connection?.refs?.env ?? {}).filter(value=>typeof value==='string');
    const rows=refs.map(ref=>sqlite.prepare('select * from secret_refs where id=?').get(ref));
    console.log(JSON.stringify({exists:!!row,revision:metadata.connection?.revision,owned:refs.every(ref=>ref.startsWith('mcp:'+process.argv[1]+':')),encrypted:rows.length>0&&rows.every(value=>value?.algorithm==='aes-256-gcm-v1'&&value?.ciphertext_b64),plaintextPresent:JSON.stringify({metadata,rows}).includes('test-value')}));
    sqlite.close();
  `,
      id,
    ),
  ) as {
    exists: boolean;
    revision: number;
    owned: boolean;
    encrypted: boolean;
    plaintextPresent: boolean;
  };
}
async function servers(request: APIRequestContext) {
  const response = await request.get(`${apiURL}/v1/mcp-servers`);
  expect(response.ok()).toBe(true);
  return (await response.json()).data as ServerRecord[];
}
async function openServers(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open settings menu' }).click();
  await page.getByRole('menuitem', { name: 'MCP Servers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'MCP Servers', exact: true })).toBeVisible();
}
async function review(page: Page, configuration: unknown) {
  await page.getByRole('button', { name: 'Add Server', exact: true }).click();
  await page.getByLabel('Paste server JSON or endpoint URL').fill(JSON.stringify(configuration));
  await page.getByRole('button', { name: 'Review configuration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review before importing' })).toBeVisible();
}
async function explicitTest(page: Page, name: string) {
  const card = page.getByRole('region', { name, exact: true });
  await card.getByRole('button', { name: 'Test', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('API container');
  await expect(dialog).toContainText('does not sandbox server startup');
  await dialog.getByRole('button', { name: 'Connect and discover' }).click();
  return card;
}
async function cleanup(
  request: APIRequestContext,
  prefix: string,
  container: string,
  file: string,
) {
  const agents = await request.get(`${apiURL}/v1/agents`);
  for (const agent of (await agents.json()).data as Array<{ id: string; name: string }>) {
    if (agent.name.startsWith(prefix)) await request.delete(`${apiURL}/v1/agents/${agent.id}`);
  }
  for (const server of await servers(request)) {
    if (server.name.startsWith(prefix))
      await request.delete(`${apiURL}/v1/mcp-servers/${server.id}`);
  }
  if (process.env.MCP_E2E_WORKSPACE_PATH)
    rmSync(join(process.env.MCP_E2E_WORKSPACE_PATH, file), { force: true });
  else
    containerNode(
      container,
      "import{rmSync}from'node:fs';rmSync(process.argv[1],{force:true})",
      `/workspace/${file}`,
    );
}

test('MCP import, explicit discovery, credential editing and assignment use real persisted state', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const container = apiContainer();
  const prefix = `mcp-browser-${randomUUID()}`;
  const name = `${prefix}-reference`;
  const file = `${prefix}.jsonl`;
  const fixture = {
    command: '/usr/local/bin/node',
    args: [fixtureScript, `/workspace/${file}`],
    env: { FIXTURE_SECRET: 'test-value' },
  };
  try {
    await openServers(page);
    await review(page, {
      mcpServers: {
        [name]: fixture,
        [`${prefix}-unselected`]: fixture,
        [`${prefix}-invalid`]: { ...fixture, cwd: '/unsupported' },
      },
    });
    await expect(
      page.getByRole('checkbox', { name: new RegExp(`${prefix}-invalid`) }),
    ).toBeDisabled();
    await page.getByRole('checkbox', { name: new RegExp(`${prefix}-unselected`) }).uncheck();
    await expect(
      page.getByText('FIXTURE_SECRET — values hidden', { exact: false }).first(),
    ).toBeVisible();
    expect((await page.locator('body').innerText()).includes('test-value')).toBe(false);
    await page.getByRole('button', { name: 'Import 1 Server', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'MCP Servers', exact: true })).toBeVisible();
    const saved = (await servers(request)).filter((server) => server.name.startsWith(prefix));
    expect(saved).toHaveLength(1);
    const server = saved[0]!;
    expect(server.credentialStatus.env.FIXTURE_SECRET).toBe(true);
    expect(JSON.stringify(server).includes('test-value')).toBe(false);
    expect(credentialState(container, server.id)).toMatchObject({
      exists: true,
      owned: true,
      encrypted: true,
      plaintextPresent: false,
    });
    expect(journal(container, file)).toEqual([]);

    await page.reload();
    const card = await explicitTest(page, name);
    await expect(card).toContainText('Connected; discovery completed');
    await expect(card).toContainText('1 discovered');
    await expect(card).toContainText('1 eligible');
    expect(journal(container, file).filter((event) => event.event === 'started')).toEqual([
      expect.objectContaining({ explicitEnv: true }),
    ]);
    expect(journal(container, file).filter((event) => event.event === 'effect')).toHaveLength(0);
    await expect.poll(() => processesSettled(container, journal(container, file))).toBe(true);

    await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    await expect(page.getByText('Saved value configured')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test saved settings' })).toBeEnabled();
    await page.getByLabel('Name', { exact: true }).fill(`${name}-updated`);
    await expect(page.getByRole('button', { name: 'Test saved settings' })).toBeDisabled();
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'MCP Servers', exact: true })).toBeVisible();
    expect(
      (await servers(request)).find((item) => item.id === server.id)?.credentialStatus.env
        .FIXTURE_SECRET,
    ).toBe(true);
    await expect(page.getByText('Connected; discovery completed')).toHaveCount(0);

    const updatedName = `${name}-updated`;
    await page
      .getByRole('button', { name: `Duplicate ${updatedName} without credentials` })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'duplicated without credential values' }),
    ).toBeVisible();
    const copy = (await servers(request)).find(
      (item) => item.id !== server.id && item.name.startsWith(updatedName),
    )!;
    expect(copy.needsReconfiguration).toBe(true);
    expect(copy.credentialStatus.env.FIXTURE_SECRET).toBe(false);
    await expect(
      page
        .getByRole('region', { name: copy.name, exact: true })
        .getByRole('button', { name: 'Test', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: `Edit ${copy.name}`, exact: true }).click();
    await page.getByLabel('Action for FIXTURE_SECRET').selectOption('replace');
    await page.getByLabel('New value for FIXTURE_SECRET').fill('test-value');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'MCP Servers', exact: true })).toBeVisible();
    expect((await servers(request)).find((item) => item.id === copy.id)?.needsReconfiguration).toBe(
      false,
    );
    expect(credentialState(container, copy.id)).toMatchObject({
      owned: true,
      encrypted: true,
      plaintextPresent: false,
    });

    await page.getByRole('button', { name: 'Open settings menu' }).click();
    await page.getByRole('menuitem', { name: 'Agents', exact: true }).click();
    await page.getByRole('button', { name: 'New Agent', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(`${prefix}-agent`);
    await expect(
      page.getByText('Assigning a server allows future chats to connect to it.', { exact: false }),
    ).toBeVisible();
    await page.getByRole('checkbox', { name: updatedName, exact: true }).check();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Agents', exact: true })).toBeVisible();
    const agentResponse = await request.get(`${apiURL}/v1/agents`);
    const agent = (
      (await agentResponse.json()).data as Array<{ name: string; allowedMcpServerIds: string[] }>
    ).find((item) => item.name === `${prefix}-agent`)!;
    expect(agent.allowedMcpServerIds).toEqual([server.id]);
    expect(journal(container, file).filter((event) => event.event === 'effect')).toHaveLength(0);
    expect(journal(container, file).filter((event) => event.event === 'started')).toHaveLength(1);

    await openServers(page);
    await page.getByRole('button', { name: `Edit ${copy.name}`, exact: true }).click();
    await page.getByLabel('Action for FIXTURE_SECRET').selectOption('clear');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'MCP Servers', exact: true })).toBeVisible();
    expect(
      (await servers(request)).find((item) => item.id === copy.id)?.credentialStatus.env,
    ).toEqual({});
    await page.screenshot({ path: testInfo.outputPath('mcp-safe-terminal-state.png') });
    await attachEvidence(testInfo, 'mcp-safe-backend-evidence.json', {
      layer: 'Browser + real Compose API/SQLite/MCP transport',
      source:
        process.env.MCP_TEST_REVISION ??
        'local implementation worktree; bind container image in run receipt',
      selectedBatchCount: saved.length,
      publicCredentialValuesAbsent: !JSON.stringify(server).includes('test-value'),
      copyInitiallyNeedsReconfiguration: copy.needsReconfiguration,
      configuredAgentServerIds: agent.allowedMcpServerIds,
      journal: journal(container, file),
      testedOriginalCredentialState: credentialState(container, server.id),
      limits:
        'No model call in this journey. Native and real permission/effect journeys run separately. Credential entry recording disabled; this terminal evidence contains no values.',
    });
  } finally {
    await cleanup(request, prefix, container, file);
  }
});

test('MCP selected import rolls back on conflict and missing executable is an actionable settled failure', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const container = apiContainer();
  const prefix = `mcp-browser-${randomUUID()}`;
  const file = `${prefix}.jsonl`;
  const conflictName = `${prefix}-conflict`;
  const freshName = `${prefix}-fresh`;
  const missing = { command: `/not-installed/${prefix}`, args: [] };
  try {
    const setup = await request.post(`${apiURL}/v1/mcp-servers`, {
      data: { name: conflictName, transport: 'stdio', ...missing },
    });
    expect(setup.ok()).toBe(true);
    await openServers(page);
    await review(page, { [freshName]: missing, [conflictName]: missing });
    await page.getByRole('button', { name: 'Import 2 Servers', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'no partial import' })).toBeVisible();
    expect(
      (await servers(request)).filter((server) => server.name.startsWith(prefix)),
    ).toHaveLength(1);
    await page.getByRole('checkbox', { name: new RegExp(conflictName) }).uncheck();
    await page.getByRole('button', { name: 'Import 1 Server', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'MCP Servers', exact: true })).toBeVisible();
    const card = await explicitTest(page, freshName);
    await expect(card).toContainText('Connection failed');
    await expect(card).toContainText(/executable|installed/i);
    expect(journal(container, file)).toEqual([]);
    await expect(card.getByRole('button', { name: 'Test', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('mcp-missing-executable.png') });
    await attachEvidence(testInfo, 'mcp-failure-evidence.json', {
      atomicConflictPreservedExistingOnly: true,
      explicitReselectionSavedFresh: true,
      missingExecutableSettled: true,
      fixtureEffects: journal(container, file).filter((event) => event.event === 'effect').length,
      layer: 'Browser + real Compose API/SQLite; failed real process launch',
    });
  } finally {
    await cleanup(request, prefix, container, file);
  }
});
