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
  createCriticNode,
  createDodCheckNode,
  createDodProposeNode,
  createNdjsonEmitter,
  contractToolsToDefinitions,
  createApproximateCounter,
  buildWindowedContext,
  createSystemToolExecutor,
  PathJail,
  DEFAULT_MOUNTS,
  createToolAuditLogger,
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
 *  3. `agentCtx.agent.modelOverride` + `headerKey` (x-openai-key) + env-var chain
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
 * Sanitise replayed history so that no `role:'tool'` message appears without
 * a preceding assistant message that carries the matching `tool_calls`.
 *
 * Older rows may not have persisted assistant `toolCalls`; without them, every
 * persisted tool message would be orphaned and the OpenAI API rejects the
 * conversation with:
 *   "messages with role 'tool' must be a response to a preceding message with 'tool_calls'"
 *
 * Strip any legacy orphan rows whose preceding assistant message has no
 * matching `toolCalls`.
 */
function stripOrphanToolMessages(history: ChatMessage[]): ChatMessage[] {
  const cleaned: ChatMessage[] = [];
  for (const msg of history) {
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

  const errorEvent = {
    type: 'error' as const,
    message: err instanceof Error ? err.message : 'Graph execution failed',
  };
  res.write(JSON.stringify(errorEvent) + '\n');
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
  const history = stripOrphanToolMessages(
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

function buildRuntimeGraph(
  db: DrizzleDb,
  agentCtx: AgentContext,
  runId: string,
  sessionId: string,
  emitter: OutputEmitter,
  options: ChatRouterOptions,
  approvedToolCallIds?: ReadonlySet<string>,
) {
  return buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode:
      options.llmReasonNode ??
      createLlmReasonNode({ emitter, dispatcher: agentCtx.pluginDispatcher }),
    toolDispatchNode: createToolDispatchNode({
      agent: agentCtx.agent,
      tools: agentCtx.tools,
      mcpManager: agentCtx.mcpManager,
      nativeToolExecutor: createSystemToolExecutor(
        options.observabilityStore
          ? {
              observability: {
                store: options.observabilityStore,
                sessionId,
                traceId: runId,
              },
            }
          : undefined,
      ),
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
    }),
    criticNode: options.disableEvaluatorNodes
      ? undefined
      : createCriticNode({ emitter, dispatcher: agentCtx.pluginDispatcher }),
    dodProposeNode: options.disableEvaluatorNodes ? undefined : createDodProposeNode(),
    dodCheckNode: options.disableEvaluatorNodes
      ? undefined
      : createDodCheckNode({ emitter, dispatcher: agentCtx.pluginDispatcher }),
    dispatcher: agentCtx.pluginDispatcher,
  });
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
  const modelCfg = resolveModelOrThrow(db, agentCtx, req.header('x-openai-key'));
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

    await safePluginCall(() =>
      agentCtx.pluginDispatcher.onTaskStart({
        sessionId,
        runId,
        planId: runId,
        taskId: runId,
        toolIds: agentCtx.tools.map((tool) => tool.id),
      }),
    );

    prepareNdjsonResponse(res);
    const emitter: OutputEmitter = createNdjsonEmitter(res);

    req.on('close', () => {
      if (!res.writableFinished) controller.abort('client_disconnect');
    });
    timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
    heartbeatId = setInterval(() => {
      if (!res.writableEnded) res.write('\n');
    }, 15_000);

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
      const dispatchNode = createToolDispatchNode({
        agent: agentCtx.agent,
        tools: agentCtx.tools,
        mcpManager: agentCtx.mcpManager,
        nativeToolExecutor: createSystemToolExecutor(
          options.observabilityStore
            ? {
                observability: {
                  store: options.observabilityStore,
                  sessionId,
                  traceId: runId,
                },
              }
            : undefined,
        ),
        emitter,
        dispatcher: agentCtx.pluginDispatcher,
        pathJail: new PathJail(DEFAULT_MOUNTS),
        auditLog: createAuditLog(db),
        approvedToolCallIds: new Set([toolCall.id]),
        skillResolver: (id: string) => getSkill(db, id),
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
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (heartbeatId) clearInterval(heartbeatId);
    release();
    await destroyAgentContext(agentCtx);
    if (!res.writableEnded) res.end();
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

        prepareNdjsonResponse(res);
        const emitter: OutputEmitter = createNdjsonEmitter(res);
        const dispatcher = agentCtx.pluginDispatcher;

        await safePluginCall(() =>
          dispatcher.onTaskStart({
            sessionId,
            runId,
            planId: runId,
            taskId: runId,
            toolIds: agentCtx.tools.map((tool) => tool.id),
          }),
        );

        // Abort on client disconnect
        req.on('close', () => {
          if (!res.writableFinished) controller.abort('client_disconnect');
        });

        // Abort on timeout
        timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);

        // Heartbeat: emit empty NDJSON lines to keep the body stream alive
        // during long MCP tool executions (prevents undici body timeout).
        heartbeatId = setInterval(() => {
          if (!res.writableEnded) res.write('\n');
        }, 15_000);

        // Create DB-backed audit store for tool execution logging
        const auditStore: ToolAuditStore = {
          insert: (entry) => insertToolExecution(db, entry),
          complete: (id, data) => completeToolExecution(db, id, data),
        };
        const auditLog = createToolAuditLogger(auditStore);

        const graph = buildHarnessGraph({
          executeTool: async () => ({ ok: true }),
          llmReasonNode: options.llmReasonNode ?? createLlmReasonNode({ emitter, dispatcher }),
          toolDispatchNode: createToolDispatchNode({
            agent: agentCtx.agent,
            tools: agentCtx.tools,
            mcpManager: agentCtx.mcpManager,
            nativeToolExecutor: createSystemToolExecutor(
              options.observabilityStore
                ? {
                    observability: {
                      store: options.observabilityStore,
                      sessionId,
                      traceId: runId,
                    },
                  }
                : undefined,
            ),
            emitter,
            dispatcher,
            pathJail: new PathJail(DEFAULT_MOUNTS),
            auditLog,
            approvalRequests: {
              create: (request) =>
                createApprovalRequest(db, {
                  id: randomUUID(),
                  ...request,
                }),
            },
            skillResolver: (id: string) => getSkill(db, id),
          }),
          criticNode: options.disableEvaluatorNodes
            ? undefined
            : createCriticNode({ emitter, dispatcher }),
          dodProposeNode: options.disableEvaluatorNodes ? undefined : createDodProposeNode(),
          dodCheckNode: options.disableEvaluatorNodes
            ? undefined
            : createDodCheckNode({ emitter, dispatcher }),
          dispatcher,
        });

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
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (heartbeatId) clearInterval(heartbeatId);
        release();
        await destroyAgentContext(agentCtx);
        if (!res.writableEnded) res.end();
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

    const history = stripOrphanToolMessages(priorMessages.map(dbRecordToChatMessage));
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
