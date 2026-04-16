/**
 * Retry utility with exponential backoff and jitter.
 *
 * Used to wrap transient-failure-prone operations (LLM calls, MCP tool calls)
 * so they recover from temporary issues without surfacing errors to the user.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryConfig {
  /** Maximum number of attempts (including the first). */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds. */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds. */
  maxDelayMs: number;
  /** Randomisation factor (0–1). 0.25 means ±25% jitter. */
  jitterFactor: number;
  /** Return true if the error is eligible for retry. */
  isRetryable: (error: unknown) => boolean;
}

export type RetryCallback = (attempt: number, error: unknown, delayMs: number) => void;

// ---------------------------------------------------------------------------
// Core retry function
// ---------------------------------------------------------------------------

/**
 * Execute `fn` with retry logic.
 *
 * On each failure the error is tested with `config.isRetryable`. Non-retryable
 * errors are thrown immediately. Retryable errors wait with exponential backoff
 * (`baseDelayMs * 2^attempt`) capped at `maxDelayMs`, with ±jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetry?: RetryCallback,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!config.isRetryable(err)) {
        throw err;
      }

      const isLastAttempt = attempt >= config.maxAttempts - 1;
      if (isLastAttempt) break;

      const delayMs = computeDelay(attempt, config);
      onRetry?.(attempt + 1, err, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Delay helpers
// ---------------------------------------------------------------------------

function computeDelay(attempt: number, config: RetryConfig): number {
  const exponential = Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs);
  const jitter = exponential * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const RETRYABLE_HTTP_CODES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_NODE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE']);

/**
 * Classify whether an LLM API error is transient (retryable).
 *
 * Retryable: 429, 500, 502, 503, 504, ECONNRESET, ETIMEDOUT.
 * Permanent: 401, 403, 404, 400, validation errors.
 */
export function isRetryableLlmError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Vercel AI SDK / OpenAI errors expose a status property
  const status = extractHttpStatus(error);
  if (status !== undefined) {
    return RETRYABLE_HTTP_CODES.has(status);
  }

  // Node.js network errors
  const code = extractErrorCode(error);
  if (code && RETRYABLE_NODE_CODES.has(code)) {
    return true;
  }

  // Heuristic: message-based detection for wrapped errors
  const msg = error.message.toLowerCase();
  if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('socket hang up')) {
    return true;
  }

  return false;
}

/**
 * Classify whether a tool dispatch error is transient.
 *
 * Only MCP network failures are retryable; permission and not-found errors are permanent.
 */
export function isRetryableToolError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();

  // MCP call failures due to network issues
  if (
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Internal: extract HTTP status / error code from unknown error shapes
// ---------------------------------------------------------------------------

function extractHttpStatus(error: Error): number | undefined {
  const err = error as unknown as Record<string, unknown>;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  // Nested cause/response
  if (err.cause && typeof err.cause === 'object') {
    const cause = err.cause as Record<string, unknown>;
    if (typeof cause.status === 'number') return cause.status;
  }
  return undefined;
}

function extractErrorCode(error: Error): string | undefined {
  const err = error as unknown as Record<string, unknown>;
  if (typeof err.code === 'string') return err.code;
  return undefined;
}

// ---------------------------------------------------------------------------
// Default configs
// ---------------------------------------------------------------------------

export const LLM_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitterFactor: 0.25,
  isRetryable: isRetryableLlmError,
};

export const TOOL_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 500,
  maxDelayMs: 5_000,
  jitterFactor: 0.25,
  isRetryable: isRetryableToolError,
};
