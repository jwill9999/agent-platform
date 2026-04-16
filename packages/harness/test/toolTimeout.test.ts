import { describe, it, expect, vi } from 'vitest';
import { ToolTimeoutError, withToolTimeout, resolveToolTimeout } from '../src/toolTimeout.js';
import { createToolDispatchNode } from '../src/nodes/toolDispatch.js';
import type { ToolDispatchContext } from '../src/nodes/toolDispatch.js';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { HarnessStateType } from '../src/graphState.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(overrides?: { toolTimeoutMs?: number }) {
  return {
    id: 'a1',
    name: 'test-agent',
    description: '',
    systemPrompt: '',
    allowedSkillIds: [],
    allowedToolIds: ['echo'],
    allowedMcpServerIds: [],
    executionLimits: {
      maxSteps: 10,
      maxParallelTasks: 1,
      timeoutMs: 120_000,
      ...(overrides?.toolTimeoutMs !== undefined ? { toolTimeoutMs: overrides.toolTimeoutMs } : {}),
    },
  };
}

function makeState(overrides: Partial<HarnessStateType> = {}): HarnessStateType {
  return {
    messages: [],
    llmOutput: null,
    toolResults: [],
    trace: [],
    tokenUsage: { totalPromptTokens: 0, totalCompletionTokens: 0 },
    costAccumulator: 0,
    ...overrides,
  } as unknown as HarnessStateType;
}

// ---------------------------------------------------------------------------
// withToolTimeout
// ---------------------------------------------------------------------------

describe('withToolTimeout', () => {
  it('resolves when fn completes within timeout', async () => {
    const result = await withToolTimeout(() => Promise.resolve('ok'), 5_000, 'test-tool');
    expect(result).toBe('ok');
  });

  it('throws ToolTimeoutError when fn exceeds timeout', async () => {
    const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 5_000));
    await expect(withToolTimeout(slow, 50, 'slow-tool')).rejects.toThrow(ToolTimeoutError);
    await expect(withToolTimeout(slow, 50, 'slow-tool')).rejects.toThrow('slow-tool');
  });

  it('ToolTimeoutError carries metadata', async () => {
    try {
      await withToolTimeout(
        () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('x')), 5_000)),
        10,
        'my-tool',
      );
    } catch (e) {
      expect(e).toBeInstanceOf(ToolTimeoutError);
      const err = e as ToolTimeoutError;
      expect(err.toolName).toBe('my-tool');
      expect(err.timeoutMs).toBe(10);
    }
  });

  it('throws immediately when parentSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort('pre-aborted');

    await expect(
      withToolTimeout(() => Promise.resolve('ok'), 5_000, 'tool', controller.signal),
    ).rejects.toThrow(ToolTimeoutError);
  });

  it('aborts when parent signal fires mid-execution', async () => {
    const controller = new AbortController();
    const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 5_000));

    setTimeout(() => controller.abort('parent-abort'), 20);

    await expect(withToolTimeout(slow, 10_000, 'tool', controller.signal)).rejects.toThrow(
      ToolTimeoutError,
    );
  });

  it('propagates non-timeout errors as-is', async () => {
    await expect(
      withToolTimeout(() => Promise.reject(new Error('custom-error')), 5_000, 'tool'),
    ).rejects.toThrow('custom-error');
  });

  it('clears timeout on success', async () => {
    vi.useFakeTimers();
    try {
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      const promise = withToolTimeout(() => Promise.resolve('ok'), 60_000, 'tool');
      await vi.advanceTimersByTimeAsync(0);
      await promise;
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// resolveToolTimeout
// ---------------------------------------------------------------------------

describe('resolveToolTimeout', () => {
  it('returns system default (30s) when no overrides', () => {
    expect(resolveToolTimeout()).toBe(30_000);
  });

  it('uses agent-level timeout when provided', () => {
    expect(resolveToolTimeout(20_000)).toBe(20_000);
  });

  it('prefers per-tool timeout over agent-level', () => {
    expect(resolveToolTimeout(20_000, 10_000)).toBe(10_000);
  });

  it('caps at remaining global timeout', () => {
    expect(resolveToolTimeout(30_000, undefined, 5_000)).toBe(5_000);
  });

  it('caps per-tool at remaining global', () => {
    expect(resolveToolTimeout(30_000, 20_000, 8_000)).toBe(8_000);
  });

  it('ignores remainingGlobalMs when <= 0', () => {
    expect(resolveToolTimeout(30_000, undefined, 0)).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// Integration: TOOL_TIMEOUT error code in dispatch
// ---------------------------------------------------------------------------

describe('toolDispatch with timeout', () => {
  it('returns TOOL_TIMEOUT error when tool exceeds timeout', async () => {
    const executorFn = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise<never>((resolve) =>
            setTimeout(
              () => resolve({ type: 'tool_result', toolId: 'echo', data: 'ok' } as never),
              5_000,
            ),
          ),
      );

    const ctx: ToolDispatchContext = {
      agent: makeAgent({ toolTimeoutMs: 50 }),
      mcpManager: { getSession: () => undefined } as unknown as McpSessionManager,
      nativeToolExecutor: executorFn,
    };

    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: 'echo', args: {} }],
      },
    });

    const result = await node(state as unknown as HarnessStateType);

    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].content).toContain('TOOL_TIMEOUT');
    expect(result.trace).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool_timeout', toolId: 'echo' })]),
    );
  });

  it('fast tools complete normally with timeout wrapper', async () => {
    const executorFn = vi.fn().mockResolvedValue({
      type: 'tool_result',
      toolId: 'echo',
      data: 'ok',
    });

    const ctx: ToolDispatchContext = {
      agent: makeAgent({ toolTimeoutMs: 5_000 }),
      mcpManager: { getSession: () => undefined } as unknown as McpSessionManager,
      nativeToolExecutor: executorFn,
    };

    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: 'echo', args: { msg: 'hi' } }],
      },
    });

    const result = await node(state as unknown as HarnessStateType);

    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].content).toContain('"ok"');
    expect(result.trace).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool_timeout' })]),
    );
  });

  it('uses system default 30s when no agent-level toolTimeoutMs', async () => {
    const executorFn = vi.fn().mockResolvedValue({
      type: 'tool_result',
      toolId: 'echo',
      data: 'ok',
    });

    const ctx: ToolDispatchContext = {
      agent: makeAgent(),
      mcpManager: { getSession: () => undefined } as unknown as McpSessionManager,
      nativeToolExecutor: executorFn,
    };

    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: 'echo', args: {} }],
      },
    });

    // Tool completes fast — no timeout; system default (30s) used
    const result = await node(state as unknown as HarnessStateType);
    expect(result.messages).toHaveLength(1);
  });
});
