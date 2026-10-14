import { describe, expect, it, vi } from 'vitest';
import { DesktopLifecycle } from '../src/main/desktopLifecycle.js';
import { DesktopChildShutdownError } from '../src/main/ownedDesktopChild.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('desktop startup ownership', () => {
  it('cancels before asynchronous secrets resolve and never starts the child', async () => {
    const lifecycle = new DesktopLifecycle();
    const secrets = deferred<void>();
    const spawn = vi.fn();
    const starting = lifecycle.run(async () => {
      await secrets.promise;
      lifecycle.check();
      spawn();
    });
    await Promise.resolve();
    const stopped = lifecycle.stop();
    expect(lifecycle.signal.aborted).toBe(true);
    expect(lifecycle.stop()).toBe(stopped);
    secrets.resolve();
    await expect(starting).rejects.toHaveProperty('name', 'AbortError');
    await stopped;
    expect(spawn).not.toHaveBeenCalled();
  });

  it('joins a late renderer handle and stops it without publishing or creating a window', async () => {
    const lifecycle = new DesktopLifecycle();
    const renderer = deferred<{ stop: () => Promise<void> }>();
    const stop = vi.fn(async () => {});
    const publishWindow = vi.fn();
    const starting = lifecycle.run(async () => {
      await lifecycle.own(renderer.promise);
      publishWindow();
    });
    await Promise.resolve();
    const stopped = lifecycle.stop();
    renderer.resolve({ stop });
    await expect(starting).rejects.toHaveProperty('name', 'AbortError');
    await stopped;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(publishWindow).not.toHaveBeenCalled();
  });

  it('cancellation wins a concurrently successful readiness continuation', async () => {
    const lifecycle = new DesktopLifecycle();
    const ready = deferred<{ stop: () => Promise<void> }>();
    const publish = vi.fn();
    const stop = vi.fn(async () => {});
    const starting = lifecycle.run(async () => {
      await lifecycle.own(ready.promise);
      publish();
    });
    await Promise.resolve();
    ready.resolve({ stop });
    const stopped = lifecycle.stop();
    await expect(starting).rejects.toHaveProperty('name', 'AbortError');
    await stopped;
    expect(publish).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('joins normal shutdown and rejects unconfirmed startup cleanup', async () => {
    const lifecycle = new DesktopLifecycle();
    const stop = vi.fn(async () => {});
    await lifecycle.run(() => lifecycle.own(Promise.resolve({ stop })));
    await lifecycle.stop();
    expect(stop).toHaveBeenCalledOnce();
    const failed = new DesktopLifecycle();
    await expect(
      failed.run(async () => {
        throw new DesktopChildShutdownError('unconfirmed');
      }),
    ).rejects.toThrow('unconfirmed');
    await expect(failed.stop()).rejects.toThrow('unconfirmed');
  });
});
