import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_AGENT_ID,
  messages as messagesTable,
  openDatabase,
  runSeed,
  updateSessionTitle,
} from '@agent-platform/db';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';

function createSeededApp(dirs: string[]): {
  app: Application;
  db: ReturnType<typeof openDatabase>['db'];
  sqlite: ReturnType<typeof openDatabase>['sqlite'];
} {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-title-'));
  dirs.push(dir);
  const sqlitePath = path.join(dir, 'db.sqlite');
  const { db, sqlite } = openDatabase(sqlitePath);
  runSeed(db);
  return { app: createApp({ db }), db, sqlite };
}

describe('Session title and messages endpoint', () => {
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

  it('updateSessionTitle persists and returns on GET', async () => {
    const { app, db } = createSeededApp(dirs);

    // Create a session
    const createRes = await request(app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);

    const sessionId = createRes.body.data.id;
    expect(createRes.body.data.title).toBeNull();

    // Update title via DB function
    updateSessionTitle(db, sessionId, 'My Test Title');

    // Verify via GET
    const getRes = await request(app).get(`/v1/sessions/${sessionId}`).expect(200);
    expect(getRes.body.data.title).toBe('My Test Title');
  });

  it('GET /v1/sessions/:id/messages returns 404 for unknown session', async () => {
    const { app } = createSeededApp(dirs);

    await request(app).get('/v1/sessions/nonexistent-id/messages').expect(404);
  });

  it('GET /v1/sessions/:id/messages returns only user and assistant messages', async () => {
    const { app, db } = createSeededApp(dirs);

    // Create a session
    const createRes = await request(app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);

    const sessionId = createRes.body.data.id;

    // Insert messages directly into DB (simulating harness output)
    const crypto = await import('node:crypto');
    const now = Date.now();

    db.insert(messagesTable)
      .values([
        {
          id: crypto.randomUUID(),
          sessionId,
          role: 'system',
          content: 'You are a helper',
          createdAtMs: now,
        },
        {
          id: crypto.randomUUID(),
          sessionId,
          role: 'user',
          content: 'Hello there',
          createdAtMs: now + 1,
        },
        {
          id: crypto.randomUUID(),
          sessionId,
          role: 'assistant',
          content: 'Hi! How can I help?',
          createdAtMs: now + 2,
        },
        {
          id: crypto.randomUUID(),
          sessionId,
          role: 'tool',
          content: '{"result": 42}',
          createdAtMs: now + 3,
        },
      ])
      .run();

    // Fetch via API
    const res = await request(app).get(`/v1/sessions/${sessionId}/messages`).expect(200);

    const msgs = res.body.data;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('Hello there');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toBe('Hi! How can I help?');
  });

  it('session title appears in session list', async () => {
    const { app, db } = createSeededApp(dirs);

    // Create two sessions
    const s1 = await request(app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);
    const s2 = await request(app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);

    // Title one of them
    updateSessionTitle(db, s1.body.data.id, 'First session');

    // List all sessions
    const listRes = await request(app).get('/v1/sessions').expect(200);
    const sessions = listRes.body.data;

    const titled = sessions.find((s: { id: string }) => s.id === s1.body.data.id);
    const untitled = sessions.find((s: { id: string }) => s.id === s2.body.data.id);

    expect(titled.title).toBe('First session');
    expect(untitled.title).toBeNull();
  });
});
