import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as schema from '../src/schema.js';
import {
  ApprovalRequestTransitionError,
  approveApprovalRequest,
  countApprovalRequests,
  createApprovalRequest,
  expireApprovalRequest,
  getApprovalRequest,
  listApprovalRequests,
  rejectApprovalRequest,
} from '../src/repositories/approvalRequests.js';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(pkgRoot, 'drizzle') });
  return { db, sqlite };
}

function createPending(ctx: ReturnType<typeof openTestDb>, id = 'approval-1') {
  return createApprovalRequest(ctx.db, {
    id,
    sessionId: 'session-1',
    runId: 'run-1',
    agentId: 'agent-1',
    toolName: 'sys_bash',
    args: { command: 'curl', token: 'secret-value', nested: { password: 'pw' } },
    executionPayloadJson: '{"toolCallId":"tc-1"}',
    riskTier: 'high',
    createdAtMs: 1000,
    expiresAtMs: 2000,
  });
}

describe('approvalRequests repository', () => {
  let ctx: ReturnType<typeof openTestDb>;

  beforeEach(() => {
    ctx = openTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it('creates requests with redacted args', () => {
    const request = createPending(ctx);

    expect(request.status).toBe('pending');
    expect(request.riskTier).toBe('high');
    expect(JSON.parse(request.argsJson)).toEqual({
      command: 'curl',
      token: '[REDACTED]',
      nested: { password: '[REDACTED]' },
    });
  });

  it('gets, lists, counts, and filters requests', () => {
    createPending(ctx, 'approval-1');
    createApprovalRequest(ctx.db, {
      id: 'approval-2',
      sessionId: 'session-2',
      runId: 'run-2',
      agentId: 'agent-2',
      toolName: 'sys_write_file',
      args: { path: 'x' },
      riskTier: 'medium',
      createdAtMs: 2000,
    });

    expect(getApprovalRequest(ctx.db, 'approval-1').sessionId).toBe('session-1');
    expect(listApprovalRequests(ctx.db, { limit: 10, offset: 0 })[0]!.id).toBe('approval-2');
    expect(
      listApprovalRequests(ctx.db, { sessionId: 'session-1', limit: 10, offset: 0 }),
    ).toHaveLength(1);
    expect(listApprovalRequests(ctx.db, { runId: 'run-2', limit: 10, offset: 0 })).toHaveLength(1);
    expect(listApprovalRequests(ctx.db, { status: 'pending', limit: 10, offset: 0 })).toHaveLength(
      2,
    );
    expect(listApprovalRequests(ctx.db, { riskTier: 'medium', limit: 10, offset: 0 })).toHaveLength(
      1,
    );
    expect(countApprovalRequests(ctx.db, { agentId: 'agent-1', limit: 10, offset: 0 })).toBe(1);
  });

  it('approves, rejects, and expires pending requests', () => {
    createPending(ctx, 'approval-approve');
    createPending(ctx, 'approval-reject');
    createPending(ctx, 'approval-expire');

    const approved = approveApprovalRequest(ctx.db, 'approval-approve', 3000, 'looks fine');
    const rejected = rejectApprovalRequest(ctx.db, 'approval-reject', 3100, 'unsafe');
    const expired = expireApprovalRequest(ctx.db, 'approval-expire', 3200, 'timed out');

    expect(approved).toMatchObject({
      status: 'approved',
      decidedAtMs: 3000,
      decisionReason: 'looks fine',
    });
    expect(rejected.status).toBe('rejected');
    expect(expired.status).toBe('expired');
  });

  it('keeps terminal transitions idempotent and prevents flip-flops', () => {
    createPending(ctx);
    const first = approveApprovalRequest(ctx.db, 'approval-1', 3000, 'ok');
    const second = approveApprovalRequest(ctx.db, 'approval-1', 4000, 'ignored');

    expect(second).toEqual(first);
    expect(() => rejectApprovalRequest(ctx.db, 'approval-1', 5000, 'no')).toThrow(
      ApprovalRequestTransitionError,
    );
  });
});
