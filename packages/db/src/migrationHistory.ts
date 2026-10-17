import Database from 'better-sqlite3';
import type { MigrationMeta } from 'drizzle-orm/migrator';
import { MigrationHistoryError } from './errors.js';
import { repairLegacySlugMigrationIfNeeded } from './legacyRepair.js';

const scopedTables = new Set([
  'git_delivery_operations',
  'controlled_runs',
  'run_executions',
  'run_attempts',
]);
const approvalColumns = new Set(['run_id', 'execution_payload_json', 'resumed_at_ms']);

interface JournalRow {
  hash: string;
  created_at: number;
}
interface SchemaRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

/** Exact trusted DDL, including literal/check/predicate semantics; no SQL rewriting. */
function scopedSchema(sqlite: Database.Database) {
  const rows = sqlite
    .prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name')
    .all() as SchemaRow[];
  if (
    rows.some(
      (row) =>
        row.type === 'trigger' &&
        (scopedTables.has(row.tbl_name) || row.tbl_name === 'approval_requests'),
    )
  ) {
    throw new MigrationHistoryError();
  }
  const definitions = rows
    .filter(
      (row) =>
        scopedTables.has(row.tbl_name) ||
        (row.type === 'index' && row.name === 'approval_requests_run_idx'),
    )
    .map((row) => ({ ...row, sql: row.sql?.trim() ?? null }));
  const columns = sqlite.prepare('SELECT * FROM pragma_table_info(?)').all('approval_requests') as {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
  }[];
  return {
    definitions,
    approvalBinding: columns
      .filter((column) => approvalColumns.has(column.name))
      .map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk })),
  };
}

function expectedSchema(migrations: MigrationMeta[]) {
  const reference = new Database(':memory:');
  try {
    for (const migration of migrations) {
      for (const statement of migration.sql) reference.exec(statement);
    }
    return scopedSchema(reference);
  } finally {
    reference.close();
  }
}

function pendingMigrations(sqlite: Database.Database, migrations: MigrationMeta[]) {
  const rows = sqlite
    .prepare('SELECT hash,created_at FROM __drizzle_migrations')
    .all() as JournalRow[];
  const knownHashes = new Map(
    migrations.map((migration) => [migration.hash, migration.folderMillis]),
  );
  const recorded = new Set<string>();
  let highWater = -Infinity;
  for (const row of rows) {
    if (
      !/^[a-f0-9]{64}$/.test(row.hash) ||
      !Number.isSafeInteger(row.created_at) ||
      row.created_at < 0 ||
      (knownHashes.has(row.hash) &&
        (knownHashes.get(row.hash) !== row.created_at || recorded.has(row.hash)))
    ) {
      throw new MigrationHistoryError();
    }
    recorded.add(row.hash);
    highWater = Math.max(highWater, row.created_at);
  }
  const pending = migrations.filter((migration) => !recorded.has(migration.hash));
  if (pending.some((migration) => migration.folderMillis <= highWater)) {
    throw new MigrationHistoryError();
  }
  return pending;
}

/** Internal migration entry point; callers supply only metadata from committed migration files. */
export function applyVerifiedMigrations(
  sqlite: Database.Database,
  migrations: MigrationMeta[],
): void {
  try {
    const expected = expectedSchema(migrations);
    sqlite
      .transaction(() => {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric
      )`);
        const pending = pendingMigrations(sqlite, migrations);
        const insert = sqlite.prepare(
          'INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)',
        );
        for (const migration of pending) {
          for (const statement of migration.sql) sqlite.exec(statement);
          insert.run(migration.hash, migration.folderMillis);
        }
        // better-sqlite3 nests this existing repair with SAVEPOINT, under the same rollback owner.
        repairLegacySlugMigrationIfNeeded(sqlite);
        if (JSON.stringify(scopedSchema(sqlite)) !== JSON.stringify(expected)) {
          throw new MigrationHistoryError();
        }
      })
      .immediate();
  } catch {
    // Do not attach the original exception: startup logs must not contain SQL or user data.
    throw new MigrationHistoryError();
  }
}
