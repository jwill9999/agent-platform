import { describe, expect, it } from 'vitest';
import { checkDeadline } from '../src/deadline.js';

describe('checkDeadline', () => {
  it('returns not expired when plenty of time remains', () => {
    const state = { startedAtMs: 1000, deadlineMs: 5000 };
    const result = checkDeadline(state, 3000); // 2000ms elapsed, 3000 remain

    expect(result.expired).toBe(false);
    expect(result.remainingMs).toBe(3000);
    expect(result.elapsedMs).toBe(2000);
  });

  it('returns expired when deadline is exceeded', () => {
    const state = { startedAtMs: 1000, deadlineMs: 5000 };
    const result = checkDeadline(state, 7000); // 6000ms elapsed > 5000

    expect(result.expired).toBe(true);
    expect(result.remainingMs).toBe(0);
    expect(result.elapsedMs).toBe(6000);
  });

  it('returns expired when exactly at deadline', () => {
    const state = { startedAtMs: 1000, deadlineMs: 5000 };
    const result = checkDeadline(state, 6000); // 5000ms elapsed = 5000

    expect(result.expired).toBe(true);
    expect(result.remainingMs).toBe(0);
    expect(result.elapsedMs).toBe(5000);
  });

  it('returns not expired when startedAtMs is missing (backwards-compat)', () => {
    const state = { startedAtMs: 0, deadlineMs: 5000 };
    const result = checkDeadline(state, 99999);

    expect(result.expired).toBe(false);
    expect(result.remainingMs).toBe(Infinity);
  });

  it('returns not expired when deadlineMs is missing (backwards-compat)', () => {
    const state = { startedAtMs: 1000, deadlineMs: 0 };
    const result = checkDeadline(state, 99999);

    expect(result.expired).toBe(false);
    expect(result.remainingMs).toBe(Infinity);
  });

  it('clamps remainingMs to 0 (never negative)', () => {
    const state = { startedAtMs: 1000, deadlineMs: 100 };
    const result = checkDeadline(state, 50000);

    expect(result.remainingMs).toBe(0);
    expect(result.expired).toBe(true);
  });
});
