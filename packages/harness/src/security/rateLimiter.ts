/**
 * Per-tool sliding-window rate limiter.
 *
 * Lives in the `createToolDispatchNode` closure so it persists across
 * all dispatch steps within a single graph run. Each tool name gets an
 * independent call-timestamp window.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Number of calls in the current window (including this one if allowed). */
  count: number;
  limit: number;
  windowMs: number;
}

export class ToolRateLimiter {
  private readonly maxCalls: number;
  private readonly windowMs: number;
  /** tool name → sorted list of call epoch-ms timestamps */
  private readonly windows = new Map<string, number[]>();

  constructor(maxCallsPerWindow: number, windowMs = 60_000) {
    this.maxCalls = maxCallsPerWindow;
    this.windowMs = windowMs;
  }

  /** Check whether a call to `toolName` is allowed right now. */
  check(toolName: string, now: number = Date.now()): RateLimitResult {
    const cutoff = now - this.windowMs;
    const timestamps = (this.windows.get(toolName) ?? []).filter((t) => t > cutoff);
    // Update pruned window
    this.windows.set(toolName, timestamps);

    return {
      allowed: timestamps.length < this.maxCalls,
      count: timestamps.length,
      limit: this.maxCalls,
      windowMs: this.windowMs,
    };
  }

  /** Record a successful dispatch of `toolName`. Call after check() returns allowed. */
  record(toolName: string, now: number = Date.now()): void {
    const timestamps = this.windows.get(toolName) ?? [];
    timestamps.push(now);
    this.windows.set(toolName, timestamps);
  }
}
