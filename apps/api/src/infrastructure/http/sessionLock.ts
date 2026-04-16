import { HttpError } from './httpError.js';

/**
 * Session-scoped mutex that serialises concurrent requests on the same session.
 *
 * Designed for easy swap to a distributed implementation (Redis, Postgres advisory
 * locks) by programming against the {@link SessionLock} interface.
 */
export interface SessionLock {
  /**
   * Acquire an exclusive lock for the given session.
   *
   * - If the session is idle, resolves immediately with a `release` callback.
   * - If another request holds the lock, waits up to `timeoutMs` for it to finish.
   * - If the timeout elapses, throws a 409 HttpError.
   *
   * The caller **must** call `release()` in a `finally` block.
   */
  acquire(sessionId: string, timeoutMs?: number): Promise<() => void>;

  /** Number of sessions currently locked (observable for metrics). */
  readonly activeCount: number;
}

const DEFAULT_LOCK_TIMEOUT_MS = 120_000;

/**
 * In-process (single-Node) session lock backed by a `Map<sessionId, Promise>`.
 *
 * Each session gets a promise chain: the newest promise in the map is the one
 * that the *next* caller will await. When that promise resolves the next
 * caller proceeds.
 */
export function createInProcessSessionLock(): SessionLock {
  const locks = new Map<string, Promise<void>>();

  return {
    get activeCount() {
      return locks.size;
    },

    async acquire(sessionId: string, timeoutMs = DEFAULT_LOCK_TIMEOUT_MS): Promise<() => void> {
      const existing = locks.get(sessionId) ?? Promise.resolve();

      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      locks.set(sessionId, gate);

      // Race: wait for previous holder vs. timeout
      const timeout = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          reject(
            new HttpError(
              409,
              'SESSION_BUSY',
              `Session '${sessionId}' is currently processing another request`,
            ),
          );
        }, timeoutMs);
        // Prevent the timer from keeping the process alive during shutdown
        if (typeof id === 'object' && 'unref' in id) id.unref();
      });

      try {
        await Promise.race([existing, timeout]);
      } catch (err) {
        // On timeout, release our gate so the chain isn't permanently stuck
        release();
        if (locks.get(sessionId) === gate) locks.delete(sessionId);
        throw err;
      }

      return () => {
        release();
        if (locks.get(sessionId) === gate) locks.delete(sessionId);
      };
    },
  };
}
