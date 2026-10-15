// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitDeliveryReceipt } from '@agent-platform/contracts';
import {
  GitDeliveryReceiptControl,
  type GitDeliveryReceiptProps,
} from '@/components/project/git-delivery-receipt';

const base: GitDeliveryReceipt = {
  id: 'c6b36cb6-6039-4ea9-839f-f7ed39f486f0',
  projectId: 'fixture',
  source: 'panel',
  action: {
    kind: 'commit',
    message: 'Reviewed message\nwith second line',
    paths: ['literal\nfile.txt', '.agent-platform/visible.txt'],
  },
  state: 'prepared',
  createdAtMs: 1,
  updatedAtMs: 1,
  expiresAtMs: 100,
  review: {
    branch: 'task/fixture',
    head: 'a'.repeat(40),
    indexTree: 'b'.repeat(40),
    paths: ['literal\nfile.txt', '.agent-platform/visible.txt'],
  },
};
let container: HTMLDivElement;
let root: Root;
let callbacks: Required<
  Pick<
    GitDeliveryReceiptProps,
    'onConfirm' | 'onCancel' | 'onReconcile' | 'onAcknowledge' | 'onDelete'
  >
>;
async function render(
  receipt: GitDeliveryReceipt = base,
  props: Partial<GitDeliveryReceiptProps> = {},
) {
  await act(async () =>
    root.render(
      createElement(GitDeliveryReceiptControl, { receipt, nowMs: 50, ...callbacks, ...props }),
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
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  callbacks = {
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onReconcile: vi.fn(),
    onAcknowledge: vi.fn(),
    onDelete: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('pure Git delivery receipt controls', () => {
  it('shows complete reviewed material and only calls confirm on explicit click', async () => {
    await render({
      ...base,
      review: { ...base.review, warning: 'Fresh operation could duplicate a previous effect.' },
    });
    expect(container.textContent).toContain(
      base.action.kind === 'commit' ? base.action.message : '',
    );
    expect(container.textContent).toContain('.agent-platform/visible.txt');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('duplicate');
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    await click(button('Confirm Git operation'));
    expect(callbacks.onConfirm).toHaveBeenCalledTimes(1);
    expect(callbacks.onConfirm).toHaveBeenCalledWith(base.id);
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });
  it('does not offer another mutation while a saved response is unverified', async () => {
    await render(base, { unverified: true });
    expect(container.querySelector('output')?.textContent).toContain('unverified');
    expect(container.querySelectorAll('button,input')).toHaveLength(0);
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
  });
  it('disables expired and pending confirmation without executing on update', async () => {
    await render(base, { nowMs: 100 });
    expect(button('Confirm Git operation').disabled).toBe(true);
    await click(button('Confirm Git operation'));
    await render(base, { pending: true });
    expect(button('Cancel Git operation').disabled).toBe(true);
    await click(button('Confirm Git operation'));
    expect(callbacks.onConfirm).not.toHaveBeenCalled();
  });
  it('keeps unknown uncertain and requires separate acknowledgement before recovery', async () => {
    await render({ ...base, state: 'unknown' });
    expect(container.querySelector('output')?.textContent).toContain('Outcome unknown');
    expect(container.textContent).not.toContain('Confirm Git operation');
    expect(container.textContent).not.toContain('Delete closed record');
    expect(button('Acknowledge uncertain outcome').disabled).toBe(true);
    await click(button('Check actual outcome'));
    expect(callbacks.onReconcile).toHaveBeenCalledTimes(1);
    expect(callbacks.onReconcile).toHaveBeenCalledWith(base.id);
    await click(container.querySelector('input')!);
    expect(callbacks.onAcknowledge).not.toHaveBeenCalled();
    await click(button('Acknowledge uncertain outcome'));
    expect(callbacks.onAcknowledge).toHaveBeenCalledTimes(1);
    expect(callbacks.onAcknowledge).toHaveBeenCalledWith(base.id);
    expect(container.querySelector('output')?.textContent).toContain('unknown');
  });
  it('requires deletion confirmation, resets it for a changed receipt, never retries', async () => {
    await render({ ...base, state: 'unknown', acknowledgedAtMs: 0 });
    expect(button('Delete closed record').disabled).toBe(true);
    await click(container.querySelector('input')!);
    await render({ ...base, state: 'unknown', acknowledgedAtMs: 0, updatedAtMs: 2 });
    expect(button('Delete closed record').disabled).toBe(true);
    expect(container.textContent).not.toContain('Confirm Git operation');
    await click(container.querySelector('input')!);
    await click(button('Delete closed record'));
    expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
    expect(callbacks.onDelete).toHaveBeenCalledWith(base.id);
    expect(callbacks.onConfirm).not.toHaveBeenCalled();
  });
  it.each(['executing', 'succeeded', 'failed', 'cancelled', 'denied', 'stale', 'expired'] as const)(
    'never executes a %s receipt',
    async (state) => {
      await render({ ...base, state });
      expect(container.textContent).not.toContain('Confirm Git operation');
      expect(container.textContent).not.toContain('Check actual outcome');
      if (state === 'executing')
        expect(container.textContent).not.toContain('Delete closed record');
      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    },
  );
  it('renders explicit PR material and result as text without executable markup', async () => {
    await render({
      ...base,
      action: {
        kind: 'pull_request',
        baseBranch: 'staging',
        title: '<script>unsafe</script>',
        body: 'Exact\nbody',
        draft: true,
      },
      state: 'succeeded',
      result: { pullRequestUrl: 'javascript:alert(1)', warning: 'Created; refresh unavailable.' },
    });
    expect(container.textContent).toContain('staging');
    expect(container.textContent).toContain('<script>unsafe</script>');
    expect(container.textContent).toContain('Exact\nbody');
    expect(container.textContent).toContain('Yes');
    expect(container.textContent).toContain('Created; refresh unavailable.');
    expect(container.querySelector('script,a')).toBeNull();
  });
});
