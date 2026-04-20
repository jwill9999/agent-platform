import type { Agent, Output, Skill } from '@agent-platform/contracts';
import { isToolExecutionAllowed, parseToolId } from '@agent-platform/agent-validation';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import type { RunnableConfig } from '@langchain/core/runnables';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { ChatMessage, NativeToolExecutor, OutputEmitter, ToolCallIntent } from '../types.js';
import { ToolTimeoutError, withToolTimeout, resolveToolTimeout } from '../toolTimeout.js';
import { withRetry, TOOL_RETRY_CONFIG } from '../retry.js';
import { checkDeadline } from '../deadline.js';
import { PathJail, PathJailError } from '../security/pathJail.js';
import { ToolRateLimiter } from '../security/rateLimiter.js';
import { isSystemTool, GET_SKILL_DETAIL_ID } from '../systemTools.js';
import type { ToolAuditLogger } from '../audit/toolAuditLog.js';
import { wrapToolResult, scanForInjection } from '../security/injectionGuard.js';
import { scanOutput } from '../security/outputGuard.js';

// ---------------------------------------------------------------------------
// Tool dispatch context (subset of AgentContext needed by the node)
// ---------------------------------------------------------------------------

export type ToolDispatchContext = {
  agent: Agent;
  mcpManager: McpSessionManager;
  nativeToolExecutor?: NativeToolExecutor;
  emitter?: OutputEmitter;
  dispatcher?: PluginDispatcher;
  pathJail?: PathJail;
  auditLog?: ToolAuditLogger;
  /** Resolves a skill by ID for lazy loading (sys_get_skill_detail). */
  skillResolver?: (skillId: string) => Skill | undefined;
};

/** Map system tool IDs to their path operation type for PathJail enforcement. */
const TOOL_PATH_OPERATIONS: Record<string, 'read' | 'write'> = {
  sys_read_file: 'read',
  sys_write_file: 'write',
  sys_list_files: 'read',
  sys_append_file: 'write',
  sys_copy_file: 'write',
  sys_file_exists: 'read',
  sys_file_info: 'read',
  sys_find_files: 'read',
  sys_create_directory: 'write',
  sys_download_file: 'write',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function enforcePathJail(
  call: ToolCallIntent,
  ctx: ToolDispatchContext,
): Promise<Output | null> {
  if (!ctx.pathJail) return null;

  const operation = TOOL_PATH_OPERATIONS[call.name];
  if (!operation) return null;

  const paths = PathJail.extractPaths(call.args);
  for (const p of paths) {
    try {
      await ctx.pathJail.enforce(p, operation);
    } catch (err) {
      if (err instanceof PathJailError) {
        return {
          type: 'error',
          code: 'PATH_ACCESS_DENIED',
          message: err.message,
        };
      }
      throw err;
    }
  }
  return null;
}

/** Dispatch a tool call to an MCP session. */
async function dispatchMcpTool(
  parsed: { mcpServerId: string; mcpToolName: string },
  call: ToolCallIntent,
  ctx: ToolDispatchContext,
  options?: { timeoutMs?: number },
): Promise<{ output: Output; ok: boolean; images?: Output[] }> {
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
    const { output, images } = await session.callToolAsOutput(parsed.mcpToolName, call.args, {
      timeoutMs: options?.timeoutMs,
    });
    return { output, ok: output.type !== 'error', images };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: { type: 'error', code: 'MCP_CALL_FAILED', message }, ok: false };
  }
}

/** Dispatch a tool call to a native executor. */
async function dispatchNativeTool(
  call: ToolCallIntent,
  ctx: ToolDispatchContext,
): Promise<{ output: Output; ok: boolean }> {
  if (!ctx.nativeToolExecutor) {
    return {
      output: {
        type: 'error',
        code: 'TOOL_NOT_FOUND',
        message: `No executor found for tool "${call.name}"`,
      },
      ok: false,
    };
  }
  try {
    const result = await ctx.nativeToolExecutor(call.name, call.args);
    return { output: result, ok: result.type !== 'error' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: { type: 'error', code: 'NATIVE_TOOL_FAILED', message }, ok: false };
  }
}

async function dispatchSingleTool(
  call: ToolCallIntent,
  ctx: ToolDispatchContext,
  options?: { timeoutMs?: number },
): Promise<{ output: Output; ok: boolean; images?: Output[] }> {
  if (!isToolExecutionAllowed(ctx.agent, call.name)) {
    const output: Output = {
      type: 'error',
      code: 'TOOL_NOT_ALLOWED',
      message: `Tool "${call.name}" is not in the agent's allowlist`,
    };
    ctx.auditLog?.logDenied(call.name, call.args, ctx.agent.id, '', 'Tool not in agent allowlist');
    return { output, ok: false };
  }

  // PathJail: enforce file-path constraints for system tools
  if (isSystemTool(call.name)) {
    const pathError = await enforcePathJail(call, ctx);
    if (pathError) {
      ctx.auditLog?.logDenied(
        call.name,
        call.args,
        ctx.agent.id,
        '',
        pathError.type === 'error'
          ? (pathError.message ?? 'Path access denied')
          : 'Path access denied',
      );
      return { output: pathError, ok: false };
    }
  }

  const parsed = parseToolId(call.name);
  if (parsed.kind === 'mcp') return dispatchMcpTool(parsed, call, ctx, options);
  return dispatchNativeTool(call, ctx);
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
  remainingDeadlineMs?: number,
): Promise<{ output: Output; ok: boolean; retryCount: number; images?: Output[] }> {
  const effectiveTimeout = resolveToolTimeout(agentToolTimeoutMs, undefined, remainingDeadlineMs);
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
    return { output: result.output, ok: result.ok, retryCount, images: result.images };
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
function outputToContent(toolName: string, output: Output): string {
  if (output.type === 'error')
    return JSON.stringify({ error: output.code, message: output.message });
  // Wrap successful tool results as untrusted content
  if (output.type === 'tool_result') return wrapToolResult(toolName, JSON.stringify(output.data));
  return JSON.stringify(output);
}

/** Scan tool output for security issues and emit trace events. */
function scanToolOutput(toolName: string, output: Output, traceEvents: TraceEvent[]): void {
  if (output.type !== 'tool_result') return;
  const content = typeof output.data === 'string' ? output.data : JSON.stringify(output.data);

  // Check for prompt injection attempts
  const injection = scanForInjection(content);
  if (injection.suspicious) {
    traceEvents.push({
      type: 'security_warning',
      detail: `Possible injection in ${toolName}: ${injection.patterns.join(', ')}`,
    });
  }

  // Check for credential leakage
  const credentials = scanOutput(content);
  if (!credentials.safe) {
    traceEvents.push({
      type: 'security_warning',
      detail: `Credential patterns in ${toolName}: ${credentials.issues.join(', ')}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Tool dispatch node factory
// ---------------------------------------------------------------------------

/** Build a tool message indicating the cumulative limit has been reached. */
function buildLimitReachedMessage(call: ToolCallIntent, maxTotal: number): ChatMessage {
  return {
    role: 'tool',
    toolCallId: call.id,
    toolName: call.name,
    content: JSON.stringify({
      error: 'TOOL_LIMIT_REACHED',
      message: `Cumulative tool call limit (${maxTotal}) exceeded. Please finish with available information.`,
    }),
  };
}

// -- Lazy skill loading governor thresholds --
const SKILL_LOAD_WARN_THRESHOLD = 3;
const SKILL_LOAD_ERROR_THRESHOLD = 5;

/**
 * Handle sys_get_skill_detail inline (with governor tracking).
 * Returns a tool message + trace events, or null if this call is not get_skill_detail.
 */
function handleGetSkillDetail(
  call: ToolCallIntent,
  ctx: ToolDispatchContext,
  loadedSkillIds: string[],
): { message: ChatMessage; trace: TraceEvent[]; newLoadedIds: string[] } | null {
  if (call.name !== GET_SKILL_DETAIL_ID) return null;

  const skillId = (call.args as Record<string, unknown>)?.skill_id;
  if (typeof skillId !== 'string' || !skillId) {
    return {
      message: {
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify({ error: 'INVALID_INPUT', message: 'skill_id is required.' }),
      },
      trace: [],
      newLoadedIds: [],
    };
  }

  // Check the skill is assigned to this agent
  const agentSkillIds = ctx.agent.allowedSkillIds ?? [];
  if (!agentSkillIds.includes(skillId)) {
    return {
      message: {
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify({
          error: 'SKILL_NOT_ASSIGNED',
          message: `Skill "${skillId}" is not assigned to this agent.`,
        }),
      },
      trace: [],
      newLoadedIds: [],
    };
  }

  // Governor: count loads of this skill
  const loadCount = loadedSkillIds.filter((id) => id === skillId).length + 1;
  const trace: TraceEvent[] = [];

  if (loadCount >= SKILL_LOAD_ERROR_THRESHOLD) {
    trace.push({ type: 'skill_load_loop', skillId, loadCount });
    return {
      message: {
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify({
          error: 'SKILL_LOAD_LOOP',
          message: `Skill "${skillId}" loaded ${loadCount} times — possible reasoning loop. Use the skill instructions you already have.`,
        }),
      },
      trace,
      newLoadedIds: [],
    };
  }

  if (loadCount >= SKILL_LOAD_WARN_THRESHOLD) {
    trace.push({ type: 'skill_load_loop', skillId, loadCount });
  }

  // Resolve skill via callback
  if (!ctx.skillResolver) {
    return {
      message: {
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify({
          error: 'SKILL_RESOLVER_MISSING',
          message: 'Skill resolver not configured.',
        }),
      },
      trace: [],
      newLoadedIds: [],
    };
  }

  const skill = ctx.skillResolver(skillId);
  if (!skill) {
    return {
      message: {
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify({
          error: 'SKILL_NOT_FOUND',
          message: `Skill "${skillId}" not found.`,
        }),
      },
      trace: [],
      newLoadedIds: [],
    };
  }

  // Return full skill body
  const detail = {
    id: skill.id,
    name: skill.name,
    goal: skill.goal,
    constraints: skill.constraints,
    tools: skill.tools,
    outputSchema: skill.outputSchema,
  };

  trace.push({ type: 'skill_loaded', skillId, loadCount });

  return {
    message: {
      role: 'tool',
      toolCallId: call.id,
      toolName: call.name,
      content: JSON.stringify(detail),
    },
    trace,
    newLoadedIds: [skillId],
  };
}

/** Emit tool output (with any extracted images) through the emitter. */
async function emitToolOutput(
  ctx: ToolDispatchContext,
  output: Output,
  images?: Output[],
): Promise<void> {
  if (!ctx.emitter) return;
  if (images) {
    for (const img of images) {
      await ctx.emitter.emit(img);
    }
  }
  await ctx.emitter.emit(output);
}

const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;

/**
 * Creates a tool_dispatch graph node bound to the given dispatch context.
 *
 * Reads `llmOutput` from state (expects `kind: 'tool_calls'`).
 * Dispatches each tool call, appends results to messages, clears llmOutput.
 * Emits `tool_dispatch` trace events per tool call.
 * Supports AbortSignal via `config.configurable.signal` for cancellation.
 * Enforces per-tool execution timeouts (agent-level / system default / per-tool override).
 * Enforces per-tool sliding-window rate limits.
 */
export function createToolDispatchNode(ctx: ToolDispatchContext) {
  const rateLimitPerMin =
    ctx.agent.executionLimits.toolRateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;
  const rateLimiter = new ToolRateLimiter(rateLimitPerMin);

  return async (
    state: HarnessStateType,
    config?: RunnableConfig,
  ): Promise<Partial<HarnessStateType>> => {
    const signal = config?.configurable?.signal as AbortSignal | undefined;
    const { llmOutput } = state;

    if (llmOutput?.kind !== 'tool_calls') return {};

    // Wall-time deadline check — abort before dispatching tools
    const deadline = checkDeadline(state);
    if (deadline.expired) {
      return {
        halted: true,
        trace: [
          {
            type: 'deadline_exceeded',
            elapsedMs: deadline.elapsedMs,
            deadlineMs: state.deadlineMs,
          },
        ],
      };
    }

    const step = state.taskIndex ?? 0;
    const agentToolTimeoutMs = ctx.agent.executionLimits.toolTimeoutMs;
    const toolMessages: ChatMessage[] = [];
    const traceEvents: TraceEvent[] = [];
    let totalToolRetries = 0;
    let toolCallCount = state.totalToolCalls ?? 0;
    const maxToolCallsTotal = ctx.agent.executionLimits.maxToolCallsTotal;
    const newLoadedSkillIds: string[] = [];

    for (const call of llmOutput.calls) {
      if (signal?.aborted) break;

      // Cumulative tool call limit
      if (maxToolCallsTotal && toolCallCount >= maxToolCallsTotal) {
        toolMessages.push(buildLimitReachedMessage(call, maxToolCallsTotal));
        traceEvents.push({ type: 'limit_hit', kind: 'max_steps' });
        continue;
      }
      toolCallCount++;

      // Per-tool sliding-window rate limit
      const rlResult = rateLimiter.check(call.name);
      if (!rlResult.allowed) {
        traceEvents.push({
          type: 'rate_limit_hit',
          toolId: call.name,
          count: rlResult.count,
          limit: rlResult.limit,
          windowMs: rlResult.windowMs,
        });
        toolMessages.push({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          content: JSON.stringify({
            error: 'RATE_LIMITED',
            message: `Tool "${call.name}" rate-limited: ${rlResult.count}/${rlResult.limit} calls in the last ${rlResult.windowMs / 1000}s. Wait before retrying.`,
          }),
        });
        continue;
      }
      rateLimiter.record(call.name);

      // Intercept sys_get_skill_detail — handled inline with governor
      const allLoadedIds = [...(state.loadedSkillIds ?? []), ...newLoadedSkillIds];
      const skillResult = handleGetSkillDetail(call, ctx, allLoadedIds);
      if (skillResult) {
        toolMessages.push(skillResult.message);
        traceEvents.push(...skillResult.trace);
        newLoadedSkillIds.push(...skillResult.newLoadedIds);
        traceEvents.push({ type: 'tool_dispatch', toolId: call.name, step, ok: true });
        continue;
      }

      await fireToolCallHook(ctx, state, call);

      const auditId =
        ctx.auditLog?.logStart(call.name, call.args, ctx.agent.id, state.sessionId ?? '') ?? null;

      const { output, ok, retryCount, images } = await executeToolWithRetry(
        call,
        ctx,
        step,
        agentToolTimeoutMs,
        traceEvents,
        signal,
        deadline.remainingMs,
      );

      if (auditId && ctx.auditLog) ctx.auditLog.logComplete(auditId, output);

      await emitToolOutput(ctx, output, images);

      // Security scanning (injection detection + credential leak detection)
      scanToolOutput(call.name, output, traceEvents);

      toolMessages.push({
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: outputToContent(call.name, output),
      });

      traceEvents.push({ type: 'tool_dispatch', toolId: call.name, step, ok });
      totalToolRetries += retryCount;
    }

    return {
      llmOutput: null,
      messages: toolMessages,
      trace: traceEvents,
      totalRetries: (state.totalRetries ?? 0) + totalToolRetries,
      totalToolCalls: toolCallCount,
      loadedSkillIds: newLoadedSkillIds,
    };
  };
}
