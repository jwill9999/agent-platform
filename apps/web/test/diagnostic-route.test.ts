import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildPartialDiagnosticReport } from '@agent-platform/contracts';
import { POST } from '../app/api/diagnostics/report/route';
const id = randomUUID();
const capability = 'a'.repeat(64);
function request(
  body = JSON.stringify({ scope: { requestId: id } }),
  extra: Record<string, string> = {},
) {
  return new Request('http://127.0.0.1:4301/api/diagnostics/report', {
    method: 'POST',
    body,
    headers: {
      host: '127.0.0.1:4301',
      origin: 'http://127.0.0.1:4301',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...extra,
    },
  });
}
function configure() {
  vi.stubEnv('DIAGNOSTICS_LOCAL_CAPABILITY', capability);
  vi.stubEnv('DIAGNOSTICS_WEB_HOST', '127.0.0.1:4301');
  vi.stubEnv('DIAGNOSTICS_LOCAL_TOPOLOGY', 'loopback');
  vi.stubEnv('API_PROXY_URL', 'http://127.0.0.1:4310');
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('local diagnostic BFF', () => {
  it('fails closed without an explicit local launcher and never fetches', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await POST(request())).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    { origin: 'null' },
    { origin: 'https://evil.test' },
    { host: 'evil.test' },
    { 'sec-fetch-site': 'cross-site' },
  ])('denies foreign/missing browser identity %j', async (headers) => {
    configure();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await POST(request(undefined, headers))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects renderer destinations/oversized payloads and refuses remote upstreams', async () => {
    configure();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await POST(request(JSON.stringify({ scope: { requestId: id }, url: '/secrets' })))).status,
    ).toBe(400);
    expect((await POST(request(' '.repeat(1025)))).status).toBe(400);
    vi.stubEnv('API_PROXY_URL', 'http://api:3000');
    expect((await POST(request())).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards only scoped data with a server-held capability, reprojects prose and prevents caching', async () => {
    configure();
    const report = buildPartialDiagnosticReport({
      requestId: id,
      observedAtMs: 1,
      phase: 'connection',
      errorCode: 'backend_unavailable',
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ...report, summary: 'SECRET_CANARY' }));
    vi.stubGlobal('fetch', fetcher);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toMatch(/SECRET_CANARY|aaaaaaaa/);
    expect(fetcher.mock.calls[0]?.[1].headers['x-diagnostics-capability']).toBe(capability);
  });
  it('rejects response scope substitution and masks backend failures', async () => {
    configure();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          buildPartialDiagnosticReport({
            requestId: randomUUID(),
            observedAtMs: 1,
            phase: 'connection',
            errorCode: 'backend_unavailable',
          }),
        ),
      ),
    );
    expect((await POST(request())).status).toBe(503);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('SECRET_CANARY')));
    expect(await (await POST(request())).text()).not.toContain('SECRET_CANARY');
  });
});
