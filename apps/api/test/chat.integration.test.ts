import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeDatabase, openDatabase, runSeed } from '@agent-platform/db';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';

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
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-chat-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'db.sqlite');
    const { db, sqlite } = openDatabase(sqlitePath);
    runSeed(db);
    const app = createApp({ db });
    const prevLegacy = process.env.OPENAI_API_KEY;
    const prevPreferred = process.env.AGENT_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AGENT_OPENAI_API_KEY;
    try {
      const res = await request(app)
        .post('/v1/chat/stream')
        .send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        })
        .expect(400);
      expect(res.body.error?.code).toBe('MISSING_KEY');
    } finally {
      if (prevLegacy !== undefined) process.env.OPENAI_API_KEY = prevLegacy;
      else delete process.env.OPENAI_API_KEY;
      if (prevPreferred !== undefined) process.env.AGENT_OPENAI_API_KEY = prevPreferred;
      else delete process.env.AGENT_OPENAI_API_KEY;
      closeDatabase(sqlite);
    }
  });

  it('returns 400 when only legacy OPENAI_API_KEY is set', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-chat-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'db.sqlite');
    const { db, sqlite } = openDatabase(sqlitePath);
    runSeed(db);
    const app = createApp({ db });
    const prevLegacy = process.env.OPENAI_API_KEY;
    const prevPreferred = process.env.AGENT_OPENAI_API_KEY;
    const prevAllowLegacy = process.env.OPENAI_ALLOW_LEGACY_ENV;
    delete process.env.AGENT_OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-legacy';
    delete process.env.OPENAI_ALLOW_LEGACY_ENV;
    try {
      const res = await request(app)
        .post('/v1/chat/stream')
        .send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        })
        .expect(400);
      expect(res.body.error?.code).toBe('LEGACY_ENV_BLOCKED');
    } finally {
      if (prevLegacy !== undefined) process.env.OPENAI_API_KEY = prevLegacy;
      else delete process.env.OPENAI_API_KEY;
      if (prevPreferred !== undefined) process.env.AGENT_OPENAI_API_KEY = prevPreferred;
      else delete process.env.AGENT_OPENAI_API_KEY;
      if (prevAllowLegacy !== undefined) process.env.OPENAI_ALLOW_LEGACY_ENV = prevAllowLegacy;
      else delete process.env.OPENAI_ALLOW_LEGACY_ENV;
      closeDatabase(sqlite);
    }
  });
});
