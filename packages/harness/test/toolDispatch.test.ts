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
    const callFn = vi.fn().mockResolvedValue(mcpResult);
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
      content: '"echoed"',
    });
    expect(result.trace![0]).toMatchObject({ ok: true });
  });

  it('rejects tool not in agent allowlist', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent({ allowedToolIds: [], allowedMcpServerIds: [] }),
      mcpManager: makeMcpManager(),
    };
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-3', name: 'forbidden', args: {} }],
      },
    });

    const result = await node(state);

    expect(result.messages).toHaveLength(1);
    const content = JSON.parse(result.messages![0]!.content);
    expect(content.error).toBe('TOOL_NOT_ALLOWED');
    expect(result.trace![0]).toMatchObject({ ok: false });
  });

  it('returns error when MCP session is not found', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent({ allowedMcpServerIds: ['missing-server'] }),
      mcpManager: makeMcpManager({}),
    };
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-4', name: 'missing-server:tool', args: {} }],
      },
    });

    const result = await node(state);

    const content = JSON.parse(result.messages![0]!.content);
    expect(content.error).toBe('MCP_SESSION_NOT_FOUND');
    expect(result.trace![0]).toMatchObject({ ok: false });
  });

  it('returns error when native executor throws', async () => {
    const nativeExecutor: NativeToolExecutor = vi.fn().mockRejectedValue(new Error('boom'));
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      nativeToolExecutor: nativeExecutor,
    };
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-5', name: 'echo', args: {} }],
      },
    });

    const result = await node(state);

    const content = JSON.parse(result.messages![0]!.content);
    expect(content.error).toBe('NATIVE_TOOL_FAILED');
    expect(content.message).toBe('boom');
    expect(result.trace![0]).toMatchObject({ ok: false });
  });

  it('returns error when no native executor and tool is plain', async () => {
    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: makeMcpManager(),
      // no nativeToolExecutor
    };
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-6', name: 'echo', args: {} }],
      },
    });

    const result = await node(state);

    const content = JSON.parse(result.messages![0]!.content);
    expect(content.error).toBe('TOOL_NOT_FOUND');
  });

  it('handles multiple tool calls in single dispatch', async () => {
    const mcpResult: Output = { type: 'tool_result', toolId: 'mcp-fs:ls', data: ['a', 'b'] };
    const callFn = vi.fn().mockResolvedValue(mcpResult);
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
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-7', name: 'mcp-fs:read', args: {} }],
      },
    });

    const result = await node(state);

    const content = JSON.parse(result.messages![0]!.content);
    expect(content.error).toBe('MCP_CALL_FAILED');
    expect(content.message).toBe('timeout');
    expect(result.trace![0]).toMatchObject({ ok: false });
  });
});
