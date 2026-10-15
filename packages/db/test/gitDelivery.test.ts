import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitDeliveryReceipt } from '@agent-platform/contracts';
import { closeDatabase, openDatabase } from '../src/database.js';
import { createApprovalRequest, getApprovalRequest } from '../src/repositories/approvalRequests.js';
import { createSession, replaceAgent } from '../src/repositories/registry.js';
import {
  deleteClosedGitDeliveryOperation,
  getGitDeliveryOperation,
  insertGitDeliveryOperation,
  maintainGitDeliveryOperations,
  recoverGitDeliveryOperations,
  transitionGitDeliveryOperation,
} from '../src/repositories/gitDelivery.js';
import * as schema from '../src/schema.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const receipt = (state: GitDeliveryReceipt['state'] = 'prepared'): GitDeliveryReceipt => ({
  id: randomUUID(),
  projectId: 'project',
  source: 'panel',
  action: { kind: 'stage', mode: 'stage', paths: ['file'] },
  state,
  createdAtMs: 1000,
  updatedAtMs: 1000,
  expiresAtMs: 2000,
  review: {
    branch: 'feature/test',
    head: 'a'.repeat(40),
    indexTree: 'b'.repeat(40),
    paths: ['file'],
  },
});
const stored = (value: GitDeliveryReceipt, root = '/disposable') => ({
  receipt: value,
  repositoryRoot: root,
  agentId: null,
  toolCallId: null,
  actionKey: 'stage:stage',
  materialJson: '{}',
});

describe('Git delivery receipt persistence', () => {
  let directory: string;
  let opened: ReturnType<typeof openDatabase>;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'git-receipts-'));
    opened = openDatabase(join(directory, 'data.sqlite'));
  });
  afterEach(() => {
    closeDatabase(opened.sqlite);
    rmSync(directory, { recursive: true, force: true });
  });
  it('claims once and enforces one active operation per repository across database connections', () => {
    const first = receipt();
    const second = receipt();
    insertGitDeliveryOperation(opened.db, stored(first));
    insertGitDeliveryOperation(opened.db, stored(second));
    expect(
      transitionGitDeliveryOperation(opened.db, first.id, 'prepared', {
        ...first,
        state: 'executing',
      }),
    ).toBe(true);
    const connection = openDatabase(join(directory, 'data.sqlite'));
    try {
      expect(
        transitionGitDeliveryOperation(connection.db, first.id, 'prepared', {
          ...first,
          state: 'executing',
        }),
      ).toBe(false);
      expect(() =>
        transitionGitDeliveryOperation(connection.db, second.id, 'prepared', {
          ...second,
          state: 'executing',
        }),
      ).toThrow();
      expect(getGitDeliveryOperation(connection.db, first.id)?.receipt.state).toBe('executing');
    } finally {
      closeDatabase(connection.sqlite);
    }
  });
  it('expires only unclaimed preparations and their linked pending approvals', () => {
    const pending = { ...receipt(), source: 'chat' as const, sessionId: 'session' };
    insertGitDeliveryOperation(opened.db, stored(pending));
    createApprovalRequest(opened.db, {
      id: 'approval',
      sessionId: 'session',
      runId: 'run',
      agentId: 'agent',
      toolName: 'sys_git_stage',
      args: {},
      executionPayloadJson: JSON.stringify({ gitDeliveryBinding: { operationId: pending.id } }),
      riskTier: 'high',
      createdAtMs: 1000,
    });
    const active = receipt('executing');
    insertGitDeliveryOperation(opened.db, stored(active, '/another'));
    maintainGitDeliveryOperations(opened.db, 2001);
    expect(getGitDeliveryOperation(opened.db, pending.id)?.receipt.state).toBe('expired');
    expect(getApprovalRequest(opened.db, 'approval').status).toBe('expired');
    expect(getGitDeliveryOperation(opened.db, active.id)?.receipt.state).toBe('executing');
  });
  it('retains unknown/active records, prunes only old closed history and rejects deletion of active uncertainty', () => {
    const old = receipt('succeeded');
    const unknown = receipt('unknown');
    const active = receipt('executing');
    for (const value of [old, unknown, active])
      insertGitDeliveryOperation(opened.db, stored(value));
    maintainGitDeliveryOperations(opened.db, 31 * 24 * 60 * 60 * 1000);
    expect(getGitDeliveryOperation(opened.db, old.id)).toBeUndefined();
    expect(deleteClosedGitDeliveryOperation(opened.db, unknown.id)).toBe(false);
    expect(deleteClosedGitDeliveryOperation(opened.db, active.id)).toBe(false);
    expect(
      transitionGitDeliveryOperation(opened.db, old.id, 'prepared', { ...old, state: 'executing' }),
    ).toBe(false);
  });
  it('upgrades the previous schema without changing sessions, approvals or existing diagnostic tables; repeated recovery never executes work', () => {
    closeDatabase(opened.sqlite);
    rmSync(join(directory, 'data.sqlite'));
    const priorMigrations = join(directory, 'migrations');
    cpSync(join(packageRoot, 'drizzle'), priorMigrations, { recursive: true });
    const journalPath = join(priorMigrations, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 19);
    writeFileSync(journalPath, JSON.stringify(journal));
    const sqlite = new Database(join(directory, 'data.sqlite'));
    sqlite.pragma('foreign_keys = ON');
    const prior = drizzle(sqlite, { schema });
    migrate(prior, { migrationsFolder: priorMigrations });
    replaceAgent(prior, {
      id: 'agent',
      slug: 'agent',
      name: 'Agent',
      systemPrompt: 'retained',
      allowedToolIds: [],
      allowedSkillIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 3, maxParallelTasks: 1, timeoutMs: 1000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const session = createSession(prior, { agentId: 'agent' });
    createApprovalRequest(prior, {
      id: 'retained',
      sessionId: session.id,
      runId: 'run',
      agentId: 'agent',
      toolName: 'sys_bash',
      args: { command: 'retained' },
      riskTier: 'high',
      createdAtMs: 1000,
    });
    sqlite.exec(
      "CREATE TABLE diagnostic_events(sequence INTEGER PRIMARY KEY,event_id TEXT NOT NULL,content TEXT NOT NULL); INSERT INTO diagnostic_events VALUES(1,'retained','safe metadata');",
    );
    const before = {
      session: sqlite.prepare('SELECT * FROM sessions').all(),
      approvals: sqlite.prepare('SELECT * FROM approval_requests').all(),
      diagnostics: sqlite.prepare('SELECT * FROM diagnostic_events').all(),
    };
    sqlite.close();
    opened = openDatabase(join(directory, 'data.sqlite'));
    const prepared = receipt();
    const active = receipt('executing');
    const done = receipt('succeeded');
    for (const value of [prepared, active, done])
      insertGitDeliveryOperation(opened.db, stored(value));
    recoverGitDeliveryOperations(opened.db, 1500);
    recoverGitDeliveryOperations(opened.db, 1500);
    expect(getGitDeliveryOperation(opened.db, prepared.id)?.receipt.state).toBe('prepared');
    expect(getGitDeliveryOperation(opened.db, active.id)?.receipt.state).toBe('unknown');
    expect(getGitDeliveryOperation(opened.db, done.id)?.receipt.state).toBe('succeeded');
    expect(opened.sqlite.prepare('SELECT * FROM sessions').all()).toEqual(before.session);
    expect(opened.sqlite.prepare('SELECT * FROM approval_requests').all()).toEqual(
      before.approvals,
    );
    expect(opened.sqlite.prepare('SELECT * FROM diagnostic_events').all()).toEqual(
      before.diagnostics,
    );
  });
});
