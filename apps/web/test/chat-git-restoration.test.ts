// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitDeliveryReceipt } from '@agent-platform/contracts';
import { useHarnessChat } from '@/hooks/use-harness-chat';
import { Chat } from '@/components/chat/chat';

vi.mock('@/components/chat/chat-input', () => ({ ChatInput: () => null }));
vi.mock('@/components/chat/diagnostic-export', () => ({ DiagnosticExportAction: () => null }));
vi.mock('@/components/chat/markdown', () => ({ Markdown: () => null }));
vi.mock('@/components/chat/workspace-resource-cards', () => ({
  WorkspaceResourcePreviewProvider: ({ children }: { children: React.ReactNode }) => children,
  WorkspaceResourceCards: () => null,
}));
const base: GitDeliveryReceipt = {
  id: 'a32bc144-534c-4890-98b6-687b8f668104',
  projectId: 'project-a',
  sessionId: 'session-a',
  source: 'chat',
  action: { kind: 'commit', message: 'Saved review', paths: ['file.txt'] },
  state: 'unknown',
  createdAtMs: 10,
  updatedAtMs: 20,
  expiresAtMs: Date.now() + 60000,
  review: {
    branch: 'task/retained',
    head: 'a'.repeat(40),
    indexTree: 'b'.repeat(40),
    paths: ['file.txt'],
  },
};
function approval(receipt = base, status = 'approved') {
  return {
    id: 'saved-approval',
    sessionId: receipt.sessionId,
    runId: 'run',
    agentId: 'agent',
    toolName: 'sys_git_commit',
    argsJson: JSON.stringify({ gitDeliveryReceipt: receipt }),
    riskTier: 'high',
    status,
    createdAtMs: 10,
    resumedAtMs: 20,
    executionPayloadJson: null,
  };
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
let root: Root;
let container: HTMLDivElement;
let current: ReturnType<typeof useHarnessChat>;
let fetcher: ReturnType<typeof vi.fn>;
let inventory: { approvals: unknown[]; recoveryReceipts: unknown[] };
let pending: unknown[];
let saved: GitDeliveryReceipt;
function Probe({
  session = 'session-a',
  project = 'project-a',
}: {
  session?: string;
  project?: string;
}) {
  current = useHarnessChat(session, true);
  return createElement(Chat, {
    messages: current.messages,
    isLoading: false,
    onSend: () => false,
    showSensors: false,
    diagnosticSessionId: session,
    workspaceWebViewProjectId: project,
    approvalEventsByMessage: current.approvalEventsByMessage,
    gitRecoveryReceipts: current.gitRecoveryReceipts,
    onApprovalDecision: current.decideApproval,
    onGitReceiptChange: current.updateGitReceipt,
    onGitReceiptDeleted: current.removeGitReceipt,
  });
}
function runDiscoveryCalls() {
  return fetcher.mock.calls.filter(([url]) => url.endsWith('/active-run'));
}
function gitRestorationCalls() {
  // Preserve the existing history/Git read budget: one new mandatory control read
  // is independent of the ten-card pagination and must not conceal extra Git IO.
  return fetcher.mock.calls.filter(([url]) => !url.endsWith('/active-run'));
}
async function render(session = 'session-a', project = 'project-a') {
  await act(async () => root.render(createElement(Probe, { session, project })));
}
function button(label: string) {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  HTMLElement.prototype.scrollTo = vi.fn();
  inventory = { approvals: [approval()], recoveryReceipts: [] };
  pending = [];
  saved = { ...base };
  fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/active-run')) return response(null);
    if (url.includes('/approval-requests/git-delivery?')) return response(inventory);
    if (url.includes('/approval-requests?')) return response(pending);
    if (url.endsWith('/messages'))
      return response([{ id: 'history', role: 'assistant', content: 'Saved conversation' }]);
    if (url.includes('/git/delivery/'))
      return response(init?.method === 'DELETE' ? { deleted: true } : saved);
    throw new Error(`Unexpected fixture request ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('retained Git chat restoration', () => {
  it.each(['unknown', 'succeeded', 'expired'] as const)(
    'restores %s truth and actual approval status without the Git rail or replay',
    async (state) => {
      saved = { ...base, state };
      inventory.approvals = [approval(saved)];
      await render();
      expect(current.restorationStatus).toBe('ready');
      expect(Object.values(current.approvalEventsByMessage).flat()[0]?.status).toBe('approved');
      expect(container.textContent).toContain(
        state === 'unknown' ? 'Outcome unknown' : `Status: ${state}`,
      );
      expect(container.textContent).not.toContain('Approve Git operation');
      expect(fetcher.mock.calls.every(([, init]) => !init?.method)).toBe(true);
      expect(current.canSend).toBe(true);
    },
  );
  it('restores unknown reconciliation and acknowledged-history deletion through explicit controls', async () => {
    saved = { ...base, acknowledgedAtMs: 25 };
    inventory.approvals = [approval(saved)];
    await render();
    expect(runDiscoveryCalls()).toHaveLength(1);
    expect(gitRestorationCalls()).toHaveLength(4);
    await click(button('Check actual outcome'));
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain('/reconcile');
    await click(container.querySelector('input')!);
    await click(button('Delete closed record'));
    expect(fetcher.mock.calls.at(-1)?.[1]).toMatchObject({
      method: 'DELETE',
      body: '{"confirmed":true}',
    });
    expect(container.querySelectorAll('[data-testid="git-approval-card"]')).toHaveLength(0);
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/execute'))).toBe(false);
  });
  it('omits deleted pending Git ghosts while retaining generic approvals', async () => {
    inventory.approvals = [];
    pending = [
      approval(base, 'pending'),
      {
        id: 'generic',
        toolName: 'server:tool',
        argsJson: '{}',
        status: 'pending',
        riskTier: 'high',
      },
    ];
    await render();
    expect(
      Object.values(current.approvalEventsByMessage)
        .flat()
        .map((a) => a.approvalRequestId),
    ).toEqual(['generic']);
    expect(container.textContent).not.toContain('Review Git operation');
  });
  it('restores cancelled records without approval as recovery-only capacity controls', async () => {
    saved = { ...base, state: 'cancelled' };
    inventory = { approvals: [], recoveryReceipts: [saved] };
    await render();
    expect(Object.values(current.approvalEventsByMessage).flat()).toHaveLength(0);
    expect(container.textContent).toContain('Approval unavailable; recovery only');
    await click(container.querySelector('input')!);
    await click(button('Delete closed record'));
    expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE');
  });
  it.each([
    () => ({ approvals: [{ ...approval(), sessionId: 'foreign' }], recoveryReceipts: [] }),
    () => ({ approvals: [{ ...approval(), toolName: 'sys_git_push' }], recoveryReceipts: [] }),
    () => ({
      approvals: [{ ...approval(), executionPayloadJson: 'private' }],
      recoveryReceipts: [],
    }),
    () => ({ approvals: [approval(), approval()], recoveryReceipts: [] }),
    () => ({ approvals: [], recoveryReceipts: [{ ...base, sessionId: 'foreign' }] }),
  ])('fails the entire restore barrier for invalid owned inventory', async (make) => {
    inventory = make();
    await render();
    expect(current.restorationStatus).toBe('restore-error');
    expect(current.messages).toHaveLength(0);
    expect(current.canSend).toBe(false);
    expect(runDiscoveryCalls()).toHaveLength(1);
    expect(gitRestorationCalls()).toHaveLength(3);
    expect(container.textContent).not.toContain('Approve Git operation');
  });
  it('does not fetch foreign Project receipt even with a valid session-shaped record', async () => {
    await render('session-a', 'project-b');
    expect(container.textContent).toContain('does not match');
    expect(runDiscoveryCalls()).toHaveLength(1);
    expect(gitRestorationCalls()).toHaveLength(3);
  });
  it('keeps failed inventory reads behind the history barrier', async () => {
    fetcher.mockImplementation(async (url: string) =>
      url.endsWith('/active-run')
        ? response(null)
        : url.includes('/git-delivery?')
          ? response(null, 503)
          : response([]),
    );
    await render();
    expect(current.restorationStatus).toBe('restore-error');
    expect(current.messages).toHaveLength(0);
    expect(current.sendMessage('new')).toEqual({ accepted: false, reason: 'restore-error' });
  });
  it('ignores an obsolete A to B to A inventory response and an unmounted response', async () => {
    const delayed: Array<(value: Response) => void> = [];
    fetcher.mockImplementation(async (url: string) =>
      url.endsWith('/active-run')
        ? response(null)
        : url.includes('/git-delivery?')
          ? new Promise<Response>((resolve) => delayed.push(resolve))
          : response([]),
    );
    await render();
    await render('session-b', 'project-b');
    await render();
    await act(async () => delayed[2]!(response({ approvals: [], recoveryReceipts: [] })));
    expect(current.restorationStatus).toBe('ready');
    await act(async () => delayed[0]!(response(inventory)));
    expect(current.gitRecoveryReceipts).toHaveLength(0);
    expect(Object.keys(current.approvalEventsByMessage)).toHaveLength(0);
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => delayed[1]!(response(inventory)));
    expect(container.textContent).toBe('');
  });
  it.each(['expired', 'cancelled', 'denied', 'stale'] as const)(
    'does not let %s pending Git receipt block new chat',
    async (state) => {
      saved = { ...base, state };
      inventory.approvals = [approval(saved, 'pending')];
      await render();
      expect(Object.values(current.approvalEventsByMessage).flat()[0]?.status).toBe('pending');
      expect(current.canSend).toBe(true);
      expect(button('Approve Git operation').disabled).toBe(true);
    },
  );
  it('releases an owner-scoped pending barrier when the live review expires without network events', async () => {
    vi.useFakeTimers();
    saved = { ...base, state: 'prepared', expiresAtMs: Date.now() + 1000 };
    inventory.approvals = [approval(saved, 'pending')];
    await render();
    expect(current.canSend).toBe(false);
    expect(button('Approve Git operation').disabled).toBe(false);
    const requests = fetcher.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(1001));
    expect(current.canSend).toBe(true);
    expect(button('Approve Git operation').disabled).toBe(true);
    expect(fetcher.mock.calls).toHaveLength(requests);
  });
  it('updates the send barrier only from a validated current-owner saved receipt', async () => {
    saved = { ...base, state: 'prepared' };
    inventory.approvals = [approval(saved, 'pending')];
    await render();
    expect(current.canSend).toBe(false);
    const oldUpdate = current.updateGitReceipt;
    saved = { ...saved, state: 'cancelled', updatedAtMs: 25 };
    await click(button('Refresh saved Git outcome'));
    expect(current.canSend).toBe(true);
    expect(button('Approve Git operation').disabled).toBe(true);
    inventory = { approvals: [], recoveryReceipts: [] };
    await render('session-b', 'project-b');
    await render();
    await act(async () => oldUpdate(saved));
    expect(Object.values(current.approvalEventsByMessage).flat()).toHaveLength(0);
  });
  it('bounds interactive reads across 1000 approvals and recovery records while keeping the oldest reachable', async () => {
    const receipts = Array.from({ length: 1000 }, (_, index) => ({
      ...base,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      state: 'cancelled' as const,
      createdAtMs: index,
      updatedAtMs: 1001,
    }));
    inventory = {
      approvals: receipts
        .slice(0, 500)
        .map((receipt, index) => ({ ...approval(receipt), id: `approval-${index}` })),
      recoveryReceipts: receipts.slice(500),
    };
    fetcher.mockImplementation(async (url: string) => {
      if (url.endsWith('/active-run')) return response(null);
      if (url.includes('/approval-requests/git-delivery?')) return response(inventory);
      if (url.includes('/approval-requests?') || url.endsWith('/messages')) return response([]);
      const receipt = receipts.find((row) => url.endsWith(row.id));
      if (!receipt) throw new Error('Unexpected owned receipt read');
      return response(receipt);
    });
    await render();
    expect(runDiscoveryCalls()).toHaveLength(1);
    expect(gitRestorationCalls()).toHaveLength(13);
    expect(container.querySelectorAll('[data-testid="git-approval-card"]')).toHaveLength(10);
    expect(container.textContent).toContain('Git records 991–1000 of 1000');
    await click(button('Oldest Git records'));
    expect(runDiscoveryCalls()).toHaveLength(1);
    expect(gitRestorationCalls()).toHaveLength(23);
    expect(container.textContent).toContain(receipts[0]!.id);
    expect(container.textContent).toContain('Git records 1–10 of 1000');
    expect(fetcher.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });
  it('removes a confirmed deletion from pagination and ignores obsolete-owner deletion notifications', async () => {
    const receipts = Array.from({ length: 12 }, (_, index) => ({
      ...base,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      state: 'cancelled' as const,
      createdAtMs: index,
      updatedAtMs: 100,
    }));
    inventory = { approvals: [], recoveryReceipts: receipts };
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/active-run')) return response(null);
      if (url.includes('/approval-requests/git-delivery?')) return response(inventory);
      if (url.includes('/approval-requests?') || url.endsWith('/messages')) return response([]);
      const receipt = receipts.find((row) => url.endsWith(row.id));
      if (!receipt) throw new Error('Unexpected read');
      return response(init?.method === 'DELETE' ? { deleted: true } : receipt);
    });
    await render();
    await click(button('Oldest Git records'));
    const oldRemove = current.removeGitReceipt;
    const first = container.querySelector('[data-testid="git-approval-card"]')!;
    await click(first.querySelector('input')!);
    await click(
      [...first.querySelectorAll('button')].find((b) => b.textContent === 'Delete closed record')!,
    );
    expect(current.gitRecoveryReceipts).toHaveLength(11);
    const afterDelete = fetcher.mock.calls.length;
    await click(button('Latest Git records'));
    await click(button('Oldest Git records'));
    expect(container.textContent).not.toContain(receipts[0]!.id);
    expect(
      fetcher.mock.calls.slice(afterDelete).some(([url]) => url.endsWith(receipts[0]!.id)),
    ).toBe(false);
    inventory = { approvals: [], recoveryReceipts: [] };
    await render('session-b', 'project-b');
    inventory = { approvals: [], recoveryReceipts: receipts };
    await render();
    await act(async () => oldRemove(receipts[0]!));
    expect(current.gitRecoveryReceipts).toHaveLength(12);
  });
});
