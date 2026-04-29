import { describe, it, expect, vi } from 'vitest';
import { createToolDispatchNode, type ToolDispatchContext } from '../src/nodes/toolDispatch.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { Agent, Output } from '@agent-platform/contracts';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { NativeToolExecutor } from '../src/types.js';
import type { ToolAuditLogger } from '../src/audit/toolAuditLog.js';

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

  it('fires dispatcher onError when a native tool returns an error output', async () => {
    const onError = vi.fn();
    const nativeExecutor: NativeToolExecutor = vi.fn().mockResolvedValue({
      type: 'error',
      code: 'READ_FAILED',
      message: 'disk exploded',
    });
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: nativeExecutor,
      dispatcher: createPluginDispatcher([{ onError }]),
    };
    const node = createToolDispatchNode(ctx);

    await node(
      makeState({
        sessionId: 'session-1',
        runId: 'run-1',
        llmOutput: {
          kind: 'tool_calls',
          calls: [{ id: 'tc-err', name: 'echo', args: {} }],
        },
      }),
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        runId: 'run-1',
        phase: 'tool',
      }),
    );
    const [{ error }] = onError.mock.calls[0] ?? [];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('disk exploded');
  });

  it('returns error when no native executor and tool is plain', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
    };
    await dispatchExpectingError(ctx, { id: 'tc-6', name: 'echo', args: {} }, 'TOOL_NOT_FOUND');
  });

  it('gates high-risk system tools before execution', async () => {
    const nativeExecutor: NativeToolExecutor = vi.fn().mockResolvedValue({
      type: 'tool_result',
      toolId: 'sys_bash',
      data: { exitCode: 0 },
    });
    const logDenied = vi.fn();
    const auditLog = {
      logStart: vi.fn(),
      logComplete: vi.fn(),
      logDenied,
    } satisfies ToolAuditLogger;
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: nativeExecutor,
      auditLog,
    };
    const node = createToolDispatchNode(ctx);

    const result = await node(
      makeState({
        sessionId: 'session-approval',
        llmOutput: {
          kind: 'tool_calls',
          calls: [{ id: 'tc-approval', name: 'sys_bash', args: { command: 'date' } }],
        },
      }),
    );

    expect(nativeExecutor).not.toHaveBeenCalled();
    expect(logDenied).toHaveBeenCalledWith(
      'sys_bash',
      { command: 'date' },
      'agent-1',
      'session-approval',
      'Tool is marked as requiring human approval.',
      'high',
    );
    expect(JSON.parse(result.messages![0]!.content)).toMatchObject({
      error: 'APPROVAL_REQUIRED',
    });
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        type: 'tool_approval_required',
        toolId: 'sys_bash',
        riskTier: 'high',
      }),
    );
    expect(result.trace).toContainEqual(
      expect.objectContaining({ type: 'tool_dispatch', toolId: 'sys_bash', ok: false }),
    );
  });

  it('gates registry tools that explicitly require approval', async () => {
    const nativeExecutor: NativeToolExecutor = vi.fn().mockResolvedValue({
      type: 'tool_result',
      toolId: 'echo',
      data: 'should not execute',
    });
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      tools: [
        {
          id: 'echo',
          slug: 'echo',
          name: 'echo',
          riskTier: 'low',
          requiresApproval: true,
        },
      ],
      mcpManager: makeMcpManager(),
      nativeToolExecutor: nativeExecutor,
    };
    const node = createToolDispatchNode(ctx);

    const result = await node(
      makeState({
        llmOutput: {
          kind: 'tool_calls',
          calls: [{ id: 'tc-registry-approval', name: 'echo', args: { text: 'hi' } }],
        },
      }),
    );

    expect(nativeExecutor).not.toHaveBeenCalled();
    expect(JSON.parse(result.messages![0]!.content).error).toBe('APPROVAL_REQUIRED');
  });

  it('continues executing ordinary low-risk registry tools', async () => {
    const nativeExecutor: NativeToolExecutor = vi.fn().mockResolvedValue({
      type: 'tool_result',
      toolId: 'echo',
      data: 'ok',
    });
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      tools: [{ id: 'echo', slug: 'echo', name: 'echo', riskTier: 'low' }],
      mcpManager: makeMcpManager(),
      nativeToolExecutor: nativeExecutor,
    };
    const node = createToolDispatchNode(ctx);

    await node(
      makeState({
        llmOutput: {
          kind: 'tool_calls',
          calls: [{ id: 'tc-low-risk', name: 'echo', args: { text: 'hi' } }],
        },
      }),
    );

    expect(nativeExecutor).toHaveBeenCalledWith('echo', { text: 'hi' });
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

  it('rate-limits a tool that exceeds the per-minute window', async () => {
    const toolOutput: Output = { type: 'tool_result', data: 'ok' };
    const executor: NativeToolExecutor = vi.fn().mockResolvedValue(toolOutput);
    const ctx: ToolDispatchContext = {
      agent: makeAgent({
        executionLimits: { maxSteps: 10, toolRateLimitPerMinute: 2 },
      }),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: executor,
    };
    const node = createToolDispatchNode(ctx);

    // First 2 calls succeed
    const state1 = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [
          { id: 'tc-r1', name: 'echo', args: {} },
          { id: 'tc-r2', name: 'echo', args: {} },
        ],
      },
    });
    const result1 = await node(state1);
    expect(executor).toHaveBeenCalledTimes(2);

    // 3rd call should be rate-limited
    const state2 = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-r3', name: 'echo', args: {} }],
      },
      totalToolCalls: result1.totalToolCalls,
    });
    const result2 = await node(state2);

    expect(executor).toHaveBeenCalledTimes(2); // still 2, no new dispatch
    expect(result2.trace).toContainEqual(
      expect.objectContaining({ type: 'rate_limit_hit', toolId: 'echo' }),
    );
    const toolMsg = result2.messages?.[0];
    expect(toolMsg?.content).toContain('RATE_LIMITED');
  });

  it('rate-limits independently per tool name', async () => {
    const toolOutput: Output = { type: 'tool_result', data: 'ok' };
    const executor: NativeToolExecutor = vi.fn().mockResolvedValue(toolOutput);
    const ctx: ToolDispatchContext = {
      agent: makeAgent({
        allowedToolIds: ['echo', 'other'],
        executionLimits: { maxSteps: 10, toolRateLimitPerMinute: 1 },
      }),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: executor,
    };
    const node = createToolDispatchNode(ctx);

    // First call to 'echo' succeeds, then 'echo' is limited but 'other' should work
    const state1 = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-a', name: 'echo', args: {} }],
      },
    });
    await node(state1);
    expect(executor).toHaveBeenCalledTimes(1);

    const state2 = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [
          { id: 'tc-b', name: 'echo', args: {} },
          { id: 'tc-c', name: 'other', args: {} },
        ],
      },
    });
    const result2 = await node(state2);

    // echo should be rate-limited, other should succeed
    expect(executor).toHaveBeenCalledTimes(2); // only 'other' dispatched
    expect(result2.trace).toContainEqual(
      expect.objectContaining({ type: 'rate_limit_hit', toolId: 'echo' }),
    );
  });
});
