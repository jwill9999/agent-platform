import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, createMemory, openDatabase } from '@agent-platform/db';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createMemoriesRouter } from '../src/infrastructure/http/v1/memoriesRouter.js';

function buildTestApp() {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'memories-router-test-'));
  const { db, sqlite } = openDatabase(path.join(tmpDir, 'test.sqlite'));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/v1/memories', createMemoriesRouter(db));
  app.use(errorMiddleware);
  return { app, db, sqlite, tmpDir };
}

describe('memoriesRouter', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
    createMemory(
      ctx.db,
      {
        scope: 'session',
        scopeId: 'session-1',
        kind: 'working_note',
        status: 'pending',
        reviewStatus: 'unreviewed',
        content: 'Remember to run the memory UI tests.',
        confidence: 0.76,
        source: { kind: 'manual', label: 'test' },
        tags: ['candidate'],
      },
      { id: 'memory-1', nowMs: 1000 },
    );
  });

  afterEach(() => {
    closeDatabase(ctx.sqlite);
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  });

  it('lists, exports, updates, and reviews memories', async () => {
    const listed = await request(ctx.app).get('/v1/memories?scope=session&scopeId=session-1');
    expect(listed.status).toBe(200);
    expect(listed.body.data.total).toBe(1);
    expect(listed.body.data.items[0].id).toBe('memory-1');

    const updated = await request(ctx.app)
      .put('/v1/memories/memory-1')
      .send({ content: 'Updated memory content.', tags: ['candidate', 'edited'] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.content).toBe('Updated memory content.');
    expect(updated.body.data.tags).toEqual(['candidate', 'edited']);

    const reviewed = await request(ctx.app)
      .post('/v1/memories/memory-1/review')
      .send({ decision: 'approved', reason: 'Looks useful.' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.status).toBe('approved');
    expect(reviewed.body.data.reviewStatus).toBe('approved');
    expect(reviewed.body.data.metadata.reviewReason).toBe('Looks useful.');

    const exported = await request(ctx.app).get(
      '/v1/memories/export?scope=session&scopeId=session-1',
    );
    expect(exported.status).toBe(200);
    expect(exported.body.data.count).toBe(1);
  });

  it('requires explicit scoped confirmation before clearing memories', async () => {
    const rejected = await request(ctx.app)
      .post('/v1/memories/clear')
      .send({ scope: 'session', scopeId: 'session-1' });
    expect(rejected.status).toBe(400);

    const cleared = await request(ctx.app)
      .post('/v1/memories/clear')
      .send({ scope: 'session', scopeId: 'session-1', status: 'pending', confirm: true });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.deleted).toBe(1);
  });

  it('deletes a single memory by id', async () => {
    const deleted = await request(ctx.app).delete('/v1/memories/memory-1');
    expect(deleted.status).toBe(204);

    const missing = await request(ctx.app).get('/v1/memories/memory-1');
    expect(missing.status).toBe(404);
  });
});
