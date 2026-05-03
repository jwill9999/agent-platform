import type { ScheduledJobRecord } from '@agent-platform/contracts';
import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatSchedule,
  schedulerRunTone,
  schedulerStatusTone,
  titleCaseScheduler,
} from '../lib/scheduler-format';

function job(overrides: Partial<ScheduledJobRecord> = {}): ScheduledJobRecord {
  return {
    id: 'job-1',
    scope: 'global',
    name: 'Job',
    instructions: 'Run',
    targetKind: 'built_in_task',
    targetPayload: {},
    scheduleType: 'recurring',
    intervalMs: 86_400_000,
    timezone: 'UTC',
    status: 'enabled',
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    timeoutMs: 300_000,
    metadata: {},
    createdAtMs: 1,
    updatedAtMs: 1,
    ...overrides,
  };
}

describe('scheduler formatting helpers', () => {
  it('formats durations and schedule summaries', () => {
    expect(formatDuration(30 * 60_000)).toBe('30 min');
    expect(formatDuration(2 * 60 * 60_000)).toBe('2 hr');
    expect(formatDuration(2 * 24 * 60 * 60_000)).toBe('2 days');
    expect(formatSchedule(job())).toBe('Every 1 day');
    expect(formatSchedule(job({ intervalMs: undefined, cronExpression: '0 9 * * *' }))).toBe(
      'Cron 0 9 * * *',
    );
  });

  it('returns stable status tone classes and titles', () => {
    expect(schedulerStatusTone('enabled')).toContain('emerald');
    expect(schedulerStatusTone('paused')).toContain('amber');
    expect(schedulerRunTone('failed')).toContain('rose');
    expect(titleCaseScheduler('one_off')).toBe('One Off');
  });
});
