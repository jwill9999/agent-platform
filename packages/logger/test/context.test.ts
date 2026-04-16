import { describe, expect, it } from 'vitest';
import { runWithCorrelation, getCorrelationId } from '../src/context.js';

describe('correlation context', () => {
  it('returns undefined when no context is active', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('propagates correlationId within runWithCorrelation', () => {
    runWithCorrelation('req-abc', () => {
      expect(getCorrelationId()).toBe('req-abc');
    });
  });

  it('isolates concurrent contexts', async () => {
    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        runWithCorrelation('ctx-1', () => {
          setTimeout(() => {
            results.push(`1:${getCorrelationId()}`);
            resolve();
          }, 10);
        });
      }),
      new Promise<void>((resolve) => {
        runWithCorrelation('ctx-2', () => {
          setTimeout(() => {
            results.push(`2:${getCorrelationId()}`);
            resolve();
          }, 5);
        });
      }),
    ]);

    expect(results).toContain('1:ctx-1');
    expect(results).toContain('2:ctx-2');
  });

  it('returns to undefined after context exits', () => {
    runWithCorrelation('temp', () => {
      expect(getCorrelationId()).toBe('temp');
    });
    expect(getCorrelationId()).toBeUndefined();
  });
});
