// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHarnessChat, type ChatAdmission } from '../hooks/use-harness-chat';

type Hook = ReturnType<typeof useHarnessChat>;
type Call = {
  url: string;
  init?: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};
let current: Hook;
let root: Root;
let container: HTMLDivElement;
let calls: Call[];
let renderSnapshots: Array<{
  session: string | null;
  messages: string[];
  status: string;
  restoration: string;
}>;
function Probe({ session, resume }: { session: string | null; resume: boolean }) {
  current = useHarnessChat(session, resume);
  renderSnapshots.push({
    session,
    messages: current.messages.map((message) => message.id),
    status: current.status,
    restoration: current.restorationStatus,
  });
  return null;
}
async function select(session: string | null, resume = false, strict = false) {
  await act(async () => {
    root.render(
      strict
        ? createElement(StrictMode, null, createElement(Probe, { session, resume }))
        : createElement(Probe, { session, resume }),
    );
  });
}
function envelope(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function history(id: string) {
  return [{ id, role: 'assistant', content: `Saved ${id}` }];
}
function approval(id = 'approval-1') {
  return { id, toolName: 'server:tool', argsJson: '{}', status: 'pending', riskTier: 'high' };
}
function stream(...events: unknown[]) {
  return new Response(events.map((event) => JSON.stringify(event)).join('\n') + '\n', {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
async function respond(call: Call, response: Response) {
  await act(async () => {
    call.resolve(response);
  });
}
async function restore(start: number, id: string, approvals: unknown[] = []) {
  await act(async () => {
    call(start).resolve(envelope(history(id)));
    call(start + 1).resolve(envelope(approvals));
  });
}
function accepted(value: ChatAdmission): Extract<ChatAdmission, { accepted: true }> {
  expect(value.accepted).toBe(true);
  if (!value.accepted) throw new Error(`Refused ${value.reason}`);
  return value;
}
function text() {
  return current.messages
    .map((message) =>
      message.parts
        ?.filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(''),
    )
    .join('|');
}
function required<T>(entries: T[], index: number): T {
  const value = entries[index];
  if (value === undefined) throw new Error(`Missing expected fixture item ${index}`);
  return value;
}
function call(index: number) {
  return required(calls, index);
}
function post(index: number) {
  return required(posts(), index);
}
function posts() {
  return calls.filter((call) => call.init?.method === 'POST');
}
async function send(message = 'Hello') {
  let result!: ChatAdmission;
  await act(async () => {
    result = current.sendMessage(message);
  });
  return accepted(result);
}

beforeEach(() => {
  calls = [];
  renderSnapshots = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          calls.push({ url, init, resolve, reject });
        }),
    ),
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mounted chat session lifecycle', () => {
  it('refuses stale caller handles and an unbound session without creating effects', async () => {
    await select('A');
    const oldSend = current.sendMessage;
    const oldDecision = current.decideApproval;
    await select('B');
    expect(oldSend('stale draft')).toEqual({ accepted: false, reason: 'unbound' });
    expect(oldDecision('old-approval', 'approve')).toEqual({ accepted: false, reason: 'unbound' });
    await select(null);
    expect(current.restorationStatus).toBe('unbound');
    expect(current.messages).toEqual([]);
    expect(current.canSend).toBe(false);
    expect(current.sendMessage('draft')).toEqual({ accepted: false, reason: 'unbound' });
    expect(calls).toHaveLength(0);
  });

  it('initializes new sessions without reads and admits only one same-tick send', async () => {
    await select('new');
    expect(calls).toHaveLength(0);
    expect(current.canSend).toBe(true);
    let first!: ChatAdmission;
    let second!: ChatAdmission;
    await act(async () => {
      first = current.sendMessage('one');
      second = current.sendMessage('two');
    });
    const operation = accepted(first);
    expect(second).toEqual({ accepted: false, reason: 'busy' });
    expect(posts()).toHaveLength(1);
    await act(async () => {
      post(0).resolve(stream({ type: 'text', content: 'Finished once' }));
      await operation.completion;
    });
    expect(current.messages).toHaveLength(2);
    expect(text()).toBe('one|Finished once');
    expect(current.status).toBe('ready');
    expect(operation.isCurrent()).toBe(true);
    const next = await send('next');
    expect(operation.isCurrent()).toBe(false);
    await act(async () => {
      post(1).resolve(stream({ type: 'text', content: 'Second reply' }));
      await next.completion;
    });
  });

  it('commits history and approvals atomically and refuses direct calls while either read is held', async () => {
    await select('saved', true);
    expect(current.restorationStatus).toBe('restoring');
    expect(current.messages).toEqual([]);
    expect(current.sendMessage('draft')).toEqual({ accepted: false, reason: 'restoring' });
    await respond(call(0), envelope(history('saved-history')));
    expect(current.messages).toEqual([]);
    expect(current.canSend).toBe(false);
    expect(posts()).toHaveLength(0);
    await respond(call(1), envelope([]));
    expect(current.restorationStatus).toBe('ready');
    expect(text()).toBe('Saved saved-history');
    expect(current.canSend).toBe(true);
  });

  it.each([0, 1])(
    'gives a safe retryable failure when restore read %i fails, retry makes only reads',
    async (failedIndex) => {
      await select('saved', true);
      await respond(
        call(failedIndex),
        new Response('secret /Users/private/token', { status: 500 }),
      );
      expect(current.restorationStatus).toBe('restore-error');
      expect(current.restorationError).toBe(
        'Conversation history could not be restored. Retry history before sending.',
      );
      expect(current.sendMessage('retained draft').accepted).toBe(false);
      expect(posts()).toHaveLength(0);
      await act(async () => current.retryHistory());
      expect(calls).toHaveLength(4);
      await restore(2, 'retry-history');
      await respond(call(1 - failedIndex), envelope(failedIndex === 0 ? [] : history('obsolete')));
      expect(text()).toBe('Saved retry-history');
      expect(current.canSend).toBe(true);
      expect(posts()).toHaveLength(0);
    },
  );

  it('bounds combined restoration at 15 seconds and ignores late timed-out reads after manual retry', async () => {
    vi.useFakeTimers();
    await select('saved', true);
    await respond(call(0), envelope(history('old')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_999);
    });
    expect(current.restorationStatus).toBe('restoring');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(current.restorationStatus).toBe('restore-error');
    expect(current.restorationError).toContain('took too long');
    expect(call(0).init?.signal?.aborted).toBe(true);
    await act(async () => current.retryHistory());
    await restore(2, 'fresh');
    await respond(call(1), envelope([approval('late')]));
    expect(text()).toBe('Saved fresh');
    expect(current.hasPendingApproval).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it('hides previous session state before effects and never revives earlier A history in A→B→A', async () => {
    await select('A', true);
    await select('B', true);
    await restore(2, 'B-history');
    expect(text()).toBe('Saved B-history');
    await select('A', true);
    expect(
      renderSnapshots
        .filter((snapshot) => snapshot.session === 'A')
        .every((snapshot) => !snapshot.messages.includes('B-history')),
    ).toBe(true);
    await restore(0, 'obsolete-A');
    expect(current.messages).toEqual([]);
    await restore(4, 'fresh-A');
    expect(text()).toBe('Saved fresh-A');
  });

  it('ignores stale success and all streamed metadata/finally while B is busy', async () => {
    await select('A');
    const old = await send('A request');
    await select('B');
    const active = await send('B request');
    const before = { messages: current.messages, thinking: current.thinkingByMessage };
    await act(async () => {
      post(0).resolve(
        stream(
          { type: 'thinking', content: 'old thought' },
          { type: 'tool_result', toolId: 'old:tool', data: {} },
          {
            type: 'approval_required',
            approvalRequestId: 'old-approval',
            toolName: 'old:tool',
            argsPreview: {},
          },
          { type: 'error', code: 'MCP_OUTCOME_UNKNOWN', message: 'old failure' },
          { type: 'text', content: 'Old final' },
        ),
      );
      await old.completion;
    });
    expect(current.messages).toEqual(before.messages);
    expect(current.thinkingByMessage).toEqual(before.thinking);
    expect(current.toolEventsByMessage).toEqual({});
    expect(current.approvalEventsByMessage).toEqual({});
    expect(current.error).toBeNull();
    expect(current.diagnosticFailure).toBeNull();
    expect(current.status).toBe('streaming');
    expect(old.isCurrent()).toBe(false);
    await act(async () => {
      post(1).resolve(stream({ type: 'text', content: 'B final' }));
      await active.completion;
    });
    expect(text()).toBe('B request|B final');
  });

  it.each(['http', 'network'])(
    'ignores stale %s failure diagnostics and cleanup after A→B→A',
    async (kind) => {
      await select('A');
      const old = await send('old A');
      await select('B');
      await select('A');
      const active = await send('new A');
      await act(async () => {
        if (kind === 'http')
          post(0).resolve(
            new Response(JSON.stringify({ error: { message: 'stale error' } }), {
              status: 500,
              headers: { 'x-request-id': 'old-request', 'x-diagnostics-api-observed': '1' },
            }),
          );
        else post(0).reject(new Error('stale connection error'));
        await old.completion;
      });
      expect(text()).toBe('new A|');
      expect(current.status).toBe('streaming');
      expect(current.error).toBeNull();
      expect(current.diagnosticFailure).toBeNull();
      expect(current.diagnosticRequestId).toBeNull();
      await act(async () => {
        post(1).resolve(stream({ type: 'text', content: 'Current' }));
        await active.completion;
      });
    },
  );

  it('uses a fresh restoration epoch under Strict Mode and invalidates unmounted operations', async () => {
    await select('strict', true, true);
    expect(calls).toHaveLength(4);
    expect(call(0).init?.signal?.aborted).toBe(true);
    await restore(0, 'discarded-strict');
    expect(current.messages).toEqual([]);
    await restore(2, 'current-strict');
    const operation = await send();
    await act(async () => root.unmount());
    expect(operation.isCurrent()).toBe(false);
    await act(async () => {
      post(0).resolve(stream({ type: 'text', content: 'Unmounted final' }));
      await operation.completion;
    });
    root = createRoot(container);
  });

  it.each(['approve', 'reject'] as const)(
    'restores pending approval, admits %s once and preserves terminal behavior',
    async (decision) => {
      await select('saved', true);
      await restore(0, 'assistant', [approval()]);
      expect(current.canSend).toBe(false);
      expect(current.sendMessage('blocked')).toEqual({
        accepted: false,
        reason: 'pending-approval',
      });
      expect(current.decideApproval('not-current', decision)).toEqual({
        accepted: false,
        reason: 'invalid-approval',
      });
      let result!: ChatAdmission;
      await act(async () => {
        result = current.decideApproval('approval-1', decision);
        expect(current.decideApproval('approval-1', decision)).toEqual({
          accepted: false,
          reason: 'busy',
        });
        expect(current.sendMessage('duplicate').accepted).toBe(false);
      });
      const operation = accepted(result);
      expect(posts()).toHaveLength(1);
      await respond(post(0), envelope({}));
      expect(posts()).toHaveLength(2);
      await act(async () => {
        post(1).resolve(stream({ type: 'text', content: 'Decision final' }));
        await operation.completion;
      });
      const card = required(Object.values(current.approvalEventsByMessage).flat(), 0);
      expect(card.status).toBe(decision === 'approve' ? 'executed' : 'rejected');
      expect(text()).toContain('Decision final');
      expect(current.canSend).toBe(true);
    },
  );

  it('keeps restored approvals actionable even without a prior assistant message', async () => {
    await select('saved', true);
    await act(async () => {
      call(0).resolve(envelope([]));
      call(1).resolve(envelope([approval()]));
    });
    expect(current.messages).toHaveLength(1);
    expect(current.hasPendingApproval).toBe(true);
    expect(
      required(Object.values(current.approvalEventsByMessage).flat(), 0).approvalRequestId,
    ).toBe('approval-1');
  });

  it('does not publish an in-flight old approval into the next session', async () => {
    await select('A', true);
    await restore(0, 'A-assistant', [approval()]);
    let admission!: ChatAdmission;
    await act(async () => {
      admission = current.decideApproval('approval-1', 'approve');
    });
    const old = accepted(admission);
    await select('B');
    const active = await send('B');
    await respond(post(0), envelope({}));
    await act(async () => {
      post(2).resolve(
        stream({ type: 'error', code: 'MCP_OUTCOME_UNKNOWN', message: 'Old uncertain effect' }),
      );
      await old.completion;
    });
    expect(current.approvalEventsByMessage).toEqual({});
    expect(current.toolEventsByMessage).toEqual({});
    expect(current.error).toBeNull();
    expect(current.status).toBe('streaming');
    expect(text()).toBe('B|');
    await act(async () => {
      post(1).resolve(stream({ type: 'text', content: 'B done' }));
      await active.completion;
    });
  });

  it.each(['MCP_APPROVAL_STALE', 'MCP_OUTCOME_UNKNOWN'])(
    'retains %s terminal no-replay status',
    async (code) => {
      await select('A', true);
      await restore(0, 'assistant', [approval()]);
      let result!: ChatAdmission;
      await act(async () => {
        result = current.decideApproval('approval-1', 'approve');
      });
      const operation = accepted(result);
      await respond(post(0), envelope({}));
      await act(async () => {
        post(1).resolve(
          code === 'MCP_APPROVAL_STALE'
            ? new Response(JSON.stringify({ error: { code, message: 'Stale' } }), { status: 409 })
            : stream({ type: 'error', code, message: 'Unknown' }),
        );
        await operation.completion;
      });
      expect(required(Object.values(current.approvalEventsByMessage).flat(), 0).status).toBe(
        'not_completed',
      );
      expect(current.decideApproval('approval-1', 'approve')).toEqual({
        accepted: false,
        reason: 'invalid-approval',
      });
      expect(posts()).toHaveLength(2);
    },
  );

  it('preserves a controlled stream error and context-limit refusal without replay', async () => {
    await select('new');
    const operation = await send();
    await act(async () => {
      post(0).resolve(
        stream({
          type: 'error',
          code: 'CONTEXT_BUDGET_EXCEEDED',
          message: 'The context limit was reached.',
        }),
      );
      await operation.completion;
    });
    expect(text()).toContain('The context limit was reached.');
    expect(current.status).toBe('ready');
    expect(posts()).toHaveLength(1);
  });
});
