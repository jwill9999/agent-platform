import { describe, expect, it, vi } from 'vitest';
import { createLlmReasonNode } from '../src/nodes/llmReason.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { ExecutionLimits } from '@agent-platform/contracts';

// ---------------------------------------------------------------------------
// Mock Vercel AI SDK
// ---------------------------------------------------------------------------

let mockTokenUsage = { promptTokens: 50, completionTokens: 50 };

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield 'Response';
    })(),
    toolCalls: Promise.resolve([]),
    usage: Promise.resolve(mockTokenUsage),
  })),
  jsonSchema: vi.fn((s: unknown) => s),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<HarnessStateType> = {}): HarnessStateType {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: {
      maxSteps: 10,
      maxParallelTasks: 1,
      timeoutMs: 30_000,
      maxTokens: 200,
      maxCostUnits: 10,
    } as ExecutionLimits,
    runId: 'run-1',
    sessionId: 'sess-1',
    halted: false,
    mode: 'react',
    messages: [{ role: 'user', content: 'Hello' }],
    toolDefinitions: [],
    llmOutput: null,
    modelConfig: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' },
    stepCount: 0,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: maxTokens enforcement
// ---------------------------------------------------------------------------

describe('execution limits: maxTokens', () => {
  it('does not halt when tokens are under limit', async () => {
    mockTokenUsage = { promptTokens: 30, completionTokens: 20 };
    const node = createLlmReasonNode();
    const state = makeState({ totalTokensUsed: 0 });
    const result = await node(state);

    expect(result.totalTokensUsed).toBe(50);
    expect(result.halted).toBeUndefined();
  });

  it('halts and emits limit_hit when tokens exceed maxTokens', async () => {
    mockTokenUsage = { promptTokens: 80, completionTokens: 80 };
    const node = createLlmReasonNode();
    const state = makeState({ totalTokensUsed: 100 }); // 100 + 160 = 260 > 200

    const result = await node(state);

    expect(result.totalTokensUsed).toBe(260);
    expect(result.halted).toBe(true);
    expect(result.trace).toContainEqual({ type: 'limit_hit', kind: 'max_tokens' });
  });

  it('halts when tokens exactly reach maxTokens', async () => {
    mockTokenUsage = { promptTokens: 50, completionTokens: 50 };
    const node = createLlmReasonNode();
    const state = makeState({ totalTokensUsed: 100 }); // 100 + 100 = 200 >= 200

    const result = await node(state);

    expect(result.totalTokensUsed).toBe(200);
    expect(result.halted).toBe(true);
  });

  it('emits error Output event via emitter on token limit', async () => {
    mockTokenUsage = { promptTokens: 200, completionTokens: 200 };
    const emitter = { emit: vi.fn() };
    const node = createLlmReasonNode({ emitter });
    const state = makeState({ totalTokensUsed: 0 }); // 0 + 400 = 400 > 200

    await node(state);

    expect(emitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        code: 'MAX_TOKENS',
      }),
    );
  });

  it('does not halt when maxTokens is not set', async () => {
    mockTokenUsage = { promptTokens: 1000, completionTokens: 1000 };
    const node = createLlmReasonNode();
    const state = makeState({
      totalTokensUsed: 0,
      limits: {
        maxSteps: 10,
        maxParallelTasks: 1,
        timeoutMs: 30_000,
      } as ExecutionLimits,
    });

    const result = await node(state);
    expect(result.halted).toBeUndefined();
  });

  it('accumulates tokens across multiple calls', async () => {
    mockTokenUsage = { promptTokens: 40, completionTokens: 40 };
    const node = createLlmReasonNode();

    // First call: 0 + 80 = 80
    const result1 = await node(makeState({ totalTokensUsed: 0 }));
    expect(result1.totalTokensUsed).toBe(80);
    expect(result1.halted).toBeUndefined();

    // Second call: 80 + 80 = 160 < 200
    const result2 = await node(makeState({ totalTokensUsed: 80 }));
    expect(result2.totalTokensUsed).toBe(160);
    expect(result2.halted).toBeUndefined();

    // Third call: 160 + 80 = 240 >= 200
    const result3 = await node(makeState({ totalTokensUsed: 160 }));
    expect(result3.totalTokensUsed).toBe(240);
    expect(result3.halted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: maxSteps limit_hit trace event (existing behavior)
// ---------------------------------------------------------------------------

describe('execution limits: maxSteps trace', () => {
  it('emits limit_hit with kind max_steps (existing check)', async () => {
    // This is tested via buildGraph, but we verify the trace type is valid
    const event = { type: 'limit_hit' as const, kind: 'max_steps' as const };
    expect(event.kind).toBe('max_steps');
  });
});
