// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitDeliveryReceipt } from '@agent-platform/contracts';
import { useGitDelivery } from '@/lib/useGitDelivery';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<object>()),
  apiGet: transport.get,
  apiPost: transport.post,
  apiDelete: transport.remove,
}));
const receipt: GitDeliveryReceipt = {
  id: '7ef19449-8403-4d88-b71f-101933083849',
  projectId: 'first',
  source: 'panel',
  action: { kind: 'stage', mode: 'stage', paths: ['safe.txt'] },
  state: 'prepared',
  createdAtMs: 1,
  updatedAtMs: 1,
  expiresAtMs: 500,
  review: {
    branch: 'task/test',
    head: 'a'.repeat(40),
    indexTree: 'b'.repeat(40),
    paths: ['safe.txt'],
  },
};
let current: ReturnType<typeof useGitDelivery>;
let container: HTMLDivElement;
let root: Root;
function Harness({ projectId }: { projectId: string }) {
  current = useGitDelivery(projectId);
  return null;
}
async function mount(projectId = 'first') {
  await act(async () => root.render(createElement(Harness, { projectId })));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  transport.get
    .mockReset()
    .mockImplementation(async (path: string) =>
      path.endsWith('/index') ? { paths: ['.agent-platform/staged.txt'] } : { operations: [] },
    );
  transport.post.mockReset();
  transport.remove.mockReset().mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Git delivery browser transport state', () => {
  it('reopens unresolved outcomes ahead of old history and preserves explicit selection', async () => {
    const cancelled = { ...receipt, state: 'cancelled' as const };
    const unknown = { ...receipt, id: 'unknown', state: 'unknown' as const, createdAtMs: 2 };
    const latest = { ...receipt, id: 'latest', state: 'succeeded' as const, createdAtMs: 3 };
    let operations: GitDeliveryReceipt[] = [cancelled, unknown, latest];
    transport.get.mockImplementation(async (path: string) =>
      path.endsWith('/index') ? { paths: [] } : { operations },
    );
    await mount();
    expect(current.selected?.id).toBe('unknown');
    await act(async () => current.select(cancelled.id));
    await act(async () => current.refresh());
    expect(current.selected?.id).toBe(cancelled.id);
    operations = [cancelled, { ...unknown, acknowledgedAtMs: 4 }, latest];
    await mount('second');
    await mount();
    expect(current.selected?.id).toBe('latest');
    expect(transport.post).not.toHaveBeenCalled();
  });
  it('loads full index without mutations and separates preparation from confirmation', async () => {
    await mount();
    expect(current.stagedPaths).toEqual(['.agent-platform/staged.txt']);
    expect(transport.post).not.toHaveBeenCalled();
    transport.post.mockResolvedValueOnce(receipt);
    await act(async () => {
      await current.prepare(receipt.action);
    });
    expect(transport.post).toHaveBeenCalledTimes(1);
    expect(transport.post.mock.calls[0]?.slice(0, 2)).toEqual([
      '/api/v1/projects/first/git/delivery',
      { action: receipt.action },
    ]);
    expect(current.selected?.state).toBe('prepared');
    transport.post.mockResolvedValueOnce({ ...receipt, state: 'succeeded' });
    await act(async () => {
      await current.perform(receipt.id, 'execute');
    });
    expect(transport.post.mock.calls[1]?.slice(0, 2)).toEqual([
      `/api/v1/projects/first/git/delivery/${receipt.id}/execute`,
      { confirmed: true },
    ]);
    expect(current.selected?.state).toBe('succeeded');
  });
  it('aborts owned request and ignores late results after changing Project', async () => {
    await mount();
    const pending = deferred<GitDeliveryReceipt>();
    transport.post.mockReturnValue(pending.promise);
    let operation!: Promise<GitDeliveryReceipt | undefined>;
    await act(async () => {
      operation = current.prepare(receipt.action);
    });
    const signal = transport.post.mock.calls[0]?.[2].signal as AbortSignal;
    await mount('second');
    expect(signal.aborted).toBe(true);
    await act(async () => {
      pending.resolve(receipt);
      await operation;
    });
    expect(current.projectId).toBe('second');
    expect(current.operations).toEqual([]);
    expect(current.pending).toBe(false);
  });
  it('does not let an earlier read replace a newly prepared operation', async () => {
    await mount();
    const old = deferred<{ operations: GitDeliveryReceipt[] }>();
    transport.get.mockImplementation((path: string) =>
      path.endsWith('/index') ? Promise.resolve({ paths: [] }) : old.promise,
    );
    let read!: Promise<void>;
    await act(async () => {
      read = current.refresh();
    });
    transport.post.mockResolvedValue(receipt);
    await act(async () => {
      await current.prepare(receipt.action);
    });
    await act(async () => {
      old.resolve({ operations: [] });
      await read;
    });
    expect(current.selected?.id).toBe(receipt.id);
  });
  it('never retries a lost mutation response and can read the saved unknown result', async () => {
    await mount();
    transport.post.mockResolvedValueOnce(receipt);
    await act(async () => {
      await current.prepare(receipt.action);
    });
    transport.post.mockRejectedValueOnce(new Error('private subprocess text'));
    await act(async () => {
      await current.perform(receipt.id, 'execute');
    });
    expect(transport.post).toHaveBeenCalledTimes(2);
    expect(current.error).toContain('Inspect the saved operation');
    expect(current.error).not.toContain('private');
    expect(current.unverifiedIds).toContain(receipt.id);
    transport.get.mockImplementation(async (path: string) =>
      path.endsWith('/index') ? { paths: [] } : { operations: [{ ...receipt, state: 'unknown' }] },
    );
    await act(async () => {
      await current.refresh();
    });
    expect(current.selected?.state).toBe('unknown');
    expect(transport.post).toHaveBeenCalledTimes(2);
  });

  it('retains durable recovery history when the current index cannot be read', async () => {
    await mount();
    transport.get.mockImplementation((path: string) =>
      path.endsWith('/index')
        ? Promise.reject(new Error('index unavailable'))
        : Promise.resolve({ operations: [{ ...receipt, state: 'unknown' }] }),
    );
    await act(async () => {
      await current.refresh();
    });
    expect(current.selected?.state).toBe('unknown');
    expect(current.stagedPaths).toEqual([]);
    expect(current.error).toContain('Saved Git outcomes remain available');
  });
  it('rejects captured old-Project callbacks even when invoked after a switch', async () => {
    await mount();
    const previous = current;
    transport.get.mockImplementation(async (path: string) =>
      path.endsWith('/index')
        ? { paths: ['second.txt'] }
        : { operations: [{ ...receipt, projectId: 'second' }] },
    );
    await mount('second');
    const reads = transport.get.mock.calls.length;
    await act(async () => {
      await previous.refresh();
      await previous.prepare(receipt.action);
    });
    expect(transport.get).toHaveBeenCalledTimes(reads);
    expect(transport.post).not.toHaveBeenCalled();
    expect(current.projectId).toBe('second');
    expect(current.stagedPaths).toEqual(['second.txt']);
    expect(current.selected?.projectId).toBe('second');
  });
  it('deletes only after the explicit caller action and sends confirmation', async () => {
    await mount();
    expect(transport.remove).not.toHaveBeenCalled();
    await act(async () => {
      await current.remove(receipt.id);
    });
    expect(transport.remove).toHaveBeenCalledWith(
      `/api/v1/projects/first/git/delivery/${receipt.id}`,
      { confirmed: true },
    );
  });
});
