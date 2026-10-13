import { describe, expect, it, vi } from 'vitest';
import type { ExecutionLimits } from '@agent-platform/contracts';
import { CriticVerdictSchema } from '@agent-platform/contracts';
import {
  buildHarnessGraph,
  createCriticNode,
  createLlmReasonNode,
  resolveCriticCap,
  DEFAULT_MAX_CRITIC_ITERATIONS,
  type GraphNodeFn,
} from '../src/index.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { ChatMessage, LlmOutput } from '../src/types.js';
import { captureEmitter, createIncrementingTextNode } from './testUtils.js';
import { mockStreamResult } from './helpers/aiMock.js';

// Spy on the Vercel AI SDK's generateText so tests can assert the default
// evaluator does not reach the model when no modelConfig is present.
const { generateTextSpy, streamTextSpy } = vi.hoisted(() => ({
  generateTextSpy: vi.fn(),
  streamTextSpy: vi.fn(),
}));
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: generateTextSpy, streamText: streamTextSpy };
});

const baseLimits: ExecutionLimits = {
  maxSteps: 10,
  maxParallelTasks: 2,
  timeoutMs: 60_000,
};

function initialState(overrides: Partial<HarnessStateType> = {}): Record<string, unknown> {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: baseLimits,
    runId: 'run-critic',
    sessionId: 'sess-critic',
    halted: false,
    mode: 'react',
    messages: [
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: '4' },
    ] as ChatMessage[],
    toolDefinitions: [],
    llmOutput: { kind: 'text', content: '4' } as LlmOutput,
    modelConfig: null,
    stepCount: 1,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    iterations: 0,
    ...overrides,
  };
}

describe('CriticVerdictSchema', () => {
  it('parses an accept verdict with default reasons', () => {
    const v = CriticVerdictSchema.parse({ verdict: 'accept' });
    expect(v.verdict).toBe('accept');
    expect(v.reasons).toEqual([]);
  });
  it('parses a revise verdict with reasons', () => {
    const v = CriticVerdictSchema.parse({ verdict: 'revise', reasons: ['missing example'] });
    expect(v.verdict).toBe('revise');
    expect(v.reasons).toHaveLength(1);
  });
  it('rejects an unknown verdict', () => {
    expect(() => CriticVerdictSchema.parse({ verdict: 'maybe' })).toThrow();
  });
});

describe('resolveCriticCap', () => {
  it('returns DEFAULT_MAX_CRITIC_ITERATIONS when unset', () => {
    expect(resolveCriticCap(initialState() as unknown as HarnessStateType)).toBe(
      DEFAULT_MAX_CRITIC_ITERATIONS,
    );
  });
  it('returns the configured cap when present', () => {
    const state = initialState({
      limits: { ...baseLimits, maxCriticIterations: 7 },
    }) as unknown as HarnessStateType;
    expect(resolveCriticCap(state)).toBe(7);
  });
});

describe('createCriticNode (unit)', () => {
  it('default evaluator with no modelConfig accepts without any model call', async () => {
    generateTextSpy.mockClear();
    const { emitter, events } = captureEmitter();
    const node = createCriticNode({ emitter });
    const delta = await node(initialState({ modelConfig: null }) as unknown as HarnessStateType);

    expect(delta.iterations).toBeUndefined();
    expect(delta.critique).toBe('');
    expect(delta.messages).toBeUndefined();
    expect(generateTextSpy).not.toHaveBeenCalled();
    const trace = (delta.trace as Array<Record<string, unknown>>) ?? [];
    expect(trace[0]?.['verdict']).toBe('accept');
    expect(events.some((e) => e['type'] === 'thinking')).toBe(true);
  });

  it('accept path: clears critique and emits a thinking event', async () => {
    const { emitter, events } = captureEmitter();
    const node = createCriticNode({
      emitter,
      evaluate: async () => ({ verdict: 'accept', reasons: ['looks good'] }),
    });
    const delta = await node(initialState() as unknown as HarnessStateType);
    expect(delta.iterations).toBeUndefined();
    expect(delta.critique).toBe('');
    expect(delta.messages).toBeUndefined();
    expect(events.some((e) => e['type'] === 'thinking')).toBe(true);
    const trace = (delta.trace as Array<Record<string, unknown>>) ?? [];
    expect(trace[0]?.['verdict']).toBe('accept');
  });

  it('revise path under cap: stores critique and injects a system message', async () => {
    const node = createCriticNode({
      evaluate: async () => ({ verdict: 'revise', reasons: ['missing units'] }),
    });
    const delta = await node(initialState() as unknown as HarnessStateType);
    expect(delta.critique).toContain('missing units');
    const msgs = delta.messages ?? [];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.role).toBe('system');
    expect(msgs[0]?.content).toContain('<critique>');
  });

  it('revise path at cap: emits CRITIC_CAP_REACHED and does not inject critique message', async () => {
    const { emitter, events } = captureEmitter();
    const node = createCriticNode({
      emitter,
      evaluate: async () => ({ verdict: 'revise', reasons: ['still wrong'] }),
    });
    const delta = await node(
      initialState({
        iterations: 2,
        limits: { ...baseLimits, maxCriticIterations: 3 },
      }) as unknown as HarnessStateType,
    );
    expect(delta.messages).toBeUndefined();
    expect(events.some((e) => e['type'] === 'error' && e['code'] === 'CRITIC_CAP_REACHED')).toBe(
      true,
    );
    const trace = (delta.trace as Array<Record<string, unknown>>) ?? [];
    expect(trace[0]?.['capReached']).toBe(true);
  });

  it('malformed evaluator output: defaults to accept', async () => {
    const node = createCriticNode({
      evaluate: async () => {
        throw new Error('LLM exploded');
      },
    });
    const delta = await node(initialState() as unknown as HarnessStateType);
    expect(delta.iterations).toBeUndefined();
    expect(delta.critique).toBe('');
  });
});

describe('createCriticNode (graph integration)', () => {
  it('readmits actual critic revision feedback and halts oversized revision before another provider attempt', async () => {
    streamTextSpy.mockReset();
    streamTextSpy.mockReturnValueOnce(mockStreamResult({ textChunks: ['First draft'] }));
    const onModelAttempt = vi.fn();
    const onContextDecision = vi.fn();
    const feedback = 'CRITIC_REVISION_REQUIRED '.repeat(4000);
    const evaluate = vi.fn(async (state: HarnessStateType) => {
      expect(state.messages.at(-1)).toMatchObject({ role: 'assistant', content: 'First draft' });
      return { verdict: 'revise' as const, reasons: [feedback] };
    });
    const executeTool = vi.fn();
    const toolDispatchNode = vi.fn(async () => ({}));
    const { emitter, events } = captureEmitter();
    const graph = buildHarnessGraph({
      executeTool,
      toolDispatchNode,
      llmReasonNode: createLlmReasonNode({ emitter, onModelAttempt, onContextDecision }),
      criticNode: createCriticNode({ evaluate }),
    });
    const original = [{ role: 'user' as const, content: 'Write a first draft' }];
    const out = await graph.invoke(
      initialState({
        messages: original,
        llmOutput: null,
        currentTurnStartIndex: 0,
        modelConfig: { provider: 'openai', model: 'fixture-model', apiKey: 'fixture-only' },
        contextWindow: { maxInputTokens: 16000, maxOutputTokens: 73, strategy: 'truncate' },
      }),
      { configurable: { thread_id: 'critic-revision-admission' } },
    );
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(out.messages).toEqual([
      ...original,
      { role: 'assistant', content: 'First draft' },
      { role: 'system', content: `<critique>\n${feedback}\n</critique>` },
    ]);
    expect(out).toMatchObject({
      halted: true,
      contextHalt: { code: 'CONTEXT_BUDGET_EXCEEDED' },
      llmOutput: null,
      iterations: 1,
    });
    expect(onContextDecision).toHaveBeenCalledTimes(2);
    expect(onContextDecision.mock.calls.map(([decision]) => decision.reason)).toEqual([
      'unchanged',
      'required_overflow',
    ]);
    expect(streamTextSpy).toHaveBeenCalledTimes(1);
    expect(onModelAttempt).toHaveBeenCalledTimes(1);
    expect(executeTool).not.toHaveBeenCalled();
    expect(toolDispatchNode).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ code: 'CONTEXT_BUDGET_EXCEEDED' }));
  });

  it('routes llmReason → critic → END on accept', async () => {
    let llmCalls = 0;
    const llmNode: GraphNodeFn = vi.fn(async () => {
      llmCalls++;
      return {
        llmOutput: { kind: 'text', content: 'final' } as LlmOutput,
        messages: [{ role: 'assistant', content: 'final' }] as ChatMessage[],
      };
    });
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));
    const criticNode = createCriticNode({
      evaluate: async () => ({ verdict: 'accept', reasons: [] }),
    });

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      criticNode,
    });
    const out = await graph.invoke(initialState({ messages: [{ role: 'user', content: 'hi' }] }), {
      configurable: { thread_id: 'critic-accept' },
    });
    expect(llmCalls).toBe(1);
    expect(out.iterations).toBe(0);
    expect(out.trace.some((e: { type: string }) => e.type === 'critic_verdict')).toBe(true);
  });

  it('revise loop converges within the iteration cap', async () => {
    const { llmNode, getCallCount } = createIncrementingTextNode();
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));
    let criticCalls = 0;
    const criticNode = createCriticNode({
      evaluate: async () => {
        criticCalls++;
        // Revise once, then accept on the second invocation.
        if (criticCalls === 1) return { verdict: 'revise', reasons: ['needs polish'] };
        return { verdict: 'accept', reasons: [] };
      },
    });

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      criticNode,
    });
    const out = await graph.invoke(initialState({ messages: [{ role: 'user', content: 'hi' }] }), {
      configurable: { thread_id: 'critic-revise-converges' },
    });
    expect(getCallCount()).toBe(2);
    expect(criticCalls).toBe(2);
    expect(out.iterations).toBe(1);
  });

  it('cap reached: graph ends after maxCriticIterations', async () => {
    const llmNode: GraphNodeFn = vi.fn(async () => ({
      llmOutput: { kind: 'text', content: 'attempt' } as LlmOutput,
      messages: [{ role: 'assistant', content: 'attempt' }] as ChatMessage[],
    }));
    const toolNode: GraphNodeFn = vi.fn(async () => ({}));
    const criticNode = createCriticNode({
      evaluate: async () => ({ verdict: 'revise', reasons: ['no good'] }),
    });

    const graph = buildHarnessGraph({
      executeTool: vi.fn(),
      llmReasonNode: llmNode,
      toolDispatchNode: toolNode,
      criticNode,
    });
    const out = await graph.invoke(
      initialState({
        messages: [{ role: 'user', content: 'hi' }],
        limits: { ...baseLimits, maxCriticIterations: 2, maxSteps: 50 },
      }),
      { configurable: { thread_id: 'critic-cap-reached' } },
    );
    // Critic always returns revise; loop ends when iterations >= cap (2).
    expect(out.iterations).toBe(2);
    expect(llmNode).toHaveBeenCalledTimes(2);
  });
});
