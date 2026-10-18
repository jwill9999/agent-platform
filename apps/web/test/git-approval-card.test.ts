// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { GitDeliveryReceipt } from '@agent-platform/contracts';
import type {
  ApprovalCardState,
  ApprovalDecisionHandler,
  ToolTraceEvent,
} from '@/hooks/use-harness-chat';
import { Chat } from '@/components/chat/chat';
import type { UIMessage } from 'ai';
import { GitApprovalCard, GitRecoveryCard } from '@/components/chat/git-approval-card';

vi.mock('@/components/chat/chat-input', () => ({ ChatInput: () => null }));
vi.mock('@/components/chat/diagnostic-export', () => ({ DiagnosticExportAction: () => null }));
vi.mock('@/components/chat/markdown', () => ({ Markdown: () => null }));
vi.mock('@/components/chat/workspace-resource-cards', () => ({
  WorkspaceResourcePreviewProvider: ({ children }: { children: React.ReactNode }) => children,
  WorkspaceResourceCards: () => null,
}));

const base: GitDeliveryReceipt = {
  id: 'c6b36cb6-6039-4ea9-839f-f7ed39f486f0',
  projectId: 'project-a',
  sessionId: 'session-a',
  source: 'chat',
  action: {
    kind: 'commit',
    message: 'Exact reviewed message\nSecond line',
    paths: ['literal\nfile.txt'],
  },
  state: 'prepared',
  createdAtMs: 10,
  updatedAtMs: 10,
  expiresAtMs: Date.now() + 60_000,
  review: {
    branch: 'task/review',
    head: 'a'.repeat(40),
    indexTree: 'b'.repeat(40),
    paths: ['literal\nfile.txt'],
    remoteName: 'origin',
    remoteRef: 'task/review',
    repositorySlug: 'owner/repo',
  },
};
const approval: ApprovalCardState = {
  type: 'approval_required',
  approvalRequestId: 'approval-id',
  toolName: 'sys_git_commit',
  argsPreview: { gitDeliveryReceipt: base },
  status: 'pending',
};
let container: HTMLDivElement;
let root: Root;
let request: ReturnType<typeof vi.fn>;
let onDecision: Mock<ApprovalDecisionHandler>;
function response(receipt: unknown = base, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ data: receipt }),
    text: async () => JSON.stringify({ data: receipt }),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function render(
  options: {
    approval?: ApprovalCardState;
    projectId?: string | null;
    sessionId?: string | null;
    toolEvents?: readonly ToolTraceEvent[];
  } = {},
) {
  await act(async () =>
    root.render(
      createElement(GitApprovalCard, {
        approval,
        projectId: 'project-a',
        sessionId: 'session-a',
        onDecision,
        ...options,
      }),
    ),
  );
}
function button(text: string) {
  const found = [...container.querySelectorAll('button')].find((item) => item.textContent === text);
  if (!found) throw new Error(`Missing ${text}`);
  return found;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  HTMLElement.prototype.scrollTo = vi.fn();
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  request = vi.fn(async () => response());
  vi.stubGlobal('fetch', request);
  onDecision = vi.fn<ApprovalDecisionHandler>(() => ({
    accepted: true,
    completion: Promise.resolve(),
    isCurrent: () => true,
  }));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('chat Git approvals', () => {
  it('shows canonical review and approves only through the original decision ID, never execute HTTP', async () => {
    await render();
    expect(container.textContent).toContain('Exact reviewed message\nSecond line');
    expect(container.textContent).toContain('literal\nfile.txt');
    expect(container.textContent).toContain(base.review.head);
    expect(container.textContent).toContain('owner/repo');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe(`/api/v1/projects/project-a/git/delivery/${base.id}`);
    expect(onDecision).not.toHaveBeenCalled();
    await act(async () => {
      button('Approve Git operation').click();
      button('Approve Git operation').click();
    });
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith('approval-id', 'approve');
    expect(request).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Confirm Git operation');
  });
  it('sends denial through the approval decision route, without direct cancellation', async () => {
    await render();
    await click(button('Deny Git operation'));
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith('approval-id', 'reject');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('renders the complete PR base/title/body/draft review as text', async () => {
    const receipt: GitDeliveryReceipt = {
      ...base,
      action: {
        kind: 'pull_request',
        baseBranch: 'staging',
        title: '<script>title</script>',
        body: 'Line one\nLine two',
        draft: true,
      },
    };
    request.mockResolvedValue(response(receipt));
    await render({
      approval: {
        ...approval,
        toolName: 'sys_git_create_pull_request',
        argsPreview: { gitDeliveryReceipt: receipt },
      },
    });
    expect(container.textContent).toContain('staging');
    expect(container.textContent).toContain('<script>title</script>');
    expect(container.textContent).toContain('Line one\nLine two');
    expect(container.textContent).toContain('Yes');
    expect(container.querySelector('script')).toBeNull();
  });
  it('keeps durable unknown authoritative over generic executed and recovers only on explicit clicks', async () => {
    const unknown = { ...base, state: 'unknown' as const, updatedAtMs: 20 };
    request.mockResolvedValue(response(unknown));
    await render({ approval: { ...approval, status: 'executed' } });
    expect(container.textContent).toContain('Outcome unknown');
    expect(container.textContent).not.toContain('completed');
    expect(container.textContent).not.toContain('Approve Git operation');
    expect(request).toHaveBeenCalledTimes(1);
    await click(button('Check actual outcome'));
    expect(request.mock.calls[1]?.[0]).toBe(
      `/api/v1/projects/project-a/git/delivery/${base.id}/reconcile`,
    );
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: '{}' });
    expect(button('Acknowledge uncertain outcome').disabled).toBe(true);
    await click(container.querySelector('input')!);
    expect(request).toHaveBeenCalledTimes(2);
    request.mockResolvedValue(response({ ...unknown, acknowledgedAtMs: 30, updatedAtMs: 30 }));
    await click(button('Acknowledge uncertain outcome'));
    expect(request.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      body: '{"confirmed":true}',
    });
    expect(container.textContent).toContain('cannot execute again');
    expect(onDecision).not.toHaveBeenCalled();
  });
  it('offers direct cancel only for a saved prepared operation with already rejected approval', async () => {
    await render();
    expect(container.textContent).not.toContain('Cancel Git operation');
    await render({ approval: { ...approval, status: 'rejected' } });
    expect(request).toHaveBeenCalledTimes(2);
    await click(button('Cancel Git operation'));
    expect(request.mock.calls[2]?.[0]).toBe(
      `/api/v1/projects/project-a/git/delivery/${base.id}/cancel`,
    );
    expect(onDecision).not.toHaveBeenCalled();
  });
  it.each([
    { ...base, source: 'panel' },
    { ...base, projectId: 'foreign' },
    { ...base, sessionId: 'foreign' },
    { ...base, action: { kind: 'push', mode: 'push' } },
    { ...base, unexpected: 'secret' },
    { ...base, id: 'bad' },
  ])('rejects malformed or mismatched preview without fetching another owner', async (receipt) => {
    await render({ approval: { ...approval, argsPreview: { gitDeliveryReceipt: receipt } } });
    expect(container.textContent).toContain('does not match');
    expect(request).not.toHaveBeenCalled();
    expect(onDecision).not.toHaveBeenCalled();
  });
  it('requires actual session and Project even when the preview names them', async () => {
    await render({ sessionId: null });
    expect(request).not.toHaveBeenCalled();
    await render({ projectId: null });
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['id', 'action', 'review'] as const)(
    'rejects changed initial %s within the same approval',
    async (field) => {
      await render();
      const receipt = {
        ...base,
        [field]:
          field === 'id'
            ? 'a6b36cb6-6039-4ea9-839f-f7ed39f486f0'
            : field === 'action'
              ? { ...base.action, message: 'changed' }
              : { ...base.review, head: 'c'.repeat(40) },
      };
      await render({ approval: { ...approval, argsPreview: { gitDeliveryReceipt: receipt } } });
      expect(container.textContent).toContain('does not match');
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('disables approval on failed GET and on a mismatched saved review', async () => {
    request.mockResolvedValue(response(base, false));
    await render();
    expect(button('Approve Git operation').disabled).toBe(true);
    expect(container.textContent).toContain('could not be verified');
    request.mockResolvedValue(
      response({ ...base, review: { ...base.review, head: 'c'.repeat(40) } }),
    );
    await click(button('Refresh saved Git outcome'));
    expect(button('Approve Git operation').disabled).toBe(true);
    expect(onDecision).not.toHaveBeenCalled();
  });
  it('refreshes on approval and tool events without automatically performing an effect', async () => {
    await render();
    request.mockResolvedValue(response({ ...base, state: 'executing', updatedAtMs: 20 }));
    await render({ approval: { ...approval, status: 'approved' } });
    expect(container.textContent).toContain('Status: executing');
    request.mockResolvedValue(response({ ...base, state: 'succeeded', updatedAtMs: 30 }));
    await render({
      approval: { ...approval, status: 'approved' },
      toolEvents: [{ type: 'result', toolId: 'sys_git_commit', status: 'success', data: {} }],
    });
    expect(container.textContent).toContain('Status: succeeded');
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.every((call) => !call[1]?.method)).toBe(true);
    expect(onDecision).not.toHaveBeenCalled();
  });
  it('ignores old responses across Project A -> B -> A and unmount', async () => {
    const old = deferred<ReturnType<typeof response>>();
    request.mockReturnValueOnce(old.promise);
    await render();
    const oldSignal = request.mock.calls[0]?.[1]?.signal as AbortSignal;
    await render({ projectId: 'project-b' });
    await render();
    expect(oldSignal.aborted).toBe(true);
    expect(button('Approve Git operation').disabled).toBe(false);
    await act(async () => old.resolve(response({ ...base, state: 'unknown', updatedAtMs: 999 })));
    expect(container.textContent).not.toContain('Outcome unknown');
    const late = deferred<ReturnType<typeof response>>();
    request.mockReturnValueOnce(late.promise);
    await click(button('Refresh saved Git outcome'));
    await act(async () => root.render(null));
    await act(async () => late.resolve(response()));
    expect(container.textContent).toBe('');
  });
  it.each(['approving', 'rejecting'] as const)(
    'disables recovery while generic approval is %s',
    async (status) => {
      request.mockResolvedValue(response({ ...base, state: 'unknown', updatedAtMs: 20 }));
      await render({ approval: { ...approval, status } });
      expect(button('Check actual outcome').disabled).toBe(true);
      await click(button('Check actual outcome'));
      expect(request).toHaveBeenCalledTimes(1);
      expect(onDecision).not.toHaveBeenCalled();
    },
  );
  it('allows an existing failed decision to retry only a verified unexpired preparation', async () => {
    await render({ approval: { ...approval, status: 'failed' } });
    await click(button('Approve Git operation'));
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith('approval-id', 'approve');
  });
  it('ignores earlier status refresh and rejects a saved revision older than the verified outcome', async () => {
    const old = deferred<ReturnType<typeof response>>();
    request.mockReturnValueOnce(old.promise);
    await render();
    request.mockResolvedValue(response({ ...base, state: 'unknown', updatedAtMs: 30 }));
    await render({ approval: { ...approval, status: 'executed' } });
    await act(async () => old.resolve(response(base)));
    expect(container.textContent).toContain('Outcome unknown');
    request.mockResolvedValue(response({ ...base, state: 'succeeded', updatedAtMs: 20 }));
    await click(button('Refresh saved Git outcome'));
    expect(container.textContent).toContain('could not be verified');
    expect(container.textContent).not.toContain('Status: succeeded');
    expect(container.textContent).not.toContain('Check actual outcome');
  });
  it('deletes a closed record only after explicit confirmation and one click', async () => {
    request.mockResolvedValue(response({ ...base, state: 'succeeded', updatedAtMs: 30 }));
    await render({ approval: { ...approval, status: 'executed' } });
    expect(button('Delete closed record').disabled).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    await click(container.querySelector('input')!);
    const pending = deferred<ReturnType<typeof response>>();
    request.mockReturnValueOnce(pending.promise);
    await act(async () => {
      button('Delete closed record').click();
      button('Delete closed record').click();
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'DELETE',
      body: '{"confirmed":true}',
    });
    await act(async () => pending.resolve(response()));
    expect(container.textContent).toContain('Retained Git record deleted');
    expect(container.querySelectorAll('button,input')).toHaveLength(0);
    expect(onDecision).not.toHaveBeenCalled();
  });
  it.each(['prepared', 'executing', 'unknown'] as const)(
    'never offers deletion for %s',
    async (state) => {
      request.mockResolvedValue(response({ ...base, state }));
      await render();
      expect(container.textContent).not.toContain('Delete closed record');
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('permits explicitly acknowledged unknown deletion but preserves uncertainty after DELETE failure', async () => {
    request.mockResolvedValue(
      response({ ...base, state: 'unknown', acknowledgedAtMs: 30, updatedAtMs: 30 }),
    );
    await render({ approval: { ...approval, status: 'executed' } });
    await click(container.querySelector('input')!);
    request.mockResolvedValueOnce(response(undefined, false));
    await click(button('Delete closed record'));
    expect(container.textContent).toContain('could not be verified');
    expect(container.textContent).not.toContain('Retained Git record deleted');
    expect(container.textContent).not.toContain('Delete closed record');
  });
  it('does not publish late DELETE into a reselected owner or after unmount', async () => {
    const saved = { ...base, state: 'succeeded', updatedAtMs: 30 };
    request.mockResolvedValue(response(saved));
    await render();
    await click(container.querySelector('input')!);
    const old = deferred<ReturnType<typeof response>>();
    request.mockReturnValueOnce(old.promise);
    await click(button('Delete closed record'));
    const signal = request.mock.calls[1]?.[1]?.signal as AbortSignal;
    await render({ projectId: 'project-b' });
    await render();
    await act(async () => old.resolve(response()));
    expect(signal.aborted).toBe(true);
    expect(container.textContent).not.toContain('Retained Git record deleted');
    await click(container.querySelector('input')!);
    const late = deferred<ReturnType<typeof response>>();
    request.mockReturnValueOnce(late.promise);
    await click(button('Delete closed record'));
    await act(async () => root.render(null));
    await act(async () => late.resolve(response()));
    expect(container.textContent).toBe('');
  });
  it('unlatches an explicitly refused decision and allows a later human retry', async () => {
    onDecision.mockReturnValueOnce({ accepted: false, reason: 'busy' });
    await render();
    await click(button('Approve Git operation'));
    expect(container.textContent).toContain('Approval was not started');
    expect(button('Approve Git operation').disabled).toBe(false);
    expect(onDecision).toHaveBeenCalledTimes(1);
    await click(button('Approve Git operation'));
    expect(onDecision).toHaveBeenCalledTimes(2);
    expect(button('Approve Git operation').disabled).toBe(true);
  });
  it('handles same-frame decisions on two cards without permanently latching the refused card', async () => {
    const second = { ...approval, approvalRequestId: 'second-approval' };
    onDecision
      .mockReturnValueOnce({ accepted: true, completion: Promise.resolve(), isCurrent: () => true })
      .mockReturnValueOnce({ accepted: false, reason: 'busy' });
    await act(async () =>
      root.render(
        createElement(
          React.Fragment,
          null,
          createElement(GitApprovalCard, {
            approval,
            projectId: 'project-a',
            sessionId: 'session-a',
            onDecision,
          }),
          createElement(GitApprovalCard, {
            approval: second,
            projectId: 'project-a',
            sessionId: 'session-a',
            onDecision,
          }),
        ),
      ),
    );
    const buttons = [...container.querySelectorAll('button')].filter(
      (item) => item.textContent === 'Approve Git operation',
    );
    await act(async () => {
      buttons[0]!.click();
      buttons[1]!.click();
    });
    expect(buttons[0]!.disabled).toBe(true);
    expect(buttons[1]!.disabled).toBe(false);
    expect(onDecision).toHaveBeenCalledTimes(2);
  });
  it('clears a thrown decision failure without leaking the error or retrying', async () => {
    onDecision.mockImplementationOnce(() => {
      throw new Error('PRIVATE_FAILURE');
    });
    await render();
    await click(button('Approve Git operation'));
    expect(button('Approve Git operation').disabled).toBe(false);
    expect(container.textContent).not.toContain('PRIVATE_FAILURE');
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('expires preparation on time and rejects a delayed approval click', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const receipt = { ...base, expiresAtMs: 2_000 };
    request.mockResolvedValue(response(receipt));
    await render({ approval: { ...approval, argsPreview: { gitDeliveryReceipt: receipt } } });
    expect(button('Approve Git operation').disabled).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(button('Approve Git operation').disabled).toBe(true);
    expect(container.textContent).toContain('expired');
    await click(button('Approve Git operation'));
    expect(onDecision).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('Chat to Message approval wiring', () => {
  const message = {
    id: 'message-a',
    role: 'assistant',
    content: '',
    parts: [],
  } as unknown as UIMessage;
  it('passes the actual Project/session to Git approval and preserves generic non-Git decisions', async () => {
    const ordinary = {
      ...approval,
      approvalRequestId: 'ordinary-id',
      toolName: 'sys_write_file',
      argsPreview: { path: 'file.txt' },
    };
    await act(async () =>
      root.render(
        createElement(Chat, {
          messages: [message],
          onSend: () => true,
          isLoading: false,
          showSensors: false,
          diagnosticSessionId: 'session-a',
          workspaceWebViewProjectId: 'project-a',
          approvalEventsByMessage: { 'message-a': [approval, ordinary] },
          onApprovalDecision: onDecision,
        }),
      ),
    );
    expect(container.querySelectorAll('[data-testid="git-approval-card"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="approval-card"]')).toHaveLength(1);
    expect(button('Approve Git operation').disabled).toBe(false);
    await click(button('Approve'));
    expect(onDecision).toHaveBeenCalledWith('ordinary-id', 'approve');
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('recovery-only retained chat records', () => {
  async function recovery(receipt: GitDeliveryReceipt, projectId = 'project-a') {
    await act(async () =>
      root.render(
        createElement(GitRecoveryCard, {
          recoveryReceipt: receipt,
          projectId,
          sessionId: 'session-a',
        }),
      ),
    );
  }
  it('shows cancelled orphan history and permits only confirmed deletion', async () => {
    const receipt = { ...base, state: 'cancelled' as const };
    request.mockResolvedValue(response(receipt));
    await recovery(receipt);
    expect(container.textContent).toContain('Approval unavailable; recovery only');
    expect(container.textContent).not.toContain('Approve Git operation');
    expect(request).toHaveBeenCalledTimes(1);
    await click(container.querySelector('input')!);
    await click(button('Delete closed record'));
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'DELETE',
      body: '{"confirmed":true}',
    });
    expect(container.textContent).toContain('Retained Git record deleted');
    expect(onDecision).not.toHaveBeenCalled();
  });
  it('allows explicit cancellation of prepared recovery-only records without execution authority', async () => {
    await recovery(base);
    expect(container.textContent).not.toContain('Approve Git operation');
    expect(container.textContent).not.toContain('Deny Git operation');
    request.mockResolvedValue(response({ ...base, state: 'cancelled', updatedAtMs: 20 }));
    await click(button('Cancel Git operation'));
    expect(request.mock.calls[1]?.[0]).toContain('/cancel');
    expect(onDecision).not.toHaveBeenCalled();
  });
  it('retains expiry and ownership checks for recovery records', async () => {
    const expired = { ...base, expiresAtMs: Date.now() - 1 };
    request.mockResolvedValue(response(expired));
    await recovery(expired);
    expect(container.textContent).toContain('expired');
    expect(container.textContent).not.toContain('Approve Git operation');
    const count = request.mock.calls.length;
    await recovery(expired, 'project-b');
    expect(container.textContent).toContain('does not match');
    expect(request).toHaveBeenCalledTimes(count);
  });
});
