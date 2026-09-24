import { connect } from 'node:net';
import { once } from 'node:events';
import { afterEach, expect, it } from 'vitest';
import { createReviewProxy, modelEndpoint } from '../src/reviewProxy.js';

const servers: ReturnType<typeof createReviewProxy>[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});
async function request(payload: string) {
  const server = createReviewProxy();
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test port');
  return new Promise<string>((resolve, reject) => {
    const socket = connect(address.port, '127.0.0.1', () => socket.write(payload));
    socket.once('error', reject);
    socket.once('data', (data) => {
      socket.destroy();
      resolve(data.toString().split('\r\n')[0]!);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error('proxy timeout'));
    });
  });
}
it.each([
  'chatgpt.com:443',
  'github.com:443',
  'chatgpt.com.evil.test:443',
  'chatgpt.com:80',
  '127.0.0.1:443',
  'user@chatgpt.com:443',
])('denies every CONNECT tunnel including allowed-host authorities: %s', async (target) => {
  expect(await request(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`)).toBe(
    'HTTP/1.1 403 Forbidden',
  );
});
it('denies ordinary proxy requests', async () => {
  expect(await request('GET http://chatgpt.com/ HTTP/1.1\r\nHost: chatgpt.com\r\n\r\n')).toBe(
    'HTTP/1.1 403 Forbidden',
  );
});

it.each([
  '/responses/../other',
  '/responses%2fother',
  '//evil.test/responses',
  '/backend-api/accounts',
  '/models#fragment',
])('denies unapproved application route %s', async (path) => {
  expect(await request(`GET ${path} HTTP/1.1\r\nHost: model-proxy\r\n\r\n`)).toBe(
    'HTTP/1.1 403 Forbidden',
  );
});
it('denies protocol upgrades', async () => {
  expect(
    await request(
      'GET /responses HTTP/1.1\r\nHost: model-proxy\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
    ),
  ).toBe('HTTP/1.1 403 Forbidden');
});

it.each([
  '/models?client_version=1/../../accounts',
  '/models?other=1',
  '/models?client_version=1&other=2',
  '/models?client_version=%2e%2e',
  '/responses?path=/accounts',
])('rejects unsupported or traversal-like query input %s', async (target) => {
  expect(await request(`GET ${target} HTTP/1.1\r\nHost: gateway\r\n\r\n`)).toBe(
    'HTTP/1.1 403 Forbidden',
  );
});

it('maps supported model discovery and response routes to fixed upstream paths', () => {
  expect(modelEndpoint('POST', '/responses')).toBe('/backend-api/codex/responses');
  expect(modelEndpoint('GET', '/models?client_version=0.156.1')).toBe(
    '/backend-api/codex/models?client_version=0.156.1',
  );
  expect(modelEndpoint('GET', '/responses')).toBeUndefined();
});
