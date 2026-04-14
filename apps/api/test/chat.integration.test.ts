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
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
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
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
      closeDatabase(sqlite);
    }
  });
});
