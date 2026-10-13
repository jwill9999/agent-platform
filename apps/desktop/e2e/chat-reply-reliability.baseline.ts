import { expect, test } from '@playwright/test';
import { chromium, type Browser, type ElectronApplication, type Page } from 'playwright';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  createContextTokenFixture,
  createContextTokenAgent,
  launchContextTokenFixture,
  openContextTokenProject,
  reopenContextTokenSession,
  readContextTokenApi,
  snapshotContextTokenDb,
  removeContextTokenFixture,
  recordContextTokenEvidence,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';
import {
  holdReplyRead,
  replyBarrier,
  startChatReplyProvider,
  type ControlledReply,
} from './support/chatReplyFixture.js';

for (const mode of ['chromium', 'electron'] as const) {
  test(`CR-T01 baseline ${mode}: stale history removes an accepted final reply`, async () => {
    const info = test.info();
    const completion = replyBarrier();
    const finalReply = `BASELINE_${mode}_PERSISTED_FINAL_REPLY`;
    const replies: ControlledReply[] = [
      { reply: { kind: 'text', text: finalReply }, gate: completion },
    ];
    const provider = await startChatReplyProvider(replies);
    let fixture: ContextTokenFixture | undefined;
    let app: ElectronApplication | undefined;
    let browser: Browser | undefined;
    let page: Page | undefined;
    let history: Awaited<ReturnType<typeof holdReplyRead>> | undefined;
    let session: { id: string; projectId: string } | undefined;
    const ordering: string[] = [];
    const evidence: Record<string, unknown> = { mode, baselineExpectedBug: true, ordering };
    let passed = false;
    try {
      fixture = await createContextTokenFixture(provider);
      app = await launchContextTokenFixture(fixture);
      const native = await app.firstWindow();
      const agent = await createContextTokenAgent(fixture);
      session = await openContextTokenProject(native, fixture, agent);
      if (mode === 'chromium') {
        browser = await chromium.launch();
        page = await browser.newPage();
      } else page = native;
      await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
      history = await holdReplyRead(page, `**/api/v1/sessions/${session.id}/messages`);
      await reopenContextTokenSession(page, fixture, session);
      await history.captured();
      ordering.push('actual saved history fetched and held');
      evidence.heldHistory = history.record();
      const input = page.getByPlaceholder('Ask about this Project...');
      await expect(input).toBeEnabled();
      await input.fill('BASELINE_PRIVATE_PROMPT_CANARY');
      await input.press('Enter');
      await expect.poll(() => provider.requests.length).toBe(1);
      ordering.push('UI accepted send and real provider request started');
      history.release();
      await history.delivered();
      // The restored old user transcript must replace the optimistic new user/assistant pair.
      await expect(page.getByText('BASELINE_PRIVATE_PROMPT_CANARY', { exact: true })).toHaveCount(
        0,
      );
      ordering.push('stale history removed new visible turn');
      completion.release();
      await expect
        .poll(
          () =>
            snapshotContextTokenDb(fixture!, session!.id).messages.filter(
              (row) => row.role === 'assistant' && row.content === finalReply,
            ).length,
        )
        .toBe(1);
      await expect(input).toBeEnabled();
      await expect(page.getByText(finalReply, { exact: true })).toHaveCount(0);
      ordering.push('backend final persisted once, final UI reply still absent');
      const snapshot = snapshotContextTokenDb(fixture, session.id);
      evidence.finalDb = snapshot;
      expect(snapshot.audits).toHaveLength(0);
      expect(provider.requests).toHaveLength(1);
      expect(provider.errors).toEqual([]);
      evidence.actualMessagesApi = await readContextTokenApi(
        fixture,
        `sessions/${session.id}/messages`,
      );
      evidence.report = await page.evaluate(async (sessionId) => {
        const response = await fetch('/api/diagnostics/report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scope: { sessionId } }),
        });
        return { status: response.status, body: await response.json() };
      }, session.id);
      passed = true;
    } finally {
      completion.release();
      await history?.close();
      if (fixture) {
        if (session) evidence.finalDb = snapshotContextTokenDb(fixture, session.id);
        evidence.baselineReproduced = passed;
        evidence.source = Object.fromEntries(
          ['apps/web/hooks/use-harness-chat.ts', 'apps/web/app/page.tsx'].map((path) => [
            path,
            createHash('sha256').update(readFileSync(path)).digest('hex'),
          ]),
        );
        evidence.sourceRevision = execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8',
        }).trim();
        if (page && !page.isClosed()) {
          await page.screenshot({ path: info.outputPath('baseline-ui.png') });
          await page.context().tracing.stop({ path: info.outputPath('baseline-trace.zip') });
        }
        await recordContextTokenEvidence(
          info,
          fixture,
          `chat-reply-baseline-${mode}`,
          evidence,
          page,
        );
        writeFileSync(info.outputPath('baseline-evidence.json'), JSON.stringify(evidence, null, 2));
        await browser?.close();
        await app?.close();
        for (const name of ['agent.sqlite', 'diagnostics.sqlite']) {
          const source = join(fixture.runtimeDir, 'data', name);
          if (existsSync(source)) copyFileSync(source, info.outputPath(`baseline-${name}`));
        }
        removeContextTokenFixture(fixture);
      }
      await provider.close();
    }
  });
}
