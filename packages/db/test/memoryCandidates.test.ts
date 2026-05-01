import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import {
  createMemoryCandidates,
  extractMemoryCandidates,
} from '../src/repositories/memoryCandidates.js';
import { queryMemories } from '../src/repositories/memories.js';

describe('memory candidate extraction', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-memory-candidates-'));
    const opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    db = opened.db;
    sqlite = opened.sqlite;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts explicit remember instructions as pending review candidates', () => {
    const memories = createMemoryCandidates(
      db,
      {
        sessionId: 'session-1',
        agentId: 'agent-1',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'Remember that agent-platform should keep memory retrieval auditable.',
            createdAtMs: 1000,
          },
        ],
      },
      { nowMs: 2000 },
    );

    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      scope: 'agent',
      scopeId: 'agent-1',
      kind: 'decision',
      status: 'pending',
      reviewStatus: 'unreviewed',
      content: 'that agent-platform should keep memory retrieval auditable.',
      confidence: 0.84,
      safetyState: 'safe',
      tags: ['candidate', 'explicit'],
    });
    expect(memories[0]?.metadata).toMatchObject({
      candidate: true,
      rationale: 'The user explicitly asked the agent to remember this information.',
      scopeSuggestion: { scope: 'agent', scopeId: 'agent-1' },
    });
  });

  it('extracts corrections without making them active memories', () => {
    const memories = createMemoryCandidates(db, {
      sessionId: 'session-1',
      messages: [
        {
          role: 'user',
          content: 'Actually, do not use a graph database for memory v1; use relational tables.',
        },
      ],
    });

    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      kind: 'correction',
      status: 'pending',
      reviewStatus: 'unreviewed',
      scope: 'session',
      scopeId: 'session-1',
    });
    expect(queryMemories(db, { status: 'approved' })).toEqual([]);
  });

  it('extracts repeated failures and remediation evidence', () => {
    const candidates = extractMemoryCandidates({
      sessionId: 'session-1',
      projectId: 'agent-platform',
      messages: [
        {
          id: 'tool-1',
          role: 'tool',
          toolName: 'sys_file_info',
          content: JSON.stringify({ error: 'STAT_FAILED', message: 'ENOENT: missing file' }),
        },
        {
          id: 'tool-2',
          role: 'tool',
          toolName: 'sys_file_info',
          content: JSON.stringify({ error: 'STAT_FAILED', message: 'ENOENT: missing file' }),
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Fixed by creating the parent directory first; tests are green.',
        },
      ],
    });

    expect(candidates.map((candidate) => candidate.kind)).toEqual([
      'failure_learning',
      'failure_learning',
    ]);
    expect(candidates[0]?.evidence).toHaveLength(2);
    expect(candidates[1]?.rationale).toContain('remediation');
  });

  it('redacts credential-like content in candidate memories', () => {
    const memories = createMemoryCandidates(db, {
      sessionId: 'session-1',
      messages: [
        {
          role: 'user',
          content: 'Remember that the API key is sk-proj-abcdefghijklmnopqrstuvwxyz1234567890',
        },
      ],
    });

    expect(memories).toHaveLength(1);
    expect(memories[0]?.safetyState).toBe('redacted');
    expect(memories[0]?.content).toContain('[REDACTED:OpenAI API Key]');
    expect(memories[0]?.content).not.toContain('sk-proj-abcdefghijklmnopqrstuvwxyz1234567890');
    expect(JSON.stringify(memories[0]?.source.metadata)).toContain('[REDACTED:OpenAI API Key]');
    expect(JSON.stringify(memories[0]?.source.metadata)).not.toContain(
      'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890',
    );
  });

  it('ignores ordinary conversation without memory signals', () => {
    expect(
      extractMemoryCandidates({
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'Can you explain what this function does?' }],
      }),
    ).toEqual([]);
  });
});
