import type { Agent, Output } from '@agent-platform/contracts';
import { isToolExecutionAllowed, parseToolId } from '@agent-platform/agent-validation';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import type { RunnableConfig } from '@langchain/core/runnables';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { ChatMessage, NativeToolExecutor, OutputEmitter, ToolCallIntent } from '../types.js';
import { ToolTimeoutError, withToolTimeout, resolveToolTimeout } from '../toolTimeout.js';
import { withRetry, TOOL_RETRY_CONFIG } from '../retry.js';

// ---------------------------------------------------------------------------
// Tool dispatch context (subset of AgentContext needed by the node)
// ---------------------------------------------------------------------------

export type ToolDispatchContext = {
  agent: Agent;
  mcpManager: McpSessionManager;
  nativeToolExecutor?: NativeToolExecutor;
  emitter?: OutputEmitter;
  dispatcher?: PluginDispatcher;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function dispatchSingleTool(
  call: ToolCallIntent,
  ctx: ToolDispatchContext,
  options?: { timeoutMs?: number },
): Promise<{ output: Output; ok: boolean }> {
  if (!isToolExecutionAllowed(ctx.agent, call.name)) {
    return {
      output: {
        type: 'error',
        code: 'TOOL_NOT_ALLOWED',
        message: `Tool "${call.name}" is not in the agent's allowlist`,
      },
      ok: false,
    };
  }

  const parsed = parseToolId(call.name);

  if (parsed.kind === 'mcp') {
    const session = ctx.mcpManager.getSession(parsed.mcpServerId);
    if (!session) {
      return {
        output: {
          type: 'error',
          code: 'MCP_SESSION_NOT_FOUND',
          message: `No MCP session for server "${parsed.mcpServerId}"`,
        },
        ok: false,
      };
    }
    try {
      const result = await session.callToolAsOutput(parsed.mcpToolName, call.args, {
        timeoutMs: options?.timeoutMs,
      });
      const ok = result.type !== 'error';
      return { output: result, ok };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: { type: 'error', code: 'MCP_CALL_FAILED', message },
        ok: false,
      };
    }
  }

  // Plain (registry/native) tool
  if (ctx.nativeToolExecutor) {
    try {
      const result = await ctx.nativeToolExecutor(call.name, call.args);
      const ok = result.type !== 'error';
      return { output: result, ok };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: { type: 'error', code: 'NATIVE_TOOL_FAILED', message },
        ok: false,
      };
    }
  }

  return {
    output: {
      type: 'error',
      code: 'TOOL_NOT_FOUND',
      message: `No executor found for tool "${call.name}"`,
    },
    ok: false,
  };
}

/**
 * Fire onToolCall plugin hook (errors silenced).
 */
async function fireToolCallHook(
  ctx: ToolDispatchContext,
  state: HarnessStateType,
  call: ToolCallIntent,
): Promise<void> {
  if (!ctx.dispatcher) return;
  try {
    await ctx.dispatcher.onToolCall({
      sessionId: state.sessionId ?? '',
      runId: state.runId ?? '',
      toolId: call.name,
      args: call.args,
    });
  } catch {
    /* plugin errors must not crash the graph */
  }
}

/**
 * Execute a single tool call with retry + timeout wrapping.
 * Returns tool output/ok plus how many retries occurred.
 */
async function executeToolWithRetry(
  call: ToolCallIntent,
  ctx: ToolDispatchContext,
  step: number,
  agentToolTimeoutMs: number | undefined,
  traceEvents: TraceEvent[],
  signal?: AbortSignal,
): Promise<{ output: Output; ok: boolean; retryCount: number }> {
  const effectiveTimeout = resolveToolTimeout(agentToolTimeoutMs);
  let retryCount = 0;

  try {
    const result = await withRetry(
      () =>
        withToolTimeout(
          () => dispatchSingleTool(call, ctx, { timeoutMs: effectiveTimeout }),
          effectiveTimeout,
          call.name,
          signal,
        ),
      TOOL_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        retryCount++;
        const errMsg = error instanceof Error ? error.message : String(error);
        traceEvents.push({
          type: 'tool_retry',
          toolId: call.name,
          step,
          attempt,
          error: errMsg,
          delayMs,
        });
      },
    );
    return { output: result.output, ok: result.ok, retryCount };
  } catch (err) {
    if (!(err instanceof ToolTimeoutError)) throw err;
    traceEvents.push({
      type: 'tool_timeout',
      toolId: call.name,
      step,
      timeoutMs: err.timeoutMs,
    });
    return {
      output: { type: 'error', code: 'TOOL_TIMEOUT', message: err.message },
      ok: false,
      retryCount,
    };
  }
}

/** Serialise a tool output to a string suitable for a tool message. */
function outputToContent(output: Output): string {
  if (output.type === 'tool_result') return JSON.stringify(output.data);
  if (output.type === 'error')
    return JSON.stringify({ error: output.code, message: output.message });
  return JSON.stringify(output);
}

// ---------------------------------------------------------------------------
// Tool dispatch node factory
// ---------------------------------------------------------------------------

/**
 * Creates a tool_dispatch graph node bound to the given dispatch context.
 *
 * Reads `llmOutput` from state (expects `kind: 'tool_calls'`).
 * Dispatches each tool call, appends results to messages, clears llmOutput.
 * Emits `tool_dispatch` trace events per tool call.
 * Supports AbortSignal via `config.configurable.signal` for cancellation.
 * Enforces per-tool execution timeouts (agent-level / system default / per-tool override).
 */
export function createToolDispatchNode(ctx: ToolDispatchContext) {
  return async (
    state: HarnessStateType,
    config?: RunnableConfig,
  ): Promise<Partial<HarnessStateType>> => {
    const signal = config?.configurable?.signal as AbortSignal | undefined;
    const { llmOutput } = state;

    if (llmOutput?.kind !== 'tool_calls') {
      return {};
    }

    const step = state.taskIndex ?? 0;
    const agentToolTimeoutMs = ctx.agent.executionLimits.toolTimeoutMs;
    const toolMessages: ChatMessage[] = [];
    const traceEvents: TraceEvent[] = [];
    let totalToolRetries = 0;

    for (const call of llmOutput.calls) {
      if (signal?.aborted) break;

      await fireToolCallHook(ctx, state, call);

      const { output, ok, retryCount } = await executeToolWithRetry(
        call,
        ctx,
        step,
        agentToolTimeoutMs,
        traceEvents,
        signal,
      );

      if (ctx.emitter) {
        await ctx.emitter.emit(output);
      }

      toolMessages.push({
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: outputToContent(output),
      });

      traceEvents.push({ type: 'tool_dispatch', toolId: call.name, step, ok });
      totalToolRetries += retryCount;
    }

    return {
      llmOutput: null,
      messages: toolMessages,
      trace: traceEvents,
      totalRetries: (state.totalRetries ?? 0) + totalToolRetries,
    };
  };
}
