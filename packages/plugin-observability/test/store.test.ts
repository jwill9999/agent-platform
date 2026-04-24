import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createObservabilityStore } from '../src/store.js';

describe('createObservabilityStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters logs by session, level, and since', () => {
    const store = createObservabilityStore();

    vi.setSystemTime(new Date('2026-04-23T12:00:00.000Z'));
    store.record({ kind: 'session_start', sessionId: 's1', agentId: 'a1' });

    vi.setSystemTime(new Date('2026-04-23T12:00:01.000Z'));
    store.record({
      kind: 'task_end',
      sessionId: 's1',
      runId: 'r1',
      taskId: 't1',
      ok: false,
      detail: 'partial',
    });

    vi.setSystemTime(new Date('2026-04-23T12:00:02.000Z'));
    store.record({
      kind: 'error',
      sessionId: 's1',
      runId: 'r1',
      phase: 'tool',
      message: 'boom',
    });

    vi.setSystemTime(new Date('2026-04-23T12:00:03.000Z'));
    store.record({ kind: 'session_start', sessionId: 's2', agentId: 'a2' });

    const warnLogs = store.getLogs({
      sessionId: 's1',
      level: 'warn',
      since: '2026-04-23T12:00:00.500Z',
      limit: 10,
    });
    expect(warnLogs).toHaveLength(1);
    expect(warnLogs[0]?.event).toMatchObject({ kind: 'task_end', ok: false });

    const recentLogs = store.getLogs({ sessionId: 's1', limit: 2 });
    expect(recentLogs.map((record) => record.kind)).toEqual(['error', 'task_end']);
  });

  it('treats failed dod checks as errors', () => {
    const store = createObservabilityStore();

    store.record({
      kind: 'dod_check',
      sessionId: 's1',
      runId: 'r1',
      passed: false,
      criteriaCount: 2,
      failedCriteriaCount: 1,
    });
    store.record({
      kind: 'dod_check',
      sessionId: 's1',
      runId: 'r2',
      passed: true,
      criteriaCount: 1,
      failedCriteriaCount: 0,
    });

    const errors = store.getErrors({ sessionId: 's1', limit: 10 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.event).toMatchObject({ kind: 'dod_check', passed: false });
  });

  it('returns the requested trace or the latest trace for a session', () => {
    const store = createObservabilityStore();

    vi.setSystemTime(new Date('2026-04-23T12:00:00.000Z'));
    store.record({
      kind: 'task_start',
      sessionId: 's1',
      runId: 'r1',
      planId: 'p1',
      taskId: 't1',
      toolIds: [],
    });
    vi.setSystemTime(new Date('2026-04-23T12:00:01.000Z'));
    store.record({
      kind: 'tool_call',
      sessionId: 's1',
      runId: 'r1',
      toolId: 'sys_read_file',
    });
    vi.setSystemTime(new Date('2026-04-23T12:00:02.000Z'));
    store.record({
      kind: 'task_start',
      sessionId: 's1',
      runId: 'r2',
      planId: 'p2',
      taskId: 't2',
      toolIds: [],
    });

    const trace = store.getTrace({ sessionId: 's1', traceId: 'r1' });
    expect(trace?.traceId).toBe('r1');
    expect(trace?.records.map((record) => record.kind)).toEqual(['task_start', 'tool_call']);

    const latestTrace = store.getTrace({ sessionId: 's1' });
    expect(latestTrace?.traceId).toBe('r2');
  });

  it('evicts the oldest records when maxRecords is exceeded', () => {
    const store = createObservabilityStore({ maxRecords: 2 });

    vi.setSystemTime(new Date('2026-04-23T12:00:00.000Z'));
    store.record({ kind: 'session_start', sessionId: 's1', agentId: 'a1' });
    vi.setSystemTime(new Date('2026-04-23T12:00:01.000Z'));
    store.record({
      kind: 'task_start',
      sessionId: 's1',
      runId: 'r1',
      planId: 'p1',
      taskId: 't1',
      toolIds: [],
    });
    vi.setSystemTime(new Date('2026-04-23T12:00:02.000Z'));
    store.record({
      kind: 'error',
      sessionId: 's1',
      runId: 'r1',
      phase: 'tool',
      message: 'boom',
    });

    expect(store.getLogs({ sessionId: 's1', limit: 10 }).map((record) => record.kind)).toEqual([
      'error',
      'task_start',
    ]);
  });

  it('rejects blank session ids', () => {
    const store = createObservabilityStore();
    expect(() => store.getLogs({ sessionId: '' })).toThrow('sessionId is required');
    expect(() => store.getErrors({ sessionId: '   ' })).toThrow('sessionId is required');
    expect(() => store.getTrace({ sessionId: '' })).toThrow('sessionId is required');
  });
});
