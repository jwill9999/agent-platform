import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeDatabase, DEFAULT_AGENT_ID, openDatabase, runSeed } from '@agent-platform/db';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';

const CHAT_ENV_KEYS = [
  'OPENAI_API_KEY',
  'AGENT_OPENAI_API_KEY',
  'OPENAI_ALLOW_LEGACY_ENV',
] as const;

function snapshotChatEnv(): Map<string, string | undefined> {
  const snap = new Map<string, string | undefined>();
  for (const k of CHAT_ENV_KEYS) snap.set(k, process.env[k]);
  return snap;
}

function restoreChatEnv(snap: Map<string, string | undefined>) {
  for (const k of CHAT_ENV_KEYS) {
    const v = snap.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function createSeededApp(dirs: string[]): {
  app: Application;
  db: ReturnType<typeof openDatabase>['db'];
  sqlite: ReturnType<typeof openDatabase>['sqlite'];
} {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-session-chat-'));
  dirs.push(dir);
  const sqlitePath = path.join(dir, 'db.sqlite');
  const { db, sqlite } = openDatabase(sqlitePath);
  runSeed(db);
  return { app: createApp({ db }), db, sqlite };
}

describe('POST /v1/chat (session-aware)', () => {
  const dirs: string[] = [];

  afterEach(() => {
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
    const { app, sqlite } = createSeededApp(dirs);
    try {
      const res = await request(app).post('/v1/chat').send({ bad: 'body' }).expect(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    } finally {
      closeDatabase(sqlite);
    }
  });

  it('returns 404 when session does not exist', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = createSeededApp(dirs);
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
    const { app, sqlite } = createSeededApp(dirs);
    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AGENT_OPENAI_API_KEY;
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;

      // First create a session
      const sessionRes = await request(app)
        .post('/v1/sessions')
        .send({ agentId: DEFAULT_AGENT_ID })
        .expect(201);

      const sessionId = sessionRes.body.data.id;

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
    const { app, sqlite } = createSeededApp(dirs);
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      // Create a session, then delete the agent
      const sessionRes = await request(app)
        .post('/v1/sessions')
        .send({ agentId: DEFAULT_AGENT_ID })
        .expect(201);

      const sessionId = sessionRes.body.data.id;

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
    const { app, db, sqlite } = createSeededApp(dirs);
    let sessionId = '';
    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      // Create a session
      const sessionRes = await request(app)
        .post('/v1/sessions')
        .send({ agentId: DEFAULT_AGENT_ID })
        .expect(201);
      sessionId = sessionRes.body.data.id;

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
});
