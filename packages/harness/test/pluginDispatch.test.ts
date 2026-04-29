import { describe, expect, it, vi } from 'vitest';
import { createLlmReasonNode } from '../src/nodes/llmReason.js';
import { createToolDispatchNode } from '../src/nodes/toolDispatch.js';
import { buildHarnessGraph } from '../src/buildGraph.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import type { Agent, ExecutionLimits, Plan, Tool as ContractTool } from '@agent-platform/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockDispatcher(): PluginDispatcher {
  return {
    chain: [],
    onSessionStart: vi.fn().mockResolvedValue(undefined),
    onTaskStart: vi.fn().mockResolvedValue(undefined),
    onPromptBuild: vi.fn().mockResolvedValue(undefined),
    onToolCall: vi.fn().mockResolvedValue(undefined),
    onTaskEnd: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn().mockResolvedValue(undefined),
  };
}

const baseState: HarnessStateType = {
  trace: [],
  plan: null,
  taskIndex: 0,
  limits: { maxSteps: 10, timeoutMs: 30_000, maxTokens: 100_000, maxCostUnits: 10 },
  runId: 'run-1',
  sessionId: 'sess-1',
  halted: false,
  mode: 'react',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello' },
  ],
  toolDefinitions: [],
  llmOutput: null,
  modelConfig: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' },
  stepCount: 0,
  recentToolCalls: [],
  totalTokensUsed: 0,
  totalCostUnits: 0,
};

const stubAgent: Agent = {
  id: 'agent-1',
  slug: 'agent-1',
  name: 'Test Agent',
  systemPrompt: 'You are helpful.',
  allowedSkillIds: [],
  allowedToolIds: ['test-tool'],
  allowedMcpServerIds: [],
  executionLimits: baseState.limits as ExecutionLimits,
};

const testTools: ContractTool[] = [
  { id: 'test-tool', slug: 'test-tool', name: 'test-tool', riskTier: 'low' },
];

// ---------------------------------------------------------------------------
// Mock streamText for llmReason tests
// ---------------------------------------------------------------------------

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield 'Hello';
    })(),
    toolCalls: Promise.resolve([]),
    usage: Promise.resolve({ promptTokens: 10, completionTokens: 5 }),
  })),
  jsonSchema: vi.fn((s: unknown) => s),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}));

// ---------------------------------------------------------------------------
// Tests: llmReason calls onPromptBuild
// ---------------------------------------------------------------------------

describe('plugin dispatch: llmReason', () => {
  it('calls onPromptBuild before LLM call', async () => {
    const dispatcher = mockDispatcher();
    const node = createLlmReasonNode({ dispatcher });
    await node(baseState);

    expect(dispatcher.onPromptBuild).toHaveBeenCalledOnce();
    expect(dispatcher.onPromptBuild).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      runId: 'run-1',
      plan: null,
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user' }),
      ]),
    });
  });

  it('does not crash when dispatcher.onPromptBuild throws', async () => {
    const dispatcher = mockDispatcher();
    vi.mocked(dispatcher.onPromptBuild).mockRejectedValue(new Error('plugin boom'));
    const node = createLlmReasonNode({ dispatcher });
    const result = await node(baseState);

    // Node should still produce output despite plugin error
    expect(result.llmOutput).toBeDefined();
  });

  it('works without dispatcher (backwards compatible)', async () => {
    const node = createLlmReasonNode();
    const result = await node(baseState);
    expect(result.llmOutput).toBeDefined();
  });

  it('works with emitter-only arg (backwards compatible)', async () => {
    const emitter = { emit: vi.fn() };
    const node = createLlmReasonNode(emitter);
    const result = await node(baseState);
    expect(result.llmOutput).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: toolDispatch calls onToolCall
// ---------------------------------------------------------------------------

describe('plugin dispatch: toolDispatch', () => {
  const toolCallState: HarnessStateType = {
    ...baseState,
    llmOutput: {
      kind: 'tool_calls',
      calls: [{ id: 'tc-1', name: 'test-tool', args: { query: 'test' } }],
    },
  };

  const baseMcpManager = {
    getSession: vi.fn().mockReturnValue(null),
    closeAll: vi.fn(),
  };

  it('calls onToolCall before each tool dispatch', async () => {
    const dispatcher = mockDispatcher();
    const node = createToolDispatchNode({
      agent: stubAgent,
      tools: testTools,
      mcpManager: baseMcpManager as never,
      dispatcher,
    });

    await node(toolCallState);

    expect(dispatcher.onToolCall).toHaveBeenCalledOnce();
    expect(dispatcher.onToolCall).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      runId: 'run-1',
      toolId: 'test-tool',
      args: { query: 'test' },
    });
  });

  it('calls onToolCall for each tool in a multi-tool call', async () => {
    const dispatcher = mockDispatcher();
    const multiState: HarnessStateType = {
      ...baseState,
      llmOutput: {
        kind: 'tool_calls',
        calls: [
          { id: 'tc-1', name: 'test-tool', args: { a: 1 } },
          { id: 'tc-2', name: 'test-tool', args: { b: 2 } },
        ],
      },
    };

    const node = createToolDispatchNode({
      agent: stubAgent,
      tools: testTools,
      mcpManager: baseMcpManager as never,
      dispatcher,
    });

    await node(multiState);
    expect(dispatcher.onToolCall).toHaveBeenCalledTimes(2);
  });

  it('does not crash when dispatcher.onToolCall throws', async () => {
    const dispatcher = mockDispatcher();
    vi.mocked(dispatcher.onToolCall).mockRejectedValue(new Error('plugin boom'));

    const node = createToolDispatchNode({
      agent: stubAgent,
      mcpManager: baseMcpManager as never,
      dispatcher,
    });

    // Should not throw — plugin errors are swallowed
    const result = await node(toolCallState);
    expect(result.messages).toBeDefined();
  });

  it('works without dispatcher (backwards compatible)', async () => {
    const node = createToolDispatchNode({
      agent: stubAgent,
      mcpManager: baseMcpManager as never,
    });

    const result = await node(toolCallState);
    expect(result.messages).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: buildGraph execute node calls onTaskStart/onTaskEnd
// ---------------------------------------------------------------------------

describe('plugin dispatch: execute node (plan mode)', () => {
  const plan: Plan = {
    id: 'plan-1',
    goal: 'test',
    tasks: [{ id: 'task-1', description: 'do thing', toolIds: ['tool-a'] }],
  };

  it('calls onTaskStart and onTaskEnd during plan execution', async () => {
    const dispatcher = mockDispatcher();
    const executeTool = vi.fn().mockResolvedValue({ ok: true });

    const graph = buildHarnessGraph({
      stubPlan: plan,
      executeTool,
      dispatcher,
    });

    const state: HarnessStateType = {
      ...baseState,
      mode: 'plan',
      sessionId: 'sess-plan',
      runId: 'run-plan',
    };

    await graph.invoke(state, { configurable: { thread_id: 'plan-test-1' } });

    expect(dispatcher.onTaskStart).toHaveBeenCalledOnce();
    expect(dispatcher.onTaskStart).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-plan',
        runId: 'run-plan',
        planId: 'plan-1',
        taskId: 'task-1',
      }),
    );

    expect(dispatcher.onTaskEnd).toHaveBeenCalledOnce();
    expect(dispatcher.onTaskEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-plan',
        runId: 'run-plan',
        taskId: 'task-1',
        ok: true,
      }),
    );
  });

  it('does not crash when dispatcher hooks throw', async () => {
    const dispatcher = mockDispatcher();
    vi.mocked(dispatcher.onTaskStart).mockRejectedValue(new Error('plugin boom'));
    vi.mocked(dispatcher.onTaskEnd).mockRejectedValue(new Error('plugin boom'));
    const executeTool = vi.fn().mockResolvedValue({ ok: true });

    const graph = buildHarnessGraph({
      stubPlan: plan,
      executeTool,
      dispatcher,
    });

    const state: HarnessStateType = {
      ...baseState,
      mode: 'plan',
    };

    // Should not throw — plugin errors are swallowed
    const result = await graph.invoke(state, { configurable: { thread_id: 'plan-test-2' } });
    expect(result.trace).toBeDefined();
  });
});
