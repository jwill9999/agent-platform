import { request as httpsRequest } from 'node:https';
import { get, type IncomingMessage, type ClientRequest } from 'node:http';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { expect, it, vi } from 'vitest';
import { createReviewProxy } from '../src/reviewProxy.js';
vi.mock('node:https', () => ({ request: vi.fn() }));
it('contains an upstream response reset and keeps serving rejected routes', async () => {
  const incoming = new PassThrough() as unknown as IncomingMessage;
  incoming.statusCode = 200;
  incoming.headers = { 'content-type': 'text/event-stream' };
  const outgoing = new PassThrough() as unknown as ClientRequest;
  vi.mocked(httpsRequest).mockImplementation(((
    _options: unknown,
    callback: (response: IncomingMessage) => void,
  ) => {
    queueMicrotask(() => {
      callback(incoming);
      incoming.write('data: partial\n\n');
      incoming.destroy(new Error('fixture upstream reset'));
    });
    return outgoing;
  }) as typeof httpsRequest);
  const server = createReviewProxy();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing port');
  try {
    await new Promise<void>((resolve, reject) => {
      const request = get(`http://127.0.0.1:${address.port}/models`, (res) => {
        res.resume();
        res.on('aborted', resolve);
        res.on('error', resolve);
        res.on('end', () => reject(new Error('truncated stream reported success')));
      });
      request.on('error', () => resolve());
      request.setTimeout(1000, () => {
        request.destroy();
        reject(new Error('fixture timeout'));
      });
    });
    expect(server.listening).toBe(true);
    const denied = await fetch(`http://127.0.0.1:${address.port}/unapproved`);
    expect(denied.status).toBe(403);
    expect(vi.mocked(httpsRequest).mock.calls[0]?.[0]).toMatchObject({
      hostname: 'chatgpt.com',
      servername: 'chatgpt.com',
      rejectUnauthorized: true,
      path: '/backend-api/codex/models',
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.resetAllMocks();
  }
});
