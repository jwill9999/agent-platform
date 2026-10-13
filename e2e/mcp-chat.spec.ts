import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { test } from './support/mcp-test';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// A fixed external fixture endpoint is shared only within this sequential file.
// Never capture input/network secrets; safe terminal evidence is saved explicitly.
test.describe.configure({ mode: 'default' });
test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 15_000 });
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';

type Event = { event: string; pid?: number; tool?: string; authenticated?: boolean };
type RecordId = { id: string };

function containerName() {
  const container =
    process.env.MCP_ONBOARDING_API_CONTAINER ??
    execFileSync('docker', ['compose', 'ps', '-q', 'api'], { encoding: 'utf8' }).trim();
  if (!container)
    throw new Error('Run this acceptance test against its owned Compose API container.');
  return container;
}
function nodeInContainer(container: string, source: string, ...args: string[]) {
  return execFileSync(
    'docker',
    ['exec', container, 'node', '--input-type=module', '-e', source, ...args],
    { encoding: 'utf8' },
  );
}
async function startProvider(container: string, model: string, mode: string) {
  const child = spawn('docker', [
    'exec',
    '-i',
    container,
    'node',
    '--input-type=module',
    '-e',
    readFileSync(join(process.cwd(), 'e2e/support/mcp-provider.mjs'), 'utf8'),
    model,
    mode,
  ]);
  const requests: Array<{ tools?: Array<{ function: { name: string } }> }> = [];
  const errors: string[] = [];
  let ready = false;
  let pending = '';
  child.stdout.on('data', (chunk: Buffer) => {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.kind === 'ready') ready = true;
        if (event.kind === 'request') requests.push(event.body);
        if (event.kind === 'error') errors.push(event.message);
      } catch {
        errors.push('Invalid provider fixture output');
      }
    }
  });
  child.stderr.on('data', () => errors.push('Provider fixture process error'));
  child.on('error', () => errors.push('Provider fixture could not start'));
  const close = async () => {
    if (child.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.stdin.end();
    await exited;
  };
  try {
    await expect.poll(() => ready, { timeout: 10000 }).toBe(true);
  } catch (error) {
    await close();
    throw error;
  }
  return { requests, errors, close };
}
async function create<T extends RecordId>(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(`${apiURL}/v1/${path}`, { data });
  expect(response.ok(), `Create disposable ${path}`).toBe(true);
  return (await response.json()).data as T;
}
function events(container: string, directory: string): Event[] {
  return JSON.parse(
    nodeInContainer(
      container,
      "import{existsSync,readFileSync}from'node:fs';const p=process.argv[1]+'/journal.jsonl';console.log(JSON.stringify(existsSync(p)?readFileSync(p,'utf8').trim().split('\\n').filter(Boolean).map(line=>JSON.parse(line)):[]))",
      directory,
    ),
  ) as Event[];
}
function childrenSettled(container: string, directory: string) {
  const pids = events(container, directory).flatMap((event) => (event.pid ? [event.pid] : []));
  return JSON.parse(
    nodeInContainer(
      container,
      'console.log(JSON.parse(process.argv[1]).every(pid=>{try{process.kill(pid,0);return false}catch{return true}}))',
      JSON.stringify(pids),
    ),
  ) as boolean;
}
function snapshot(container: string, sessionId: string) {
  return JSON.parse(
    nodeInContainer(
      container,
      `
    import{openDatabase}from'./packages/db/dist/index.js';const{sqlite}=openDatabase(process.env.SQLITE_PATH);
    const id=process.argv[1];
    console.log(JSON.stringify({
      session:sqlite.prepare('select id,agent_id,project_id from sessions where id=?').get(id),
      approvals:sqlite.prepare('select id,status,resumed_at_ms,execution_payload_json from approval_requests where session_id=?').all(id),
      audits:sqlite.prepare('select tool_name,status,result_json from tool_executions where session_id=?').all(id),
      messages:sqlite.prepare('select role,content from messages where session_id=? order by created_at_ms').all(id)
    }));sqlite.close();
  `,
      sessionId,
    ),
  ) as {
    session: { id: string; agent_id: string; project_id: string };
    approvals: Array<{
      id: string;
      status: string;
      resumed_at_ms: number | null;
      execution_payload_json: string;
    }>;
    audits: Array<{ tool_name: string; status: string; result_json: string }>;
    messages: Array<{ role: string; content: string }>;
  };
}
async function send(page: Page, text: string) {
  const input = page.getByPlaceholder('Ask about this Project...');
  await expect(input).toBeEnabled();
  await input.fill(text);
  const posted = page.waitForResponse(
    (response) => response.url().endsWith('/api/chat') && response.request().method() === 'POST',
  );
  await input.press('Enter');
  expect((await posted).ok()).toBe(true);
}
async function attach(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(name);
  writeFileSync(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}

for (const mode of ['approve', 'reject', 'block', 'stale', 'unknown'] as const) {
  test(`Browser MCP ${mode}: real chat permission and settled effect boundary`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(120_000);
    const container = containerName();
    const prefix = `mcp-chat-${randomUUID()}`;
    const directory = `/workspace/${prefix}`;
    const model = prefix;
    const provider = await startProvider(container, model, mode);
    let serverId: string | undefined;
    let agentId: string | undefined;
    let modelId: string | undefined;
    let projectId: string | undefined;
    let sessionId: string | undefined;
    let previousPolicy: unknown;
    let passed = false;
    const cleanupFailures: string[] = [];
    try {
      nodeInContainer(
        container,
        `
        import{mkdirSync,writeFileSync}from'node:fs';import{spawnSync}from'node:child_process';
        const dir=process.argv[1];mkdirSync(dir);writeFileSync(dir+'/README.md','# Disposable MCP browser project\\n');
        writeFileSync(dir+'/control.json',JSON.stringify({lostResponse:process.argv[2]==='unknown'}));
        const git=spawnSync('/usr/bin/git',['init','--initial-branch=mcp-fixture',dir],{encoding:'utf8'});
        if(git.status!==0)throw new Error('Could not initialize disposable Project');
      `,
        directory,
        mode,
      );
      const serverBody = {
        name: `${prefix}-server`,
        transport: 'stdio',
        command: '/usr/local/bin/node',
        args: [
          '/app/apps/api/test/fixtures/mcp-chat-server.mjs',
          `${directory}/journal.jsonl`,
          `${directory}/control.json`,
        ],
        credentials: { env: { FIXTURE_SECRET: 'test-value' } },
      };
      const server = await create(request, 'mcp-servers', serverBody);
      serverId = server.id;
      const config = await create(request, 'model-configs', {
        name: `${prefix}-model`,
        provider: 'ollama',
        model,
        apiKey: 'mcp-browser-synthetic-fixture-key',
      });
      modelId = config.id;
      const agent = await create(request, 'agents', {
        name: `${prefix}-agent`,
        systemPrompt: 'Perform only the requested disposable MCP action.',
        modelConfigId: modelId,
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [serverId],
        pluginAllowlist: [],
        contextWindow: { maxInputTokens: 14000, maxOutputTokens: 2048, strategy: 'summarize' },
        executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 30000 },
      });
      agentId = agent.id;
      const registered = await request.post(`${apiURL}/v1/projects/desktop/register`, {
        headers: { 'x-agent-platform-desktop-bridge': '1' },
        data: { name: prefix, path: directory },
      });
      expect(registered.ok()).toBe(true);
      projectId = (await registered.json()).data.project.id as string;
      const settings = await request.get(`${apiURL}/v1/settings`);
      previousPolicy = (await settings.json()).data.executionPolicy;
      // Only the isolated Compose test environment is changed; restore it in finally.
      expect(
        (
          await request.put(`${apiURL}/v1/settings`, {
            data: { executionPolicy: { unknownToolPolicy: 'ask' } },
          })
        ).ok(),
      ).toBe(true);
      if (mode === 'block') {
        await page.goto('/settings/workspace');
        await page.getByRole('combobox', { name: /Unknown tools/ }).selectOption('block');
        await expect
          .poll(
            async () =>
              (await (await request.get(`${apiURL}/v1/settings`)).json()).data.executionPolicy
                .unknownToolPolicy,
          )
          .toBe('block');
      }
      const [initialBinding] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/sessions/project') &&
            response.request().method() === 'POST' &&
            response.request().postDataJSON()?.projectId === projectId,
        ),
        page.goto(`/?projectId=${projectId}`),
      ]);
      expect(initialBinding.ok()).toBe(true);
      const initialSession = (await initialBinding.json()).data.session;
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
      const agentSelector = page.getByRole('combobox', { name: 'Active agent' });
      await expect(agentSelector).toBeEnabled();
      if (initialSession.agentId === agentId) {
        sessionId = initialSession.id;
      } else {
        const [bound] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url().endsWith('/api/v1/sessions/project') &&
              response.request().method() === 'POST' &&
              response.request().postDataJSON()?.agentId === agentId,
          ),
          (async () => {
            await agentSelector.click();
            await page.getByRole('option', { name: `${prefix}-agent`, exact: true }).click();
          })(),
        ]);
        expect(bound.ok()).toBe(true);
        sessionId = (await bound.json()).data.session.id as string;
      }
      if (!sessionId) throw new Error('Disposable Project session was not bound');
      await expect(agentSelector).toContainText(`${prefix}-agent`);
      expect(snapshot(container, sessionId).session.agent_id).toBe(agentId);
      await send(page, '/init');
      await page.getByRole('button', { name: 'Approve instructions', exact: true }).click();
      await expect(page.getByText('Project instructions approved').last()).toBeVisible();
      const modelSelector = page.getByRole('combobox', { name: 'Active model' });
      await modelSelector.click();
      await page.getByRole('option', { name: new RegExp(`${prefix}-model`) }).click();
      await send(page, 'Perform one disposable MCP action.');
      if (mode !== 'block') {
        await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
        expect(
          events(container, directory).filter((entry) => entry.event === 'effect'),
        ).toHaveLength(0);
        const waiting = snapshot(container, sessionId);
        expect(waiting.approvals).toHaveLength(1);
        expect(waiting.approvals[0]!.status).toBe('pending');
        expect(JSON.parse(waiting.approvals[0]!.execution_payload_json).mcpBinding.serverId).toBe(
          serverId,
        );
        await attach(info, 'waiting-state.json', {
          approvals: waiting.approvals.map(({ id, status }) => ({ id, status })),
          effects: 0,
          providerRequests: provider.requests.length,
        });
        if (mode === 'stale') {
          const updated = await request.put(`${apiURL}/v1/mcp-servers/${serverId}`, {
            data: {
              ...serverBody,
              credentials: { env: { FIXTURE_SECRET: 'replacement-synthetic-value' } },
            },
          });
          expect(updated.ok()).toBe(true);
        }
        await page
          .getByRole('button', { name: mode === 'reject' ? 'Deny' : 'Approve', exact: true })
          .click();
      }
      if (mode === 'stale')
        await expect(
          page.getByText(
            'MCP connection or assignment changed. Start a new request and review its permissions.',
            { exact: false },
          ),
        ).toBeVisible();
      else if (mode === 'unknown')
        await expect(page.getByTestId('approval-card').getByRole('alert')).toContainText(
          'may have taken effect',
        );
      else
        await expect(
          page.getByText(`MCP browser ${mode} settled.`, { exact: false }).last(),
        ).toBeVisible();
      if (mode === 'unknown' || mode === 'stale') {
        const card = page.getByTestId('approval-card');
        await expect(card).toContainText('Action needs attention');
        await expect(card).not.toContainText('Approved action completed');
        await expect(card.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
      }
      if (mode !== 'stale')
        await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
      await expect.poll(() => childrenSettled(container, directory)).toBe(true);
      const actualEffects = events(container, directory).filter(
        (entry) => entry.event === 'effect',
      );
      expect(actualEffects).toHaveLength(mode === 'approve' || mode === 'unknown' ? 1 : 0);
      if (actualEffects.length) expect(actualEffects[0]!.authenticated).toBe(true);
      expect(provider.requests).toHaveLength(mode === 'unknown' || mode === 'stale' ? 1 : 2);
      expect(provider.errors).toEqual([]);
      expect(
        provider.requests[0]?.tools?.some(
          (tool) => tool.function.name === `${serverId}__fixture_effect`,
        ),
      ).toBe(true);
      expect(
        provider.requests[0]?.tools?.some((tool) => tool.function.name === `${serverId}__bash`),
      ).toBe(false);
      const final = snapshot(container, sessionId);
      if (mode === 'block') expect(final.approvals).toHaveLength(0);
      if (mode === 'reject') expect(final.approvals[0]!.status).toBe('rejected');
      const diagnosticExport = await page.evaluate(async (id) => {
        const response = await fetch('/api/diagnostics/report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scope: { sessionId: id } }),
        });
        return { status: response.status, body: await response.json() };
      }, sessionId);
      // Compose is intentionally not the protected loopback diagnostic topology.
      expect(diagnosticExport.status).toBe(403);
      expect(diagnosticExport.body.error.code).toBe('DIAGNOSTICS_DENIED');
      await attach(info, 'mcp-chat-evidence.json', {
        mode,
        sessionId,
        effects: actualEffects,
        providerRequests: provider.requests.length,
        providerErrors: provider.errors,
        snapshot: final,
        diagnostics: {
          result: 'denied as designed for Compose topology',
          evidence: diagnosticExport,
          coverage:
            'Actual V1 reports are required and collected in the native connected acceptance suite.',
        },
        limits:
          'Real browser/API/SQLite/approval/MCP effects; deterministic external model HTTP service. No paid model calls, no host/VM isolation claim.',
      });
      await page.screenshot({ path: info.outputPath('mcp-chat-terminal.png') });
      if (mode === 'unknown') {
        await page.reload();
        await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
        await expect(page.getByText('Approved action completed', { exact: true })).toHaveCount(0);
        await expect(
          page.getByTestId('approval-card').getByRole('button', { name: 'Approve', exact: true }),
        ).toHaveCount(0);
        const persisted = snapshot(container, sessionId);
        expect(
          persisted.audits.some((record) => record.result_json?.includes('MCP_OUTCOME_UNKNOWN')),
        ).toBe(true);
        expect(
          events(container, directory).filter((record) => record.event === 'effect'),
        ).toHaveLength(1);
        expect(provider.requests).toHaveLength(1);
        await attach(info, 'mcp-reload-evidence.json', {
          consumedApprovalNotRestoredAsSuccess: true,
          noReplayAction: true,
          persistedFailure: persisted.audits,
          limits:
            'Pending-only approval hydration; settled MCP failure remains in the persisted audit. This is not a new historical activity UI.',
        });
      }
      passed = true;
    } finally {
      const attempt = async (label: string, action: () => Promise<unknown>) => {
        try {
          await action();
        } catch {
          cleanupFailures.push(label);
        }
      };
      // A failed screenshot/readback must not prevent independent owned cleanup.
      await attempt('failure evidence', async () => {
        if (!passed) {
          await attach(info, 'mcp-chat-failure.json', {
            providerRequests: provider.requests.length,
            providerErrors: provider.errors,
            providerToolNames: provider.requests.map((entry) =>
              entry.tools?.map((tool) => tool.function.name),
            ),
            events: events(container, directory),
            db: sessionId ? snapshot(container, sessionId) : null,
            visible: (await page.locator('body').innerText())
              .split(directory)
              .join('[fixture]')
              .split('test-value')
              .join('[redacted]'),
          });
          await page.screenshot({ path: info.outputPath('mcp-chat-failure.png') });
        }
      });
      await attempt('restore execution policy', async () => {
        if (previousPolicy)
          expect(
            (
              await request.put(`${apiURL}/v1/settings`, {
                data: { executionPolicy: previousPolicy },
              })
            ).ok(),
          ).toBe(true);
      });
      await attempt('delete disposable sessions', async () => {
        if (projectId) {
          const records = await request.get(`${apiURL}/v1/sessions`);
          expect(records.ok()).toBe(true);
          const sessions = (await records.json()).data as Array<{ id: string; projectId?: string }>;
          for (const session of sessions)
            if (session.projectId === projectId)
              expect((await request.delete(`${apiURL}/v1/sessions/${session.id}`)).ok()).toBe(true);
        } else if (sessionId)
          expect((await request.delete(`${apiURL}/v1/sessions/${sessionId}`)).ok()).toBe(true);
      });
      for (const [kind, id] of [
        ['projects', projectId],
        ['agents', agentId],
        ['model-configs', modelId],
        ['mcp-servers', serverId],
      ]) {
        await attempt(`delete disposable ${kind}`, async () => {
          if (id) expect((await request.delete(`${apiURL}/v1/${kind}/${id}`)).ok()).toBe(true);
        });
      }
      await attempt('remove fixture directory', async () => {
        nodeInContainer(
          container,
          "import{rmSync}from'node:fs';rmSync(process.argv[1],{recursive:true,force:true})",
          directory,
        );
      });
      await attempt('close external fixture', provider.close);
      if (cleanupFailures.length) {
        await attach(info, 'mcp-cleanup-failures.json', { cleanupFailures });
      }
    }
    expect(cleanupFailures, 'Every owned resource was cleaned up').toEqual([]);
  });
}
