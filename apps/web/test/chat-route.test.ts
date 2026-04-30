import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
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
