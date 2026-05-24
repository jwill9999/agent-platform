import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  closeDatabase,
  createMemory,
  createModelConfig,
  createProject,
  DEFAULT_AGENT_ID,
  getProject,
  openDatabase,
  parseMasterKeyFromBase64,
  queryMemories,
  runSeed,
  updateProject,
  upsertWorkingMemoryArtifact,
} from '@agent-platform/db';
import type { NativeToolExecutor } from '@agent-platform/harness';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { restoreChatEnv, snapshotChatEnv } from './support/chatEnv.js';
import type { SessionLock } from '../src/infrastructure/http/sessionLock.js';

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

const BUILTIN_SLASH_HELP_TEXT = [
  'Available slash commands:',
  '',
  '- **/help** - Show available slash commands.',
  '  - Usage: `/help [command]`',
  '  - Scope: Current chat',
  '  - State: Does not change Project state.',
  '- **/init** - Set up Project instructions for the selected Project.',
  '  - Usage: `/init`',
  '  - Scope: Selected Project',
  '  - State: May update Project setup.',
].join('\n');

const INIT_SLASH_HELP_TEXT = [
  '### /init',
  '',
  'Set up Project instructions for the selected Project.',
  '',
  '- Usage: `/init`',
  '- Scope: Selected Project',
  '- State: May update Project setup.',
].join('\n');

async function createSeededApp(
  dirs: string[],
  options: {
    mockLlm?: boolean;
    disableEvaluatorNodes?: boolean;
    sessionLock?: SessionLock;
    systemToolExecutorFactory?: () => NativeToolExecutor;
  } = {},
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
                sessionLock: options.sessionLock,
                systemToolExecutorFactory: options.systemToolExecutorFactory,
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
type MockChatApp = Awaited<ReturnType<typeof createSeededApp>>;
type ChatEvent = {
  type: string;
  approvalRequestId?: string;
  toolName?: string;
  riskTier?: string;
  argsPreview?: unknown;
  code?: string;
  message?: string;
};

function createChatProject(
  db: TestDb,
  options: {
    name: string;
    workspaceKey?: string;
    backendProjectRoot: string;
    repositoryRoot: string;
    capabilityState: 'backend_accessible' | 'readonly' | 'unavailable';
    onboardingState?: 'missing' | 'approved' | 'needs_review' | 'in_progress';
    instructionFiles?: unknown[];
  },
) {
  return createProject(db, {
    name: options.name,
    workspaceKey: options.workspaceKey,
    metadata: {
      backendProjectRoot: options.backendProjectRoot,
      repositoryRoot: options.repositoryRoot,
      projectRoot: '/workspace',
      capabilityState: options.capabilityState,
      onboardingState: options.onboardingState ?? 'missing',
      defaultAgentProfile: 'coding',
      instructionFiles: options.instructionFiles ?? [],
    },
  });
}

async function createProjectSession(
  app: Application,
  db: TestDb,
  options: Parameters<typeof createChatProject>[1],
): Promise<string> {
  const project = createChatProject(db, options);
  const sessionRes = await request(app)
    .post('/v1/sessions')
    .send({ agentId: DEFAULT_AGENT_ID, mode: 'project', projectId: project.id })
    .expect(201);
  return sessionRes.body.data.id as string;
}

function mockProjectWrite(id: string, content: string) {
  mockToolCalls
    .mockReturnValueOnce([
      {
        id,
        name: 'sys_write_file',
        args: {
          path: '/workspace/project-note.txt',
          content,
        },
      },
    ])
    .mockReturnValueOnce('Project file written');
}

function createProjectRoot(dirs: string[]): string {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-project-chat-root-'));
  dirs.push(projectRoot);
  return projectRoot;
}

async function withMockChatApp(
  dirs: string[],
  callback: (ctx: MockChatApp) => Promise<void>,
): Promise<void> {
  const envSnap = snapshotChatEnv();
  const ctx = await createSeededApp(dirs, { mockLlm: true });
  try {
    process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
    process.env.AGENT_PLATFORM_COMMAND_RUNNER = 'host';
    await callback(ctx);
  } finally {
    restoreChatEnv(envSnap);
    closeDatabase(ctx.sqlite);
  }
}

function parseNdjsonEvents(text: string): ChatEvent[] {
  return String(text)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatEvent);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createDefaultSession(app: Application): Promise<string> {
  const sessionRes = await request(app).post('/v1/sessions').send({ agentId: DEFAULT_AGENT_ID });
  expect(sessionRes.status).toBe(201);
  return sessionRes.body.data.id;
}

async function expectHandledSlashMessage(
  app: Application,
  db: TestDb,
  sessionId: string,
  message: string,
  expectedContent: string | RegExp,
) {
  const res = await request(app).post('/v1/chat').send({ sessionId, message }).expect(200);
  expect(mockToolCalls).not.toHaveBeenCalled();
  const events = parseNdjsonEvents(res.text);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: 'text' });
  const content = events[0]!.content ?? '';
  if (typeof expectedContent === 'string') {
    expect(content).toBe(expectedContent);
  } else {
    expect(content).toMatch(expectedContent);
  }

  const { listMessagesBySession } = await import('@agent-platform/db');
  expect(listMessagesBySession(db, sessionId)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: message }),
      expect.objectContaining({
        role: 'assistant',
        content:
          typeof expectedContent === 'string'
            ? expectedContent
            : expect.stringMatching(expectedContent),
      }),
    ]),
  );
}

async function createPendingToolApproval(
  app: Application,
  sessionId: string,
  toolName = 'sys_bash',
  args?: Record<string, unknown>,
) {
  process.env.AGENT_PLATFORM_COMMAND_RUNNER = 'host';
  mockStreamText.mockReset();
  mockToolCalls.mockReset();
  mockToolCallStream(toolName, args ?? { command: 'date' });
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

  it('handles safe slash commands before model execution', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const sessionId = await createDefaultSession(app);
      await expectHandledSlashMessage(
        app,
        db,
        sessionId,
        '/does-not-exist',
        'Command not recognised. Available commands: /help, /init. Run /help for details.',
      );

      await expectHandledSlashMessage(app, db, sessionId, '/help', BUILTIN_SLASH_HELP_TEXT);
    });
  });

  it('serialises slash command handling behind the session lock', async () => {
    const envSnap = snapshotChatEnv();
    let releaseGate: (() => void) | undefined;
    let completed = false;
    const lock: SessionLock = {
      activeCount: 0,
      acquire: vi.fn(async () => {
        await new Promise<void>((resolve) => {
          releaseGate = resolve;
        });
        return vi.fn();
      }),
    };
    const { app, sqlite } = await createSeededApp(dirs, { mockLlm: true, sessionLock: lock });

    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';
      const sessionId = await createDefaultSession(app);
      const response = request(app)
        .post('/v1/chat')
        .send({ sessionId, message: '/help' })
        .then((res) => {
          completed = true;
          return res;
        });

      await delay(20);
      expect(lock.acquire).toHaveBeenCalledWith(sessionId);
      expect(completed).toBe(false);

      releaseGate?.();
      const res = await response;
      expect(res.status).toBe(200);
      expect(parseNdjsonEvents(res.text)).toEqual([
        {
          type: 'text',
          content: BUILTIN_SLASH_HELP_TEXT,
        },
      ]);
      expect(mockToolCalls).not.toHaveBeenCalled();
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('starts /init from the backend-bound Project session resolver', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
      writeFileSync(path.join(projectRoot, 'package.json'), '{"scripts":{"test":"vitest"}}\n');

      const opened = await request(app)
        .post('/v1/projects/open')
        .send({ path: projectRoot, name: 'Slash Init Project' })
        .expect(201);
      const sessionRes = await request(app)
        .post('/v1/sessions')
        .send({ agentId: DEFAULT_AGENT_ID, mode: 'project', projectId: opened.body.data.id })
        .expect(201);

      await expectHandledSlashMessage(
        app,
        db,
        sessionRes.body.data.id,
        '/init',
        'I prepared a Project instructions draft for AGENTS.md.\n\nI have not created the requested Project files yet.\nReview the draft shown in Project Chat, approve it to enable file edits, then send your request again.',
      );
      expect(existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(false);

      const project = await request(app).get(`/v1/projects/${opened.body.data.id}`).expect(200);
      expect(project.body.data.metadata.onboardingDraft).toEqual(
        expect.objectContaining({ targetPath: 'AGENTS.md' }),
      );
      expect(project.body.data.metadata.onboardingState).toBe('in_progress');
    });
  });

  it('starts desktop Project onboarding with /init as the first Project chat message', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      writeFileSync(path.join(projectRoot, 'package.json'), '{"scripts":{"test":"vitest"}}\n');

      const registered = await request(app)
        .post('/v1/projects/desktop/register')
        .set('x-agent-platform-desktop-bridge', '1')
        .send({ path: projectRoot, name: 'Desktop Slash Init Project' })
        .expect(201);
      const sessionRes = await request(app)
        .post('/v1/sessions/project')
        .send({ agentId: DEFAULT_AGENT_ID, projectId: registered.body.data.project.id })
        .expect(201);

      await expectHandledSlashMessage(
        app,
        db,
        sessionRes.body.data.session.id,
        '/help init',
        INIT_SLASH_HELP_TEXT,
      );

      await expectHandledSlashMessage(
        app,
        db,
        sessionRes.body.data.session.id,
        '/init',
        'I prepared a Project instructions draft for AGENTS.md.\n\nI have not created the requested Project files yet.\nReview the draft shown in Project Chat, approve it to enable file edits, then send your request again.',
      );
      expect(existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(false);

      const project = await request(app)
        .get(`/v1/projects/${registered.body.data.project.id}`)
        .expect(200);
      expect(project.body.data.metadata.onboardingDraft).toEqual(
        expect.objectContaining({ targetPath: 'AGENTS.md' }),
      );
      expect(project.body.data.metadata.onboardingState).toBe('in_progress');
    });
  });

  it('starts /init from the session Project binding when working memory points elsewhere', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const boundRoot = createProjectRoot(dirs);
      const rememberedRoot = createProjectRoot(dirs);
      const bound = await request(app)
        .post('/v1/projects/desktop/register')
        .set('x-agent-platform-desktop-bridge', '1')
        .send({ path: boundRoot, name: 'Bound Init Project' })
        .expect(201);
      const remembered = await request(app)
        .post('/v1/projects/desktop/register')
        .set('x-agent-platform-desktop-bridge', '1')
        .send({ path: rememberedRoot, name: 'Remembered Init Project' })
        .expect(201);
      const sessionRes = await request(app)
        .post('/v1/sessions/project')
        .send({ agentId: DEFAULT_AGENT_ID, projectId: bound.body.data.project.id })
        .expect(201);
      const sessionId = sessionRes.body.data.session.id as string;
      upsertWorkingMemoryArtifact(db, {
        sessionId,
        projectId: remembered.body.data.project.id,
        activeProject: remembered.body.data.project.id,
        currentGoal: 'Use remembered project',
      });

      await expectHandledSlashMessage(
        app,
        db,
        sessionId,
        '/init',
        'I prepared a Project instructions draft for AGENTS.md.\n\nI have not created the requested Project files yet.\nReview the draft shown in Project Chat, approve it to enable file edits, then send your request again.',
      );

      const boundProject = await request(app).get(`/v1/projects/${bound.body.data.project.id}`);
      const rememberedProject = await request(app).get(
        `/v1/projects/${remembered.body.data.project.id}`,
      );
      expect(boundProject.body.data.metadata.onboardingDraft).toEqual(
        expect.objectContaining({ targetPath: 'AGENTS.md' }),
      );
      expect(rememberedProject.body.data.metadata.onboardingDraft).toBeUndefined();
    });
  });

  it('does not let working memory Project inference satisfy /init without session binding', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      const project = createChatProject(db, {
        name: 'Remembered Project',
        workspaceKey: projectRoot,
        backendProjectRoot: projectRoot,
        repositoryRoot: projectRoot,
        capabilityState: 'backend_accessible',
      });
      const sessionId = await createDefaultSession(app);
      upsertWorkingMemoryArtifact(db, {
        sessionId,
        projectId: project.id,
        activeProject: project.id,
        currentGoal: 'Assess remembered project',
      });

      await expectHandledSlashMessage(
        app,
        db,
        sessionId,
        '/init',
        'Open a Project with Open Project, then run /init to set up Project instructions.',
      );
      const unchangedProject = await request(app).get(`/v1/projects/${project.id}`).expect(200);
      expect(unchangedProject.body.data.metadata.onboardingDraft).toBeUndefined();
    });
  });

  it('loads Project prompt context for sessions bound after desktop registration', async () => {
    await withMockChatApp(dirs, async ({ app }) => {
      const projectRoot = createProjectRoot(dirs);
      writeFileSync(path.join(projectRoot, 'AGENTS.md'), 'desktop root rule\n');

      const registered = await request(app)
        .post('/v1/projects/desktop/register')
        .set('x-agent-platform-desktop-bridge', '1')
        .send({ path: projectRoot, name: 'Desktop Bound Project' })
        .expect(201);
      const sessionRes = await request(app)
        .post('/v1/sessions/project')
        .send({ agentId: DEFAULT_AGENT_ID, projectId: registered.body.data.project.id })
        .expect(201);

      mockToolCalls.mockReturnValueOnce('Read the desktop Project instructions');
      await request(app)
        .post('/v1/chat')
        .send({ sessionId: sessionRes.body.data.session.id, message: 'Inspect README.md' })
        .expect(200);

      const state = mockToolCalls.mock.calls.at(-1)?.[0] as {
        messages?: Array<{ role: string; content: string }>;
      };
      const systemPrompt = state.messages?.[0]?.content ?? '';
      expect(systemPrompt).toContain('--- AGENTS.md ---');
      expect(systemPrompt).toContain('desktop root rule');
      expect(systemPrompt).not.toContain(projectRoot);
    });
  });

  it('loads ordinary chat Project context from the session binding when memory points elsewhere', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const boundRoot = createProjectRoot(dirs);
      const rememberedRoot = createProjectRoot(dirs);
      writeFileSync(path.join(boundRoot, 'AGENTS.md'), 'bound project rule\n');
      writeFileSync(path.join(rememberedRoot, 'AGENTS.md'), 'remembered project rule\n');

      const bound = createChatProject(db, {
        name: 'Bound Chat Project',
        workspaceKey: boundRoot,
        backendProjectRoot: boundRoot,
        repositoryRoot: boundRoot,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
        instructionFiles: [{ scope: 'root', path: 'AGENTS.md', approvedAtMs: 123 }],
      });
      const remembered = createChatProject(db, {
        name: 'Remembered Chat Project',
        workspaceKey: rememberedRoot,
        backendProjectRoot: rememberedRoot,
        repositoryRoot: rememberedRoot,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
        instructionFiles: [{ scope: 'root', path: 'AGENTS.md', approvedAtMs: 123 }],
      });
      const sessionRes = await request(app)
        .post('/v1/sessions/project')
        .send({ agentId: DEFAULT_AGENT_ID, projectId: bound.id })
        .expect(201);
      const sessionId = sessionRes.body.data.session.id as string;
      upsertWorkingMemoryArtifact(db, {
        sessionId,
        projectId: remembered.id,
        activeProject: remembered.id,
        currentGoal: 'Inspect remembered project',
      });

      mockToolCalls.mockReturnValueOnce('Using the bound Project');
      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Inspect README.md' })
        .expect(200);

      const state = mockToolCalls.mock.calls.at(-1)?.[0] as
        | {
            messages?: Array<{ role: string; content: string }>;
          }
        | undefined;
      expect(state).toBeDefined();
      const systemPrompt = state?.messages?.[0]?.content ?? '';
      expect(systemPrompt).toContain('bound project rule');
      expect(systemPrompt).not.toContain('remembered project rule');
      expect(systemPrompt).not.toContain(boundRoot);
      expect(systemPrompt).not.toContain(rememberedRoot);
    });
  });

  it('uses Project-relative paths in assistant-facing Project Chat copy', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      writeFileSync(path.join(projectRoot, 'AGENTS.md'), 'Use project-relative paths.\n');
      const sessionId = await createProjectSession(app, db, {
        name: 'Project Path Copy',
        workspaceKey: projectRoot,
        backendProjectRoot: projectRoot,
        repositoryRoot: projectRoot,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
        instructionFiles: [{ scope: 'root', path: 'AGENTS.md', approvedAtMs: 123 }],
      });

      mockToolCalls.mockReturnValueOnce('Yes, /workspace/AGENTS.md exists in /workspace.');
      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'did you create the AGENTS.md file?' })
        .expect(200);

      const messagesRes = await request(app).get(`/v1/sessions/${sessionId}/messages`).expect(200);
      expect(messagesRes.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'assistant',
            content: 'Yes, AGENTS.md exists in the Project root.',
          }),
        ]),
      );

      const state = mockToolCalls.mock.calls.at(-1)?.[0] as
        | {
            messages?: Array<{ role: string; content: string }>;
          }
        | undefined;
      const systemPrompt = state?.messages?.[0]?.content ?? '';
      expect(systemPrompt).toContain('use Project-relative paths');
      expect(systemPrompt).toContain('do not mention the internal /workspace mount');
    });
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

  it('streams approval_required with policy metadata for unknown shell commands', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      mockToolCallStream('sys_bash', { command: 'gh repo create test --private' });
      const chatRes = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Create a GitHub repository' })
        .expect(200);

      const events = parseNdjsonEvents(chatRes.text);
      expect(events.find((event) => event.type === 'approval_required')).toMatchObject({
        type: 'approval_required',
        toolName: 'sys_bash',
        riskTier: 'high',
        argsPreview: {
          command: 'gh repo create test --private',
          __policy: {
            category: 'unknown',
            decision: 'approval_required',
          },
        },
      });
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
      const { approvalEvent, approvalRequestId } = await createPendingToolApproval(app, sessionId);
      const { getApprovalRequest, listMessagesBySession } = await import('@agent-platform/db');
      expect(approvalEvent?.toolName).toBe('sys_bash');
      expect(getApprovalRequest(db, approvalRequestId).toolName).toBe('sys_bash');

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

  it('persists reconstructed approval tool-call context before the approved tool result', async () => {
    const envSnap = snapshotChatEnv();
    const { app, db, sqlite } = await createSeededApp(dirs, { mockLlm: true });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      const { approvalRequestId } = await createPendingToolApproval(app, sessionId);
      const { listMessagesBySession } = await import('@agent-platform/db');
      const assistantToolCallMessage = listMessagesBySession(db, sessionId).find(
        (message) => message.role === 'assistant' && message.toolCalls?.length,
      );
      expect(assistantToolCallMessage?.id).toEqual(expect.any(String));

      sqlite
        .prepare('UPDATE messages SET tool_calls_json = NULL WHERE id = ?')
        .run(assistantToolCallMessage!.id);

      await request(app)
        .post(`/v1/approval-requests/${approvalRequestId}/approve`)
        .send({ reason: 'ok' })
        .expect(200);

      mockToolCalls.mockReturnValueOnce('Done with date');
      await request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .send({ approvalRequestId })
        .expect(200);

      const messages = listMessagesBySession(db, sessionId);
      const toolMessageIndex = messages.findIndex((message) => message.role === 'tool');
      expect(toolMessageIndex).toBeGreaterThan(0);
      const precedingMessage = messages[toolMessageIndex - 1];
      expect(precedingMessage).toMatchObject({
        role: 'assistant',
        toolCalls: [{ id: 'tc-approval', name: 'sys_bash', args: { command: 'date' } }],
      });
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('keeps browser sessions available to follow-up tools after URL approval', async () => {
    const envSnap = snapshotChatEnv();
    let executorFactoryCalls = 0;
    const systemToolExecutorFactory = () => {
      executorFactoryCalls++;
      const activeBrowserSessions = new Set<string>();
      const executor: NativeToolExecutor = async (toolId, args) => {
        const sessionId =
          typeof args.sessionId === 'string' ? args.sessionId : 'browser-session-test';
        if (toolId === 'sys_browser_start') {
          activeBrowserSessions.add(sessionId);
          return {
            type: 'tool_result',
            toolId,
            data: {
              kind: 'start',
              sessionId,
              status: 'succeeded',
              policyDecision: { state: 'allowed', matchedRule: 'browser_url_approved' },
            },
          };
        }
        if (toolId === 'sys_browser_snapshot') {
          return {
            type: 'tool_result',
            toolId,
            data: activeBrowserSessions.has(sessionId)
              ? { kind: 'snapshot', sessionId, status: 'succeeded' }
              : {
                  kind: 'snapshot',
                  sessionId,
                  status: 'failed',
                  error: {
                    code: 'BROWSER_SESSION_UNAVAILABLE',
                    message: 'Browser session is not active',
                  },
                },
          };
        }
        return { type: 'error', code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${toolId}` };
      };
      return executor;
    };
    const { app, sqlite } = await createSeededApp(dirs, {
      mockLlm: true,
      systemToolExecutorFactory,
    });
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const sessionId = await createDefaultSession(app);
      mockToolCallStream('sys_browser_start', {
        sessionId: 'browser-session-test',
        url: 'https://example.com',
      });
      const chatRes = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Open example.com and capture a snapshot' })
        .expect(200);
      const approvalRequestId = parseNdjsonEvents(chatRes.text).find(
        (event) => event.type === 'approval_required',
      )?.approvalRequestId;
      expect(approvalRequestId).toEqual(expect.any(String));

      await request(app)
        .post(`/v1/approval-requests/${approvalRequestId}/approve`)
        .send({ reason: 'ok' })
        .expect(200);

      mockToolCalls
        .mockReturnValueOnce([
          {
            id: 'tc-browser-snapshot',
            name: 'sys_browser_snapshot',
            args: { sessionId: 'browser-session-test' },
          },
        ])
        .mockReturnValueOnce('Snapshot captured');
      const resumeRes = await request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .send({ approvalRequestId })
        .expect(200);

      expect(resumeRes.text).toContain('"kind":"snapshot"');
      expect(resumeRes.text).toContain('"status":"succeeded"');
      expect(resumeRes.text).not.toContain('BROWSER_SESSION_UNAVAILABLE');
      expect(executorFactoryCalls).toBe(2);
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

  it('writes canonical /workspace files inside the bound Project root', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      const sessionId = await createProjectSession(app, db, {
        name: 'Writable Project',
        workspaceKey: projectRoot,
        backendProjectRoot: projectRoot,
        repositoryRoot: projectRoot,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
      });
      mockProjectWrite('tc-project-write', 'written in project root');
      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Write the project note' })
        .expect(200);
      expect(res.text).toContain('tool_result');
      expect(res.text).toContain('/workspace/project-note.txt');
      expect(res.text).not.toContain(projectRoot);

      const projectFile = path.join(projectRoot, 'project-note.txt');
      expect(existsSync(projectFile)).toBe(true);
      expect(readFileSync(projectFile, 'utf8')).toBe('written in project root');
    });
  });

  it('resumes approved Project bash writes inside a desktop-registered Project without leaking host paths', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      const registered = await request(app)
        .post('/v1/projects/desktop/register')
        .set('x-agent-platform-desktop-bridge', '1')
        .send({ path: projectRoot, name: 'Desktop Command Project' })
        .expect(201);
      const projectId = registered.body.data.project.id as string;
      const project = getProject(db, projectId);
      updateProject(db, projectId, {
        metadata: {
          ...project.metadata,
          onboardingState: 'approved',
        },
      });
      const sessionRes = await request(app)
        .post('/v1/sessions/project')
        .send({ agentId: DEFAULT_AGENT_ID, projectId })
        .expect(201);
      const sessionId = sessionRes.body.data.session.id as string;

      mockToolCallStream('sys_bash', { command: 'touch /workspace/command-note.txt' });
      const chatRes = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Create the command note' })
        .expect(200);
      const approvalEvent = parseNdjsonEvents(chatRes.text).find(
        (event) => event.type === 'approval_required',
      );
      expect(approvalEvent).toMatchObject({
        type: 'approval_required',
        toolName: 'sys_bash',
        riskTier: 'high',
      });
      expect(chatRes.text).toContain('/workspace/command-note.txt');
      expect(chatRes.text).not.toContain(projectRoot);

      const approvalRequestId = approvalEvent!.approvalRequestId!;
      await request(app)
        .post(`/v1/approval-requests/${approvalRequestId}/approve`)
        .send({ reason: 'ok' })
        .expect(200);

      mockToolCalls.mockReturnValueOnce('Command complete');
      const resumeRes = await request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .send({ approvalRequestId })
        .expect(200);

      expect(resumeRes.text).toContain('tool_result');
      expect(resumeRes.text).not.toContain(projectRoot);
      expect(existsSync(path.join(projectRoot, 'command-note.txt'))).toBe(true);
      await expectToolExecutionCount(db, sessionId, 'pending', 1);
      await expectToolExecutionCount(db, sessionId, 'success', 1);
    });
  });

  it('blocks Project writes before AGENTS.md onboarding is approved', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      const project = createChatProject(db, {
        name: 'Needs Review Project',
        workspaceKey: projectRoot,
        backendProjectRoot: projectRoot,
        repositoryRoot: projectRoot,
        capabilityState: 'backend_accessible',
        onboardingState: 'needs_review',
      });
      const sessionRes = await request(app)
        .post('/v1/sessions')
        .send({ agentId: DEFAULT_AGENT_ID, mode: 'project', projectId: project.id })
        .expect(201);
      const sessionId = sessionRes.body.data.id as string;
      mockProjectWrite('tc-project-write-allowed', 'written before onboarding');

      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Write the project note' })
        .expect(200);

      expect(res.text).toContain('I prepared a Project instructions draft');
      expect(existsSync(path.join(projectRoot, 'project-note.txt'))).toBe(false);
      expect(getProject(db, project.id).metadata['onboardingDraft']).toBeDefined();
    });
  });

  it('blocks writes from a new desktop Project first request and starts AGENTS.md setup', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      const registered = await request(app)
        .post('/v1/projects/desktop/register')
        .set('x-agent-platform-desktop-bridge', '1')
        .send({ path: projectRoot, name: 'Fresh Desktop Project' })
        .expect(201);
      const projectId = registered.body.data.project.id as string;
      const sessionRes = await request(app)
        .post('/v1/sessions/project')
        .send({ agentId: DEFAULT_AGENT_ID, projectId })
        .expect(201);
      const sessionId = sessionRes.body.data.session.id as string;

      mockProjectWrite('tc-project-first-write', 'written on first request');
      const firstWrite = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Create a simple Node project' })
        .expect(200);

      expect(firstWrite.text).not.toContain('tool_result');
      expect(firstWrite.text).toContain('I prepared a Project instructions draft');
      expect(firstWrite.text).not.toContain(projectRoot);
      expect(existsSync(path.join(projectRoot, 'project-note.txt'))).toBe(false);
      expect(getProject(db, projectId).metadata['onboardingDraft']).toBeDefined();
    });
  });

  it('hides write tools in new Project Chat until AGENTS.md onboarding is approved', async () => {
    await withMockChatApp(dirs, async ({ app }) => {
      const projectRoot = createProjectRoot(dirs);
      const registered = await request(app)
        .post('/v1/projects/desktop/register')
        .set('x-agent-platform-desktop-bridge', '1')
        .send({ path: projectRoot, name: 'Fresh Tool Visibility Project' })
        .expect(201);
      const projectId = registered.body.data.project.id as string;
      const sessionRes = await request(app)
        .post('/v1/sessions/project')
        .send({ agentId: DEFAULT_AGENT_ID, projectId })
        .expect(201);
      const sessionId = sessionRes.body.data.session.id as string;
      let visibleToolNames: string[] = [];

      mockToolCalls.mockImplementationOnce((state) => {
        visibleToolNames = state.toolDefinitions.map((tool: { name: string }) => tool.name);
        return 'I can inspect files now.';
      });

      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Create a simple Node project' })
        .expect(200);

      expect(visibleToolNames).toContain('sys_read_file');
      expect(visibleToolNames).not.toContain('sys_write_file');
      expect(visibleToolNames).not.toContain('sys_append_file');
      expect(visibleToolNames).not.toContain('sys_copy_file');
      expect(visibleToolNames).not.toContain('sys_create_directory');
      expect(visibleToolNames).not.toContain('sys_download_file');
      expect(visibleToolNames).not.toContain('coding_apply_patch');
    });
  });

  it('hides write tools from readonly Project chat tool definitions', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      const sessionId = await createProjectSession(app, db, {
        name: 'Readonly Tool Visibility Project',
        workspaceKey: projectRoot,
        backendProjectRoot: projectRoot,
        repositoryRoot: projectRoot,
        capabilityState: 'readonly',
        onboardingState: 'approved',
      });
      let visibleToolNames: string[] = [];

      mockToolCalls.mockImplementationOnce((state) => {
        visibleToolNames = state.toolDefinitions.map((tool: { name: string }) => tool.name);
        return 'Readonly project inspected.';
      });

      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Inspect this project' })
        .expect(200);

      expect(visibleToolNames).toContain('sys_read_file');
      expect(visibleToolNames).not.toContain('sys_write_file');
      expect(visibleToolNames).not.toContain('sys_append_file');
      expect(visibleToolNames).not.toContain('sys_copy_file');
      expect(visibleToolNames).not.toContain('sys_create_directory');
      expect(visibleToolNames).not.toContain('sys_download_file');
      expect(visibleToolNames).not.toContain('coding_apply_patch');
    });
  });

  it('adds root and nearest nested AGENTS.md files to the Project chat prompt', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const projectRoot = createProjectRoot(dirs);
      mkdirSync(path.join(projectRoot, 'apps', 'web'), { recursive: true });
      writeFileSync(path.join(projectRoot, 'AGENTS.md'), 'root rule\n');
      writeFileSync(path.join(projectRoot, 'apps', 'web', 'AGENTS.md'), 'web rule\n');
      const sessionId = await createProjectSession(app, db, {
        name: 'Instruction Project',
        workspaceKey: projectRoot,
        backendProjectRoot: projectRoot,
        repositoryRoot: projectRoot,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
        instructionFiles: [
          { scope: 'root', path: 'AGENTS.md', approvedAtMs: 123 },
          {
            scope: 'nested',
            path: 'apps/web/AGENTS.md',
            appliesToPath: 'apps/web',
            approvedAtMs: 123,
          },
        ],
      });

      mockToolCalls.mockReturnValueOnce('Read the instructions');
      await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Inspect apps/web/page.tsx' })
        .expect(200);

      const state = mockToolCalls.mock.calls.at(-1)?.[0] as {
        messages?: Array<{ role: string; content: string }>;
      };
      const systemPrompt = state.messages?.[0]?.content ?? '';
      expect(systemPrompt).toContain('--- AGENTS.md ---');
      expect(systemPrompt).toContain('root rule');
      expect(systemPrompt).toContain('--- apps/web/AGENTS.md ---');
      expect(systemPrompt).toContain('web rule');
    });
  });

  it('rejects canonical /workspace writes when the bound Project is unavailable', async () => {
    await withMockChatApp(dirs, async ({ app, db }) => {
      const sessionId = await createProjectSession(app, db, {
        name: 'Unavailable Project',
        backendProjectRoot: '/missing/project',
        repositoryRoot: '/missing/project',
        capabilityState: 'unavailable',
      });

      mockProjectWrite('tc-project-write-unavailable', 'should not write');
      const res = await request(app)
        .post('/v1/chat')
        .send({ sessionId, message: 'Write the project note' })
        .expect(200);

      expect(res.text).toContain('PROJECT_UNAVAILABLE');
    });
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
      const { queryToolExecutions } = await import('@agent-platform/db');
      const rejectedAudits = queryToolExecutions(db, {
        sessionId,
        toolName: 'sys_bash',
        status: 'denied',
        limit: 10,
        offset: 0,
      });
      expect(rejectedAudits).toHaveLength(1);
      const rejectedAudit = rejectedAudits[0];
      if (!rejectedAudit) throw new Error('Expected rejected command audit record');
      expect(rejectedAudit.resultJson).toEqual(expect.any(String));
      expect(JSON.parse(rejectedAudit.resultJson ?? '{}')).toMatchObject({
        rejected: true,
        reason: 'Human rejected tool execution.',
      });
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
