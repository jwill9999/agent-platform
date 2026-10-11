import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('node:https', () => ({ request: transport.request }));
import { LocalCredentialLeases } from '../src/localCredentialLeases.js';
import { createLocalCredentialGateway } from '../src/localCredentialGateway.js';
const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
  transport.request.mockReset();
});
async function setup(now = Date.now) {
  const dir = mkdtempSync(join(tmpdir(), 'credential-gateway-test-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const leases = new LocalCredentialLeases(join(dir, 'db'), 1000, now);
  cleanups.push(() => leases.close());
  const auth = join(dir, 'auth');
  writeFileSync(
    auth,
    JSON.stringify({ tokens: { access_token: 'HOST_SECRET', account_id: 'HOST_ACCOUNT' } }),
  );
  const service = createLocalCredentialGateway(leases, auth);
  service.gateway.listen(0, '127.0.0.1');
  await once(service.gateway, 'listening');
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        service.gateway.close(() => resolve());
        service.gateway.closeAllConnections();
      }),
  );
  const address = service.gateway.address();
  if (!address || typeof address === 'string') throw Error('port');
  return { dir, leases, service, url: `http://127.0.0.1:${address.port}` };
}
it('replaces worker account headers, fixes upstream destination and aborts an active stream on revoke', async () => {
  const incoming = new PassThrough() as PassThrough & {
    statusCode: number;
    headers: Record<string, string>;
  };
  incoming.statusCode = 200;
  incoming.headers = { 'content-type': 'text/event-stream' };
  const outbound = new PassThrough();
  transport.request.mockImplementation((_options, callback) => {
    queueMicrotask(() => {
      callback(incoming);
      incoming.write('data: first\n\n');
    });
    return outbound;
  });
  const { leases, service, url } = await setup();
  const lease = leases.issue('active', leases.generation, 'execution');
  const response = await fetch(url + '/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${lease.token}`,
      'chatgpt-account-id': 'WORKER_SELECTED',
      host: 'evil.example',
    },
    body: '{}',
  });
  const reader = response.body!.getReader();
  expect((await reader.read()).done).toBe(false);
  const options = transport.request.mock.calls[0]![0];
  expect(options).toMatchObject({
    hostname: 'chatgpt.com',
    servername: 'chatgpt.com',
    path: '/backend-api/codex/responses',
    rejectUnauthorized: true,
    headers: { authorization: 'Bearer HOST_SECRET', 'chatgpt-account-id': 'HOST_ACCOUNT' },
  });
  expect(JSON.stringify(options)).not.toContain(lease.token);
  service.revoke('active', lease.generation);
  expect(outbound.destroyed).toBe(true);
  await expect(reader.read()).rejects.toThrow();
  expect(
    (await fetch(url + '/models', { headers: { authorization: `Bearer ${lease.token}` } })).status,
  ).toBe(403);
  expect(transport.request).toHaveBeenCalledTimes(1);
  incoming.destroy();
});
it('never exposes upstream redirects to the worker', async () => {
  const incoming = new PassThrough() as PassThrough & {
    statusCode: number;
    headers: Record<string, string>;
  };
  incoming.statusCode = 302;
  incoming.headers = { location: 'https://evil.example' };
  transport.request.mockImplementation((_options, callback) => {
    queueMicrotask(() => callback(incoming));
    return new PassThrough();
  });
  const { leases, url } = await setup();
  const lease = leases.issue('redirect', leases.generation, 'execution');
  const response = await fetch(url + '/models', {
    headers: { authorization: `Bearer ${lease.token}` },
    redirect: 'manual',
  });
  expect(response.status).toBe(502);
  expect(response.headers.has('location')).toBe(false);
});
it('rejects CONNECT before opening an upstream connection', async () => {
  const { url } = await setup();
  await new Promise<void>((resolve, reject) => {
    const req = request(url, { method: 'CONNECT', path: 'chatgpt.com:443' });
    req.on('connect', (response, socket) => {
      expect(response.statusCode).toBe(403);
      socket.destroy();
      resolve();
    });
    req.on('error', reject);
    req.end();
  });
  expect(transport.request).not.toHaveBeenCalled();
});

it('preserves compressed request bytes and rejects unsupported encoding', async () => {
  const incoming = Object.assign(new PassThrough(), { statusCode: 200, headers: {} });
  const outbound = new PassThrough();
  const chunks: Buffer[] = [];
  outbound.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  transport.request.mockImplementation((_options, callback) => {
    outbound.on('finish', () => {
      callback(incoming);
      incoming.end('{}');
    });
    return outbound;
  });
  const { leases, url } = await setup();
  const lease = leases.issue('compressed', leases.generation, 'execution');
  const { gzipSync } = await import('node:zlib');
  const bytes = gzipSync('{}');
  const headers = { authorization: `Bearer ${lease.token}`, 'content-encoding': 'gzip' };
  expect((await fetch(url + '/responses', { method: 'POST', headers, body: bytes })).status).toBe(
    200,
  );
  expect(Buffer.concat(chunks)).toEqual(bytes);
  expect(transport.request.mock.calls[0]![0].headers['content-encoding']).toBe('gzip');
  expect(
    (
      await fetch(url + '/responses', {
        method: 'POST',
        headers: { ...headers, 'content-encoding': 'unknown' },
        body: bytes,
      })
    ).status,
  ).toBe(415);
  expect(transport.request).toHaveBeenCalledTimes(1);
});

it.each(['expiry', 'replacement'])('terminates an active stream on %s', async (reason) => {
  let clock = 100;
  const incoming = Object.assign(new PassThrough(), { statusCode: 200, headers: {} });
  const outbound = new PassThrough();
  transport.request.mockImplementation((_options, callback) => {
    queueMicrotask(() => {
      callback(incoming);
      incoming.write('first');
    });
    return outbound;
  });
  const { dir, leases, url } = await setup(() => clock);
  const lease = leases.issue('stream', leases.generation, 'execution');
  const response = await fetch(url + '/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${lease.token}` },
    body: '{}',
  });
  const reader = response.body!.getReader();
  expect((await reader.read()).done).toBe(false);
  if (reason === 'expiry') clock = 1100;
  else {
    const replacement = new LocalCredentialLeases(join(dir, 'db'));
    cleanups.push(() => replacement.close());
    expect(replacement.status('stream', lease.generation)).toBe('revoked');
  }
  await expect(reader.read()).rejects.toThrow();
  expect(outbound.destroyed).toBe(true);
  expect(
    (await fetch(url + '/models', { headers: { authorization: `Bearer ${lease.token}` } })).status,
  ).toBe(403);
  incoming.destroy();
});

it('rejects WebSocket upgrades without contacting upstream', async () => {
  const { leases, url } = await setup();
  const lease = leases.issue('websocket', leases.generation, 'execution');
  await new Promise<void>((resolve, reject) => {
    const req = request(url + '/responses', {
      headers: {
        authorization: `Bearer ${lease.token}`,
        connection: 'Upgrade',
        upgrade: 'websocket',
      },
    });
    req.on('response', (response) => {
      expect(response.statusCode).toBe(403);
      response.resume();
      resolve();
    });
    req.on('upgrade', (_response, socket) => {
      socket.destroy();
      reject(Error('unexpected upgrade'));
    });
    req.on('error', reject);
    req.end();
  });
  expect(transport.request).not.toHaveBeenCalled();
});
