import { expect, type Page } from '@playwright/test';
import {
  RunControlRecordSchema,
  type RunControlRecord,
} from '../../../packages/contracts/src/runControl.js';
import type { DiagnosticReport } from '../../../packages/contracts/src/diagnostics.js';
import type { StopProvider } from './provider.mjs';
import type { StopSensorMarker } from './sensor-fixture.js';

export const stopScenarios = [
  'provider-stop',
  'approval-stop',
  'completed-effect',
  'provider-failure',
  'sensor-stop',
] as const;
export type StopScenario = (typeof stopScenarios)[number];
export type StopSnapshot = {
  messages: Array<{ role: string; content: string }>;
  approvals: Array<{ id: string; status: string; run_id: string | null }>;
  runs: Array<{ id: string; state: string; reason: string; version: number }>;
  attempts: Array<{ run_id: string; kind: string; outcome: string }>;
  executions: Array<{ execution_id: string; run_id: string }>;
};
export type StopJourneyContext = {
  page: Page;
  provider: StopProvider;
  sessionId: string;
  projectId: string;
  agentId: string;
  projectPath: string;
  origin: string;
  api<T>(path: string, init?: RequestInit): Promise<T>;
  raw(path: string, init?: RequestInit): Promise<Response>;
  snapshot(): StopSnapshot;
  writeEffect(content: string): void;
  readEffect(): string;
  effectPath: string;
  prepareSensorFiles(): void;
  readSensorMarker(): StopSensorMarker;
  releaseSensor(): void;
  exportReport(name: string): Promise<DiagnosticReport | undefined>;
  evidence: Record<string, unknown>;
};

const prompt = 'STOP_PRIVATE_PROMPT_CANARY';
const input = (page: Page) => page.getByPlaceholder('Ask about this Project...');
const send = (page: Page) => page.getByRole('button', { name: 'Send message', exact: true });
async function submit(ctx: StopJourneyContext, text = prompt) {
  await input(ctx.page).fill(text);
  await expect(send(ctx.page)).toBeEnabled();
  await send(ctx.page).click();
}
async function current(ctx: StopJourneyContext): Promise<RunControlRecord | null> {
  const row = await ctx.api<unknown>(`sessions/${ctx.sessionId}/active-run`);
  return row === null ? null : RunControlRecordSchema.parse(row);
}
async function waitForState(ctx: StopJourneyContext, states: string[]) {
  await expect
    .poll(async () => (await current(ctx))?.state, { timeout: 15_000 })
    .toMatch(new RegExp(`^(${states.join('|')})$`));
  const result = await current(ctx);
  if (!result) throw new Error('Expected durable run');
  expect(ctx.snapshot().runs).toContainEqual(
    expect.objectContaining({ id: result.id, state: result.state }),
  );
  return result;
}
async function clickStop(
  ctx: StopJourneyContext,
  terminal: 'cancelled' | 'outcome_unknown' = 'cancelled',
) {
  const stop = ctx.page.getByRole('button', { name: 'Stop run', exact: true });
  await expect(stop).toBeEnabled();
  const [response] = await Promise.all([
    ctx.page.waitForResponse(
      (value) =>
        value.request().method() === 'POST' &&
        /\/runs\/[^/]+\/stop$/.test(new URL(value.url()).pathname),
    ),
    stop.click(),
  ]);
  expect(response.ok()).toBe(true);
  const timing = response.request().timing();
  const acknowledgementMs = timing.responseStart - timing.requestStart;
  expect(acknowledgementMs).toBeGreaterThanOrEqual(0);
  expect(acknowledgementMs).toBeLessThanOrEqual(2_000);
  const acknowledged = RunControlRecordSchema.parse((await response.json()).data);
  expect(acknowledged.reason).toBe('user_stop');
  expect(acknowledged.stopAcknowledgedAtMs).toBeDefined();
  const settled = await waitForState(ctx, [terminal]);
  expect(settled.id).toBe(acknowledged.id);
  if (terminal === 'cancelled') expect(settled.inFlight).toBe(0);
  await expect(
    ctx.page
      .getByRole('status')
      .filter({ hasText: terminal === 'cancelled' ? 'Run stopped.' : 'Run outcome is unknown.' }),
  ).toBeVisible();
  if (terminal === 'cancelled')
    expect(
      ctx
        .snapshot()
        .attempts.filter((row) => row.run_id === settled.id)
        .every((row) => row.outcome !== 'running'),
    ).toBe(true);
  ctx.evidence.stop = { acknowledgementMs, acknowledged, settled };
  const again = await ctx.api<RunControlRecord>(
    `sessions/${ctx.sessionId}/runs/${settled.id}/stop`,
    { method: 'POST', body: '{}' },
  );
  expect(again.id).toBe(settled.id);
  expect(again.state).toBe(terminal);
  return settled;
}
async function verifyStopReport(
  ctx: StopJourneyContext,
  name: string,
  runId: string,
  state: 'cancelled' | 'outcome_unknown' = 'cancelled',
) {
  const report = await ctx.exportReport(name);
  if (!report) return;
  expect(
    report.events.some(
      ({ event }) =>
        event.phase === 'control' &&
        event.control?.logicalRunId === runId &&
        event.control.stage === 'acknowledged',
    ),
  ).toBe(true);
  expect(
    report.events.some(
      ({ event }) =>
        event.phase === 'control' &&
        event.control?.logicalRunId === runId &&
        event.control.state === state,
    ),
  ).toBe(true);
  ctx.evidence[name] = report;
}
async function reopen(ctx: StopJourneyContext) {
  await ctx.page.goto(`${ctx.origin}/?projectId=${ctx.projectId}&sessionId=${ctx.sessionId}`);
}

async function switchAwayAndBackWithoutCancelling(
  ctx: StopJourneyContext,
  run: RunControlRecord,
  providerIndex: number,
) {
  const original = await ctx.api<{ title?: string }>(`sessions/${ctx.sessionId}`);
  if (!original.title) throw new Error('Original run session has no retained title');
  // The live streaming header deliberately disables its session menu. Use the
  // supported SPA workspace navigation; a page reload would close the stream.
  await ctx.page.getByRole('button', { name: 'Workspaces', exact: true }).click();
  await expect(
    ctx.page.getByRole('heading', { name: 'Choose a workspace', exact: true }),
  ).toBeVisible();
  await ctx.page.locator(`a[href="/?projectId=${ctx.projectId}"]`).click();
  const menu = ctx.page.getByRole('button', { name: 'Open sessions menu', exact: true });
  await expect(menu).toBeEnabled();
  const title = original.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const selectOriginal = async () => {
    await menu.click();
    await ctx.page.getByRole('menuitem', { name: new RegExp(`^${title}`) }).click();
  };
  await selectOriginal();
  await expect(ctx.page.getByRole('button', { name: 'Stop run', exact: true })).toBeEnabled();
  await menu.click();
  const [created] = await Promise.all([
    ctx.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/v1/sessions',
    ),
    ctx.page.getByRole('menuitem', { name: 'New Project chat', exact: true }).click(),
  ]);
  expect(created.ok()).toBe(true);
  const selected = (await created.json()).data as { id: string };
  expect(selected.id).not.toBe(ctx.sessionId);
  ctx.evidence.uiCreatedSessions = [selected.id];
  await expect(input(ctx.page)).toBeEnabled();
  await expect(ctx.page.getByRole('button', { name: 'Stop run', exact: true })).toHaveCount(0);
  expect(await ctx.api(`sessions/${selected.id}/active-run`)).toBeNull();
  expect((await current(ctx))?.id).toBe(run.id);
  expect((await current(ctx))?.state).toBe('running');
  expect(ctx.provider.ledger[providerIndex]?.disconnected).toBe(false);
  await selectOriginal();
  await expect(ctx.page.getByRole('button', { name: 'Stop run', exact: true })).toBeEnabled();
  expect((await current(ctx))?.id).toBe(run.id);
  expect(ctx.provider.ledger[providerIndex]?.disconnected).toBe(false);
  ctx.evidence.selectionIsolation = {
    originalRunId: run.id,
    destinationSessionId: selected.id,
    originalStillRunning: true,
    providerStillConnected: true,
  };
}

/** UI is real, API/SQLite/effects are independently inspected; only the model endpoint is scripted. */
export async function runStopJourney(ctx: StopJourneyContext, scenario: StopScenario) {
  ctx.writeEffect('original-safe-fixture');
  if (scenario === 'sensor-stop') {
    ctx.prepareSensorFiles();
    await ctx.provider.enqueue({
      kind: 'tool',
      name: 'sys_run_quality_gate',
      args: { profile: 'typecheck', repoPath: ctx.projectPath, timeoutMs: 30000 },
    });
    await ctx.provider.enqueue({ kind: 'text', text: 'FORBIDDEN_POST_STOP_SENSOR_CONTINUATION' });
    await submit(ctx);
    const approvalButton = ctx.page
      .getByTestId('approval-card')
      .getByRole('button', { name: 'Approve', exact: true });
    await expect
      .poll(async () =>
        ctx.readSensorMarker().started > 0
          ? 'started'
          : (await approvalButton.count()) > 0
            ? 'approval'
            : 'waiting',
      )
      .toMatch(/^(started|approval)$/);
    if (ctx.readSensorMarker().started === 0) await approvalButton.click();
    await expect.poll(() => ctx.readSensorMarker().started).toBe(1);
    await expect
      .poll(() =>
        ctx.snapshot().attempts.some((row) => row.kind === 'sensor' && row.outcome === 'running'),
      )
      .toBe(true);
    expect(ctx.readSensorMarker().finished).toBe(0);
    const stopped = await clickStop(ctx, 'outcome_unknown');
    expect(ctx.readSensorMarker().finished).toBe(0);
    ctx.releaseSensor();
    await expect.poll(() => ctx.readSensorMarker().finished, { timeout: 15000 }).toBe(1);
    expect(ctx.readSensorMarker().started).toBe(1);
    expect(ctx.provider.requests).toHaveLength(1);
    expect(
      ctx.snapshot().attempts.filter((row) => row.run_id === stopped.id && row.kind === 'sensor'),
    ).toHaveLength(1);
    expect(
      JSON.stringify(ctx.snapshot().messages.filter((row) => row.role === 'tool')),
    ).not.toMatch(/Quality gate .* passed\./);
    expect(
      ctx
        .snapshot()
        .attempts.filter((row) => row.run_id === stopped.id && row.kind === 'sensor')
        .every((row) => row.outcome === 'unknown'),
    ).toBe(true);
    expect((await current(ctx))?.state).toBe('outcome_unknown');
    await expect(
      ctx.page.getByRole('status').filter({ hasText: 'Run outcome is unknown.' }),
    ).toBeVisible();
    await verifyStopReport(ctx, 'sensor-stopped', stopped.id, 'outcome_unknown');
    ctx.evidence.sensor = {
      marker: ctx.readSensorMarker(),
      state: await current(ctx),
      physicalLateEffectPreserved: true,
    };
    return;
  }
  if (scenario === 'provider-failure') {
    await ctx.provider.enqueue({ kind: 'error', status: 400 });
    await submit(ctx);
    const failed = await waitForState(ctx, ['failed']);
    expect(failed.reason).toBe('execution_failed');
    await expect(ctx.page.getByRole('button', { name: 'Stop run', exact: true })).toHaveCount(0);
    await expect(input(ctx.page)).toBeEnabled();
    expect(ctx.provider.requests).toHaveLength(1);
    expect(ctx.readEffect()).toBe('original-safe-fixture');
    const report = await ctx.exportReport('failure');
    if (report) expect(report.events.some(({ event }) => event.outcome === 'failed')).toBe(true);
    ctx.evidence.failure = { record: failed, report };
    return;
  }

  if (scenario === 'approval-stop' || scenario === 'completed-effect') {
    await ctx.provider.enqueue({
      kind: 'tool',
      name: 'sys_write_file',
      args: { path: ctx.effectPath, content: 'STOP_APPROVED_EFFECT_CANARY' },
    });
    if (scenario === 'completed-effect')
      await ctx.provider.enqueue({
        kind: 'text',
        partial: 'Completed write retained. ',
        text: 'late continuation',
        hold: true,
      });
    await submit(ctx);
    await expect(ctx.page.getByTestId('approval-card')).toHaveCount(1);
    const waiting = await waitForState(ctx, ['waiting_for_approval']);
    expect(ctx.readEffect()).toBe('original-safe-fixture');
    const approval = ctx.snapshot().approvals[0];
    const binding = ctx.snapshot().executions.find((row) => row.execution_id === approval?.run_id);
    expect(binding?.run_id).toBe(waiting.id);
    expect(approval?.run_id).not.toBe(waiting.id);
    if (!approval) throw new Error('Expected approval binding');
    if (scenario === 'approval-stop') {
      const report = await ctx.exportReport('waiting');
      if (report) expect(report.events.some(({ event }) => event.phase === 'approval')).toBe(true);
      const stopped = await clickStop(ctx);
      await expect(
        ctx.page.getByTestId('approval-card').getByRole('button', { name: 'Approve', exact: true }),
      ).toHaveCount(0);
      const decision = await ctx.raw(`approval-requests/${approval.id}/approve`, {
        method: 'POST',
        body: '{}',
      });
      expect([404, 409]).toContain(decision.status);
      const resume = await ctx.raw(`sessions/${ctx.sessionId}/resume`, {
        method: 'POST',
        body: JSON.stringify({ approvalRequestId: approval.id }),
      });
      expect([404, 409]).toContain(resume.status);
      expect(ctx.readEffect()).toBe('original-safe-fixture');
      expect(ctx.provider.requests).toHaveLength(1);
      await reopen(ctx);
      await expect(ctx.page.getByRole('status').filter({ hasText: 'Run stopped.' })).toBeVisible();
      expect((await current(ctx))?.id).toBe(stopped.id);
      await verifyStopReport(ctx, 'stopped', stopped.id);
      return;
    }
    await ctx.page
      .getByTestId('approval-card')
      .getByRole('button', { name: 'Approve', exact: true })
      .click();
    await expect.poll(() => ctx.provider.requests.length).toBe(2);
    expect(ctx.readEffect()).toBe('STOP_APPROVED_EFFECT_CANARY');
  } else {
    await ctx.provider.enqueue({
      kind: 'text',
      partial: 'Earlier partial response. ',
      text: 'late continuation',
      hold: true,
    });
    await submit(ctx);
    await expect.poll(() => ctx.provider.requests.length).toBe(1);
  }
  const delayedIndex = scenario === 'completed-effect' ? 1 : 0;
  await expect
    .poll(() => ctx.provider.ledger.find((row) => row.index === delayedIndex)?.partialSent)
    .toBe(true);
  const running = await waitForState(ctx, ['running']);
  if (scenario === 'provider-stop')
    await switchAwayAndBackWithoutCancelling(ctx, running, delayedIndex);
  const stranger = await ctx.api<{ id: string }>('sessions', {
    method: 'POST',
    body: JSON.stringify({ agentId: ctx.agentId, mode: 'project', projectId: ctx.projectId }),
  });
  const wrong = await ctx.raw(`sessions/${stranger.id}/runs/${running.id}/stop`, {
    method: 'POST',
    body: '{}',
  });
  expect(wrong.status).toBe(404);
  expect((await current(ctx))?.state).toBe('running');
  const stopped = await clickStop(ctx);
  await expect
    .poll(() => ctx.provider.ledger.find((row) => row.index === delayedIndex)?.disconnected)
    .toBe(true);
  ctx.provider.release(delayedIndex);
  expect(ctx.provider.ledger[delayedIndex]?.completed).toBe(false);
  expect(ctx.provider.requests).toHaveLength(delayedIndex + 1);
  expect(ctx.readEffect()).toBe(
    scenario === 'completed-effect' ? 'STOP_APPROVED_EFFECT_CANARY' : 'original-safe-fixture',
  );
  expect(
    ctx
      .snapshot()
      .messages.some(
        (row) =>
          row.role === 'assistant' &&
          row.content.includes(
            scenario === 'completed-effect'
              ? 'Completed write retained.'
              : 'Earlier partial response.',
          ),
      ),
  ).toBe(true);
  await reopen(ctx);
  await expect(ctx.page.getByRole('status').filter({ hasText: 'Run stopped.' })).toBeVisible();
  expect(ctx.provider.requests).toHaveLength(delayedIndex + 1);
  await verifyStopReport(ctx, 'stopped', stopped.id);
  await ctx.provider.enqueue({ kind: 'text', text: 'New independent request completed.' });
  await submit(ctx, 'Fresh explicit request after Stop');
  await expect(
    ctx.page.getByText('New independent request completed.', { exact: true }),
  ).toBeVisible();
  const next = await waitForState(ctx, ['completed']);
  expect(next.id).not.toBe(stopped.id);
  const oldAgain = await ctx.api<RunControlRecord>(
    `sessions/${ctx.sessionId}/runs/${stopped.id}/stop`,
    { method: 'POST', body: '{}' },
  );
  expect(oldAgain.id).toBe(stopped.id);
  expect((await current(ctx))?.id).toBe(next.id);
  expect(ctx.provider.requests).toHaveLength(delayedIndex + 2);
  expect(ctx.provider.errors).toEqual([]);
  ctx.evidence.independentRun = next;
}

export const stopSnapshotSource = `
import {openDatabase} from './packages/db/dist/index.js';
const {sqlite}=openDatabase(process.env.SQLITE_PATH ?? process.argv[2]);
try { const id=process.argv[1]; console.log(JSON.stringify({
 messages:sqlite.prepare('select role,content from messages where session_id=? order by created_at_ms').all(id),
 approvals:sqlite.prepare('select id,status,run_id from approval_requests where session_id=?').all(id),
 runs:sqlite.prepare('select id,state,reason,version from controlled_runs where session_id=? order by created_at_ms').all(id),
 attempts:sqlite.prepare('select a.run_id,a.kind,a.outcome from run_attempts a join controlled_runs r on a.run_id=r.id where r.session_id=?').all(id),
 executions:sqlite.prepare('select e.execution_id,e.run_id from run_executions e join controlled_runs r on e.run_id=r.id where r.session_id=?').all(id)
})); } finally {sqlite.close();}
`;
