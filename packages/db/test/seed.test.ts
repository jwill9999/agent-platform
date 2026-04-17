import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AgentSchema } from '@agent-platform/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import { loadAgentById } from '../src/mappers.js';
import * as schema from '../src/schema.js';
import { CODING_AGENT_ID, DEFAULT_AGENT_ID, DEMO_SKILL_ID } from '../src/seed/constants.js';
import { runSeed } from '../src/seed/runSeed.js';

describe('seed', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it('is idempotent: two runs keep seeded agent rows', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-seed-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'db.sqlite');
    const open = () => openDatabase(sqlitePath);

    let { db, sqlite } = open();
    runSeed(db);
    runSeed(db);
    closeDatabase(sqlite);

    ({ db, sqlite } = open());
    const defaultRows = db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, DEFAULT_AGENT_ID))
      .all();
    expect(defaultRows).toHaveLength(1);
    const codingRows = db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, CODING_AGENT_ID))
      .all();
    expect(codingRows).toHaveLength(1);
    const skills = db.select().from(schema.skills).where(eq(schema.skills.id, DEMO_SKILL_ID)).all();
    expect(skills).toHaveLength(1);
    closeDatabase(sqlite);
  });

  it('makes the default agent loadable and valid per AgentSchema', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-seed-'));
    dirs.push(dir);
    const { db, sqlite } = openDatabase(path.join(dir, 'a.sqlite'));
    runSeed(db);
    const agent = loadAgentById(db, DEFAULT_AGENT_ID);
    expect(agent).toBeDefined();
    expect(() => AgentSchema.parse(agent)).not.toThrow();
    expect(agent!.allowedSkillIds).toContain(DEMO_SKILL_ID);
    expect(agent!.allowedToolIds).toEqual([]);
    expect(agent!.allowedMcpServerIds).toEqual([]);
    closeDatabase(sqlite);
  });

  it('makes the seeded coding agent loadable and valid per AgentSchema', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-seed-'));
    dirs.push(dir);
    const { db, sqlite } = openDatabase(path.join(dir, 'coding.sqlite'));
    runSeed(db);
    const agent = loadAgentById(db, CODING_AGENT_ID);
    expect(agent).toBeDefined();
    expect(() => AgentSchema.parse(agent)).not.toThrow();
    expect(agent!.slug).toBe('coding');
    expect(agent!.allowedSkillIds).toEqual([]);
    closeDatabase(sqlite);
  });
});
