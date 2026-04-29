import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeDatabase, openDatabase, runSeed } from '@agent-platform/db';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';
import { restoreChatEnv, snapshotChatEnv } from './support/chatEnv.js';

function createSeededChatApp(dirs: string[]): {
  app: Application;
  sqlite: ReturnType<typeof openDatabase>['sqlite'];
} {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-chat-'));
  dirs.push(dir);
  const sqlitePath = path.join(dir, 'db.sqlite');
  const { db, sqlite } = openDatabase(sqlitePath);
  runSeed(db);
  return { app: createApp({ db }), sqlite };
}

describe('POST /v1/chat/stream', () => {
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

  it('returns 400 when no API key is configured', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = createSeededChatApp(dirs);
    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AGENT_OPENAI_API_KEY;
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;
      const res = await request(app)
        .post('/v1/chat/stream')
        .send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        })
        .expect(400);
      expect(res.body.error?.code).toBe('MISSING_KEY');
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });

  it('returns 400 when only legacy OPENAI_API_KEY is set', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = createSeededChatApp(dirs);
    try {
      delete process.env.AGENT_OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-legacy';
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;
      const res = await request(app)
        .post('/v1/chat/stream')
        .send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        })
        .expect(400);
      expect(res.body.error?.code).toBe('LEGACY_ENV_BLOCKED');
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });
});
