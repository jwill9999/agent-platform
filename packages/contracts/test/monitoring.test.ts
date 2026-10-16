import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  MonitoringSampleSchema,
  MonitoringPreferenceInputSchema,
  MonitoringWindowInputSchema,
  MonitoringHealthSchema,
  projectMonitoringReport,
  type MonitoringReport,
  type MonitoringSample,
} from '../src/monitoring.js';
const id = randomUUID();
function sample(): MonitoringSample {
  return {
    schemaVersion: 1,
    sampleId: randomUUID(),
    processInstanceId: id,
    observedAtMs: 100,
    intervalMs: 30000,
    source: 'api_process_app_volume',
    cpuUserMicros: 1,
    cpuSystemMicros: 2,
    rssBytes: 30,
    eventLoopP95Ms: 1,
    eventLoopMaxMs: 2,
    activeRuns: null,
    admittedUnresolvedAttempts: null,
    sessionLockKeys: null,
    sessionLockWaiters: null,
    appVolumeFreeBytes: null,
    unavailableMetrics: [
      'active_runs',
      'admitted_unresolved_attempts',
      'session_lock_keys',
      'session_lock_waiters',
      'app_volume_disk',
    ],
  };
}
function report(): MonitoringReport {
  const health = {
    state: 'ready' as const,
    reason: 'none' as const,
    pending: 0,
    dropped: 0,
    conflicts: 0,
    pruned: 0,
    acknowledgedSequence: 1,
    lastAcknowledgedAtMs: 100,
    processInstanceId: id,
    previousShutdownUnclean: false,
  };
  return {
    schemaVersion: 1,
    generatedAtMs: 101,
    monitoring: {
      window: { fromMs: 90, toMs: 110 },
      samples: [{ sequence: 1, sample: sample() }],
      snapshotSequence: 1,
      earliestSequence: 1,
      truncated: false,
      completedCursor: 'signed-monitoring-completion',
      health: { ...health, preference: { samplingEnabled: true, retentionDays: 7, version: 1 } },
      coverage: {
        oldestObservedAtMs: 100,
        newestObservedAtMs: 100,
        historyMayBeMissing: false,
        gaps: 0,
      },
    },
    diagnostics: {
      window: { fromMs: 90, toMs: 110, sessionId: id },
      events: [
        {
          sequence: 1,
          event: {
            schemaVersion: 1,
            eventId: randomUUID(),
            requestId: randomUUID(),
            sessionId: id,
            processInstanceId: id,
            observedAtMs: 100,
            phase: 'request',
            outcome: 'succeeded',
          },
        },
      ],
      snapshotSequence: 1,
      earliestSequence: 1,
      truncated: false,
      completedCursor: 'signed-diagnostic-completion',
      health,
      coverage: {
        oldestObservedAtMs: 100,
        newestObservedAtMs: 100,
        historyMayBeMissing: false,
        gaps: 0,
      },
    },
    coverage: { separateSnapshots: true, incomplete: false },
    summary: 'UNTRUSTED SERVER CANARY',
  };
}
it('allows only fixed numerical measurements and explicit unavailable first CPU baseline', () => {
  const value = sample();
  expect(MonitoringSampleSchema.parse(value)).toEqual(value);
  for (const field of ['path', 'error', 'customLabels', 'prompt', 'headers'])
    expect(
      MonitoringSampleSchema.safeParse({ ...sample(), [field]: 'PRIVATE_CANARY' }).success,
    ).toBe(false);
  expect(MonitoringSampleSchema.safeParse({ ...sample(), rssBytes: -1 }).success).toBe(false);
  expect(MonitoringSampleSchema.safeParse({ ...sample(), eventLoopMaxMs: Infinity }).success).toBe(
    false,
  );
  expect(MonitoringSampleSchema.safeParse({ ...sample(), intervalMs: 0 }).success).toBe(false);
  expect(
    MonitoringSampleSchema.safeParse({
      ...sample(),
      intervalMs: 0,
      cpuUserMicros: null,
      cpuSystemMicros: null,
      unavailableMetrics: ['cpu_baseline'],
    }).success,
  ).toBe(true);
  expect(
    MonitoringSampleSchema.safeParse({ ...sample(), unavailableMetrics: ['cpu', 'cpu'] }).success,
  ).toBe(false);
});
it('requires explicit bounded preferences, UTC range and private session scope', () => {
  expect(
    MonitoringPreferenceInputSchema.parse({ samplingEnabled: false, retentionDays: 7 }),
  ).toEqual({ samplingEnabled: false, retentionDays: 7 });
  for (const retentionDays of [0, 91, 1.5])
    expect(
      MonitoringPreferenceInputSchema.safeParse({ samplingEnabled: true, retentionDays }).success,
    ).toBe(false);
  expect(MonitoringWindowInputSchema.safeParse({ window: { fromMs: 1, toMs: 1 } }).success).toBe(
    false,
  );
  expect(
    MonitoringWindowInputSchema.safeParse({ window: { fromMs: 1, toMs: 91 * 86400000 } }).success,
  ).toBe(false);
  expect(
    MonitoringWindowInputSchema.safeParse({
      window: { fromMs: 1, toMs: 2 },
      sessionId: 'path/to/session',
    }).success,
  ).toBe(false);
});
it('represents unknown durable preferences distinctly and regenerates the human summary', () => {
  const input = report();
  expect(
    MonitoringHealthSchema.parse({ ...input.monitoring.health, preference: null }).preference,
  ).toBeNull();
  const result = projectMonitoringReport(input, {
    window: { fromMs: 90, toMs: 110 },
    sessionId: id,
  });
  expect(result.summary).toContain('API-process');
  expect(result.summary).not.toContain('UNTRUSTED SERVER CANARY');
  expect(result.summary).toContain('not establish a cause');
  expect(result.coverage.incomplete).toBe(false);
});
it('rejects wellformed wrong-window and cross-session reports rather than exporting another scope', () => {
  for (const expected of [
    { window: { fromMs: 89, toMs: 110 }, sessionId: id },
    { window: { fromMs: 90, toMs: 110 }, sessionId: randomUUID() },
    { window: { fromMs: 90, toMs: 110 } },
  ])
    expect(() => projectMonitoringReport(report(), expected)).toThrow('invalid_monitoring_scope');
  const input = report();
  input.diagnostics.window.toMs = 111;
  expect(() => projectMonitoringReport(input)).toThrow('invalid_monitoring_window');
});
it('rejects replay-like pagination, descending sequences and out-of-window or cross-session rows', () => {
  const missing = report();
  delete missing.monitoring.completedCursor;
  expect(() => projectMonitoringReport(missing)).toThrow('invalid_monitoring_pagination');
  const doubled = report();
  doubled.monitoring.samples.push(doubled.monitoring.samples[0]!);
  expect(() => projectMonitoringReport(doubled)).toThrow('invalid_monitoring_window');
  const outside = report();
  outside.monitoring.samples[0]!.sample.observedAtMs = 110;
  expect(() => projectMonitoringReport(outside)).toThrow('invalid_monitoring_window');
  const cross = report();
  cross.diagnostics.events[0]!.event.sessionId = randomUUID();
  expect(() => projectMonitoringReport(cross)).toThrow('invalid_monitoring_scope');
});
it('never clears incomplete coverage when data are pending, lost, restarted or paginated', () => {
  for (const mutate of [
    (input: MonitoringReport) => {
      input.monitoring.health.pending = 1;
    },
    (input: MonitoringReport) => {
      input.diagnostics.health.dropped = 1;
    },
    (input: MonitoringReport) => {
      input.monitoring.health.previousShutdownUnclean = true;
    },
    (input: MonitoringReport) => {
      input.diagnostics.coverage.historyMayBeMissing = true;
    },
    (input: MonitoringReport) => {
      input.monitoring.truncated = true;
      input.monitoring.nextCursor = 'next';
      delete input.monitoring.completedCursor;
    },
  ]) {
    const input = report();
    mutate(input);
    expect(projectMonitoringReport(input).coverage.incomplete).toBe(true);
  }
});

it('explains missing cadence, unclean shutdown and per-store loss in readable output', () => {
  const input = report();
  input.monitoring.coverage.gaps = 2;
  input.monitoring.coverage.historyMayBeMissing = true;
  input.diagnostics.health.previousShutdownUnclean = true;
  input.diagnostics.health.dropped = 3;
  input.diagnostics.health.conflicts = 1;
  const result = projectMonitoringReport(input);
  expect(result.summary).toContain('gaps 2; history may be missing true');
  expect(result.summary).toContain('previous shutdown unclean true');
  expect(result.summary).toContain('dropped 3; conflicts 1');
});
