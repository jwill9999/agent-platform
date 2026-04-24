import { describe, expect, it } from 'vitest';

import { createObservabilityStore } from '../../plugin-observability/src/store.js';

import {
  OBSERVABILITY_IDS,
  OBSERVABILITY_TOOLS,
  executeObservabilityTool,
} from '../src/tools/observabilityTools.js';

describe('observability tools', () => {
  it('registers three zero-risk built-in tools without session parameters', () => {
    expect(OBSERVABILITY_TOOLS.map((tool) => tool.name)).toEqual([
      'query_logs',
      'query_recent_errors',
      'inspect_trace',
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
      expect(records.map((record) => record.event.kind).sort()).toEqual(['dod_check', 'error']);
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
});

function outputShapeHasTraceId(data: Record<string, unknown>): boolean {
  return data.traceId === 'trace-1';
}
