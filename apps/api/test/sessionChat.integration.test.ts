import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  closeDatabase,
  createMemory,
  createModelConfig,
  DEFAULT_AGENT_ID,
  openDatabase,
  parseMasterKeyFromBase64,
  queryMemories,
  runSeed,
} from '@agent-platform/db';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { restoreChatEnv, snapshotChatEnv } from './support/chatEnv.js';

const mockStreamText = vi.hoisted(() => vi.fn());
const mockGenerateText = vi.hoisted(() => vi.fn());
const mockToolCalls = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
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
  options: { mockLlm?: boolean; disableEvaluatorNodes?: boolean } = {},
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
    const result = mockToolCalls(state);
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
      ...(options.mockLlm
        ? {
            v1: {
              chat: {
                llmReasonNode,
                disableEvaluatorNodes: options.disableEvaluatorNodes ?? true,
              },
            },
          }
        : {}),
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
type ChatEvent = {
  type: string;
  approvalRequestId?: string;
  toolName?: string;
  riskTier?: string;
  code?: string;
  message?: string;
};

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
    mockGenerateText.mockReset();
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

  it('does not run DoD criteria generation in the user-facing chat runtime', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs, {
      mockLlm: true,
      disableEvaluatorNodes: false,
    });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      mockToolCalls.mockReturnValueOnce('Hello from chat');
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({ verdict: 'accept', reasons: [] }),
      });

      const sessionId = await createDefaultSession(app);
      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'test' })
        .expect(200);

      expect(res.text).not.toContain('"criteria"');
      const messagesRes = await request(app).get(`/v1/sessions/${sessionId}/messages`).expect(200);
      expect(messagesRes.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'assistant', content: 'Hello from chat' }),
        ]),
      );
      const evaluatorPrompts = mockGenerateText.mock.calls
        .flatMap((call) => {
          const arg = call[0] as { messages?: Array<{ content?: string }> };
          return arg.messages?.map((message) => message.content ?? '') ?? [];
        })
        .join('\n');
      expect(evaluatorPrompts).not.toContain('Return JSON only with shape {"criteria"');
      expect(evaluatorPrompts).not.toContain('Return JSON only matching {"criteria"');
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

  it('redacts provider auth failures emitted after NDJSON headers are sent', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    const openAiKey = ['sk-proj-', 'abcdefghijklmnopqrstuvwxyz1234567890'].join('');
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      const sessionId = await createDefaultSession(app);
      mockToolCalls.mockImplementationOnce(() => {
        throw new Error(`Incorrect API key provided: ${openAiKey}`);
      });

      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'hello' })
        .expect(200);
      const events = parseNdjsonEvents(res.text);
      const error = events.find((event) => event.type === 'error');

      expect(error).toMatchObject({
        type: 'error',
        code: 'MODEL_AUTH_FAILED',
        message:
          'The model provider rejected the configured API key. Check the selected model config or server environment key.',
      });
      expect(res.text).not.toContain(openAiKey);
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

  it('streams approval_required for external browser URLs before execution', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      mockToolCallStream('sys_browser_start', { url: 'https://example.com' });
      const chatRes = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Open example.com' })
        .expect(200);

      const events = parseNdjsonEvents(chatRes.text);
      const approvalEvent = events.find((event) => event.type === 'approval_required');
      expect(approvalEvent).toMatchObject({
        type: 'approval_required',
        toolName: 'sys_browser_start',
        riskTier: 'medium',
      });

      const { listApprovalRequests } = await import('@agent-platform/db');
      expect(
        listApprovalRequests(db, { sessionId, status: 'pending', limit: 10, offset: 0 }),
      ).toHaveLength(1);
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

  it('uses the selected model config when resuming an approved tool call', async () => {
    const envSnap = snapshotChatEnv();
    const previousMasterKey = process.env.SECRETS_MASTER_KEY;
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      const masterKeyB64 = Buffer.alloc(32, 7).toString('base64');
      process.env.SECRETS_MASTER_KEY = masterKeyB64;
      const modelConfig = createModelConfig(
        db,
        {
          name: 'Selected test config',
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: 'sk-selected-test-key',
        },
        parseMasterKeyFromBase64(masterKeyB64),
        1,
      );

      process.env.AGENT_OPENAI_API_KEY = 'sk-env-key-for-initial-chat';
      const sessionId = await createDefaultSession(app);
      const { approvalRequestId } = await createPendingToolApproval(app, sessionId);

      await request(app)
        .post(`/v1/approval-requests/${approvalRequestId}/approve`)
        .send({ reason: 'ok' })
        .expect(200);

      delete process.env.AGENT_OPENAI_API_KEY;
      mockToolCalls.mockReturnValueOnce('Done with selected model config');

      const resumeRes = await request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .set('x-model-config-id', modelConfig.id)
        .send({ approvalRequestId })
        .expect(200);

      expect(resumeRes.text).toContain('tool_result');
    } finally {
      restoreChatEnv(envSnap);
      if (previousMasterKey === undefined) delete process.env.SECRETS_MASTER_KEY;
      else process.env.SECRETS_MASTER_KEY = previousMasterKey;
      closeDatabase(sqlite);
    }
  });

  it('uses the first saved model config as the platform default when an agent has no override', async () => {
    const envSnap = snapshotChatEnv();
    const previousMasterKey = process.env.SECRETS_MASTER_KEY;
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      const masterKeyB64 = Buffer.alloc(32, 9).toString('base64');
      process.env.SECRETS_MASTER_KEY = masterKeyB64;
      delete process.env.AGENT_OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;

      createModelConfig(
        db,
        {
          name: 'Platform default',
          provider: 'openai',
          model: 'gpt-4.1-mini',
          apiKey: 'sk-platform-default-test-key',
        },
        parseMasterKeyFromBase64(masterKeyB64),
        1,
      );

      const sessionId = await createDefaultSession(app);
      mockToolCalls.mockReturnValueOnce('Used saved default config');

      await request(app).post('/v1/chat').send({ sessionId, message: 'hello' }).expect(200);

      const state = mockToolCalls.mock.calls.at(-1)?.[0] as {
        modelConfig?: { provider: string; model: string; apiKey?: string };
      };
      expect(state.modelConfig).toEqual({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        apiKey: 'sk-platform-default-test-key',
      });
    } finally {
      restoreChatEnv(envSnap);
      if (previousMasterKey === undefined) delete process.env.SECRETS_MASTER_KEY;
      else process.env.SECRETS_MASTER_KEY = previousMasterKey;
      closeDatabase(sqlite);
    }
  });

  it('persists inspectable working memory and includes it on later turns', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      const sessionId = await createDefaultSession(app);

      mockToolCalls.mockReturnValueOnce(
        'Decision: keep the working memory session scoped. Next update packages/db/src/repositories/workingMemory.ts.',
      );
      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Implement agent-platform-memory.2 for agent-platform' })
        .expect(200);

      const memoryRes = await request(app)
        .get(`/v1/sessions/${sessionId}/working-memory`)
        .expect(200);
      expect(memoryRes.body.data).toMatchObject({
        sessionId,
        currentGoal: 'Implement agent-platform-memory.2 for agent-platform',
        activeTask: 'agent-platform-memory.2',
        nextAction:
          'Decision: keep the working memory session scoped. Next update packages/db/src/repositories/workingMemory.ts.',
      });
      expect(memoryRes.body.data.decisions).toContain(
        'Decision: keep the working memory session scoped',
      );
      expect(memoryRes.body.data.importantFiles).toContain(
        'packages/db/src/repositories/workingMemory.ts',
      );

      mockToolCalls.mockReturnValueOnce('Continuing with the remembered task');
      await request(app).post('/v1/chat').send({ sessionId, message: 'Continue' }).expect(200);

      const followUpState = mockToolCalls.mock.calls.at(-1)?.[0] as {
        messages?: Array<{ role: string; content: string }>;
      };
      expect(followUpState.messages?.[0]?.content).toContain('Short-term working memory');
      expect(followUpState.messages?.[0]?.content).toContain(
        'Goal: Implement agent-platform-memory.2 for agent-platform',
      );
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('includes approved prompt memories with retrieval trace metadata', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      const sessionId = await createDefaultSession(app);
      createMemory(
        db,
        {
          scope: 'agent',
          scopeId: DEFAULT_AGENT_ID,
          kind: 'decision',
          status: 'approved',
          reviewStatus: 'approved',
          content: 'Memory retrieval must include source metadata in prompt bundles.',
          confidence: 0.91,
          source: { kind: 'manual', id: 'review-1', label: 'approved review' },
          tags: ['retrieval'],
          safetyState: 'safe',
        },
        { id: 'approved-memory', nowMs: 1000 },
      );
      createMemory(
        db,
        {
          scope: 'agent',
          scopeId: DEFAULT_AGENT_ID,
          kind: 'decision',
          status: 'pending',
          reviewStatus: 'unreviewed',
          content: 'Pending memory retrieval should not appear in prompts.',
          source: { kind: 'manual' },
          tags: ['retrieval'],
          safetyState: 'safe',
        },
        { id: 'pending-memory', nowMs: 1000 },
      );

      mockToolCalls.mockReturnValueOnce('Using approved memory.');
      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'How should memory retrieval prompt bundles work?' })
        .expect(200);

      const state = mockToolCalls.mock.calls.at(-1)?.[0] as {
        messages?: Array<{ role: string; content: string }>;
        trace?: Array<{ type: string; included?: number }>;
      };
      const systemPrompt = state.messages?.[0]?.content ?? '';
      expect(systemPrompt).toContain('Long-term approved memories');
      expect(systemPrompt).toContain('Memory retrieval must include source metadata');
      expect(systemPrompt).toContain('sourceId=review-1');
      expect(systemPrompt).not.toContain('Pending memory retrieval should not appear');
      expect(state.trace).toContainEqual(
        expect.objectContaining({ type: 'memory_retrieval', included: 1 }),
      );
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('stores bounded tool summaries instead of raw tool output in working memory', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      const sessionId = await createDefaultSession(app);
      const rawPayload = 'x'.repeat(2_000);

      mockToolCalls
        .mockReturnValueOnce([
          {
            id: 'tc-json',
            name: 'sys_json_stringify',
            args: { data: { rawPayload } },
          },
        ])
        .mockReturnValueOnce('Tool run complete');

      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Run a tool and summarize it' })
        .expect(200);

      const memoryRes = await request(app)
        .get(`/v1/sessions/${sessionId}/working-memory`)
        .expect(200);
      expect(memoryRes.body.data.toolsUsed).toContain('sys_json_stringify');
      expect(memoryRes.body.data.toolSummaries[0]).toMatchObject({
        toolName: 'sys_json_stringify',
        ok: true,
        summary: expect.any(String),
      });
      expect(memoryRes.body.data.toolSummaries[0].summary.length).toBeLessThanOrEqual(500);
      expect(JSON.stringify(memoryRes.body.data)).not.toContain(rawPayload);
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('stores explicit remember instructions as pending memory candidates', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      const sessionId = await createDefaultSession(app);
      mockToolCalls.mockReturnValueOnce('Noted for review.');

      await request(app)
        .post('/v1/chat')
        .send({
          sessionId,
          message: 'Remember that agent-platform should keep memory retrieval auditable.',
        })
        .expect(200);

      const candidates = queryMemories(db, {
        status: 'pending',
        reviewStatus: 'unreviewed',
        tag: 'explicit',
      });
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({
        scope: 'agent',
        scopeId: DEFAULT_AGENT_ID,
        status: 'pending',
        reviewStatus: 'unreviewed',
        content: 'that agent-platform should keep memory retrieval auditable.',
      });
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('does not replay unresolved pending approval tool calls into later chat turns', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      await createPendingToolApproval(app, sessionId);

      mockToolCalls.mockReturnValueOnce('I can continue without replaying pending tool calls');
      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Continue without approving yet' })
        .expect(200);

      const followUpState = mockToolCalls.mock.calls.at(-1)?.[0] as {
        messages?: Array<{ role: string; toolCalls?: unknown[] }>;
      };
      expect(followUpState.messages?.some((message) => message.toolCalls?.length)).toBe(false);
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
