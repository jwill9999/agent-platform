import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import {
  ForeignKeyViolationError,
  UniqueConstraintError,
  wrapConstraintError,
} from '../src/errors.js';
import { appendMessage, listMessagesBySession } from '../src/repositories/messages.js';
import {
  createSession,
  deleteAgent,
  deleteSession,
  deleteSkill,
  getAgent,
  listSessions,
  replaceAgent,
  upsertMcpServer,
  upsertSkill,
  upsertTool,
} from '../src/repositories/registry.js';
import * as schema from '../src/schema.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeAgent(overrides: Partial<{ id: string; slug: string; name: string }> = {}) {
  return {
    id: overrides.id ?? 'agent-1',
    slug: overrides.slug ?? 'agent-1',
    name: overrides.name ?? 'Test Agent',
    systemPrompt: 'sys',
    allowedSkillIds: [] as string[],
    allowedToolIds: [] as string[],
    allowedMcpServerIds: [] as string[],
    executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeSkill(id: string, slug: string) {
  return {
    id,
    slug,
    name: slug,
    goal: 'test goal',
    constraints: [] as string[],
    tools: [] as string[],
  };
}

function makeTool(id: string, slug: string) {
  return {
    id,
    slug,
    name: slug,
    description: 'test',
    inputSchema: {},
    handler: { type: 'inline' as const, code: 'return 1;' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeMcpServer(id: string, slug: string) {
  return {
    id,
    slug,
    name: slug,
    transport: 'stdio',
    command: 'echo',
    args: [] as string[],
  };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                        */
/* ------------------------------------------------------------------ */

describe('Referential integrity', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-fk-'));
    const sqlitePath = path.join(tmpDir, 'test.sqlite');
    const opened = openDatabase(sqlitePath);
    db = opened.db;
    sqlite = opened.sqlite;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /* -------------------------------------------------------------- */
  /*  Cascade deletes                                                */
  /* -------------------------------------------------------------- */

  describe('cascade deletes', () => {
    it('deleting an agent cascades to agent_skills join rows', () => {
      const skill = makeSkill('skill-1', 'skill-1');
      upsertSkill(db, skill);
      const agent = { ...makeAgent(), allowedSkillIds: ['skill-1'] };
      replaceAgent(db, agent);

      const before = db.select().from(schema.agentSkills).all();
      expect(before).toHaveLength(1);

      deleteAgent(db, 'agent-1');

      const after = db.select().from(schema.agentSkills).all();
      expect(after).toHaveLength(0);
    });

    it('deleting an agent cascades to agent_tools join rows', () => {
      const tool = makeTool('tool-1', 'tool-1');
      upsertTool(db, tool);
      const agent = { ...makeAgent(), allowedToolIds: ['tool-1'] };
      replaceAgent(db, agent);

      deleteAgent(db, 'agent-1');

      const after = db.select().from(schema.agentTools).all();
      expect(after).toHaveLength(0);
    });

    it('deleting an agent cascades to agent_mcp_servers join rows', () => {
      const mcp = makeMcpServer('mcp-1', 'mcp-1');
      upsertMcpServer(db, mcp);
      const agent = { ...makeAgent(), allowedMcpServerIds: ['mcp-1'] };
      replaceAgent(db, agent);

      deleteAgent(db, 'agent-1');

      const after = db.select().from(schema.agentMcpServers).all();
      expect(after).toHaveLength(0);
    });

    it('deleting an agent cascades to sessions', () => {
      replaceAgent(db, makeAgent());
      createSession(db, { agentId: 'agent-1' });
      createSession(db, { agentId: 'agent-1' });

      expect(listSessions(db)).toHaveLength(2);

      deleteAgent(db, 'agent-1');

      expect(listSessions(db)).toHaveLength(0);
    });

    it('deleting an agent cascades to sessions AND their messages', () => {
      replaceAgent(db, makeAgent());
      const session = createSession(db, { agentId: 'agent-1' });
      appendMessage(db, { sessionId: session.id, role: 'user', content: 'hello' });
      appendMessage(db, { sessionId: session.id, role: 'assistant', content: 'hi' });

      deleteAgent(db, 'agent-1');

      const msgs = listMessagesBySession(db, session.id);
      expect(msgs).toHaveLength(0);
    });

    it('deleting a session cascades to its messages', () => {
      replaceAgent(db, makeAgent());
      const session = createSession(db, { agentId: 'agent-1' });
      appendMessage(db, { sessionId: session.id, role: 'user', content: 'hello' });

      deleteSession(db, session.id);

      const msgs = listMessagesBySession(db, session.id);
      expect(msgs).toHaveLength(0);
    });

    it('deleting a skill cascades to agent_skills join rows only', () => {
      const skill = makeSkill('skill-1', 'skill-1');
      upsertSkill(db, skill);
      const agent = { ...makeAgent(), allowedSkillIds: ['skill-1'] };
      replaceAgent(db, agent);

      // Delete skill — agent still exists, but join row removed
      deleteSkill(db, 'skill-1');

      const joinRows = db.select().from(schema.agentSkills).all();
      expect(joinRows).toHaveLength(0);
      expect(getAgent(db, 'agent-1')).toBeTruthy();
    });
  });

  /* -------------------------------------------------------------- */
  /*  FK violation errors                                            */
  /* -------------------------------------------------------------- */

  describe('FK violation errors', () => {
    it('createSession with non-existent agentId throws ForeignKeyViolationError', () => {
      expect(() => createSession(db, { agentId: 'does-not-exist' })).toThrow(
        ForeignKeyViolationError,
      );
    });

    it('ForeignKeyViolationError has descriptive message', () => {
      try {
        createSession(db, { agentId: 'ghost' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ForeignKeyViolationError);
        expect((e as ForeignKeyViolationError).message).toContain('ghost');
        expect((e as ForeignKeyViolationError).code).toBe('FOREIGN_KEY_VIOLATION');
      }
    });

    it('replaceAgent with non-existent skillId throws ForeignKeyViolationError', () => {
      const agent = { ...makeAgent(), allowedSkillIds: ['no-such-skill'] };
      expect(() => replaceAgent(db, agent)).toThrow(ForeignKeyViolationError);
    });

    it('replaceAgent with non-existent toolId throws ForeignKeyViolationError', () => {
      const agent = { ...makeAgent(), allowedToolIds: ['no-such-tool'] };
      expect(() => replaceAgent(db, agent)).toThrow(ForeignKeyViolationError);
    });

    it('replaceAgent with non-existent mcpServerId throws ForeignKeyViolationError', () => {
      const agent = { ...makeAgent(), allowedMcpServerIds: ['no-such-mcp'] };
      expect(() => replaceAgent(db, agent)).toThrow(ForeignKeyViolationError);
    });
  });

  /* -------------------------------------------------------------- */
  /*  wrapConstraintError unit tests                                 */
  /* -------------------------------------------------------------- */

  describe('wrapConstraintError', () => {
    it('returns value on success', () => {
      const result = wrapConstraintError(() => 42, 'test');
      expect(result).toBe(42);
    });

    it('re-throws non-SQLite errors unchanged', () => {
      expect(() =>
        wrapConstraintError(() => {
          throw new TypeError('not a db error');
        }, 'test'),
      ).toThrow(TypeError);
    });

    it('wraps SQLITE_CONSTRAINT_FOREIGNKEY as ForeignKeyViolationError', () => {
      const sqliteErr = Object.assign(new Error('FOREIGN KEY constraint failed'), {
        code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
      });
      expect(() =>
        wrapConstraintError(() => {
          throw sqliteErr;
        }, 'ctx'),
      ).toThrow(ForeignKeyViolationError);
    });

    it('wraps SQLITE_CONSTRAINT_UNIQUE as UniqueConstraintError', () => {
      const sqliteErr = Object.assign(new Error('UNIQUE constraint failed: t.col'), {
        code: 'SQLITE_CONSTRAINT_UNIQUE',
      });
      expect(() =>
        wrapConstraintError(() => {
          throw sqliteErr;
        }, 'ctx'),
      ).toThrow(UniqueConstraintError);
    });

    it('wraps SQLITE_CONSTRAINT_PRIMARYKEY as UniqueConstraintError', () => {
      const sqliteErr = Object.assign(new Error('UNIQUE constraint failed: t.id'), {
        code: 'SQLITE_CONSTRAINT_PRIMARYKEY',
      });
      expect(() =>
        wrapConstraintError(() => {
          throw sqliteErr;
        }, 'ctx'),
      ).toThrow(UniqueConstraintError);
    });

    it('preserves original error as cause', () => {
      const sqliteErr = Object.assign(new Error('FK fail'), {
        code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
      });
      try {
        wrapConstraintError(() => {
          throw sqliteErr;
        }, 'test');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ForeignKeyViolationError);
        expect((e as ForeignKeyViolationError).cause).toBe(sqliteErr);
      }
    });
  });
});
