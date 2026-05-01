import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import { createSession, deleteSession, replaceAgent } from '../src/repositories/registry.js';
import {
  deleteWorkingMemoryArtifact,
  getWorkingMemoryArtifact,
  upsertWorkingMemoryArtifact,
} from '../src/repositories/workingMemory.js';

describe('working memory repository', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;
  let sessionId: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-working-memory-'));
    const opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    db = opened.db;
    sqlite = opened.sqlite;

    replaceAgent(db, {
      id: 'agent-1',
      slug: 'agent-1',
      name: 'Test Agent',
      systemPrompt: 'sys',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    sessionId = createSession(db, { agentId: 'agent-1' }).id;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and merges bounded session-scoped working state', () => {
    const first = upsertWorkingMemoryArtifact(
      db,
      {
        sessionId,
        runId: 'run-1',
        currentGoal: 'Implement working memory',
        activeTask: 'agent-platform-memory.2',
        decisions: ['Keep it session scoped'],
        importantFiles: ['apps/api/src/infrastructure/http/v1/chatRouter.ts'],
        toolsUsed: ['sys_read_file'],
        toolSummaries: [
          { toolName: 'sys_read_file', ok: true, summary: 'Read chat router.', atMs: 1000 },
        ],
        nextAction: 'Run tests',
      },
      1000,
    );

    expect(first.summary).toContain('Goal: Implement working memory');
    expect(first.decisions).toEqual(['Keep it session scoped']);

    const updated = upsertWorkingMemoryArtifact(
      db,
      {
        sessionId,
        runId: 'run-2',
        decisions: ['Keep it session scoped', 'Summarize tool output'],
        importantFiles: ['packages/db/src/repositories/workingMemory.ts'],
        toolsUsed: ['sys_read_file', 'sys_bash'],
        blockers: ['Waiting for approval'],
        pendingApprovalIds: ['approval-1'],
      },
      2000,
    );

    expect(updated.runId).toBe('run-2');
    expect(updated.decisions).toEqual(['Keep it session scoped', 'Summarize tool output']);
    expect(updated.importantFiles).toEqual([
      'packages/db/src/repositories/workingMemory.ts',
      'apps/api/src/infrastructure/http/v1/chatRouter.ts',
    ]);
    expect(updated.toolsUsed).toEqual(['sys_read_file', 'sys_bash']);
    expect(updated.blockers).toEqual(['Waiting for approval']);
    expect(updated.pendingApprovalIds).toEqual(['approval-1']);
    expect(updated.createdAtMs).toBe(1000);
    expect(updated.updatedAtMs).toBe(2000);
  });

  it('is deleted when the owning session is deleted', () => {
    upsertWorkingMemoryArtifact(db, { sessionId, currentGoal: 'Temporary state' }, 1000);
    expect(getWorkingMemoryArtifact(db, sessionId)).toBeDefined();

    deleteSession(db, sessionId);

    expect(getWorkingMemoryArtifact(db, sessionId)).toBeUndefined();
  });

  it('can be explicitly deleted', () => {
    upsertWorkingMemoryArtifact(db, { sessionId, currentGoal: 'Temporary state' }, 1000);
    expect(deleteWorkingMemoryArtifact(db, sessionId)).toBe(true);
    expect(deleteWorkingMemoryArtifact(db, sessionId)).toBe(false);
  });
});
