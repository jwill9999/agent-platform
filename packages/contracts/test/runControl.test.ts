import { describe, expect, it } from 'vitest';
import { RunControlRecordSchema } from '../src/runControl.js';
const record = {
  id: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session-1',
  processInstanceId: '22222222-2222-4222-8222-222222222222',
  state: 'running',
  version: 1,
  createdAtMs: 100,
  updatedAtMs: 100,
  reason: 'none',
  inFlight: 0,
};
describe('shared harness run control contract', () => {
  it('allows all declared states and fixed reasons without UI ownership fields', () => {
    expect(RunControlRecordSchema.parse(record)).toEqual(record);
    expect(
      RunControlRecordSchema.parse({
        ...record,
        state: 'outcome_unknown',
        reason: 'user_stop',
        stopAcknowledgedAtMs: 105,
        inFlight: 1,
      }).state,
    ).toBe('outcome_unknown');
  });
  it.each([
    { prompt: 'private input' },
    { reason: 'raw error text' },
    { inFlight: -1 },
    { version: 0 },
    { id: 'not-uuid' },
    { sessionId: '../private' },
    { processInstanceId: 'caller' },
    { createdAtMs: Infinity },
    { updatedAtMs: 1.5 },
    { state: 'stopped' },
  ])('rejects unsafe or ambiguous data %j', (delta) => {
    expect(RunControlRecordSchema.safeParse({ ...record, ...delta }).success).toBe(false);
  });
});
