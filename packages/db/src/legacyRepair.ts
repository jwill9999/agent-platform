import type Database from 'better-sqlite3';

/** Mirrors drizzle/0005_add_slugs.sql when the DB predates that migration but the journal is inconsistent. */
function tableExists(sqlite: Database.Database, name: string): boolean {
  const row = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { '1': number } | undefined;
  return row !== undefined;
}

function columnSet(sqlite: Database.Database, table: string): Set<string> | null {
  if (!tableExists(sqlite, table)) return null;
  const rows = sqlite.prepare('SELECT name FROM pragma_table_info(?)').all(table) as {
    name: string;
  }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Idempotent repair after `migrate()`: add slug/name columns from migration 0005 if the physical
 * schema is missing them (stale dev.sqlite vs migration history).
 */
export function repairLegacySlugMigrationIfNeeded(sqlite: Database.Database): void {
  sqlite.transaction(() => {
    ensureSlugColumn(sqlite, 'agents');
    ensureSlugColumn(sqlite, 'mcp_servers');
    ensureSlugColumn(sqlite, 'tools');
    repairSkillsColumns(sqlite);

    createSlugIndexIfNeeded(sqlite, 'agents');
    createSlugIndexIfNeeded(sqlite, 'mcp_servers');
    createSlugIndexIfNeeded(sqlite, 'skills');
    createSlugIndexIfNeeded(sqlite, 'tools');
  })();
}

/** Add a `slug` column to a table and backfill from `name` if missing. */
function ensureSlugColumn(sqlite: Database.Database, table: string): void {
  const cols = columnSet(sqlite, table);
  if (!cols || cols.has('slug')) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN slug text DEFAULT '' NOT NULL`);
  sqlite.exec(
    `UPDATE ${table} SET slug = LOWER(REPLACE(REPLACE(TRIM(name), ' ', '-'), '--', '-'))`,
  );
}

/** Skills need both `name` and `slug`, backfilled from `goal`. */
function repairSkillsColumns(sqlite: Database.Database): void {
  const cols = columnSet(sqlite, 'skills');
  if (!cols) return;

  let needsBackfill = false;
  if (!cols.has('name')) {
    sqlite.exec(`ALTER TABLE skills ADD COLUMN name text DEFAULT '' NOT NULL`);
    needsBackfill = true;
  }
  if (!cols.has('slug')) {
    sqlite.exec(`ALTER TABLE skills ADD COLUMN slug text DEFAULT '' NOT NULL`);
    needsBackfill = true;
  }
  if (needsBackfill) {
    sqlite.exec(`
      UPDATE skills SET
        name = SUBSTR(goal, 1, 60),
        slug = LOWER(REPLACE(REPLACE(TRIM(SUBSTR(goal, 1, 60)), ' ', '-'), '--', '-'))
    `);
  }
}

/** Create a unique index on slug if the table exists. */
function createSlugIndexIfNeeded(sqlite: Database.Database, table: string): void {
  if (!tableExists(sqlite, table)) return;
  sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${table}_slug_idx ON ${table} (slug)`);
}
