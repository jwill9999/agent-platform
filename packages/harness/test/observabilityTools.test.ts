import { describe, expect, it } from 'vitest';

import { createObservabilityStore } from '@agent-platform/plugin-observability';

import {
  OBSERVABILITY_IDS,
  OBSERVABILITY_TOOLS,
  executeObservabilityTool,
} from '../src/tools/observabilityTools.js';

describe('observability tools', () => {
  it('registers zero-risk built-in tools without session parameters', () => {
    expect(OBSERVABILITY_TOOLS.map((tool) => tool.name)).toEqual([
      'query_logs',
      'query_recent_errors',
      'inspect_trace',
      'query_sensor_findings',
      'query_sensor_provider_availability',
      'query_sensor_runtime_limitations',
      'query_mcp_capability_availability',
      'query_sensor_failure_patterns',
      'query_feedback_candidates',
    ]);

    for (const tool of OBSERVABILITY_TOOLS) {
      expect(tool.riskTier).toBe('zero');
      const inputSchema = tool.config?.inputSchema as { properties?: Record<string, unknown> };
      expect(inputSchema.properties).not.toHaveProperty('sessionId');
    }
  });

  it('queries logs for the bound session only and truncates the envelope', async () => {
    const store = createObservabilityStore();
    for (let index = 0; index < 80; index++) {
      store.record({
        kind: 'tool_call',
        sessionId: 'session-1',
        runId: 'trace-1',
        toolId: `tool-${index}`,
      });
    }
    store.record({
      kind: 'error',
      sessionId: 'session-2',
      runId: 'trace-2',
      phase: 'tool',
      message: 'other session',
    });

    const output = await executeObservabilityTool(
      OBSERVABILITY_IDS.queryLogs,
      { limit: 80 },
      { store, sessionId: 'session-1', traceId: 'trace-1' },
    );

    expect(output.type).toBe('tool_result');
    if (output.type === 'tool_result') {
      expect(output.data.total).toBe(80);
      expect(output.data.truncated).toBe(true);
      const records = output.data.records as Array<{ sessionId: string }>;
      expect(records.length).toBeLessThanOrEqual(50);
      expect(records.every((record) => record.sessionId === 'session-1')).toBe(true);
    }
  });

  it('returns recent errors including dod failures for the bound session', async () => {
    const store = createObservabilityStore();
    store.record({
      kind: 'dod_check',
      sessionId: 'session-1',
      runId: 'trace-1',
      passed: false,
      criteriaCount: 2,
      failedCriteriaCount: 1,
    });
    store.record({
      kind: 'error',
      sessionId: 'session-1',
      runId: 'trace-1',
      phase: 'tool',
      message: 'tool failed',
    });
    store.record({
      kind: 'error',
      sessionId: 'session-2',
      runId: 'trace-2',
      phase: 'tool',
      message: 'other session',
    });

    const output = await executeObservabilityTool(
      OBSERVABILITY_IDS.queryRecentErrors,
      { limit: 10 },
      { store, sessionId: 'session-1', traceId: 'trace-1' },
    );

    expect(output.type).toBe('tool_result');
    if (output.type === 'tool_result') {
      const records = output.data.records as Array<{ event: { kind: string } }>;
      expect(records).toHaveLength(2);
      expect(
        records.map((record) => record.event.kind).sort((left, right) => left.localeCompare(right)),
      ).toEqual(['dod_check', 'error']);
    }
  });

  it('inspects the current trace by default and rejects other-session trace ids', async () => {
    const store = createObservabilityStore();
    store.record({
      kind: 'task_start',
      sessionId: 'session-1',
      runId: 'trace-1',
      planId: 'plan-1',
      taskId: 'task-1',
      toolIds: [],
    });
    store.record({
      kind: 'tool_call',
      sessionId: 'session-1',
      runId: 'trace-1',
      toolId: 'sys_read_file',
    });
    store.record({
      kind: 'task_start',
      sessionId: 'session-2',
      runId: 'trace-2',
      planId: 'plan-2',
      taskId: 'task-2',
      toolIds: [],
    });

    const currentTrace = await executeObservabilityTool(
      OBSERVABILITY_IDS.inspectTrace,
      {},
      { store, sessionId: 'session-1', traceId: 'trace-1' },
    );
    expect(currentTrace.type).toBe('tool_result');
    if (currentTrace.type === 'tool_result') {
      expect(outputShapeHasTraceId(currentTrace.data)).toBe(true);
      const events = currentTrace.data.events as Array<{ sessionId: string }>;
      expect(events).toHaveLength(2);
      expect(events.every((event) => event.sessionId === 'session-1')).toBe(true);
    }

    const crossSessionTrace = await executeObservabilityTool(
      OBSERVABILITY_IDS.inspectTrace,
      { traceId: 'trace-2' },
      { store, sessionId: 'session-1', traceId: 'trace-1' },
    );
    expect(crossSessionTrace).toMatchObject({
      type: 'error',
      code: 'TRACE_NOT_FOUND',
    });
  });

  it('queries sensor findings, MCP capabilities, failure patterns, and feedback candidates', async () => {
    const store = createObservabilityStore();
    for (const runId of ['trace-1', 'trace-2']) {
      store.record({
        kind: 'sensor_run',
        sessionId: 'session-1',
        runId,
        trigger: 'before_push',
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        records: [],
        providerAvailability: [
          {
            provider: 'sonarqube',
            capability: 'quality_findings',
            state: 'available',
            repairActions: [],
          },
        ],
        runtimeLimitations: [
          {
            kind: 'sandbox_policy_denied',
            message: 'Sandbox blocked scanner metadata access.',
            repairActions: [],
            metadata: {},
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
            summary: 'Imported SonarQube finding.',
            findings: [
              {
                source: 'sonarqube_remote',
                severity: 'high',
                status: 'open',
                category: 'code_quality',
                message: 'Duplicated code block.',
                file: 'src/foo.ts',
                line: 9,
                ruleId: 'typescript:S1192',
                dedupeKey: 'typescript:S1192:src/foo.ts:9',
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

    const findings = await executeObservabilityTool(
      OBSERVABILITY_IDS.querySensorFindings,
      { limit: 10 },
      { store, sessionId: 'session-1', traceId: 'trace-2' },
    );
    expect(findings.type).toBe('tool_result');
    if (findings.type === 'tool_result') {
      expect(findings.data.total).toBe(2);
    }

    const mcp = await executeObservabilityTool(
      OBSERVABILITY_IDS.queryMcpCapabilityAvailability,
      {},
      { store, sessionId: 'session-1', traceId: 'trace-2' },
    );
    expect(mcp.type).toBe('tool_result');
    if (mcp.type === 'tool_result') {
      expect(mcp.data.records).toEqual([
        expect.objectContaining({ serverId: 'sonarqube', selectedForReflection: true }),
      ]);
    }

    const patterns = await executeObservabilityTool(
      OBSERVABILITY_IDS.querySensorFailurePatterns,
      {},
      { store, sessionId: 'session-1', traceId: 'trace-2' },
    );
    expect(patterns.type).toBe('tool_result');
    if (patterns.type === 'tool_result') {
      expect(patterns.data.records).toEqual([
        expect.objectContaining({ sensorId: 'collector:sonarqube', count: 2 }),
      ]);
    }

    const candidates = await executeObservabilityTool(
      OBSERVABILITY_IDS.queryFeedbackCandidates,
      {},
      { store, sessionId: 'session-1', traceId: 'trace-2' },
    );
    expect(candidates.type).toBe('tool_result');
    if (candidates.type === 'tool_result') {
      expect(candidates.data.records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reviewRequired: true, autoApply: false }),
        ]),
      );
    }
  });
});

function outputShapeHasTraceId(data: Record<string, unknown>): boolean {
  return data.traceId === 'trace-1';
}
