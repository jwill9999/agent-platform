import { describe, expect, it, vi } from 'vitest';
import type { Agent, ApprovalRequest, Tool } from '@agent-platform/contracts';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import { buildHarnessGraph } from '../src/buildGraph.js';
import type { HarnessStateType } from '../src/graphState.js';
import {
  createToolDispatchNode,
  type ApprovalRequestCreateInput,
  type ToolDispatchContext,
} from '../src/nodes/toolDispatch.js';
import {
  mcpToolRevision,
  sameMcpApprovalBinding,
  type McpApprovalBinding,
} from '../src/security/mcpApproval.js';
import type { ToolCallIntent } from '../src/types.js';

const tool: Tool = {
  id: 'fixture:record',
  slug: 'fixture-record',
  name: 'record',
  riskTier: 'low',
  config: { inputSchema: { type: 'object', properties: { value: { type: 'string' } } } },
};
const binding: McpApprovalBinding = {
  serverId: 'fixture',
  configurationRevision: 4,
  toolRevision: mcpToolRevision(tool),
};
const agent: Agent = {
  id: 'agent',
  slug: 'agent',
  name: 'Agent',
  description: '',
  systemPrompt: '',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: ['fixture'],
  executionLimits: { maxSteps: 10 },
};
const call: ToolCallIntent = { id: 'call-1', name: tool.id, args: { value: 'one' } };
function state(calls: ToolCallIntent[] = [call]): HarnessStateType {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: { maxSteps: 10 },
    runId: 'run-mcp',
    sessionId: 'session-mcp',
    mode: 'react',
    halted: false,
    messages: [],
    toolDefinitions: [],
    llmOutput: { kind: 'tool_calls', calls },
    modelConfig: null,
    totalTokensUsed: 0,
    totalCostUnits: 0,
  } as HarnessStateType;
}
function context(overrides: Partial<ToolDispatchContext> = {}) {
  const execute = vi.fn().mockResolvedValue({
    output: { type: 'tool_result', toolId: tool.id, data: 'recorded' },
    images: [],
  });
  const manager = {
    getSession: vi.fn(() => ({ callToolAsOutput: execute })),
    reconnect: vi.fn(),
  } as unknown as McpSessionManager;
  const ctx: ToolDispatchContext = {
    agent,
    tools: [tool],
    mcpManager: manager,
    mcpApprovalBindings: new Map([[tool.id, binding]]),
    isMcpBindingCurrent: () => true,
    ...overrides,
  };
  return { execute, ctx, manager };
}
const outputError = (result: Partial<HarnessStateType>) =>
  JSON.parse(result.messages![0]!.content).error;

describe('MCP approval identity', () => {
  it('hashes object keys canonically and notices schema or metadata changes', () => {
    const reordered = {
      ...tool,
      config: { inputSchema: { properties: { value: { type: 'string' } }, type: 'object' } },
    };
    expect(mcpToolRevision(reordered)).toBe(mcpToolRevision(tool));
    expect(
      mcpToolRevision({
        ...tool,
        config: { inputSchema: { type: 'object', properties: { value: { type: 'number' } } } },
      }),
    ).not.toBe(mcpToolRevision(tool));
    expect(mcpToolRevision({ ...tool, description: 'Different action' })).not.toBe(
      mcpToolRevision(tool),
    );
    expect(sameMcpApprovalBinding(binding, { ...binding })).toBe(true);
    expect(sameMcpApprovalBinding(undefined, undefined)).toBe(false);
  });

  it('stores current server/revision/schema binding when Ask waits without effects', async () => {
    const create = vi.fn(
      (input: ApprovalRequestCreateInput) =>
        ({
          ...input,
          id: 'approval-1',
          status: 'pending',
          argsJson: JSON.stringify(input.args),
        }) as ApprovalRequest,
    );
    const { ctx, execute } = context({
      tools: [{ ...tool, requiresApproval: true }],
      approvalRequests: { create },
    });
    const result = await createToolDispatchNode(ctx)(state());
    expect(execute).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(JSON.parse(create.mock.calls[0]![0].executionPayloadJson!)).toMatchObject({
      toolCallId: call.id,
      mcpBinding: binding,
    });
    expect(result.halted).toBe(true);
    expect(result.mcpHalt).toBeUndefined();
  });

  it('executes a reviewed current binding once and forwards the request cancellation signal', async () => {
    const { ctx, execute } = context({
      tools: [{ ...tool, requiresApproval: true }],
      approvedToolCallIds: new Set([call.id]),
    });
    const controller = new AbortController();
    const result = await createToolDispatchNode(ctx)(state([{ ...call, mcpBinding: binding }]), {
      configurable: { signal: controller.signal },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      'record',
      { value: 'one' },
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(result.halted).not.toBe(true);
  });

  it.each([
    ['legacy missing binding', undefined],
    ['changed connection/credential revision', { ...binding, configurationRevision: 5 }],
    ['changed schema', { ...binding, toolRevision: 'different' }],
    ['changed server', { ...binding, serverId: 'other' }],
  ] as const)('rejects %s on resume before any tool call', async (_, savedBinding) => {
    const { ctx, execute } = context({ approvedToolCallIds: new Set([call.id]) });
    const result = await createToolDispatchNode(ctx)(
      state([{ ...call, mcpBinding: savedBinding }]),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(result.halted).toBe(true);
    expect(outputError(result)).toBe('MCP_APPROVAL_STALE');
    expect(result.mcpHalt).toEqual({ code: 'MCP_APPROVAL_STALE' });
  });

  it.each([
    'unassigned',
    'not eligible',
    'missing current binding',
    'deleted or edited during request',
  ])('rejects %s despite prior approval', async (change) => {
    const overrides: Partial<ToolDispatchContext> = { approvedToolCallIds: new Set([call.id]) };
    if (change === 'unassigned') overrides.agent = { ...agent, allowedMcpServerIds: [] };
    if (change === 'not eligible') overrides.tools = [];
    if (change === 'missing current binding') overrides.mcpApprovalBindings = new Map();
    if (change === 'deleted or edited during request') overrides.isMcpBindingCurrent = () => false;
    const { ctx, execute } = context(overrides);
    const result = await createToolDispatchNode(ctx)(state([{ ...call, mcpBinding: binding }]));
    expect(execute).not.toHaveBeenCalled();
    expect(result.halted).toBe(true);
    expect(outputError(result)).toBe('MCP_APPROVAL_STALE');
    expect(result.mcpHalt).toEqual({ code: 'MCP_APPROVAL_STALE' });
  });
});

describe('MCP uncertain outcomes end automatic execution', () => {
  it.each(['returned', 'thrown'])(
    '%s transport failure stops remaining batch calls and future model reasoning',
    async (failure) => {
      const { ctx, execute, manager } = context();
      if (failure === 'returned')
        execute.mockResolvedValue({
          output: { type: 'error', code: 'MCP_OUTCOME_UNKNOWN', message: 'Unknown outcome' },
          images: [],
        });
      else execute.mockRejectedValue(new Error('PRIVATE_PROVIDER_BODY_CANARY'));
      const second = { ...call, id: 'call-2' };
      const model = vi.fn(async () => ({
        llmOutput: { kind: 'tool_calls' as const, calls: [call, second] },
      }));
      const graph = buildHarnessGraph({
        executeTool: async () => ({ ok: true }),
        llmReasonNode: model,
        toolDispatchNode: createToolDispatchNode(ctx),
      });
      const result = await graph.invoke(
        { ...state(), llmOutput: null },
        { configurable: { thread_id: `mcp-${failure}` } },
      );
      expect(result.halted).toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(model).toHaveBeenCalledTimes(1);
      expect(manager.reconnect).not.toHaveBeenCalled();
      expect(result.totalRetries).toBe(0);
      expect(result.trace.some((event) => event.type === 'tool_retry')).toBe(false);
      expect(JSON.stringify(result)).not.toContain('PRIVATE_PROVIDER_BODY_CANARY');
      expect(outputError(result)).toBe('MCP_OUTCOME_UNKNOWN');
      expect(result.mcpHalt).toEqual({ code: 'MCP_OUTCOME_UNKNOWN' });
    },
  );

  it('does not dispatch an already cancelled request', async () => {
    const { ctx, execute } = context();
    const controller = new AbortController();
    controller.abort();
    await createToolDispatchNode(ctx)(state(), { configurable: { signal: controller.signal } });
    expect(execute).not.toHaveBeenCalled();
  });
});
