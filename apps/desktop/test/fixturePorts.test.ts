import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';

import { getDesktopLaunchPorts, getDesktopPorts, getOpenPort } from '../e2e/support/runtime.js';

vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>();
  return { ...actual, createServer: vi.fn(actual.createServer) };
});

afterEach(async () => {
  const actual = await vi.importActual<typeof import('node:net')>('node:net');
  vi.mocked(net.createServer).mockReset().mockImplementation(actual.createServer);
});

function reuseReleasedPorts(failAt?: number) {
  const held = new Set<number>();
  let count = 0;
  vi.mocked(net.createServer).mockImplementation(() => {
    const ordinal = ++count;
    const server = new EventEmitter();
    let port: number | undefined;
    Object.assign(server, {
      listen: (_port: number, _host: string, ready: () => void) => {
        if (ordinal === failAt) {
          queueMicrotask(() => server.emit('error', new Error('allocation failed')));
          return;
        }
        port = 41185;
        while (held.has(port)) port++;
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
  const held = reuseReleasedPorts(2);
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

it('keeps app and debugger reservations distinct until all four have been allocated', async () => {
  const held = reuseReleasedPorts();
  expect(await getDesktopLaunchPorts()).toEqual({
    backendPort: 41185,
    rendererPort: 41186,
    nodeInspectorPort: 41187,
    chromiumDebuggerPort: 41188,
  });
  expect(held.size).toBe(0);
});

it.each([1, 2, 3, 4])(
  'releases every reservation if launch allocation %s fails',
  async (failAt) => {
    const held = reuseReleasedPorts(failAt);
    await expect(getDesktopLaunchPorts()).rejects.toThrow('allocation failed');
    expect(held.size).toBe(0);
  },
);

it('returns four distinct real loopback ports and releases them for owned child listeners', async () => {
  const ports = Object.values(await getDesktopLaunchPorts());
  expect(new Set(ports).size).toBe(4);
  const listeners = ports.map(() => net.createServer());
  try {
    await Promise.all(
      listeners.map(
        (server, index) =>
          new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(ports[index], '127.0.0.1', resolve);
          }),
      ),
    );
  } finally {
    await Promise.all(
      listeners.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  }
});
