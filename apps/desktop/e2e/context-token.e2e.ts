import { expect, test, type TestInfo } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertContextTokenWire,
  CONTEXT_BUDGET_MESSAGE,
  CONTEXT_INPUT,
  CONTEXT_MARKERS,
  createContextTokenAgent,
  createContextTokenFixture,
  exportContextTokenReport,
  launchContextTokenFixture,
  openContextTokenProject,
  readContextTokenApi,
  recordContextTokenEvidence,
  reopenContextTokenSession,
  removeContextTokenFixture,
  sendContextTokenMessage,
  selectContextTokenModel,
  snapshotContextTokenDb,
  snapshotContextTokenDiagnosticStore,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';
import {
  startContextTokenProvider,
  type ContextTokenProviderReply,
} from './support/contextTokenProvider.js';

type Journey = {
  fixture: ContextTokenFixture;
  app: ElectronApplication;
  page: Page;
  sessionId?: string;
  evidence: Record<string, unknown>;
  replies: ContextTokenProviderReply[];
};

async function journey(info: TestInfo, name: string, run: (ctx: Journey) => Promise<void>) {
  const replies: ContextTokenProviderReply[] = [];
  const provider = await startContextTokenProvider(replies);
  let fixture: ContextTokenFixture | undefined;
  let ctx: Journey | undefined;
  let tracing = false;
  let passed = false;
  const failures: unknown[] = [];
  try {
    fixture = await createContextTokenFixture(provider);
    const reports = ['first-report.json', 'second-report.json'].map((file) =>
      join(fixture!.root, file),
    );
    const app = await launchContextTokenFixture(fixture, reports);
    ctx = {
      fixture,
      app,
      page: await app.firstWindow(),
      evidence: { reports, gitIsolation: fixture.gitIsolation },
      replies,
    };
    await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracing = true;
    await run(ctx);
    passed = true;
  } catch (error) {
    failures.push(error);
    if (ctx?.sessionId && !ctx.page.isClosed()) {
      try {
        // Failure diagnosis through the existing governed BFF route, never a replacement
        // for the native Save As acceptance assertion or its capability boundary.
        ctx.evidence.diagnosticBffProbe = await ctx.page.evaluate(async (sessionId) => {
          const response = await fetch('/api/diagnostics/report', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ scope: { sessionId } }),
            signal: AbortSignal.timeout(10_000),
          });
          return { status: response.status, body: (await response.json()) as unknown };
        }, ctx.sessionId);
        const live = snapshotContextTokenDiagnosticStore(ctx.fixture, ctx.sessionId);
        ctx.evidence.liveDiagnosticStore = live;
        if (live.firstRequestId) {
          // A persisted ingress scope exposes live collector health through the existing
          // protected BFF when the required session scope is unavailable. Diagnosis only.
          ctx.evidence.diagnosticIngressProbe = await ctx.page.evaluate(async (requestId) => {
            const response = await fetch('/api/diagnostics/report', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ scope: { requestId } }),
              signal: AbortSignal.timeout(10_000),
            });
            const body = (await response.json()) as unknown;
            if (!response.ok) return { status: response.status };
            const report = body as { coverage?: unknown };
            return { status: response.status, coverage: report.coverage };
          }, live.firstRequestId);
        }
      } catch (probeError) {
        ctx.evidence.diagnosticBffProbe = {
          error: probeError instanceof Error ? probeError.message.slice(0, 500) : 'probe_failed',
        };
      }
    }
  } finally {
    if (fixture) {
      if (ctx && !ctx.page.isClosed()) {
        try {
          ctx.evidence.nativeReportTransport = await ctx.app.evaluate(
            () =>
              (
                globalThis as typeof globalThis & {
                  __contextTokenNativeTransport?: Array<{
                    status?: number;
                    errorName?: string;
                    errorCode?: string;
                  }>;
                }
              ).__contextTokenNativeTransport ?? [],
          );
        } catch (error) {
          failures.push(error);
        }
      }
      try {
        if (ctx?.sessionId) ctx.evidence.finalDb = snapshotContextTokenDb(fixture, ctx.sessionId);
      } catch (error) {
        failures.push(error);
      }
      const artifacts: Promise<unknown>[] = [];
      if (ctx && tracing && !ctx.page.isClosed())
        artifacts.push(
          ctx.app
            .context()
            .tracing.stop({ path: info.outputPath('context-token-trace.zip') })
            .then(() =>
              info.attach('context-token-trace', {
                path: info.outputPath('context-token-trace.zip'),
                contentType: 'application/zip',
              }),
            ),
        );
      artifacts.push(
        recordContextTokenEvidence(
          info,
          fixture,
          name,
          {
            assertionsPassed: passed,
            failureDetails: failures.map((error) =>
              error instanceof Error ? error.message.slice(0, 3000) : String(error).slice(0, 3000),
            ),
            ...ctx?.evidence,
          },
          ctx && !ctx.page.isClosed() ? ctx.page : undefined,
        ),
      );
      const artifactResults = await Promise.allSettled(artifacts);
      for (const result of artifactResults)
        if (result.status === 'rejected') failures.push(result.reason);
      let cleanupFailed = false;
      try {
        await ctx?.app.close();
        const diagnosticDb = join(fixture.runtimeDir, 'data', 'diagnostics.sqlite');
        if (!passed && existsSync(diagnosticDb)) {
          const destination = info.outputPath('failed-owned-diagnostics.sqlite');
          copyFileSync(diagnosticDb, destination);
          await info.attach('failed-owned-diagnostics', {
            path: destination,
            contentType: 'application/vnd.sqlite3',
          });
          // Preserve any uncheckpointed owned store pages beside the copied database.
          for (const suffix of ['-wal', '-shm']) {
            if (existsSync(diagnosticDb + suffix)) {
              copyFileSync(diagnosticDb + suffix, destination + suffix);
              await info.attach(`failed-owned-diagnostics${suffix}`, {
                path: destination + suffix,
                contentType: 'application/octet-stream',
              });
            }
          }
        }
      } catch (error) {
        failures.push(error);
        cleanupFailed = true;
      }
      try {
        await provider.close();
      } catch (error) {
        failures.push(error);
        cleanupFailed = true;
      }
      if (!cleanupFailed) removeContextTokenFixture(fixture);
    } else {
      try {
        await provider.close();
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      `Context-token journey ${name} failed: ${failures.map((error) => (error instanceof Error ? error.message : String(error))).join('\n')}`,
    );
}

function contextDecisions(report: Awaited<ReturnType<typeof exportContextTokenReport>>) {
  return report.events.filter((row) => row.event.phase === 'context').map((row) => row.event);
}

async function attachReport(info: TestInfo, destination: string, name: string) {
  await info.attach(name, { path: destination, contentType: 'application/json' });
}

// Real managed desktop/BFF/API/SQLite/tool dispatch; only external model and Save As destination are doubled.
test('context/token: long Project history stays atomic through a real multi-tool loop', async () => {
  test.setTimeout(120_000);
  await journey(test.info(), 'long-history-tool-loop', async (ctx) => {
    const { fixture, page, replies } = ctx;
    const firstFile = join(fixture.projectDir, 'first.txt');
    const secondFile = join(fixture.projectDir, 'second.txt');
    writeFileSync(firstFile, 'PRIVATE_TOOL_RESULT_CANARY first disposable text\n');
    writeFileSync(secondFile, 'Second disposable text\n');
    replies.push(
      {
        kind: 'tools',
        calls: [
          { id: 'current-read-a', name: 'sys_read_file', args: { path: firstFile } },
          { id: 'current-read-b', name: 'sys_read_file', args: { path: secondFile } },
        ],
      },
      {
        kind: 'tools',
        calls: [{ id: 'current-read-c', name: 'sys_read_file', args: { path: secondFile } }],
      },
      { kind: 'text', text: 'Context-token long journey complete.' },
    );
    const agent = await createContextTokenAgent(fixture);
    const session = await openContextTokenProject(page, fixture, agent);
    ctx.sessionId = session.id;
    const before = snapshotContextTokenDb(fixture, session.id, { projectId: session.projectId });
    await reopenContextTokenSession(page, fixture, session);
    await expect(page.getByRole('combobox', { name: 'Active agent' })).toContainText(agent.name);
    await selectContextTokenModel(page);
    // Restoration includes actual profile/session binding and the retained-history request.
    await expect(page.getByText('Old completed answer 7', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const prompt =
      'CT_CURRENT_REQUEST_CANARY read both disposable files, then check the second again.';
    await sendContextTokenMessage(page, prompt);
    await expect(
      page.getByText('Context-token long journey complete.', { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
    expect(fixture.provider.errors).toEqual([]);
    expect(fixture.provider.requests).toHaveLength(3);
    const wireEstimates = assertContextTokenWire(fixture.provider.requests);
    for (const request of fixture.provider.requests) {
      const captured = JSON.stringify(request.messages);
      for (const marker of CONTEXT_MARKERS) expect(captured).toContain(marker);
      expect(captured).toContain(prompt);
      expect(request.messages.length).toBeLessThan(before.messages.length);
    }
    for (const id of ['current-read-a', 'current-read-b']) {
      expect(
        fixture.provider.requests[1]!.messages.some(
          (row) => row.role === 'tool' && row.tool_call_id === id,
        ),
      ).toBe(true);
      expect(
        fixture.provider.requests[2]!.messages.some(
          (row) => row.role === 'tool' && row.tool_call_id === id,
        ),
      ).toBe(true);
    }
    expect(
      fixture.provider.requests[2]!.messages.some((row) => row.tool_call_id === 'current-read-c'),
    ).toBe(true);
    const after = snapshotContextTokenDb(fixture, session.id);
    for (const original of before.messages)
      expect(after.messages.find((row) => row.id === original.id)).toEqual(original);
    expect(
      after.audits.filter((row) => row.tool_name === 'sys_read_file' && row.status === 'success'),
    ).toHaveLength(3);
    expect(readFileSync(firstFile, 'utf8')).toBe(
      'PRIVATE_TOOL_RESULT_CANARY first disposable text\n',
    );
    expect(
      after.messages.filter(
        (row) => row.role === 'assistant' && row.content === 'Context-token long journey complete.',
      ),
    ).toHaveLength(1);
    const destination = join(fixture.root, 'first-report.json');
    const report = await exportContextTokenReport(page, destination, [
      fixture.root,
      prompt,
      ...CONTEXT_MARKERS,
      'PRIVATE_TOOL_RESULT_CANARY',
      'OLD_RESULT_CANARY',
    ]);
    expect(report.summary).toContain('local context admission windowed');
    expect(report.summary).toContain('estimated input');
    expect(report.summary).toContain('provider-reported input/output');
    expect(report.scope).toEqual({ sessionId: session.id });
    expect(contextDecisions(report)).toHaveLength(3);
    expect(
      contextDecisions(report).map((event) => event.contextDecision!.estimatedInputAfter),
    ).toEqual(wireEstimates);
    for (const event of contextDecisions(report)) {
      expect(event.outcome).toBe('succeeded');
      expect(event.contextDecision).toMatchObject({
        reason: 'windowed',
        configuredInputTokens: CONTEXT_INPUT,
        outputCap: 128,
      });
      expect(event.contextDecision!.omittedGroups).toBeGreaterThan(0);
      expect(event.contextDecision!.estimatedInputAfter).toBeLessThanOrEqual(
        event.contextDecision!.effectiveInputTokens,
      );
    }
    expect(
      report.events.filter((row) => row.event.phase === 'model' && row.event.outcome === 'started'),
    ).toHaveLength(3);
    await attachReport(test.info(), destination, 'long-success-diagnostic-report');
    ctx.evidence = {
      ...ctx.evidence,
      beforeDb: before,
      afterDb: after,
      diagnosticReport: report,
      contextWindow: agent.contextWindow,
    };
  });
});

test('context/token: oversized required request halts before the provider and composer recovers', async () => {
  test.setTimeout(120_000);
  await journey(test.info(), 'required-overflow-recovery', async (ctx) => {
    const { fixture, page } = ctx;
    ctx.replies.push({ kind: 'text', text: 'Context-token recovery complete.' });
    const untouched = join(fixture.projectDir, 'untouched.txt');
    writeFileSync(untouched, 'Original untouched effect\n');
    const agent = await createContextTokenAgent(fixture);
    const session = await openContextTokenProject(page, fixture, agent);
    ctx.sessionId = session.id;
    const oversized = 'OVERSIZED_PRIVATE_PROMPT_CANARY ' + 'x'.repeat(100_000);
    await sendContextTokenMessage(page, oversized);
    await expect(page.getByText(CONTEXT_BUDGET_MESSAGE, { exact: true }).last()).toBeVisible();
    await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
    expect(fixture.provider.requests).toHaveLength(0);
    const rejected = snapshotContextTokenDb(fixture, session.id);
    expect(rejected.audits).toHaveLength(0);
    expect(rejected.approvals).toHaveLength(0);
    expect(rejected.messages.some((row) => row.role === 'user' && row.content === oversized)).toBe(
      true,
    );
    expect(readFileSync(untouched, 'utf8')).toBe('Original untouched effect\n');
    const rejectedPath = join(fixture.root, 'first-report.json');
    const rejectedReport = await exportContextTokenReport(page, rejectedPath, [
      fixture.root,
      'OVERSIZED_PRIVATE_PROMPT_CANARY',
    ]);
    expect(rejectedReport.summary).toContain('local context admission required_overflow');
    expect(rejectedReport.summary).toContain('this decision is not a provider attempt');
    expect(contextDecisions(rejectedReport)).toHaveLength(1);
    expect(contextDecisions(rejectedReport)[0]).toMatchObject({
      outcome: 'failed',
      errorCode: 'context_budget_exceeded',
      contextDecision: { reason: 'required_overflow' },
    });
    expect(
      rejectedReport.events.filter(
        (row) => row.event.phase === 'model' && row.event.outcome === 'started',
      ),
    ).toHaveLength(0);
    expect(
      rejectedReport.events.some(
        (row) => row.event.phase === 'request' && row.event.outcome === 'failed',
      ),
    ).toBe(true);
    await attachReport(test.info(), rejectedPath, 'overflow-failure-diagnostic-report');
    await sendContextTokenMessage(
      page,
      'RECOVERY_CURRENT_REQUEST_CANARY respond briefly without file effects.',
    );
    await expect(
      page.getByText('Context-token recovery complete.', { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
    expect(fixture.provider.errors).toEqual([]);
    expect(fixture.provider.requests).toHaveLength(1);
    const wireEstimates = assertContextTokenWire(fixture.provider.requests);
    expect(JSON.stringify(fixture.provider.requests[0]!.messages)).not.toContain(oversized);
    const recoveryPath = join(fixture.root, 'second-report.json');
    const recoveryReport = await exportContextTokenReport(page, recoveryPath, [
      fixture.root,
      'OVERSIZED_PRIVATE_PROMPT_CANARY',
      'RECOVERY_CURRENT_REQUEST_CANARY',
    ]);
    expect(
      contextDecisions(recoveryReport)
        .filter((event) => event.outcome === 'succeeded')
        .map((event) => event.contextDecision!.estimatedInputAfter),
    ).toEqual(wireEstimates);
    expect(
      recoveryReport.events.filter(
        (row) => row.event.phase === 'model' && row.event.outcome === 'started',
      ),
    ).toHaveLength(1);
    expect(snapshotContextTokenDb(fixture, session.id).audits).toHaveLength(0);
    expect(readFileSync(untouched, 'utf8')).toBe('Original untouched effect\n');
    await attachReport(test.info(), recoveryPath, 'recovered-success-diagnostic-report');
    ctx.evidence = {
      ...ctx.evidence,
      rejectedDb: rejected,
      rejectedReport,
      recoveryReport,
      contextWindow: agent.contextWindow,
    };
  });
});

test('context/token: a real Ask write survives reasoning overflow, restart and replay denial', async () => {
  test.setTimeout(150_000);
  await journey(test.info(), 'approved-effect-overflow-restart', async (ctx) => {
    const { fixture, page } = ctx;
    const effect = join(fixture.projectDir, 'approved-effect.txt');
    const contents = 'PRIVATE_TOOL_ARGS_CANARY\n' + 'a'.repeat(70_000);
    writeFileSync(effect, 'Original before approval\n');
    ctx.replies.push({
      kind: 'tools',
      calls: [
        {
          id: 'approved-write-once',
          name: 'sys_write_file',
          args: { path: effect, content: contents },
        },
      ],
    });
    // The synthetic model has an intentionally large output allowance for complete arguments.
    // This does not claim live capacity or output enforcement by the external fixture.
    const agent = await createContextTokenAgent(fixture, 24_000);
    const session = await openContextTokenProject(page, fixture, agent);
    ctx.sessionId = session.id;
    await sendContextTokenMessage(
      page,
      'APPROVED_EFFECT_PROMPT_CANARY write the reviewed disposable file once.',
    );
    const card = page.getByTestId('approval-card');
    await expect(card).toHaveCount(1);
    await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
    expect(readFileSync(effect, 'utf8')).toBe('Original before approval\n');
    const pending = snapshotContextTokenDb(fixture, session.id);
    expect(pending.approvals).toHaveLength(1);
    expect(pending.approvals[0]!.status).toBe('pending');
    expect(pending.audits.filter((row) => row.status === 'success')).toHaveLength(0);
    expect(fixture.provider.requests).toHaveLength(1);
    await card.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(card).toContainText('Approved action completed');
    await expect(page.getByText(CONTEXT_BUDGET_MESSAGE, { exact: true }).last()).toBeVisible();
    await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
    expect(readFileSync(effect, 'utf8')).toBe(contents);
    expect(fixture.provider.requests).toHaveLength(1);
    expect(fixture.provider.errors).toEqual([]);
    const wireEstimates = assertContextTokenWire(fixture.provider.requests, CONTEXT_INPUT, 24_000);
    const completed = snapshotContextTokenDb(fixture, session.id);
    expect(completed.approvals).toHaveLength(1);
    expect(completed.approvals[0]).toMatchObject({
      status: 'approved',
      resumed_at_ms: expect.any(Number),
    });
    expect(
      completed.audits.filter(
        (row) => row.tool_name === 'sys_write_file' && row.status === 'success',
      ),
    ).toHaveLength(1);
    expect(completed.messages.some((row) => row.role === 'tool')).toBe(true);
    const initialPath = join(fixture.root, 'first-report.json');
    const initialReport = await exportContextTokenReport(page, initialPath, [
      fixture.root,
      'APPROVED_EFFECT_PROMPT_CANARY',
      'PRIVATE_TOOL_ARGS_CANARY',
    ]);
    expect(
      contextDecisions(initialReport)
        .filter((event) => event.outcome === 'succeeded')
        .map((event) => event.contextDecision!.estimatedInputAfter),
    ).toEqual(wireEstimates);
    expect(
      contextDecisions(initialReport).some(
        (event) => event.contextDecision?.reason === 'required_overflow',
      ),
    ).toBe(true);
    const rejectedRun = contextDecisions(initialReport).find(
      (event) => event.contextDecision?.reason === 'required_overflow',
    )!.runId;
    expect(
      initialReport.events.filter(
        (row) =>
          row.event.runId === rejectedRun &&
          row.event.phase === 'model' &&
          row.event.outcome === 'started',
      ),
    ).toHaveLength(0);
    await attachReport(test.info(), initialPath, 'approved-effect-overflow-report');
    const trace = test.info().outputPath('before-restart-trace.zip');
    await ctx.app.context().tracing.stop({ path: trace });
    await test
      .info()
      .attach('before-restart-trace', { path: trace, contentType: 'application/zip' });
    await ctx.app.close();
    const restartedPath = join(fixture.root, 'second-report.json');
    ctx.app = await launchContextTokenFixture(fixture, [restartedPath]);
    await ctx.app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    ctx.page = await ctx.app.firstWindow();
    await reopenContextTokenSession(ctx.page, fixture, session);
    await expect(
      ctx.page.getByText('APPROVED_EFFECT_PROMPT_CANARY write the reviewed disposable file once.', {
        exact: true,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(ctx.page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
    const restartedReport = await exportContextTokenReport(ctx.page, restartedPath, [
      fixture.root,
      'APPROVED_EFFECT_PROMPT_CANARY',
      'PRIVATE_TOOL_ARGS_CANARY',
    ]);
    expect(restartedReport.scope).toEqual(initialReport.scope);
    expect(restartedReport.events.map((row) => row.event.eventId)).toEqual(
      expect.arrayContaining(initialReport.events.map((row) => row.event.eventId)),
    );
    const replay = await fetch(
      `http://127.0.0.1:${fixture.backendPort}/v1/sessions/${session.id}/resume`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvalRequestId: completed.approvals[0]!.id }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    // The existing API acknowledges an already-resumed approval with its cached record.
    // Independent state/effect assertions below prove that acknowledgement does not replay it.
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      data: {
        id: completed.approvals[0]!.id,
        status: 'approved',
        resumedAtMs: completed.approvals[0]!.resumed_at_ms,
      },
    });
    const replayed = snapshotContextTokenDb(fixture, session.id);
    expect(replayed.audits).toEqual(completed.audits);
    expect(replayed.messages).toEqual(completed.messages);
    expect(readFileSync(effect, 'utf8')).toBe(contents);
    expect(fixture.provider.requests).toHaveLength(1);
    await attachReport(test.info(), restartedPath, 'restarted-durable-failure-report');
    expect(
      await readContextTokenApi(fixture, `sessions/${session.id}/working-memory`),
    ).not.toBeNull();
    ctx.evidence = {
      ...ctx.evidence,
      pendingDb: pending,
      completedDb: completed,
      replayedDb: replayed,
      initialReport,
      restartedReport,
      contextWindow: agent.contextWindow,
      replayStatus: replay.status,
      actualFileBytes: Buffer.byteLength(readFileSync(effect, 'utf8')),
    };
  });
});
