import type { DrizzleDb } from '@agent-platform/db';
import { getSession, appendMessage, listMessagesBySession } from '@agent-platform/db';
import type { MessageRecord } from '@agent-platform/contracts';
import {
  buildAgentContext,
  destroyAgentContext,
  AgentNotFoundError,
  buildHarnessGraph,
  createLlmReasonNode,
  createToolDispatchNode,
  createNdjsonEmitter,
  contractToolsToDefinitions,
} from '@agent-platform/harness';
import type { AgentContext, ChatMessage, OutputEmitter } from '@agent-platform/harness';
import {
  resolveModelConfig,
  openAiKeyGateToApiOutcome,
  resolveGatedOpenAiKeyForRequest,
  streamOpenAiChat,
} from '@agent-platform/model-router';
import type { Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
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

/** Resolve model config or throw an HttpError on failure (cleans up agent ctx). */
function resolveModelOrThrow(
  agentCtx: AgentContext,
  headerKey: string | undefined,
): { provider: string; model: string; apiKey: string } {
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

/** Invoke graph.invoke wrapped in a timeout race. */
async function invokeWithTimeout<T>(graphPromise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('__TIMEOUT__')), timeoutMs);
  });
  try {
    return await Promise.race([graphPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Persist only the new assistant/tool messages the graph appended. */
function persistNewMessages(
  db: DrizzleDb,
  sessionId: string,
  allMessages: ChatMessage[] | undefined,
  initialCount: number,
): void {
  if (!allMessages) return;
  for (const msg of allMessages.slice(initialCount)) {
    if (msg.role !== 'assistant' && msg.role !== 'tool') continue;
    appendMessage(db, {
      sessionId,
      role: msg.role,
      content: msg.content,
      toolCallId: msg.role === 'tool' ? msg.toolCallId : undefined,
    });
  }
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
function emitStreamError(res: Response, err: unknown, timeoutMs: number): void {
  if (res.writableEnded) return;
  const isTimeout = err instanceof Error && err.message === '__TIMEOUT__';
  const errorEvent = isTimeout
    ? {
        type: 'error' as const,
        code: 'TIMEOUT',
        message: `Execution timeout exceeded (${timeoutMs}ms)`,
      }
    : {
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

  // Session-aware agent chat (NDJSON stream of Output events)
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { sessionId, message } = parseBody(ChatBodySchema, req.body);

      const session = getSession(db, sessionId);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');

      const agentCtx = await loadAgentContext(db, session.agentId);
      const modelCfg = resolveModelOrThrow(agentCtx, req.header('x-openai-key'));

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

        const graph = buildHarnessGraph({
          executeTool: async () => ({ ok: true }),
          llmReasonNode: createLlmReasonNode({ emitter, dispatcher }),
          toolDispatchNode: createToolDispatchNode({
            agent: agentCtx.agent,
            mcpManager: agentCtx.mcpManager,
            emitter,
            dispatcher,
          }),
          dispatcher,
        });

        const messages = buildConversationMessages(db, sessionId, message, agentCtx.systemPrompt);
        const initialState = buildInitialState(sessionId, messages, agentCtx, modelCfg);

        const finalState = (await invokeWithTimeout(
          graph.invoke(initialState, { configurable: { thread_id: sessionId } }),
          agentCtx.agent.executionLimits.timeoutMs,
        )) as { messages?: ChatMessage[] };

        persistNewMessages(db, sessionId, finalState?.messages, messages.length);
      } catch (err) {
        await safePluginCall(() =>
          agentCtx.pluginDispatcher.onError({
            sessionId,
            runId: 'unknown',
            phase: err instanceof Error && err.message === '__TIMEOUT__' ? 'session' : 'unknown',
            error: err,
          }),
        );
        emitStreamError(res, err, agentCtx.agent.executionLimits.timeoutMs);
      } finally {
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

      const result = streamOpenAiChat({
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
): ChatMessage[] {
  const priorMessages = listMessagesBySession(db, sessionId);
  appendMessage(db, { sessionId, role: 'user', content: newMessage });
  return [
    { role: 'system', content: systemPrompt },
    ...priorMessages.map(dbRecordToChatMessage),
    { role: 'user' as const, content: newMessage },
  ];
}

function buildInitialState(
  sessionId: string,
  messages: ChatMessage[],
  agentCtx: AgentContext,
  modelConfig: { provider: string; model: string; apiKey: string },
) {
  return {
    trace: [],
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
  };
}
