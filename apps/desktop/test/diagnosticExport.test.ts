import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPartialDiagnosticReport } from '@agent-platform/contracts';
import {
  saveDiagnosticReport,
  savePartialDiagnosticReport,
  validateDiagnosticScope,
  validateDiagnosticPartial,
} from '../src/main/diagnosticExport.js';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
const failure = {
  requestId: randomUUID(),
  observedAtMs: 1,
  durationMs: 15,
  phase: 'connection',
  errorCode: 'backend_unavailable',
} as const;
const capability = 'b'.repeat(64);
function deps() {
  const root = mkdtempSync(join(tmpdir(), 'diagnostic-export-'));
  roots.push(root);
  const file = join(root, 'report.json');
  return {
    apiBaseUrl: 'http://127.0.0.1:4310',
    capability,
    file,
    env: {},
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: file }),
    fetchImpl: vi.fn<typeof fetch>(),
  };
}
describe('diagnostic native export boundary', () => {
  it('rejects renderer paths, URLs, arbitrary prose and nonfinite partial timing', () => {
    expect(
      validateDiagnosticScope({ requestId: failure.requestId, destination: '/tmp/private' }).ok,
    ).toBe(false);
    expect(validateDiagnosticPartial({ ...failure, sessionId: randomUUID() }).ok).toBe(false);
    expect(validateDiagnosticPartial({ ...failure, summary: 'secret' }).ok).toBe(false);
    expect(validateDiagnosticPartial({ ...failure, durationMs: Infinity }).ok).toBe(false);
    expect(validateDiagnosticPartial(failure).ok).toBe(true);
  });
  it('cancels before any fetch or file write', async () => {
    const d = deps();
    d.showSaveDialog.mockResolvedValue({ canceled: true });
    const writeFileImpl = vi.fn();
    expect(
      await saveDiagnosticReport({ requestId: failure.requestId }, { ...d, writeFileImpl }),
    ).toEqual({ ok: true, status: 'cancelled' });
    expect(d.fetchImpl).not.toHaveBeenCalled();
    expect(writeFileImpl).not.toHaveBeenCalled();
  });
  it('saves partial evidence without backend access or renderer supplied contents', async () => {
    const d = deps();
    expect(await savePartialDiagnosticReport(failure, d)).toEqual({
      ok: true,
      status: 'saved',
      filename: 'report.json',
    });
    const actual = JSON.parse(readFileSync(d.file, 'utf8'));
    expect(actual.coverage).toMatchObject({ verified: false, durable: false });
    expect(actual.summary).toContain('unverified, non-durable');
    expect(d.fetchImpl).not.toHaveBeenCalled();
    expect(readFileSync(d.file, 'utf8')).not.toContain(capability);
  });
  it('reprojects backend prose and only uses the configured local destination', async () => {
    const d = deps();
    d.fetchImpl.mockResolvedValue(
      Response.json({
        ...buildPartialDiagnosticReport(failure),
        summary: 'sk-canary-do-not-export',
      }),
    );
    await saveDiagnosticReport({ requestId: failure.requestId }, d);
    expect(readFileSync(d.file, 'utf8')).not.toContain('sk-canary');
    const [url, init] = d.fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('http://127.0.0.1:4310/v1/diagnostics/report');
    expect(init?.headers).toMatchObject({ 'x-diagnostics-capability': capability });
  });
  it('rejects remote backends before dialog and rejects mismatched scope before writing', async () => {
    const d = deps();
    await expect(
      saveDiagnosticReport(
        { requestId: failure.requestId },
        { ...d, apiBaseUrl: 'https://example.com' },
      ),
    ).rejects.toThrow('unavailable');
    expect(d.showSaveDialog).not.toHaveBeenCalled();
    d.fetchImpl.mockResolvedValue(
      Response.json(buildPartialDiagnosticReport({ ...failure, requestId: randomUUID() })),
    );
    const writeFileImpl = vi.fn();
    await expect(
      saveDiagnosticReport({ requestId: failure.requestId }, { ...d, writeFileImpl }),
    ).rejects.toThrow('could not be prepared');
    expect(writeFileImpl).not.toHaveBeenCalled();
  });
  it.each(['PRIVATE_PARSE_CANARY', JSON.stringify({ PRIVATE_SCHEMA_CANARY: 'credential' })])(
    'masks malformed upstream payloads at the IPC boundary',
    async (payload) => {
      const d = deps();
      d.fetchImpl.mockResolvedValue(new Response(payload));
      const writeFileImpl = vi.fn();
      const result = await saveDiagnosticReport(
        { requestId: failure.requestId },
        { ...d, writeFileImpl },
      ).catch((error) => error);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Diagnostic report could not be prepared.');
      expect(String(result)).not.toMatch(/PRIVATE_|credential/);
      expect(writeFileImpl).not.toHaveBeenCalled();
    },
  );
  it('reports denied fetching and write failure without leaking backend errors or paths', async () => {
    const d = deps();
    d.fetchImpl.mockResolvedValue(new Response('secret canary', { status: 403 }));
    await expect(saveDiagnosticReport({ requestId: failure.requestId }, d)).rejects.toThrow(
      'could not be prepared',
    );
    await expect(
      savePartialDiagnosticReport(failure, {
        ...d,
        writeFileImpl: vi.fn().mockRejectedValue(new Error('/private/canary')),
      }),
    ).rejects.toThrow('could not be written');
  });
});
