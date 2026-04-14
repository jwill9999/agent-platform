import {
  AgentSchema,
  McpServerSchema,
  SessionCreateBodySchema,
  SessionRecordSchema,
  SkillSchema,
  ToolSchema,
} from '@agent-platform/contracts';
import { streamOpenAiChat } from '@agent-platform/model-router';
import type { DrizzleDb } from '@agent-platform/db';
import {
  createSession,
  deleteAgent,
  deleteMcpServer,
  deleteSession,
  deleteSkill,
  deleteTool,
  getMcpServer,
  getSession,
  getSkill,
  getTool,
  listAgents,
  listMcpServers,
  listSessions,
  listSkills,
  listTools,
  loadAgentById,
  replaceAgent,
  replaceSession,
  upsertMcpServer,
  upsertSkill,
  upsertTool,
} from '@agent-platform/db';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request body', r.error.flatten());
  }
  return r.data;
}

export function createV1Router(db: DrizzleDb): Router {
  const router = Router();

  /** Single-user local stub (no auth yet). */
  router.use((_req, _res, next) => {
    next();
  });

  router.get(
    '/skills',
    asyncHandler(async (_req, res) => {
      res.json({ data: listSkills(db) });
    }),
  );

  router.get(
    '/skills/:id',
    asyncHandler(async (req, res) => {
      const skill = getSkill(db, req.params.id!);
      if (!skill) throw new HttpError(404, 'NOT_FOUND', 'Skill not found');
      res.json({ data: skill });
    }),
  );

  router.post(
    '/skills',
    asyncHandler(async (req, res) => {
      const skill = parseBody(SkillSchema, req.body);
      upsertSkill(db, skill);
      res.status(201).json({ data: skill });
    }),
  );

  router.put(
    '/skills/:id',
    asyncHandler(async (req, res) => {
      const skill = parseBody(SkillSchema, req.body);
      if (skill.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      upsertSkill(db, skill);
      res.json({ data: skill });
    }),
  );

  router.delete(
    '/skills/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteSkill(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Skill not found');
      res.status(204).send();
    }),
  );

  router.get(
    '/tools',
    asyncHandler(async (_req, res) => {
      res.json({ data: listTools(db) });
    }),
  );

  router.get(
    '/tools/:id',
    asyncHandler(async (req, res) => {
      const tool = getTool(db, req.params.id!);
      if (!tool) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      res.json({ data: tool });
    }),
  );

  router.post(
    '/tools',
    asyncHandler(async (req, res) => {
      const tool = parseBody(ToolSchema, req.body);
      upsertTool(db, tool);
      res.status(201).json({ data: tool });
    }),
  );

  router.put(
    '/tools/:id',
    asyncHandler(async (req, res) => {
      const tool = parseBody(ToolSchema, req.body);
      if (tool.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      upsertTool(db, tool);
      res.json({ data: tool });
    }),
  );

  router.delete(
    '/tools/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteTool(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      res.status(204).send();
    }),
  );

  router.get(
    '/mcp-servers',
    asyncHandler(async (_req, res) => {
      res.json({ data: listMcpServers(db) });
    }),
  );

  router.get(
    '/mcp-servers/:id',
    asyncHandler(async (req, res) => {
      const m = getMcpServer(db, req.params.id!);
      if (!m) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.json({ data: m });
    }),
  );

  router.post(
    '/mcp-servers',
    asyncHandler(async (req, res) => {
      const m = parseBody(McpServerSchema, req.body);
      upsertMcpServer(db, m);
      res.status(201).json({ data: m });
    }),
  );

  router.put(
    '/mcp-servers/:id',
    asyncHandler(async (req, res) => {
      const m = parseBody(McpServerSchema, req.body);
      if (m.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      upsertMcpServer(db, m);
      res.json({ data: m });
    }),
  );

  router.delete(
    '/mcp-servers/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteMcpServer(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.status(204).send();
    }),
  );

  router.get(
    '/agents',
    asyncHandler(async (_req, res) => {
      res.json({ data: listAgents(db) });
    }),
  );

  router.get(
    '/agents/:id',
    asyncHandler(async (req, res) => {
      const agent = loadAgentById(db, req.params.id!);
      if (!agent) throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      res.json({ data: agent });
    }),
  );

  router.post(
    '/agents',
    asyncHandler(async (req, res) => {
      const agent = parseBody(AgentSchema, req.body);
      replaceAgent(db, agent);
      res.status(201).json({ data: agent });
    }),
  );

  router.put(
    '/agents/:id',
    asyncHandler(async (req, res) => {
      const agent = parseBody(AgentSchema, req.body);
      if (agent.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      replaceAgent(db, agent);
      res.json({ data: agent });
    }),
  );

  router.delete(
    '/agents/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteAgent(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      res.status(204).send();
    }),
  );

  router.get(
    '/sessions',
    asyncHandler(async (req, res) => {
      const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
      res.json({ data: listSessions(db, agentId) });
    }),
  );

  router.get(
    '/sessions/:id',
    asyncHandler(async (req, res) => {
      const session = getSession(db, req.params.id!);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      res.json({ data: session });
    }),
  );

  router.post(
    '/sessions',
    asyncHandler(async (req, res) => {
      const body = parseBody(SessionCreateBodySchema, req.body);
      try {
        const session = createSession(db, body);
        res.status(201).json({ data: session });
      } catch (e) {
        if (isSqliteConstraint(e)) {
          throw new HttpError(409, 'CONFLICT', 'Session id already exists or foreign key failed');
        }
        throw e;
      }
    }),
  );

  router.put(
    '/sessions/:id',
    asyncHandler(async (req, res) => {
      const record = parseBody(SessionRecordSchema, req.body);
      if (record.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      try {
        replaceSession(db, record);
        res.json({ data: record });
      } catch (e) {
        if (isSqliteConstraint(e)) {
          throw new HttpError(400, 'CONSTRAINT_VIOLATION', 'Invalid session update');
        }
        throw e;
      }
    }),
  );

  router.delete(
    '/sessions/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteSession(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      res.status(204).send();
    }),
  );

  const ChatStreamBodySchema = z.object({
    model: z.string().min(1),
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    ),
  });

  /** Streaming text (OpenAI via Vercel AI SDK). Key from env or `x-openai-key` (never logged). */
  router.post(
    '/chat/stream',
    asyncHandler(async (req, res) => {
      const body = parseBody(ChatStreamBodySchema, req.body);
      const apiKey = req.header('x-openai-key') ?? process.env.OPENAI_API_KEY;
      if (!apiKey?.trim()) {
        throw new HttpError(400, 'MISSING_KEY', 'Set OPENAI_API_KEY or x-openai-key header');
      }
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

function isSqliteConstraint(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  if (!('code' in e)) return false;
  const code = String((e as { code: unknown }).code);
  return code.includes('SQLITE_CONSTRAINT');
}
