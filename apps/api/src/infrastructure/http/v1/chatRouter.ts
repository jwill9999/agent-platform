import {
  openAiKeyGateToApiOutcome,
  resolveGatedOpenAiKeyForRequest,
  streamOpenAiChat,
} from '@agent-platform/model-router';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody } from './routerUtils.js';

const ChatStreamBodySchema = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    }),
  ),
});

export function createChatRouter(): Router {
  const router = Router();

  /** Streaming text (OpenAI via Vercel AI SDK). Key from env or `x-openai-key` (never logged). */
  router.post(
    '/stream',
    asyncHandler(async (req, res) => {
      const body = parseBody(ChatStreamBodySchema, req.body);
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
