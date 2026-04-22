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
  getModelConfig,
  resolveModelConfigKey,
  parseMasterKeyFromBase64,
} from '@agent-platform/db';
import type { ContextWindow, MessageRecord } from '@agent-platform/contracts';
import { DEFAULT_CONTEXT_WINDOW } from '@agent-platform/contracts';
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
} from '@agent-platform/harness';
import type {
  AgentContext,
  ChatMessage,
  OutputEmitter,
  ToolAuditStore,
} from '@agent-platform/harness';
import {
  resolveModelConfig,
  openAiKeyGateToApiOutcome,
  resolveGatedOpenAiKeyForRequest,
  streamChat,
} from '@agent-platform/model-router';
import type { Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { createInProcessSessionLock } from '../sessionLock.js';
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

/** Derive a human-readable session title from the first user message. */
function deriveSessionTitle(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  const cut = trimmed.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Build agent context; translates AgentNotFoundError to HttpError. */
async function loadAgentContext(db: DrizzleDb, agentId: string): Promise<AgentContext> {
  try {
    return await buildAgentContext(db, agentId);
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
function dbRecordToChatMessage(m: MessageRecord): ChatMessage {
  if (m.role === 'tool' && m.toolCallId) {
    return { role: 'tool', content: m.content, toolCallId: m.toolCallId, toolName: '' };
  }
  return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
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

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createChatRouter(db: DrizzleDb): Router {
  const router = createRouter();
  const sessionLock = createInProcessSessionLock();

  // Session-aware agent chat (NDJSON stream of Output events)
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { sessionId, message } = parseBody(ChatBodySchema, req.body);

      const session = getSession(db, sessionId);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');

      const agentCtx = await loadAgentContext(db, session.agentId);
      const modelCfg = resolveModelOrThrow(
        db,
        agentCtx,
        req.header('x-openai-key'),
        req.header('x-model-config-id') || undefined,
      );

      const timeoutMs = agentCtx.agent.executionLimits.timeoutMs;
      const release = await sessionLock.acquire(sessionId, timeoutMs);

      const controller = new AbortController();
      const { signal } = controller;
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
          llmReasonNode: createLlmReasonNode({ emitter, dispatcher }),
          toolDispatchNode: createToolDispatchNode({
            agent: agentCtx.agent,
            mcpManager: agentCtx.mcpManager,
            nativeToolExecutor: createSystemToolExecutor(),
            emitter,
            dispatcher,
            pathJail: new PathJail(DEFAULT_MOUNTS),
            auditLog,
            skillResolver: (id: string) => getSkill(db, id),
          }),
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
        const initialState = buildInitialState(sessionId, messages, agentCtx, modelCfg, {
          dropped,
          contextTokens,
        });

        const finalState: { messages?: ChatMessage[] } = await graph.invoke(initialState, {
          configurable: { thread_id: sessionId, signal },
        });

        persistNewMessages(db, sessionId, finalState?.messages, messages.length);
      } catch (err) {
        await safePluginCall(() =>
          agentCtx.pluginDispatcher.onError({
            sessionId,
            runId: 'unknown',
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

    const history = priorMessages.map(dbRecordToChatMessage);
    const userMsg: ChatMessage = { role: 'user' as const, content: newMessage };
    const counter = createApproximateCounter();

    return buildWindowedContext(systemPrompt, history, userMsg, contextWindow, counter);
  });
}

function buildInitialState(
  sessionId: string,
  messages: ChatMessage[],
  agentCtx: AgentContext,
  modelConfig: { provider: string; model: string; apiKey?: string },
  contextInfo: { dropped: number; contextTokens: number },
) {
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
    runId: randomUUID(),
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
    startedAtMs: Date.now(),
    deadlineMs: agentCtx.agent.executionLimits.timeoutMs,
  };
}
