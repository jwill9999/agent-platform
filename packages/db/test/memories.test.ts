import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import {
  countMemories,
  createMemory,
  createMemoryLink,
  deleteMemory,
  getMemory,
  listMemoryLinks,
  queryMemories,
  updateMemory,
} from '../src/repositories/memories.js';
import * as schema from '../src/schema.js';

type MemoryInput = Parameters<typeof createMemory>[1];

function memoryInput(overrides: Partial<MemoryInput>): MemoryInput {
  return {
    scope: 'project',
    scopeId: 'project-1',
    kind: 'decision',
    content: 'Use relational storage for memory v1.',
    source: { kind: 'manual' },
    ...overrides,
  };
}

describe('memory repository', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-memory-'));
    const opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    db = opened.db;
    sqlite = opened.sqlite;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates, reads, updates, queries, counts, and deletes scoped memories', () => {
    const first = createMemory(
      db,
      memoryInput({
        kind: 'decision',
        status: 'approved',
        reviewStatus: 'approved',
        confidence: 0.92,
        source: {
          kind: 'user',
          id: 'message-1',
          metadata: { ticket: 'memory.1', 'review.key': 'dotted' },
        },
        tags: ['architecture', 'memory', 'quoted "tag"'],
        metadata: { owner: 'platform' },
        safetyState: 'safe',
      }),
      { id: 'memory-1', nowMs: 1000 },
    );
    createMemory(
      db,
      memoryInput({
        scope: 'agent',
        scopeId: 'agent-1',
        kind: 'preference',
        content: 'Prefer short final summaries.',
        confidence: 0.6,
        source: { kind: 'manual' },
      }),
      { id: 'memory-2', nowMs: 2000 },
    );

    expect(getMemory(db, first.id)).toEqual(first);
    expect(queryMemories(db, { scope: 'project', scopeId: 'project-1' })).toHaveLength(1);
    expect(queryMemories(db, { kind: 'decision', status: 'approved' })).toHaveLength(1);
    expect(queryMemories(db, { reviewStatus: 'approved', minConfidence: 0.9 })).toHaveLength(1);
    expect(queryMemories(db, { tag: 'memory' })).toHaveLength(1);
    expect(queryMemories(db, { tag: 'quoted "tag"' })).toHaveLength(1);
    expect(queryMemories(db, { tag: 'memo' })).toEqual([]);
    expect(queryMemories(db, { sourceMetadata: { ticket: 'memory.1' } })).toHaveLength(1);
    expect(queryMemories(db, { sourceMetadata: { 'review.key': 'dotted' } })).toHaveLength(1);
    expect(countMemories(db, { scope: 'agent', scopeId: 'agent-1' })).toBe(1);

    const updated = updateMemory(db, first.id, {
      status: 'archived',
      reviewStatus: 'needs_review',
      metadata: { owner: 'platform', reason: 'superseded' },
    });
    expect(updated.status).toBe('archived');
    expect(updated.reviewStatus).toBe('needs_review');
    expect(updated.metadata).toEqual({ owner: 'platform', reason: 'superseded' });

    expect(deleteMemory(db, first.id)).toBe(true);
    expect(deleteMemory(db, first.id)).toBe(false);
    expect(queryMemories(db, { scope: 'project', scopeId: 'project-1' })).toEqual([]);
  });

  it('filters expired memories unless explicitly included', () => {
    createMemory(
      db,
      memoryInput({
        scope: 'global',
        scopeId: undefined,
        kind: 'fact',
        content: 'Expired note.',
        confidence: 0.8,
        source: { kind: 'manual' },
        expiresAtMs: 1500,
      }),
      { id: 'expired', nowMs: 1000 },
    );
    createMemory(
      db,
      memoryInput({
        scope: 'global',
        scopeId: undefined,
        kind: 'fact',
        content: 'Current note.',
        confidence: 0.8,
        source: { kind: 'manual' },
      }),
      { id: 'current', nowMs: 2000 },
    );

    expect(queryMemories(db, { scope: 'global' }, { nowMs: 2000 }).map((m) => m.id)).toEqual([
      'current',
    ]);
    expect(
      queryMemories(db, { scope: 'global', includeExpired: true }, { nowMs: 2000 }).map(
        (m) => m.id,
      ),
    ).toEqual(['current', 'expired']);
  });

  it('redacts sensitive source metadata and memory metadata before persistence', () => {
    const memory = createMemory(
      db,
      memoryInput({
        scope: 'session',
        scopeId: 'session-1',
        kind: 'failure_learning',
        content: 'A tool failed because a secret was placed in metadata.',
        source: {
          kind: 'tool',
          id: 'tool-call-1',
          metadata: {
            api_key: 'sk-secret',
            nested: { token: 'token-secret' },
            array: [{ password: 'password-secret' }],
          },
        },
        metadata: { authorization: 'Bearer secret', safe: 'value' },
      }),
      { id: 'redacted', nowMs: 1000 },
    );

    expect(memory.safetyState).toBe('redacted');
    expect(memory.source.metadata).toEqual({
      api_key: '[REDACTED]',
      nested: { token: '[REDACTED]' },
      array: [{ password: '[REDACTED]' }],
    });
    expect(memory.metadata).toEqual({ authorization: '[REDACTED]', safe: 'value' });

    const literalMarker = createMemory(
      db,
      memoryInput({
        scope: 'session',
        scopeId: 'session-1',
        kind: 'working_note',
        content: 'A user deliberately wrote the redaction marker as normal metadata.',
        source: {
          kind: 'manual',
          metadata: { note: '[REDACTED]' },
        },
      }),
      { id: 'literal-marker', nowMs: 1000 },
    );

    expect(literalMarker.safetyState).toBe('unchecked');
    expect(literalMarker.source.metadata).toEqual({ note: '[REDACTED]' });
  });

  it('falls back for malformed stored JSON metadata and tags', () => {
    db.insert(schema.memories)
      .values({
        id: 'malformed-json',
        scope: 'session',
        scopeId: 'session-1',
        kind: 'working_note',
        status: 'approved',
        reviewStatus: 'approved',
        content: 'Legacy row with malformed JSON fields.',
        confidence: 0.8,
        sourceKind: 'manual',
        sourceId: null,
        sourceLabel: null,
        sourceMetadataJson: '{broken',
        tagsJson: 'not-json',
        metadataJson: '[',
        safetyState: 'safe',
        createdAtMs: 1000,
        updatedAtMs: 1000,
        expiresAtMs: null,
        reviewedAtMs: null,
        reviewedBy: null,
      })
      .run();

    const memory = getMemory(db, 'malformed-json');

    expect(memory.source.metadata).toEqual({});
    expect(memory.metadata).toEqual({});
    expect(memory.tags).toEqual([]);
  });

  it('stores links between memories and cascades them on delete', () => {
    createMemory(
      db,
      memoryInput({
        content: 'Initial decision.',
        source: { kind: 'manual' },
      }),
      { id: 'source', nowMs: 1000 },
    );
    createMemory(
      db,
      memoryInput({
        kind: 'correction',
        content: 'Later correction.',
        source: { kind: 'manual' },
      }),
      { id: 'target', nowMs: 1000 },
    );

    const link = createMemoryLink(db, {
      sourceMemoryId: 'source',
      targetMemoryId: 'target',
      relation: 'replaces',
      metadata: { reason: 'new evidence' },
    });

    expect(listMemoryLinks(db, 'source')).toEqual([link]);
    deleteMemory(db, 'source');
    expect(listMemoryLinks(db, 'target')).toEqual([]);
  });
});
