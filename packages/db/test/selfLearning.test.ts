import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import { createMemory, queryMemories, updateMemory } from '../src/repositories/memories.js';
import { evaluateSelfLearning } from '../src/repositories/selfLearning.js';

function pathError(message: string, id: string) {
  return {
    kind: 'observability_error' as const,
    id,
    message,
    atMs: 1000,
  };
}

describe('self-learning evaluator', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-self-learning-'));
    const opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    db = opened.db;
    sqlite = opened.sqlite;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not propose when the monitored objective has too few matching signals', () => {
    const result = evaluateSelfLearning(db, {
      sessionId: 'session-1',
      observedOutcomes: [pathError("ENOENT: no such file, open '/workspace/app.ts'", 'event-1')],
    });

    expect(result.proposed).toBe(false);
    expect(result.metrics.before.matchingSignals).toBe(1);
    expect(queryMemories(db, { tag: 'self-learning', includeExpired: true })).toEqual([]);
  });

  it('creates a pending review-gated candidate for repeated workspace path errors', () => {
    const result = evaluateSelfLearning(
      db,
      {
        sessionId: 'session-1',
        agentId: 'agent-1',
        observedOutcomes: [
          pathError("ENOENT: no such file, open '/workspace/app.ts'", 'event-1'),
          pathError("STAT_FAILED: no such file or directory, stat '/workspace/app.ts'", 'event-2'),
        ],
      },
      { nowMs: 2000 },
    );

    expect(result.proposed).toBe(true);
    expect(result.memory).toMatchObject({
      scope: 'agent',
      scopeId: 'agent-1',
      kind: 'failure_learning',
      status: 'pending',
      reviewStatus: 'unreviewed',
      tags: ['candidate', 'self-learning', 'workspace-path', 'failure'],
    });
    expect(result.memory?.metadata).toMatchObject({
      candidate: true,
      selfLearning: {
        objective: 'recoverable_workspace_path_errors',
        status: 'proposed',
        blockedAutonomousActions: ['code_change', 'policy_change', 'prompt_change', 'beads_task'],
      },
    });
    expect(result.metrics.before).toMatchObject({ observedSignals: 2, matchingSignals: 2 });
  });

  it('uses pending memory candidate data and avoids duplicate pending proposals', () => {
    createMemory(
      db,
      {
        scope: 'session',
        scopeId: 'session-1',
        kind: 'failure_learning',
        status: 'pending',
        reviewStatus: 'unreviewed',
        content: "Repeated runtime failure observed: ENOENT: missing '/workspace/app.ts'",
        confidence: 0.68,
        source: { kind: 'observability', id: 'session-1' },
        tags: ['candidate', 'failure', 'repeated'],
        metadata: { candidate: true },
      },
      { id: 'candidate-1', nowMs: 1000 },
    );

    const first = evaluateSelfLearning(db, {
      sessionId: 'session-1',
      observedOutcomes: [pathError("READ_FAILED: no such file '/workspace/app.ts'", 'event-1')],
    });
    const second = evaluateSelfLearning(db, {
      sessionId: 'session-1',
      observedOutcomes: [pathError("READ_FAILED: no such file '/workspace/app.ts'", 'event-2')],
    });

    expect(first.proposed).toBe(true);
    expect(first.metrics.before.candidateSignals).toBe(1);
    expect(second.proposed).toBe(false);
    expect(second.reason).toContain('pending self-learning proposal');
  });

  it('keeps proposed learning inactive until explicitly approved', () => {
    const result = evaluateSelfLearning(db, {
      sessionId: 'session-1',
      observedOutcomes: [
        pathError("ENOENT: no such file, open '/workspace/app.ts'", 'event-1'),
        pathError("ENOENT: no such file, open '/workspace/app.ts'", 'event-2'),
      ],
    });

    expect(queryMemories(db, { status: 'approved', tag: 'self-learning' })).toEqual([]);

    const approved = updateMemory(db, result.memory!.id, {
      status: 'approved',
      reviewStatus: 'approved',
      reviewedAtMs: 3000,
      reviewedBy: 'local-user',
    });

    expect(approved.status).toBe('approved');
    expect(queryMemories(db, { status: 'approved', tag: 'self-learning' })).toHaveLength(1);
  });
});
