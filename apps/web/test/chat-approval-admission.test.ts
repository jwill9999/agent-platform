// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHarnessChat } from '../hooks/use-harness-chat';
import { ApprovalCard } from '../components/chat/approval-card';

let current: ReturnType<typeof useHarnessChat>;
let root: Root;
let container: HTMLDivElement;
let discover: (response: Response) => void;
let fetcher: ReturnType<typeof vi.fn>;
const session = 'approval-session';
const pending = {
  id: 'pending-review',
  toolName: 'fixture:effect',
  argsJson: '{}',
  status: 'pending',
  riskTier: 'high',
};
function envelope(data: unknown) {
  return new Response(JSON.stringify({ data }));
}
function Probe() {
  current = useHarnessChat(session, true);
  return createElement(
    React.Fragment,
    null,
    ...Object.values(current.approvalEventsByMessage)
      .flat()
      .map((approval) =>
        createElement(ApprovalCard, {
          key: approval.approvalRequestId,
          approval,
          onDecision: current.canDecideApproval
            ? (id, decision) => {
                current.decideApproval(id, decision);
              }
            : undefined,
        }),
      ),
  );
}
function deny() {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Deny',
  )!;
}
beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/active-run'))
      return new Promise<Response>((resolve) => {
        discover = resolve;
      });
    if (url.endsWith('/messages'))
      return envelope([
        { id: 'historical-assistant', role: 'assistant', content: 'Review pending action' },
      ]);
    if (url.includes('/approval-requests/git-delivery?'))
      return envelope({ approvals: [], recoveryReceipts: [] });
    if (url.includes('/approval-requests?')) return envelope([pending]);
    if (url.endsWith('/reject') && init?.method === 'POST')
      return envelope({ ...pending, status: 'rejected' });
    if (url.endsWith('/resume') && init?.method === 'POST')
      return new Response(JSON.stringify({ type: 'text', content: 'Decision retained.' }) + '\n', {
        headers: { 'content-type': 'application/x-ndjson' },
      });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Probe)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it('keeps restored decisions disabled until authority is discovered, then admits exactly one click', async () => {
  expect(current.restorationStatus).toBe('ready');
  expect(current.runControlReady).toBe(false);
  expect(current.hasPendingApproval).toBe(true);
  expect(current.canSend).toBe(false);
  expect(deny().disabled).toBe(true);
  await act(async () => deny().click());
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  await act(async () =>
    discover(
      envelope({
        id: '81ce397c-a87d-4f20-9e21-9e6edfa92322',
        sessionId: session,
        processInstanceId: '99ce397c-a87d-4f20-9e21-9e6edfa92322',
        state: 'waiting_for_approval',
        version: 1,
        createdAtMs: 1,
        updatedAtMs: 1,
        reason: 'none',
        inFlight: 0,
      }),
    ),
  );
  expect(current.runControlError).toBeNull();
  expect(current.runControlReady).toBe(true);
  expect(current.canDecideApproval).toBe(true);
  expect(current.canSend).toBe(false);
  expect(deny().disabled).toBe(false);
  await act(async () => deny().click());
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/reject'))).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/resume'))).toHaveLength(1);
  expect(deny()).toBeUndefined();
});
