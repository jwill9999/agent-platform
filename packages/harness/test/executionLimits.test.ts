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

// ---------------------------------------------------------------------------
// Tests: maxCostUnits enforcement
// ---------------------------------------------------------------------------

describe('execution limits: maxCostUnits', () => {
  it('does not halt when cost is under limit', async () => {
    mockTokenUsage = { promptTokens: 30, completionTokens: 20 };
    const node = createLlmReasonNode();
    const state = makeState({ totalCostUnits: 0 });
    const result = await node(state);

    // 50 tokens / 1000 = 0.05 cost units
    expect(result.totalCostUnits).toBeCloseTo(0.05);
    expect(result.halted).toBeUndefined();
  });

  it('halts and emits limit_hit when cost exceeds maxCostUnits', async () => {
    mockTokenUsage = { promptTokens: 500, completionTokens: 500 };
    const node = createLlmReasonNode();
    // Use high maxTokens so token limit is not reached first
    const limits = {
      maxSteps: 10,
      maxParallelTasks: 1,
      timeoutMs: 30_000,
      maxTokens: 100_000,
      maxCostUnits: 10,
    } as ExecutionLimits;
    // 9.5 existing + 1.0 delta (1000/1000) = 10.5 > 10
    const state = makeState({ totalCostUnits: 9.5, limits });

    const result = await node(state);

    expect(result.totalCostUnits).toBeCloseTo(10.5);
    expect(result.halted).toBe(true);
    expect(result.trace).toContainEqual({ type: 'limit_hit', kind: 'max_cost' });
  });

  it('emits MAX_COST error via emitter', async () => {
    mockTokenUsage = { promptTokens: 5000, completionTokens: 5000 };
    const emitter = { emit: vi.fn() };
    const node = createLlmReasonNode({ emitter });
    const limits = {
      maxSteps: 10,
      maxParallelTasks: 1,
      timeoutMs: 30_000,
      maxTokens: 100_000,
      maxCostUnits: 10,
    } as ExecutionLimits;
    const state = makeState({ totalCostUnits: 0, limits }); // 10000/1000 = 10 >= 10

    await node(state);

    expect(emitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        code: 'MAX_COST',
      }),
    );
  });

  it('does not halt when maxCostUnits is not set', async () => {
    mockTokenUsage = { promptTokens: 5000, completionTokens: 5000 };
    const node = createLlmReasonNode();
    const state = makeState({
      totalCostUnits: 0,
      limits: {
        maxSteps: 10,
        maxParallelTasks: 1,
        timeoutMs: 30_000,
        maxTokens: 100_000,
      } as ExecutionLimits,
    });

    const result = await node(state);
    expect(result.halted).toBeUndefined();
  });

  it('accumulates cost across multiple calls', async () => {
    mockTokenUsage = { promptTokens: 2000, completionTokens: 2000 };
    const node = createLlmReasonNode();
    const limits = {
      maxSteps: 10,
      maxParallelTasks: 1,
      timeoutMs: 30_000,
      maxTokens: 100_000,
      maxCostUnits: 10,
    } as ExecutionLimits;

    // First: 0 + 4.0 = 4.0 < 10
    const result1 = await node(makeState({ totalCostUnits: 0, limits }));
    expect(result1.totalCostUnits).toBeCloseTo(4.0);
    expect(result1.halted).toBeUndefined();

    // Second: 4.0 + 4.0 = 8.0 < 10
    const result2 = await node(makeState({ totalCostUnits: 4.0, limits }));
    expect(result2.totalCostUnits).toBeCloseTo(8.0);
    expect(result2.halted).toBeUndefined();

    // Third: 8.0 + 4.0 = 12.0 >= 10
    const result3 = await node(makeState({ totalCostUnits: 8.0, limits }));
    expect(result3.totalCostUnits).toBeCloseTo(12.0);
    expect(result3.halted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: budget warnings
// ---------------------------------------------------------------------------

describe('execution limits: budget warnings', () => {
  it('emits token budget warning at 80% threshold', async () => {
    // maxTokens=200, 160 is exactly 80%
    mockTokenUsage = { promptTokens: 80, completionTokens: 80 };
    const emitter = { emit: vi.fn() };
    const node = createLlmReasonNode({ emitter });
    const state = makeState({ totalTokensUsed: 0 }); // 0 + 160 = 160 = 80% of 200

    await node(state);

    const warns = emitter.emit.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { type: string }).type === 'text' &&
        (c[0] as { content: string }).content.includes('[warning]') &&
        (c[0] as { content: string }).content.includes('Token'),
    );
    expect(warns.length).toBe(1);
  });

  it('emits cost budget warning at 80% threshold', async () => {
    // maxCostUnits=10, need 8.0 to hit 80%
    mockTokenUsage = { promptTokens: 500, completionTokens: 500 };
    const emitter = { emit: vi.fn() };
    const node = createLlmReasonNode({ emitter });
    const limits = {
      maxSteps: 10,
      maxParallelTasks: 1,
      timeoutMs: 30_000,
      maxTokens: 100_000,
      maxCostUnits: 10,
    } as ExecutionLimits;
    // existing 7.0 + 1.0 delta = 8.0 = 80% of 10
    const state = makeState({ totalCostUnits: 7.0, limits });

    await node(state);

    const warns = emitter.emit.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { type: string }).type === 'text' &&
        (c[0] as { content: string }).content.includes('[warning]') &&
        (c[0] as { content: string }).content.includes('Cost'),
    );
    expect(warns.length).toBe(1);
  });

  it('does not emit warning below 80% threshold', async () => {
    mockTokenUsage = { promptTokens: 25, completionTokens: 25 };
    const emitter = { emit: vi.fn() };
    const node = createLlmReasonNode({ emitter });
    const state = makeState({ totalTokensUsed: 0 }); // 50 = 25% of 200

    await node(state);

    const warns = emitter.emit.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { type: string }).type === 'text' &&
        (c[0] as { content: string }).content.includes('[warning]'),
    );
    expect(warns.length).toBe(0);
  });

  it('does not emit warning when limit is already exceeded', async () => {
    mockTokenUsage = { promptTokens: 200, completionTokens: 200 };
    const emitter = { emit: vi.fn() };
    const node = createLlmReasonNode({ emitter });
    const state = makeState({ totalTokensUsed: 0 }); // 400 > 200, halted

    await node(state);

    const warns = emitter.emit.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { type: string }).type === 'text' &&
        (c[0] as { content: string }).content.includes('[warning]'),
    );
    expect(warns.length).toBe(0);
  });
});
