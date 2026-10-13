import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DiagnosticEventSchema,
  DiagnosticPartialFailureSchema,
  type DiagnosticEvent,
  type DiagnosticPage,
} from '../src/diagnostics.js';
import {
  buildDiagnosticReport,
  buildPartialDiagnosticReport,
  projectDiagnosticReport,
} from '../src/diagnosticReport.js';
const processInstanceId = randomUUID();
const requestId = randomUUID();
function page(): DiagnosticPage {
  return {
    scope: { requestId },
    snapshotSequence: 1,
    earliestSequence: 1,
    truncated: false,
    events: [
      {
        sequence: 1,
        event: {
          schemaVersion: 1,
          eventId: randomUUID(),
          processInstanceId,
          requestId,
          phase: 'model',
          outcome: 'failed',
          observedAtMs: Date.now(),
          durationMs: 25,
          errorCode: 'provider_error',
        },
      },
    ],
    health: {
      state: 'ready',
      reason: 'none',
      pending: 0,
      dropped: 0,
      conflicts: 0,
      pruned: 0,
      acknowledgedSequence: 1,
      lastAcknowledgedAtMs: Date.now(),
      processInstanceId,
      previousShutdownUnclean: false,
    },
  };
}
describe('strict diagnostic envelopes and support reports', () => {
  it.each(['prompt', 'args', 'result', 'message', 'stack', 'path', 'apiKey', 'headers', 'url'])(
    'rejects unknown payload field %s before sinks',
    (field) => {
      expect(
        DiagnosticEventSchema.safeParse({ ...page().events[0]!.event, [field]: 'sensitive-canary' })
          .success,
      ).toBe(false);
    },
  );
  it('rejects arbitrary external identifiers and non-finite counters', () => {
    const event = page().events[0]!.event;
    expect(
      DiagnosticEventSchema.safeParse({ ...event, toolExecutionId: 'call_provider-secret' })
        .success,
    ).toBe(false);
    expect(DiagnosticEventSchema.safeParse({ ...event, toolId: '/private/command' }).success).toBe(
      false,
    );
    expect(
      DiagnosticEventSchema.safeParse({ ...event, provider: 'https://secret.example' }).success,
    ).toBe(false);
    expect(DiagnosticEventSchema.safeParse({ ...event, durationMs: Infinity }).success).toBe(false);
  });
  it('builds readable evidence and replaces untrusted summary on re-projection', () => {
    const report = buildDiagnosticReport(page());
    expect(report.summary).toContain('model: failed (25.0 ms) [provider_error]');
    report.summary = 'CANARY arbitrary secret from upstream';
    expect(JSON.stringify(projectDiagnosticReport(report))).not.toContain('CANARY');
  });
  it('rejects cross-scope records and non-increasing/out-of-window sequence', () => {
    const input = page();
    expect(() => buildDiagnosticReport({ ...input, scope: { requestId: randomUUID() } })).toThrow(
      'invalid_diagnostic_scope',
    );
    expect(() =>
      buildDiagnosticReport({ ...input, events: [...input.events, ...input.events] }),
    ).toThrow('invalid_diagnostic_scope');
    expect(() => buildDiagnosticReport({ ...input, snapshotSequence: 0 })).toThrow(
      'invalid_diagnostic_scope',
    );
    const sessionId = randomUUID();
    const runId = randomUUID();
    input.scope = { sessionId, runId };
    input.events[0]!.event = { ...input.events[0]!.event, sessionId, runId: randomUUID() };
    expect(() => buildDiagnosticReport(input)).toThrow('invalid_diagnostic_scope');
  });
  it('labels unfinished prior-process evidence as unknown while preserving actual waiting state', () => {
    const input = page();
    input.events[0]!.event.outcome = 'waiting';
    expect(buildDiagnosticReport(input).coverage.unfinishedPriorProcess).toBe(false);
    input.health.processInstanceId = randomUUID();
    const report = buildDiagnosticReport(input);
    expect(report.coverage.unfinishedPriorProcess).toBe(true);
    expect(report.summary).toContain('unknown status after restart');
    expect(report.events[0]!.event.outcome).toBe('waiting');
  });
  it('makes current-view report explicitly non-durable and rebuilds only strict partial input', () => {
    const failure = {
      requestId,
      observedAtMs: Date.now(),
      phase: 'connection' as const,
      errorCode: 'backend_unavailable' as const,
    };
    expect(
      DiagnosticPartialFailureSchema.safeParse({ ...failure, sessionId: randomUUID() }).success,
    ).toBe(false);
    const report = buildPartialDiagnosticReport(failure);
    expect(report.coverage).toMatchObject({ durable: false, verified: false });
    expect(projectDiagnosticReport({ ...report, summary: 'secret' }).summary).not.toContain(
      'secret',
    );
    expect(() =>
      projectDiagnosticReport({ ...report, scope: { requestId: randomUUID() } }),
    ).toThrow('invalid_partial_report');
  });
  it('records measured slow steps without inventing token counts or summing overlaps', () => {
    const input = page();
    const event: DiagnosticEvent = input.events[0]!.event;
    expect(event.inputTokens).toBeUndefined();
    expect(buildDiagnosticReport(input).summary).toContain('not a summed total');
  });
  it('accepts persisted UUID approval links while rejecting external free-form IDs', () => {
    const original = page().events[0]!.event;
    expect(
      DiagnosticEventSchema.safeParse({
        ...original,
        approvalRequestId: randomUUID(),
        linkedRunId: randomUUID(),
      }).success,
    ).toBe(true);
    expect(
      DiagnosticEventSchema.safeParse({
        ...original,
        linkedRunId: 'external-provider-private-link',
      }).success,
    ).toBe(false);
  });
});
