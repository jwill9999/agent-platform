import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';

describe('migrations', () => {
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

  it('applies migrations on a clean database file', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-db-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 'nested', 'app.sqlite');
    const { sqlite } = openDatabase(sqlitePath);

    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('agents');
    expect(names).toContain('skills');
    expect(names).toContain('mcp_servers');
    expect(names).toContain('sessions');
    expect(names).toContain('approval_requests');
    expect(names).toContain('chat_metadata');
    expect(names).toContain('plugin_catalog_refs');
    expect(names).toContain('memories');
    expect(names).toContain('memory_links');
    expect(names).toContain('working_memory_artifacts');
    expect(names).toContain('projects');
    const columnsFor = (table: string) =>
      (
        sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{
          name: string;
        }>
      ).map((column) => column.name);
    const indexesFor = (table: string) =>
      (
        sqlite.prepare(`PRAGMA index_list(${table})`).all() as Array<{
          name: string;
        }>
      ).map((index) => index.name);
    const foreignTablesFor = (table: string) =>
      (
        sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<{
          table: string;
        }>
      ).map((foreignKey) => foreignKey.table);

    expect(columnsFor('sessions')).toContain('project_id');
    expect(columnsFor('memories')).toContain('project_id');
    expect(columnsFor('working_memory_artifacts')).toContain('project_id');
    expect(indexesFor('sessions')).toContain('sessions_project_idx');
    expect(indexesFor('memories')).toContain('memories_project_idx');
    expect(indexesFor('working_memory_artifacts')).toContain('working_memory_project_idx');
    expect(foreignTablesFor('sessions')).toContain('projects');
    expect(foreignTablesFor('memories')).toContain('projects');
    expect(foreignTablesFor('working_memory_artifacts')).toContain('projects');
    closeDatabase(sqlite);
  });
});
