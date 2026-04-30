import type { DrizzleDb } from '@agent-platform/db';
import {
  getSession,
  getSkill,
  appendMessage,
  listMessagesBySession,
  updateSessionTitle,
  withTransaction,
  insertToolExecution,
  completeToolExecution,
  createApprovalRequest,
  getApprovalRequest,
  claimApprovalRequestForResume,
  ApprovalRequestAlreadyResumedError,
  ApprovalRequestNotFoundError,
  ApprovalRequestTransitionError,
  getModelConfig,
  listModelConfigs,
  resolveModelConfigKey,
  parseMasterKeyFromBase64,
} from '@agent-platform/db';
import type { ApprovalRequest, ContextWindow, MessageRecord } from '@agent-platform/contracts';
import { DEFAULT_CONTEXT_WINDOW, SessionResumeBodySchema } from '@agent-platform/contracts';
import {
  buildAgentContext,
  destroyAgentContext,
  AgentNotFoundError,
  buildHarnessGraph,
  createLlmReasonNode,
  createToolDispatchNode,
  createNdjsonEmitter,
  contractToolsToDefinitions,
  createApproximateCounter,
  buildWindowedContext,
  createSystemToolExecutor,
  PathJail,
  DEFAULT_MOUNTS,
  createToolAuditLogger,
  redactCredentials,
  type HarnessStateType,
} from '@agent-platform/harness';
import type {
  AgentContext,
  ChatMessage,
  OutputEmitter,
  ToolAuditStore,
  ToolCallIntent,
} from '@agent-platform/harness';
import {
  resolveModelConfig,
  openAiKeyGateToApiOutcome,
  resolveGatedOpenAiKeyForRequest,
  streamChat,
} from '@agent-platform/model-router';
import type { ObservabilityStore } from '@agent-platform/plugin-observability';
import type { RegisteredPlugin } from '@agent-platform/plugin-session';
import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { createInProcessSessionLock, type SessionLock } from '../sessionLock.js';
import { parseBody } from './routerUtils.js';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const ChatBodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

const LegacyChatStreamBodySchema = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Extracted helpers — keep the route handlers flat
// ---------------------------------------------------------------------------

const MAX_TITLE_LENGTH = 80;

export type ChatRouterOptions = {
  globalPlugins?: readonly RegisteredPlugin[];
  observabilityStore?: ObservabilityStore;
  llmReasonNode?: ReturnType<typeof createLlmReasonNode>;
  disableEvaluatorNodes?: boolean;
  sessionLock?: SessionLock;
};

/** Derive a human-readable session title from the first user message. */
function deriveSessionTitle(message: string): string {
  const trimmed = message.trim().replaceAll(/\s+/g, ' ');
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  const cut = trimmed.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Build agent context; translates AgentNotFoundError to HttpError. */
async function loadAgentContext(
  db: DrizzleDb,
  agentId: string,
  options: Pick<ChatRouterOptions, 'globalPlugins'> = {},
): Promise<AgentContext> {
  try {
    return await buildAgentContext(db, agentId, {
      globalPlugins: options.globalPlugins,
    });
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      throw new HttpError(404, 'NOT_FOUND', `Agent '${agentId}' not found`);
    }
    throw err;
  }
}

/** Resolve model config or throw an HttpError on failure.
 *
 * Precedence (highest → lowest):
 *  1. `requestModelConfigId` — per-request override from the chat UI picker
 *  2. `agentCtx.agent.modelConfigId` — agent's saved config
 *  3. First saved model config with credentials — platform default from Settings > Models
 *  4. `agentCtx.agent.modelOverride` + `headerKey` (x-openai-key) + env-var chain
 *
 * Single-user MVP note: model configs are not scoped per-user. If multi-tenancy is
 * added in future, enforce that `effectiveModelConfigId` belongs to the requesting user
 * before calling `getModelConfig`.
 */
function resolveModelOrThrow(
  db: DrizzleDb,
  agentCtx: AgentContext,
  headerKey: string | undefined,
  requestModelConfigId?: string,
): { provider: string; model: string; apiKey?: string } {
  // Effective model config ID: per-request override wins over agent's stored config.
  const effectiveModelConfigId = requestModelConfigId ?? agentCtx.agent.modelConfigId;

  // If the agent has a stored model config, use its encrypted key (highest precedence).
  if (effectiveModelConfigId) {
    const cfg = getModelConfig(db, effectiveModelConfigId);
    if (!cfg) {
      throw new HttpError(404, 'NOT_FOUND', `Model config '${effectiveModelConfigId}' not found`);
    }
    // A per-request UI override must reference a config that has a stored API key.
    // Configs without a key cannot be meaningfully used as an explicit override.
    if (requestModelConfigId && !cfg.hasApiKey) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        `Model config '${effectiveModelConfigId}' has no API key stored`,
      );
    }
    let apiKey: string | undefined;
    if (cfg.hasApiKey) {
      const masterKeyB64 = process.env['SECRETS_MASTER_KEY'];
      if (!masterKeyB64) {
        throw new HttpError(500, 'CONFIGURATION_ERROR', 'SECRETS_MASTER_KEY is not configured');
      }
      const masterKey = parseMasterKeyFromBase64(masterKeyB64);
      apiKey = resolveModelConfigKey(db, effectiveModelConfigId, masterKey);
    }
    return { provider: cfg.provider, model: cfg.model, apiKey };
  }

  const defaultModelConfig = listModelConfigs(db).find(
    (config) => config.hasApiKey || config.provider === 'ollama',
  );
  if (defaultModelConfig) {
    let apiKey: string | undefined;
    if (defaultModelConfig.hasApiKey) {
      const masterKeyB64 = process.env['SECRETS_MASTER_KEY'];
      if (!masterKeyB64) {
        throw new HttpError(500, 'CONFIGURATION_ERROR', 'SECRETS_MASTER_KEY is not configured');
      }
      const masterKey = parseMasterKeyFromBase64(masterKeyB64);
      apiKey = resolveModelConfigKey(db, defaultModelConfig.id, masterKey);
    }
    return {
      provider: defaultModelConfig.provider,
      model: defaultModelConfig.model,
      apiKey,
    };
  }

  // Fall back to free-form modelOverride + env-var chain.
  const resolution = resolveModelConfig({
    agentOverride: agentCtx.agent.modelOverride ?? null,
    headerKey,
  });
  if (resolution.kind === 'error') {
    throw new HttpError(400, resolution.code, resolution.message);
  }
  return resolution.config;
}

/** Map persisted MessageRecord rows to ChatMessage objects. */
export function dbRecordToChatMessage(m: MessageRecord): ChatMessage {
  if (m.role === 'tool' && m.toolCallId) {
    return { role: 'tool', content: m.content, toolCallId: m.toolCallId, toolName: '' };
  }
  if (m.role === 'assistant') {
    return {
      role: 'assistant',
      content: m.content,
      toolCalls: m.toolCalls as ToolCallIntent[] | undefined,
    };
  }
  return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
}

/**
 * Sanitise replayed history so that persisted tool-call conversations satisfy
 * OpenAI's adjacency rule:
 *   assistant(tool_calls=[a,b]) → tool(a) → tool(b)
 *
 * Pending approval turns intentionally have an assistant `tool_calls` row with
 * no tool result yet. Those rows must not be replayed during a later normal
 * chat request, or OpenAI rejects the entire conversation. The resume endpoint
 * appends the reviewed assistant tool call at the end immediately before it
 * dispatches the matching tool result.
 *
 * Older rows may also lack persisted assistant `toolCalls`; strip any orphan
 * tool rows that cannot be paired with the immediately preceding assistant.
 */
function sanitiseToolCallHistory(history: ChatMessage[]): ChatMessage[] {
  const cleaned: ChatMessage[] = [];
  for (let i = 0; i < history.length; i += 1) {
    const msg = history[i]!;
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      const toolCalls = msg.toolCalls;
      const toolResults: ChatMessage[] = [];
      let cursor = i + 1;
      for (const toolCall of toolCalls) {
        const candidate = history[cursor];
        if (candidate?.role !== 'tool' || candidate.toolCallId !== toolCall.id) {
          toolResults.length = 0;
          break;
        }
        toolResults.push({
          ...candidate,
          toolName: candidate.toolName || toolCall.name,
        });
        cursor += 1;
      }
      if (toolResults.length === toolCalls.length) {
        cleaned.push(msg, ...toolResults);
        i = cursor - 1;
      }
      continue;
    }

    if (msg.role === 'tool') {
      const prev = cleaned.at(-1);
      const hasMatchingCall =
        prev?.role === 'assistant' &&
        Array.isArray(prev.toolCalls) &&
        prev.toolCalls.some((c) => c.id === msg.toolCallId);
      if (!hasMatchingCall) continue;
    }
    cleaned.push(msg);
  }
  return cleaned;
}

/** Persist only the new assistant/tool messages the graph appended. */
function persistNewMessages(
  db: DrizzleDb,
  sessionId: string,
  allMessages: ChatMessage[] | undefined,
  initialCount: number,
): void {
  if (!allMessages) return;
  withTransaction(db, (tx) => {
    for (const msg of allMessages.slice(initialCount)) {
      if (msg.role !== 'assistant' && msg.role !== 'tool') continue;
      appendMessage(tx, {
        sessionId,
        role: msg.role,
        content: msg.content,
        toolCallId: msg.role === 'tool' ? msg.toolCallId : undefined,
        toolCalls: msg.role === 'assistant' ? msg.toolCalls : undefined,
      });
    }
  });
}

/** Safely fire a plugin hook, swallowing errors. */
async function safePluginCall(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    /* plugin errors must not crash the request */
  }
}

/** Build and write an NDJSON error event when the stream is still writable. */
function emitStreamError(res: Response, err: unknown, signal?: AbortSignal): void {
  if (res.writableEnded) return;

  if (signal?.aborted) {
    const reason = signal.reason === 'timeout' ? 'timeout' : 'client_disconnect';
    const errorEvent =
      reason === 'timeout'
        ? { type: 'error' as const, code: 'TIMEOUT', message: 'Execution timeout exceeded' }
        : { type: 'stream_aborted' as const, reason };
    res.write(JSON.stringify(errorEvent) + '\n');
    return;
  }

  const rawMessage = err instanceof Error ? err.message : 'Graph execution failed';
  const authError = isProviderAuthError(rawMessage);
  const message = authError
    ? 'The model provider rejected the configured API key. Check the selected model config or server environment key.'
    : redactCredentials(rawMessage);
  const errorEvent = {
    type: 'error' as const,
    ...(authError ? { code: 'MODEL_AUTH_FAILED' as const } : {}),
    message,
  };
  res.write(JSON.stringify(errorEvent) + '\n');
}

function isProviderAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('incorrect api key') ||
    lower.includes('invalid api key') ||
    lower.includes('authentication') ||
    lower.includes('unauthorized')
  );
}

function mapResumeApprovalError(error: unknown): never {
  const namedError = error instanceof Error ? error : null;
  if (
    error instanceof ApprovalRequestNotFoundError ||
    namedError?.name === 'ApprovalRequestNotFoundError'
  ) {
    throw new HttpError(404, 'NOT_FOUND', namedError?.message ?? 'Approval request not found');
  }
  if (
    error instanceof ApprovalRequestAlreadyResumedError ||
    namedError?.name === 'ApprovalRequestAlreadyResumedError'
  ) {
    const resumed = error as ApprovalRequestAlreadyResumedError;
    throw new HttpError(
      409,
      'APPROVAL_ALREADY_RESUMED',
      namedError?.message ?? 'Approval request has already been resumed',
      {
        id: resumed.id,
        resumedAtMs: resumed.resumedAtMs,
      },
    );
  }
  if (
    error instanceof ApprovalRequestTransitionError ||
    namedError?.name === 'ApprovalRequestTransitionError'
  ) {
    const transition = error as ApprovalRequestTransitionError;
    throw new HttpError(
      409,
      'INVALID_APPROVAL_TRANSITION',
      namedError?.message ?? 'Invalid approval request transition',
      {
        id: transition.id,
        currentStatus: transition.currentStatus,
        requestedStatus: transition.requestedStatus,
      },
    );
  }
  throw error;
}

function parseExecutionPayload(request: ApprovalRequest): ToolCallIntent {
  if (!request.executionPayloadJson) {
    throw new HttpError(
      409,
      'APPROVAL_RESUME_STATE_MISSING',
      'Approval request has no durable execution payload',
    );
  }

  let parsed: { toolCallId: string; toolName: string; args: Record<string, unknown> };
  try {
    parsed = z
      .object({
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        args: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(JSON.parse(request.executionPayloadJson));
  } catch (error) {
    throw new HttpError(409, 'APPROVAL_RESUME_STATE_INVALID', 'Approval resume state is invalid', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  if (parsed.toolName !== request.toolName) {
    throw new HttpError(
      409,
      'APPROVAL_RESUME_STATE_MISMATCH',
      'Approval request payload does not match the reviewed tool',
    );
  }

  return {
    id: parsed.toolCallId,
    name: parsed.toolName,
    args: parsed.args,
  };
}

function hasAssistantToolCall(history: ChatMessage[], toolCallId: string): boolean {
  return history.some(
    (message) =>
      message.role === 'assistant' &&
      message.toolCalls?.some((toolCall) => toolCall.id === toolCallId),
  );
}

function buildResumeMessages(
  db: DrizzleDb,
  sessionId: string,
  systemPrompt: string,
  toolCall: ToolCallIntent,
): ChatMessage[] {
  const history = sanitiseToolCallHistory(
    listMessagesBySession(db, sessionId).map(dbRecordToChatMessage),
  );
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];

  if (!hasAssistantToolCall(messages, toolCall.id)) {
    messages.push({ role: 'assistant', content: '', toolCalls: [toolCall] });
  }

  return messages;
}

function buildRejectedToolMessage(toolCall: ToolCallIntent, request: ApprovalRequest): ChatMessage {
  return {
    role: 'tool',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: JSON.stringify({
      error: 'APPROVAL_REJECTED',
      message: request.decisionReason
        ? `Human rejected tool execution: ${request.decisionReason}`
        : 'Human rejected tool execution.',
    }),
  };
}

function createAuditLog(db: DrizzleDb): ReturnType<typeof createToolAuditLogger> {
  const auditStore: ToolAuditStore = {
    insert: (entry) => insertToolExecution(db, entry),
    complete: (id, data) => completeToolExecution(db, id, data),
  };
  return createToolAuditLogger(auditStore);
}

function createRuntimeToolDispatchNode({
  db,
  agentCtx,
  runId,
  sessionId,
  emitter,
  options,
  approvedToolCallIds,
}: {
  db: DrizzleDb;
  agentCtx: AgentContext;
  runId: string;
  sessionId: string;
  emitter: OutputEmitter;
  options: ChatRouterOptions;
  approvedToolCallIds?: ReadonlySet<string>;
}) {
  const nativeToolExecutor = createSystemToolExecutor(
    options.observabilityStore
      ? {
          observability: {
            store: options.observabilityStore,
            sessionId,
            traceId: runId,
          },
        }
      : undefined,
  );

  return createToolDispatchNode({
    agent: agentCtx.agent,
    tools: agentCtx.tools,
    mcpManager: agentCtx.mcpManager,
    nativeToolExecutor,
    emitter,
    dispatcher: agentCtx.pluginDispatcher,
    pathJail: new PathJail(DEFAULT_MOUNTS),
    auditLog: createAuditLog(db),
    approvalRequests: {
      create: (request) =>
        createApprovalRequest(db, {
          id: randomUUID(),
          ...request,
        }),
    },
    approvedToolCallIds,
    skillResolver: (id: string) => getSkill(db, id),
  });
}

function buildRuntimeGraph(
  db: DrizzleDb,
  agentCtx: AgentContext,
  runId: string,
  sessionId: string,
  emitter: OutputEmitter,
  options: ChatRouterOptions,
  approvedToolCallIds?: ReadonlySet<string>,
) {
  const dispatcher = agentCtx.pluginDispatcher;
  return buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode: options.llmReasonNode ?? createLlmReasonNode({ emitter, dispatcher }),
    toolDispatchNode: createRuntimeToolDispatchNode({
      db,
      agentCtx,
      runId,
      sessionId,
      emitter,
      options,
      approvedToolCallIds,
    }),
    // Keep evaluator nodes out of the user-facing chat runtime for now. The
    // DoD proposer/checker use JSON-only internal prompts, and the critic makes
    // a second model call; both can surface internal evaluator output or errors
    // instead of a normal assistant response when they fail.
    criticNode: undefined,
    dodProposeNode: undefined,
    dodCheckNode: undefined,
    dispatcher,
  });
}

async function emitRuntimeFailure(
  agentCtx: AgentContext,
  sessionId: string,
  runId: string,
  signal: AbortSignal,
  res: Response,
  err: unknown,
) {
  await safePluginCall(() =>
    agentCtx.pluginDispatcher.onTaskEnd({
      sessionId,
      runId,
      taskId: runId,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }),
  );
  await safePluginCall(() =>
    agentCtx.pluginDispatcher.onError({
      sessionId,
      runId,
      phase: signal.aborted && signal.reason === 'timeout' ? 'session' : 'unknown',
      error: err,
    }),
  );
  emitStreamError(res, err, signal);
}

async function emitTaskStart(agentCtx: AgentContext, sessionId: string, runId: string) {
  await safePluginCall(() =>
    agentCtx.pluginDispatcher.onTaskStart({
      sessionId,
      runId,
      planId: runId,
      taskId: runId,
      toolIds: agentCtx.tools.map((tool) => tool.id),
    }),
  );
}

function startRuntimeResponse(
  req: Request,
  res: Response,
  controller: AbortController,
  timeoutMs: number,
): {
  timeoutId: ReturnType<typeof setTimeout>;
  heartbeatId: ReturnType<typeof setInterval>;
} {
  prepareNdjsonResponse(res);
  req.on('close', () => {
    if (!res.writableFinished) controller.abort('client_disconnect');
  });
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const heartbeatId = setInterval(() => {
    if (!res.writableEnded) res.write('\n');
  }, 15_000);
  return { timeoutId, heartbeatId };
}

async function closeRuntimeStream({
  timeoutId,
  heartbeatId,
  release,
  agentCtx,
  res,
}: {
  timeoutId?: ReturnType<typeof setTimeout>;
  heartbeatId?: ReturnType<typeof setInterval>;
  release: () => void;
  agentCtx: AgentContext;
  res: Response;
}) {
  if (timeoutId) clearTimeout(timeoutId);
  if (heartbeatId) clearInterval(heartbeatId);
  release();
  await destroyAgentContext(agentCtx);
  if (!res.writableEnded) res.end();
}

export async function handleSessionResume(
  db: DrizzleDb,
  options: ChatRouterOptions,
  sessionLock: SessionLock,
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = z.string().min(1).parse(req.params['id']);
  const { approvalRequestId } = parseBody(SessionResumeBodySchema, req.body);

  const session = getSession(db, sessionId);
  if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');

  let approval: ApprovalRequest;
  try {
    approval = getApprovalRequest(db, approvalRequestId);
  } catch (error) {
    mapResumeApprovalError(error);
  }

  if (approval.sessionId !== sessionId) {
    throw new HttpError(404, 'NOT_FOUND', 'Approval request not found for session');
  }

  if (approval.resumedAtMs) {
    res.json({ data: approval });
    return;
  }

  const toolCall = parseExecutionPayload(approval);
  const agentCtx = await loadAgentContext(db, session.agentId, {
    globalPlugins: options.globalPlugins,
  });
  const modelCfg = resolveModelOrThrow(
    db,
    agentCtx,
    req.header('x-openai-key'),
    req.header('x-model-config-id') || undefined,
  );
  const { timeoutMs } = agentCtx.agent.executionLimits;
  const release = await sessionLock.acquire(sessionId, timeoutMs);

  const controller = new AbortController();
  const { signal } = controller;
  const runId = randomUUID();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let heartbeatId: ReturnType<typeof setInterval> | undefined;

  try {
    try {
      approval = claimApprovalRequestForResume(db, approvalRequestId, Date.now());
    } catch (error) {
      mapResumeApprovalError(error);
    }

    await emitTaskStart(agentCtx, sessionId, runId);
    ({ timeoutId, heartbeatId } = startRuntimeResponse(req, res, controller, timeoutMs));
    const emitter: OutputEmitter = createNdjsonEmitter(res);

    const messages = buildResumeMessages(db, sessionId, agentCtx.systemPrompt, toolCall);
    const initialCount = messages.length;

    let resumeMessages: ChatMessage[];
    if (approval.status === 'rejected') {
      resumeMessages = [buildRejectedToolMessage(toolCall, approval)];
      await emitter.emit({
        type: 'error',
        code: 'APPROVAL_REJECTED',
        message: 'Human rejected tool execution.',
      });
    } else {
      const dispatchNode = createRuntimeToolDispatchNode({
        db,
        agentCtx,
        runId,
        sessionId,
        emitter,
        options,
        approvedToolCallIds: new Set([toolCall.id]),
      });
      const dispatchState = buildInitialState(runId, sessionId, messages, agentCtx, modelCfg, {
        dropped: 0,
        contextTokens: 0,
      });
      dispatchState.llmOutput = { kind: 'tool_calls', calls: [toolCall] };
      const dispatchResult = await dispatchNode(dispatchState, {
        configurable: { thread_id: sessionId, signal },
      });
      resumeMessages = dispatchResult.messages ?? [];
    }

    const graph = buildRuntimeGraph(
      db,
      agentCtx,
      runId,
      sessionId,
      emitter,
      options,
      new Set([toolCall.id]),
    );
    const resumeState = buildInitialState(
      runId,
      sessionId,
      [...messages, ...resumeMessages],
      agentCtx,
      modelCfg,
      { dropped: 0, contextTokens: 0 },
    );

    const finalState: { messages?: ChatMessage[] } = await graph.invoke(resumeState, {
      configurable: { thread_id: sessionId, signal },
    });

    persistNewMessages(db, sessionId, finalState?.messages, initialCount);
    await safePluginCall(() =>
      agentCtx.pluginDispatcher.onTaskEnd({ sessionId, runId, taskId: runId, ok: true }),
    );
  } catch (err) {
    if (!res.headersSent && err instanceof HttpError) {
      throw err;
    }
    await emitRuntimeFailure(agentCtx, sessionId, runId, signal, res, err);
  } finally {
    await closeRuntimeStream({ timeoutId, heartbeatId, release, agentCtx, res });
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createChatRouter(db: DrizzleDb, options: ChatRouterOptions = {}): Router {
  const router = createRouter();
  const sessionLock = options.sessionLock ?? createInProcessSessionLock();

  // Session-aware agent chat (NDJSON stream of Output events)
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { sessionId, message } = parseBody(ChatBodySchema, req.body);

      const session = getSession(db, sessionId);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');

      const agentCtx = await loadAgentContext(db, session.agentId, {
        globalPlugins: options.globalPlugins,
      });
      const modelCfg = resolveModelOrThrow(
        db,
        agentCtx,
        req.header('x-openai-key'),
        req.header('x-model-config-id') || undefined,
      );

      const { timeoutMs } = agentCtx.agent.executionLimits;
      const release = await sessionLock.acquire(sessionId, timeoutMs);

      const controller = new AbortController();
      const { signal } = controller;
      const runId = randomUUID();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let heartbeatId: ReturnType<typeof setInterval> | undefined;

      try {
        await safePluginCall(() =>
          agentCtx.pluginDispatcher.onSessionStart({
            sessionId,
            agentId: session.agentId,
            agent: agentCtx.agent,
          }),
        );

        ({ timeoutId, heartbeatId } = startRuntimeResponse(req, res, controller, timeoutMs));
        const emitter: OutputEmitter = createNdjsonEmitter(res);
        const dispatcher = agentCtx.pluginDispatcher;

        await emitTaskStart(agentCtx, sessionId, runId);

        const graph = buildRuntimeGraph(db, agentCtx, runId, sessionId, emitter, options);

        const { messages, dropped, contextTokens } = buildConversationMessages(
          db,
          sessionId,
          message,
          agentCtx.systemPrompt,
          agentCtx.agent.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
        );

        // Auto-generate a human-readable title on first user message
        if (!session.title) {
          updateSessionTitle(db, sessionId, deriveSessionTitle(message));
        }
        const initialState = buildInitialState(runId, sessionId, messages, agentCtx, modelCfg, {
          dropped,
          contextTokens,
        });

        const finalState: { messages?: ChatMessage[] } = await graph.invoke(initialState, {
          configurable: { thread_id: sessionId, signal },
        });

        persistNewMessages(db, sessionId, finalState?.messages, messages.length);
        await safePluginCall(() =>
          dispatcher.onTaskEnd({
            sessionId,
            runId,
            taskId: runId,
            ok: true,
          }),
        );
      } catch (err) {
        await emitRuntimeFailure(agentCtx, sessionId, runId, signal, res, err);
      } finally {
        await closeRuntimeStream({ timeoutId, heartbeatId, release, agentCtx, res });
      }
    }),
  );

  // LEGACY: Raw OpenAI pass-through (deprecated)
  router.post(
    '/stream',
    asyncHandler(async (req, res) => {
      res.setHeader('X-Deprecated', 'Use POST /v1/chat with { sessionId, message } instead');

      const body = parseBody(LegacyChatStreamBodySchema, req.body);
      const gated = resolveGatedOpenAiKeyForRequest({
        preferredEnvVar: 'AGENT_OPENAI_API_KEY',
        headerKey: req.header('x-openai-key'),
      });
      const apiOutcome = openAiKeyGateToApiOutcome(gated);
      if (apiOutcome.kind === 'error') {
        throw new HttpError(400, apiOutcome.code, apiOutcome.message);
      }

      const result = streamChat({
        provider: 'openai',
        apiKey: apiOutcome.key,
        model: body.model,
        messages: body.messages,
      });
      res.status(200);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      try {
        for await (const chunk of result.textStream) {
          if (req.aborted || res.writableEnded) break;
          res.write(chunk);
        }
      } finally {
        if (!res.writableEnded) res.end();
      }
    }),
  );

  return router;
}

// ---------------------------------------------------------------------------
// State builders (extracted for readability)
// ---------------------------------------------------------------------------

function prepareNdjsonResponse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

function buildConversationMessages(
  db: DrizzleDb,
  sessionId: string,
  newMessage: string,
  systemPrompt: string,
  contextWindow: ContextWindow,
): { messages: ChatMessage[]; dropped: number; contextTokens: number } {
  return withTransaction(db, (tx) => {
    const priorMessages = listMessagesBySession(tx, sessionId);
    appendMessage(tx, { sessionId, role: 'user', content: newMessage });

    const history = sanitiseToolCallHistory(priorMessages.map(dbRecordToChatMessage));
    const userMsg: ChatMessage = { role: 'user' as const, content: newMessage };
    const counter = createApproximateCounter();

    return buildWindowedContext(systemPrompt, history, userMsg, contextWindow, counter);
  });
}

function buildInitialState(
  runId: string,
  sessionId: string,
  messages: ChatMessage[],
  agentCtx: AgentContext,
  modelConfig: { provider: string; model: string; apiKey?: string },
  contextInfo: { dropped: number; contextTokens: number },
): HarnessStateType {
  const strategy = agentCtx.agent.contextWindow?.strategy ?? 'truncate';
  const totalMessages = messages.length - 2 + contextInfo.dropped; // exclude system + user
  return {
    trace: [
      {
        type: 'context_window' as const,
        contextTokens: contextInfo.contextTokens,
        messagesTotal: totalMessages,
        messagesIncluded: messages.length - 2, // exclude system + new user message
        strategy,
      },
    ],
    plan: null,
    taskIndex: 0,
    limits: agentCtx.agent.executionLimits,
    runId,
    sessionId,
    halted: false,
    mode: 'react' as const,
    messages,
    toolDefinitions: contractToolsToDefinitions(agentCtx.tools),
    llmOutput: null,
    modelConfig,
    stepCount: 0,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    totalToolCalls: 0,
    loadedSkillIds: [],
    totalRetries: 0,
    startedAtMs: Date.now(),
    deadlineMs: agentCtx.agent.executionLimits.timeoutMs,
    iterations: 0,
    critique: undefined,
    dodAttempts: 0,
    dodContract: undefined,
  };
}
