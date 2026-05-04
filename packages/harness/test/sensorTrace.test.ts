import { describe, expect, it } from 'vitest';
import type { TraceEvent } from '../src/trace.js';

describe('sensor trace events', () => {
  it('represents sensor run, result, and loop-limit lifecycle events', () => {
    const events = [
      {
        type: 'sensor_run',
        sensorId: 'typescript-typecheck',
        trigger: 'before_push',
        profile: 'coding',
        required: true,
      },
      {
        type: 'sensor_result',
        sensorId: 'typescript-typecheck',
        status: 'failed',
        findingCount: 1,
        repairInstructionCount: 1,
      },
      {
        type: 'sensor_loop_limit',
        sensorId: 'typescript-typecheck',
        repeats: 2,
        reason: 'same failure repeated without progress',
      },
    ] satisfies TraceEvent[];

    expect(events.map((event) => event.type)).toEqual([
      'sensor_run',
      'sensor_result',
      'sensor_loop_limit',
    ]);
  });
});
