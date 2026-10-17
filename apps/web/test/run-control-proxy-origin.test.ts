import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/v1/[...path]/route';

const id = '81ce397c-a87d-4f20-9e21-9e6edfa92322';
const path = ['sessions', 'session-1', 'runs', id, 'stop'];
const target = (origin: string, headers: Record<string, string>) =>
  new NextRequest(`${origin}/api/v1/${path.join('/')}`, {
    method: 'POST',
    headers,
    body: '{}',
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Stop BFF browser admission', () => {
  it.each([
    { origin: 'https://hostile.example', site: 'cross-site', type: 'text/plain' },
    { origin: 'null', site: 'same-origin', type: 'application/json' },
    { origin: '', site: 'cross-site', type: 'application/json' },
    { origin: 'http://127.0.0.1:4301', site: 'cross-site', type: 'application/json' },
    { origin: 'http://127.0.0.1:4301', site: 'same-site', type: 'application/json' },
    { origin: 'http://127.0.0.1:4301', site: 'same-origin', type: 'text/plain' },
    { origin: 'http://127.0.0.1:4302', site: 'same-origin', type: 'application/json' },
  ])(
    'does not forward hostile or ambiguous browser metadata: $origin $site $type',
    async ({ origin, site, type }) => {
      const upstream = vi.fn();
      vi.stubGlobal('fetch', upstream);
      const response = await POST(
        target('http://127.0.0.1:4301', {
          ...(origin ? { origin } : {}),
          'sec-fetch-site': site,
          'content-type': type,
          'x-forwarded-host': 'hostile.example',
        }),
        { params: Promise.resolve({ path }) },
      );
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe('STOP_ORIGIN_DENIED');
      expect(upstream).not.toHaveBeenCalled();
    },
  );

  it.each(['http://localhost:3001', 'http://127.0.0.1:43197'])(
    'admits exact local renderer %s and removes browser metadata only after validation',
    async (origin) => {
      vi.stubEnv('DIAGNOSTICS_WEB_HOST', new URL(origin).host);
      const upstream = vi.fn(async () => Response.json({ data: { id } }));
      vi.stubGlobal('fetch', upstream);
      const result = await POST(
        target(origin, {
          origin,
          host: new URL(origin).host,
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
          'content-type': 'application/json',
        }),
        { params: Promise.resolve({ path }) },
      );
      expect(result.status).toBe(200);
      expect(upstream).toHaveBeenCalledTimes(1);
      const headers = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1]
        .headers as Headers;
      expect(headers.has('origin')).toBe(false);
      expect(headers.has('sec-fetch-site')).toBe(false);
      expect(headers.has('sec-fetch-mode')).toBe(false);
      expect(headers.has('x-stop-trusted')).toBe(false);
    },
  );

  it('rejects an exact same-origin request on an unconfigured rebinding hostname', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const response = await POST(
      target('http://hostile.example', {
        origin: 'http://hostile.example',
        host: 'hostile.example',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      }),
      { params: Promise.resolve({ path }) },
    );
    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('keeps browser metadata intact for unrelated proxy operations', async () => {
    const upstream = vi.fn(async () => Response.json({ data: {} }));
    vi.stubGlobal('fetch', upstream);
    const other = ['sessions', 'session-1', 'resume'];
    await POST(
      new NextRequest('http://localhost/api/v1/sessions/session-1/resume', {
        method: 'POST',
        headers: {
          origin: 'https://unrelated.example',
          'sec-fetch-site': 'cross-site',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
      { params: Promise.resolve({ path: other }) },
    );
    const headers = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Headers;
    expect(headers.get('origin')).toBe('https://unrelated.example');
    expect(headers.get('sec-fetch-site')).toBe('cross-site');
  });
});
