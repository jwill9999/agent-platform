import { describe, it, expect, vi } from 'vitest';
import {
  withRetry,
  isRetryableLlmError,
  isRetryableToolError,
  LLM_RETRY_CONFIG,
  TOOL_RETRY_CONFIG,
  type RetryConfig,
} from '../src/retry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const alwaysRetry: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1,
  maxDelayMs: 10,
  jitterFactor: 0,
  isRetryable: () => true,
};

const neverRetry: RetryConfig = {
  ...alwaysRetry,
  isRetryable: () => false,
};

function httpError(status: number, msg = 'error'): Error {
  const err = new Error(msg);
  (err as unknown as Record<string, unknown>).status = status;
  return err;
}

function nodeError(code: string): Error {
  const err = new Error(`connect ${code}`);
  (err as unknown as Record<string, unknown>).code = code;
  return err;
}

// ---------------------------------------------------------------------------
// withRetry — core behaviour
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  it('returns result on first attempt when fn succeeds', async () => {
    const result = await withRetry(() => Promise.resolve(42), alwaysRetry);
    expect(result).toBe(42);
  });

  it('retries up to maxAttempts on retryable errors', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('transient'));
      return Promise.resolve('ok');
    };

    const result = await withRetry(fn, alwaysRetry);
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws immediately on non-retryable error', async () => {
    const fn = () => Promise.reject(new Error('permanent'));
    await expect(withRetry(fn, neverRetry)).rejects.toThrow('permanent');
  });

  it('throws after exhausting all attempts', async () => {
    const fn = () => Promise.reject(new Error('always fails'));
    await expect(withRetry(fn, alwaysRetry)).rejects.toThrow('always fails');
  });

  it('calls onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('done');
    };

    await withRetry(fn, alwaysRetry, onRetry);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
  });

  it('applies exponential backoff with no jitter', async () => {
    const delays: number[] = [];
    const config: RetryConfig = {
      maxAttempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 10000,
      jitterFactor: 0,
      isRetryable: () => true,
    };

    const onRetry = (_attempt: number, _err: unknown, delayMs: number) => {
      delays.push(delayMs);
    };

    const fn = () => Promise.reject(new Error('fail'));
    await withRetry(fn, config, onRetry).catch(() => {});

    // attempt 0 → delay = 100 * 2^0 = 100
    // attempt 1 → delay = 100 * 2^1 = 200
    // attempt 2 → delay = 100 * 2^2 = 400
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps delay at maxDelayMs', async () => {
    const delays: number[] = [];
    const config: RetryConfig = {
      maxAttempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 150,
      jitterFactor: 0,
      isRetryable: () => true,
    };

    const onRetry = (_attempt: number, _err: unknown, delayMs: number) => {
      delays.push(delayMs);
    };

    const fn = () => Promise.reject(new Error('fail'));
    await withRetry(fn, config, onRetry).catch(() => {});

    // attempt 0 → min(100, 150) = 100
    // attempt 1 → min(200, 150) = 150
    // attempt 2 → min(400, 150) = 150
    expect(delays).toEqual([100, 150, 150]);
  });
});

// ---------------------------------------------------------------------------
// isRetryableLlmError
// ---------------------------------------------------------------------------

describe('isRetryableLlmError', () => {
  it('returns true for HTTP 429', () => {
    expect(isRetryableLlmError(httpError(429))).toBe(true);
  });

  it('returns true for HTTP 500', () => {
    expect(isRetryableLlmError(httpError(500))).toBe(true);
  });

  it('returns true for HTTP 502', () => {
    expect(isRetryableLlmError(httpError(502))).toBe(true);
  });

  it('returns true for HTTP 503', () => {
    expect(isRetryableLlmError(httpError(503))).toBe(true);
  });

  it('returns true for HTTP 504', () => {
    expect(isRetryableLlmError(httpError(504))).toBe(true);
  });

  it('returns false for HTTP 401', () => {
    expect(isRetryableLlmError(httpError(401))).toBe(false);
  });

  it('returns false for HTTP 403', () => {
    expect(isRetryableLlmError(httpError(403))).toBe(false);
  });

  it('returns false for HTTP 404', () => {
    expect(isRetryableLlmError(httpError(404))).toBe(false);
  });

  it('returns true for ECONNRESET', () => {
    expect(isRetryableLlmError(nodeError('ECONNRESET'))).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isRetryableLlmError(nodeError('ETIMEDOUT'))).toBe(true);
  });

  it('returns true for ECONNREFUSED', () => {
    expect(isRetryableLlmError(nodeError('ECONNREFUSED'))).toBe(true);
  });

  it('returns true for message containing "socket hang up"', () => {
    expect(isRetryableLlmError(new Error('socket hang up'))).toBe(true);
  });

  it('returns false for non-Error values', () => {
    expect(isRetryableLlmError('string error')).toBe(false);
    expect(isRetryableLlmError(null)).toBe(false);
    expect(isRetryableLlmError(undefined)).toBe(false);
  });

  it('returns false for generic errors without status or code', () => {
    expect(isRetryableLlmError(new Error('something went wrong'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRetryableToolError
// ---------------------------------------------------------------------------

describe('isRetryableToolError', () => {
  it('returns true for econnreset in message', () => {
    expect(isRetryableToolError(new Error('econnreset during MCP call'))).toBe(true);
  });

  it('returns true for etimedout in message', () => {
    expect(isRetryableToolError(new Error('etimedout while connecting'))).toBe(true);
  });

  it('returns true for socket hang up', () => {
    expect(isRetryableToolError(new Error('socket hang up'))).toBe(true);
  });

  it('returns true for fetch failed', () => {
    expect(isRetryableToolError(new Error('fetch failed'))).toBe(true);
  });

  it('returns false for permission errors', () => {
    expect(isRetryableToolError(new Error('TOOL_NOT_ALLOWED: denied'))).toBe(false);
  });

  it('returns false for not-found errors', () => {
    expect(isRetryableToolError(new Error('TOOL_NOT_FOUND: missing'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isRetryableToolError('string')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default configs
// ---------------------------------------------------------------------------

describe('default retry configs', () => {
  it('LLM_RETRY_CONFIG has 3 attempts', () => {
    expect(LLM_RETRY_CONFIG.maxAttempts).toBe(3);
    expect(LLM_RETRY_CONFIG.baseDelayMs).toBe(1000);
    expect(LLM_RETRY_CONFIG.maxDelayMs).toBe(30_000);
    expect(LLM_RETRY_CONFIG.isRetryable).toBe(isRetryableLlmError);
  });

  it('TOOL_RETRY_CONFIG has 2 attempts', () => {
    expect(TOOL_RETRY_CONFIG.maxAttempts).toBe(2);
    expect(TOOL_RETRY_CONFIG.baseDelayMs).toBe(500);
    expect(TOOL_RETRY_CONFIG.maxDelayMs).toBe(5_000);
    expect(TOOL_RETRY_CONFIG.isRetryable).toBe(isRetryableToolError);
  });
});

// ---------------------------------------------------------------------------
// Integration: withRetry + isRetryableLlmError
// ---------------------------------------------------------------------------

describe('withRetry + error classification (integration)', () => {
  it('retries on 429 then succeeds', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls === 1) return Promise.reject(httpError(429, 'rate limited'));
      return Promise.resolve('success');
    };

    const result = await withRetry(fn, LLM_RETRY_CONFIG);
    expect(result).toBe('success');
    expect(calls).toBe(2);
  });

  it('does not retry on 401', async () => {
    const fn = () => Promise.reject(httpError(401, 'unauthorized'));
    await expect(withRetry(fn, LLM_RETRY_CONFIG)).rejects.toThrow('unauthorized');
  });

  it('retries tool error on econnreset then succeeds', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('econnreset'));
      return Promise.resolve({ ok: true });
    };

    const result = await withRetry(fn, TOOL_RETRY_CONFIG);
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('tool config does not retry permission error', async () => {
    const fn = () => Promise.reject(new Error('TOOL_NOT_ALLOWED: denied'));
    await expect(withRetry(fn, TOOL_RETRY_CONFIG)).rejects.toThrow('TOOL_NOT_ALLOWED');
  });
});
