import {
  DiagnosticPageSchema,
  DiagnosticPartialFailureSchema,
  DiagnosticReportSchema,
  type DiagnosticEvent,
  type DiagnosticPage,
  type DiagnosticPartialFailure,
  type DiagnosticReport,
} from './diagnostics.js';

function validateScopeAndOrder(
  page: Pick<DiagnosticPage, 'scope' | 'events' | 'snapshotSequence'>,
): void {
  let previous = 0;
  for (const { sequence, event } of page.events) {
    const matches =
      'requestId' in page.scope
        ? event.requestId === page.scope.requestId
        : event.sessionId === page.scope.sessionId &&
          (!page.scope.runId || event.runId === page.scope.runId);
    if (!matches || sequence <= previous || sequence > page.snapshotSequence)
      throw new Error('invalid_diagnostic_scope');
    previous = sequence;
  }
}

function renderSummary(report: DiagnosticReport): string {
  const lines = [
    'Local diagnostic report — safe technical metadata only.',
    `${report.events.length} observed events; durations can overlap and are not a summed total.`,
    'Absence of an event is not evidence that an action did not occur.',
    `Coverage: ${report.coverage.state}; ${report.coverage.pending} pending, ${report.coverage.dropped} dropped, ${report.coverage.conflicts} conflicts, ${report.coverage.pruned} pruned.`,
  ];
  const slowest = report.events
    .filter(
      ({ event }) => ['model', 'tool'].includes(event.phase) && event.durationMs !== undefined,
    )
    .sort(
      (left, right) =>
        right.event.durationMs! - left.event.durationMs! || left.sequence - right.sequence,
    )
    .slice(0, 5);
  for (const { sequence, event } of slowest)
    lines.push(
      `Slow observed step: ${event.phase}, ${event.durationMs!.toFixed(1)} ms (event ${sequence}).`,
    );
  lines.push(
    `${report.events.filter(({ event }) => event.outcome === 'failed').length} failure observations; these may describe the same underlying failure.`,
  );
  if (report.coverage.truncated)
    lines.push('History is truncated at the report limit; more events exist.');
  if (report.coverage.previousShutdownUnclean)
    lines.push('Previous shutdown was unclean; unacknowledged history may be missing.');
  if (report.coverage.unfinishedPriorProcess)
    lines.push(
      'Prior-process unfinished work has unknown status after restart; no replay is implied.',
    );
  for (const { sequence, event } of report.events) {
    lines.push(
      `${sequence}. ${event.phase}: ${event.outcome}${event.durationMs === undefined ? '' : ` (${event.durationMs.toFixed(1)} ms)`}${event.errorCode ? ` [${event.errorCode}]` : ''}; request ${event.requestId}${event.operationId ? `; operation ${event.operationId}` : ''}${event.attempt ? `; attempt ${event.attempt}` : ''}`,
    );
  }
  return lines.join('\n');
}

export function buildDiagnosticReport(
  input: DiagnosticPage,
  metadata: Pick<DiagnosticReport, 'appVersion' | 'platform'> = {},
): DiagnosticReport {
  const page = DiagnosticPageSchema.parse(input);
  validateScopeAndOrder(page);
  const lastOperations = new Map<string, DiagnosticEvent>();
  for (const { event } of page.events)
    lastOperations.set(event.operationId ?? event.requestId, event);
  const unfinishedPriorProcess = [...lastOperations.values()].some(
    (event) =>
      event.processInstanceId !== page.health.processInstanceId &&
      ['started', 'waiting', 'retrying'].includes(event.outcome),
  );
  const report = DiagnosticReportSchema.parse({
    schemaVersion: 1,
    source: 'local-store',
    scope: page.scope,
    summary: '',
    events: page.events,
    generatedAtMs: Date.now(),
    ...metadata,
    coverage: {
      durable: true,
      verified: true,
      truncated: page.truncated,
      snapshotSequence: page.snapshotSequence,
      earliestSequence: page.earliestSequence,
      dropped: page.health.dropped,
      conflicts: page.health.conflicts,
      pruned: page.health.pruned,
      pending: page.health.pending,
      previousShutdownUnclean: page.health.previousShutdownUnclean,
      state: page.health.state,
      reason: page.health.reason,
      lastAcknowledgedAtMs: page.health.lastAcknowledgedAtMs,
      unfinishedPriorProcess,
    },
  });
  report.summary = renderSummary(report);
  if (new TextEncoder().encode(JSON.stringify(report)).length > 5 * 1024 * 1024)
    throw new Error('diagnostic_report_limit');
  return report;
}

export function buildPartialDiagnosticReport(input: DiagnosticPartialFailure): DiagnosticReport {
  const failure = DiagnosticPartialFailureSchema.parse(input);
  return DiagnosticReportSchema.parse({
    schemaVersion: 1,
    source: 'current-view',
    scope: { requestId: failure.requestId },
    partialFailure: failure,
    summary: `Current-view diagnostic observation (unverified, non-durable).\n${failure.phase}: ${failure.errorCode}${failure.durationMs === undefined ? '' : ` (${failure.durationMs.toFixed(1)} ms)`}.\nBackend history is unavailable. This observation is lost when the view closes.`,
    events: [],
    generatedAtMs: failure.observedAtMs,
    coverage: {
      durable: false,
      verified: false,
      truncated: false,
      snapshotSequence: 0,
      earliestSequence: 0,
      dropped: 0,
      conflicts: 0,
      pruned: 0,
      pending: 0,
      previousShutdownUnclean: false,
      state: 'disabled',
      reason: 'storage_unavailable',
      lastAcknowledgedAtMs: null,
      unfinishedPriorProcess: false,
    },
  });
}

/** Rebuild all prose from allowlisted metadata at the final export trust boundary. */
export function projectDiagnosticReport(input: unknown): DiagnosticReport {
  const report = DiagnosticReportSchema.parse(input);
  if (report.source === 'current-view') {
    if (
      !report.partialFailure ||
      !('requestId' in report.scope) ||
      report.scope.requestId !== report.partialFailure.requestId
    )
      throw new Error('invalid_partial_report');
    return buildPartialDiagnosticReport(report.partialFailure);
  }
  if (report.partialFailure || !report.coverage.durable || !report.coverage.verified)
    throw new Error('invalid_diagnostic_source');
  validateScopeAndOrder({
    scope: report.scope,
    events: report.events,
    snapshotSequence: report.coverage.snapshotSequence,
  });
  report.summary = renderSummary(report);
  if (new TextEncoder().encode(JSON.stringify(report)).length > 5 * 1024 * 1024)
    throw new Error('diagnostic_report_limit');
  return report;
}
