import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeDatabase, DEFAULT_AGENT_ID, openDatabase, runSeed } from '@agent-platform/db';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { restoreChatEnv, snapshotChatEnv } from './support/chatEnv.js';

const mockStreamText = vi.hoisted(() => vi.fn());
const mockToolCalls = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  jsonSchema: (schema: unknown) => ({ type: 'json-schema', jsonSchema: schema }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI:
    ({ apiKey }: { apiKey: string }) =>
    (model: string) => ({ provider: 'openai', modelId: model, apiKey }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic:
    ({ apiKey }: { apiKey: string }) =>
    (model: string) => ({ provider: 'anthropic', modelId: model, apiKey }),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible:
    ({ name, apiKey, baseURL }: { name: string; apiKey: string; baseURL: string }) =>
    (model: string) => ({ provider: name, modelId: model, apiKey, baseURL }),
}));

async function createSeededApp(
  dirs: string[],
  options: { mockLlm?: boolean } = {},
): Promise<{
  app: Application;
  db: ReturnType<typeof openDatabase>['db'];
  sqlite: ReturnType<typeof openDatabase>['sqlite'];
}> {
  const { createApp } = await import('../src/infrastructure/http/createApp.js');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-session-chat-'));
  dirs.push(dir);
  const sqlitePath = path.join(dir, 'db.sqlite');
  const { db, sqlite } = openDatabase(sqlitePath);
  runSeed(db);
  const llmReasonNode = async (state: { taskIndex?: number; totalTokensUsed?: number }) => {
    const result = mockToolCalls();
    if (typeof result === 'string') {
      return {
        llmOutput: { kind: 'text' as const, content: result },
        messages: [{ role: 'assistant' as const, content: result }],
        trace: [{ type: 'llm_call' as const, step: state.taskIndex ?? 0 }],
        totalTokensUsed: (state.totalTokensUsed ?? 0) + 2,
      };
    }
    if (!Array.isArray(result)) throw new Error('Mock LLM response not configured');
    return {
      llmOutput: { kind: 'tool_calls' as const, calls: result },
      messages: [{ role: 'assistant' as const, content: '', toolCalls: result }],
      trace: [{ type: 'llm_call' as const, step: state.taskIndex ?? 0 }],
      totalTokensUsed: (state.totalTokensUsed ?? 0) + 2,
    };
  };
  return {
    app: createApp({
      db,
      ...(options.mockLlm ? { v1: { chat: { llmReasonNode, disableEvaluatorNodes: true } } } : {}),
    }),
    db,
    sqlite,
  };
}

function mockToolCallStream(toolName: string, args: Record<string, unknown>) {
  mockToolCalls.mockReturnValueOnce([{ id: 'tc-approval', name: toolName, args }]);
  mockStreamText.mockReturnValueOnce({
    textStream: (async function* () {})(),
    fullStream: (async function* () {})(),
    text: Promise.resolve(''),
    reasoning: Promise.resolve(undefined),
    toolCalls: Promise.resolve([{ toolCallId: 'tc-approval', toolName, args }]),
    usage: Promise.resolve({ promptTokens: 1, completionTokens: 1 }),
  });
}

type TestDb = ReturnType<typeof openDatabase>['db'];
type ChatEvent = { type: string; approvalRequestId?: string; code?: string };

function parseNdjsonEvents(text: string): ChatEvent[] {
  return String(text)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatEvent);
}

async function createDefaultSession(app: Application): Promise<string> {
  const sessionRes = await request(app).post('/v1/sessions').send({ agentId: DEFAULT_AGENT_ID });
  expect(sessionRes.status).toBe(201);
  return sessionRes.body.data.id;
}

async function createPendingToolApproval(app: Application, sessionId: string) {
  mockToolCallStream('sys_bash', { command: 'date' });
  const chatRes = await request(app)
    .post('/v1/chat')
    .send({ sessionId, message: 'Run date' })
    .expect(200);
  const events = parseNdjsonEvents(chatRes.text);
  const approvalEvent = events.find((event) => event.type === 'approval_required');
  expect(approvalEvent?.approvalRequestId).toEqual(expect.any(String));
  return { approvalEvent, approvalRequestId: approvalEvent!.approvalRequestId!, events };
}

async function expectToolExecutionCount(
  db: TestDb,
  sessionId: string,
  status: 'pending' | 'success',
  expected: number,
) {
  const { countToolExecutions } = await import('@agent-platform/db');
  expect(
    countToolExecutions(db, {
      sessionId,
      toolName: 'sys_bash',
      status,
      limit: 10,
      offset: 0,
    }),
  ).toBe(expected);
}

describe('POST /v1/chat (session-aware)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    mockStreamText.mockReset();
    mockToolCalls.mockReset();
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it('returns 400 for invalid request body', async () => {
    const { app, sqlite } = await createSeededApp(dirs);
    try {
      const res = await request(app).post('/v1/chat').send({ bad: 'body' }).expect(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    } finally {
      closeDatabase(sqlite);
    }
  });

  it('returns 404 when session does not exist', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs);
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId: 'nonexistent', message: 'hello' })
        .expect(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');
      expect(res.body.error?.message).toContain('Session');
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('returns 400 when no API key is configured', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs);
    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AGENT_OPENAI_API_KEY;
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;

      const sessionId = await createDefaultSession(app);

      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'hello' })
        .expect(400);
      expect(res.body.error?.code).toBe('MISSING_KEY');
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('returns 404 when agent for session does not exist', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs);
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);

      // Delete agent directly via sqlite (bypass FK checks)
      sqlite.pragma('foreign_keys = OFF');
      sqlite.exec(`DELETE FROM agents WHERE id = '${DEFAULT_AGENT_ID}'`);

      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'hello' })
        .expect(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');
      expect(res.body.error?.message).toContain('Agent');
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('persists user messages to conversation history', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    let sessionId = '';
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      sessionId = await createDefaultSession(app);

      // Send a message — the graph will likely error (no real LLM) but the user
      // message should already be persisted before graph execution starts.
      // Use a short response timeout so the test doesn't hang.
      try {
        await request(app)
          .post('/v1/chat')
          .send({ sessionId, message: 'Hello agent' })
          .timeout({ response: 2000 });
      } catch {
        // Expected: graph invoke fails or times out without a real LLM
      }

      // Verify user message was persisted
      const { listMessagesBySession } = await import('@agent-platform/db');
      const msgs = listMessagesBySession(db, sessionId);
      const userMsg = msgs.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg!.content).toBe('Hello agent');
      expect(userMsg!.sessionId).toBe(sessionId);
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('streams approval_required when a tool needs human approval', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      const { approvalEvent, events } = await createPendingToolApproval(app, sessionId);

      expect(approvalEvent).toMatchObject({
        type: 'approval_required',
        toolName: 'sys_bash',
        riskTier: 'high',
        argsPreview: { command: 'date' },
      });
      expect(approvalEvent?.approvalRequestId).toEqual(expect.any(String));
      expect(events.every((event) => event.type !== 'text')).toBe(true);

      const { listApprovalRequests } = await import('@agent-platform/db');
      expect(
        listApprovalRequests(db, { sessionId, status: 'pending', limit: 10, offset: 0 }),
      ).toHaveLength(1);
      const messages = await import('@agent-platform/db').then((mod) =>
        mod.listMessagesBySession(db, sessionId),
      );
      expect(messages.find((message) => message.role === 'assistant')?.toolCalls).toEqual([
        { id: 'tc-approval', name: 'sys_bash', args: { command: 'date' } },
      ]);
      await expectToolExecutionCount(db, sessionId, 'pending', 1);
      await expectToolExecutionCount(db, sessionId, 'success', 0);
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('resumes an approved pending tool call exactly once', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      const { approvalRequestId } = await createPendingToolApproval(app, sessionId);

      await request(app)
        .post(`/v1/approval-requests/${approvalRequestId}/approve`)
        .send({ reason: 'ok' })
        .expect(200);

      mockToolCalls.mockReturnValueOnce('Done with date');
      const resumeRes = await request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .send({ approvalRequestId })
        .expect(200);

      const events = parseNdjsonEvents(resumeRes.text);
      expect(events.some((event) => event.type === 'tool_result')).toBe(true);

      const { getApprovalRequest, listMessagesBySession } = await import('@agent-platform/db');
      await expectToolExecutionCount(db, sessionId, 'success', 1);
      expect(getApprovalRequest(db, approvalRequestId).resumedAtMs).toEqual(expect.any(Number));
      expect(listMessagesBySession(db, sessionId).map((message) => message.role)).toEqual([
        'user',
        'assistant',
        'tool',
        'assistant',
      ]);

      const duplicateResume = await request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .send({ approvalRequestId })
        .expect(200);
      expect(duplicateResume.body.data.resumedAtMs).toEqual(expect.any(Number));
      await expectToolExecutionCount(db, sessionId, 'success', 1);
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('resumes rejected approvals as tool errors visible to the agent', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      const { approvalRequestId } = await createPendingToolApproval(app, sessionId);

      await request(app)
        .post(`/v1/approval-requests/${approvalRequestId}/reject`)
        .send({ reason: 'unsafe' })
        .expect(200);

      mockToolCalls.mockReturnValueOnce('I will continue without that tool');
      const resumeRes = await request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .send({ approvalRequestId })
        .expect(200);
      expect(resumeRes.text).toContain('APPROVAL_REJECTED');

      const { listMessagesBySession } = await import('@agent-platform/db');
      await expectToolExecutionCount(db, sessionId, 'success', 0);
      const toolMessage = listMessagesBySession(db, sessionId).find(
        (message) => message.role === 'tool',
      );
      expect(toolMessage?.content).toContain('APPROVAL_REJECTED');
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });
});
