import { describe, it, expect, vi } from 'vitest';
import { createToolDispatchNode, type ToolDispatchContext } from '../src/nodes/toolDispatch.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { Agent, Output } from '@agent-platform/contracts';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { NativeToolExecutor } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAgent = (overrides?: Partial<Agent>): Agent => ({
  id: 'agent-1',
  slug: 'agent-1',
  name: 'test-agent',
  description: 'test',
  systemPrompt: '',
  allowedSkillIds: [],
  allowedToolIds: ['echo'],
  allowedMcpServerIds: ['mcp-fs'],
  executionLimits: { maxSteps: 10 },
  ...overrides,
});

const makeState = (overrides?: Partial<HarnessStateType>): HarnessStateType =>
  ({
    trace: [],
    plan: null,
    taskIndex: 1,
    limits: { maxSteps: 10 },
    runId: 'run-1',
    halted: false,
    messages: [],
    toolDefinitions: [],
    llmOutput: null,
    modelConfig: null,
    totalTokensUsed: 0,
    totalCostUnits: 0,
    ...overrides,
  }) as HarnessStateType;

const makeMcpManager = (
  sessionMap: Record<string, { callToolAsOutput: ReturnType<typeof vi.fn> }> = {},
): McpSessionManager =>
  ({
    getSession: (id: string) => sessionMap[id],
  }) as unknown as McpSessionManager;

/** Dispatch a single tool call and assert it produces an error result. */
const dispatchExpectingError = async (
  ctx: ToolDispatchContext,
  call: { id: string; name: string; args: Record<string, unknown> },
  expectedError: string,
  expectedMessage?: string,
) => {
  const node = createToolDispatchNode(ctx);
  const state = makeState({
    llmOutput: { kind: 'tool_calls', calls: [call] },
  });
  const result = await node(state);
  const content = JSON.parse(result.messages![0]!.content);
  expect(content.error).toBe(expectedError);
  if (expectedMessage) expect(content.message).toBe(expectedMessage);
  expect(result.trace![0]).toMatchObject({ ok: false });
  return result;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('toolDispatchNode', () => {
  it('returns empty when llmOutput is null', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
    };
    const node = createToolDispatchNode(ctx);
    const result = await node(makeState({ llmOutput: null }));
    expect(result).toEqual({});
  });

  it('returns empty when llmOutput is text kind', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
    };
    const node = createToolDispatchNode(ctx);
    const result = await node(makeState({ llmOutput: { kind: 'text', content: 'hello' } }));
    expect(result).toEqual({});
  });

  it('dispatches MCP tool call successfully', async () => {
    const mcpResult: Output = { type: 'tool_result', toolId: 'mcp-fs:readFile', data: 'contents' };
    const callFn = vi.fn().mockResolvedValue({ output: mcpResult, images: [] });
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager({ 'mcp-fs': { callToolAsOutput: callFn } }),
    };
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: 'mcp-fs:readFile', args: { path: '/workspace/x' } }],
      },
    });

    const result = await node(state);

    expect(callFn).toHaveBeenCalledWith('readFile', { path: '/workspace/x' }, { timeoutMs: 30000 });
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toMatchObject({
      role: 'tool',
      toolCallId: 'tc-1',
      toolName: 'mcp-fs:readFile',
    });
    expect(result.llmOutput).toBeNull();
    expect(result.trace).toHaveLength(1);
    expect(result.trace![0]).toMatchObject({
      type: 'tool_dispatch',
      toolId: 'mcp-fs:readFile',
      ok: true,
    });
  });

  it('dispatches native tool call successfully', async () => {
    const nativeResult: Output = { type: 'tool_result', toolId: 'echo', data: 'echoed' };
    const nativeExecutor: NativeToolExecutor = vi.fn().mockResolvedValue(nativeResult);
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: nativeExecutor,
    };
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-2', name: 'echo', args: { text: 'hi' } }],
      },
    });

    const result = await node(state);

    expect(nativeExecutor).toHaveBeenCalledWith('echo', { text: 'hi' });
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toMatchObject({
      role: 'tool',
      toolCallId: 'tc-2',
      toolName: 'echo',
    });
    // Successful results are wrapped as untrusted XML content
    expect(result.messages![0]!.content).toContain('trusted="false"');
    expect(result.messages![0]!.content).toContain('"echoed"');
    expect(result.trace!.some((t: { type: string }) => t.type === 'tool_dispatch')).toBe(true);
  });

  it('rejects tool not in agent allowlist', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent({ allowedToolIds: [], allowedMcpServerIds: [] }),
      mcpManager: makeMcpManager(),
    };
    await dispatchExpectingError(
      ctx,
      { id: 'tc-3', name: 'forbidden', args: {} },
      'TOOL_NOT_ALLOWED',
    );
  });

  it('returns error when MCP session is not found', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent({ allowedMcpServerIds: ['missing-server'] }),
      mcpManager: makeMcpManager({}),
    };
    await dispatchExpectingError(
      ctx,
      { id: 'tc-4', name: 'missing-server:tool', args: {} },
      'MCP_SESSION_NOT_FOUND',
    );
  });

  it('returns error when native executor throws', async () => {
    const nativeExecutor: NativeToolExecutor = vi.fn().mockRejectedValue(new Error('boom'));
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: nativeExecutor,
    };
    await dispatchExpectingError(
      ctx,
      { id: 'tc-5', name: 'echo', args: {} },
      'NATIVE_TOOL_FAILED',
      'boom',
    );
  });

  it('returns error when no native executor and tool is plain', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
    };
    await dispatchExpectingError(ctx, { id: 'tc-6', name: 'echo', args: {} }, 'TOOL_NOT_FOUND');
  });

  it('handles multiple tool calls in single dispatch', async () => {
    const mcpResult: Output = { type: 'tool_result', toolId: 'mcp-fs:ls', data: ['a', 'b'] };
    const callFn = vi.fn().mockResolvedValue({ output: mcpResult, images: [] });
    const nativeResult: Output = { type: 'tool_result', toolId: 'echo', data: 'ok' };
    const nativeExecutor: NativeToolExecutor = vi.fn().mockResolvedValue(nativeResult);
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager({ 'mcp-fs': { callToolAsOutput: callFn } }),
      nativeToolExecutor: nativeExecutor,
    };
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [
          { id: 'tc-a', name: 'mcp-fs:ls', args: { dir: '/' } },
          { id: 'tc-b', name: 'echo', args: { text: 'hello' } },
        ],
      },
    });

    const result = await node(state);

    expect(result.messages).toHaveLength(2);
    expect(result.trace).toHaveLength(2);
    expect(result.messages![0]).toMatchObject({ toolCallId: 'tc-a', toolName: 'mcp-fs:ls' });
    expect(result.messages![1]).toMatchObject({ toolCallId: 'tc-b', toolName: 'echo' });
  });

  it('handles MCP callToolAsOutput throwing', async () => {
    const callFn = vi.fn().mockRejectedValue(new Error('timeout'));
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager({ 'mcp-fs': { callToolAsOutput: callFn } }),
    };
    await dispatchExpectingError(
      ctx,
      { id: 'tc-7', name: 'mcp-fs:read', args: {} },
      'MCP_CALL_FAILED',
      'timeout',
    );
  });

  // -------------------------------------------------------------------------
  // Wall-time deadline propagation
  // -------------------------------------------------------------------------

  it('halts immediately when deadline is already exceeded', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: vi.fn(),
    };
    const node = createToolDispatchNode(ctx);

    vi.useFakeTimers();
    vi.setSystemTime(99999);

    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-d', name: 'echo', args: {} }],
      },
      startedAtMs: 1000,
      deadlineMs: 5000, // deadline at 6000, now=99999
    });
    const result = await node(state);

    vi.useRealTimers();

    expect(result.halted).toBe(true);
    expect(result.trace).toContainEqual(expect.objectContaining({ type: 'deadline_exceeded' }));
    // Tool executor should never have been called
    expect(ctx.nativeToolExecutor).not.toHaveBeenCalled();
  });

  it('does not halt when deadline has time remaining', async () => {
    const toolOutput: Output = { type: 'tool_result', data: 'ok' };
    const executor: NativeToolExecutor = vi.fn().mockResolvedValue(toolOutput);
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: executor,
    };
    const node = createToolDispatchNode(ctx);
    const now = Date.now();
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-d2', name: 'echo', args: {} }],
      },
      startedAtMs: now,
      deadlineMs: 60_000,
    });
    const result = await node(state);

    expect(result.halted).toBeUndefined();
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
