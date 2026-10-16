import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RunControlRecordSchema,
  type DiagnosticReport,
  type RunControlRecord,
} from '@agent-platform/contracts';
import { expect, test, type TestInfo } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

import { JOURNEY_CALL_ID, JOURNEY_MODEL, startJourneyProvider } from './support/providerJourney.js';
import { getDesktopPorts } from './support/runtime.js';
import { attemptFixtureCleanup, releaseOwnedVmFixture } from './support/vmFixtureTeardown.js';
import {
  attemptStartupEvidenceAttachment,
  createStartupEvidence,
} from './support/startupEvidence.js';

const failedStartupAttachments = new WeakSet<TestInfo>();
const failedVmTeardowns = new WeakSet<TestInfo>();
const failedFixtureCleanup = new WeakMap<TestInfo, string[]>();
test.afterEach(() => {
  const testInfo = test.info();
  // Report secondary failures after cleanup attempts; unverified fixture roots are retained.
  expect
    .soft(failedStartupAttachments.has(testInfo), 'Startup evidence attachment failed')
    .toBe(false);
  expect
    .soft(failedVmTeardowns.has(testInfo), 'VM teardown unverified; fixture retained')
    .toBe(false);
  expect(failedFixtureCleanup.get(testInfo) ?? [], 'Fixture cleanup failed; root retained').toEqual(
    [],
  );
});

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = process.env.AGENT_PLATFORM_E2E_GIT_BINARY ?? '/usr/bin/git';
const HOST_ONLY_CANARY_ENV = 'HOST_ONLY_CANARY';
const HOST_ONLY_CANARY_VALUE = ['host', 'only', 'packaged', 'vm', 'e2e', 'canary'].join('-');
const VM_E2E_MARKER_COMMAND = 'pwd';
const JOURNEY_COMMAND = "printf 'approved change\\n' >> journey.txt";
const JOURNEY_BEFORE = 'original content\n';
const JOURNEY_AFTER = `${JOURNEY_BEFORE}approved change\n`;
const JOURNEY_FINAL = 'Evaluation turn finished';
const STOP_GUEST_COMMAND = 'sh ./stop-guest.sh';
const STOP_STARTED = 'stop-started.txt';
const STOP_RELEASE = 'stop-release.txt';
const STOP_LATE = 'stop-late.txt';
const E2E_SECRETS_MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

async function readCompleteDiagnosticReport(path: string) {
  let snapshot: { text: string; report: DiagnosticReport } | undefined;
  await expect
    .poll(() => {
      try {
        const text = readFileSync(path, 'utf8');
        const report = JSON.parse(text) as DiagnosticReport;
        snapshot = { text, report };
        return 'ready';
      } catch (error) {
        // Keep filesystem paths, report contents and parser excerpts out of failure output.
        return error instanceof SyntaxError ? 'incomplete-json' : 'unreadable-file';
      }
    })
    .toBe('ready');
  if (!snapshot) throw new Error('Diagnostic report snapshot unavailable');
  return snapshot;
}

type VmFixtureHealth = 'ready' | 'failed';

type VmFixture = {
  backendPort: number;
  startup: ReturnType<typeof createStartupEvidence>;
  evidenceDir?: string;
  heartbeatTimer?: NodeJS.Timeout;
  projectDir: string;
  realVmRuntimeDir?: string;
  vmStartAttempted?: boolean;
  vmDaemonPid?: number;
  vmTeardownFailed?: boolean;
  rendererPort: number;
  resourcesDir: string;
  runtimeDir: string;
  tempRoot: string;
};

test.describe('packaged Electron macOS VM command runner', () => {
  test('runs approved Project shell commands in the packaged VM workspace', async () => {
    const fixture = await createVmFixture({ health: 'ready' });
    let app: ElectronApplication | undefined;

    try {
      app = await launchVmFixture(fixture);
      const page = await app.firstWindow();
      await openProject(page);
      const realVmStatus = fixture.realVmRuntimeDir ? startRealVmRunner(fixture) : undefined;

      await expect(page.getByLabel('Project command status: Commands ready')).toBeVisible({
        timeout: 15_000,
      });
      await sendChatMessage(page, '/help init');
      await expect(page.getByText('Usage: /init').last()).toBeVisible();
      await expect(page.getByText('Scope: Selected Project').last()).toBeVisible();

      await sendChatMessage(page, 'Show the VM working directory');
      await expect(page.getByTestId('approval-card')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Approve' }).click();

      const toolActivity = await openToolActivity(page);
      await expect(toolActivity.getByText('Run terminal command').first()).toBeVisible();
      await expect(toolActivity.getByText('Completed').first()).toBeVisible();
      await toolActivity.getByText('Technical details').first().click();
      await expectVmWorkspaceOutput(toolActivity);
      await expect(page.getByText(fixture.projectDir)).toHaveCount(0);
      await expect(page.getByText(HOST_ONLY_CANARY_VALUE)).toHaveCount(0);
      writeVmEvidence(fixture, 'success', realVmStatus);
    } finally {
      await cleanupFixtureResources(fixture, app);
      if (!fixture.vmTeardownFailed) rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });

  test('fails closed visibly when packaged VM runtime is unhealthy', async () => {
    const fixture = await createVmFixture({ health: 'failed' });
    let app: ElectronApplication | undefined;

    try {
      app = await launchVmFixture(fixture, { finalText: 'VM command failed closed' });
      const page = await app.firstWindow();
      await openProject(page);

      await expect(page.getByLabel('Project command status: Commands unavailable')).toBeVisible({
        timeout: 15_000,
      });
      await sendChatMessage(page, 'Show the VM working directory');
      await expect(page.getByTestId('approval-card')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Approve' }).click();

      const toolActivity = await openToolActivity(page);
      await expect(toolActivity.getByText('Command runner unavailable').first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(toolActivity.getByText('Failed').first()).toBeVisible();
      await expect(toolActivity.getByText('E2E VM unavailable').first()).toBeVisible();
      await expect(page.getByText(`HOST_CWD:${fixture.projectDir}`)).toHaveCount(0);
      await expect(page.getByText(HOST_ONLY_CANARY_VALUE)).toHaveCount(0);
    } finally {
      await cleanupFixtureResources(fixture, app);
      if (!fixture.vmTeardownFailed) rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });
});

test(`approved packaged command remains honestly unknown after Stop with its late effect preserved (${process.env.AGENT_PLATFORM_E2E_PACKAGED_VM_RESOURCES_DIR ? 'signed real VM' : 'controlled helper fixture'})`, async () => {
  test.setTimeout(120_000);
  const sourceProvenance = captureStopSourceProvenance();
  const fixture = await createVmFixture({ health: 'ready' });
  const startedFile = join(fixture.projectDir, STOP_STARTED);
  const releaseFile = join(fixture.projectDir, STOP_RELEASE);
  const lateFile = join(fixture.projectDir, STOP_LATE);
  writeFileSync(
    join(fixture.projectDir, 'stop-guest.sh'),
    [
      '#!/bin/sh',
      `printf 'started\\n' >> ${STOP_STARTED}`,
      'attempt=0',
      `while [ ! -f ${STOP_RELEASE} ] && [ "$attempt" -lt 300 ]; do`,
      '  sleep 0.1',
      '  attempt=$((attempt + 1))',
      'done',
      `[ -f ${STOP_RELEASE} ] || exit 73`,
      `printf 'late\\n' >> ${STOP_LATE}`,
      '',
    ].join('\n'),
  );
  const provider = await startJourneyProvider(
    STOP_GUEST_COMMAND,
    'No post-Stop model continuation permitted',
  );
  let app: ElectronApplication | undefined;
  let tracing = false;
  let approval: ApprovalEvidence | undefined;
  let acknowledged: RunControlRecord | undefined;
  let finalRecord: RunControlRecord | undefined;
  let acknowledgementMs: number | undefined;
  let runnerStatus: unknown;
  let servedRuntimeVerified = false;
  let durableDiagnosticArtifact: { file: string; sha256: string; bytes: number } | undefined;
  try {
    app = await launchVmFixture(fixture, {
      command: STOP_GUEST_COMMAND,
      providerURL: provider.baseURL,
    });
    await configureJourneyModel(fixture);
    verifyStopServedRuntime(sourceProvenance);
    servedRuntimeVerified = true;
    await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracing = true;
    const page = await app.firstWindow();
    await openProject(page);
    if (fixture.realVmRuntimeDir) runnerStatus = startRealVmRunner(fixture);
    await expect(page.getByLabel('Project command status: Commands ready')).toBeVisible({
      timeout: 15_000,
    });
    await sendChatMessage(page, '/init');
    await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();
    await page.getByRole('button', { name: 'Approve instructions' }).click();
    await expect(page.getByText('Project instructions approved').last()).toBeVisible();
    await sendChatMessage(page, 'Run the disposable guest Stop-control fixture');
    const card = page.getByTestId('approval-card').last();
    await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
    approval = (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests')).find(
      (row) => row.toolName === 'sys_bash',
    );
    expect(approval?.status).toBe('pending');
    expect(existsSync(startedFile)).toBe(false);
    expect(existsSync(lateFile)).toBe(false);
    const waiting = await readVmRunControl(fixture, approval!.sessionId);
    expect(waiting.state).toBe('waiting_for_approval');
    await page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
    await readCompleteDiagnosticReport(join(fixture.tempRoot, 'waiting-diagnostics.json'));
    await card.getByRole('button', { name: 'Approve', exact: true }).click();
    // The effect marker proves command start: an actual guest write with real resources, otherwise the explicitly recorded helper double.
    await expect.poll(() => existsSync(startedFile), { timeout: 15_000 }).toBe(true);
    expect(readFileSync(startedFile, 'utf8')).toBe('started\n');
    expect(existsSync(lateFile)).toBe(false);
    const admitted = await readVmRunControl(fixture, approval!.sessionId, waiting.id);
    expect(admitted.state).toBe('running');
    expect(admitted.inFlight).toBeGreaterThan(0);
    expect(provider.requests).toHaveLength(1);
    let requestedAt: number | undefined;
    const stopPath = `/sessions/${approval!.sessionId}/runs/${waiting.id}/stop`;
    const observeStop = (request: import('playwright').Request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith(stopPath))
        requestedAt = performance.now();
    };
    page.on('request', observeStop);
    try {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith(stopPath),
      );
      await page.getByRole('button', { name: 'Stop run', exact: true }).click();
      const response = await responsePromise;
      const responseAt = performance.now();
      expect(response.ok()).toBe(true);
      const body = (await response.json()) as { data: unknown };
      acknowledged = RunControlRecordSchema.parse(body.data);
      expect(requestedAt).toBeDefined();
      acknowledgementMs = responseAt - requestedAt!;
      expect(acknowledgementMs).toBeLessThanOrEqual(2_000);
    } finally {
      page.off('request', observeStop);
    }
    expect(acknowledged).toMatchObject({
      id: waiting.id,
      sessionId: approval!.sessionId,
      reason: 'user_stop',
    });
    expect(acknowledged!.stopAcknowledgedAtMs).toEqual(expect.any(Number));
    expect(acknowledged!.inFlight).toBeGreaterThan(0);
    await expect(
      page.getByText(
        'Run outcome is unknown. Admitted work may still finish; inspect effects before a new request.',
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15_000 });
    expect(existsSync(lateFile)).toBe(false);
    finalRecord = await readVmRunControl(fixture, approval!.sessionId, waiting.id);
    expect(finalRecord).toMatchObject({ state: 'outcome_unknown', reason: 'user_stop' });
    expect(finalRecord.inFlight).toBeGreaterThan(0);
    // The test releases only its fixture barrier. This is the previously approved guest work, not another application invocation.
    writeFileSync(releaseFile, 'release\n');
    await expect.poll(() => existsSync(lateFile), { timeout: 10_000 }).toBe(true);
    expect(readFileSync(lateFile, 'utf8')).toBe('late\n');
    expect(readFileSync(startedFile, 'utf8')).toBe('started\n');
    expect(provider.requests).toHaveLength(1);
    expect(provider.errors).toEqual([]);
    // The product lost its guest transport receipt: a test observing an effect is not authority to manufacture cancellation.
    finalRecord = await readVmRunControl(fixture, approval!.sessionId, waiting.id);
    expect(finalRecord.state).toBe('outcome_unknown');
    await page.reload();
    await expect(
      page.getByText(
        'Run outcome is unknown. Admitted work may still finish; inspect effects before a new request.',
        { exact: true },
      ),
    ).toBeVisible();
    expect((await readVmRunControl(fixture, approval!.sessionId)).id).toBe(waiting.id);
    await page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
    const snapshot = await readCompleteDiagnosticReport(
      join(fixture.tempRoot, 'finished-diagnostics.json'),
    );
    const diagnosticPath = test.info().outputPath('stop-durable-diagnostics.json');
    writeFileSync(diagnosticPath, snapshot.text, { mode: 0o600 });
    const storedDiagnostic = readFileSync(diagnosticPath);
    durableDiagnosticArtifact = {
      file: 'stop-durable-diagnostics.json',
      sha256: createHash('sha256').update(storedDiagnostic).digest('hex'),
      bytes: storedDiagnostic.byteLength,
    };
    expect(durableDiagnosticArtifact.sha256).toBe(sha256(snapshot.text));
    expect(snapshot.report.scope).toEqual({ sessionId: approval!.sessionId });
    expect(snapshot.report.coverage).toMatchObject({
      durable: true,
      verified: true,
      dropped: 0,
      pending: 0,
      conflicts: 0,
    });
    const controls = snapshot.report.events
      .map(({ event }) => event)
      .filter((event) => event.control?.logicalRunId === waiting.id);
    expect(
      controls.some(
        (event) => event.control?.stage === 'acknowledged' && event.control.reason === 'user_stop',
      ),
    ).toBe(true);
    expect(
      controls.some(
        (event) =>
          event.control?.state === 'outcome_unknown' && event.control.reason === 'user_stop',
      ),
    ).toBe(true);
    expect(
      controls.filter(
        (event) =>
          event.control?.stage === 'admitted' && event.control.version > acknowledged!.version,
      ),
    ).toEqual([]);
    expect(snapshot.text).not.toContain(STOP_GUEST_COMMAND);
    expect(snapshot.text).not.toContain(fixture.projectDir);
    expect(snapshot.text).not.toContain(HOST_ONLY_CANARY_VALUE);
    await test.info().attach('stop-durable-diagnostic-report', {
      path: diagnosticPath,
      contentType: 'application/json',
    });
    await expect(page.getByText(fixture.projectDir)).toHaveCount(0);
    await expect(page.getByText(HOST_ONLY_CANARY_VALUE)).toHaveCount(0);
    approval = (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests')).find(
      (row) => row.id === approval!.id,
    );
    expect(approval).toMatchObject({ status: 'approved', resumedAtMs: expect.any(Number) });
    expect(provider.requests).toHaveLength(1);
    if (fixture.realVmRuntimeDir)
      writeVmEvidence(fixture, 'stop-outcome-unknown-late-effect', runnerStatus);
  } finally {
    // Release a started guest before teardown even when an assertion fails. Retain the fixture if its completion/cleanup cannot be verified.
    await recordCleanupFailures(fixture, [
      {
        name: 'stop-guest-release',
        run: async () => {
          writeFileSync(releaseFile, 'release\n');
          if (existsSync(startedFile))
            await expect.poll(() => existsSync(lateFile), { timeout: 10_000 }).toBe(true);
        },
      },
    ]);
    if (approval)
      finalRecord = await readVmRunControl(fixture, approval.sessionId, acknowledged?.id).catch(
        () => finalRecord,
      );
    await recordCleanupFailures(fixture, [
      {
        name: 'trace',
        run: async () => {
          if (app && tracing) {
            const tracePath = test.info().outputPath('stop-packaged-vm-trace.zip');
            await app.context().tracing.stop({ path: tracePath });
            await test.info().attach('stop-packaged-vm-browser-trace', {
              path: tracePath,
              contentType: 'application/zip',
            });
          }
        },
      },
    ]);
    await recordCleanupFailures(fixture, [
      {
        name: 'stop-evaluation',
        run: async () => {
          const evaluation = {
            scenario: 'approved guest Stop with preserved late effect',
            mode: fixture.realVmRuntimeDir ? 'signed-real-macos-vm' : 'controlled-helper-fixture',
            sourceProvenance,
            servedRuntimeVerified,
            durableDiagnosticArtifact: durableDiagnosticArtifact ?? null,
            acknowledgementMs,
            acknowledged,
            finalRecord,
            approval,
            started: existsSync(startedFile) ? readFileSync(startedFile, 'utf8') : null,
            late: existsSync(lateFile) ? readFileSync(lateFile, 'utf8') : null,
            providerRequestCount: provider.requests.length,
            providerErrors: provider.errors,
            backendEvents: readBackendEvents(fixture),
            limitations: [
              'The external model is a deterministic local HTTP fixture; no live-provider capability or spend claim.',
              'Guest transport cancellation is not guest termination; late previously admitted effects remain possible.',
              ...(fixture.realVmRuntimeDir
                ? []
                : [
                    'Controlled helper fixture only; this execution does not qualify the required signed real VM gate.',
                  ]),
            ],
          };
          const evidencePath = test.info().outputPath('stop-packaged-vm-evaluation.json');
          writeFileSync(
            evidencePath,
            JSON.stringify(evaluation, null, 2).replaceAll(fixture.tempRoot, '<disposable-root>'),
          );
          await test.info().attach('stop-packaged-vm-evaluation', {
            path: evidencePath,
            contentType: 'application/json',
          });
        },
      },
    ]);
    await cleanupFixtureResources(fixture, app, () => provider.close());
    if (!fixture.vmTeardownFailed) rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

function captureStopSourceProvenance() {
  // Capture before launch: a historical HEAD alone does not identify a dirty implementation or its built runtime.
  const head = execFileSync(GIT_BINARY, ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  const dirty =
    execFileSync(GIT_BINARY, ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim().length > 0;
  const knownPaths = [
    'apps/desktop/e2e/packaged-vm-command.e2e.ts',
    'apps/desktop/dist/main/main.js',
    'apps/api/src/application/runControl/service.ts',
    'apps/api/dist/application/runControl/service.js',
    'apps/api/src/infrastructure/http/v1/chatRouter.ts',
    'apps/api/dist/infrastructure/http/v1/chatRouter.js',
    'apps/api/src/infrastructure/http/v1/runControlRouter.ts',
    'apps/api/dist/infrastructure/http/v1/runControlRouter.js',
    'packages/harness/src/nodes/llmReason.ts',
    'packages/harness/dist/nodes/llmReason.js',
    'packages/harness/src/commandRunner.ts',
    'packages/harness/dist/commandRunner.js',
    'packages/harness/src/tools/qualityGateTool.ts',
    'packages/harness/dist/tools/qualityGateTool.js',
    'packages/db/src/repositories/runControl.ts',
    'packages/db/dist/repositories/runControl.js',
    'apps/web/hooks/use-harness-run-control.ts',
    'apps/web/hooks/use-harness-chat.ts',
    'apps/web/.next/standalone/apps/web/server.js',
    'apps/web/.next/standalone/apps/web/.next/BUILD_ID',
    'apps/web/.next/standalone/apps/web/.next/app-build-manifest.json',
    'apps/web/.next/standalone/apps/web/.next/server/app/page.js',
    'apps/web/.next/standalone/apps/web/.next/server/app/api/chat/route.js',
    'apps/web/.next/standalone/apps/web/.next/server/app/api/v1/[...path]/route.js',
  ];
  const rendererCopies: Array<{ inputPath: string; servedPath: string }> = [];
  const nextRoot = 'apps/web/.next/standalone/apps/web/.next';
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, nextRoot, 'app-build-manifest.json'), 'utf8'),
  ) as { pages?: Record<string, unknown> };
  // Hook code is bundled: bind the actual served page/layout JS chunks rather than inventing one source-file counterpart.
  for (const page of ['/layout', '/page']) {
    const entries = manifest.pages?.[page];
    if (!Array.isArray(entries) || entries.length > 128)
      throw new Error('Missing or unbounded renderer provenance manifest');
    for (const entry of entries) {
      if (typeof entry !== 'string') throw new Error('Invalid renderer provenance entry');
      if (!entry.endsWith('.js')) continue;
      if (!/^static\/chunks\/[A-Za-z0-9_./-]+\.js$/.test(entry) || entry.split('/').includes('..'))
        throw new Error('Unexpected renderer provenance path');
      // The desktop launcher copies .next/static into standalone on launch; fresh builds need not have that target yet.
      const inputPath = `apps/web/.next/${entry}`;
      knownPaths.push(inputPath);
      rendererCopies.push({ inputPath, servedPath: `${nextRoot}/${entry}` });
    }
  }
  const files = [...new Set(knownPaths)].sort().map((path) => {
    const bytes = readFileSync(join(repoRoot, path));
    return {
      path,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  return {
    capturedAt: new Date().toISOString(),
    head,
    dirty,
    headMeaning: dirty
      ? 'Ancestry only; uncommitted tested implementation is identified by the listed file hashes.'
      : 'Clean checkout ancestry; compiled runtime is independently identified by the listed file hashes.',
    files,
    rendererCopies,
    limitations: [
      'Selected source/runtime byte bindings are not a complete source-tree digest or a reproducible-build attestation.',
    ],
  };
}

function verifyStopServedRuntime(provenance: ReturnType<typeof captureStopSourceProvenance>): void {
  for (const { inputPath, servedPath } of provenance.rendererCopies) {
    const source = provenance.files.find((file) => file.path === inputPath);
    if (!source) throw new Error('Missing captured renderer runtime input');
    const servedSha256 = createHash('sha256')
      .update(readFileSync(join(repoRoot, servedPath)))
      .digest('hex');
    expect(servedSha256, 'Served renderer chunk differs from its captured prelaunch input').toBe(
      source.sha256,
    );
  }
}

async function readVmRunControl(
  fixture: VmFixture,
  sessionId: string,
  runId?: string,
): Promise<RunControlRecord> {
  const resource = runId
    ? `sessions/${sessionId}/runs/${runId}`
    : `sessions/${sessionId}/active-run`;
  const response = await fetch(`http://127.0.0.1:${fixture.backendPort}/v1/${resource}`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Run control evidence request failed: ${response.status}`);
  const body = (await response.json()) as { data: unknown };
  return RunControlRecordSchema.parse(body.data);
}

const journeyCases = (['node-double', 'provider-http'] as const).flatMap((reasoning) =>
  (['approve', 'reject'] as const).flatMap((decision) =>
    (reasoning === 'provider-http' ? [false, true] : [false]).map((reload) => ({
      reasoning,
      decision,
      reload,
      failFirst: false,
    })),
  ),
);
journeyCases.push({
  reasoning: 'provider-http',
  decision: 'approve',
  reload: false,
  failFirst: true,
});
for (const { reasoning, decision, reload, failFirst } of journeyCases) {
  test(`Project Chat disposable edit: ${decision} with backend evidence (${reasoning}${reload ? ', reload recovery' : ''}${failFirst ? ', transient retry' : ''})`, async () => {
    const fixture = await createVmFixture({ health: 'ready' });
    const file = join(fixture.projectDir, 'journey.txt');
    writeFileSync(file, JOURNEY_BEFORE);
    const provider =
      reasoning === 'provider-http'
        ? await startJourneyProvider(JOURNEY_COMMAND, JOURNEY_FINAL, { failFirst })
        : undefined;
    let app: ElectronApplication | undefined;
    let approval: ApprovalEvidence | undefined;
    let audits: AuditEvidence[] = [];
    const duplicateResumes: Array<{ status: number; body: unknown }> = [];
    let messages: Array<{ role: string; content: string }> = [];
    const streams: Array<{ status: number; events: unknown[] }> = [];
    const milestones: Array<{ event: string; at: string }> = [];
    const mark = (event: string) => milestones.push({ event, at: new Date().toISOString() });
    let tracing = false;
    try {
      app = await launchVmFixture(fixture, {
        command: JOURNEY_COMMAND,
        finalText: JOURNEY_FINAL,
        providerURL: provider?.baseURL,
      });
      if (provider) await configureJourneyModel(fixture);
      await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
      tracing = true;
      const page = await app.firstWindow();
      // Observe a clone of the real browser fetch stream. Chromium may discard a
      // completed no-store response before Playwright response.text() reads it.
      // This does not substitute bytes, transport, status or application parsing.
      await page.exposeFunction('__recordJourneyStream', (status: number, body: string) => {
        const events = body
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as unknown);
        streams.push({ status, events });
      });
      const observeRealFetch = () => {
        const original = window.fetch.bind(window);
        window.fetch = async (...args) => {
          const response = await original(...args);
          if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
            void response
              .clone()
              .text()
              .then((body) =>
                (
                  window as unknown as {
                    __recordJourneyStream: (status: number, body: string) => Promise<void>;
                  }
                ).__recordJourneyStream(response.status, body),
              );
          }
          return response;
        };
      };
      await page.addInitScript(observeRealFetch);
      await page.evaluate(observeRealFetch);
      await openProject(page);
      if (fixture.realVmRuntimeDir) startRealVmRunner(fixture);
      await sendChatMessage(page, '/init');
      await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();
      await page.getByRole('button', { name: 'Approve instructions' }).click();
      await expect(page.getByText('Project instructions approved').last()).toBeVisible();
      mark('project_onboarding_approved');
      await sendChatMessage(page, 'Append one line saying approved change to journey.txt.');
      const card = page.getByTestId('approval-card').last();
      await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible({
        timeout: failFirst ? 20_000 : 5_000,
      });
      expect(readFileSync(file, 'utf8')).toBe(JOURNEY_BEFORE);
      const pending = await readEvidence<ApprovalEvidence>(fixture, 'approval-requests');
      approval = pending.find((row) => row.toolName === 'sys_bash');
      expect(approval?.status).toBe('pending');
      if (provider) {
        expect(provider.requests).toHaveLength(1);
        expect(provider.requests[0]?.messages.some((m) => m.role === 'tool')).toBe(false);
      }
      mark('approval_pending_file_unchanged');
      if (provider) {
        await page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
        const waitingSnapshot = await readCompleteDiagnosticReport(
          join(fixture.tempRoot, 'waiting-diagnostics.json'),
        );
        const waiting = waitingSnapshot.report;
        expect(waiting.scope).toEqual({ sessionId: approval!.sessionId });
        expect(
          waiting.events.some(
            ({ event }: { event: { phase: string; outcome: string } }) =>
              event.phase === 'approval' && event.outcome === 'waiting',
          ),
        ).toBe(true);
        await test.info().attach('waiting-diagnostic-report', {
          body: waitingSnapshot.text,
          contentType: 'application/json',
        });
      }
      if (reload) {
        // Let the original NDJSON response finish before navigation invalidates Chromium's body.
        await expect
          .poll(() =>
            streams.some((stream) =>
              stream.events.some(
                (event) => (event as { type?: string }).type === 'approval_required',
              ),
            ),
          )
          .toBe(true);
        await page.reload();
        await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
        const restored = (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests')).find(
          (row) => row.id === approval?.id,
        );
        expect(restored).toEqual(approval);
        expect(readFileSync(file, 'utf8')).toBe(JOURNEY_BEFORE);
        expect(provider?.requests).toHaveLength(1);
        mark('pending_approval_restored_after_reload');
      }
      await card
        .getByRole('button', { name: decision === 'approve' ? 'Approve' : 'Deny', exact: true })
        .click();
      await expect(card).toContainText(
        decision === 'approve' ? 'Approved action completed' : 'Denied',
        { timeout: 20_000 },
      );
      const hasEvent = (type: string, code?: string) =>
        streams
          .flatMap((stream) => stream.events)
          .some((event) => {
            if (typeof event !== 'object' || event === null) return false;
            const row = event as { type?: string; code?: string };
            return row.type === type && (code === undefined || row.code === code);
          });
      expect(hasEvent('approval_required')).toBe(true);
      // The denial card updates before the resume response is received; wait for actual stream evidence.
      await expect
        .poll(() =>
          hasEvent(
            decision === 'approve' ? 'tool_result' : 'error',
            decision === 'reject' ? 'APPROVAL_REJECTED' : undefined,
          ),
        )
        .toBe(true);
      approval = (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests')).find(
        (row) => row.id === approval?.id,
      );
      audits = (await readEvidence<AuditEvidence>(fixture, 'tool-executions')).filter(
        (row) => row.sessionId === approval?.sessionId && row.toolName === 'sys_bash',
      );
      expect(approval?.status).toBe(decision === 'approve' ? 'approved' : 'rejected');
      expect(approval?.resumedAtMs).toEqual(expect.any(Number));
      expect(readFileSync(file, 'utf8')).toBe(
        decision === 'approve' ? JOURNEY_AFTER : JOURNEY_BEFORE,
      );
      const successes = audits.filter((row) => row.status === 'success');
      expect(successes).toHaveLength(decision === 'approve' ? 1 : 0);
      if (decision === 'reject') expect(audits.some((row) => row.status === 'denied')).toBe(true);
      await expect
        .poll(
          () =>
            readBackendEvents(fixture).filter(
              (row) => row.sessionId === approval?.sessionId && row.kind === 'task_end',
            ).length,
        )
        .toBe(2);
      const lifecycle = readBackendEvents(fixture).filter(
        (row) => row.sessionId === approval?.sessionId,
      );
      const starts = lifecycle.filter((row) => row.kind === 'task_start');
      expect(starts).toHaveLength(2);
      expect(new Set(starts.map((row) => row.runId)).size).toBe(2);
      for (const start of starts) {
        expect(start.runId).toEqual(expect.any(String));
        expect(start.correlationId).toEqual(expect.any(String));
        const ends = lifecycle.filter(
          (row) => row.kind === 'task_end' && row.runId === start.runId,
        );
        expect(ends).toHaveLength(1);
        expect(ends[0]?.correlationId).toBe(start.correlationId);
        expect(Number.isFinite(Date.parse(start.at ?? ''))).toBe(true);
        expect(Date.parse(ends[0]?.at ?? '')).toBeGreaterThanOrEqual(Date.parse(start.at!));
      }
      if (provider) {
        expect(provider.errors).toEqual([]);
        expect(provider.attempts.map((attempt) => attempt.status)).toEqual(
          failFirst ? [503, 200, 200] : [200, 200],
        );
        expect(provider.requests).toHaveLength(2);
        const result = provider.requests[1]?.messages.find(
          (m) => m.role === 'tool' && m.tool_call_id === JOURNEY_CALL_ID,
        );
        expect(result).toBeDefined();
        await expect(page.getByText(JOURNEY_FINAL).last()).toBeVisible();
        messages = await readEvidence<{ role: string; content: string }>(
          fixture,
          `sessions/${approval!.sessionId}/messages`,
        );
        expect(
          messages.filter((m) => m.role === 'assistant' && m.content === JOURNEY_FINAL),
        ).toHaveLength(1);
        expect(JSON.stringify(result?.content)).toContain(
          decision === 'reject' ? 'APPROVAL_REJECTED' : 'The command completed successfully.',
        );
      }
      if (reload) {
        const messagesBefore = messages;
        const auditsBefore = audits;
        await Promise.all(
          [0, 1].map(async () => {
            const response = await fetch(
              `http://127.0.0.1:${fixture.backendPort}/v1/sessions/${approval!.sessionId}/resume`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ approvalRequestId: approval!.id }),
                signal: AbortSignal.timeout(5_000),
              },
            );
            const body = (await response.json()) as { data?: ApprovalEvidence };
            duplicateResumes.push({ status: response.status, body });
            expect(response.status).toBe(200);
            expect(body.data?.id).toBe(approval!.id);
            expect(body.data?.resumedAtMs).toBe(approval!.resumedAtMs);
          }),
        );
        messages = await readEvidence(fixture, `sessions/${approval!.sessionId}/messages`);
        audits = (await readEvidence<AuditEvidence>(fixture, 'tool-executions')).filter(
          (row) => row.sessionId === approval!.sessionId && row.toolName === 'sys_bash',
        );
        expect(messages).toEqual(messagesBefore);
        expect(audits).toEqual(auditsBefore);
        expect(provider?.requests).toHaveLength(2);
        expect(readFileSync(file, 'utf8')).toBe(
          decision === 'approve' ? JOURNEY_AFTER : JOURNEY_BEFORE,
        );
        mark('duplicate_completed_resumes_no_new_effect');
      }
      if (provider) {
        await page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
        const diagnosticPath = join(fixture.tempRoot, 'finished-diagnostics.json');
        const { text: diagnosticText, report: diagnostic } =
          await readCompleteDiagnosticReport(diagnosticPath);
        await test.info().attach('finished-diagnostic-report', {
          body: diagnosticText,
          contentType: 'application/json',
        });
        expect(diagnostic.scope).toEqual({ sessionId: approval!.sessionId });
        expect(diagnostic.coverage).toMatchObject({ durable: true, verified: true });
        expect(
          diagnostic.events.some(
            ({ event }: { event: { phase: string; outcome: string; errorCode?: string } }) =>
              event.phase === 'approval' &&
              (decision === 'approve'
                ? event.outcome === 'started'
                : event.errorCode === 'permission_denied'),
          ),
        ).toBe(true);
        if (decision === 'approve')
          expect(
            diagnostic.events.some(
              ({ event }: { event: { phase: string; outcome: string } }) =>
                event.phase === 'tool' && event.outcome === 'succeeded',
            ),
          ).toBe(true);
        // The provider transcript proves SDK recovery after a real 503. SDK-internal
        // attempts are opaque: the diagnostic contract truthfully reports the outer
        // model operation rather than inventing a retry event for unseen attempts.
        if (failFirst) {
          const modelEvents = diagnostic.events.filter(
            ({ event }: { event: { phase: string } }) => event.phase === 'model',
          );
          expect(
            modelEvents.some(
              ({ event }: { event: { outcome: string } }) => event.outcome === 'succeeded',
            ),
          ).toBe(true);
          expect(
            modelEvents.some(
              ({ event }: { event: { outcome: string } }) => event.outcome === 'retrying',
            ),
          ).toBe(false);
        }
        expect(diagnosticText).not.toContain(JOURNEY_COMMAND);
        expect(diagnosticText).not.toContain(HOST_ONLY_CANARY_VALUE);
        expect(diagnosticText).not.toContain(fixture.projectDir);
      }
      mark('turn_settled_file_and_audit_verified');
    } finally {
      // Snapshot durable evidence even when a UI assertion fails; never repair or manufacture it.
      approval =
        (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests').catch(() => [])).find(
          (row) => row.toolName === 'sys_bash',
        ) ?? approval;
      audits = (
        await readEvidence<AuditEvidence>(fixture, 'tool-executions').catch(() => audits)
      ).filter((row) => row.toolName === 'sys_bash');
      await recordCleanupFailures(fixture, [
        {
          name: 'trace',
          run: async () => {
            if (app && tracing) {
              const tracePath = test.info().outputPath('journey-trace.zip');
              await app.context().tracing.stop({ path: tracePath });
              await test.info().attach('journey-browser-trace', {
                path: tracePath,
                contentType: 'application/zip',
              });
            }
          },
        },
      ]);
      await cleanupFixtureResources(fixture, app, () => provider?.close());
      try {
        const backendEvents = readBackendEvents(fixture);
        const evaluation = {
          decision,
          reasoning,
          reload,
          duplicateResumes,
          sourceRevision: execFileSync(GIT_BINARY, ['rev-parse', 'HEAD'], {
            cwd: repoRoot,
            encoding: 'utf8',
          }).trim(),
          providerRequests: provider?.requests,
          providerErrors: provider?.errors,
          providerAttempts: provider?.attempts,
          failFirst,
          messages,
          passed: milestones.some(
            (entry) => entry.event === 'turn_settled_file_and_audit_verified',
          ),
          executionMode: `${reasoning}-${fixture.realVmRuntimeDir ? 'real-vm' : 'fixture-runner'}`,
          before: JOURNEY_BEFORE,
          after: existsSync(file) ? readFileSync(file, 'utf8') : null,
          approval,
          audits,
          milestones,
          backendEvents,
          streams,
          limitations: [
            provider
              ? 'Real provider factory, SDK and reasoning; HTTP responses scripted. Ordinary chat excludes evaluator nodes.'
              : 'Model reasoning node is deterministic; evaluator nodes are disabled by existing E2E mode.',
            'Default runner is a fixed-command test double, not VM isolation evidence.',
            'Internal harness graph trace is not exported as a complete durable span timeline.',
            'Resume may use a new run identifier; approval/session identifiers link the phases.',
          ],
        };
        const evidencePath = test.info().outputPath('journey-evaluation.json');
        writeFileSync(
          evidencePath,
          JSON.stringify(evaluation, null, 2).replaceAll(fixture.tempRoot, '<disposable-root>'),
        );
        await test
          .info()
          .attach('journey-evaluation', { path: evidencePath, contentType: 'application/json' });
        await test.info().attach('journey-summary', {
          body: Buffer.from(
            [
              `# Project Chat ${decision} evaluation`,
              `Result: ${evaluation.passed ? 'PASS' : 'FAIL — inspect evidence and Playwright trace'}`,
              `Mode: ${evaluation.executionMode}`,
              `Backend events captured: ${backendEvents.length}`,
              `Durable approval: ${approval?.status ?? 'unavailable'}`,
              `Tool audit records: ${audits.length}`,
              ...evaluation.limitations,
            ].join('\n\n'),
          ),
          contentType: 'text/markdown',
        });
      } finally {
        if (!fixture.vmTeardownFailed) rmSync(fixture.tempRoot, { recursive: true, force: true });
      }
    }
  });
}

for (const { policy, unavailableFiles, action } of [
  { policy: 'ask', unavailableFiles: false, action: 'shell-write' },
  { policy: 'auto', unavailableFiles: false, action: 'shell-write' },
  { policy: 'block', unavailableFiles: false, action: 'shell-write' },
  { policy: 'block', unavailableFiles: true, action: 'shell-write' },
  { policy: 'ask', unavailableFiles: false, action: 'direct-write' },
  { policy: 'auto', unavailableFiles: false, action: 'direct-write' },
  { policy: 'ask', unavailableFiles: false, action: 'direct-revoked' },
  { policy: 'block', unavailableFiles: false, action: 'direct-write' },
  { policy: 'block', unavailableFiles: false, action: 'direct-read' },
  { policy: 'block', unavailableFiles: false, action: 'network' },
] as const) {
  test(`Project Chat permission policy: ${action} ${policy} with ${unavailableFiles ? 'unavailable file listing' : 'persisted backend effects'}`, async () => {
    const fixture = await createVmFixture({ health: 'ready' });
    const file = join(fixture.projectDir, 'journey.txt');
    writeFileSync(file, JOURNEY_BEFORE);
    const revoked = action === 'direct-revoked';
    const directWrite = action === 'direct-write' || revoked;
    const readOnly = action === 'direct-read';
    const denied = (policy === 'block' && !readOnly) || revoked;
    const needsApproval = revoked || (!denied && !readOnly && !(directWrite && policy === 'auto'));
    const policyKey = action === 'network' ? 'network' : 'workspaceWrite';
    const toolName = directWrite ? 'sys_write_file' : readOnly ? 'sys_read_file' : 'sys_bash';
    const toolArgs = directWrite
      ? { path: file, content: JOURNEY_AFTER }
      : readOnly
        ? { path: file }
        : { command: action === 'network' ? 'curl https://example.invalid' : JOURNEY_COMMAND };
    const provider = await startJourneyProvider(JOURNEY_COMMAND, JOURNEY_FINAL, {
      toolCall: { name: toolName, args: toolArgs },
    });
    let app: ElectronApplication | undefined;
    let tracing = false;
    let passed = false;
    let savedPolicy: unknown;
    let approvals: ApprovalEvidence[] = [];
    let audits: AuditEvidence[] = [];
    let messages: Array<{ role: string; content: string }> = [];
    const readPolicy = async () => {
      const res = await fetch(`http://127.0.0.1:${fixture.backendPort}/v1/settings`, {
        signal: AbortSignal.timeout(5_000),
      });
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { data: { executionPolicy: Record<string, string> } };
      return body.data.executionPolicy;
    };
    try {
      app = await launchVmFixture(fixture, {
        providerURL: provider.baseURL,
        // A file cannot contain workspace directories: exercise the real API failure path.
        workspaceRoot: unavailableFiles ? join(file, 'workspace') : undefined,
      });
      await configureJourneyModel(fixture);
      await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
      tracing = true;
      const page = await app.firstWindow();
      await expect(page.getByRole('button', { name: 'Open folder', exact: true })).toBeVisible();
      await page.waitForLoadState('load');
      await page.goto(`http://127.0.0.1:${fixture.rendererPort}/settings/workspace`);
      const selector = page.getByRole('combobox', {
        name: action === 'network' ? /Network commands/ : /Workspace writes/,
      });
      await expect(selector).toBeVisible();
      // Force a real settings mutation even when the requested mode is the default.
      await selector.selectOption(policy === 'ask' ? 'block' : 'ask');
      await expect
        .poll(async () => (await readPolicy())[policyKey])
        .toBe(policy === 'ask' ? 'block' : 'ask');
      await expect(selector).toBeEnabled();
      await selector.selectOption(policy);
      await expect.poll(async () => (await readPolicy())[policyKey]).toBe(policy);
      await page.reload();
      await expect(selector).toHaveValue(policy);
      if (unavailableFiles) {
        await expect(page.getByText('File listing unavailable. Refresh to retry.')).toBeVisible();
        await expect(page.getByText('No workspace files yet')).toHaveCount(0);
        await expect(page.getByText('0 files', { exact: true })).toHaveCount(0);
        const refreshedListing = page.waitForResponse((response) =>
          response.url().endsWith('/api/v1/workspace/files'),
        );
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        expect((await refreshedListing).status()).toBe(500);
        await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
        await expect(page.getByText('File listing unavailable. Refresh to retry.')).toBeVisible();
        await expect(selector).toHaveValue(policy);
      }
      savedPolicy = await readPolicy();
      await page.goto(`http://127.0.0.1:${fixture.rendererPort}/`);
      await openProject(page);
      if (fixture.realVmRuntimeDir) startRealVmRunner(fixture);
      await sendChatMessage(page, '/init');
      await page.getByRole('button', { name: 'Approve instructions' }).click();
      await expect(page.getByText('Project instructions approved').last()).toBeVisible();
      await sendChatMessage(
        page,
        readOnly
          ? 'Read journey.txt.'
          : action === 'network'
            ? 'Inspect the example endpoint.'
            : 'Write the approved change to journey.txt.',
      );
      if (needsApproval) {
        const card = page.getByTestId('approval-card');
        await expect(card).toHaveCount(1);
        await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
        expect(readFileSync(file, 'utf8')).toBe(JOURNEY_BEFORE);
        approvals = await readEvidence<ApprovalEvidence>(fixture, 'approval-requests');
        expect(approvals).toHaveLength(1);
        expect(approvals[0]?.status).toBe('pending');
        expect(provider.requests).toHaveLength(1);
        if (revoked) {
          const chatURL = page.url();
          await page.goto(`http://127.0.0.1:${fixture.rendererPort}/settings/workspace`);
          await selector.selectOption('block');
          await expect.poll(async () => (await readPolicy()).workspaceWrite).toBe('block');
          await page.reload();
          await expect(selector).toHaveValue('block');
          await page.goto(chatURL);
          await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
          expect(readFileSync(file, 'utf8')).toBe(JOURNEY_BEFORE);
        }
        await card.getByRole('button', { name: 'Approve', exact: true }).click();
        if (!revoked) await expect(card).toContainText('Approved action completed');
      }
      await expect(page.getByText(JOURNEY_FINAL).last()).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
      expect(provider.errors).toEqual([]);
      expect(provider.requests).toHaveLength(2);
      expect(provider.attempts.map((attempt) => attempt.status)).toEqual([200, 200]);
      approvals = await readEvidence<ApprovalEvidence>(fixture, 'approval-requests');
      audits = (await readEvidence<AuditEvidence>(fixture, 'tool-executions')).filter(
        (row) => row.toolName === toolName,
      );
      expect(audits.filter((row) => row.status === 'success')).toHaveLength(denied ? 0 : 1);
      expect(readFileSync(file, 'utf8')).toBe(denied || readOnly ? JOURNEY_BEFORE : JOURNEY_AFTER);
      if (denied) expect(audits.filter((row) => row.status === 'denied')).toHaveLength(1);
      if (denied && !revoked) {
        expect(approvals).toHaveLength(0);
        await expect(page.getByTestId('approval-card')).toHaveCount(0);
      } else if (needsApproval) {
        expect(approvals).toHaveLength(1);
        expect(approvals[0]?.status).toBe('approved');
        expect(approvals[0]?.resumedAtMs).toEqual(expect.any(Number));
      } else {
        expect(approvals).toHaveLength(0);
        await expect(page.getByTestId('approval-card')).toHaveCount(0);
      }
      const result = provider.requests[1]?.messages.find(
        (m) => m.role === 'tool' && m.tool_call_id === JOURNEY_CALL_ID,
      );
      expect(JSON.stringify(result?.content)).toContain(
        denied
          ? 'DENIED'
          : readOnly
            ? JOURNEY_BEFORE.trim()
            : directWrite
              ? 'written'
              : 'The command completed successfully.',
      );
      const sessionId = audits[0]?.sessionId;
      expect(sessionId).toEqual(expect.any(String));
      messages = await readEvidence(fixture, `sessions/${sessionId}/messages`);
      expect(
        messages.filter((m) => m.role === 'assistant' && m.content === JOURNEY_FINAL),
      ).toHaveLength(1);
      await expect
        .poll(
          () =>
            readBackendEvents(fixture).filter(
              (row) => row.sessionId === sessionId && row.kind === 'task_end',
            ).length,
        )
        .toBe(needsApproval ? 2 : 1);
      if (denied) {
        const activity = await openToolActivity(page);
        await expect(activity).toContainText('Denied');
      }
      if (action === 'network') {
        expect(existsSync(join(fixture.projectDir, '.runner-invocations'))).toBe(false);
      }
      passed = true;
    } finally {
      approvals = await readEvidence<ApprovalEvidence>(fixture, 'approval-requests').catch(
        () => approvals,
      );
      audits = (
        await readEvidence<AuditEvidence>(fixture, 'tool-executions').catch(() => audits)
      ).filter((row) => row.toolName === toolName);
      savedPolicy = await readPolicy().catch(() => savedPolicy);
      try {
        await recordCleanupFailures(fixture, [
          {
            name: 'trace',
            run: async () => {
              if (app && tracing) {
                const trace = test.info().outputPath('policy-trace.zip');
                await app.context().tracing.stop({ path: trace });
                await test
                  .info()
                  .attach('policy-browser-trace', { path: trace, contentType: 'application/zip' });
              }
            },
          },
        ]);
      } finally {
        await cleanupFixtureResources(fixture, app, () => provider.close());
        try {
          const evidence = {
            policy,
            action,
            unavailableFiles,
            savedPolicy,
            passed,
            approvals,
            audits,
            messages,
            before: JOURNEY_BEFORE,
            after: readFileSync(file, 'utf8'),
            providerRequests: provider.requests,
            providerErrors: provider.errors,
            backendEvents: readBackendEvents(fixture),
            sourceRevision: execFileSync(GIT_BINARY, ['rev-parse', 'HEAD'], {
              cwd: repoRoot,
              encoding: 'utf8',
            }).trim(),
            limitations: [
              'External HTTP provider and fixed-command runner fixtures; no live-model or real VM claim.',
              'Direct file modes test the write-policy scope; shell Auto retains explicit high-risk approval precedence.',
            ],
          };
          const path = test.info().outputPath('policy-evaluation.json');
          writeFileSync(
            path,
            JSON.stringify(evidence, null, 2).replaceAll(fixture.tempRoot, '<disposable-root>'),
          );
          await test.info().attach('policy-evaluation', { path, contentType: 'application/json' });
        } finally {
          if (!fixture.vmTeardownFailed) rmSync(fixture.tempRoot, { recursive: true, force: true });
        }
      }
    }
  });
}

type ApprovalEvidence = {
  id: string;
  sessionId: string;
  runId: string;
  toolName: string;
  status: string;
  resumedAtMs?: number | null;
};
type AuditEvidence = { id: string; sessionId: string; toolName: string; status: string };

async function recordCleanupFailures(
  fixture: VmFixture,
  steps: Parameters<typeof attemptFixtureCleanup>[0],
): Promise<void> {
  const failed = await attemptFixtureCleanup(steps);
  if (failed.length) {
    const info = test.info();
    failedFixtureCleanup.set(info, [...(failedFixtureCleanup.get(info) ?? []), ...failed]);
    fixture.vmTeardownFailed = true;
  }
}

async function cleanupFixtureResources(
  fixture: VmFixture,
  app?: ElectronApplication,
  closeProvider: () => void | Promise<void> = () => {},
): Promise<void> {
  const priorFailure = fixture.vmTeardownFailed;
  await recordCleanupFailures(fixture, [
    { name: 'electron', run: () => closeVmFixtureApp(fixture, app) },
    { name: 'provider', run: closeProvider },
    { name: 'vm', run: () => stopRealVmRunner(fixture) },
    {
      name: 'heartbeat',
      run: () => {
        if (fixture.heartbeatTimer) clearInterval(fixture.heartbeatTimer);
      },
    },
  ]);
  fixture.vmTeardownFailed ||= priorFailure;
}

async function closeVmFixtureApp(fixture: VmFixture, app?: ElectronApplication): Promise<void> {
  const info = test.info();
  try {
    await app?.close();
    if (app && !fixture.startup.shutdownConfirmed()) {
      throw new Error('Managed desktop shutdown unverified; fixture retained');
    }
  } finally {
    const attached = await attemptStartupEvidenceAttachment(() =>
      info.attach('startup-evidence', {
        body: Buffer.from(JSON.stringify(fixture.startup.snapshot(), null, 2)),
        contentType: 'application/json',
      }),
    );
    if (!attached) failedStartupAttachments.add(info);
  }
}

async function configureJourneyModel(fixture: VmFixture): Promise<void> {
  const deadline = performance.now() + 20_000;
  await expect
    .poll(() => fixture.startup.probe(deadline - performance.now()), { timeout: 20_000 })
    .toBe(true);
  const configs = await readEvidence<{ id: string }>(fixture, 'model-configs');
  expect(configs).toHaveLength(1);
  const configured = await fetch(
    `http://127.0.0.1:${fixture.backendPort}/v1/model-configs/${configs[0]!.id}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'ollama', model: JOURNEY_MODEL }),
    },
  );
  expect(configured.ok).toBe(true);
}

async function readEvidence<T>(fixture: VmFixture, resource: string): Promise<T[]> {
  const response = await fetch(`http://127.0.0.1:${fixture.backendPort}/v1/${resource}?limit=100`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Evidence request failed: ${response.status}`);
  return ((await response.json()) as { data: T[] }).data;
}

function readBackendEvents(fixture: VmFixture) {
  const file = join(fixture.runtimeDir, 'logs', 'backend.stdout.log');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line) => {
      try {
        const row = JSON.parse(line) as {
          ts?: string;
          level?: string;
          service?: string;
          correlationId?: string;
          event?: {
            kind?: string;
            sessionId?: string;
            runId?: string;
            toolId?: string;
            phase?: string;
            outcome?: string;
          };
        };
        if (!row.event) return [];
        return [
          {
            at: row.ts,
            level: row.level,
            service: row.service,
            correlationId: row.correlationId,
            // The safe diagnostic sink uses explicit phase/outcome instead of legacy kind.
            // A waiting request ends this invocation, not the overall approved action.
            kind:
              row.event.kind ??
              (row.event.phase === 'request'
                ? row.event.outcome === 'started'
                  ? 'task_start'
                  : 'task_end'
                : undefined),
            phase: row.event.phase,
            outcome: row.event.outcome,
            sessionId: row.event.sessionId,
            runId: row.event.runId,
            toolId: row.event.toolId,
          },
        ];
      } catch {
        return [];
      }
    });
}

async function createVmFixture(options: { health: VmFixtureHealth }): Promise<VmFixture> {
  const tempRoot = mkdtempSync(join(tmpdir(), 'agent-platform-electron-vm-e2e-'));
  const runtimeDir = join(tempRoot, 'runtime');
  const fixtureResourcesDir = join(tempRoot, 'resources');
  const evidenceDir = process.env.AGENT_PLATFORM_E2E_EVIDENCE_DIR;
  const projectDir = join(tempRoot, 'client', 'packaged-vm-project');
  const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
  const { backendPort, rendererPort } = await getDesktopPorts();
  const realPackagedResourcesDir =
    options.health === 'ready'
      ? process.env.AGENT_PLATFORM_E2E_PACKAGED_VM_RESOURCES_DIR
      : undefined;
  const resourcesDir = realPackagedResourcesDir ?? fixtureResourcesDir;

  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'README.md'), '# Packaged VM E2E Project\n');
  execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync(GIT_BINARY, ['config', 'user.email', 'e2e@example.com'], {
    cwd: projectDir,
    stdio: 'ignore',
  });
  execFileSync(GIT_BINARY, ['config', 'user.name', 'Electron E2E'], {
    cwd: projectDir,
    stdio: 'ignore',
  });
  execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: projectDir, stdio: 'ignore' });

  if (realPackagedResourcesDir) {
    assertPackagedResources(realPackagedResourcesDir);
  } else {
    writePackagedVmResources(resourcesDir, options.health);
  }
  const realVmRuntimeDir = realPackagedResourcesDir ? join(runtimeDir, 'data', 'vm') : undefined;
  const heartbeatTimer = realPackagedResourcesDir
    ? undefined
    : writeRuntimeHealth(runtimeDir, options.health);
  seedDesktopDatabase(sqlitePath);

  return {
    backendPort,
    startup: createStartupEvidence(backendPort, rendererPort),
    evidenceDir,
    heartbeatTimer,
    projectDir,
    realVmRuntimeDir,
    rendererPort,
    resourcesDir,
    runtimeDir,
    tempRoot,
  };
}

async function launchVmFixture(
  fixture: VmFixture,
  options: {
    finalText?: string;
    command?: string;
    providerURL?: string;
    workspaceRoot?: string;
  } = {},
): Promise<ElectronApplication> {
  const app = await electron.launch({
    cwd: desktopDir,
    args: ['.'],
    env: {
      ...process.env,
      LANGCHAIN_TRACING_V2: 'false',
      LANGSMITH_TRACING: 'false',
      LANGSMITH_TRACING_V2: 'false',
      AGENT_PLATFORM_DESKTOP_TEST_SAVE_DIAGNOSTIC_PATHS: JSON.stringify([
        join(fixture.tempRoot, 'waiting-diagnostics.json'),
        join(fixture.tempRoot, 'finished-diagnostics.json'),
      ]),
      WORKSPACE_ROOT: options.workspaceRoot ?? join(fixture.tempRoot, 'workspace'),
      AGENT_OPENAI_API_KEY: 'sk-test-key',
      AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
      AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(fixture.backendPort),
      AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
      AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
      AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(fixture.rendererPort),
      AGENT_PLATFORM_DESKTOP_RESOURCES_DIR: fixture.resourcesDir,
      AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: fixture.runtimeDir,
      AGENT_PLATFORM_DESKTOP_LOG_DIR: join(fixture.runtimeDir, 'logs'),
      AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(fixture.runtimeDir, 'tmp'),
      AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([fixture.projectDir]),
      AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: options.providerURL
        ? ''
        : (options.finalText ?? 'VM command complete'),
      AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: options.providerURL
        ? ''
        : JSON.stringify({
            name: 'sys_bash',
            args: { command: options.command ?? VM_E2E_MARKER_COMMAND },
          }),
      ...(options.providerURL
        ? {
            OLLAMA_BASE_URL: options.providerURL,
            NODE_OPTIONS: `--require=${join(desktopDir, 'e2e/support/provider-network-guard.cjs')}`,
            AGENT_ANTHROPIC_API_KEY: '',
            OPENAI_API_KEY: '',
            ANTHROPIC_API_KEY: '',
          }
        : {}),
      SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
      [HOST_ONLY_CANARY_ENV]: HOST_ONLY_CANARY_VALUE,
      ...(process.env.CI ? { CI: process.env.CI } : {}),
    },
  });
  fixture.startup.observeProcess(app.process());
  return app;
}

async function openProject(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Open folder' }).click();
  await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
}

async function sendChatMessage(page: Page, message: string): Promise<void> {
  await expect(
    page.getByRole('status').filter({
      hasText: 'Press Enter to send, Shift+Enter for new line',
    }),
  ).toBeVisible();
  const input = page.getByPlaceholder('Ask about this Project...');
  await input.fill(message);
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
  await input.press('Enter');
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}

async function expectVmWorkspaceOutput(toolActivity: ReturnType<Page['locator']>): Promise<void> {
  await expect
    .poll(
      async () => {
        const text = await toolActivity.textContent();
        return text?.includes('VM_CWD:/workspace') || text?.includes('/workspace') || false;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

async function openToolActivity(page: Page) {
  const toolActivity = page.locator('details').filter({ hasText: 'Tool activity' }).first();
  await expect(toolActivity).toBeVisible({ timeout: 20_000 });
  const isOpen = await toolActivity.evaluate((element) => element.hasAttribute('open'));
  if (!isOpen) {
    await toolActivity.locator('summary').first().click();
  }
  return toolActivity;
}

function writePackagedVmResources(resourcesDir: string, health: VmFixtureHealth): void {
  const vmDir = join(resourcesDir, 'macos-vm');
  const imagesDir = join(vmDir, 'images');
  mkdirSync(imagesDir, { recursive: true });
  writeFileSync(join(imagesDir, 'base-linux.img'), 'image');
  writeFileSync(join(imagesDir, 'vmlinuz'), 'kernel');
  writeFileSync(join(imagesDir, 'initrd.img'), 'initrd');
  writeFileSync(join(imagesDir, 'guest-bootstrap.sh'), '#!/bin/sh\n');
  writeFileSync(
    join(imagesDir, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        architecture: 'arm64',
        imageFormat: 'raw',
        image: 'base-linux.img',
        imageSha256: sha256('image'),
        boot: {
          loader: 'linux',
          kernel: 'vmlinuz',
          kernelSha256: sha256('kernel'),
          initrd: 'initrd.img',
          initrdSha256: sha256('initrd'),
          commandLine: 'console=hvc0 root=/dev/vda rw systemd.unit=multi-user.target',
        },
        bootstrap: 'guest-bootstrap.sh',
        bootstrapSha256: sha256('#!/bin/sh\n'),
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(vmDir, 'macos-vm-runner'),
    [
      `#!${process.execPath}`,
      'const args = process.argv.slice(2);',
      "const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';",
      "const command = args.slice(args.indexOf('--') + 1).join(' ');",
      health === 'failed' ? 'if (true) {' : 'if (false) {',
      "  console.log(JSON.stringify({ ok: false, mode: 'macos-vm', state: 'unavailable', message: 'E2E VM unavailable' }));",
      '  process.exit(0);',
      '}',
      `if (args[0] === 'exec' && command === ${JSON.stringify(JOURNEY_COMMAND.replace('journey.txt', '/workspace/journey.txt'))}) {`,
      "  const fs = require('node:fs');",
      "  const path = require('node:path');",
      "  fs.appendFileSync(path.join(option('--workspace'), 'journey.txt'), 'approved change\\n');",
      '}',
      "if (args[0] === 'exec') require('node:fs').appendFileSync(require('node:path').join(option('--workspace'), '.runner-invocations'), command + '\\n');",
      'const emitResult = () => console.log(JSON.stringify({',
      '  ok: true,',
      "  mode: 'macos-vm',",
      "  state: 'ready',",
      "  message: 'E2E VM ready',",
      '  exitCode: 0,',
      "  stdout: `VM_CWD:/workspace\\nVM_COMMAND:${command}\\nVM_WORKSPACE:${option('--workspace') ? '/workspace' : 'missing'}\\nVM_SECRET_MISSING:true\\n`,",
      "  stderr: '',",
      '  durationMs: 7,',
      '}));',
      `if (args[0] === 'exec' && command === ${JSON.stringify(STOP_GUEST_COMMAND)}) {`,
      "  const fs = require('node:fs');",
      "  const path = require('node:path');",
      "  const workspace = option('--workspace');",
      "  process.on('SIGTERM', () => {}); // Explicitly non-cooperative transport fixture, never a real-VM claim.",
      `  fs.appendFileSync(path.join(workspace, ${JSON.stringify(STOP_STARTED)}), 'started\\n');`,
      '  let ticks = 0;',
      '  const gate = setInterval(() => {',
      '    ticks++;',
      `    if (fs.existsSync(path.join(workspace, ${JSON.stringify(STOP_RELEASE)}))) {`,
      '      clearInterval(gate);',
      `      fs.appendFileSync(path.join(workspace, ${JSON.stringify(STOP_LATE)}), 'late\\n');`,
      '      emitResult();',
      '    } else if (ticks >= 300) { clearInterval(gate); process.exitCode = 73; }',
      '  }, 100);',
      '} else emitResult();',
      '',
    ].join('\n'),
  );
  chmodSync(join(vmDir, 'macos-vm-runner'), 0o755);
}

function assertPackagedResources(resourcesDir: string): void {
  const required = [
    join(resourcesDir, 'macos-vm', 'macos-vm-runner'),
    join(resourcesDir, 'macos-vm', 'package-manifest.json'),
    join(resourcesDir, 'macos-vm', 'images', 'manifest.json'),
  ];
  for (const path of required) {
    if (!existsSync(path)) {
      throw new Error(`Packaged macOS VM resource is missing: ${path}`);
    }
  }
}

function startRealVmRunner(fixture: VmFixture): unknown {
  if (!fixture.realVmRuntimeDir) return undefined;
  const helperPath = join(fixture.resourcesDir, 'macos-vm', 'macos-vm-runner');
  fixture.vmStartAttempted = true;
  let status: string;
  try {
    status = execFileSync(
      helperPath,
      ['start', '--runtime-dir', fixture.realVmRuntimeDir, '--workspace', fixture.projectDir],
      { encoding: 'utf8', timeout: 90_000 },
    );
  } finally {
    try {
      const text = readFileSync(
        join(fixture.realVmRuntimeDir, 'state', 'daemon.pid'),
        'utf8',
      ).trim();
      if (/^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)))
        fixture.vmDaemonPid = Number(text);
    } catch {
      /* Missing identity must fail teardown rather than signal an unknown process. */
    }
  }
  const parsed = JSON.parse(status) as { ok?: boolean; message?: string; state?: string };
  if (!parsed.ok || parsed.state !== 'ready') {
    throw new Error(`macOS VM runner did not start: ${status}`);
  }
  return parsed;
}

async function stopRealVmRunner(fixture: VmFixture): Promise<void> {
  if (!fixture.realVmRuntimeDir) return;
  const outcome = await releaseOwnedVmFixture({
    runtimeDir: fixture.realVmRuntimeDir,
    helperPath: join(fixture.resourcesDir, 'macos-vm', 'macos-vm-runner'),
    projectDir: fixture.projectDir,
    started: fixture.vmStartAttempted ?? false,
    daemonPid: fixture.vmDaemonPid,
  });
  fixture.vmTeardownFailed = !outcome.ok;
  if (!outcome.ok) failedVmTeardowns.add(test.info());
  const attached = await attemptStartupEvidenceAttachment(() =>
    test.info().attach('vm-teardown', {
      body: Buffer.from(JSON.stringify(outcome)),
      contentType: 'application/json',
    }),
  );
  if (!attached) failedStartupAttachments.add(test.info());
}

function writeVmEvidence(fixture: VmFixture, scenario: string, runnerStatus: unknown): void {
  if (!fixture.evidenceDir) return;
  mkdirSync(fixture.evidenceDir, { recursive: true });
  const packageManifestPath = join(fixture.resourcesDir, 'macos-vm', 'package-manifest.json');
  const assetManifestPath = join(fixture.resourcesDir, 'macos-vm', 'images', 'manifest.json');
  writeFileSync(
    join(fixture.evidenceDir, `${scenario}.json`),
    `${JSON.stringify(
      {
        scenario,
        commandRunner: 'macos-vm',
        projectPathVisibleToUser: false,
        hostSecretVisibleToUser: false,
        packageManifest: JSON.parse(readFileSync(packageManifestPath, 'utf8')),
        assetManifest: JSON.parse(readFileSync(assetManifestPath, 'utf8')),
        runnerStatus,
      },
      null,
      2,
    )}\n`,
  );
}

function writeRuntimeHealth(
  runtimeDir: string,
  health: VmFixtureHealth,
): NodeJS.Timeout | undefined {
  const vmRuntimeDir = join(runtimeDir, 'data', 'vm');
  const stateDir = join(vmRuntimeDir, 'state');
  const logsDir = join(vmRuntimeDir, 'logs');
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  if (health === 'ready') {
    writeFileSync(join(stateDir, 'runner.sock'), '');
    writeFileSync(join(stateDir, 'daemon.pid'), `${process.pid}\n`);
    const heartbeatPath = join(stateDir, 'daemon.heartbeat');
    writeFileSync(heartbeatPath, `${Date.now()}\n`);
    const timer = setInterval(() => {
      writeFileSync(heartbeatPath, `${Date.now()}\n`);
    }, 1_000);
    timer.unref();
    return timer;
  }
  writeFileSync(join(logsDir, 'last-error.log'), 'E2E VM unavailable');
  return undefined;
}

function seedDesktopDatabase(sqlitePath: string): void {
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const seedPath = join(repoRoot, 'packages/db/dist/seed/run.js');
  try {
    execFileSync(process.execPath, [seedPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        SQLITE_PATH: sqlitePath,
        E2E_SEED: '1',
        SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
      },
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(
      [
        `Failed to seed packaged VM E2E database: ${sqlitePath}`,
        `Seed script: ${seedPath}`,
        execFileErrorDetails(error),
      ].join('\n'),
    );
  }
}

function execFileErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const details: string[] = [error.message];
  const maybeProcessError = error as Error & {
    readonly status?: number;
    readonly signal?: NodeJS.Signals;
    readonly stdout?: string | Buffer;
    readonly stderr?: string | Buffer;
  };
  if (maybeProcessError.status !== undefined) details.push(`status: ${maybeProcessError.status}`);
  if (maybeProcessError.signal) details.push(`signal: ${maybeProcessError.signal}`);
  const stdout = outputToString(maybeProcessError.stdout).trim();
  const stderr = outputToString(maybeProcessError.stderr).trim();
  if (stdout) details.push(`stdout:\n${stdout}`);
  if (stderr) details.push(`stderr:\n${stderr}`);
  return details.join('\n');
}

function outputToString(output: string | Buffer | undefined): string {
  if (output === undefined) return '';
  return typeof output === 'string' ? output : output.toString('utf8');
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
