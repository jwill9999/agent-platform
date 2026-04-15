import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import type { HarnessStateType } from '../src/graphState.js';
import { createPlanGenerateNode } from '../src/nodes/planGenerate.js';
import type { OutputEmitter } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    systemPrompt: 'You are a helpful assistant.',
    allowedSkillIds: [],
    allowedToolIds: ['tool_a', 'tool_b'],
    allowedMcpServerIds: [],
    executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30_000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Agent;
}

function makeState(overrides?: Partial<HarnessStateType>): HarnessStateType {
  return {
    runId: 'run-1',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'List all files in /tmp' },
    ],
    toolDefinitions: [
      { name: 'tool_a', description: 'Does A', parameters: {} },
      { name: 'tool_b', description: 'Does B', parameters: {} },
    ],
    llmOutput: null,
    modelConfig: { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'test-key' },
    plan: null,
    taskIndex: 0,
    limits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30_000 },
    halted: false,
    trace: [],
    mode: 'plan',
    stepCount: 0,
    recentToolCalls: [],
    totalTokensUsed: 0,
    ...overrides,
  } as HarnessStateType;
}

// ---------------------------------------------------------------------------
// Mock the AI SDK
// ---------------------------------------------------------------------------

const validPlanJson = JSON.stringify({
  id: 'plan-1',
  tasks: [
    { id: 'task-1', description: 'List files', toolIds: ['tool_a'] },
    { id: 'task-2', description: 'Filter results', toolIds: ['tool_b'] },
  ],
});

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => 'mock-model')),
}));

// Dynamically import after mocks
const { generateText } = await import('ai');
const mockedGenerateText = vi.mocked(generateText);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPlanGenerateNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a valid plan on first attempt', async () => {
    mockedGenerateText.mockResolvedValueOnce({ text: validPlanJson } as never);

    const node = createPlanGenerateNode({ agent: makeAgent() });
    const result = await node(makeState());

    expect(result.halted).toBeUndefined();
    expect(result.plan).toBeDefined();
    expect(result.plan!.id).toBe('plan-1');
    expect(result.plan!.tasks).toHaveLength(2);
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'plan_ready', planId: 'plan-1', taskCount: 2 }),
      ]),
    );
  });

  it('halts with plan_failed when no user message exists', async () => {
    const state = makeState({
      messages: [{ role: 'system', content: 'sys' }],
    });

    const node = createPlanGenerateNode({ agent: makeAgent() });
    const result = await node(state);

    expect(result.halted).toBe(true);
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'plan_failed', reason: 'No user message found' }),
      ]),
    );
    // LLM should not have been called
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it('halts with plan_failed when LLM returns invalid JSON after repair attempts', async () => {
    // All attempts return garbage
    mockedGenerateText.mockResolvedValue({ text: 'not valid json {{{' } as never);

    const node = createPlanGenerateNode({ agent: makeAgent() });
    const result = await node(makeState());

    expect(result.halted).toBe(true);
    expect(result.trace).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'plan_failed' })]),
    );
    const failTrace = (result.trace as Array<{ type: string; reason?: string }>).find(
      (t) => t.type === 'plan_failed',
    );
    expect(failTrace?.reason).toContain('JSON parse error');
  });

  it('emits error via emitter when plan generation fails', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'garbage' } as never);

    const emitter: OutputEmitter = { emit: vi.fn() };
    const node = createPlanGenerateNode({ agent: makeAgent(), emitter });
    await node(makeState());

    expect(emitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        code: 'PLAN_FAILED',
      }),
    );
  });

  it('recovers via repair loop when first attempt fails but second succeeds', async () => {
    // First call: garbage. Second call: valid plan.
    mockedGenerateText
      .mockResolvedValueOnce({ text: 'invalid json' } as never)
      .mockResolvedValueOnce({ text: validPlanJson } as never);

    const node = createPlanGenerateNode({ agent: makeAgent() });
    const result = await node(makeState());

    expect(result.halted).toBeUndefined();
    expect(result.plan).toBeDefined();
    expect(result.plan!.id).toBe('plan-1');
    // generateText called at least twice (initial + repair)
    expect(mockedGenerateText.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('throws when modelConfig is missing', async () => {
    const state = makeState({ modelConfig: undefined as never });
    const node = createPlanGenerateNode({ agent: makeAgent() });

    await expect(node(state)).rejects.toThrow('modelConfig is required');
  });

  it('halts when plan uses disallowed tools', async () => {
    const disallowedPlan = JSON.stringify({
      id: 'plan-bad',
      tasks: [{ id: 't1', description: 'hack', toolIds: ['forbidden_tool'] }],
    });
    // All attempts return plan with disallowed tools
    mockedGenerateText.mockResolvedValue({ text: disallowedPlan } as never);

    const agent = makeAgent({ allowedToolIds: ['tool_a'] });
    const node = createPlanGenerateNode({ agent });
    const result = await node(makeState());

    expect(result.halted).toBe(true);
    const failTrace = (result.trace as Array<{ type: string; reason?: string }>).find(
      (t) => t.type === 'plan_failed',
    );
    expect(failTrace?.reason).toContain('Policy violation');
  });
});
