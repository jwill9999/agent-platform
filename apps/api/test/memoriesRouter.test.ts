import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, countMemories, createMemory, openDatabase } from '@agent-platform/db';
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
    createMemory(
      ctx.db,
      {
        scope: 'session',
        scopeId: 'session-2',
        kind: 'working_note',
        status: 'pending',
        reviewStatus: 'unreviewed',
        content: 'A different session memory.',
        confidence: 0.7,
        source: { kind: 'manual' },
      },
      { id: 'memory-other-session', nowMs: 1000 },
    );

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
    expect(exported.body.data.memories.map((memory: { id: string }) => memory.id)).toEqual([
      'memory-1',
    ]);
  });

  it('requires explicit scoped confirmation before clearing memories', async () => {
    createMemory(
      ctx.db,
      {
        scope: 'session',
        scopeId: 'session-2',
        kind: 'working_note',
        status: 'pending',
        reviewStatus: 'unreviewed',
        content: 'A different session memory.',
        confidence: 0.7,
        source: { kind: 'manual' },
      },
      { id: 'memory-other-session', nowMs: 1000 },
    );

    const rejected = await request(ctx.app)
      .post('/v1/memories/clear')
      .send({ scope: 'session', scopeId: 'session-1' });
    expect(rejected.status).toBe(400);

    const missingScopeId = await request(ctx.app)
      .post('/v1/memories/clear')
      .send({ scope: 'session', status: 'pending', confirm: true });
    expect(missingScopeId.status).toBe(400);

    const cleared = await request(ctx.app)
      .post('/v1/memories/clear')
      .send({ scope: 'session', scopeId: 'session-1', status: 'pending', confirm: true });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.deleted).toBe(1);
    expect(countMemories(ctx.db, { scope: 'session', scopeId: 'session-2' })).toBe(1);
  });

  it('dry-runs and confirms expired memory cleanup without deleting current records', async () => {
    const nowMs = Date.now();
    createMemory(
      ctx.db,
      {
        scope: 'session',
        scopeId: 'session-1',
        kind: 'working_note',
        status: 'approved',
        reviewStatus: 'approved',
        content: 'Expired memory.',
        confidence: 0.8,
        source: { kind: 'manual' },
        safetyState: 'safe',
        expiresAtMs: nowMs - 1000,
      },
      { id: 'expired-memory', nowMs: 1000 },
    );
    createMemory(
      ctx.db,
      {
        scope: 'session',
        scopeId: 'session-1',
        kind: 'working_note',
        status: 'approved',
        reviewStatus: 'approved',
        content: 'Current memory.',
        confidence: 0.8,
        source: { kind: 'manual' },
        safetyState: 'safe',
        expiresAtMs: nowMs + 60_000,
      },
      { id: 'current-memory', nowMs: 1000 },
    );

    const rejected = await request(ctx.app)
      .post('/v1/memories/cleanup')
      .send({ scope: 'session', scopeId: 'session-1', dryRun: false });
    expect(rejected.status).toBe(400);

    const dryRun = await request(ctx.app)
      .post('/v1/memories/cleanup')
      .send({ scope: 'session', scopeId: 'session-1' });
    expect(dryRun.status).toBe(200);
    expect(dryRun.body.data).toMatchObject({ dryRun: true, matched: 1, deleted: 0 });
    expect(
      countMemories(ctx.db, { scope: 'session', scopeId: 'session-1', includeExpired: true }),
    ).toBe(3);

    const cleanup = await request(ctx.app)
      .post('/v1/memories/cleanup')
      .send({ scope: 'session', scopeId: 'session-1', dryRun: false, confirm: true });
    expect(cleanup.status).toBe(200);
    expect(cleanup.body.data).toMatchObject({ dryRun: false, matched: 1, deleted: 1 });
    expect(
      countMemories(ctx.db, { scope: 'session', scopeId: 'session-1', includeExpired: true }),
    ).toBe(2);
  });

  it('deletes a single memory by id', async () => {
    const deleted = await request(ctx.app).delete('/v1/memories/memory-1');
    expect(deleted.status).toBe(204);

    const missing = await request(ctx.app).get('/v1/memories/memory-1');
    expect(missing.status).toBe(404);
  });

  it('evaluates self-learning candidates and keeps them review gated', async () => {
    const evaluated = await request(ctx.app)
      .post('/v1/memories/self-learning/evaluate')
      .send({
        sessionId: 'session-1',
        observedOutcomes: [
          {
            kind: 'observability_error',
            id: 'event-1',
            message: "ENOENT: no such file or directory, open '/workspace/app.ts'",
          },
          {
            kind: 'observability_error',
            id: 'event-2',
            message: "STAT_FAILED: no such file or directory, stat '/workspace/app.ts'",
          },
        ],
      });

    expect(evaluated.status).toBe(201);
    expect(evaluated.body.data).toMatchObject({
      proposed: true,
      objective: 'recoverable_workspace_path_errors',
      memory: {
        status: 'pending',
        reviewStatus: 'unreviewed',
        tags: ['candidate', 'self-learning', 'workspace-path', 'failure'],
      },
    });

    const memoryId = evaluated.body.data.memory.id as string;
    const active = await request(ctx.app).get('/v1/memories?status=approved&tag=self-learning');
    expect(active.body.data.items).toEqual([]);

    const reviewed = await request(ctx.app)
      .post(`/v1/memories/${memoryId}/review`)
      .send({ decision: 'approved' });
    expect(reviewed.body.data.status).toBe('approved');
  });
});
