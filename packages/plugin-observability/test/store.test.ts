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

  it('stores sanitized sensor findings, provider state, MCP capabilities, and runtime limits', () => {
    const store = createObservabilityStore();
    const bearerSample = ['Bearer', 'abcdefghijklmnopqrstuvwxyz123456'].join(' ');
    const openAiKeySample = ['sk', 'proj', 'abcdefghijklmnopqrstuvwxyz123456'].join('-');

    vi.setSystemTime(new Date('2026-05-04T12:00:00.000Z'));
    store.record({
      kind: 'sensor_run',
      sessionId: 'session-1',
      runId: 'run-1',
      trigger: 'external_feedback',
      agentProfile: 'coding',
      taskContexts: ['repo_change'],
      records: [],
      providerAvailability: [
        {
          provider: 'sonarqube',
          capability: 'quality_findings',
          state: 'available',
          message: `Connected with ${bearerSample}`,
          repairActions: [],
        },
      ],
      runtimeLimitations: [
        {
          kind: 'sandbox_policy_denied',
          message: 'Cannot read /Users/alice/project/.scannerwork',
          repairActions: [],
          metadata: { credentialLabel: 'sample GitHub token placeholder' },
        },
      ],
      mcpCapabilities: [
        {
          serverId: 'sonarqube',
          capability: 'quality_findings',
          state: 'available',
          selectedForReflection: true,
        },
      ],
      results: [
        {
          sensorId: 'collector:sonarqube',
          status: 'failed',
          severity: 'high',
          summary: 'Imported finding from /Users/alice/project',
          findings: [
            {
              source: 'sonarqube_remote',
              severity: 'high',
              status: 'open',
              category: 'code_quality',
              message: `Fix duplicated code. ${openAiKeySample}`,
              file: '/Users/alice/project/src/foo.ts',
              line: 12,
              ruleId: 'typescript:S1192',
              dedupeKey: 'typescript:S1192:/Users/alice/project/src/foo.ts:12',
              evidence: [],
              metadata: {},
            },
          ],
          repairInstructions: [],
          evidence: [],
          terminalEvidence: [
            {
              source: 'ide_terminal_output',
              producer: 'sonarqube',
              capturedAtMs: 0,
              content: 'long terminal output '.repeat(200),
              sizeBytes: 4_000,
              maxBytes: 1_000,
              truncated: false,
              redacted: false,
              extractedFindingCount: 1,
            },
          ],
          runtimeLimitations: [],
          metadata: {},
        },
      ],
    });

    const findings = store.getSensorFindings({ sessionId: 'session-1', limit: 10 });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('[REDACTED:OpenAI API Key]');
    expect(findings[0]?.file).toBe('/Users/[REDACTED]/project/src/foo.ts');

    expect(store.getSensorProviderAvailability({ sessionId: 'session-1' })[0]).toMatchObject({
      provider: 'sonarqube',
      state: 'available',
    });
    expect(store.getSensorRuntimeLimitations({ sessionId: 'session-1' })[0]).toMatchObject({
      kind: 'sandbox_policy_denied',
      message: 'Cannot read /Users/[REDACTED]/project/.scannerwork',
    });
    expect(store.getMcpCapabilityAvailability({ sessionId: 'session-1' })[0]).toMatchObject({
      serverId: 'sonarqube',
      selectedForReflection: true,
    });
  });

  it('aggregates repeated sensor failure patterns into review-required candidates only', () => {
    const store = createObservabilityStore();

    for (const runId of ['run-1', 'run-2']) {
      store.record({
        kind: 'sensor_run',
        sessionId: 'session-1',
        runId,
        trigger: 'before_push',
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        records: [],
        providerAvailability: [],
        runtimeLimitations: [],
        mcpCapabilities: [],
        results: [
          {
            sensorId: 'quality_gate:typecheck',
            status: 'failed',
            severity: 'high',
            summary: 'typecheck failed',
            findings: [
              {
                source: 'local_command',
                severity: 'high',
                status: 'open',
                category: 'quality_gate',
                message: 'TS2322 type mismatch',
                file: 'src/foo.ts',
                line: 4,
                ruleId: 'TS2322',
                dedupeKey: 'TS2322:src/foo.ts:4',
                evidence: [],
                metadata: {},
              },
            ],
            repairInstructions: [],
            evidence: [],
            terminalEvidence: [],
            runtimeLimitations: [],
            metadata: {},
          },
        ],
      });
    }

    expect(store.getSensorFailurePatterns({ sessionId: 'session-1' })[0]).toMatchObject({
      sensorId: 'quality_gate:typecheck',
      count: 2,
      ruleId: 'TS2322',
    });
    expect(store.getFeedbackCandidates({ sessionId: 'session-1' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'memory_candidate',
          reviewRequired: true,
          autoApply: false,
        }),
        expect.objectContaining({
          kind: 'beads_issue_proposal',
          reviewRequired: true,
          autoApply: false,
        }),
      ]),
    );
  });
});
