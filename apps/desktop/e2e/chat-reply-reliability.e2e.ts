import { expect, test } from '@playwright/test';
import { DiagnosticReportSchema } from '@agent-platform/contracts';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { holdReplyRead, replyBarrier } from './support/chatReplyFixture.js';
import {
  replyJourney,
  replyInput,
  replySubmit,
  selectReplySession,
  leaveStreamingReplyForSession,
  createReplySession,
  submitReply,
  expectPersistedReply,
  exportReplyReport,
} from './support/chatReplyJourney.js';
import {
  readContextTokenApi,
  snapshotContextTokenDb,
  CONTEXT_BUDGET_MESSAGE,
} from './support/contextTokenFixture.js';

// Owned native/browser contexts retain their own traces and screenshots for every journey.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const mode of ['chromium', 'electron'] as const) {
  test(`CR-T01/02/06/07 ${mode}: restoration gates both reads, retains draft, final reply and saved link`, async () => {
    test.setTimeout(120_000);
    await replyJourney(test.info(), mode, async (ctx) => {
      const { page, fixture, session } = ctx;
      const history = await holdReplyRead(page, `**/api/v1/sessions/${session.id}/messages`);
      const approvals = await holdReplyRead(
        page,
        `**/api/v1/approval-requests?sessionId=${session.id}&status=pending`,
      );
      ctx.cleanup.push(history.close, approvals.close);
      await page.goto(
        `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
      );
      await Promise.all([history.captured(), approvals.captured()]);
      await expect(
        page.getByText('Restoring chat history and approvals…', { exact: true }),
      ).toBeVisible();
      await replyInput(page).fill('REPLY_PRIVATE_PROMPT_CANARY');
      await page.locator('input[type=file]').setInputFiles({
        name: 'safe-draft.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('REPLY_ATTACHMENT_CANARY'),
      });
      await expect(
        page.getByRole('button', { name: 'Remove safe-draft.txt', exact: true }),
      ).toBeVisible();
      await expect(replySubmit(page)).toBeDisabled();
      await replyInput(page).press('Enter');
      expect(ctx.posts).toHaveLength(0);
      expect(fixture.provider.requests).toHaveLength(0);
      history.release();
      await history.delivered();
      await expect(replySubmit(page)).toBeDisabled();
      await replyInput(page).press('Enter');
      expect(ctx.posts).toHaveLength(0);
      expect(snapshotContextTokenDb(fixture, session.id).audits).toHaveLength(0);
      approvals.release();
      await approvals.delivered();
      await expect(replySubmit(page)).toBeEnabled();
      await expect(replyInput(page)).toHaveValue('REPLY_PRIVATE_PROMPT_CANARY');
      await expect(
        page.getByRole('button', { name: 'Remove safe-draft.txt', exact: true }),
      ).toBeVisible();
      ctx.replies.push({ reply: { kind: 'text', text: 'The completed reply remains visible.' } });
      await replyInput(page).press('Enter');
      await expectPersistedReply(ctx, 'The completed reply remains visible.');
      await expect(replyInput(page)).toHaveValue('');
      await expect(
        page.getByRole('button', { name: 'Remove safe-draft.txt', exact: true }),
      ).toHaveCount(0);
      expect(ctx.posts.filter((row) => row.path === '/api/chat')).toHaveLength(1);
      expect(fixture.provider.requests).toHaveLength(1);
      ctx.evidence.history = history.record();
      ctx.evidence.approvals = approvals.record();
      const report = await exportReplyReport(ctx, 'success.json', [
        'REPLY_PRIVATE_PROMPT_CANARY',
        'REPLY_ATTACHMENT_CANARY',
        fixture.root,
      ]);
      expect(
        report.events.some(
          (row) => row.event.phase === 'request' && row.event.outcome === 'succeeded',
        ),
      ).toBe(true);
      const before = snapshotContextTokenDb(fixture, session.id);
      await page.goto(
        `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
      );
      await expectPersistedReply(ctx, 'The completed reply remains visible.');
      expect(snapshotContextTokenDb(fixture, session.id)).toEqual(before);
      // A real admitted provider failure remains visible, produces no replay/effect and has a safe report.
      ctx.replies.push({ reply: { kind: 'error', status: 400 } });
      await submitReply(ctx, 'REPLY_FAILURE_PRIVATE_CANARY');
      await expect.poll(() => fixture.provider.requests.length).toBe(2);
      await expect(
        page.getByText(/The agent run failed before returning a response/),
      ).toBeVisible();
      await expect(replyInput(page)).toBeEnabled();
      const failure = await exportReplyReport(ctx, 'failure.json', [
        'REPLY_FAILURE_PRIVATE_CANARY',
        fixture.root,
      ]);
      expect(failure.events.some((row) => row.event.outcome === 'failed')).toBe(true);
      expect(snapshotContextTokenDb(fixture, session.id).audits).toHaveLength(0);
      expect(ctx.posts.filter((row) => row.path === '/api/chat')).toHaveLength(2);
    });
  });

  test(`CR-T04 ${mode}: read failures and deadline stay blocked, manual retry preserves draft and attachments`, async () => {
    test.setTimeout(120_000);
    await replyJourney(test.info(), mode, async (ctx) => {
      const { page, fixture, session } = ctx;
      const before = snapshotContextTokenDb(fixture, session.id);
      for (const source of ['messages', 'approval-requests'] as const) {
        const url =
          source === 'messages'
            ? `**/api/v1/sessions/${session.id}/messages`
            : `**/api/v1/approval-requests?sessionId=${session.id}&status=pending`;
        let failed = false;
        await page.route(url, async (route) => {
          if (failed) return route.continue();
          failed = true;
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              error: { message: 'sk-PRIVATE_READ_CANARY /private/fixture/location' },
            }),
          });
        });
        await page.goto(
          `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
        );
        await expect(
          page.getByRole('button', { name: 'Retry history', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(/sk-PRIVATE_READ_CANARY|\/private\/fixture\/location/),
        ).toHaveCount(0);
        await replyInput(page).fill(`Retained ${source} draft`);
        await page.locator('input[type=file]').setInputFiles({
          name: 'retry-draft.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('DRAFT_RETRY_CANARY'),
        });
        await expect(replySubmit(page)).toBeDisabled();
        await replyInput(page).press('Enter');
        await page.getByRole('button', { name: 'Retry history', exact: true }).click();
        await expect(replySubmit(page)).toBeEnabled();
        await expect(replyInput(page)).toHaveValue(`Retained ${source} draft`);
        await expect(
          page.getByRole('button', { name: 'Remove retry-draft.txt', exact: true }),
        ).toBeVisible();
        await page.unroute(url);
      }
      const late = await holdReplyRead(page, `**/api/v1/sessions/${session.id}/messages`);
      ctx.cleanup.push(late.close);
      await page.goto(
        `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
      );
      await late.captured();
      await replyInput(page).fill('Retained deadline draft');
      await expect(
        page.getByText(
          'Conversation history took too long to load. Retry history before sending.',
          { exact: true },
        ),
      ).toBeVisible({ timeout: 20_000 });
      await expect(replySubmit(page)).toBeDisabled();
      await page.getByRole('button', { name: 'Retry history', exact: true }).click();
      await expect(replySubmit(page)).toBeEnabled();
      late.release();
      await late.delivered();
      await expect(replyInput(page)).toHaveValue('Retained deadline draft');
      await expect(page.getByRole('button', { name: 'Retry history', exact: true })).toHaveCount(0);
      expect(ctx.posts).toHaveLength(0);
      expect(fixture.provider.requests).toHaveLength(0);
      expect(snapshotContextTokenDb(fixture, session.id)).toEqual(before);
      ctx.evidence.noRunExpected =
        'Restoration-only errors create no chat/provider/tool effects; no fabricated run report.';
    });
  });

  for (const prior of ['success', 'error'] as const) {
    test(`CR-T03 ${mode}: stale ${prior} cannot alter B while its operation is active`, async () => {
      test.setTimeout(120_000);
      await replyJourney(test.info(), mode, async (ctx) => {
        const { page, fixture, session } = ctx;
        const b = await createReplySession(ctx, 'Reply B');
        // Refresh the real menu dataset, then restore A by its explicit link.
        await page.goto(
          `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
        );
        const lateHistory = await holdReplyRead(page, `**/api/v1/sessions/${session.id}/messages`);
        ctx.cleanup.push(lateHistory.close);
        await selectReplySession(page, 'Reply B');
        await selectReplySession(page, `Context-token ${session.id}`);
        await lateHistory.captured();
        await selectReplySession(page, 'Reply B');
        await replyInput(page).fill('B draft');
        await expect(replySubmit(page)).toBeEnabled();
        lateHistory.release();
        await lateHistory.delivered();
        await expect(replyInput(page)).toHaveValue('B draft');
        await selectReplySession(page, `Context-token ${session.id}`);
        const aDone = replyBarrier();
        const bDone = replyBarrier();
        ctx.replies.push({
          reply:
            prior === 'success'
              ? { kind: 'text', text: 'A completed privately.' }
              : { kind: 'error', status: 400 },
          gate: aDone,
        });
        ctx.replies.push({
          reply: { kind: 'text', text: 'B owns its completed reply.' },
          gate: bDone,
        });
        await submitReply(ctx, 'A_STALE_PRIVATE_PROMPT');
        await expect.poll(() => fixture.provider.requests.length).toBe(1);
        await leaveStreamingReplyForSession(ctx, 'Reply B');
        await submitReply(ctx, 'B_CURRENT_PRIVATE_PROMPT');
        await expect.poll(() => fixture.provider.requests.length).toBe(2);
        aDone.release();
        await expect
          .poll(async () => {
            const report = DiagnosticReportSchema.parse(
              await page.evaluate(async (sessionId) => {
                const response = await fetch('/api/diagnostics/report', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ scope: { sessionId } }),
                });
                if (!response.ok) throw new Error(`Diagnostic completion probe ${response.status}`);
                return response.json();
              }, session.id),
            );
            return report.events.some(
              (row) =>
                row.event.phase === 'request' &&
                row.event.outcome === (prior === 'success' ? 'succeeded' : 'failed'),
            );
          })
          .toBe(true);
        await expect
          .poll(
            () =>
              snapshotContextTokenDb(fixture, session.id).messages.filter(
                (row) => row.role === 'assistant' && row.content === 'A completed privately.',
              ).length,
          )
          .toBe(prior === 'success' ? 1 : 0);
        await expect(replyInput(page)).toBeDisabled();
        await expect(page.getByText('A completed privately.', { exact: true })).toHaveCount(0);
        await expect(page.getByText('A_STALE_PRIVATE_PROMPT', { exact: true })).toHaveCount(0);
        bDone.release();
        await expectPersistedReply(ctx, 'B owns its completed reply.', b.id);
        expect(
          snapshotContextTokenDb(fixture, b.id).messages.filter((row) => row.role === 'user'),
        ).toHaveLength(1);
        expect(snapshotContextTokenDb(fixture, b.id).audits).toHaveLength(0);
        await selectReplySession(page, `Context-token ${session.id}`);
        if (prior === 'success') await expectPersistedReply(ctx, 'A completed privately.');
        await expect(page.getByText('B owns its completed reply.', { exact: true })).toHaveCount(0);
        ctx.evidence.targetDb = snapshotContextTokenDb(fixture, b.id);
      });
    });
  }

  for (const decision of ['Approve', 'Reject'] as const) {
    test(`CR-T05/08 ${mode}: restored ${decision} decision preserves exactly-once effects and report`, async () => {
      test.setTimeout(120_000);
      await replyJourney(test.info(), mode, async (ctx) => {
        const { page, fixture, session } = ctx;
        const effect = join(fixture.projectDir, 'reply-approved-effect.txt');
        writeFileSync(effect, 'original');
        ctx.replies.push({
          reply: {
            kind: 'tools',
            calls: [
              {
                id: 'reply-write-once',
                name: 'sys_write_file',
                args: { path: effect, content: 'APPROVAL_CONTENT_CANARY' },
              },
            ],
          },
        });
        ctx.replies.push({ reply: { kind: 'text', text: `${decision} result remains visible.` } });
        await submitReply(ctx, 'APPROVAL_PRIVATE_PROMPT');
        await expect(page.getByTestId('approval-card')).toHaveCount(1);
        expect(readFileSync(effect, 'utf8')).toBe('original');
        await page.goto(
          `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
        );
        const card = page.getByTestId('approval-card');
        const buttonName = decision === 'Approve' ? 'Approve' : 'Deny';
        await expect(card).toHaveCount(1);
        await expect(card.getByRole('button', { name: buttonName, exact: true })).toBeVisible();
        await expect(replySubmit(page)).toBeDisabled();
        await card.getByRole('button', { name: buttonName, exact: true }).click();
        const finalText = `${decision} result remains visible.`;
        // Rejected approval status is intentionally a transient SSE display prefix; the
        // durable assistant row contains the model reply, which survives reopening.
        const liveText =
          decision === 'Approve'
            ? finalText
            : `[APPROVAL_REJECTED] Human rejected tool execution. ${finalText}`;
        await expectPersistedReply(ctx, finalText, session.id, liveText);
        await expect(card).toContainText(
          decision === 'Approve' ? 'Approved action completed' : 'Denied',
        );
        expect(readFileSync(effect, 'utf8')).toBe(
          decision === 'Approve' ? 'APPROVAL_CONTENT_CANARY' : 'original',
        );
        const saved = snapshotContextTokenDb(fixture, session.id);
        expect(saved.approvals).toHaveLength(1);
        expect(saved.approvals[0]!.status).toBe(decision === 'Approve' ? 'approved' : 'rejected');
        expect(
          saved.audits.filter(
            (row) => row.tool_name === 'sys_write_file' && row.status === 'success',
          ),
        ).toHaveLength(decision === 'Approve' ? 1 : 0);
        expect(ctx.posts.filter((row) => row.path.endsWith('/resume'))).toHaveLength(1);
        const report = await exportReplyReport(ctx, 'approval.json', [
          'APPROVAL_PRIVATE_PROMPT',
          'APPROVAL_CONTENT_CANARY',
          fixture.root,
        ]);
        expect(report.events.some((row) => row.event.phase === 'approval')).toBe(true);
        const before = snapshotContextTokenDb(fixture, session.id);
        await page.goto(
          `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
        );
        await expectPersistedReply(ctx, `${decision} result remains visible.`);
        expect(snapshotContextTokenDb(fixture, session.id)).toEqual(before);
      });
    });
  }

  test(`CR-T03/05 ${mode}: in-flight approval completion cannot modify the newly selected session`, async () => {
    test.setTimeout(120_000);
    await replyJourney(test.info(), mode, async (ctx) => {
      const { page, fixture, session } = ctx;
      const b = await createReplySession(ctx, 'Approval destination B');
      await page.goto(
        `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
      );
      const effect = join(fixture.projectDir, 'switched-approval-effect.txt');
      writeFileSync(effect, 'original');
      const completion = replyBarrier();
      ctx.replies.push({
        reply: {
          kind: 'tools',
          calls: [
            {
              id: 'switched-write',
              name: 'sys_write_file',
              args: { path: effect, content: 'SWITCHED_APPROVAL_CANARY' },
            },
          ],
        },
      });
      ctx.replies.push({
        reply: { kind: 'text', text: 'A approval completed durably.' },
        gate: completion,
      });
      await submitReply(ctx, 'Approve the controlled write');
      const card = page.getByTestId('approval-card');
      await expect(card).toHaveCount(1);
      await card.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect.poll(() => fixture.provider.requests.length).toBe(2);
      await expect(card.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
      expect(ctx.posts.filter((row) => row.path.endsWith('/resume'))).toHaveLength(1);
      await leaveStreamingReplyForSession(ctx, 'Approval destination B');
      await replyInput(page).fill('B keeps its draft');
      await expect(replySubmit(page)).toBeEnabled();
      completion.release();
      await expect
        .poll(
          () =>
            snapshotContextTokenDb(fixture, session.id).messages.filter(
              (row) => row.role === 'assistant' && row.content === 'A approval completed durably.',
            ).length,
        )
        .toBe(1);
      await expect(replyInput(page)).toHaveValue('B keeps its draft');
      await expect(replySubmit(page)).toBeEnabled();
      await expect(page.getByText('A approval completed durably.', { exact: true })).toHaveCount(0);
      expect(snapshotContextTokenDb(fixture, b.id).messages).toHaveLength(0);
      expect(readFileSync(effect, 'utf8')).toBe('SWITCHED_APPROVAL_CANARY');
      expect(
        snapshotContextTokenDb(fixture, session.id).audits.filter(
          (row) => row.tool_name === 'sys_write_file' && row.status === 'success',
        ),
      ).toHaveLength(1);
      await selectReplySession(page, `Context-token ${session.id}`);
      await expectPersistedReply(ctx, 'A approval completed durably.');
      expect(ctx.posts.filter((row) => row.path.endsWith('/resume'))).toHaveLength(1);
      ctx.evidence.destinationDb = snapshotContextTokenDb(fixture, b.id);
    });
  });

  test(`CR-T03/06 ${mode}: delayed saved-session reopen cannot replace an explicit Home selection`, async () => {
    test.setTimeout(90_000);
    await replyJourney(test.info(), mode, async (ctx) => {
      const { page, fixture, session } = ctx;
      const before = snapshotContextTokenDb(fixture, session.id);
      const reopen = await holdReplyRead(page, `**/api/v1/sessions/${session.id}`);
      ctx.cleanup.push(reopen.close);
      await page.goto(
        `http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}&sessionId=${session.id}`,
      );
      await reopen.captured();
      await page.getByRole('button', { name: 'Workspaces', exact: true }).click();
      await expect(replyInput(page)).toHaveCount(0);
      reopen.release();
      await reopen.delivered();
      await expect(page.getByRole('button', { name: 'Open folder', exact: true })).toBeVisible();
      await expect(replyInput(page)).toHaveCount(0);
      expect(new URL(page.url()).searchParams.has('projectId')).toBe(false);
      expect(ctx.posts).toHaveLength(0);
      expect(fixture.provider.requests).toHaveLength(0);
      expect(snapshotContextTokenDb(fixture, session.id)).toEqual(before);
      ctx.evidence.reopen = reopen.record();
    });
  });

  test(`CR-T06 ${mode}: context-limit refusal preserves its visible and durable outcome without provider calls`, async () => {
    test.setTimeout(90_000);
    await replyJourney(test.info(), mode, async (ctx) => {
      await readContextTokenApi(ctx.fixture, `agents/${ctx.agent.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...ctx.agent,
          contextWindow: { maxInputTokens: 1, maxOutputTokens: 128, strategy: 'truncate' },
        }),
      });
      await submitReply(ctx, 'CONTEXT_LIMIT_REPLY_CANARY');
      await expect(ctx.page.getByText(CONTEXT_BUDGET_MESSAGE, { exact: true })).toBeVisible();
      await expect(replyInput(ctx.page)).toBeEnabled();
      expect(ctx.fixture.provider.requests).toHaveLength(0);
      expect(snapshotContextTokenDb(ctx.fixture, ctx.session.id).audits).toHaveLength(0);
      const report = await exportReplyReport(ctx, 'failure.json', [
        'CONTEXT_LIMIT_REPLY_CANARY',
        ctx.fixture.root,
      ]);
      expect(report.events.some((row) => row.event.errorCode === 'context_budget_exceeded')).toBe(
        true,
      );
    });
  });
}
