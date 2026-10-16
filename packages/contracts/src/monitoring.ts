import { z } from 'zod';
import {
  DiagnosticHealthSchema,
  DiagnosticWindowPageSchema,
  type DiagnosticWindowPage,
} from './diagnostics.js';
import { renderDiagnosticObservation } from './diagnosticReport.js';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const measurement = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const MonitoringPreferenceInputSchema = z
  .object({
    samplingEnabled: z.boolean(),
    retentionDays: z.number().int().min(1).max(90),
  })
  .strict();
export const MonitoringPreferenceSchema = MonitoringPreferenceInputSchema.extend({
  version: count.min(1),
});
export type MonitoringPreference = z.infer<typeof MonitoringPreferenceSchema>;
export const MonitoringUnavailableMetricSchema = z.enum([
  'cpu_baseline',
  'cpu',
  'rss',
  'event_loop',
  'session_lock_keys',
  'session_lock_waiters',
  'active_runs',
  'admitted_unresolved_attempts',
  'app_volume_disk',
]);
/** Fixed numerical API-process/app-volume observations; no arbitrary labels or payloads. */
export const MonitoringSampleSchema = z
  .object({
    schemaVersion: z.literal(1),
    sampleId: z.string().uuid(),
    processInstanceId: z.string().uuid(),
    observedAtMs: count,
    intervalMs: measurement,
    source: z.literal('api_process_app_volume'),
    appVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/)
      .max(64)
      .optional(),
    cpuUserMicros: count.nullable(),
    cpuSystemMicros: count.nullable(),
    rssBytes: count.nullable(),
    eventLoopP95Ms: measurement.nullable(),
    eventLoopMaxMs: measurement.nullable(),
    activeRuns: count.nullable(),
    admittedUnresolvedAttempts: count.nullable(),
    sessionLockKeys: count.nullable(),
    sessionLockWaiters: count.nullable(),
    appVolumeFreeBytes: count.nullable(),
    unavailableMetrics: z.array(MonitoringUnavailableMetricSchema).max(9),
  })
  .strict()
  .superRefine((sample, context) => {
    if (
      sample.intervalMs === 0 &&
      (sample.cpuUserMicros !== null ||
        sample.cpuSystemMicros !== null ||
        !sample.unavailableMetrics.includes('cpu_baseline'))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A first CPU observation requires an explicit unavailable baseline.',
      });
    if (new Set(sample.unavailableMetrics).size !== sample.unavailableMetrics.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unavailable metric codes must be unique.',
      });
  });
export type MonitoringSample = z.infer<typeof MonitoringSampleSchema>;
export const MonitoringHealthSchema = DiagnosticHealthSchema.extend({
  reason: z.enum([
    'none',
    'invalid_configuration',
    'storage_unavailable',
    'schema_incompatible',
    'queue_full',
    'conflict',
    'invalid_sample',
    'read_timeout',
    'storage_limited',
    'shutdown_timeout',
  ]),
  preference: MonitoringPreferenceSchema.nullable(),
});
export type MonitoringHealth = z.infer<typeof MonitoringHealthSchema>;
export const MonitoringWindowSchema = z
  .object({ fromMs: count, toMs: count })
  .strict()
  .refine(
    (window) => window.toMs > window.fromMs && window.toMs - window.fromMs <= 90 * 86400000,
    'Window must be positive and at most 90 days.',
  );
export type MonitoringWindow = z.infer<typeof MonitoringWindowSchema>;
export const MonitoringStoredSampleSchema = z
  .object({ sequence: count.min(1), sample: MonitoringSampleSchema })
  .strict();
export const MonitoringPageSchema = z
  .object({
    window: MonitoringWindowSchema,
    samples: z.array(MonitoringStoredSampleSchema).max(1000),
    snapshotSequence: count,
    earliestSequence: count,
    nextCursor: z.string().min(1).max(2048).optional(),
    completedCursor: z.string().min(1).max(2048).optional(),
    truncated: z.boolean(),
    health: MonitoringHealthSchema,
    coverage: z
      .object({
        oldestObservedAtMs: count.nullable(),
        newestObservedAtMs: count.nullable(),
        historyMayBeMissing: z.boolean(),
        gaps: count,
      })
      .strict(),
  })
  .strict();
export type MonitoringPage = z.infer<typeof MonitoringPageSchema>;
export const MonitoringStatusSchema = z
  .object({ monitoring: MonitoringHealthSchema, diagnostics: DiagnosticHealthSchema })
  .strict();
export type MonitoringStatus = z.infer<typeof MonitoringStatusSchema>;
export const MonitoringPreferenceResultSchema = z
  .object({ preference: MonitoringPreferenceSchema, health: MonitoringHealthSchema })
  .strict();
export const MonitoringWindowInputSchema = z
  .object({
    window: MonitoringWindowSchema,
    sessionId: z.string().uuid().optional(),
    monitoringCursor: z.string().min(1).max(2048).optional(),
    diagnosticCursor: z.string().min(1).max(2048).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  })
  .strict();
export type MonitoringWindowInput = z.infer<typeof MonitoringWindowInputSchema>;
export const MonitoringReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAtMs: count,
    monitoring: MonitoringPageSchema,
    diagnostics: DiagnosticWindowPageSchema,
    coverage: z.object({ separateSnapshots: z.literal(true), incomplete: z.boolean() }).strict(),
    summary: z.string().max(500000).default(''),
  })
  .strict();
export type MonitoringReport = z.infer<typeof MonitoringReportSchema>;

export interface MonitoringStore {
  readonly ready: Promise<void>;
  record(sample: unknown): boolean;
  flush(): Promise<void>;
  preference(): Promise<MonitoringPreference>;
  setPreference(
    input: z.infer<typeof MonitoringPreferenceInputSchema>,
  ): Promise<MonitoringPreference>;
  queryWindow(
    window: MonitoringWindow,
    options?: { cursor?: string; limit?: number },
  ): Promise<MonitoringPage>;
  prune(): Promise<void>;
  health(): MonitoringHealth;
  close(): Promise<void>;
}
function validatePage(page: MonitoringPage | DiagnosticWindowPage): void {
  if (
    page.truncated
      ? !page.nextCursor || !!page.completedCursor
      : !!page.nextCursor || !page.completedCursor
  )
    throw new Error('invalid_monitoring_pagination');
  let previous = 0;
  const records =
    'samples' in page
      ? page.samples.map(({ sequence, sample }) => ({ sequence, event: sample }))
      : page.events;
  for (const { sequence, event } of records) {
    if (
      sequence <= previous ||
      sequence > page.snapshotSequence ||
      event.observedAtMs < page.window.fromMs ||
      event.observedAtMs >= page.window.toMs
    )
      throw new Error('invalid_monitoring_window');
    if (
      'sessionId' in page.window &&
      page.window.sessionId &&
      (!('sessionId' in event) || event.sessionId !== page.window.sessionId)
    )
      throw new Error('invalid_monitoring_scope');
    previous = sequence;
  }
}
/** Generate all readable prose from strict safe metadata, never a server-provided summary. */
export function renderMonitoringReport(report: MonitoringReport): string {
  const lines = [
    'Local monitoring history — safe technical metadata only.',
    `UTC window: ${report.monitoring.window.fromMs} to ${report.monitoring.window.toMs} (exclusive).`,
    `Independent snapshots: samples ${report.monitoring.snapshotSequence}; events ${report.diagnostics.snapshotSequence}. No atomic cross-database snapshot is claimed.`,
    `Coverage: ${report.coverage.incomplete ? 'incomplete' : 'recorded page'}; samples ${report.monitoring.samples.length}, events ${report.diagnostics.events.length}.`,
    `Sampling: ${report.monitoring.health.preference?.samplingEnabled === true ? 'enabled' : report.monitoring.health.preference ? 'disabled' : 'unknown'}; state ${report.monitoring.health.state}; reason ${report.monitoring.health.reason}; pending ${report.monitoring.health.pending}; dropped ${report.monitoring.health.dropped}; pruned ${report.monitoring.health.pruned}.`,
    'CPU is API-process user/system microseconds over each monotonic interval; RSS/disk are bytes and event-loop values milliseconds. Child/provider/container/host totals are not implied.',
    'Observations can identify suspect intervals, not establish a cause. Missing data does not prove an action was absent.',
    'Retention is bounded by age, 25,000 rows and physical storage. At 30-second intervals the row cap holds about 8.68 days; a 90-day age setting is not a 90-day coverage guarantee.',
  ];
  for (const [name, page] of [
    ['samples', report.monitoring],
    ['events', report.diagnostics],
  ] as const) {
    lines.push(
      `${name} coverage: oldest/newest ${page.coverage.oldestObservedAtMs ?? 'unknown'}/${page.coverage.newestObservedAtMs ?? 'unknown'} ms; gaps ${page.coverage.gaps}; history may be missing ${page.coverage.historyMayBeMissing}; previous shutdown unclean ${page.health.previousShutdownUnclean}.`,
    );
    lines.push(
      `${name} health: state ${page.health.state}; reason ${page.health.reason}; pending ${page.health.pending}; dropped ${page.health.dropped}; conflicts ${page.health.conflicts}; pruned ${page.health.pruned}; last durable acknowledgement ${page.health.lastAcknowledgedAtMs ?? 'unknown'} ms.`,
    );
  }
  for (const { sequence, sample } of report.monitoring.samples)
    lines.push(
      `${sequence}. sample ${sample.observedAtMs}; interval ${sample.intervalMs} ms; CPU user/system ${sample.cpuUserMicros ?? 'unknown'}/${sample.cpuSystemMicros ?? 'unknown'} us; RSS ${sample.rssBytes ?? 'unknown'} bytes; event-loop p95/max ${sample.eventLoopP95Ms ?? 'unknown'}/${sample.eventLoopMaxMs ?? 'unknown'} ms; owned runs/unresolved ${sample.activeRuns ?? 'unknown'}/${sample.admittedUnresolvedAttempts ?? 'unknown'}; lock keys/waiters ${sample.sessionLockKeys ?? 'unknown'}/${sample.sessionLockWaiters ?? 'unknown'}; free app-volume ${sample.appVolumeFreeBytes ?? 'unknown'} bytes; unavailable ${sample.unavailableMetrics.join(',') || 'none'}.`,
    );
  for (const { sequence, event } of report.diagnostics.events)
    lines.push(renderDiagnosticObservation(sequence, event));
  return lines.join('\n');
}
export function projectMonitoringReport(
  input: unknown,
  expectedInput?: MonitoringWindowInput,
): MonitoringReport {
  const report = MonitoringReportSchema.parse(input);
  if (
    report.monitoring.window.fromMs !== report.diagnostics.window.fromMs ||
    report.monitoring.window.toMs !== report.diagnostics.window.toMs
  )
    throw new Error('invalid_monitoring_window');
  if (expectedInput) {
    const expected = MonitoringWindowInputSchema.parse(expectedInput);
    if (
      report.monitoring.window.fromMs !== expected.window.fromMs ||
      report.monitoring.window.toMs !== expected.window.toMs ||
      report.diagnostics.window.sessionId !== expected.sessionId
    )
      throw new Error('invalid_monitoring_scope');
  }
  validatePage(report.monitoring);
  validatePage(report.diagnostics);
  report.coverage.incomplete =
    report.coverage.incomplete ||
    [report.monitoring, report.diagnostics].some(
      (page) =>
        page.truncated ||
        page.coverage.historyMayBeMissing ||
        page.health.state !== 'ready' ||
        page.health.pending > 0 ||
        page.health.dropped > 0 ||
        page.health.conflicts > 0 ||
        page.health.previousShutdownUnclean,
    );
  report.summary = renderMonitoringReport(report);
  if (
    report.summary.length > 500000 ||
    new TextEncoder().encode(JSON.stringify(report)).length > 5 * 1024 * 1024
  )
    throw new Error('monitoring_report_limit');
  return report;
}
