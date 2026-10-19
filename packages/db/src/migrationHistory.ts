import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import type { MigrationMeta } from 'drizzle-orm/migrator';
import { MigrationHistoryError } from './errors.js';
import { repairLegacySlugMigrationIfNeeded } from './legacyRepair.js';

const scopedTables = new Set([
  'git_delivery_operations',
  'controlled_runs',
  'run_executions',
  'run_attempts',
  'provider_continuations',
  'messages',
  'model_configs',
]);
// Published SDK migration identity is immutable, including its original low timestamp.
const sdkMigrationHash = '04c2000d3736b69ee01cf2b5e51d18d037fa5ca460aa27556e1bbb3f71501bee';
const sdkMigrationTime = 1778000000000;
// Exact recovered SQL bytes independently hash to this retained historical entry.
// This statement is executed ONLY in an empty trusted reference, never in the opened profile.
const historicalWorkspace = {
  hash: '43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915',
  folderMillis: 1785803000000,
  sql: ['ALTER TABLE `messages` ADD COLUMN `workspace_events_json` text;\n'],
  bps: true,
};
const sdkPredecessorIdentity = '65b61e21f762ff2775a5348e08c83d3c0f004cea240dcbb18f49f219ac8bf364';
const bridgeTables = new Set([
  ...scopedTables,
  'agents',
  'mcp_servers',
  'skills',
  'tools',
  'approval_requests',
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
function scopedSchema(sqlite: Database.Database, tables = scopedTables) {
  const rows = sqlite
    .prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name')
    .all() as SchemaRow[];
  if (
    rows.some(
      (row) =>
        row.type === 'trigger' &&
        (tables.has(row.tbl_name) || row.tbl_name === 'approval_requests'),
    )
  ) {
    throw new MigrationHistoryError();
  }
  const definitions = rows
    .filter(
      (row) =>
        tables.has(row.tbl_name) ||
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

function expectedSchema(migrations: MigrationMeta[], tables = scopedTables) {
  const reference = new Database(':memory:');
  try {
    for (const migration of migrations) {
      for (const statement of migration.sql) reference.exec(statement);
    }
    return scopedSchema(reference, tables);
  } finally {
    reference.close();
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readOrderedJournal(sqlite: Database.Database) {
  return sqlite
    .prepare('SELECT rowid,* FROM __drizzle_migrations ORDER BY rowid')
    .all() as (JournalRow & Record<string, unknown>)[];
}

function isPublishedSdkMigration(migration: MigrationMeta | undefined): boolean {
  return (
    migration !== undefined &&
    migration.hash === sdkMigrationHash &&
    migration.folderMillis === sdkMigrationTime &&
    migration.bps === true &&
    digest(migration.sql.join('--> statement-breakpoint')) === sdkMigrationHash
  );
}

function referenceMigrations(migrations: MigrationMeta[], historical: boolean): MigrationMeta[] {
  return historical
    ? [...migrations.slice(0, 21), historicalWorkspace, ...migrations.slice(21)]
    : migrations;
}

function assertSdkIdentity(migrations: MigrationMeta[], rows: JournalRow[]): void {
  const predecessors = migrations.slice(0, 21);
  const identity = predecessors.map((migration) => [migration.hash, migration.folderMillis]);
  if (
    digest(historicalWorkspace.sql.join('--> statement-breakpoint')) !== historicalWorkspace.hash ||
    migrations.length !== 22 ||
    !isPublishedSdkMigration(migrations[21]) ||
    digest(JSON.stringify(identity)) !== sdkPredecessorIdentity ||
    new Set(rows.map((row) => row.hash)).size !== rows.length
  )
    throw new MigrationHistoryError();
  const recorded = new Set(rows.map((row) => row.hash));
  if (
    !predecessors.every(
      (migration) =>
        recorded.has(migration.hash) &&
        digest(migration.sql.join('--> statement-breakpoint')) === migration.hash,
    )
  ) {
    throw new MigrationHistoryError();
  }
  if (hasConflictingHistoricalTime(rows)) throw new MigrationHistoryError();
}

function hasConflictingHistoricalTime(rows: JournalRow[]): boolean {
  const historical = rows.find((row) => row.hash === historicalWorkspace.hash);
  return historical !== undefined && historical.created_at !== historicalWorkspace.folderMillis;
}

function assertNoJournalTrigger(sqlite: Database.Database): void {
  if (
    sqlite
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='trigger' AND tbl_name='__drizzle_migrations'",
      )
      .get()
  )
    throw new MigrationHistoryError();
}

/** Only exact published0021 and the two proven pre-schema shapes can cross the watermark. */
function assertSdkBridge(
  sqlite: Database.Database,
  migrations: MigrationMeta[],
  pending: MigrationMeta[],
  rows: JournalRow[],
  historical: boolean,
): void {
  assertSdkIdentity(migrations, rows);
  if (pending.length !== 1 || migrations[21] !== pending[0]) {
    throw new MigrationHistoryError();
  }
  assertNoJournalTrigger(sqlite);
  const reference = referenceMigrations(migrations.slice(0, 21), historical);
  if (
    JSON.stringify(scopedSchema(sqlite, bridgeTables)) !==
    JSON.stringify(expectedSchema(reference, bridgeTables))
  ) {
    throw new MigrationHistoryError();
  }
}

function assertSdkJournalState(
  sqlite: Database.Database,
  before: ReturnType<typeof readOrderedJournal>,
  append: boolean,
): void {
  const after = readOrderedJournal(sqlite);
  if (
    after.length !== before.length + Number(append) ||
    JSON.stringify(after.slice(0, before.length)) !== JSON.stringify(before)
  ) {
    throw new MigrationHistoryError();
  }
  const appended = after[before.length];
  if (append && (appended?.hash !== sdkMigrationHash || appended.created_at !== sdkMigrationTime)) {
    throw new MigrationHistoryError();
  }
}

function validateJournal(rows: JournalRow[], migrations: MigrationMeta[]) {
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
  return { recorded, highWater };
}

function pendingMigrations(sqlite: Database.Database, migrations: MigrationMeta[]) {
  const rows = sqlite
    .prepare('SELECT hash,created_at FROM __drizzle_migrations')
    .all() as JournalRow[];
  const { recorded, highWater } = validateJournal(rows, migrations);
  const pending = migrations.filter((migration) => !recorded.has(migration.hash));
  const bridge = pending.some((migration) => migration.folderMillis <= highWater);
  const historical = rows.some((row) => row.hash === historicalWorkspace.hash);
  if (bridge) assertSdkBridge(sqlite, migrations, pending, rows, historical);
  if (historical && !bridge) {
    assertSdkIdentity(migrations, rows);
    assertNoJournalTrigger(sqlite);
    if (pending.length !== 0) throw new MigrationHistoryError();
  }
  return {
    pending,
    bridge,
    historical,
    originalJournal: bridge || historical ? readOrderedJournal(sqlite) : undefined,
  };
}

/** Internal migration entry point; callers supply only metadata from committed migration files. */
export function applyVerifiedMigrations(
  sqlite: Database.Database,
  migrations: MigrationMeta[],
): void {
  try {
    sqlite
      .transaction(() => {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric
      )`);
        const { pending, bridge, historical, originalJournal } = pendingMigrations(
          sqlite,
          migrations,
        );
        const tables = bridge || historical ? bridgeTables : scopedTables;
        const expected = expectedSchema(referenceMigrations(migrations, historical), tables);
        // Variant adopters must already match before the legacy repair can touch any records.
        if (
          historical &&
          !bridge &&
          JSON.stringify(scopedSchema(sqlite, tables)) !== JSON.stringify(expected)
        ) {
          throw new MigrationHistoryError();
        }
        const insert = sqlite.prepare(
          'INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)',
        );
        for (const migration of pending) {
          for (const statement of migration.sql) sqlite.exec(statement);
          insert.run(migration.hash, migration.folderMillis);
        }
        // better-sqlite3 nests this existing repair with SAVEPOINT, under the same rollback owner.
        repairLegacySlugMigrationIfNeeded(sqlite);
        if (JSON.stringify(scopedSchema(sqlite, tables)) !== JSON.stringify(expected)) {
          throw new MigrationHistoryError();
        }
        if (originalJournal) assertSdkJournalState(sqlite, originalJournal, bridge);
      })
      .immediate();
  } catch {
    // Do not attach the original exception: startup logs must not contain SQL or user data.
    throw new MigrationHistoryError();
  }
}
