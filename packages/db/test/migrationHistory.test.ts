import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../src/database.js';
import { applyVerifiedMigrations } from '../src/migrationHistory.js';
import { createMigrationProfile } from '../../../scripts/testing/migration-profile.mjs';

// Wrap only metadata loading for its failure-path control; all normal SQL/fixtures remain real.
vi.mock('drizzle-orm/migrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/migrator')>();
  return { ...actual, readMigrationFiles: vi.fn(actual.readMigrationFiles) };
});

const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function profile(mode: Parameters<typeof createMigrationProfile>[1]) {
  const dir = mkdtempSync(join(tmpdir(), 'migration-history-test-'));
  directories.push(dir);
  const path = join(dir, 'profile.sqlite');
  createMigrationProfile(path, mode);
  return path;
}
function inspect(path: string) {
  const sqlite = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const schema = sqlite
      .prepare(
        "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",
      )
      .all();
    const names = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const rows = Object.fromEntries(
      names.map(({ name }) => [
        name,
        sqlite.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
      ]),
    );
    return { schema, rows };
  } finally {
    sqlite.close();
  }
}
function rejectUnchanged(path: string) {
  const before = inspect(path);
  expect(() => {
    const opened = openDatabase(path);
    opened.sqlite.close();
  }).toThrow(/DATABASE_MIGRATION_HISTORY_MISMATCH/);
  expect(inspect(path)).toEqual(before);
  // A failed open must release its connection/write lock, not just throw a useful message.
  const probe = new Database(path, { fileMustExist: true, timeout: 100 });
  try {
    probe.exec('BEGIN EXCLUSIVE; ROLLBACK');
  } finally {
    probe.close();
  }
}

describe('retained migration history regressions', () => {
  it('MIG-R01 upgrades an ordinary retained v18 profile without changing its original rows', () => {
    const path = profile('legacy');
    const before = inspect(path);
    for (let n = 0; n < 2; n++) openDatabase(path).sqlite.close();
    const after = inspect(path);
    for (const [name, rows] of Object.entries(before.rows)) {
      if (name === '__drizzle_migrations') continue;
      const expected =
        name === 'messages'
          ? rows.map((row) => ({ ...row, provider_continuation_format: 0 }))
          : name === 'model_configs'
            ? rows.map((row) => ({ ...row, base_url: null }))
            : rows;
      expect(after.rows[name]).toEqual(expected);
    }
    for (const table of [
      'git_delivery_operations',
      'controlled_runs',
      'run_executions',
      'run_attempts',
    ]) {
      expect(after.rows[table]).toEqual([]);
    }
    expect(after.rows.__drizzle_migrations).toHaveLength(
      before.rows.__drizzle_migrations.length + 3,
    );
  });
  it('MIG-R02/04 rejects the escaped future-journal/missing-schema case repeatedly without mutation', () => {
    const path = profile('blocked');
    rejectUnchanged(path);
    rejectUnchanged(path);
  });
  it('MIG-R03/04 preserves an unknown later entry when every known migration and schema is present', () => {
    const path = profile('complete-unknown');
    const before = inspect(path);
    for (let n = 0; n < 2; n++) openDatabase(path).sqlite.close();
    expect(inspect(path)).toEqual(before);
  });
  it('sanitizes migration-metadata failure and releases its failed-open connection', () => {
    const path = profile('complete');
    vi.mocked(readMigrationFiles).mockImplementationOnce(() => {
      throw new Error('private-source-path-and-SQL-must-not-be-logged');
    });
    rejectUnchanged(path);
  });
  it('rejects a newly known migration below an unknown high-water mark without replay or stamping', () => {
    const path = profile('complete-unknown');
    const before = inspect(path);
    const migrations = readMigrationFiles({
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
    const sql = 'CREATE TABLE future_fixture(id text PRIMARY KEY)';
    migrations.push({
      sql: [sql],
      hash: createHash('sha256').update(sql).digest('hex'),
      folderMillis: Math.max(...migrations.map((migration) => migration.folderMillis)) + 1,
      bps: true,
    });
    const sqlite = new Database(path);
    try {
      expect(() => applyVerifiedMigrations(sqlite, migrations)).toThrow(
        /DATABASE_MIGRATION_HISTORY_MISMATCH/,
      );
    } finally {
      sqlite.close();
    }
    expect(inspect(path)).toEqual(before);
  });
  it.each([
    'UPDATE __drizzle_migrations SET created_at=created_at+1 WHERE created_at=1777900000000',
    "UPDATE __drizzle_migrations SET hash='not-a-hash' WHERE created_at=1777900000000",
    'INSERT INTO __drizzle_migrations(hash,created_at) SELECT hash,created_at FROM __drizzle_migrations WHERE created_at=1777900000000',
    "UPDATE __drizzle_migrations SET created_at='invalid' WHERE created_at=1777900000000",
  ])('rejects conflicting or malformed recorded history: %s', (sql) => {
    const path = profile('complete');
    const sqlite = new Database(path);
    sqlite.exec(sql);
    sqlite.close();
    rejectUnchanged(path);
  });
  it('MIG-R05 rolls back earlier pending SQL and journal inserts if a later migration collides', () => {
    const path = profile('legacy');
    const sqlite = new Database(path);
    sqlite.exec('CREATE TABLE run_attempts (id text)');
    sqlite.close();
    rejectUnchanged(path);
    expect(inspect(path).rows.git_delivery_operations).toBeUndefined();
  });
  it('MIG-R05 rolls back pending migration work when final schema verification rejects existing drift', () => {
    const path = profile('complete');
    const sqlite = new Database(path);
    sqlite.exec(`
      DROP TABLE run_attempts;
      DROP TABLE run_executions;
      DROP TABLE controlled_runs;
      DROP INDEX approval_requests_run_idx;
      DROP INDEX git_delivery_active_repo_idx;
      DELETE FROM __drizzle_migrations WHERE created_at = 1777900000000;
    `);
    sqlite.close();
    rejectUnchanged(path);
    expect(inspect(path).rows.controlled_runs).toBeUndefined();
  });
  it('keeps supported legacy slug repair within the same open-time transaction', () => {
    const path = profile('complete');
    const sqlite = new Database(path);
    sqlite.exec('DROP INDEX agents_slug_idx; ALTER TABLE agents DROP COLUMN slug');
    sqlite.close();
    openDatabase(path).sqlite.close();
    expect(inspect(path).rows.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'retained-agent', slug: 'retained-synthetic-agent' }),
      ]),
    );
  });
  it('rolls back legacy backfills too when final schema verification fails', () => {
    const path = profile('complete');
    const sqlite = new Database(path);
    sqlite.exec(
      'DROP INDEX agents_slug_idx; ALTER TABLE agents DROP COLUMN slug; DROP INDEX git_delivery_active_repo_idx',
    );
    sqlite.close();
    rejectUnchanged(path);
    expect(inspect(path).rows.agents[0]).not.toHaveProperty('slug');
  });
  it.each(['type', 'foreign-key', 'check'] as const)(
    'rejects a complete ledger with a changed %s contract',
    (kind) => {
      const path = profile('complete');
      const sqlite = new Database(path);
      const name = kind === 'foreign-key' ? 'run_attempts' : 'controlled_runs';
      const original = (
        sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name) as {
          sql: string;
        }
      ).sql;
      const indexes = sqlite
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",
        )
        .all(name) as { sql: string }[];
      const replacement =
        kind === 'type'
          ? original.replace('version integer', 'version text')
          : kind === 'foreign-key'
            ? original.replace('REFERENCES run_executions(execution_id)', '')
            : original.replace('CHECK (version > 0)', 'CHECK (version >= 0)');
      expect(replacement).not.toBe(original);
      sqlite.exec(`DROP TABLE ${name}`);
      sqlite.exec(replacement);
      for (const index of indexes) sqlite.exec(index.sql);
      sqlite.close();
      rejectUnchanged(path);
    },
  );
  it.each([
    'git_delivery_operations',
    'controlled_runs',
    'run_executions',
    'run_attempts',
    'approval_requests',
    'provider_continuations',
    'messages',
    'model_configs',
  ])('rejects an unexpected trigger on %s without firing it or changing records', (table) => {
    const path = profile('complete');
    const sqlite = new Database(path);
    sqlite.exec(`CREATE TRIGGER unexpected_effect AFTER INSERT ON ${table}
      BEGIN UPDATE messages SET content='unexpected trigger effect' WHERE id='retained-message'; END`);
    sqlite.close();
    rejectUnchanged(path);
    expect(inspect(path).rows.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'retained-message', content: 'Synthetic retained message' }),
      ]),
    );
  });
  it.each([
    ['missing private table', 'DROP TABLE provider_continuations'],
    [
      'missing continuation marker',
      'ALTER TABLE messages DROP COLUMN provider_continuation_format',
    ],
    ['missing endpoint column', 'ALTER TABLE model_configs DROP COLUMN base_url'],
    ['missing column', 'ALTER TABLE controlled_runs RENAME COLUMN state TO incompatible_state'],
    ['missing index', 'DROP INDEX run_attempts_run_idx'],
    [
      'lost uniqueness',
      "DROP INDEX git_delivery_active_repo_idx; CREATE INDEX git_delivery_active_repo_idx ON git_delivery_operations(repository_root) WHERE state='executing'",
    ],
    [
      'weakened partial predicate',
      "DROP INDEX controlled_runs_active_session_idx; CREATE UNIQUE INDEX controlled_runs_active_session_idx ON controlled_runs(session_id) WHERE state='running'",
    ],
  ])('rejects a complete recorded ledger with %s', (_name, sql) => {
    const path = profile('complete');
    const sqlite = new Database(path);
    sqlite.exec(sql);
    sqlite.close();
    rejectUnchanged(path);
  });
});
