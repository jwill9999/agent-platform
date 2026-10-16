import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readMonitoringStatus,
  updateMonitoringPreference,
  saveMonitoringReport,
} from '../src/main/monitoringExport.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
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
} as const;
const preference = { samplingEnabled: false, retentionDays: 7, version: 1 };
const monitoring = { ...health, preference };
const request = { window: { fromMs: 1, toMs: 1000 }, limit: 1000 };
function report() {
  const page = {
    window: request.window,
    snapshotSequence: 0,
    earliestSequence: 0,
    completedCursor: 'signed-completed',
    truncated: false,
    coverage: {
      oldestObservedAtMs: null,
      newestObservedAtMs: null,
      historyMayBeMissing: false,
      gaps: 0,
    },
  };
  return {
    schemaVersion: 1,
    generatedAtMs: 1000,
    monitoring: { ...page, samples: [], health: monitoring },
    diagnostics: { ...page, events: [], health },
    coverage: { separateSnapshots: true, incomplete: false },
    summary: 'PRIVATE_SERVER_SUMMARY_CANARY',
  };
}
function deps() {
  const root = mkdtempSync(join(tmpdir(), 'monitoring-export-'));
  roots.push(root);
  const file = join(root, 'history.json');
  return {
    apiBaseUrl: 'http://127.0.0.1:4310',
    capability: 'b'.repeat(64),
    file,
    env: {},
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: file }),
    fetchImpl: vi.fn<typeof fetch>(),
  };
}
describe('native monitoring preference and historical export', () => {
  it('reads authoritative status without granting access to unknown fields', async () => {
    const d = deps();
    d.fetchImpl.mockResolvedValue(Response.json({ monitoring, diagnostics: health }));
    expect(await readMonitoringStatus(d)).toEqual({ monitoring, diagnostics: health });
    d.fetchImpl.mockResolvedValue(
      Response.json({ monitoring, diagnostics: health, capability: 'PRIVATE_CANARY' }),
    );
    await expect(readMonitoringStatus(d)).rejects.toThrow('could not be read');
  });
  it('requires matching durable preference and health acknowledgements', async () => {
    const d = deps();
    const input = { samplingEnabled: true, retentionDays: 12 };
    const saved = { ...input, version: 2 };
    d.fetchImpl.mockResolvedValue(
      Response.json({ preference: saved, health: { ...monitoring, preference: saved } }),
    );
    expect((await updateMonitoringPreference(input, d)).preference).toEqual(saved);
    d.fetchImpl.mockResolvedValue(Response.json({ preference: saved, health: monitoring }));
    await expect(updateMonitoringPreference(input, d)).rejects.toThrow('not confirmed');
    d.fetchImpl.mockResolvedValue(Response.json({ preference, health: monitoring }));
    await expect(updateMonitoringPreference(input, d)).rejects.toThrow('not confirmed');
  });
  it.each([
    { samplingEnabled: true, retentionDays: 0 },
    { samplingEnabled: true, retentionDays: 91 },
    { samplingEnabled: true, retentionDays: 1.5 },
    { samplingEnabled: true, retentionDays: 7, path: '/private' },
  ])('rejects invalid preference without effect', async (input) => {
    const d = deps();
    await expect(updateMonitoringPreference(input, d)).rejects.toThrow('input is invalid');
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });
  it('masks dialog failures without fetching or writing history', async () => {
    const d = deps();
    d.showSaveDialog.mockRejectedValue(new Error('/private/PRIVATE_DIALOG_CANARY'));
    const writeFileImpl = vi.fn();
    await expect(saveMonitoringReport(request, { ...d, writeFileImpl })).rejects.toThrow(
      'The monitoring history destination could not be selected.',
    );
    expect(d.fetchImpl).not.toHaveBeenCalled();
    expect(writeFileImpl).not.toHaveBeenCalled();
  });
  it('cancel happens before any read/write and does not consume cursor state', async () => {
    const d = deps();
    d.showSaveDialog.mockResolvedValue({ canceled: true });
    const writeFileImpl = vi.fn();
    expect(
      await saveMonitoringReport(
        { ...request, monitoringCursor: 'signed-next', diagnosticCursor: 'signed-done' },
        { ...d, writeFileImpl },
      ),
    ).toEqual({ ok: true, status: 'cancelled' });
    expect(d.fetchImpl).not.toHaveBeenCalled();
    expect(writeFileImpl).not.toHaveBeenCalled();
  });
  it('writes projected JSON and readable summary only; no raw report crosses IPC', async () => {
    const d = deps();
    d.fetchImpl.mockResolvedValue(Response.json(report()));
    const result = await saveMonitoringReport(request, d);
    expect(result).toMatchObject({
      ok: true,
      status: 'saved',
      filename: 'history.json',
      incomplete: false,
    });
    expect(result).not.toHaveProperty('monitoring');
    expect(result).not.toHaveProperty('diagnostics');
    expect(result).not.toHaveProperty('continuation');
    const text = readFileSync(d.file, 'utf8');
    expect(text).not.toContain('PRIVATE_SERVER_SUMMARY_CANARY');
    expect(text).not.toContain(d.capability);
    expect(text).not.toContain(d.file);
    expect(JSON.parse(text).summary).toContain('Independent snapshots');
  });
  it('returns separate completed/next cursors only after the page is saved', async () => {
    const d = deps();
    const value = {
      ...report(),
      diagnostics: {
        ...report().diagnostics,
        nextCursor: 'signed-next',
        completedCursor: undefined,
        truncated: true,
      },
    };
    d.fetchImpl.mockResolvedValue(Response.json(value));
    const result = await saveMonitoringReport(request, d);
    expect(result).toMatchObject({
      status: 'saved',
      incomplete: true,
      continuation: {
        ...request,
        monitoringCursor: 'signed-completed',
        diagnosticCursor: 'signed-next',
      },
    });
  });
  it.each([
    { window: { fromMs: 1, toMs: 1 } },
    { ...request, destination: '/private' },
    { ...request, limit: 1001 },
  ])('rejects invalid window before dialog/read', async (input) => {
    const d = deps();
    await expect(saveMonitoringReport(input, d)).rejects.toThrow('input is invalid');
    expect(d.showSaveDialog).not.toHaveBeenCalled();
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });
  it('denies a foreign backend before dialog', async () => {
    const d = deps();
    await expect(
      saveMonitoringReport(request, { ...d, apiBaseUrl: 'https://example.com' }),
    ).rejects.toThrow('unavailable');
    expect(d.showSaveDialog).not.toHaveBeenCalled();
  });
  it('rejects wrong time/session or unsafe field without writing', async () => {
    const d = deps();
    const writeFileImpl = vi.fn();
    for (const value of [
      { ...report(), monitoring: { ...report().monitoring, window: { fromMs: 2, toMs: 999 } } },
      {
        ...report(),
        diagnostics: {
          ...report().diagnostics,
          window: { ...request.window, sessionId: 'a05c3073-5151-4659-8578-1cbe3973b17d' },
        },
      },
      { ...report(), private: 'PRIVATE_CANARY' },
    ]) {
      d.fetchImpl.mockResolvedValue(Response.json(value));
      await expect(saveMonitoringReport(request, { ...d, writeFileImpl })).rejects.toThrow(
        'could not be read',
      );
    }
    expect(writeFileImpl).not.toHaveBeenCalled();
  });
  it('preserves disk failure as failure without returning a continuation', async () => {
    const d = deps();
    d.fetchImpl.mockResolvedValue(Response.json(report()));
    const writeFileImpl = vi.fn().mockRejectedValue(new Error('PRIVATE_PATH_CANARY'));
    await expect(saveMonitoringReport(request, { ...d, writeFileImpl })).rejects.toThrow(
      'file could not be written',
    );
    expect(writeFileImpl).toHaveBeenCalledWith(d.file, expect.any(String), {
      flag: 'w',
      mode: 0o600,
    });
  });
});
