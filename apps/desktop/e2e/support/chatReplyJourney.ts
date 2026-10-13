import { expect, type TestInfo } from '@playwright/test';
import { chromium, type Browser, type ElectronApplication, type Page } from 'playwright';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DiagnosticReportSchema, type Agent, type SessionRecord } from '@agent-platform/contracts';
import {
  CONTEXT_PROVIDER_KEY,
  contextTokenRepoRoot,
  createContextTokenFixture,
  createContextTokenAgent,
  launchContextTokenFixture,
  openContextTokenProject,
  readContextTokenApi,
  snapshotContextTokenDb,
  removeContextTokenFixture,
  recordContextTokenEvidence,
  exportContextTokenReport,
  type ContextTokenFixture,
} from './contextTokenFixture.js';
import { startChatReplyProvider, type ControlledReply } from './chatReplyFixture.js';

export type ReplyJourney = {
  mode: 'chromium' | 'electron';
  fixture: ContextTokenFixture;
  app: ElectronApplication;
  page: Page;
  agent: Agent;
  session: { id: string; projectId: string };
  replies: ControlledReply[];
  evidence: Record<string, unknown>;
  cleanup: Array<() => Promise<void>>;
  posts: Array<{ path: string; body: unknown }>;
  responses: Array<{ path: string; requestId: string | null; sessionId: string | undefined }>;
  snapshots: () => Record<string, unknown>;
  nextReport: number;
  reportPaths: string[];
  progress: ReplyProgress;
};

type ReplyProgressPhase =
  | 'provider-start'
  | 'fixture-create'
  | 'app-launch'
  | 'first-window'
  | 'agent-create'
  | 'project-binding'
  | 'browser-launch'
  | 'browser-page'
  | 'initial-navigation'
  | 'initial-restoration'
  | 'trace-start'
  | 'scenario'
  | 'journey'
  | 'cleanup-barriers'
  | 'cleanup-snapshot'
  | 'cleanup-capture'
  | 'cleanup-screenshot'
  | 'cleanup-trace'
  | 'cleanup-evidence'
  | 'cleanup-processes'
  | 'cleanup-artifacts'
  | 'cleanup-provider'
  | 'export-native'
  | 'export-click'
  | 'export-download'
  | 'export-save'
  | 'export-validate';
type ReplyProgress = (
  phase: ReplyProgressPhase,
  outcome?: 'started' | 'completed' | 'failed',
) => void;

/** Persist before each phase so an outer timeout cannot erase the last owned wait. */
function createReplyProgress(
  info: TestInfo,
  mode: ReplyJourney['mode'],
  failures: unknown[],
): ReplyProgress {
  const startedAt = Date.now();
  const rows: Array<{
    phase: ReplyProgressPhase;
    outcome: 'started' | 'completed' | 'failed';
    elapsedMs: number;
  }> = [];
  let sequence = 0;
  let writeFailed = false;
  return (phase, outcome = 'started') => {
    rows.push({ phase, outcome, elapsedMs: Date.now() - startedAt });
    if (rows.length > 128) rows.shift();
    sequence += 1;
    // Only fixed phase names, timing and mode: no request/response contents or credentials.
    try {
      writeFileSync(
        info.outputPath('reply-progress.json'),
        JSON.stringify({ mode, sequence, omitted: sequence - rows.length, rows }, null, 2),
      );
    } catch {
      // Evidence failure must fail the journey without preventing independent owned cleanup.
      if (!writeFailed) failures.push(new Error('Reply progress metadata could not be persisted'));
      writeFailed = true;
    }
  };
}

export async function replyJourney(
  info: TestInfo,
  mode: ReplyJourney['mode'],
  run: (ctx: ReplyJourney) => Promise<void>,
  prepare?: (fixture: ContextTokenFixture) => Promise<void> | void,
) {
  const failures: unknown[] = [];
  const progress = createReplyProgress(info, mode, failures);
  const replies: ControlledReply[] = [];
  progress('provider-start');
  const provider = await startChatReplyProvider(replies);
  let fixture: ContextTokenFixture | undefined;
  let app: ElectronApplication | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let ctx: ReplyJourney | undefined;
  let traced = false;
  let passed = false;
  try {
    progress('fixture-create');
    fixture = await createContextTokenFixture(provider);
    await prepare?.(fixture);
    const reportPaths = ['success', 'failure', 'approval'].map((name) =>
      join(fixture!.root, `${name}.json`),
    );
    progress('app-launch');
    app = await launchContextTokenFixture(fixture, reportPaths);
    progress('first-window');
    const native = await app.firstWindow();
    progress('agent-create');
    const agent = await createContextTokenAgent(fixture);
    progress('project-binding');
    const session = await openContextTokenProject(native, fixture, agent);
    if (mode === 'chromium') {
      progress('browser-launch');
      browser = await chromium.launch();
      progress('browser-page');
      page = await browser.newPage();
      progress('initial-navigation');
      await page.goto(
        `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
      );
      progress('initial-restoration');
      // Finish this initial restoration before a scenario installs one-shot read barriers.
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: 'Press Enter to send, Shift+Enter for new line' }),
      ).toBeVisible();
    } else page = native;
    progress('trace-start');
    await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    traced = true;
    const { posts, responses } = observeReplyTraffic(page);
    const sourceHashes = replySourceHashes();
    ctx = {
      mode,
      fixture,
      app,
      page,
      agent,
      session,
      replies,
      evidence: { sourceHashes },
      cleanup: [],
      posts,
      responses,
      nextReport: 0,
      reportPaths,
      progress,
      snapshots: () => ({ sourceSession: snapshotContextTokenDb(fixture!, session.id) }),
    };
    progress('scenario');
    await run(ctx);
    progress('scenario', 'completed');
    expect(provider.requests).toHaveLength(replies.length);
    expect(provider.errors).toEqual([]);
    passed = true;
  } catch (error) {
    failures.push(error);
    progress('journey', 'failed');
  } finally {
    await finishReplyJourney(
      info,
      mode,
      { fixture, app, browser, page, ctx, traced, passed, progress },
      replies,
      provider,
      failures,
    );
  }
  if (failures.length)
    throw new AggregateError(failures, 'Connected reply journey failed', { cause: failures[0] });
}

function observeReplyTraffic(page: Page) {
  const posts: ReplyJourney['posts'] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() === 'POST' &&
      (url.pathname === '/api/chat' ||
        url.pathname.includes('/resume') ||
        url.pathname.includes('/approval-requests/'))
    )
      posts.push({ path: url.pathname, body: request.postDataJSON() });
  });
  const responses: ReplyJourney['responses'] = [];
  page.on('response', (response) => {
    const request = response.request();
    const path = new URL(response.url()).pathname;
    if (request.method() !== 'POST' || (path !== '/api/chat' && !path.endsWith('/resume'))) return;
    const body = request.postDataJSON() as { sessionId?: string };
    responses.push({
      path,
      requestId: response.headers()['x-request-id'] ?? null,
      sessionId: body.sessionId ?? /\/sessions\/([^/]+)\/resume$/.exec(path)?.[1],
    });
  });
  return { posts, responses };
}

function replySourceHashes() {
  const repo = contextTokenRepoRoot;
  return Object.fromEntries(
    [
      'apps/web/hooks/use-harness-chat.ts',
      'apps/web/hooks/use-sessions.ts',
      'apps/web/app/page.tsx',
      'apps/web/components/chat/chat.tsx',
      'apps/web/components/chat/chat-input.tsx',
      'apps/web/components/ide/ide-with-chat.tsx',
      'apps/desktop/e2e/chat-reply-reliability.e2e.ts',
      'apps/desktop/e2e/support/chatReplyFixture.ts',
      'apps/desktop/e2e/support/chatReplyJourney.ts',
      'apps/web/.next/BUILD_ID',
    ].map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(join(repo, file)))
        .digest('hex'),
    ]),
  );
}

type ReplyResources = {
  fixture: ContextTokenFixture | undefined;
  app: ElectronApplication | undefined;
  browser: Browser | undefined;
  page: Page | undefined;
  ctx: ReplyJourney | undefined;
  traced: boolean;
  passed: boolean;
  progress: ReplyProgress;
};

async function settleReplyCleanup(
  actions: Array<Promise<unknown> | undefined>,
  failures: unknown[],
) {
  const pending = actions.filter((action): action is Promise<unknown> => action !== undefined);
  const results = await Promise.allSettled(pending);
  for (const result of results) {
    if (result.status === 'rejected') failures.push(result.reason);
  }
}

async function finishReplyContext(
  ctx: ReplyJourney,
  replies: ControlledReply[],
  failures: unknown[],
) {
  ctx.progress('cleanup-barriers');
  const failureCount = failures.length;
  await settleReplyCleanup(
    ctx.cleanup.map((close) => close()),
    failures,
  );
  ctx.progress('cleanup-barriers', failures.length === failureCount ? 'completed' : 'failed');
  for (const reply of replies) reply.gate?.release();
  try {
    ctx.progress('cleanup-snapshot');
    ctx.evidence.finalDb = ctx.snapshots();
    ctx.progress('cleanup-snapshot', 'completed');
  } catch (error) {
    failures.push(error);
  }
}

async function captureReplyEvidence(
  info: TestInfo,
  mode: ReplyJourney['mode'],
  fixture: ContextTokenFixture,
  resources: ReplyResources,
  failures: unknown[],
) {
  const { ctx, page, passed, traced, progress } = resources;
  try {
    const evidence = {
      ...ctx?.evidence,
      mode,
      assertionsPassed: passed,
      failures: failures.map((error) => (error instanceof Error ? error.message : String(error))),
      posts: ctx?.posts,
      responses: ctx?.responses,
    };
    if (page && !page.isClosed()) {
      progress('cleanup-screenshot');
      await page.screenshot({ path: info.outputPath('reply-ui.png') });
      if (traced) {
        progress('cleanup-trace');
        await page.context().tracing.stop({ path: info.outputPath('reply-trace.zip') });
      }
    }
    progress('cleanup-evidence');
    await recordContextTokenEvidence(
      info,
      fixture,
      info.title,
      evidence,
      page && !page.isClosed() ? page : undefined,
    );
    writeFileSync(info.outputPath('reply-evidence.json'), JSON.stringify(evidence, null, 2));
  } catch (error) {
    failures.push(error);
  }
}

function copyReplyArtifact(copy: () => void, failures: unknown[]) {
  try {
    copy();
  } catch (error) {
    failures.push(error);
  }
}

function preserveReplyArtifacts(
  info: TestInfo,
  fixture: ContextTokenFixture,
  ctx: ReplyJourney | undefined,
  failures: unknown[],
) {
  for (const name of ['agent.sqlite', 'diagnostics.sqlite']) {
    copyReplyArtifact(() => {
      const path = join(fixture.runtimeDir, 'data', name);
      if (existsSync(path)) copyFileSync(path, info.outputPath(name));
    }, failures);
  }
  for (const path of ctx?.reportPaths ?? []) {
    copyReplyArtifact(() => {
      if (existsSync(path))
        copyFileSync(path, info.outputPath(`diagnostic-${path.split('/').at(-1)}`));
    }, failures);
  }
  try {
    removeContextTokenFixture(fixture);
  } catch (error) {
    failures.push(error);
  }
}

async function finishReplyJourney(
  info: TestInfo,
  mode: ReplyJourney['mode'],
  resources: ReplyResources,
  replies: ControlledReply[],
  provider: Awaited<ReturnType<typeof startChatReplyProvider>>,
  failures: unknown[],
) {
  const { ctx, fixture, browser, app, progress } = resources;
  if (ctx) await finishReplyContext(ctx, replies, failures);
  if (fixture) {
    progress('cleanup-capture');
    await captureReplyEvidence(info, mode, fixture, resources, failures);
    progress('cleanup-processes');
    const failureCount = failures.length;
    await settleReplyCleanup([browser?.close(), app?.close()], failures);
    progress('cleanup-processes', failures.length === failureCount ? 'completed' : 'failed');
    progress('cleanup-artifacts');
    preserveReplyArtifacts(info, fixture, ctx, failures);
  }
  try {
    progress('cleanup-provider');
    await provider.close();
    progress('cleanup-provider', 'completed');
  } catch (error) {
    failures.push(error);
    progress('cleanup-provider', 'failed');
  }
  progress('journey', failures.length ? 'failed' : 'completed');
}

export const replyInput = (page: Page) => page.getByPlaceholder('Ask about this Project...');
export const replySubmit = (page: Page) =>
  replyInput(page).locator('xpath=ancestor::form').locator('button[type="submit"]');
export async function selectReplySession(page: Page, title: string) {
  await page.getByRole('button', { name: 'Open sessions menu', exact: true }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^${title}`) }).click();
}
/** Sessions is disabled while streaming; use the actual available workspace navigation. */
export async function leaveStreamingReplyForSession(ctx: ReplyJourney, title: string) {
  await ctx.page.getByRole('button', { name: 'Workspaces', exact: true }).click();
  await expect(
    ctx.page.getByRole('heading', { name: 'Choose a workspace', exact: true }),
  ).toBeVisible();
  await ctx.page.locator(`a[href="/?projectId=${ctx.session.projectId}"]`).click();
  await expect(
    ctx.page.getByRole('button', { name: 'Open sessions menu', exact: true }),
  ).toBeEnabled();
  await selectReplySession(ctx.page, title);
}
export async function createReplySession(ctx: ReplyJourney, title: string) {
  const session = await readContextTokenApi<SessionRecord>(ctx.fixture, 'sessions', {
    method: 'POST',
    body: JSON.stringify({
      agentId: ctx.agent.id,
      mode: 'project',
      projectId: ctx.session.projectId,
    }),
  });
  return readContextTokenApi<SessionRecord>(ctx.fixture, `sessions/${session.id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...session, title }),
  });
}
export async function submitReply(ctx: ReplyJourney, prompt: string) {
  await replyInput(ctx.page).fill(prompt);
  await expect(replySubmit(ctx.page)).toBeEnabled();
  await replyInput(ctx.page).press('Enter');
}
export async function expectPersistedReply(
  ctx: ReplyJourney,
  text: string,
  sessionId = ctx.session.id,
  displayedText = text,
) {
  await expect(ctx.page.getByText(displayedText, { exact: true })).toHaveCount(1);
  await expect(ctx.page.getByText(displayedText, { exact: true })).toBeVisible();
  await expect
    .poll(
      () =>
        snapshotContextTokenDb(ctx.fixture, sessionId).messages.filter(
          (row) => row.role === 'assistant' && row.content === text,
        ).length,
    )
    .toBe(1);
}
export async function exportReplyReport(
  ctx: ReplyJourney,
  filename: string,
  forbidden: string[],
  sessionId = ctx.session.id,
) {
  const destination =
    ctx.mode === 'electron' ? ctx.reportPaths[ctx.nextReport++]! : join(ctx.fixture.root, filename);
  let report;
  if (ctx.mode === 'electron') {
    ctx.progress('export-native');
    report = await exportContextTokenReport(ctx.page, destination, forbidden);
  } else {
    const download = ctx.page.waitForEvent('download');
    ctx.progress('export-click');
    await ctx.page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
    ctx.progress('export-download');
    const downloaded = await download;
    ctx.progress('export-save');
    await downloaded.saveAs(destination);
    const raw = readFileSync(destination, 'utf8');
    for (const value of [...forbidden, CONTEXT_PROVIDER_KEY]) expect(raw).not.toContain(value);
    report = DiagnosticReportSchema.parse(JSON.parse(raw));
    expect(report.coverage).toMatchObject({
      durable: true,
      verified: true,
      dropped: 0,
      pending: 0,
      truncated: false,
    });
  }
  ctx.progress('export-validate');
  expect('sessionId' in report.scope).toBe(true);
  if (!('sessionId' in report.scope)) throw new Error('Expected session-scoped diagnostic report');
  expect(report.scope.sessionId).toBe(sessionId);
  expect(
    report.events.every((row) => !row.event.sessionId || row.event.sessionId === sessionId),
  ).toBe(true);
  const linked = ctx.responses.filter((response) => response.sessionId === sessionId);
  expect(linked.length).toBeGreaterThan(0);
  for (const response of linked) {
    expect(response.requestId).not.toBeNull();
    expect(report.events.some((row) => row.event.requestId === response.requestId)).toBe(true);
  }
  ctx.evidence[filename] = report;
  ctx.progress('export-validate', 'completed');
  return report;
}
