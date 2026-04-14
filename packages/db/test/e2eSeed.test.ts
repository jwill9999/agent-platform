import { afterEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import { getMcpServer, getSkill } from '../src/repositories/registry.js';
import { loadAgentById } from '../src/mappers.js';
import { E2E_MCP_ID, E2E_SKILL_ID, E2E_SPECIALIST_ID, runE2eSeed } from '../src/seed/e2eSeed.js';
import { runSeed } from '../src/seed/runSeed.js';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('runE2eSeed', () => {
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

  it('creates specialist, skill, and MCP rows idempotently', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'e2e-seed-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'test.sqlite');
    const { db, sqlite } = openDatabase(sqlitePath);
    try {
      runSeed(db);
      runE2eSeed(db);
      runE2eSeed(db);

      const mcp = getMcpServer(db, E2E_MCP_ID);
      expect(mcp?.transport).toBe('stdio');
      expect(mcp?.command).toBe('npx');

      const skill = getSkill(db, E2E_SKILL_ID);
      expect(skill?.tools).toContain(`${E2E_MCP_ID}:read_file`);

      const agent = loadAgentById(db, E2E_SPECIALIST_ID);
      expect(agent?.allowedMcpServerIds).toEqual([E2E_MCP_ID]);
      expect(agent?.allowedSkillIds).toEqual([E2E_SKILL_ID]);
    } finally {
      closeDatabase(sqlite);
    }
  });
});
