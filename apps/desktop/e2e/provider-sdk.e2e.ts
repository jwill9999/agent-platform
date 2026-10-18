import { expect, test, type TestInfo } from '@playwright/test';
import { DiagnosticReportSchema } from '@agent-platform/contracts';
import type { ElectronApplication, Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  providerSdkSourceHashes,
  providerSdkStorageProof,
} from './support/provider-sdk-evidence.js';
import {
  SDK_FIXTURE_KEY,
  SDK_PRIVATE_MARKER,
  startProviderSdkFixture,
} from '../../../e2e/support/provider-sdk.mjs';
import {
  openProviderSdkModels,
  saveProviderSdkConfig,
  selectProviderSdkModel,
  sendProviderSdkChat,
  testProviderSdkConfig,
  type SdkApi,
  type SdkSavedConfig,
} from '../../../e2e/support/provider-sdk-ui.js';
import {
  createContextTokenFixture,
  launchContextTokenFixture,
  readContextTokenApi,
  removeContextTokenFixture,
  snapshotContextTokenDb,
  exportContextTokenReport,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';

type State = {
  fixture: ContextTokenFixture;
  app: ElectronApplication;
  page: Page;
  api: SdkApi;
  provider: Awaited<ReturnType<typeof startProviderSdkFixture>>;
  configs: SdkSavedConfig[];
  session?: { id: string; projectId: string };
  evidence: Record<string, unknown>;
};

async function withProviderSdkApp(info: TestInfo, run: (state: State) => Promise<void>) {
  const provider = await startProviderSdkFixture();
  // Reuse the proven managed runtime/profile/Save As/loopback guard. Its legacy
  // request array is deliberately empty: this journey uses the independent native recorder.
  let fixture: ContextTokenFixture | undefined;
  let state: State | undefined;
  let scenarioPassed = false;
  const failures: unknown[] = [];
  try {
    const ownedFixture = await createContextTokenFixture({
      baseURL: provider.baseURL,
      requests: [],
      errors: provider.errors,
      close: provider.close,
    });
    fixture = ownedFixture;
    const report = join(ownedFixture.root, 'provider-sdk-report.json');
    const app = await launchContextTokenFixture(ownedFixture, [report]);
    state = {
      fixture: ownedFixture,
      app,
      page: await app.firstWindow(),
      api: <T>(route: string, init?: RequestInit) =>
        readContextTokenApi<T>(ownedFixture, route, init),
      provider,
      configs: [],
      evidence: { report },
    };
    await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    await run(state);
    scenarioPassed = true;
  } catch (error) {
    failures.push(error);
  } finally {
    failures.push(...(await closeProviderSdkApp(state, provider, info)));
    if (fixture) {
      failures.push(
        ...(await saveProviderSdkEvidence(
          state,
          fixture,
          provider,
          info,
          scenarioPassed,
          failures.length,
        )),
      );
      removeContextTokenFixture(fixture);
    } else
      await info.attach('provider-sdk-setup-failed', {
        body: JSON.stringify({
          scenarioPassed: false,
          qualified: false,
          setup: 'fixture_creation_failed',
          providerClosed: true,
        }),
        contentType: 'application/json',
      });
  }
  if (failures.length)
    throw new AggregateError(failures, 'Provider SDK native journey failed', {
      cause: failures[0],
    });
}

async function closeProviderSdkApp(
  state: State | undefined,
  provider: State['provider'],
  info: TestInfo,
) {
  const failures: unknown[] = [];
  if (!state) {
    try {
      await provider.close();
    } catch (error) {
      failures.push(error);
    }
    return failures;
  }
  try {
    await state.app
      .context()
      .tracing.stop({ path: info.outputPath('provider-sdk-native-trace.zip') });
    await info.attach('provider-sdk-native-trace', {
      path: info.outputPath('provider-sdk-native-trace.zip'),
      contentType: 'application/zip',
    });
  } catch (error) {
    failures.push(error);
  }
  const shut = await Promise.allSettled([state.app.close(), provider.close()]);
  state.evidence.shutdown = shut.map((row) => row.status);
  for (const row of shut) if (row.status === 'rejected') failures.push(row.reason);
  return failures;
}
async function saveProviderSdkEvidence(
  state: State | undefined,
  fixture: ContextTokenFixture,
  provider: State['provider'],
  info: TestInfo,
  scenarioPassed: boolean,
  priorFailures: number,
) {
  const failures: unknown[] = [];
  const { logs, logPrivacyViolation } = providerSdkPublicLogs(fixture);
  if (logPrivacyViolation)
    failures.push(new Error('Private provider data leaked into application logs'));
  const evidence = {
    scenarioPassed,
    sourceRevision: execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    sourceHashes: providerSdkSourceHashes(),
    requests: provider.requests,
    errors: provider.errors,
    ...state?.evidence,
    logs,
    logPrivacyViolation,
    limits: [
      'Real native Electron/managed Node API/BFF/SQLite/harness/SDK; external provider HTTP and Save As destination are deterministic boundaries.',
      'No live credentials, paid model calls, model quality or owner-profile readiness established.',
    ],
  };
  const text = JSON.stringify(evidence, null, 2).replaceAll(fixture.root, '<disposable-root>');
  if (text.includes(SDK_PRIVATE_MARKER))
    failures.push(new Error('Private provider data leaked into public evidence'));
  const safeText = JSON.stringify(
    { ...evidence, qualified: scenarioPassed && priorFailures === 0 && failures.length === 0 },
    null,
    2,
  )
    .replaceAll(fixture.root, '<disposable-root>')
    .replaceAll(SDK_PRIVATE_MARKER, '<private-data-leak>');
  const file = info.outputPath('provider-sdk-native-evaluation.json');
  writeFileSync(file, safeText);
  await info.attach('provider-sdk-native-evaluation', {
    path: file,
    contentType: 'application/json',
  });
  return failures;
}

function providerSdkPublicLogs(fixture: ContextTokenFixture) {
  const privateValues = [
    SDK_FIXTURE_KEY,
    SDK_PRIVATE_MARKER,
    'PRIVATE_SDK_ERROR_CANARY',
    'PROVIDER_SDK_PROMPT_CANARY',
    'PROVIDER_SDK_FAILED_PROMPT_CANARY',
    'PROVIDER_SDK_TOOL_PROMPT_CANARY',
    'PROVIDER_SDK_DENIED_PROMPT_CANARY',
    'PROVIDER_SDK_INTERRUPTED_PROMPT_CANARY',
  ];
  let logPrivacyViolation = false;
  const logs = Object.fromEntries(
    ['backend.stdout.log', 'backend.stderr.log', 'desktop.stdout.log', 'desktop.stderr.log'].map(
      (name) => {
        const path = join(fixture.runtimeDir, 'logs', name);
        if (!existsSync(path)) return [name, '<unavailable>'];
        const raw = readFileSync(path, 'utf8');
        if (privateValues.some((value) => raw.includes(value))) logPrivacyViolation = true;
        const safe = privateValues
          .reduce(
            (text, value) => text.replaceAll(value, '<private-data-leak>'),
            raw.slice(-64_000),
          )
          .replaceAll(fixture.root, '<disposable-root>');
        return [name, safe];
      },
    ),
  );
  return { logs, logPrivacyViolation };
}

async function project(state: State, config: SdkSavedConfig) {
  const agent = await state.api<{ id: string }>('agents', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Provider SDK native fixture',
      systemPrompt: 'Follow the disposable Project request.',
      modelConfigId: config.id,
      allowedToolIds: [],
      allowedSkillIds: [],
      allowedMcpServerIds: [],
      pluginAllowlist: [],
      executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 30_000 },
    }),
  });
  const registered = await state.api<{ project: { id: string } }>('projects/desktop/register', {
    method: 'POST',
    headers: { 'x-agent-platform-desktop-bridge': '1' },
    body: JSON.stringify({
      name: 'Provider SDK disposable Project',
      path: state.fixture.projectDir,
    }),
  });
  const session = await state.api<{ id: string }>('sessions', {
    method: 'POST',
    body: JSON.stringify({ agentId: agent.id, mode: 'project', projectId: registered.project.id }),
  });
  state.session = { id: session.id, projectId: registered.project.id };
  await state.page.goto(
    `http://127.0.0.1:${state.fixture.rendererPort}/?projectId=${registered.project.id}&sessionId=${session.id}`,
  );
  const input = state.page.getByPlaceholder('Ask about this Project...');
  await expect(pageReady(state.page)).toBeVisible();
  await expect(
    state.page.getByRole('combobox', { name: 'Active agent', exact: true }),
  ).toContainText('Provider SDK native fixture');
  await expect(input).toBeEnabled();
  await input.fill('/init');
  await expect(state.page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
  await input.press('Enter');
  await state.page.getByRole('button', { name: 'Approve instructions', exact: true }).click();
  await expect(state.page.getByText('Project instructions approved').last()).toBeVisible();
  await selectProviderSdkModel(state.page, config);
  return state.session;
}

function pageReady(page: Page) {
  return page
    .getByRole('status')
    .filter({ hasText: 'Press Enter to send, Shift+Enter for new line' });
}

async function reopen(state: State, expected: 'ready' | 'interrupted' = 'ready') {
  const session = state.session!;
  const messages = await state.api<Array<{ role: string; content: string }>>(
    `sessions/${session.id}/messages`,
  );
  const retained = messages.filter(
    (row) => row.role === 'assistant' && row.content.startsWith('SDK '),
  );
  const last = retained.at(-1)?.content;

  await state.page.goto(
    `http://127.0.0.1:${state.fixture.rendererPort}/?projectId=${session.projectId}`,
  );
  await state.page.getByRole('button', { name: 'Open sessions menu', exact: true }).click();
  await state.page.getByRole('menuitem', { name: /Provider SDK retained session/ }).click();
  if (last)
    await expect(state.page.getByText(last, { exact: true })).toHaveCount(
      retained.filter((row) => row.content === last).length,
    );
  if (expected === 'ready') await expect(pageReady(state.page)).toBeVisible();
  else
    await expect(
      state.page.getByRole('alert').filter({
        hasText: 'This run is stopped or interrupted; its approval cannot dispatch further work.',
      }),
    ).toBeVisible();
  await expect(
    state.page.getByRole('combobox', { name: 'Active agent', exact: true }),
  ).toContainText('Provider SDK native fixture');
}

async function restartProviderSdkApp(
  state: State,
  trace: string,
  expected: 'ready' | 'interrupted' = 'ready',
) {
  await state.app.context().tracing.stop({ path: test.info().outputPath(trace) });
  await test
    .info()
    .attach(trace, { path: test.info().outputPath(trace), contentType: 'application/zip' });
  await state.app.close();
  state.app = await launchContextTokenFixture(state.fixture, [String(state.evidence.report)]);
  await state.app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
  state.page = await state.app.firstWindow();
  await reopen(state, expected);
}

test('native saved provider configurations and history survive restart with honest failure, recovery and durable diagnostic export', async () => {
  test.setTimeout(180_000);
  await withProviderSdkApp(test.info(), async (state) => {
    await openProviderSdkModels(state.page);
    for (const family of ['openai', 'openrouter']) {
      const saved = await saveProviderSdkConfig(state.page, state.api, {
        provider: family,
        name: `SDK native ${family}`,
        baseURL: state.provider.baseURL,
      });
      state.configs.push(saved);
      await testProviderSdkConfig(state.page, saved);
    }
    const rejected = await saveProviderSdkConfig(state.page, state.api, {
      provider: 'openai',
      name: 'SDK native rejected',
      baseURL: state.provider.baseURL,
      rejected: true,
    });
    state.configs.push(rejected);
    const rejectedProbe = await testProviderSdkConfig(state.page, rejected, true);
    expect(rejectedProbe.requestId).toMatch(/^[a-f0-9-]{36}$/);
    const probeReport = await state.page.evaluate(async (requestId) => {
      const response = await fetch('/api/diagnostics/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope: { requestId } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Probe diagnostic export failed: ${response.status}`);
      return response.json();
    }, rejectedProbe.requestId);
    const probe = DiagnosticReportSchema.parse(probeReport);
    expect(probe.coverage).toMatchObject({
      durable: true,
      verified: true,
      pending: 0,
      dropped: 0,
      conflicts: 0,
    });
    expect(probe.events.map((row) => row.event)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: 'connection',
          outcome: 'started',
          provider: 'openai',
          modelConfigId: rejected.id,
          attempt: 1,
        }),
        expect.objectContaining({
          phase: 'connection',
          outcome: 'failed',
          providerFailure: 'request',
          modelConfigId: rejected.id,
          attempt: 1,
        }),
      ]),
    );
    const safeProbe = JSON.stringify(probe);
    for (const secret of [SDK_FIXTURE_KEY, SDK_PRIVATE_MARKER, 'PRIVATE_SDK_ERROR_CANARY'])
      expect(safeProbe).not.toContain(secret);
    state.evidence.failedProbeReport = probe;
    const session = await project(state, state.configs[0]!);
    await sendProviderSdkChat(state.page, 'openai', () => state.provider.requests.length);
    await selectProviderSdkModel(state.page, rejected);
    const input = state.page.getByPlaceholder('Ask about this Project...');
    await input.fill('PROVIDER_SDK_FAILED_PROMPT_CANARY');
    await input.press('Enter');
    await expect(
      state.page
        .getByText(/provider rejected|request.*not.*accepted|request.*rejected|could not complete/i)
        .last(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(input).toBeEnabled();
    const publicText = await state.page.locator('body').innerText();
    expect(publicText).not.toContain('PRIVATE_SDK_ERROR_CANARY');
    await selectProviderSdkModel(state.page, state.configs[1]!);
    await sendProviderSdkChat(state.page, 'openrouter', () => state.provider.requests.length);
    const record = await state.api<Record<string, unknown>>(`sessions/${session.id}`);
    await state.api(`sessions/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...record, title: 'Provider SDK retained session' }),
    });
    const before = snapshotContextTokenDb(state.fixture, session.id);
    expect(
      before.messages.filter((row) => row.role === 'assistant').map((row) => row.content),
    ).toContain('SDK openrouter completed.');
    await state.app
      .context()
      .tracing.stop({ path: test.info().outputPath('provider-sdk-before-restart.zip') });
    await test.info().attach('provider-sdk-before-restart', {
      path: test.info().outputPath('provider-sdk-before-restart.zip'),
      contentType: 'application/zip',
    });
    await state.app.close();
    state.app = await launchContextTokenFixture(state.fixture, [String(state.evidence.report)]);
    await state.app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    state.page = await state.app.firstWindow();
    await reopen(state);
    await expect(state.page.getByText('SDK openrouter completed.', { exact: true })).toBeVisible();
    const restartedProbe = DiagnosticReportSchema.parse(
      await state.page.evaluate(async (requestId) => {
        const response = await fetch('/api/diagnostics/report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scope: { requestId } }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Restarted probe export failed: ${response.status}`);
        return response.json();
      }, rejectedProbe.requestId),
    );
    expect(restartedProbe.events.map((row) => row.event.eventId)).toEqual(
      expect.arrayContaining(probe.events.map((row) => row.event.eventId)),
    );
    expect(restartedProbe.coverage).toMatchObject({
      durable: true,
      verified: true,
      pending: 0,
      dropped: 0,
      conflicts: 0,
    });
    state.evidence.restartedProbeReport = restartedProbe;

    // Saved configurations/history persist. Per-request picker choice is intentionally
    // not a persisted preference; explicitly select the saved alternative after reopening.
    await selectProviderSdkModel(state.page, state.configs[1]!);
    await sendProviderSdkChat(state.page, 'openrouter', () => state.provider.requests.length);
    state.evidence.pickerRestart =
      'Saved config and history retained; per-request model explicitly reselected after restart.';
    expect((await state.api<SdkSavedConfig>(`model-configs/${state.configs[1]!.id}`)).baseURL).toBe(
      state.configs[1]!.baseURL,
    );
    const report = await exportContextTokenReport(state.page, String(state.evidence.report), [
      SDK_FIXTURE_KEY,
      SDK_PRIVATE_MARKER,
      'PRIVATE_SDK_ERROR_CANARY',
      'PROVIDER_SDK_PROMPT_CANARY',
      'PROVIDER_SDK_FAILED_PROMPT_CANARY',
    ]);
    expect(report.events.length).toBeGreaterThan(0);
    state.evidence.coverage = report.coverage;
    state.evidence.eventCount = report.events.length;
    expect(providerRequests(state).filter((row) => row.model.includes('Rejected'))).toHaveLength(2);
    expect(state.provider.errors).toEqual([]);
  });
});
function providerRequests(state: State) {
  return state.provider.requests;
}

test('native Responses continuation survives completed-history restart while denial and interrupted approval cannot write', async () => {
  test.setTimeout(180_000);
  await withProviderSdkApp(test.info(), async (state) => {
    await openProviderSdkModels(state.page);
    const config = await saveProviderSdkConfig(state.page, state.api, {
      provider: 'openai',
      name: 'SDK native reasoning',
      baseURL: state.provider.baseURL,
    });
    state.configs.push(config);
    const session = await project(state, config);
    const record = await state.api<Record<string, unknown>>(`sessions/${session.id}`);
    await state.api(`sessions/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...record, title: 'Provider SDK retained session' }),
    });
    const target = join(state.fixture.projectDir, 'sdk-approved.txt');
    state.provider.enqueueTool({ path: target, content: 'SDK approved once' });
    const input = state.page.getByPlaceholder('Ask about this Project...');
    await input.fill('PROVIDER_SDK_TOOL_PROMPT_CANARY write the reviewed fixture file');
    await input.press('Enter');
    await expect(
      state.page.getByTestId('approval-card').getByRole('button', { name: 'Approve', exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    expect(existsSync(target)).toBe(false);
    expect(await state.page.locator('body').innerText()).not.toContain(SDK_PRIVATE_MARKER);
    const pending = snapshotContextTokenDb(state.fixture, session.id);
    expect(pending.approvals).toHaveLength(1);
    expect(pending.approvals[0]!.status).toBe('pending');
    const pendingRun = await state.api<{ id: string; state: string }>(
      `sessions/${session.id}/active-run`,
    );
    expect(pendingRun.state).toBe('waiting_for_approval');
    expect(JSON.stringify(pending.messages)).not.toContain(SDK_PRIVATE_MARKER);
    const storage = providerSdkStorageProof(state.fixture, session.id);
    expect(storage.required).toBeGreaterThan(0);
    expect(storage.rows).toBe(storage.required);
    expect(storage.invalid).toBe(0);
    expect(storage.plaintextPresent).toBe(false);
    state.evidence.pendingStorage = storage;
    const publicMessages = await state.api<Array<Record<string, unknown>>>(
      `sessions/${session.id}/messages`,
    );
    for (const row of publicMessages) {
      expect(row).not.toHaveProperty('providerContinuationFormat');
      expect(row).not.toHaveProperty('continuation');
    }
    expect(JSON.stringify(publicMessages)).not.toContain(SDK_PRIVATE_MARKER);
    await state.page
      .getByTestId('approval-card')
      .getByRole('button', { name: 'Approve', exact: true })
      .click();
    await expect(state.page.getByText('SDK openai completed.', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    expect(readFileSync(target, 'utf8')).toBe('SDK approved once');
    await expect(state.page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
    await expect
      .poll(
        async () =>
          (await state.api<{ state: string }>(`sessions/${session.id}/runs/${pendingRun.id}`))
            .state,
      )
      .toBe('completed');
    expect(state.provider.requests.some((row) => row.resumedTool && row.continuationMatched)).toBe(
      true,
    );
    expect(state.provider.requests).toHaveLength(2);
    // A completed conversation can reopen with its encrypted private history. A new
    // request owns a new logical run; this does not revive an old pending approval.
    await restartProviderSdkApp(state, 'provider-sdk-completed-history-restart.zip');
    await selectProviderSdkModel(state.page, config);
    await sendProviderSdkChat(state.page, 'openai', () => state.provider.requests.length);
    expect(state.provider.requests.at(-1)).toMatchObject({
      continuationMatched: true,
      resumedTool: false,
    });
    state.evidence.completedHistoryRestart = true;

    const denied = join(state.fixture.projectDir, 'sdk-denied.txt');
    state.provider.enqueueTool({ path: denied, content: 'Must never be written' });
    const resumedInput = state.page.getByPlaceholder('Ask about this Project...');
    await expect(resumedInput).toBeEnabled();
    await resumedInput.fill('PROVIDER_SDK_DENIED_PROMPT_CANARY request another file');
    await resumedInput.press('Enter');
    const cards = state.page.getByTestId('approval-card');
    await expect(cards.getByRole('button', { name: 'Deny', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await cards.getByRole('button', { name: 'Deny', exact: true }).click();
    await expect(resumedInput).toBeEnabled();
    await expect
      .poll(() =>
        snapshotContextTokenDb(state.fixture, session.id).approvals.some(
          (row) => row.status === 'rejected',
        ),
      )
      .toBe(true);
    expect(existsSync(denied)).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe('SDK approved once');
    const completed = snapshotContextTokenDb(state.fixture, session.id);
    expect(
      completed.audits.filter(
        (row) => row.tool_name === 'sys_write_file' && row.status === 'success',
      ),
    ).toHaveLength(1);
    expect(JSON.stringify(completed.messages)).not.toContain(SDK_PRIVATE_MARKER);
    // Retain the original Stop fence: real process restart interrupts waiting work.
    const interruptedTarget = join(state.fixture.projectDir, 'sdk-interrupted.txt');
    state.provider.enqueueTool({
      path: interruptedTarget,
      content: 'Must never survive the restart fence',
    });
    await resumedInput.fill('PROVIDER_SDK_INTERRUPTED_PROMPT_CANARY request a pending file');
    await resumedInput.press('Enter');
    await expect(cards.getByRole('button', { name: 'Approve', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const beforeRestart = snapshotContextTokenDb(state.fixture, session.id);
    const waiting = beforeRestart.approvals.filter((row) => row.status === 'pending');
    expect(waiting).toHaveLength(1);
    const waitingRun = await state.api<{ id: string; state: string }>(
      `sessions/${session.id}/active-run`,
    );
    expect(waitingRun.state).toBe('waiting_for_approval');
    const requestsBeforeRestart = state.provider.requests.length;
    expect(existsSync(interruptedTarget)).toBe(false);
    await restartProviderSdkApp(
      state,
      'provider-sdk-interrupted-history-restart.zip',
      'interrupted',
    );
    await expect(
      state.page.getByRole('alert').filter({
        hasText: 'This run is stopped or interrupted; its approval cannot dispatch further work.',
      }),
    ).toBeVisible();
    const attempt = await fetch(
      `http://127.0.0.1:${state.fixture.backendPort}/v1/approval-requests/${String(waiting[0]!.id)}/approve`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      },
    );
    const interruptedRun = await state.api<{ state: string; reason: string }>(
      `sessions/${session.id}/runs/${waitingRun.id}`,
    );
    expect(interruptedRun).toMatchObject({ state: 'interrupted', reason: 'process_interrupted' });
    expect(attempt.status).toBe(409);
    expect((await attempt.json()).error.code).toBe('APPROVAL_RUN_STOPPED');
    expect(state.provider.requests).toHaveLength(requestsBeforeRestart);
    const afterRestart = snapshotContextTokenDb(state.fixture, session.id);
    expect(afterRestart.audits).toEqual(beforeRestart.audits);
    expect(existsSync(interruptedTarget)).toBe(false);
    expect(existsSync(denied)).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe('SDK approved once');
    state.evidence.interruptedApproval = {
      status: 409,
      runState: interruptedRun.state,
      reason: interruptedRun.reason,
      noNewProviderRequests: true,
      unchangedAudit: true,
      noFileEffect: true,
    };
    state.evidence.restartedStorage = providerSdkStorageProof(state.fixture, session.id);
    const report = await exportContextTokenReport(state.page, String(state.evidence.report), [
      SDK_FIXTURE_KEY,
      SDK_PRIVATE_MARKER,
      'PROVIDER_SDK_TOOL_PROMPT_CANARY',
      'PROVIDER_SDK_DENIED_PROMPT_CANARY',
      'PROVIDER_SDK_INTERRUPTED_PROMPT_CANARY',
    ]);
    state.evidence.coverage = report.coverage;
    state.evidence.approvalStates = completed.approvals.map((row) => row.status);
    state.evidence.successfulEffects = 1;
    expect(state.provider.errors).toEqual([]);
  });
});
