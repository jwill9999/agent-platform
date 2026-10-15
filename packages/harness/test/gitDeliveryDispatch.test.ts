import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  ApprovalRequest,
  GitDeliveryAction,
  GitDeliveryPort,
  GitDeliveryReceipt,
  Output,
} from '@agent-platform/contracts';
import { ExecutionPolicySettingsSchema } from '@agent-platform/contracts';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import {
  createToolDispatchNode,
  type ApprovalRequestCreateInput,
  type ToolDispatchContext,
} from '../src/nodes/toolDispatch.js';
import { createSystemToolExecutor } from '../src/systemTools.js';
import { GIT_DELIVERY_TOOLS, parseGitDeliveryToolAction } from '../src/tools/gitTools.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { ToolCallIntent } from '../src/types.js';

const action: GitDeliveryAction = { kind: 'stage', mode: 'stage', paths: ['file.txt'] };
const call = (): ToolCallIntent => ({ id: 'git-call', name: 'sys_git_stage', args: action });
function setup(allowed = true) {
  const receipt: GitDeliveryReceipt = {
    id: randomUUID(),
    projectId: 'project',
    sessionId: 'session',
    source: 'chat',
    action,
    state: 'prepared',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    expiresAtMs: Date.now() + 900000,
    review: {
      branch: 'feature/test',
      head: 'a'.repeat(40),
      indexTree: 'b'.repeat(40),
      paths: ['file.txt'],
      warning: 'A previous outcome remains unknown.',
    },
  };
  const port = {
    prepare: vi.fn<GitDeliveryPort['prepare']>().mockResolvedValue(receipt),
    get: vi.fn<GitDeliveryPort['get']>().mockResolvedValue(receipt),
    execute: vi
      .fn<GitDeliveryPort['execute']>()
      .mockResolvedValue({ ...receipt, state: 'succeeded' }),
    cancel: vi
      .fn<GitDeliveryPort['cancel']>()
      .mockResolvedValue({ ...receipt, state: 'cancelled' }),
  };
  const create = vi.fn(
    (input: ApprovalRequestCreateInput): ApprovalRequest => ({
      ...input,
      id: 'approval',
      argsJson: JSON.stringify(input.args),
      status: 'pending',
    }),
  );
  const emitted: Output[] = [];
  const agent: Agent = {
    id: 'agent',
    slug: 'agent',
    name: 'Agent',
    systemPrompt: '',
    allowedSkillIds: [],
    allowedToolIds: allowed ? ['sys_git_stage'] : [],
    allowedMcpServerIds: [],
    executionLimits: { maxSteps: 10 },
  };
  const ctx: ToolDispatchContext = {
    agent,
    mcpManager: {} as McpSessionManager,
    tools: GIT_DELIVERY_TOOLS,
    gitDelivery: port,
    nativeToolExecutor: createSystemToolExecutor({ gitDelivery: port }),
    approvalRequests: { create },
    executionPolicy: ExecutionPolicySettingsSchema.parse({
      workspaceWrite: 'auto',
      gitMutation: 'auto',
      network: 'auto',
    }),
    emitter: {
      emit(output) {
        emitted.push(output);
      },
      end() {},
    },
  };
  return { ctx, port, create, receipt, emitted };
}
function state(calls = [call()]): HarnessStateType {
  return {
    sessionId: 'session',
    runId: 'run',
    trace: [],
    messages: [],
    taskIndex: 0,
    limits: { maxSteps: 10 },
    totalToolCalls: 0,
    llmOutput: { kind: 'tool_calls', calls },
  } as HarnessStateType;
}
function approve(f: ReturnType<typeof setup>) {
  const original = call();
  original.gitDeliveryBinding = { operationId: f.receipt.id };
  f.ctx.approvedToolCallIds = new Set([original.id]);
  f.ctx.gitDeliveryApproval = {
    toolCallId: original.id,
    operationId: f.receipt.id,
    approvalRequestId: 'approval',
  };
  return original;
}
describe('prepared Git chat boundary', () => {
  it.each([true, false])(
    'prepares canonical material before approval with allowlisted=%s',
    async (allowed) => {
      const f = setup(allowed);
      const result = await createToolDispatchNode(f.ctx)(state());
      expect(result.halted).toBe(true);
      expect(f.port.execute).not.toHaveBeenCalled();
      expect(f.create).toHaveBeenCalledOnce();
      const input = f.create.mock.calls[0]![0];
      expect(input.args).toEqual({ gitDeliveryReceipt: f.receipt });
      expect(input.expiresAtMs).toBe(f.receipt.expiresAtMs);
      expect(JSON.parse(input.executionPayloadJson!)).toEqual({
        toolCallId: 'git-call',
        toolName: 'sys_git_stage',
        args: action,
        gitDeliveryBinding: { operationId: f.receipt.id },
      });
    },
  );
  it('closes an effect-free preparation when approval persistence fails', async () => {
    const f = setup();
    f.create.mockImplementation(() => {
      throw new Error('database unavailable');
    });
    const result = await createToolDispatchNode(f.ctx)(state());
    expect(result.halted).toBe(true);
    expect(f.port.cancel).toHaveBeenCalledWith(f.receipt.id, 'cancelled');
    expect(f.port.execute).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'persisted admission denial prevents every approval path with allowlisted=%s',
    async (allowed) => {
      const f = setup(allowed);
      f.port.prepare.mockRejectedValue(new Error('policy block /private/root'));
      await createToolDispatchNode(f.ctx)(state());
      expect(f.create).not.toHaveBeenCalled();
      expect(f.port.execute).not.toHaveBeenCalled();
      expect(JSON.stringify(f.emitted)).not.toContain('/private/root');
    },
  );
  it('requires private authority, not an approved call ID or a model flag', async () => {
    const f = setup();
    f.ctx.approvedToolCallIds = new Set(['git-call']);
    const forged = { ...call(), args: { ...action, approvalGranted: true } };
    await createToolDispatchNode(f.ctx)(state([forged]));
    expect(f.port.prepare).not.toHaveBeenCalled();
    expect(f.port.execute).not.toHaveBeenCalled();
    const direct = createSystemToolExecutor({ gitDelivery: f.port });
    expect((await direct('sys_git_stage', action, { approvalGranted: true })).type).toBe('error');
    expect(f.port.execute).not.toHaveBeenCalled();
  });
  it('passes actual approval identity and abort signal to the service exactly once', async () => {
    const f = setup();
    const reviewed = approve(f);
    await createToolDispatchNode(f.ctx)(state([reviewed]));
    expect(f.port.prepare).not.toHaveBeenCalled();
    expect(f.port.execute).toHaveBeenCalledWith(f.receipt.id, {
      approvalRequestId: 'approval',
      signal: expect.any(AbortSignal),
    });
    expect(f.port.execute).toHaveBeenCalledOnce();
  });
  it('a continuation reusing the call ID gets no execution authority', async () => {
    const f = setup();
    const reviewed = approve(f);
    await createToolDispatchNode(f.ctx)(state([reviewed]));
    delete f.ctx.gitDeliveryApproval;
    await createToolDispatchNode(f.ctx)(state([call()]));
    expect(f.port.execute).toHaveBeenCalledOnce();
    expect(f.create).toHaveBeenCalledOnce();
  });
  it.each(['unknown', 'failed', 'stale', 'denied', 'expired'] as const)(
    'halts the remaining batch on %s',
    async (outcome) => {
      const f = setup();
      f.port.execute.mockResolvedValue({ ...f.receipt, state: outcome });
      const result = await createToolDispatchNode(f.ctx)(
        state([approve(f), { ...call(), id: 'next-call' }]),
      );
      expect(result.halted).toBe(true);
      expect(f.port.execute).toHaveBeenCalledOnce();
      expect(f.port.prepare).not.toHaveBeenCalled();
    },
  );
  it('waits for durable abort outcome without retrying or abandoning the service', async () => {
    const f = setup();
    f.ctx.agent.executionLimits.toolTimeoutMs = 10;
    f.port.execute.mockImplementation(async (_id, options) => {
      await new Promise<void>((resolve) =>
        options.signal!.addEventListener('abort', () => setTimeout(resolve, 25), { once: true }),
      );
      return { ...f.receipt, state: 'unknown' };
    });
    const started = Date.now();
    const result = await createToolDispatchNode(f.ctx)(state([approve(f)]));
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
    expect(result.halted).toBe(true);
    expect(f.port.execute).toHaveBeenCalledOnce();
    expect(result.trace?.some((event) => event.type === 'tool_retry')).toBe(false);
  });
  it('defines only strict typed high-risk mutation inputs', () => {
    expect(GIT_DELIVERY_TOOLS).toHaveLength(4);
    for (const tool of GIT_DELIVERY_TOOLS) {
      expect(tool.riskTier).toBe('high');
      expect(tool.requiresApproval).toBe(true);
      expect(tool.config?.inputSchema).toMatchObject({ additionalProperties: false });
    }
    expect(() => parseGitDeliveryToolAction('sys_git_commit', action)).toThrow();
    for (const field of [
      'root',
      'command',
      'operationId',
      'approvalRequestId',
      'confirmed',
      'force',
    ])
      expect(() =>
        parseGitDeliveryToolAction('sys_git_stage', { ...action, [field]: true }),
      ).toThrow();
  });
  it('does not persist a pending approval as a completed tool result', async () => {
    const f = setup();
    const result = await createToolDispatchNode(f.ctx)(state());
    expect(result.messages).toEqual([]);
    expect(f.emitted[0]?.type).toBe('approval_required');
  });
  it.each(['workspaceWrite'] as const)(
    'fresh service denial for %s records the outcome and halts the batch',
    async (category) => {
      const f = setup();
      const approved = approve(f);
      f.port.execute.mockResolvedValue({ ...f.receipt, state: 'denied' });
      f.ctx.executionPolicy = ExecutionPolicySettingsSchema.parse({
        workspaceWrite: 'auto',
        gitMutation: 'auto',
        network: 'auto',
        [category]: 'block',
      });
      const result = await createToolDispatchNode(f.ctx)(
        state([approved, { ...call(), id: 'later' }]),
      );
      expect(result.halted).toBe(true);
      expect(f.port.execute).toHaveBeenCalledOnce();
      expect(f.port.prepare).not.toHaveBeenCalled();
    },
  );
  it('a cumulative limit before Git delivery halts later calls without preparation', async () => {
    const f = setup();
    f.ctx.agent.executionLimits.maxToolCallsTotal = 1;
    const input = state([call(), { ...call(), id: 'later' }]);
    input.totalToolCalls = 1;
    const result = await createToolDispatchNode(f.ctx)(input);
    expect(result.halted).toBe(true);
    expect(f.port.prepare).not.toHaveBeenCalled();
    expect(result.messages).toHaveLength(2);
  });
  it('reports unavailable outcome after an execution exception without claiming no effect or retrying', async () => {
    const f = setup();
    const approved = approve(f);
    f.port.execute.mockRejectedValue(new Error('private storage failure'));
    const result = await createToolDispatchNode(f.ctx)(
      state([approved, { ...call(), id: 'later' }]),
    );
    expect(result.halted).toBe(true);
    expect(f.port.execute).toHaveBeenCalledOnce();
    expect(f.port.prepare).not.toHaveBeenCalled();
    expect(f.emitted).toContainEqual(
      expect.objectContaining({ code: 'GIT_DELIVERY_OUTCOME_UNAVAILABLE' }),
    );
    expect(JSON.stringify(f.emitted)).not.toContain('private storage failure');
  });
  it.each(['limit', 'deadline', 'abort'] as const)(
    'closes only matched unexecuted approval at an early %s exit',
    async (reason) => {
      const f = setup();
      const approved = approve(f);
      const input = state([approved]);
      const abort = new AbortController();
      if (reason === 'limit') {
        f.ctx.agent.executionLimits.maxToolCallsTotal = 1;
        input.totalToolCalls = 1;
      }
      if (reason === 'deadline') {
        input.startedAtMs = Date.now() - 100;
        input.deadlineMs = 1;
      }
      if (reason === 'abort') abort.abort();
      const result = await createToolDispatchNode(f.ctx)(input, {
        configurable: { signal: abort.signal },
      });
      expect(result.halted).toBe(true);
      expect(f.port.execute).not.toHaveBeenCalled();
      expect(f.port.cancel).toHaveBeenCalledWith(f.receipt.id, 'cancelled');
    },
  );
  it('fresh model binding cannot trigger early cancellation of a prepared operation', async () => {
    const f = setup();
    const input = state([{ ...call(), gitDeliveryBinding: { operationId: f.receipt.id } }]);
    input.startedAtMs = Date.now() - 100;
    input.deadlineMs = 1;
    await createToolDispatchNode(f.ctx)(input);
    expect(f.port.cancel).not.toHaveBeenCalled();
  });
});
