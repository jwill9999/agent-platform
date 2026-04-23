import { describe, expect, it } from 'vitest';
import { DodContractSchema } from '../src/index.js';

describe('DodContractSchema', () => {
  it('round-trips a passing contract', () => {
    const contract = DodContractSchema.parse({
      criteria: ['Answer the user', 'Use the fetched evidence'],
      evidence: ['Answered in final response', 'Cited tool result'],
      passed: true,
    });

    expect(DodContractSchema.parse(structuredClone(contract))).toEqual({
      criteria: ['Answer the user', 'Use the fetched evidence'],
      evidence: ['Answered in final response', 'Cited tool result'],
      passed: true,
      failedCriteria: [],
    });
  });

  it('rejects an empty criteria list', () => {
    expect(() =>
      DodContractSchema.parse({
        criteria: [],
        evidence: [],
        passed: false,
      }),
    ).toThrow();
  });
});
