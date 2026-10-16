// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHarnessRunControl } from '../hooks/use-harness-run-control';

const runId = '81ce397c-a87d-4f20-9e21-9e6edfa92322';
const secondId = '99ce397c-a87d-4f20-9e21-9e6edfa92322';
function record(overrides: Record<string, unknown> = {}) {
  return {
    id: runId,
    sessionId: 'A',
    processInstanceId: secondId,
    state: 'running',
    version: 1,
    createdAtMs: 1,
    updatedAtMs: 1,
    reason: 'none',
    inFlight: 1,
    ...overrides,
  };
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status });
}
let current: ReturnType<typeof useHarnessRunControl>;
let root: Root;
let container: HTMLDivElement;
let fetcher: ReturnType<typeof vi.fn>;
function Probe({
  session = 'A',
  id = null,
  epoch = 0,
  busy = false,
}: {
  session?: string | null;
  id?: string | null;
  epoch?: number;
  busy?: boolean;
}) {
  current = useHarnessRunControl(session, id, busy, epoch);
  return null;
}
async function render(props: Parameters<typeof Probe>[0] = {}) {
  await act(async () => {
    root.render(createElement(Probe, props));
  });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fetcher = vi.fn().mockImplementation(async () => response(record()));
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

describe('shared harness run control', () => {
  it('makes a failed initial discovery visible and supports explicit retry without inventing run state', async () => {
    fetcher.mockImplementation(async () => response(null, 503));
    await render();
    expect(current.runControlReady).toBe(false);
    expect(current.runControl).toBeNull();
    expect(current.canStop).toBe(false);
    expect(current.runControlError).toContain('unavailable');
    fetcher.mockImplementation(async () => response(record()));
    await act(async () => current.retryRunControl());
    expect(current.runControlReady).toBe(true);
    expect(current.runControl?.id).toBe(runId);
    expect(current.runControlError).toBeNull();
  });

  it('discovers an awaiting approval run on reload and sends a scoped idempotent Stop, without aborting a chat stream', async () => {
    fetcher.mockImplementation(async (_url: string, init?: RequestInit) =>
      response(
        record(
          init?.method === 'POST'
            ? { state: 'stop_requested', reason: 'user_stop', version: 2, stopAcknowledgedAtMs: 3 }
            : { state: 'waiting_for_approval' },
        ),
      ),
    );
    await render();
    expect(current.canStop).toBe(true);
    expect(current.runControlStatusText).toContain('Waiting for approval');
    await act(async () => {
      expect(await current.stop()).toBe(true);
    });
    expect(current.runControl?.state).toBe('stop_requested');
    expect(current.runControlStatusText).toContain('Stop acknowledged');
    expect(current.runControlStatusText).not.toContain('Run stopped.');
    expect(current.canStop).toBe(false);
    await act(async () => {
      expect(await current.stop()).toBe(false);
    });
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/sessions/A/runs/${runId}/stop`,
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });

  it('rejects a stale Stop callback and late responses after changing session', async () => {
    await render();
    const stopA = current.stop;
    let finish!: (response: Response) => void;
    fetcher.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    await render({ session: 'B' });
    await act(async () => {
      expect(await stopA()).toBe(false);
    });
    await act(async () => finish(response(record({ sessionId: 'A' }))));
    expect(current.runControl).toBeNull();
    expect(current.canStop).toBe(false);
    expect(current.runControlError).toContain('unavailable');
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('preserves a newer acknowledged fence against an older poll and exposes Stop failure honestly', async () => {
    vi.useFakeTimers();
    await render();
    let finishPoll!: (response: Response) => void;
    fetcher.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? Promise.resolve(
            response(record({ state: 'stop_requested', reason: 'user_stop', version: 2 })),
          )
        : new Promise<Response>((resolve) => {
            finishPoll = resolve;
          }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await act(async () => {
      await current.stop();
    });
    await act(async () => finishPoll(response(record())));
    expect(current.runControl?.state).toBe('stop_requested');
    expect(current.runControl?.version).toBe(2);
  });

  it('never claims cancellation on Stop timeout, and permits retry of the same target', async () => {
    vi.useFakeTimers();
    await render();
    fetcher.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Promise<Response>(() => {})
        : Promise.resolve(response(record())),
    );
    let completion!: Promise<boolean>;
    await act(async () => {
      completion = current.stop();
    });
    expect(current.stopPending).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await completion).toBe(false);
    expect(current.runControl?.state).toBe('running');
    expect(current.stopPending).toBe(false);
    expect(current.runControlError).toContain('termination is not confirmed');
    expect(current.canStop).toBe(true);
  });

  it('restores uncertain prior effects without polling or replay, then isolates the next explicit operation', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(async () =>
      response(record({ state: 'outcome_unknown', reason: 'process_interrupted', version: 4 })),
    );
    await render();
    expect(current.runControlStatusText).toContain('Admitted work may still finish');
    expect(current.canStop).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockImplementation(async () => response(record({ id: secondId })));
    await render({ epoch: 1, busy: true });
    expect(current.runControl?.id).toBe(secondId);
    expect(current.canStop).toBe(true);
  });

  it('bounds status reads and stops polling once an authoritative terminal row is observed', async () => {
    vi.useFakeTimers();
    await render();
    fetcher.mockImplementation(async () =>
      response(record({ state: 'cancelled', reason: 'user_stop', version: 2 })),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(current.runControlStatusText).toContain('nothing has been rolled back');
    const count = fetcher.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(count);
  });

  it.each(['running', 'waiting_for_approval'])(
    'keeps two %s views within 26 passive reads over 60 seconds',
    async (state) => {
      vi.useFakeTimers();
      fetcher.mockImplementation(async (url: string) =>
        response(record({ state, sessionId: url.includes('/sessions/B/') ? 'B' : 'A' })),
      );
      await act(async () => {
        root.render(
          createElement('div', null, createElement(Probe), createElement(Probe, { session: 'B' })),
        );
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(fetcher).toHaveBeenCalledTimes(26);
      expect(fetcher.mock.calls.every(([, init]) => !init.method)).toBe(true);
    },
  );

  it('does not poll an idle null record', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(async () => response(null));
    await render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(current.runControlReady).toBe(true);
  });

  it.each<{ headers: Record<string, string>; delay: number }>([
    {
      headers: { 'retry-after': '12', ratelimit: 'limit=100, remaining=0, reset=20' },
      delay: 20_000,
    },
    { headers: { 'retry-after': 'Fri, 16 Oct 2026 00:00:08 GMT' }, delay: 8_000 },
    {
      headers: { 'retry-after': '-1', ratelimit: 'limit=100, remaining=0, reset=NaN' },
      delay: 5_000,
    },
    { headers: { 'retry-after': 'Infinity', ratelimit: 'reset=0' }, delay: 5_000 },
  ])(
    'honors a safe passive 429 delay of $delay ms and clears errors only after success',
    async ({ headers, delay }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
      fetcher.mockImplementationOnce(
        async () => new Response('private upstream details', { status: 429, headers }),
      );
      await render();
      expect(current.runControlReady).toBe(false);
      expect(current.runControlError).toContain('termination is not confirmed');
      expect(current.runControlError).not.toContain('private upstream');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay - 1);
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(current.runControlError).toBeNull();
      expect(current.runControlReady).toBe(true);
    },
  );

  it('immediately reads normal stream settlement while its passive GET is backed off', async () => {
    vi.useFakeTimers();
    await render({ busy: true });
    fetcher.mockImplementationOnce(
      async () => new Response(null, { status: 429, headers: { 'retry-after': '60' } }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(current.runControlError).toContain('unavailable');
    const settledAt = Date.now();
    fetcher.mockImplementation(async () => response(record({ state: 'completed', version: 2 })));
    await render({ busy: false });
    expect(Date.now()).toBe(settledAt);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(current.runControl?.state).toBe('completed');
    expect(current.runControlError).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('performs explicit refresh immediately during passive backoff without cached authority', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementationOnce(
      async () => new Response(null, { status: 429, headers: { 'retry-after': '60' } }),
    );
    await render();
    expect(current.runControlReady).toBe(false);
    fetcher.mockImplementation(async () => response(record({ state: 'completed' })));
    await act(async () => current.retryRunControl());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(current.runControlReady).toBe(true);
    expect(current.runControl?.state).toBe('completed');
    expect(current.canStop).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('dispatches Stop immediately during passive backoff and immediately refreshes settlement', async () => {
    vi.useFakeTimers();
    await render();
    fetcher.mockImplementationOnce(
      async () => new Response(null, { status: 429, headers: { 'retry-after': '30' } }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(current.runControlError).toContain('unavailable');
    const beforeStop = fetcher.mock.calls.length;
    fetcher.mockImplementation(async (_url: string, init?: RequestInit) =>
      response(
        record({ state: init?.method === 'POST' ? 'stop_requested' : 'cancelled', version: 2 }),
      ),
    );
    await act(async () => {
      expect(await current.stop()).toBe(true);
    });
    expect(fetcher.mock.calls.slice(beforeStop).map(([, init]) => init?.method ?? 'GET')).toEqual([
      'POST',
      'GET',
    ]);
    expect(current.runControl?.state).toBe('cancelled');
    expect(current.runControlError).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(beforeStop + 2);
  });

  it('isolates a stale 429 from the next selection and immediately discovers explicit identities', async () => {
    vi.useFakeTimers();
    let late!: (value: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          late = resolve;
        }),
    );
    await render();
    fetcher.mockImplementation(async () =>
      response(record({ sessionId: 'B', state: 'completed' })),
    );
    await render({ session: 'B' });
    await act(async () => {
      late(new Response(null, { status: 429, headers: { 'retry-after': '60' } }));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(current.runControl?.sessionId).toBe('B');
    expect(current.runControlError).toBeNull();
    fetcher.mockImplementation(async () => response(record({ sessionId: 'B', id: secondId })));
    await render({ session: 'B', id: secondId, epoch: 1 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(current.runControl?.id).toBe(secondId);
  });
});
