import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { repairLegacySlugMigrationIfNeeded } from '../src/legacyRepair.js';

describe('repairLegacySlugMigrationIfNeeded', () => {
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

  it('adds name and slug to skills when missing (pre-0005 shape)', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-legacy-repair-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'legacy.sqlite');
    const sqlite = new Database(sqlitePath);
    sqlite.exec(`
      CREATE TABLE skills (
        id text PRIMARY KEY NOT NULL,
        goal text NOT NULL,
        constraints_json text NOT NULL,
        tool_ids_json text NOT NULL,
        output_schema_json text
      );
    `);
    sqlite
      .prepare('INSERT INTO skills (id, goal, constraints_json, tool_ids_json) VALUES (?, ?, ?, ?)')
      .run('s1', 'My demo goal text', '[]', '[]');

    repairLegacySlugMigrationIfNeeded(sqlite);

    const row = sqlite.prepare('SELECT name, slug FROM skills WHERE id = ?').get('s1') as {
      name: string;
      slug: string;
    };
    expect(row.name).toBe('My demo goal text');
    expect(row.slug).toBe('my-demo-goal-text');
    sqlite.close();
  });
});
