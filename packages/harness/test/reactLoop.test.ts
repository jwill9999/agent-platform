import { describe, expect, it, vi } from 'vitest';
import type { ExecutionLimits } from '@agent-platform/contracts';
import {
  buildHarnessGraph,
  createCriticNode,
  createDodCheckNode,
  createDodProposeNode,
  createSensorCheckNode,
  type GraphNodeFn,
  type SensorRunner,
} from '../src/index.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { LlmOutput, ChatMessage } from '../src/types.js';
import { captureEmitter, createIncrementingTextNode } from './testUtils.js';

const limits: ExecutionLimits = {
  maxSteps: 10,
  maxParallelTasks: 2,
  timeoutMs: 60_000,
};

function makeInitialState(overrides?: Partial<HarnessStateType>): Record<string, unknown> {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits,
    runId: 'run-react',
    halted: false,
    mode: 'react',
    messages: [],
    toolDefinitions: [],
    llmOutput: null,
    modelConfig: null,
    stepCount: 0,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    totalToolCalls: 0,
    loadedSkillIds: [],
    totalRetries: 0,
    startedAtMs: 0,
    deadlineMs: limits.timeoutMs,
    sensorResults: [],
    sensorAttempts: {},
    sensorLastToolIds: [],
    sensorRequestedTrigger: undefined,
    sensorAgentProfile: 'coding',
    sensorTaskContexts: ['repo_change'],
    sensorChangedFiles: ['packages/harness/src/foo.ts'],
    ...overrides,
  };
}

function passingSensorRunner(calls: Array<Record<string, unknown>>): SensorRunner {
  return async (input) => {
    calls.push(input as unknown as Record<string, unknown>);
    return {
      results: [
        {
          sensorId: 'quality_gate:typecheck',
          status: 'passed',
          summary: 'typecheck passed',
          findings: [],
          repairInstructions: [],
          evidence: [],
          terminalEvidence: [],
          runtimeLimitations: [],
          metadata: {},
        },
      ],
      records: [
        {
          id: `quality_gate:typecheck:${input.trigger}`,
          sensorId: 'quality_gate:typecheck',
          trigger: input.trigger,
          selectedForProfile: input.agentProfile,
          selectionState: input.trigger === 'before_push' ? 'required' : 'optional',
          status: 'completed',
          startedAtMs: 0,
          completedAtMs: 1,
          metadata: {},
        },
      ],
    };
  };
}

function assistantText(content: string): Partial<HarnessStateType> {
  return {
    llmOutput: { kind: 'text', content } as LlmOutput,
    messages: [{ role: 'assistant', content }] as ChatMessage[],
  };
}

function assistantToolCall(
  id: string,
  name: string,
  args: Record<string, unknown>,
): Partial<HarnessStateType> {
  return {
    llmOutput: {
      kind: 'tool_calls',
      calls: [{ id, name, args }],
    } as LlmOutput,
    messages: [
      { role: 'assistant', content: '', toolCalls: [{ id, name, args }] },
    ] as ChatMessage[],
  };
}

function toolResult(
  toolCallId: string,
  toolName: string,
  content: string,
): Partial<HarnessStateType> {
  return {
    llmOutput: null,
    messages: [{ role: 'tool', toolCallId, toolName, content }] as ChatMessage[],
  };
}

function failedSensorRun(options: {
  sensorId: string;
  trigger: 'before_push' | 'external_feedback';
  selectionState: 'required' | 'optional';
  summary: string;
  source: 'local_command' | 'github_pr_review';
  severity: 'high' | 'medium';
  category: 'quality_gate' | 'code_quality';
  message: string;
  repairSummary: string;
}) {
  return {
    results: [
      {
        sensorId: options.sensorId,
        status: 'failed',
        summary: options.summary,
        findings: [
          {
            source: options.source,
            severity: options.severity,
            status: 'open',
            category: options.category,
            message: options.message,
            evidence: [],
            metadata: {},
          },
        ],
        repairInstructions: [{ summary: options.repairSummary, actions: [] }],
        evidence: [],
        terminalEvidence: [],
        runtimeLimitations: [],
        metadata: {},
      },
    ],
    records: [
      {
        id: `${options.sensorId}:${options.trigger}`,
        sensorId: options.sensorId,
        trigger: options.trigger,
        selectedForProfile: 'coding',
        selectionState: options.selectionState,
        status: 'completed',
        startedAtMs: 0,
        completedAtMs: 1,
        metadata: {},
      },
    ],
  };
}

describe('ReAct loop', () => {
  it('completes when LLM returns text (no tool calls)', async () => {
    const llmNode: GraphNodeFn = vi.fn(async () => assistantText('Done!'));
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
    });

    const out = await graph.invoke(makeInitialState(), {
      configurable: { thread_id: 'react-text-1' },
    });

    expect(llmNode).toHaveBeenCalledTimes(1);
    expect(toolNode).not.toHaveBeenCalled();
    expect(out.stepCount).toBe(1);
    expect(out.trace.some((e: { type: string }) => e.type === 'graph_start')).toBe(true);
  });

  it('loops: LLM→tool→LLM→text', async () => {
    let llmCallCount = 0;
    const llmNode: GraphNodeFn = vi.fn(async () => {
      llmCallCount++;
      if (llmCallCount === 1) {
        return assistantToolCall('tc1', 'echo', { text: 'hi' });
      }
      return assistantText('All done');
    });

    const toolNode: GraphNodeFn = vi.fn(async () => ({
      ...toolResult('tc1', 'echo', '"hi"'),
      trace: [{ type: 'tool_dispatch' as const, toolId: 'echo', step: 0, ok: true }],
    }));

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
    });

    const out = await graph.invoke(makeInitialState(), {
      configurable: { thread_id: 'react-loop-1' },
    });

    expect(llmNode).toHaveBeenCalledTimes(2);
    expect(toolNode).toHaveBeenCalledTimes(1);
    expect(out.stepCount).toBe(2);
  });

  it('halts at maxSteps', async () => {
    const llmNode: GraphNodeFn = vi.fn(async () => assistantToolCall('tc', 'tool-a', {}));

    const toolNode: GraphNodeFn = vi.fn(async () => toolResult('tc', 'tool-a', '{}'));

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
    });

    const out = await graph.invoke(makeInitialState({ limits: { ...limits, maxSteps: 3 } }), {
      configurable: { thread_id: 'react-maxsteps-1' },
    });

    // LLM called 3 times (steps 1,2,3), then route_after_dispatch sees stepCount=3 >= maxSteps=3 → END
    expect(llmNode).toHaveBeenCalledTimes(3);
    expect(out.stepCount).toBe(3);
  });

  it('detects loop when same tool+args called 3 times consecutively', async () => {
    const llmNode: GraphNodeFn = vi.fn(async () => assistantToolCall('tc', 'stuck-tool', { x: 1 }));

    const toolNode: GraphNodeFn = vi.fn(async () => toolResult('tc', 'stuck-tool', '"same"'));

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
    });

    const out = await graph.invoke(makeInitialState({ limits: { ...limits, maxSteps: 100 } }), {
      configurable: { thread_id: 'react-loop-detect-1' },
    });

    expect(out.halted).toBe(true);
    expect(out.trace.some((e: { type: string }) => e.type === 'loop_detected')).toBe(true);
    // Should stop at 3 steps (the loop is detected after 3rd tool dispatch)
    expect(llmNode).toHaveBeenCalledTimes(3);
  });

  it('does not trigger loop detection with varying args', async () => {
    let callIdx = 0;
    const llmNode: GraphNodeFn = vi.fn(async () => {
      callIdx++;
      if (callIdx <= 3) {
        return assistantToolCall(`tc${callIdx}`, 'tool', { i: callIdx });
      }
      return assistantText('done');
    });

    const toolNode: GraphNodeFn = vi.fn(async () => toolResult('tc', 'tool', '"ok"'));

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
    });

    const out = await graph.invoke(makeInitialState(), {
      configurable: { thread_id: 'react-no-loop-1' },
    });

    expect(out.halted).toBeFalsy();
    expect(out.trace.some((e: { type: string }) => e.type === 'loop_detected')).toBe(false);
    expect(llmNode).toHaveBeenCalledTimes(4);
  });

  it('plan mode still works with mode router', async () => {
    const llmNode: GraphNodeFn = vi.fn(async () => ({}));
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));
    const exec = vi.fn(async () => ({ ok: true }));

    const graph = buildHarnessGraph({
      executeTool: exec,
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      stubPlan: {
        id: 'sp1',
        tasks: [{ id: 't1', description: 'task one', toolIds: ['a'] }],
      },
    });

    const out = await graph.invoke(makeInitialState({ mode: 'plan' }), {
      configurable: { thread_id: 'react-plan-mode-1' },
    });

    expect(llmNode).not.toHaveBeenCalled();
    expect(toolNode).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledTimes(1);
    expect(out.trace.some((e: { type: string }) => e.type === 'plan_ready')).toBe(true);
  });

  it('runs targeted sensors after code edits and required sensors before completion', async () => {
    const sensorCalls: Array<Record<string, unknown>> = [];
    let llmCallCount = 0;
    const llmNode: GraphNodeFn = vi.fn(async () => {
      llmCallCount++;
      if (llmCallCount === 1) {
        return assistantToolCall('edit-1', 'coding_apply_patch', { operations: [] });
      }
      return assistantText('Done');
    });
    const toolNode: GraphNodeFn = vi.fn(async () =>
      toolResult('edit-1', 'coding_apply_patch', '{}'),
    );

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      sensorCheckNode: createSensorCheckNode({ runSensors: passingSensorRunner(sensorCalls) }),
    });

    const out = await graph.invoke(makeInitialState(), {
      configurable: { thread_id: 'react-sensors-code-edit' },
    });

    expect(sensorCalls.map((call) => call['trigger'])).toEqual([
      'on_meaningful_change',
      'before_push',
    ]);
    expect(sensorCalls[0]?.['executionLimits']).toMatchObject({ maxSensors: 1 });
    expect(out.trace.filter((event: { type: string }) => event.type === 'sensor_run')).toHaveLength(
      2,
    );
  });

  it('ends after a text answer when no sensors are selected', async () => {
    const llmNode: GraphNodeFn = vi.fn(async () => assistantText('Done'));
    const sensorRunner: SensorRunner = vi.fn(async () => ({ records: [], results: [] }));
    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: vi.fn(async () => ({})),
      sensorCheckNode: createSensorCheckNode({ runSensors: sensorRunner }),
    });

    const out = await graph.invoke(makeInitialState(), {
      configurable: { thread_id: 'react-sensors-none-selected' },
    });

    expect(llmNode).toHaveBeenCalledTimes(1);
    expect(sensorRunner).toHaveBeenCalledTimes(1);
    expect(out.messages.at(-1)).toMatchObject({ role: 'assistant', content: 'Done' });
  });

  it('feeds failed sensor repair feedback into the next LLM turn', async () => {
    let llmCallCount = 0;
    const llmNode: GraphNodeFn = vi.fn(async (state) => {
      llmCallCount++;
      if (llmCallCount === 1) {
        return assistantText('Done');
      }
      expect(state.messages.some((message) => message.content.includes('<sensor-feedback'))).toBe(
        true,
      );
      return assistantText('Fixed');
    });
    const sensorRunner: SensorRunner = vi
      .fn()
      .mockResolvedValueOnce(
        failedSensorRun({
          sensorId: 'quality_gate:typecheck',
          trigger: 'before_push',
          selectionState: 'required',
          summary: 'typecheck failed',
          source: 'local_command',
          severity: 'high',
          category: 'quality_gate',
          message: 'TS2322 Type mismatch',
          repairSummary: 'Fix TypeScript typecheck failures.',
        }),
      )
      .mockImplementation(passingSensorRunner([]));

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: vi.fn(async () => ({})),
      sensorCheckNode: createSensorCheckNode({ runSensors: sensorRunner }),
    });

    const out = await graph.invoke(makeInitialState(), {
      configurable: { thread_id: 'react-sensors-repair-feedback' },
    });

    expect(llmNode).toHaveBeenCalledTimes(2);
    expect(out.sensorResults.some((result) => result.status === 'failed')).toBe(true);
  });

  it('runs an explicit external feedback sensor refresh before the next LLM turn', async () => {
    const sensorCalls: Array<Record<string, unknown>> = [];
    const llmNode: GraphNodeFn = vi.fn(async (state) => {
      expect(state.messages.some((message) => message.content.includes('<sensor-feedback'))).toBe(
        true,
      );
      return assistantText('I will fix the review comment.');
    });
    const sensorRunner: SensorRunner = async (input) => {
      sensorCalls.push(input as unknown as Record<string, unknown>);
      return failedSensorRun({
        sensorId: 'collector:github-review',
        trigger: 'external_feedback',
        selectionState: 'optional',
        summary: 'Imported 1 finding from github-review.',
        source: 'github_pr_review',
        severity: 'medium',
        category: 'code_quality',
        message: 'Handle the review comment.',
        repairSummary: 'Address 1 imported sensor finding.',
      });
    };

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: vi.fn(async () => ({})),
      sensorCheckNode: createSensorCheckNode({ runSensors: sensorRunner }),
    });

    await graph.invoke(
      makeInitialState({
        sensorRequestedTrigger: 'external_feedback',
        sensorFindingCollectorResults: [{ id: 'github-review' }],
      }),
      { configurable: { thread_id: 'react-sensors-external-feedback' } },
    );

    expect(sensorCalls.map((call) => call['trigger'])).toEqual([
      'external_feedback',
      'before_push',
    ]);
    expect(llmNode).toHaveBeenCalled();
  });

  it('does not end the react path until DoD passes', async () => {
    const { llmNode, getCallCount } = createIncrementingTextNode();
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));
    let dodChecks = 0;
    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      dodProposeNode: createDodProposeNode({ propose: async () => ['Be complete'] }),
      dodCheckNode: createDodCheckNode({
        evaluate: async (_state, contract) => {
          dodChecks++;
          if (dodChecks === 1) {
            return {
              ...contract,
              evidence: ['First draft was incomplete'],
              passed: false,
              failedCriteria: ['Be complete'],
            };
          }
          return {
            ...contract,
            evidence: ['Second draft satisfied the criterion'],
            passed: true,
            failedCriteria: [],
          };
        },
      }),
    });

    const out = await graph.invoke(
      makeInitialState({ messages: [{ role: 'user', content: 'hi' }] }),
      {
        configurable: { thread_id: 'react-dod-pass' },
      },
    );

    expect(getCallCount()).toBe(2);
    expect(dodChecks).toBe(2);
    expect(out.dodAttempts).toBe(1);
    expect(out.dodContract?.passed).toBe(true);
  });

  it('ends with DOD_FAILED when the DoD check still fails at the iteration cap', async () => {
    const { emitter, events } = captureEmitter();
    const llmNode: GraphNodeFn = vi.fn(async () => assistantText('draft'));
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      dodProposeNode: createDodProposeNode({ propose: async () => ['Be complete'] }),
      dodCheckNode: createDodCheckNode({
        emitter,
        evaluate: async (_state, contract) => ({
          ...contract,
          evidence: ['Still incomplete'],
          passed: false,
          failedCriteria: ['Be complete'],
        }),
      }),
    });

    const out = await graph.invoke(
      makeInitialState({
        messages: [{ role: 'user', content: 'hi' }],
        limits: { ...limits, maxCriticIterations: 1 },
      }),
      { configurable: { thread_id: 'react-dod-fail' } },
    );

    expect(out.dodAttempts).toBe(1);
    expect(out.dodContract?.passed).toBe(false);
    expect(
      events.some((event) => event['type'] === 'error' && event['code'] === 'DOD_FAILED'),
    ).toBe(true);
  });

  it('allows a DoD retry after the critic accepts on the last available draft', async () => {
    const { emitter, events } = captureEmitter();
    const { llmNode, getCallCount } = createIncrementingTextNode();
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));
    let criticCalls = 0;
    let dodChecks = 0;

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      criticNode: createCriticNode({
        evaluate: async () => {
          criticCalls++;
          if (criticCalls <= 2) {
            return { verdict: 'revise', reasons: ['needs more detail'] };
          }
          return { verdict: 'accept', reasons: [] };
        },
      }),
      dodProposeNode: createDodProposeNode({ propose: async () => ['Be complete'] }),
      dodCheckNode: createDodCheckNode({
        emitter,
        evaluate: async (_state, contract) => {
          dodChecks++;
          if (dodChecks === 1) {
            return {
              ...contract,
              evidence: ['Still incomplete'],
              passed: false,
              failedCriteria: ['Be complete'],
            };
          }
          return {
            ...contract,
            evidence: ['Revision satisfied the criterion'],
            passed: true,
            failedCriteria: [],
          };
        },
      }),
    });

    const out = await graph.invoke(
      makeInitialState({
        messages: [{ role: 'user', content: 'hi' }],
        limits: { ...limits, maxCriticIterations: 3 },
      }),
      { configurable: { thread_id: 'react-dod-retry-after-accept' } },
    );

    expect(getCallCount()).toBe(4);
    expect(criticCalls).toBe(4);
    expect(dodChecks).toBe(2);
    expect(out.dodAttempts).toBe(1);
    expect(out.iterations).toBe(2);
    expect(out.dodContract?.passed).toBe(true);
    expect(
      events.some((event) => event['type'] === 'error' && event['code'] === 'DOD_FAILED'),
    ).toBe(false);
  });
});
