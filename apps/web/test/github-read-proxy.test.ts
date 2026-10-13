import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/v1/[...path]/route';

afterEach(() => vi.unstubAllGlobals());

describe('GitHub read proxy cancellation', () => {
  it.each([
    ['projects', 'project-1', 'git', 'checks'],
    ['projects', 'project-1', 'github', 'pull-requests'],
  ])('propagates actual abort for read %j', async (...path) => {
    const controller = new AbortController();
    const req = new NextRequest(`http://localhost/api/v1/${path.join('/')}?page=1`, {
      signal: controller.signal,
      headers: { host: 'localhost', 'x-request-id': 'synthetic-request' },
    });
    let forwarded: AbortSignal | null | undefined;
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      forwarded = init.signal;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const pending = GET(req, { params: Promise.resolve({ path }) });
    const settled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(forwarded).toBe(req.signal);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toContain(`/v1/${path.join('/')}?page=1`);
    expect((init.headers as Headers).get('host')).toBeNull();
    expect((init.headers as Headers).get('x-request-id')).toBe('synthetic-request');
    controller.abort();
    await settled;
    expect(forwarded?.aborted).toBe(true);
  });

  it.each([
    { method: 'GET', path: ['projects', 'p', 'git', 'changes'] },
    { method: 'GET', path: ['projects', 'p', 'git', 'checks', 'extra'] },
    { method: 'POST', path: ['projects', 'p', 'github', 'pull-requests'] },
  ])('retains existing unrelated proxy behavior: $method $path', async ({ method, path }) => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({ data: { available: true } }, { headers: { 'x-test': 'preserved' } }),
    );
    vi.stubGlobal('fetch', fetcher);
    const req = new NextRequest(`http://localhost/api/v1/${path.join('/')}`, {
      method,
      ...(method === 'POST' ? { body: '{"title":"synthetic"}' } : {}),
    });
    const response = await (method === 'POST' ? POST : GET)(req, {
      params: Promise.resolve({ path }),
    });
    const init = fetcher.mock.calls[0]![1];
    expect(init.signal).toBeUndefined();
    expect(init.method).toBe(method);
    if (method === 'POST') {
      expect(Buffer.from(init.body as ArrayBuffer).toString()).toBe('{"title":"synthetic"}');
    }
    expect(response.headers.get('x-test')).toBe('preserved');
    expect(await response.json()).toEqual({ data: { available: true } });
  });
});
