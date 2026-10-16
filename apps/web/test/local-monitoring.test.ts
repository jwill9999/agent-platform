// @vitest-environment jsdom
import React, { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LocalMonitoring } from '@/components/settings/local-monitoring';
const health = {
  state: 'ready',
  reason: 'none',
  pending: 0,
  dropped: 0,
  conflicts: 0,
  pruned: 0,
  acknowledgedSequence: 0,
  lastAcknowledgedAtMs: null,
  processInstanceId: 'a05c3073-5151-4659-8578-1cbe3973b17d',
  previousShutdownUnclean: false,
};
const preference = { samplingEnabled: false, retentionDays: 7, version: 1 };
const status = { monitoring: { ...health, preference }, diagnostics: health };
let host: HTMLDivElement;
let root: Root;
let api: {
  getMonitoringStatus: ReturnType<typeof vi.fn>;
  setMonitoringPreference: ReturnType<typeof vi.fn>;
  saveMonitoringReport: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  api = {
    getMonitoringStatus: vi.fn().mockResolvedValue(status),
    setMonitoringPreference: vi.fn(),
    saveMonitoringReport: vi.fn(),
  };
  vi.stubGlobal('agentPlatformDesktop', { diagnostics: api });
  vi.stubGlobal('fetch', vi.fn());
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(strict = false) {
  await act(async () =>
    root.render(
      strict
        ? createElement(StrictMode, null, createElement(LocalMonitoring))
        : createElement(LocalMonitoring),
    ),
  );
}
function button(text: string) {
  const b = [...host.querySelectorAll('button')].find((b) => b.textContent === text);
  if (!b) throw new Error(text);
  return b;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function change(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
describe('desktop local monitoring controls', () => {
  it('shows browser unavailable without private fetch, default preferences or save controls', async () => {
    vi.stubGlobal('agentPlatformDesktop', undefined);
    await render();
    expect(host.textContent).toContain('browser does not have access');
    expect(host.querySelector('input')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(api.getMonitoringStatus).not.toHaveBeenCalled();
  });
  it('loads authoritative off state and labels fields without recording automatically', async () => {
    await render();
    expect(host.textContent).toContain('Resource recording: Off');
    expect(host.textContent).toContain('8.68 days');
    expect(host.querySelector('input[type=number]')?.getAttribute('id')).toBeTruthy();
    expect(api.setMonitoringPreference).not.toHaveBeenCalled();
    expect(api.saveMonitoringReport).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not invent preferences for failed or unready status', async () => {
    api.getMonitoringStatus.mockResolvedValue({
      monitoring: { ...health, state: 'starting', preference: null },
      diagnostics: health,
    });
    await render();
    expect(host.textContent).toContain('Resource recording: Unknown');
    expect(button('Save monitoring preference').closest('fieldset')?.disabled).toBe(true);
    api.getMonitoringStatus.mockRejectedValue(new Error('PRIVATE_CANARY'));
    await click('Refresh monitoring status');
    expect(host.textContent).toContain('Recording state is unknown');
    expect(host.textContent).not.toContain('PRIVATE_CANARY');
  });
  it('saves only after explicit action and durable matching acknowledgement', async () => {
    await render();
    await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
    const saved = { ...preference, samplingEnabled: true, version: 2 };
    api.setMonitoringPreference.mockResolvedValue({
      preference: saved,
      health: { ...health, preference: saved },
    });
    await click('Save monitoring preference');
    expect(api.setMonitoringPreference).toHaveBeenCalledWith({
      samplingEnabled: true,
      retentionDays: 7,
    });
    expect(host.textContent).toContain('Resource recording: Enabled');
    expect(host.textContent).toContain('preference saved locally');
  });
  it('does not claim a mismatched or rejected preference is saved', async () => {
    await render();
    await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
    api.setMonitoringPreference.mockResolvedValue({
      preference,
      health: { ...health, preference },
    });
    await click('Save monitoring preference');
    expect(host.textContent).toContain('preference was not confirmed');
    expect(host.textContent).toContain('Resource recording: Unknown');
    expect(host.textContent).not.toContain('preference saved locally');
  });
  it('serializes same-frame actions and does not autosave or poll', async () => {
    await render();
    const pending = deferred<unknown>();
    api.setMonitoringPreference.mockReturnValue(pending.promise);
    await act(async () => {
      button('Save monitoring preference').click();
      button('Save monitoring preference').click();
    });
    expect(api.setMonitoringPreference).toHaveBeenCalledTimes(1);
    expect(api.getMonitoringStatus).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ preference, health: { ...health, preference } }));
  });
  it('advances only explicit saved pages, preserves cursor on cancel, resets after range edit', async () => {
    await render();
    api.saveMonitoringReport.mockImplementation(async (request) => ({
      ok: true,
      status: 'saved',
      summary: 'Safe page with gaps.',
      incomplete: true,
      continuation: {
        ...request,
        monitoringCursor: 'signed-next',
        diagnosticCursor: 'signed-completed',
      },
    }));
    await click('Save monitoring history');
    expect(api.saveMonitoringReport).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('More recorded data remains');
    api.saveMonitoringReport.mockResolvedValue({ ok: true, status: 'cancelled' });
    await click('Save next history page');
    expect(api.saveMonitoringReport.mock.calls[1]?.[0]).toMatchObject({
      monitoringCursor: 'signed-next',
      diagnosticCursor: 'signed-completed',
    });
    expect(host.textContent).toContain('Export cancelled');
    expect(button('Save next history page')).toBeTruthy();
    const from = host.querySelector<HTMLInputElement>('input[type=text]')!;
    await change(from, '2026-10-16T12:00:00Z');
    expect(host.textContent).not.toContain('Save next history page');
    expect(api.saveMonitoringReport).toHaveBeenCalledTimes(2);
  });
  it('rejects an invalid UTC range before calling main and masks errors', async () => {
    await render();
    await change(host.querySelector<HTMLInputElement>('input[type=text]')!, 'local yesterday');
    await click('Save monitoring history');
    expect(api.saveMonitoringReport).not.toHaveBeenCalled();
    expect(host.textContent).toContain('valid UTC range');
  });
  it.each([
    ['2026-02-30T00:00:00Z', '2026-03-03T00:00:00Z'],
    ['2025-02-29T00:00:00.000Z', '2025-03-03T00:00:00Z'],
  ])('rejects impossible calendar date %s without invoking main', async (from, to) => {
    await render();
    const fields = host.querySelectorAll<HTMLInputElement>('input[type=text]');
    await change(fields[0]!, from);
    await change(fields[1]!, to);
    await click('Save monitoring history');
    expect(api.saveMonitoringReport).not.toHaveBeenCalled();
    expect(host.textContent).toContain('valid UTC range');
  });
  it.each(['2024-02-29T00:00:00Z', '2024-02-29T00:00:00.000Z'])(
    'preserves valid leap-day timestamp %s',
    async (from) => {
      await render();
      api.saveMonitoringReport.mockResolvedValue({ ok: true, status: 'cancelled' });
      const fields = host.querySelectorAll<HTMLInputElement>('input[type=text]');
      await change(fields[0]!, from);
      await change(fields[1]!, '2024-03-01T00:00:00Z');
      await click('Save monitoring history');
      expect(api.saveMonitoringReport).toHaveBeenCalledTimes(1);
      expect(api.saveMonitoringReport).toHaveBeenCalledWith({
        window: { fromMs: Date.parse(from), toMs: Date.parse('2024-03-01T00:00:00Z') },
        limit: 1000,
      });
    },
  );
  it('rejects foreign continuation and never automatically requests another page', async () => {
    await render();
    api.saveMonitoringReport.mockResolvedValue({
      ok: true,
      status: 'saved',
      summary: 'saved',
      incomplete: true,
      continuation: { window: { fromMs: 1, toMs: 1000 } },
    });
    await click('Save monitoring history');
    expect(host.textContent).toContain('History could not be saved');
    expect(host.textContent).not.toContain('Save next history page');
    expect(api.saveMonitoringReport).toHaveBeenCalledTimes(1);
  });
  it('ignores late unmounted status and survives StrictMode setup/cleanup', async () => {
    const pending = deferred<unknown>();
    api.getMonitoringStatus.mockReturnValueOnce(pending.promise).mockResolvedValue(status);
    await render(true);
    expect(host.textContent).toContain('Resource recording: Off');
    await act(async () =>
      pending.resolve({
        monitoring: { ...health, preference: { ...preference, samplingEnabled: true } },
        diagnostics: health,
      }),
    );
    expect(host.textContent).toContain('Resource recording: Off');
    expect(api.setMonitoringPreference).not.toHaveBeenCalled();
  });
});
