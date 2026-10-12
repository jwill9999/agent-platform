import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete process.env.AGENT_OPENAI_API_KEY;
  delete process.env.NEXT_OPENAI_API_KEY;
});

describe('POST /api/chat proxy', () => {
  it('does not forward Next.js env keys as an explicit API override', async () => {
    process.env.AGENT_OPENAI_API_KEY = 'sk-next-process-key';
    process.env.NEXT_OPENAI_API_KEY = 'sk-next-fallback-key';
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const { POST } = await import('../app/api/chat/route');
    await POST(
      new Request('http://test.local/api/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'session-1', message: 'hello' }),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-openai-key']).toBeUndefined();
  });

  it('forwards an explicit caller-provided key header', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const { POST } = await import('../app/api/chat/route');
    await POST(
      new Request('http://test.local/api/chat', {
        method: 'POST',
        headers: { 'x-openai-key': 'sk-explicit-key' },
        body: JSON.stringify({ sessionId: 'session-1', message: 'hello' }),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-openai-key']).toBe('sk-explicit-key');
  });
});

describe('chat diagnostic identities', () => {
  it('assigns unique server IDs before JSON validation despite equal caller headers', async () => {
    const { POST } = await import('../app/api/chat/route');
    const send = () =>
      POST(
        new Request('http://test.local/api/chat', {
          method: 'POST',
          body: '{',
          headers: { 'x-request-id': 'same', 'x-bff-request-id': 'same' },
        }),
      );
    const [first, second] = await Promise.all([send(), send()]);
    expect(first.headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/);
    expect(first.headers.get('x-request-id')).not.toBe(second.headers.get('x-request-id'));
  });
  it('retains the BFF link but echoes only a valid authoritative API request ID', async () => {
    const id = 'bbd3ccf9-365b-4638-85bc-ea9a579710bb';
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('', { headers: { 'x-request-id': id } }));
    globalThis.fetch = fetcher;
    const { POST } = await import('../app/api/chat/route');
    const res = await POST(
      new Request('http://test.local/api/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'session-1', message: 'hello' }),
      }),
    );
    expect(res.headers.get('x-request-id')).toBe(id);
    expect(res.headers.get('x-bff-request-id')).toBe(
      fetcher.mock.calls[0]?.[1].headers['x-bff-request-id'],
    );
    expect(res.headers.get('x-diagnostics-api-observed')).toBe('1');
  });
});

it('authenticates BFF linkage only for a verified same-origin local deployment', async () => {
  const secret = 'c'.repeat(64);
  vi.stubEnv('DIAGNOSTICS_LOCAL_CAPABILITY', secret);
  vi.stubEnv('DIAGNOSTICS_WEB_HOST', '127.0.0.1:4301');
  vi.stubEnv('DIAGNOSTICS_LOCAL_TOPOLOGY', 'loopback');
  vi.stubEnv('API_PROXY_URL', 'http://127.0.0.1:4310');
  const fetcher = vi.fn().mockImplementation(async () => new Response(''));
  globalThis.fetch = fetcher;
  const { POST } = await import('../app/api/chat/route');
  const headers = {
    host: '127.0.0.1:4301',
    origin: 'http://127.0.0.1:4301',
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json',
    'x-diagnostics-capability': 'forged',
  };
  const body = JSON.stringify({ sessionId: 'session-1', message: 'hello' });
  const result = await POST(
    new Request('http://127.0.0.1:4301/api/chat', { method: 'POST', headers, body }),
  );
  expect(fetcher.mock.calls[0]?.[1].headers['x-diagnostics-capability']).toBe(secret);
  expect(await result.text()).not.toContain(secret);
  await POST(
    new Request('http://127.0.0.1:4301/api/chat', {
      method: 'POST',
      headers: { ...headers, origin: 'https://foreign.test' },
      body,
    }),
  );
  expect(fetcher.mock.calls[1]?.[1].headers['x-diagnostics-capability']).toBeUndefined();
});
