import type { Agent, Output } from '@agent-platform/contracts';
import { isToolExecutionAllowed, parseToolId } from '@agent-platform/agent-validation';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import type { RunnableConfig } from '@langchain/core/runnables';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { ChatMessage, NativeToolExecutor, OutputEmitter, ToolCallIntent } from '../types.js';

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
      const result = await session.callToolAsOutput(parsed.mcpToolName, call.args);
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
    const toolMessages: ChatMessage[] = [];
    const traceEvents: TraceEvent[] = [];

    for (const call of llmOutput.calls) {
      if (signal?.aborted) break;

      // Fire onToolCall plugin hook before execution
      if (ctx.dispatcher) {
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

      const { output, ok } = await dispatchSingleTool(call, ctx);

      // Stream the output event to the client (backpressure-aware)
      if (ctx.emitter) {
        await ctx.emitter.emit(output);
      }

      let content: string;
      if (output.type === 'tool_result') {
        content = JSON.stringify(output.data);
      } else if (output.type === 'error') {
        content = JSON.stringify({ error: output.code, message: output.message });
      } else {
        content = JSON.stringify(output);
      }

      toolMessages.push({
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content,
      });

      traceEvents.push({ type: 'tool_dispatch', toolId: call.name, step, ok });
    }

    return {
      llmOutput: null,
      messages: toolMessages,
      trace: traceEvents,
    };
  };
}
