import type { DrizzleDb } from '@agent-platform/db';
import { getSession } from '@agent-platform/db';
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
import type { ChatMessage, LlmModelConfig, OutputEmitter } from '@agent-platform/harness';
import {
  openAiKeyGateToApiOutcome,
  resolveGatedOpenAiKeyForRequest,
  streamOpenAiChat,
} from '@agent-platform/model-router';
import { Router } from 'express';
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
// Router factory
// ---------------------------------------------------------------------------

export function createChatRouter(db: DrizzleDb): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // NEW: Session-aware agent chat (NDJSON stream of Output events)
  // -------------------------------------------------------------------------
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { sessionId, message } = parseBody(ChatBodySchema, req.body);

      // 1. Load session
      const session = getSession(db, sessionId);
      if (!session) {
        throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      }

      // 2. Resolve API key
      const gated = resolveGatedOpenAiKeyForRequest({
        preferredEnvVar: 'AGENT_OPENAI_API_KEY',
        headerKey: req.header('x-openai-key'),
      });
      const apiOutcome = openAiKeyGateToApiOutcome(gated);
      if (apiOutcome.kind === 'error') {
        throw new HttpError(400, apiOutcome.code, apiOutcome.message);
      }

      // 3. Build agent context
      let agentCtx;
      try {
        agentCtx = await buildAgentContext(db, session.agentId);
      } catch (err) {
        if (err instanceof AgentNotFoundError) {
          throw new HttpError(404, 'NOT_FOUND', `Agent '${session.agentId}' not found`);
        }
        throw err;
      }

      try {
        // 4. Prepare streaming
        res.status(200);
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const emitter: OutputEmitter = createNdjsonEmitter(res);

        // 5. Build model config
        const modelConfig: LlmModelConfig = {
          provider: agentCtx.modelConfig.provider,
          model: agentCtx.modelConfig.model,
          apiKey: apiOutcome.key,
        };

        // 6. Build graph nodes
        const llmReasonNode = createLlmReasonNode(emitter);
        const toolDispatchNode = createToolDispatchNode({
          agent: agentCtx.agent,
          mcpManager: agentCtx.mcpManager,
          emitter,
        });

        const graph = buildHarnessGraph({
          executeTool: async () => ({ ok: true }),
          llmReasonNode,
          toolDispatchNode,
        });

        // 7. Build initial state
        const messages: ChatMessage[] = [
          { role: 'system', content: agentCtx.systemPrompt },
          { role: 'user', content: message },
        ];

        const initialState = {
          trace: [],
          plan: null,
          taskIndex: 0,
          limits: agentCtx.agent.executionLimits,
          runId: randomUUID(),
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

        // 8. Invoke graph
        await graph.invoke(initialState, {
          configurable: { thread_id: sessionId },
        });
      } catch (err) {
        // Emit error event if stream is still writable
        if (!res.writableEnded) {
          const errorEvent = {
            type: 'error' as const,
            message: err instanceof Error ? err.message : 'Graph execution failed',
          };
          res.write(JSON.stringify(errorEvent) + '\n');
        }
      } finally {
        await destroyAgentContext(agentCtx);
        if (!res.writableEnded) {
          res.end();
        }
      }
    }),
  );

  // -------------------------------------------------------------------------
  // LEGACY: Raw OpenAI pass-through (deprecated)
  // -------------------------------------------------------------------------
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
      const apiKey = apiOutcome.key;
      const result = streamOpenAiChat({
        apiKey,
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
        if (!res.writableEnded) {
          res.end();
        }
      }
    }),
  );

  return router;
}
