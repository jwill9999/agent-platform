import { expect, test } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { holdReplyRead } from '../apps/desktop/e2e/support/chatReplyFixture.js';

type Snapshot = {
  messages: Array<{ id: string; role: string; content: string }>;
  audits: unknown[];
};
test.use({ trace: 'on' });
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
const dbSource = `
import { openDatabase, appendMessage, updateSessionTitle, listMessagesBySession, queryToolExecutions } from './packages/db/dist/index.js';
const {db,sqlite}=openDatabase(process.env.SQLITE_PATH);
try {
 const id=process.argv[1];
 if(process.argv[2]==='seed') {
  updateSessionTitle(db,id,'Reply restore saved session');
  appendMessage(db,{sessionId:id,role:'user',content:'Earlier synthetic question'});
  appendMessage(db,{sessionId:id,role:'assistant',content:'Earlier saved reply.'});
 }
 if(process.argv[2]==='backup') await sqlite.backup(process.argv[3]);
 console.log(JSON.stringify({messages:listMessagesBySession(db,id),audits:queryToolExecutions(db,{sessionId:id,limit:100})}));
} finally { sqlite.close(); }
`;

test('Docker saved Project restores both reads before sending and keeps the completed reply', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  // CI owns its Compose stack. Local runs must explicitly select their disposable container.
  const container =
    process.env.CHAT_REPLY_API_CONTAINER ??
    (process.env.CI
      ? execFileSync('docker', ['compose', 'ps', '-q', 'api'], { encoding: 'utf8' }).trim()
      : '');
  expect(container, 'Set CHAT_REPLY_API_CONTAINER to the isolated test API container').not.toBe('');
  const model = `reply-browser-${randomUUID()}`;
  const directory = `/tmp/${model}`;
  const exec = (args: string[]) =>
    execFileSync('docker', ['exec', container, ...args], { encoding: 'utf8' });
  const provider = spawn('docker', [
    'exec',
    '-i',
    container,
    'node',
    '--input-type=module',
    '-e',
    readFileSync('e2e/support/chat-reply-provider.mjs', 'utf8'),
    model,
  ]);
  const wire: unknown[] = [];
  const errors: string[] = [];
  const order: string[] = [];
  let ready = false;
  let providerPid: number | undefined;
  let primaryError: unknown;
  const cleanupErrors: unknown[] = [];
  let buffered = '';
  provider.stdout.on('data', (chunk: Buffer) => {
    buffered += chunk.toString();
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines) {
      const event = JSON.parse(line) as {
        kind: string;
        pid?: number;
        body?: unknown;
        message?: string;
      };
      if (event.kind === 'ready') {
        ready = true;
        providerPid = event.pid;
      }
      if (event.kind === 'request') wire.push(event.body);
      if (event.kind === 'error') errors.push(event.message ?? 'Unknown fixture error');
    }
  });
  provider.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
  provider.stdin.on('error', (error) => errors.push(error.message));
  let configId: string | undefined;
  let agentId: string | undefined;
  let projectId: string | undefined;
  let sessionId: string | undefined;
  let alternateSessionId: string | undefined;
  let history: Awaited<ReturnType<typeof holdReplyRead>> | undefined;
  let approvals: Awaited<ReturnType<typeof holdReplyRead>> | undefined;
  const posts: string[] = [];
  const snapshot = (mode = 'read'): Snapshot =>
    JSON.parse(exec(['node', '--input-type=module', '-e', dbSource, sessionId!, mode])) as Snapshot;
  try {
    await expect.poll(() => ready).toBe(true);
    exec(['mkdir', '-p', directory]);
    exec(['git', 'init', '-q', directory]);
    const config = await request.post(`${apiURL}/v1/model-configs`, {
      data: { name: model, provider: 'ollama', model, apiKey: 'reply-synthetic-fixture-key' },
    });
    expect(config.ok()).toBe(true);
    configId = (await config.json()).data.id;
    const agent = await request.post(`${apiURL}/v1/agents`, {
      data: {
        name: model,
        systemPrompt: 'Reply with the requested synthetic fixture answer.',
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [],
        pluginAllowlist: [],
        modelConfigId: configId,
        executionLimits: { maxSteps: 8, maxParallelTasks: 1, timeoutMs: 60000 },
      },
    });
    expect(agent.ok()).toBe(true);
    agentId = (await agent.json()).data.id;
    const project = await request.post(`${apiURL}/v1/projects/desktop/register`, {
      headers: { 'x-agent-platform-desktop-bridge': '1' },
      data: { name: model, path: directory },
    });
    expect(project.ok()).toBe(true);
    projectId = (await project.json()).data.project.id;
    const session = await request.post(`${apiURL}/v1/sessions`, {
      data: { agentId, mode: 'project', projectId },
    });
    expect(session.ok()).toBe(true);
    sessionId = (await session.json()).data.id;
    snapshot('seed');
    await page.goto(`/?projectId=${projectId}&sessionId=${sessionId}`);
    const input = page.getByPlaceholder('Ask about this Project...');
    await expect(page.getByText('Earlier saved reply.', { exact: true })).toBeVisible();
    await expect(input).toBeEnabled();
    await input.fill('/init');
    await input.press('Enter');
    await page.getByRole('button', { name: 'Approve instructions' }).click();
    await expect(page.getByText('Project instructions approved').last()).toBeVisible();
    await expect(input).toBeEnabled();
    const before = snapshot();
    expect(wire).toHaveLength(0);
    const alternate = await request.post(`${apiURL}/v1/sessions`, {
      data: { agentId, mode: 'project', projectId },
    });
    expect(alternate.ok()).toBe(true);
    alternateSessionId = (await alternate.json()).data.id;
    // Settle a distinct session before selecting saved A through its real menu.
    // Single-use holds must capture A's menu restoration, not a superseded initial load.
    const alternateReads = Promise.all([
      page.waitForResponse((response) =>
        response.url().endsWith(`/sessions/${alternateSessionId}/messages`),
      ),
      page.waitForResponse((response) =>
        response
          .url()
          .includes(`/approval-requests?sessionId=${alternateSessionId}&status=pending`),
      ),
    ]);
    await page.goto(`/?projectId=${projectId}&sessionId=${alternateSessionId}`);
    for (const response of await alternateReads) expect(response.ok()).toBe(true);
    await input.fill('Unsent setup draft');
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await input.clear();
    history = await holdReplyRead(page, `**/api/v1/sessions/${sessionId}/messages`);
    approvals = await holdReplyRead(
      page,
      `**/api/v1/approval-requests?sessionId=${sessionId}&status=pending`,
    );
    page.on('request', (req) => {
      if (
        req.method() === 'POST' &&
        /\/api\/(?:v1\/)?chat(?:\/|$)/.test(new URL(req.url()).pathname)
      )
        posts.push(req.url());
    });
    await page.getByRole('button', { name: 'Open sessions menu' }).click();
    await page.getByRole('menuitem', { name: /Reply restore saved session/ }).click();
    await history.captured();
    order.push('actual history fetched and held');
    const send = page.getByRole('button', { name: 'Send message', exact: true });
    await input.fill('REPLY_BROWSER_ACCEPTED_ONCE');
    await expect(send).toBeDisabled();
    await input.press('Enter');
    expect(posts).toHaveLength(0);
    expect(wire).toHaveLength(0);
    expect(snapshot()).toEqual(before);
    history.release();
    await history.delivered();
    await approvals.captured();
    order.push('history delivered while actual approvals held');
    await expect(send).toBeDisabled();
    await input.press('Enter');
    await expect(input).toHaveValue('REPLY_BROWSER_ACCEPTED_ONCE');
    expect(posts).toHaveLength(0);
    expect(wire).toHaveLength(0);
    expect(snapshot()).toEqual(before);
    approvals.release();
    await approvals.delivered();
    order.push('approvals delivered');
    await expect(input).toBeEnabled();
    await expect(page.getByText('Earlier saved reply.', { exact: true })).toBeVisible();
    const selector = page.getByRole('combobox', { name: 'Active model' });
    await selector.click();
    await page.getByRole('option', { name: new RegExp(model) }).click();
    await input.fill('REPLY_BROWSER_ACCEPTED_ONCE');
    await expect(send).toBeEnabled();
    await input.press('Enter');
    await expect.poll(() => wire.length).toBe(1);
    order.push('one accepted request reached loopback provider');
    provider.stdin.write('complete\n');
    const finalText = 'Docker restored reply completed.';
    await expect(page.getByText(finalText, { exact: true })).toHaveCount(1);
    await expect(page.getByText(finalText, { exact: true })).toBeVisible();
    await expect(input).toBeEnabled();
    await expect
      .poll(
        () =>
          snapshot().messages.filter((m) => m.role === 'assistant' && m.content === finalText)
            .length,
      )
      .toBe(1);
    const after = snapshot();
    expect(after.messages.slice(0, before.messages.length)).toEqual(before.messages);
    expect(
      after.messages.filter(
        (m) => m.role === 'user' && m.content === 'REPLY_BROWSER_ACCEPTED_ONCE',
      ),
    ).toHaveLength(1);
    expect(after.audits).toEqual(before.audits);
    expect(posts).toHaveLength(1);
    expect(wire).toHaveLength(1);
    expect(errors).toEqual([]);
    await history.close();
    await approvals.close();
    // This deliberate multi-navigation scenario tests another full bootstrap.
    // Pace that safe read boundary using the real default limiter, never replay chat.
    const budgetUrl = new URL('/api/v1/settings', page.url()).href;
    // Browser-context requests use this renderer/BFF origin and its forwarded
    // client identity; direct fixture API setup has a separate limiter bucket.
    const reopenBudget = await page.request.get(budgetUrl);
    expect([200, 429]).toContain(reopenBudget.status());
    const budgetHeader = reopenBudget.headers()['ratelimit'];
    const remaining = Number(budgetHeader?.match(/remaining=(\d+)/)?.[1]);
    const reset = Number(budgetHeader?.match(/reset=(\d+)/)?.[1]);
    expect(Number.isFinite(remaining) && Number.isFinite(reset)).toBe(true);
    if (remaining < 40) {
      const waitMs = reset * 1000 + 100;
      expect(waitMs).toBeLessThanOrEqual(61_000);
      await test.info().attach('reopen-request-budget-pacing', {
        body: JSON.stringify({
          status: reopenBudget.status(),
          url: reopenBudget.url(),
          browserOrigin: new URL(page.url()).origin,
          transport: 'browser-context request through renderer BFF',
          rateHeader: budgetHeader,
          remaining,
          waitMs,
        }),
        contentType: 'application/json',
      });
      await delay(waitMs);
      const recovered = await page.request.get(budgetUrl);
      expect(recovered.ok()).toBe(true);
      await test.info().attach('reopen-request-budget-recovered', {
        body: JSON.stringify({
          url: recovered.url(),
          status: recovered.status(),
          rateHeader: recovered.headers()['ratelimit'],
        }),
        contentType: 'application/json',
      });
      expect(
        Number(recovered.headers()['ratelimit']?.match(/remaining=(\d+)/)?.[1]),
      ).toBeGreaterThanOrEqual(40);
    }
    await page.goto(`/?projectId=${projectId}&sessionId=${sessionId}`);
    await expect(page.getByText(finalText, { exact: true })).toHaveCount(1);
    await expect(page.getByText(finalText, { exact: true })).toBeVisible();
    await expect(input).toBeEnabled();
    expect(snapshot()).toEqual(after);
    expect(posts).toHaveLength(1);
    order.push('requested-session reopen shows same durable reply once');
    const screenshotPath = test.info().outputPath('reply-browser-success.png');
    await page.screenshot({ path: screenshotPath });
    await test
      .info()
      .attach('reply-browser-success', { path: screenshotPath, contentType: 'image/png' });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const failures = cleanupErrors;
    const settle = async (actions: Array<() => Promise<unknown>>) => {
      const results = await Promise.allSettled(
        actions.map((action) => Promise.resolve().then(action)),
      );
      for (const result of results) if (result.status === 'rejected') failures.push(result.reason);
    };
    // Each held route releases independently, even if another aborted route cannot settle.
    await settle([async () => history?.close(), async () => approvals?.close()]);
    await settle([
      async () => {
        const evidencePath = test.info().outputPath('reply-browser-evidence.json');
        writeFileSync(
          evidencePath,
          JSON.stringify(
            {
              sessionId,
              projectId,
              order,
              posts,
              wire,
              errors,
              history: history?.record(),
              approvals: approvals?.record(),
              final: sessionId ? snapshot() : undefined,
              topology:
                'Real Docker renderer/BFF/API/SQLite; deterministic loopback provider. Synthetic registration/transcript setup. No tool effects requested.',
              diagnostics:
                'Ordinary Docker has no diagnostic capability; joined V1 evidence is required separately from managed Chromium/Electron.',
            },
            null,
            2,
          ),
        );
        await test.info().attach('reply-browser-evidence', {
          path: evidencePath,
          contentType: 'application/json',
        });
      },
      async () => {
        if (!sessionId) return;
        const containerSnapshot = `${directory}/reply-snapshot.sqlite`;
        exec([
          'node',
          '--input-type=module',
          '-e',
          dbSource,
          sessionId,
          'backup',
          containerSnapshot,
        ]);
        const sqlitePath = test.info().outputPath('reply-browser.sqlite');
        execFileSync('docker', ['cp', `${container}:${containerSnapshot}`, sqlitePath], {
          timeout: 5_000,
        });
        await test.info().attach('reply-browser-sqlite', {
          path: sqlitePath,
          contentType: 'application/vnd.sqlite3',
        });
      },
    ]);
    const waitForProviderExit = async (timeout: number) => {
      if (provider.exitCode !== null || provider.signalCode !== null) return;
      await new Promise<void>((resolve, reject) => {
        const onExit = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          provider.off('exit', onExit);
          reject(new Error('Owned provider did not exit within cleanup bound'));
        }, timeout);
        provider.once('exit', onExit);
      });
    };
    await settle([
      async () => {
        provider.stdin.end();
        try {
          await waitForProviderExit(5_000);
        } catch (error) {
          // Only terminate the captured fixture PID after checking its unique model argument.
          // No other container process or user service is a cleanup target.
          try {
            if (providerPid) {
              execFileSync(
                'docker',
                [
                  'exec',
                  container,
                  'node',
                  '--input-type=module',
                  '-e',
                  "import {readFileSync} from 'node:fs'; const pid=Number(process.argv[1]); const args=readFileSync('/proc/'+pid+'/cmdline','utf8').split('\\0'); if(!args.includes(process.argv[2]))throw new Error('Fixture ownership mismatch'); process.kill(pid,'SIGKILL');",
                  String(providerPid),
                  model,
                ],
                { timeout: 5_000 },
              );
            }
          } finally {
            provider.kill('SIGTERM');
            await waitForProviderExit(5_000);
          }
          throw error;
        }
      },
    ]);
    const records = [
      ['sessions', alternateSessionId],
      ['sessions', sessionId],
      ['projects', projectId],
      ['agents', agentId],
      ['model-configs', configId],
    ] as const;
    for (const [resource, id] of records) {
      await settle([
        async () => {
          if (id) {
            const result = await request.delete(`${apiURL}/v1/${resource}/${id}`);
            expect(result.ok(), `Delete owned ${resource} fixture: HTTP${result.status()}`).toBe(
              true,
            );
          }
        },
      ]);
    }
    await settle([
      async () => {
        execFileSync('docker', ['exec', container, 'rm', '-rf', directory], { timeout: 5_000 });
      },
    ]);
    if (failures.length) {
      await test
        .info()
        .attach('reply-browser-cleanup-errors', {
          body: JSON.stringify(failures.map(String)),
          contentType: 'application/json',
        })
        .catch(() => {});
    }
  }
  if (primaryError === undefined && cleanupErrors.length)
    throw new AggregateError(cleanupErrors, 'Owned browser fixture cleanup failed');
});
