/**
 * Wall-time deadline propagation.
 *
 * Provides a pure helper that graph nodes call before starting work.
 * If the run has exceeded its wall-time budget the node should halt
 * immediately — preventing runaway agents from consuming unbounded
 * compute even after the HTTP-level timeout fires.
 */

import type { HarnessStateType } from './graphState.js';

export type DeadlineStatus = {
  /** True when the wall-time budget has been exhausted. */
  expired: boolean;
  /** Milliseconds remaining (clamped to 0 when expired). */
  remainingMs: number;
  /** Milliseconds elapsed since the run started. */
  elapsedMs: number;
};

/**
 * Check whether the run has exceeded its wall-time deadline.
 *
 * Returns a snapshot of the deadline status so nodes can:
 * 1. Early-exit when `expired === true`
 * 2. Use `remainingMs` to cap downstream timeouts (LLM calls, tool calls)
 *
 * If `startedAtMs` or `deadlineMs` are missing from state the deadline
 * is treated as infinite (backwards-compatible).
 */
export function checkDeadline(
  state: Pick<HarnessStateType, 'startedAtMs' | 'deadlineMs'>,
  now: number = Date.now(),
): DeadlineStatus {
  const { startedAtMs, deadlineMs } = state;

  if (!startedAtMs || !deadlineMs || deadlineMs <= 0) {
    return { expired: false, remainingMs: Infinity, elapsedMs: 0 };
  }

  const elapsedMs = now - startedAtMs;
  const remainingMs = Math.max(0, deadlineMs - elapsedMs);

  return { expired: remainingMs <= 0, remainingMs, elapsedMs };
}
