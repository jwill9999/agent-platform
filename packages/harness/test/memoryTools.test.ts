import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, createMemory, openDatabase } from '@agent-platform/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MEMORY_TOOL_IDS, MEMORY_TOOLS, executeMemoryTool } from '../src/tools/memoryTools.js';

describe('memory tools', () => {
  let ctx: ReturnType<typeof openDatabase>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'memory-tools-test-'));
    ctx = openDatabase(path.join(tmpDir, 'test.sqlite'));
    createMemory(
      ctx.db,
      {
        scope: 'session',
        scopeId: 'session-1',
        kind: 'working_note',
        status: 'pending',
        reviewStatus: 'unreviewed',
        content: 'Candidate memory for the active chat.',
        confidence: 0.7,
        source: { kind: 'manual' },
        tags: ['candidate'],
      },
      { id: 'visible-memory', nowMs: 1000 },
    );
    createMemory(
      ctx.db,
      {
        scope: 'session',
        scopeId: 'other-session',
        kind: 'working_note',
        content: 'Hidden memory.',
        confidence: 0.7,
        source: { kind: 'manual' },
      },
      { id: 'hidden-memory', nowMs: 1000 },
    );
  });

  afterEach(() => {
    closeDatabase(ctx.sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('registers scoped memory tools with destructive actions requiring approval', () => {
    expect(MEMORY_TOOLS.map((tool) => tool.id)).toEqual([
      MEMORY_TOOL_IDS.list,
      MEMORY_TOOL_IDS.get,
      MEMORY_TOOL_IDS.review,
      MEMORY_TOOL_IDS.delete,
      MEMORY_TOOL_IDS.export,
    ]);
    expect(MEMORY_TOOLS.find((tool) => tool.id === MEMORY_TOOL_IDS.delete)?.requiresApproval).toBe(
      true,
    );
  });

  it('lists and reviews only memory visible to the current session', async () => {
    const context = { db: ctx.db, sessionId: 'session-1', agentId: 'agent-1' };
    const listed = await executeMemoryTool(MEMORY_TOOL_IDS.list, {}, context);
    expect(listed?.type).toBe('tool_result');
    if (listed?.type === 'tool_result') {
      expect(listed.data.count).toBe(1);
      expect((listed.data.memories as Array<{ id: string }>)[0]?.id).toBe('visible-memory');
    }

    const reviewed = await executeMemoryTool(
      MEMORY_TOOL_IDS.review,
      { id: 'visible-memory', decision: 'approved' },
      context,
    );
    expect(reviewed?.type).toBe('tool_result');
    if (reviewed?.type === 'tool_result') {
      expect((reviewed.data.memory as { status: string }).status).toBe('approved');
    }
  });

  it('denies access to other session memories', async () => {
    const result = await executeMemoryTool(
      MEMORY_TOOL_IDS.get,
      { id: 'hidden-memory' },
      { db: ctx.db, sessionId: 'session-1', agentId: 'agent-1' },
    );
    expect(result).toMatchObject({ type: 'error', code: 'MEMORY_SCOPE_DENIED' });
  });
});
