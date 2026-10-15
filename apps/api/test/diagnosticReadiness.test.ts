import { afterEach, expect, it, vi } from 'vitest';
import { waitForDiagnosticReadiness } from './support/diagnosticReadiness.js';

const origin = 'http://127.0.0.1:12345';
const capability = 'fixture-capability';
const health = {
  state: 'ready',
  reason: 'none',
  pending: 0,
  dropped: 0,
  conflicts: 0,
  pruned: 0,
  acknowledgedSequence: 0,
  lastAcknowledgedAtMs: null,
  processInstanceId: '11111111-1111-4111-8111-111111111111',
  previousShutdownUnclean: false,
};
const unavailable = () =>
  Response.json({ error: { code: 'DIAGNOSTICS_UNAVAILABLE' } }, { status: 503 });
afterEach(() => vi.unstubAllGlobals());

it('waits for storage after connection refusal and delayed readiness, never polling report', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }))
    .mockResolvedValueOnce(unavailable())
    .mockResolvedValueOnce(Response.json({ health: { ...health, state: 'starting' } }))
    .mockResolvedValueOnce(Response.json({ health: { ...health, pending: 1 } }))
    .mockResolvedValueOnce(Response.json({ health }));
  vi.stubGlobal('fetch', fetchMock);
  await waitForDiagnosticReadiness(origin, capability, () => false);
  expect(fetchMock).toHaveBeenCalledTimes(5);
  for (const [url, options] of fetchMock.mock.calls) {
    expect(url).toBe(`${origin}/v1/diagnostics/list`);
    expect(options.headers['x-diagnostics-capability']).toBe(capability);
    expect(JSON.parse(options.body)).toEqual({ limit: 1 });
  }
});

it('fails within the startup deadline when storage remains unavailable', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => unavailable()),
  );
  await expect(waitForDiagnosticReadiness(origin, capability, () => false, 30)).rejects.toThrow(
    'did not become ready within deadline',
  );
});

it('aborts a stalled request at the same overall deadline', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, { signal }: RequestInit) =>
        new Promise((_resolve, reject) => {
          signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
        }),
    ),
  );
  await expect(waitForDiagnosticReadiness(origin, capability, () => false, 30)).rejects.toThrow(
    'did not become ready within deadline',
  );
});

it.each([403, 404, 500, 503])('does not hide unexpected HTTP %s failures', async (status) => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(Response.json({ error: { code: 'OTHER' } }, { status }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(waitForDiagnosticReadiness(origin, capability, () => false)).rejects.toThrow(
    `HTTP ${status}`,
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('fails immediately if the child exits', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await expect(waitForDiagnosticReadiness(origin, capability, () => true)).rejects.toThrow(
    'exited before diagnostics readiness',
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not hide degraded storage or malformed readiness data', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ health: { ...health, state: 'degraded' } })),
  );
  await expect(waitForDiagnosticReadiness(origin, capability, () => false)).rejects.toThrow(
    'Unexpected diagnostic fixture state',
  );
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ health: { state: 'ready' } })));
  await expect(waitForDiagnosticReadiness(origin, capability, () => false)).rejects.toThrow();
});
