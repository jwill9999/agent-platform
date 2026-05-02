import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import { createMemory } from '../src/repositories/memories.js';
import {
  formatPromptMemoryBundle,
  retrievePromptMemories,
} from '../src/repositories/memoryRetrieval.js';

type MemoryInput = Parameters<typeof createMemory>[1];

function approvedMemory(overrides: Partial<MemoryInput>): MemoryInput {
  return {
    scope: 'agent',
    scopeId: 'agent-1',
    kind: 'decision',
    status: 'approved',
    reviewStatus: 'approved',
    content: 'Use relational memory retrieval with source metadata.',
    confidence: 0.9,
    source: { kind: 'manual', id: 'review-1', label: 'reviewed note' },
    tags: ['memory'],
    safetyState: 'safe',
    ...overrides,
  };
}

describe('memory retrieval', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-memory-retrieval-'));
    const opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    db = opened.db;
    sqlite = opened.sqlite;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retrieves approved relevant scoped memories with source metadata', () => {
    createMemory(db, approvedMemory({}), { id: 'agent-memory', nowMs: 1000 });
    createMemory(
      db,
      approvedMemory({
        scope: 'session',
        scopeId: 'session-1',
        kind: 'preference',
        content: 'Prefer concise memory retrieval answers.',
        source: { kind: 'user', id: 'message-1', label: 'user request' },
        tags: ['retrieval'],
      }),
      { id: 'session-memory', nowMs: 2000 },
    );

    const bundle = retrievePromptMemories(db, {
      scope: { sessionId: 'session-1', agentId: 'agent-1' },
      query: 'How should memory retrieval work?',
      nowMs: 3000,
    });

    expect(bundle.items.map((item) => item.id)).toEqual(['session-memory', 'agent-memory']);
    expect(bundle.items[0]).toMatchObject({
      kind: 'preference',
      source: { kind: 'user', id: 'message-1', label: 'user request' },
    });
    expect(formatPromptMemoryBundle(bundle)).toContain('Long-term approved memories');
    expect(formatPromptMemoryBundle(bundle)).toContain('sourceId=message-1');
  });

  it('excludes pending, expired, low-confidence, unsafe, irrelevant, and cross-scope memories', () => {
    createMemory(db, approvedMemory({}), { id: 'included', nowMs: 1000 });
    createMemory(db, approvedMemory({ status: 'pending', reviewStatus: 'unreviewed' }), {
      id: 'pending',
      nowMs: 1000,
    });
    createMemory(db, approvedMemory({ expiresAtMs: 1500 }), { id: 'expired', nowMs: 1000 });
    createMemory(db, approvedMemory({ confidence: 0.4 }), { id: 'low-confidence', nowMs: 1000 });
    createMemory(db, approvedMemory({ safetyState: 'blocked' }), { id: 'blocked', nowMs: 1000 });
    createMemory(
      db,
      approvedMemory({ content: 'Unrelated note about billing invoices.', tags: ['billing'] }),
      { id: 'irrelevant', nowMs: 1000 },
    );
    createMemory(db, approvedMemory({ scope: 'agent', scopeId: 'other-agent' }), {
      id: 'cross-scope',
      nowMs: 1000,
    });

    const bundle = retrievePromptMemories(db, {
      scope: { sessionId: 'session-1', agentId: 'agent-1' },
      query: 'memory retrieval source metadata',
      nowMs: 2000,
    });

    expect(bundle.items.map((item) => item.id)).toEqual(['included']);
    expect(bundle.omitted).toMatchObject({
      notRelevant: 1,
    });
  });

  it('uses project scope only when the project id is explicit', () => {
    createMemory(
      db,
      approvedMemory({
        scope: 'project',
        scopeId: 'project-1',
        content: 'Project memory retrieval must be auditable.',
      }),
      { id: 'project-memory', nowMs: 1000 },
    );

    expect(
      retrievePromptMemories(db, {
        scope: { sessionId: 'session-1', agentId: 'agent-1' },
        query: 'project memory retrieval',
      }).items,
    ).toEqual([]);

    expect(
      retrievePromptMemories(db, {
        scope: { sessionId: 'session-1', agentId: 'agent-1', projectId: 'project-1' },
        query: 'project memory retrieval',
      }).items.map((item) => item.id),
    ).toEqual(['project-memory']);
  });
});
