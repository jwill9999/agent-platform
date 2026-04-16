import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import { appendMessage, listMessagesBySession } from '../src/repositories/messages.js';
import { createSession, replaceAgent } from '../src/repositories/registry.js';
import { withTransaction } from '../src/transaction.js';

describe('withTransaction', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;
  let sessionId: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-tx-'));
    const sqlitePath = path.join(tmpDir, 'test.sqlite');
    const opened = openDatabase(sqlitePath);
    db = opened.db;
    sqlite = opened.sqlite;

    replaceAgent(db, {
      id: 'agent-tx',
      name: 'TX Test Agent',
      systemPrompt: 'sys',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const session = createSession(db, { agentId: 'agent-tx' });
    sessionId = session.id;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('commits when all operations succeed', () => {
    withTransaction(db, (tx) => {
      appendMessage(tx, { sessionId, role: 'user', content: 'msg-1' });
      appendMessage(tx, { sessionId, role: 'assistant', content: 'msg-2' });
    });

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.content).toBe('msg-1');
    expect(msgs[1]!.content).toBe('msg-2');
  });

  it('rolls back all writes when any operation throws', () => {
    expect(() =>
      withTransaction(db, (tx) => {
        appendMessage(tx, { sessionId, role: 'user', content: 'should-vanish' });
        appendMessage(tx, { sessionId, role: 'assistant', content: 'also-vanish' });
        throw new Error('simulated failure');
      }),
    ).toThrow('simulated failure');

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(0);
  });

  it('rolls back partial writes on failure mid-loop', () => {
    expect(() =>
      withTransaction(db, (tx) => {
        for (let i = 0; i < 5; i++) {
          if (i === 3) throw new Error('fail at message 3');
          appendMessage(tx, { sessionId, role: 'user', content: `msg-${i}` });
        }
      }),
    ).toThrow('fail at message 3');

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(0);
  });

  it('returns the value from the callback', () => {
    const result = withTransaction(db, (tx) => {
      appendMessage(tx, { sessionId, role: 'user', content: 'hello' });
      return 42;
    });

    expect(result).toBe(42);
  });

  it('supports nested transactions (savepoints)', () => {
    withTransaction(db, (tx) => {
      appendMessage(tx, { sessionId, role: 'user', content: 'outer' });

      // Inner transaction that fails should not affect outer
      try {
        withTransaction(tx, (innerTx) => {
          appendMessage(innerTx, { sessionId, role: 'user', content: 'inner-fail' });
          throw new Error('inner fail');
        });
      } catch {
        // expected
      }

      appendMessage(tx, { sessionId, role: 'assistant', content: 'after-inner' });
    });

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.content).toBe('outer');
    expect(msgs[1]!.content).toBe('after-inner');
  });

  it('leaves pre-existing data intact on rollback', () => {
    appendMessage(db, { sessionId, role: 'user', content: 'pre-existing' });

    expect(() =>
      withTransaction(db, (tx) => {
        appendMessage(tx, { sessionId, role: 'assistant', content: 'new-msg' });
        throw new Error('rollback');
      }),
    ).toThrow('rollback');

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content).toBe('pre-existing');
  });

  it('handles empty transaction (no-op)', () => {
    const result = withTransaction(db, () => 'empty');
    expect(result).toBe('empty');
  });
});
