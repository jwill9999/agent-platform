import { describe, expect, it, vi } from 'vitest';
import type { ExecutionLimits } from '@agent-platform/contracts';
import { buildHarnessGraph, type GraphNodeFn } from '../src/buildGraph.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { LlmOutput, ChatMessage } from '../src/types.js';

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
    ...overrides,
  };
}

describe('ReAct loop', () => {
  it('completes when LLM returns text (no tool calls)', async () => {
    const llmNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: { kind: 'text', content: 'Done!' } as LlmOutput,
      messages: [{ role: 'assistant', content: 'Done!' }] as ChatMessage[],
    }));
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
        return {
          llmOutput: {
            kind: 'tool_calls',
            calls: [{ id: 'tc1', name: 'echo', args: { text: 'hi' } }],
          } as LlmOutput,
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'tc1', name: 'echo', args: { text: 'hi' } }],
            },
          ] as ChatMessage[],
        };
      }
      return {
        llmOutput: { kind: 'text', content: 'All done' } as LlmOutput,
        messages: [{ role: 'assistant', content: 'All done' }] as ChatMessage[],
      };
    });

    const toolNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: null,
      messages: [
        { role: 'tool', toolCallId: 'tc1', toolName: 'echo', content: '"hi"' },
      ] as ChatMessage[],
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
    const llmNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc', name: 'tool-a', args: {} }],
      } as LlmOutput,
      messages: [
        { role: 'assistant', content: '', toolCalls: [{ id: 'tc', name: 'tool-a', args: {} }] },
      ] as ChatMessage[],
    }));

    const toolNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: null,
      messages: [
        { role: 'tool', toolCallId: 'tc', toolName: 'tool-a', content: '{}' },
      ] as ChatMessage[],
    }));

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
    const llmNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc', name: 'stuck-tool', args: { x: 1 } }],
      } as LlmOutput,
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tc', name: 'stuck-tool', args: { x: 1 } }],
        },
      ] as ChatMessage[],
    }));

    const toolNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: null,
      messages: [
        { role: 'tool', toolCallId: 'tc', toolName: 'stuck-tool', content: '"same"' },
      ] as ChatMessage[],
    }));

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
        return {
          llmOutput: {
            kind: 'tool_calls',
            calls: [{ id: `tc${callIdx}`, name: 'tool', args: { i: callIdx } }],
          } as LlmOutput,
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: `tc${callIdx}`, name: 'tool', args: { i: callIdx } }],
            },
          ] as ChatMessage[],
        };
      }
      return {
        llmOutput: { kind: 'text', content: 'done' } as LlmOutput,
        messages: [{ role: 'assistant', content: 'done' }] as ChatMessage[],
      };
    });

    const toolNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: null,
      messages: [
        { role: 'tool', toolCallId: 'tc', toolName: 'tool', content: '"ok"' },
      ] as ChatMessage[],
    }));

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
});
