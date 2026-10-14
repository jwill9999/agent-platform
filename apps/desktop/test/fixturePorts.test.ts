import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';

import { getDesktopPorts, getOpenPort } from '../e2e/support/runtime.js';

vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>();
  return { ...actual, createServer: vi.fn(actual.createServer) };
});

afterEach(async () => {
  const actual = await vi.importActual<typeof import('node:net')>('node:net');
  vi.mocked(net.createServer).mockReset().mockImplementation(actual.createServer);
});

function reuseReleasedPorts(failSecond = false) {
  const held = new Set<number>();
  let count = 0;
  vi.mocked(net.createServer).mockImplementation(() => {
    const ordinal = ++count;
    const server = new EventEmitter();
    let port: number | undefined;
    Object.assign(server, {
      listen: (_port: number, _host: string, ready: () => void) => {
        if (failSecond && ordinal === 2) {
          queueMicrotask(() => server.emit('error', new Error('allocation failed')));
          return;
        }
        port = held.has(41185) ? 41186 : 41185;
        held.add(port);
        queueMicrotask(ready);
      },
      address: () => (port === undefined ? null : { port }),
      close: (closed: () => void) => {
        if (port !== undefined) held.delete(port);
        queueMicrotask(closed);
      },
    });
    return server as net.Server;
  });
  return held;
}

it('keeps both reservations alive when the allocator immediately reuses released ports', async () => {
  const held = reuseReleasedPorts();
  // Reproduce the original fixture failure deterministically before testing its replacement.
  expect(await getOpenPort()).toBe(41185);
  expect(await getOpenPort()).toBe(41185);
  expect(await getDesktopPorts()).toEqual({ backendPort: 41185, rendererPort: 41186 });
  expect(held.size).toBe(0);
});

it('releases the first reservation when the second allocation fails', async () => {
  const held = reuseReleasedPorts(true);
  await expect(getDesktopPorts()).rejects.toThrow('allocation failed');
  expect(held.size).toBe(0);
});

it('returns distinct real loopback ports and releases both for child listeners', async () => {
  const { backendPort, rendererPort } = await getDesktopPorts();
  expect(backendPort).not.toBe(rendererPort);
  const listeners = [net.createServer(), net.createServer()];
  try {
    await Promise.all(
      listeners.map(
        (server, index) =>
          new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen([backendPort, rendererPort][index], '127.0.0.1', resolve);
          }),
      ),
    );
  } finally {
    await Promise.all(
      listeners.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  }
});
