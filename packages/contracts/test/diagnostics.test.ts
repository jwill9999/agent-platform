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

describe('context decision compatibility and privacy', () => {
  const decision = {
    estimatorVersion: 'serialized_request_chars_v1' as const,
    effectivePolicy: 'group_window_working_memory_v1' as const,
    requestedStrategy: 'summarize' as const,
    configuredInputTokens: 8000,
    effectiveInputTokens: 7200,
    estimatedInputBefore: 9200,
    estimatedInputAfter: 6900,
    schemaEstimate: 300,
    includedGroups: 3,
    omittedGroups: 2,
    outputCap: 2048,
    reason: 'windowed' as const,
  };
  it('reads old V1 events and strictly projects additive local estimates separately from usage', () => {
    const old = page();
    expect(DiagnosticEventSchema.parse(old.events[0]!.event).contextDecision).toBeUndefined();
    old.events[0]!.event = {
      ...old.events[0]!.event,
      phase: 'context',
      outcome: 'succeeded',
      contextDecision: decision,
    };
    const report = projectDiagnosticReport(buildDiagnosticReport(old));
    expect(report.schemaVersion).toBe(1);
    expect(report.summary).toContain('estimated input 9200 -> 6900');
    expect(report.summary).toContain('this decision is not a provider attempt');
    expect(report.summary).toContain(
      'requested summarize, effective group_window_working_memory_v1',
    );
    expect(report.summary).not.toContain('provider-reported input/output');
    old.events[0]!.event = { ...page().events[0]!.event, inputTokens: 123, outputTokens: 4 };
    expect(buildDiagnosticReport(old).summary).toContain('provider-reported input/output 123/4');
  });
  it.each(['prompt', 'memory', 'args', 'result', 'apiKey', 'path', 'contentHash', 'toolName'])(
    'rejects unapproved nested context field %s',
    (key) => {
      expect(
        DiagnosticEventSchema.safeParse({
          ...page().events[0]!.event,
          contextDecision: { ...decision, [key]: 'SECRET-CANARY' },
        }).success,
      ).toBe(false);
    },
  );
  it('rejects invalid counters and arbitrary decision/policy versions', () => {
    for (const value of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        DiagnosticEventSchema.safeParse({
          ...page().events[0]!.event,
          contextDecision: { ...decision, schemaEstimate: value },
        }).success,
      ).toBe(false);
    }
    for (const key of ['reason', 'effectivePolicy', 'estimatorVersion', 'requestedStrategy']) {
      expect(
        DiagnosticEventSchema.safeParse({
          ...page().events[0]!.event,
          contextDecision: { ...decision, [key]: 'SECRET-CANARY' },
        }).success,
      ).toBe(false);
    }
  });
  it('keeps explicit degraded/truncated/dropped coverage alongside a local rejection', () => {
    const input = page();
    input.truncated = true;
    input.health = { ...input.health, state: 'degraded', reason: 'queue_full', dropped: 2 };
    input.events[0]!.event = {
      ...input.events[0]!.event,
      phase: 'context',
      outcome: 'failed',
      errorCode: 'context_budget_exceeded',
      contextDecision: { ...decision, reason: 'required_overflow' },
    };
    const report = projectDiagnosticReport(buildDiagnosticReport(input));
    expect(report.coverage).toMatchObject({ state: 'degraded', dropped: 2, truncated: true });
    expect(report.summary).toContain('local context admission required_overflow');
    expect(report.summary).toContain('2 dropped');
    expect(report.summary).toContain('History is truncated');
  });
  it('fails closed rather than returning a summary outside the existing report bound', () => {
    const input = page();
    const large = Object.fromEntries(
      [
        'configuredInputTokens',
        'effectiveInputTokens',
        'estimatedInputBefore',
        'estimatedInputAfter',
        'schemaEstimate',
        'includedGroups',
        'omittedGroups',
        'outputCap',
      ].map((key) => [key, Number.MAX_SAFE_INTEGER]),
    );
    input.events = Array.from({ length: 1000 }, (_, index) => ({
      sequence: index + 1,
      event: {
        ...input.events[0]!.event,
        eventId: randomUUID(),
        operationId: randomUUID(),
        phase: 'context' as const,
        contextDecision: { ...decision, ...large, reason: 'required_overflow' as const },
      },
    }));
    input.snapshotSequence = 1000;
    expect(() => buildDiagnosticReport(input)).toThrow('diagnostic_report_limit');
  });
});
