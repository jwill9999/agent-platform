import { describe, expect, it } from 'vitest';
import { ToolRateLimiter } from '../src/security/rateLimiter.js';

describe('ToolRateLimiter', () => {
  it('allows calls within the limit', () => {
    const limiter = new ToolRateLimiter(3, 60_000);
    const now = 100_000;

    expect(limiter.check('toolA', now).allowed).toBe(true);
    limiter.record('toolA', now);
    expect(limiter.check('toolA', now + 100).allowed).toBe(true);
    limiter.record('toolA', now + 100);
    expect(limiter.check('toolA', now + 200).allowed).toBe(true);
    limiter.record('toolA', now + 200);

    // 4th call should be blocked
    expect(limiter.check('toolA', now + 300).allowed).toBe(false);
  });

  it('tracks tools independently', () => {
    const limiter = new ToolRateLimiter(1, 60_000);
    const now = 100_000;

    limiter.record('toolA', now);
    expect(limiter.check('toolA', now + 100).allowed).toBe(false);
    // toolB should still be allowed
    expect(limiter.check('toolB', now + 100).allowed).toBe(true);
  });

  it('expires old timestamps outside the window', () => {
    const limiter = new ToolRateLimiter(2, 1_000);
    const now = 100_000;

    limiter.record('toolA', now);
    limiter.record('toolA', now + 100);

    // At limit
    expect(limiter.check('toolA', now + 200).allowed).toBe(false);

    // After window expires, calls should be allowed again
    expect(limiter.check('toolA', now + 1_100).allowed).toBe(true);
  });

  it('returns correct count and limit in result', () => {
    const limiter = new ToolRateLimiter(5, 30_000);
    const now = 100_000;

    limiter.record('toolA', now);
    limiter.record('toolA', now + 10);

    const result = limiter.check('toolA', now + 20);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.windowMs).toBe(30_000);
  });

  it('uses Date.now() as default when no now parameter provided', () => {
    const limiter = new ToolRateLimiter(100, 60_000);

    const result = limiter.check('toolA');
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(0);

    limiter.record('toolA');
    const result2 = limiter.check('toolA');
    expect(result2.count).toBe(1);
  });

  it('prunes stale entries on check', () => {
    const limiter = new ToolRateLimiter(2, 500);
    const now = 100_000;

    limiter.record('toolA', now);
    limiter.record('toolA', now + 100);
    // Window is full
    expect(limiter.check('toolA', now + 200).allowed).toBe(false);

    // Both entries expired — check should prune and allow
    const result = limiter.check('toolA', now + 600);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(0);
  });
});
