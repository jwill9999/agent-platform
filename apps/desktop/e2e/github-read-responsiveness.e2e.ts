import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { DiagnosticReport } from '@agent-platform/contracts';
import {
  replyJourney,
  submitReply,
  expectPersistedReply,
  exportReplyReport,
  type ReplyJourney,
} from './support/chatReplyJourney.js';
import {
  contextTokenRepoRoot,
  launchContextTokenFixture,
  reopenContextTokenSession,
  exportContextTokenReport,
  snapshotContextTokenDb,
  snapshotContextTokenDiagnosticStore,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
type CliEvent = {
  event: string;
  epoch: string;
  kind: string;
  pid: number;
  at: number;
  args: string[];
};
const controlPath = (f: ContextTokenFixture) =>
  join(f.projectDir, '.git', 'github-read-control.json');
function configure(f: ContextTokenFixture, epoch: string, mode: 'healthy' | 'hold' | 'timeout') {
  writeFileSync(
    controlPath(f),
    JSON.stringify({ fixture: 'github-read-responsiveness-v1', epoch, mode }),
  );
}
function events(f: ContextTokenFixture, epoch: string): CliEvent[] {
  const path = join(f.projectDir, '.git', 'github-read-events.jsonl');
  return existsSync(path)
    ? readFileSync(path, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as CliEvent)
        .filter((row) => row.epoch === epoch)
    : [];
}
function release(f: ContextTokenFixture, epoch: string) {
  writeFileSync(join(f.projectDir, '.git', `github-read-release-${epoch}`), 'release');
}
function prepare(f: ContextTokenFixture) {
  execFileSync(
    '/usr/bin/git',
    ['remote', 'add', 'origin', 'https://github.com/fixture/github-read-owned.git'],
    { cwd: f.projectDir },
  );
  Object.assign(f.launchOptions.env, {
    AGENT_PLATFORM_GH_BINARY: join(contextTokenRepoRoot, 'e2e/support/github-read-cli.mjs'),
  });
  configure(f, 'setup', 'healthy');
}
async function heldActivity(ctx: ReplyJourney, epoch: string, mode: 'hold' | 'timeout' = 'hold') {
  const button = ctx.page.getByRole('button', { name: 'Refresh Project activity', exact: true });
  // A tool's automatic activity refresh can disable Refresh between its readiness
  // assertion and click. Do not wait behind the very child processes we will hold.
  // Settle the alternate real view first, then mount Activity via its independent tab.
  await ctx.page.getByRole('tab', { name: 'Git & GitHub', exact: true }).click();
  await expect(
    ctx.page.getByRole('button', { name: 'Refresh Git state', exact: true }),
  ).toBeEnabled();
  configure(ctx.fixture, epoch, mode);
  ctx.cleanup.push(async () => release(ctx.fixture, epoch));
  await ctx.page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect
    .poll(
      () =>
        new Set(
          events(ctx.fixture, epoch)
            .filter((row) => row.event === 'ready')
            .map((row) => row.kind),
        ),
    )
    .toEqual(new Set(['view', 'list']));
  ctx.evidence[`${epoch}-ready`] = { observedAt: Date.now(), rows: events(ctx.fixture, epoch) };
  return button;
}
function stillHeld(ctx: ReplyJourney, epoch: string) {
  const rows = events(ctx.fixture, epoch);
  expect(rows.filter((row) => row.event === 'ready').length).toBeGreaterThanOrEqual(2);
  expect(rows.filter((row) => row.event !== 'ready')).toEqual([]);
  ctx.evidence[`${epoch}-before-release`] = { observedAt: Date.now(), rows };
}
async function probes(ctx: ReplyJourney) {
  const rows = [];
  for (const path of ['/health', `/v1/sessions/${ctx.session.id}`]) {
    const start = performance.now();
    const response = await fetch(`http://127.0.0.1:${ctx.fixture.backendPort}${path}`, {
      signal: AbortSignal.timeout(1000),
    });
    await response.text();
    const elapsedMs = performance.now() - start;
    expect(response.ok).toBe(true);
    expect(elapsedMs).toBeLessThan(1000);
    rows.push({ path, elapsedMs, status: response.status });
  }
  ctx.evidence.probes = rows;
}
function assertReport(report: DiagnosticReport) {
  for (const phase of ['context', 'model', 'tool']) {
    expect(report.events.some((row) => row.event.phase === phase)).toBe(true);
  }
  expect(report.events.some((row) => row.event.runId && row.event.attempt)).toBe(true);
  expect(report.coverage).toMatchObject({
    durable: true,
    verified: true,
    pending: 0,
    dropped: 0,
    truncated: false,
  });
}

for (const mode of ['chromium', 'electron'] as const) {
  test(`GR-T08/09 ${mode}: held GitHub reads permit real tool approval, diagnostics and denied-action settlement`, async () => {
    test.setTimeout(150_000);
    await replyJourney(
      test.info(),
      mode,
      async (ctx) => {
        const effect = join(ctx.fixture.projectDir, 'github-read-effect.txt');
        writeFileSync(effect, 'unchanged');
        ctx.replies.push(
          {
            reply: {
              kind: 'tools',
              calls: [
                {
                  id: 'gh-approved-write',
                  name: 'sys_write_file',
                  args: { path: effect, content: 'GH_PRIVATE_EFFECT_CANARY' },
                },
              ],
            },
          },
          { reply: { kind: 'text', text: 'Approved write completed while GitHub was waiting.' } },
        );
        // Setup and external model/tool proposal precede the bounded hold; actual approved effect,
        // continuation, unrelated probes and export must all finish before either CLI is released.
        await submitReply(ctx, 'GH_PRIVATE_PROMPT_CANARY write the disposable file.');
        const card = ctx.page.getByTestId('approval-card');
        await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
        await heldActivity(ctx, 'allowed');
        await probes(ctx);
        await card.getByRole('button', { name: 'Approve', exact: true }).click();
        await expectPersistedReply(ctx, 'Approved write completed while GitHub was waiting.');
        expect(readFileSync(effect, 'utf8')).toBe('GH_PRIVATE_EFFECT_CANARY');
        const completed = snapshotContextTokenDb(ctx.fixture, ctx.session.id);
        expect(
          completed.audits.filter(
            (row) => row.tool_name === 'sys_write_file' && row.status === 'success',
          ),
        ).toHaveLength(1);
        const report = await exportReplyReport(ctx, 'held-success.json', [
          ctx.fixture.root,
          'GH_PRIVATE_PROMPT_CANARY',
          'GH_PRIVATE_EFFECT_CANARY',
        ]);
        assertReport(report);
        if (mode === 'chromium') ctx.reportPaths.push(join(ctx.fixture.root, 'held-success.json'));
        stillHeld(ctx, 'allowed');
        release(ctx.fixture, 'allowed');
        configure(ctx.fixture, 'idle', 'healthy');
        await expect
          .poll(
            () => events(ctx.fixture, 'allowed').filter((row) => row.event === 'completed').length,
          )
          .toBeGreaterThanOrEqual(2);
        await expect(
          ctx.page.getByRole('button', { name: 'Refresh Project activity', exact: true }),
        ).toBeEnabled();
        ctx.evidence.successDb = completed;
        ctx.evidence.diagnosticStore = snapshotContextTokenDiagnosticStore(
          ctx.fixture,
          ctx.session.id,
        );
        const denied = join(ctx.fixture.projectDir, 'must-not-exist.txt');
        ctx.replies.push(
          {
            reply: {
              kind: 'tools',
              calls: [
                {
                  id: 'gh-denied-write',
                  name: 'sys_write_file',
                  args: { path: denied, content: 'GH_DENIED_SECRET_CANARY' },
                },
              ],
            },
          },
          { reply: { kind: 'text', text: 'The denied action was not executed.' } },
        );
        await submitReply(ctx, 'GH_DENIED_PROMPT_CANARY propose another write.');
        const pending = ctx.page
          .getByTestId('approval-card')
          .filter({ has: ctx.page.getByRole('button', { name: 'Deny', exact: true }) });
        await expect(pending).toHaveCount(1);
        await heldActivity(ctx, 'denied');
        await pending.getByRole('button', { name: 'Deny', exact: true }).click();
        await expectPersistedReply(
          ctx,
          'The denied action was not executed.',
          ctx.session.id,
          '[APPROVAL_REJECTED] Human rejected tool execution. The denied action was not executed.',
        );
        expect(existsSync(denied)).toBe(false);
        const deniedSnapshot = snapshotContextTokenDb(ctx.fixture, ctx.session.id);
        expect(deniedSnapshot.approvals.some((row) => row.status === 'rejected')).toBe(true);
        expect(
          deniedSnapshot.audits.filter(
            (row) => row.tool_name === 'sys_write_file' && row.status === 'success',
          ),
        ).toHaveLength(1);
        const deniedReport = await exportReplyReport(ctx, 'held-denied.json', [
          ctx.fixture.root,
          'GH_DENIED_SECRET_CANARY',
          'GH_DENIED_PROMPT_CANARY',
          'GH_PRIVATE_EFFECT_CANARY',
        ]);
        expect(
          deniedReport.events.some(
            (row) => row.event.phase === 'approval' && row.event.outcome !== 'started',
          ),
        ).toBe(true);
        if (mode === 'chromium') ctx.reportPaths.push(join(ctx.fixture.root, 'held-denied.json'));
        stillHeld(ctx, 'denied');
        release(ctx.fixture, 'denied');
        configure(ctx.fixture, 'idle-after-denial', 'healthy');
        await expect
          .poll(
            () => events(ctx.fixture, 'denied').filter((row) => row.event === 'completed').length,
          )
          .toBeGreaterThanOrEqual(2);
        ctx.evidence.deniedDb = deniedSnapshot;
        if (mode === 'electron') {
          await ctx.page
            .context()
            .tracing.stop({ path: test.info().outputPath('before-restart.zip') });
          await ctx.app.close();
          const restartedPath = join(ctx.fixture.root, 'restarted.json');
          const app = await launchContextTokenFixture(ctx.fixture, [restartedPath]);
          ctx.cleanup.push(async () => app.close());
          const page = await app.firstWindow();
          await reopenContextTokenSession(page, ctx.fixture, ctx.session);
          await expect(
            page.getByText('The denied action was not executed.', { exact: true }),
          ).toBeVisible();
          const restartReport = await exportContextTokenReport(page, restartedPath, [
            ctx.fixture.root,
            'GH_DENIED_SECRET_CANARY',
            'GH_PRIVATE_EFFECT_CANARY',
          ]);
          expect(restartReport.events.map((row) => row.event.eventId)).toEqual(
            expect.arrayContaining(deniedReport.events.map((row) => row.event.eventId)),
          );
          const restarted = snapshotContextTokenDb(ctx.fixture, ctx.session.id);
          expect(restarted.messages).toEqual(deniedSnapshot.messages);
          expect(restarted.audits).toEqual(deniedSnapshot.audits);
          expect(existsSync(denied)).toBe(false);
          expect(readFileSync(effect, 'utf8')).toBe('GH_PRIVATE_EFFECT_CANARY');
          ctx.evidence.restarted = { report: restartReport, db: restarted };
          ctx.reportPaths.push(restartedPath);
        }
        ctx.evidence.cli = {
          allowed: events(ctx.fixture, 'allowed'),
          denied: events(ctx.fixture, 'denied'),
        };
      },
      prepare,
    );
  });
}

test('GR-T07/09 Electron: real BFF abort reclaims child; timeout recovers with healthy refresh', async () => {
  test.setTimeout(100_000);
  await replyJourney(
    test.info(),
    'electron',
    async (ctx) => {
      configure(ctx.fixture, 'abort', 'hold');
      // Actual fetch through the renderer BFF, not a route mock or navigation inference.
      await ctx.page.evaluate((id) => {
        const state = globalThis as typeof globalThis & {
          ghAbort?: AbortController;
          ghOutcome?: string;
        };
        state.ghAbort = new AbortController();
        void fetch(`/api/v1/projects/${id}/git/checks`, { signal: state.ghAbort.signal })
          .then(() => {
            state.ghOutcome = 'completed';
          })
          .catch((error: unknown) => {
            state.ghOutcome = error instanceof Error ? error.name : 'unknown';
          });
      }, ctx.session.projectId);
      await expect
        .poll(() => events(ctx.fixture, 'abort').some((row) => row.event === 'ready'))
        .toBe(true);
      await ctx.page.evaluate(() =>
        (globalThis as typeof globalThis & { ghAbort?: AbortController }).ghAbort!.abort(),
      );
      await expect
        .poll(() => events(ctx.fixture, 'abort').some((row) => row.event === 'terminated'), {
          timeout: 1500,
        })
        .toBe(true);
      expect(events(ctx.fixture, 'abort').some((row) => row.event === 'safety-expired')).toBe(
        false,
      );
      configure(ctx.fixture, 'after-abort', 'healthy');
      const button = await heldActivity(ctx, 'timeout', 'timeout');
      await probes(ctx);
      await expect(button).toBeEnabled({ timeout: 11_000 });
      await expect(
        ctx.page.getByText('Checks are unavailable for this branch.', { exact: true }),
      ).toBeVisible();
      expect(
        events(ctx.fixture, 'timeout').filter((row) => row.event === 'terminated').length,
      ).toBeGreaterThanOrEqual(2);
      expect(events(ctx.fixture, 'timeout').some((row) => row.event === 'safety-expired')).toBe(
        false,
      );
      configure(ctx.fixture, 'recovery', 'healthy');
      const responses = Promise.all([
        ctx.page.waitForResponse((r) =>
          r.url().endsWith(`/projects/${ctx.session.projectId}/git/checks`),
        ),
        ctx.page.waitForResponse((r) =>
          r.url().endsWith(`/projects/${ctx.session.projectId}/github/pull-requests`),
        ),
      ]);
      await button.click();
      const [checks, prs] = await responses;
      expect((await checks.json()).data).toMatchObject({
        available: true,
        repositoryName: basename(ctx.fixture.projectDir),
        currentBranch: 'context-fixture',
        pullRequestNumber: 71,
        summary: { success: 1 },
      });
      expect((await prs.json()).data).toMatchObject({
        available: true,
        pullRequests: [{ number: 71, headRefName: 'context-fixture' }],
      });
      await expect(button).toBeEnabled();
      ctx.evidence.cli = {
        abort: events(ctx.fixture, 'abort'),
        timeout: events(ctx.fixture, 'timeout'),
        recovery: events(ctx.fixture, 'recovery'),
      };
    },
    prepare,
  );
});
