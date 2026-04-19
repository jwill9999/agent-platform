import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as schema from '../src/schema.js';
import {
  insertToolExecution,
  completeToolExecution,
  queryToolExecutions,
  countToolExecutions,
} from '../src/repositories/toolExecutions.js';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(pkgRoot, 'drizzle') });
  return { db, sqlite };
}

describe('toolExecutions repository', () => {
  let ctx: ReturnType<typeof openTestDb>;

  beforeEach(() => {
    ctx = openTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it('inserts and queries a tool execution', () => {
    insertToolExecution(ctx.db, {
      id: 'exec-1',
      toolName: 'sys_read_file',
      agentId: 'agent-1',
      sessionId: 'session-1',
      argsJson: '{"path":"/workspace/f.txt"}',
      riskTier: 'low',
      status: 'pending',
      startedAtMs: 1000,
    });

    const rows = queryToolExecutions(ctx.db, { limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('exec-1');
    expect(rows[0]!.toolName).toBe('sys_read_file');
    expect(rows[0]!.status).toBe('pending');
  });

  it('completes a tool execution', () => {
    insertToolExecution(ctx.db, {
      id: 'exec-2',
      toolName: 'sys_bash',
      agentId: 'agent-1',
      sessionId: 'session-1',
      argsJson: '{"command":"ls"}',
      riskTier: 'high',
      status: 'pending',
      startedAtMs: 1000,
    });

    completeToolExecution(ctx.db, 'exec-2', {
      resultJson: '{"output":"file.txt"}',
      status: 'success',
      completedAtMs: 1500,
      durationMs: 500,
    });

    const rows = queryToolExecutions(ctx.db, { limit: 10, offset: 0 });
    expect(rows[0]!.status).toBe('success');
    expect(rows[0]!.durationMs).toBe(500);
    expect(rows[0]!.completedAtMs).toBe(1500);
  });

  it('filters by agentId', () => {
    insertToolExecution(ctx.db, {
      id: 'exec-a1',
      toolName: 'sys_bash',
      agentId: 'agent-A',
      sessionId: 's1',
      argsJson: '{}',
      status: 'success',
      startedAtMs: 1000,
    });
    insertToolExecution(ctx.db, {
      id: 'exec-b1',
      toolName: 'sys_bash',
      agentId: 'agent-B',
      sessionId: 's2',
      argsJson: '{}',
      status: 'success',
      startedAtMs: 2000,
    });

    const rows = queryToolExecutions(ctx.db, { agentId: 'agent-A', limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agentId).toBe('agent-A');
  });

  it('filters by riskTier', () => {
    insertToolExecution(ctx.db, {
      id: 'exec-low',
      toolName: 'sys_read_file',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      riskTier: 'low',
      status: 'success',
      startedAtMs: 1000,
    });
    insertToolExecution(ctx.db, {
      id: 'exec-high',
      toolName: 'sys_bash',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      riskTier: 'high',
      status: 'success',
      startedAtMs: 2000,
    });

    const rows = queryToolExecutions(ctx.db, { riskTier: 'high', limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.riskTier).toBe('high');
  });

  it('filters by status', () => {
    insertToolExecution(ctx.db, {
      id: 'exec-ok',
      toolName: 'sys_bash',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      status: 'success',
      startedAtMs: 1000,
    });
    insertToolExecution(ctx.db, {
      id: 'exec-denied',
      toolName: 'sys_bash',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      status: 'denied',
      startedAtMs: 2000,
    });

    const rows = queryToolExecutions(ctx.db, { status: 'denied', limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('denied');
  });

  it('counts tool executions with filters', () => {
    insertToolExecution(ctx.db, {
      id: 'exec-c1',
      toolName: 'sys_bash',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      status: 'success',
      startedAtMs: 1000,
    });
    insertToolExecution(ctx.db, {
      id: 'exec-c2',
      toolName: 'sys_bash',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      status: 'error',
      startedAtMs: 2000,
    });
    insertToolExecution(ctx.db, {
      id: 'exec-c3',
      toolName: 'sys_read_file',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      status: 'success',
      startedAtMs: 3000,
    });

    expect(countToolExecutions(ctx.db, { limit: 100, offset: 0 })).toBe(3);
    expect(countToolExecutions(ctx.db, { status: 'success', limit: 100, offset: 0 })).toBe(2);
    expect(countToolExecutions(ctx.db, { toolName: 'sys_bash', limit: 100, offset: 0 })).toBe(2);
  });

  it('orders by startedAtMs desc (newest first)', () => {
    insertToolExecution(ctx.db, {
      id: 'exec-old',
      toolName: 'a',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      status: 'success',
      startedAtMs: 1000,
    });
    insertToolExecution(ctx.db, {
      id: 'exec-new',
      toolName: 'b',
      agentId: 'a',
      sessionId: 's',
      argsJson: '{}',
      status: 'success',
      startedAtMs: 2000,
    });

    const rows = queryToolExecutions(ctx.db, { limit: 10, offset: 0 });
    expect(rows[0]!.id).toBe('exec-new');
    expect(rows[1]!.id).toBe('exec-old');
  });

  it('respects limit and offset', () => {
    for (let i = 0; i < 5; i++) {
      insertToolExecution(ctx.db, {
        id: `exec-${i}`,
        toolName: 'sys_bash',
        agentId: 'a',
        sessionId: 's',
        argsJson: '{}',
        status: 'success',
        startedAtMs: i * 1000,
      });
    }

    const page1 = queryToolExecutions(ctx.db, { limit: 2, offset: 0 });
    expect(page1).toHaveLength(2);

    const page2 = queryToolExecutions(ctx.db, { limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);
    expect(page2[0]!.id).not.toBe(page1[0]!.id);
  });
});
