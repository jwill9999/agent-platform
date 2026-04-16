/**
 * Per-tool execution timeout wrapper.
 *
 * Wraps an async tool call with a timeout using Promise.race.
 * On timeout, throws {@link ToolTimeoutError} so callers can
 * return a structured `TOOL_TIMEOUT` error code.
 */

const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

export class ToolTimeoutError extends Error {
  readonly toolName: string;
  readonly timeoutMs: number;

  constructor(toolName: string, timeoutMs: number) {
    super(`Tool "${toolName}" timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
    this.toolName = toolName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Run `fn` with a per-tool timeout using Promise.race.
 *
 * If `parentSignal` is already aborted, throws immediately.
 * On timeout, the inner AbortSignal is aborted so cooperative
 * cancellation propagates to the wrapped function.
 */
export async function withToolTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  toolName: string,
  parentSignal?: AbortSignal,
): Promise<T> {
  if (parentSignal?.aborted) {
    throw new ToolTimeoutError(toolName, timeoutMs);
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ToolTimeoutError(toolName, timeoutMs));
    }, timeoutMs);
  });

  let parentCleanup: (() => void) | undefined;
  const parentPromise = parentSignal
    ? new Promise<never>((_, reject) => {
        const handler = () => {
          controller.abort();
          reject(new ToolTimeoutError(toolName, timeoutMs));
        };
        parentSignal.addEventListener('abort', handler, { once: true });
        parentCleanup = () => parentSignal.removeEventListener('abort', handler);
      })
    : undefined;

  const racers: Promise<T>[] = [fn(controller.signal), timeoutPromise];
  if (parentPromise) racers.push(parentPromise);

  try {
    return await Promise.race(racers);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    parentCleanup?.();
  }
}

/**
 * Resolve the effective timeout for a tool call.
 *
 * Priority: per-tool override → agent-level `toolTimeoutMs` → system default.
 * Always capped at `remainingGlobalMs` when provided.
 */
export function resolveToolTimeout(
  agentToolTimeoutMs?: number,
  perToolTimeoutMs?: number,
  remainingGlobalMs?: number,
): number {
  const base = perToolTimeoutMs ?? agentToolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
  if (remainingGlobalMs !== undefined && remainingGlobalMs > 0) {
    return Math.min(base, remainingGlobalMs);
  }
  return base;
}
