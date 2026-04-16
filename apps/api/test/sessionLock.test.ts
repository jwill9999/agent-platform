import { describe, expect, it } from 'vitest';

import { createInProcessSessionLock } from '../src/infrastructure/http/sessionLock.js';

describe('createInProcessSessionLock', () => {
  it('acquire resolves immediately when session is idle', async () => {
    const lock = createInProcessSessionLock();
    const release = await lock.acquire('s1');
    expect(typeof release).toBe('function');
    release();
  });

  it('activeCount reflects held locks', async () => {
    const lock = createInProcessSessionLock();
    expect(lock.activeCount).toBe(0);

    const r1 = await lock.acquire('s1');
    expect(lock.activeCount).toBe(1);

    const r2 = await lock.acquire('s2');
    expect(lock.activeCount).toBe(2);

    r1();
    expect(lock.activeCount).toBe(1);

    r2();
    expect(lock.activeCount).toBe(0);
  });

  it('serialises concurrent acquires on same session', async () => {
    const lock = createInProcessSessionLock();
    const order: number[] = [];

    const r1 = await lock.acquire('s1');
    order.push(1);

    // Second acquire should wait until r1 releases
    const p2 = lock.acquire('s1').then((release) => {
      order.push(2);
      return release;
    });

    // Let microtasks run — p2 should still be pending
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual([1]);

    r1();
    const r2 = await p2;
    expect(order).toEqual([1, 2]);
    r2();
  });

  it('allows different sessions to run concurrently', async () => {
    const lock = createInProcessSessionLock();
    const events: string[] = [];

    const r1 = await lock.acquire('session-a');
    events.push('a-acquired');

    const r2 = await lock.acquire('session-b');
    events.push('b-acquired');

    expect(events).toEqual(['a-acquired', 'b-acquired']);
    r1();
    r2();
  });

  it('returns 409 HttpError when timeout elapses', async () => {
    const lock = createInProcessSessionLock();
    const r1 = await lock.acquire('s1');

    const err = await lock.acquire('s1', 50).catch((e) => e);
    expect(err).toBeDefined();
    expect(err.status).toBe(409);
    expect(err.code).toBe('SESSION_BUSY');
    expect(err.message).toContain('s1');

    r1();
  });

  it('cleans up after timeout so future acquires work', async () => {
    const lock = createInProcessSessionLock();
    const r1 = await lock.acquire('s1');

    // Timeout
    await lock.acquire('s1', 50).catch(() => {});
    r1();

    // Should be able to acquire again
    const r2 = await lock.acquire('s1');
    expect(lock.activeCount).toBe(1);
    r2();
    expect(lock.activeCount).toBe(0);
  });

  it('releases lock even when execution throws', async () => {
    const lock = createInProcessSessionLock();

    async function executeWithLock(): Promise<void> {
      const release = await lock.acquire('s1');
      try {
        throw new Error('execution failed');
      } finally {
        release();
      }
    }

    await expect(executeWithLock()).rejects.toThrow('execution failed');
    expect(lock.activeCount).toBe(0);

    // Can acquire again after error
    const r = await lock.acquire('s1');
    r();
  });

  it('handles rapid sequential acquire/release cycles', async () => {
    const lock = createInProcessSessionLock();

    for (let i = 0; i < 20; i++) {
      const release = await lock.acquire('s1');
      release();
    }
    expect(lock.activeCount).toBe(0);
  });

  it('chains three waiters correctly', async () => {
    const lock = createInProcessSessionLock();
    const order: number[] = [];

    const r1 = await lock.acquire('s1');

    const p2 = lock.acquire('s1').then((release) => {
      order.push(2);
      // Hold briefly then release
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          release();
          resolve();
        }, 20);
      });
    });

    const p3 = lock.acquire('s1').then((release) => {
      order.push(3);
      release();
    });

    // Release first holder
    r1();
    await p2;
    await p3;

    expect(order).toEqual([2, 3]);
    expect(lock.activeCount).toBe(0);
  });
});
