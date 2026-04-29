import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {
  closeDatabase,
  createApprovalRequest,
  openDatabase,
  type DrizzleDb,
} from '@agent-platform/db';

import { createApprovalRequestsRouter } from '../src/infrastructure/http/v1/approvalRequestsRouter.js';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';

function buildTestApp() {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'approval-requests-test-'));
  const dbPath = path.join(tmpDir, 'test.sqlite');
  const { db, sqlite } = openDatabase(dbPath);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/v1/approval-requests', createApprovalRequestsRouter(db));
  app.use(errorMiddleware);

  return { app, db, sqlite, tmpDir };
}

function seedApproval(db: DrizzleDb, id = 'approval-1') {
  return createApprovalRequest(db, {
    id,
    sessionId: 'session-1',
    runId: 'run-1',
    agentId: 'agent-1',
    toolName: 'sys_bash',
    args: { command: 'curl', api_key: 'secret' },
    riskTier: 'high',
    createdAtMs: 1000,
  });
}

describe('approvalRequestsRouter', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  afterEach(() => {
    closeDatabase(ctx.sqlite);
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  });

  it('lists pending approvals with redacted args', async () => {
    seedApproval(ctx.db);

    const res = await request(ctx.app)
      .get('/v1/approval-requests?status=pending&sessionId=session-1')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      id: 'approval-1',
      status: 'pending',
      riskTier: 'high',
    });
    expect(JSON.parse(res.body.data[0].argsJson)).toEqual({
      command: 'curl',
      api_key: '[REDACTED]',
    });
  });

  it('gets approval details and records approved decisions', async () => {
    seedApproval(ctx.db);

    await request(ctx.app).get('/v1/approval-requests/approval-1').expect(200);

    const approved = await request(ctx.app)
      .post('/v1/approval-requests/approval-1/approve')
      .send({ reason: 'approved by operator' })
      .expect(200);

    expect(approved.body.data).toMatchObject({
      id: 'approval-1',
      status: 'approved',
      decisionReason: 'approved by operator',
    });
    expect(approved.body.data.decidedAtMs).toBeGreaterThan(0);
  });

  it('rejects and expires pending approvals', async () => {
    seedApproval(ctx.db, 'approval-reject');
    seedApproval(ctx.db, 'approval-expire');

    const rejected = await request(ctx.app)
      .post('/v1/approval-requests/approval-reject/reject')
      .send({ reason: 'unsafe' })
      .expect(200);
    const expired = await request(ctx.app)
      .post('/v1/approval-requests/approval-expire/expire')
      .send({ reason: 'timeout' })
      .expect(200);

    expect(rejected.body.data.status).toBe('rejected');
    expect(expired.body.data.status).toBe('expired');
  });

  it('rejects invalid terminal transition flip-flops', async () => {
    seedApproval(ctx.db);
    await request(ctx.app).post('/v1/approval-requests/approval-1/approve').send({}).expect(200);

    const res = await request(ctx.app)
      .post('/v1/approval-requests/approval-1/reject')
      .send({})
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_APPROVAL_TRANSITION');
  });

  it('returns 404 for missing approval requests', async () => {
    const res = await request(ctx.app).get('/v1/approval-requests/missing').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
