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

function trustedMigrations() {
  return readMigrationFiles({
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  });
}

function rejectSuppliedMigrationsUnchanged(
  path: string,
  migrations: ReturnType<typeof trustedMigrations>,
) {
  const before = inspect(path);
  const sqlite = new Database(path);
  try {
    expect(() => applyVerifiedMigrations(sqlite, migrations)).toThrow(
      /DATABASE_MIGRATION_HISTORY_MISMATCH/,
    );
  } finally {
    sqlite.close();
  }
  expect(inspect(path)).toEqual(before);
}

describe('SDK-MIG legacy watermark bridge', () => {
  it('SDK-MIG01 upgrades only0021 and preserves every original record and ordered journal, then reopens', () => {
    const path = profile('sdk-watermark');
    const before = inspect(path);
    expect(before.rows.__drizzle_migrations).toHaveLength(22);
    expect(before.rows.secret_refs).toHaveLength(1);
    expect(before.rows.model_configs).toHaveLength(1);
    expect(before.rows.projects).toHaveLength(1);
    expect(before.rows.provider_continuations).toBeUndefined();
    expect(before.rows.messages[0]).toHaveProperty(
      'workspace_events_json',
      '{"syntheticOpaqueWorkspaceEvent":"retain-exactly"}',
    );
    openDatabase(path).sqlite.close();
    const after = inspect(path);
    for (const [name, rows] of Object.entries(before.rows)) {
      if (name === '__drizzle_migrations') continue;
      let expected = rows;
      if (name === 'messages') {
        expected = rows.map((row) => ({ ...row, provider_continuation_format: 0 }));
      }
      if (name === 'model_configs') {
        expected = rows.map((row) => ({ ...row, base_url: null }));
      }
      expect(after.rows[name]).toEqual(expected);
    }
    expect(after.rows.provider_continuations).toEqual([]);
    expect(after.rows.__drizzle_migrations.slice(0, 22)).toEqual(before.rows.__drizzle_migrations);
    const sdk = trustedMigrations()[21];
    expect(after.rows.__drizzle_migrations.slice(22)).toEqual([
      { id: null, hash: sdk.hash, created_at: sdk.folderMillis },
    ]);
    for (let n = 0; n < 2; n++) openDatabase(path).sqlite.close();
    expect(inspect(path)).toEqual(after);
  });

  it('SDK-MIG01 also supports the exact canonical pre-schema with unrelated opaque later history', () => {
    const path = profile('sdk-watermark');
    const sqlite = new Database(path);
    sqlite.exec('ALTER TABLE messages DROP COLUMN workspace_events_json');
    sqlite
      .prepare('UPDATE __drizzle_migrations SET hash=? WHERE hash=?')
      .run('f'.repeat(64), '43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915');
    sqlite.close();
    const before = inspect(path);
    openDatabase(path).sqlite.close();
    const after = inspect(path);
    expect(after.rows.messages).toEqual(
      before.rows.messages.map((row) => ({
        ...row,
        provider_continuation_format: 0,
      })),
    );
    expect(after.rows.secret_refs).toEqual(before.rows.secret_refs);
    expect(after.rows.__drizzle_migrations.slice(0, 22)).toEqual(before.rows.__drizzle_migrations);
    expect(after.rows.__drizzle_migrations).toHaveLength(23);
    openDatabase(path).sqlite.close();
    expect(inspect(path)).toEqual(after);
  });

  it('SDK-MIG02 never replays0021 for an existing adopter with later opaque history', () => {
    const path = profile('complete-unknown');
    const before = inspect(path);
    for (let n = 0; n < 2; n++) openDatabase(path).sqlite.close();
    expect(inspect(path)).toEqual(before);
  });

  it.each([
    ['legacy slug prerequisite', 'DROP INDEX agents_slug_idx; ALTER TABLE agents DROP COLUMN slug'],
    [
      'migration journal trigger',
      `CREATE TRIGGER adopter_journal_effect AFTER INSERT ON __drizzle_migrations
      BEGIN UPDATE messages SET content='unexpected adopter effect' WHERE id='retained-message'; END`,
    ],
  ])(
    'SDK-MIG04 denies a historical adopter with changed %s before incidental repair',
    (_name, sql) => {
      const path = profile('sdk-watermark');
      openDatabase(path).sqlite.close();
      const sqlite = new Database(path);
      sqlite.exec(sql);
      sqlite.close();
      const execute = Database.prototype.exec;
      let attemptedBackfill = false;
      const spy = vi.spyOn(Database.prototype, 'exec').mockImplementation(function (
        this: Database.Database,
        statement: string,
      ) {
        if (
          this.name === path &&
          (statement.includes('ALTER TABLE agents ADD') ||
            statement.includes('UPDATE agents SET slug'))
        ) {
          attemptedBackfill = true;
        }
        return execute.call(this, statement);
      });
      try {
        rejectUnchanged(path);
        expect(attemptedBackfill).toBe(false);
      } finally {
        spy.mockRestore();
      }
    },
  );

  it.each([
    [
      'missing historical binding',
      "UPDATE __drizzle_migrations SET hash='" +
        'f'.repeat(64) +
        "' WHERE created_at=1785803000000",
    ],
    [
      'wrong historical time',
      'UPDATE __drizzle_migrations SET created_at=1785803000001 WHERE created_at=1785803000000',
    ],
    ['missing predecessor', 'DELETE FROM __drizzle_migrations WHERE created_at=1777800000000'],
    [
      'wrong predecessor time',
      'UPDATE __drizzle_migrations SET created_at=created_at+1 WHERE created_at=1777800000000',
    ],
    [
      'duplicate predecessor',
      'INSERT INTO __drizzle_migrations(hash,created_at) SELECT hash,created_at FROM __drizzle_migrations WHERE created_at=1777800000000',
    ],
    [
      'duplicate unknown',
      "INSERT INTO __drizzle_migrations(hash,created_at) SELECT hash,created_at FROM __drizzle_migrations WHERE hash='" +
        '43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915' +
        "'",
    ],
    [
      'malformed unknown hash',
      "UPDATE __drizzle_migrations SET hash='invalid' WHERE hash='" +
        '43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915' +
        "'",
    ],
    [
      'malformed unknown time',
      "UPDATE __drizzle_migrations SET created_at='invalid' WHERE hash='" +
        '43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915' +
        "'",
    ],
  ])('SDK-MIG03 denies %s without schema, record or journal changes', (_name, sql) => {
    const path = profile('sdk-watermark');
    const sqlite = new Database(path);
    sqlite.exec(sql);
    sqlite.close();
    rejectUnchanged(path);
  });

  it.each(['hash', 'timestamp', 'SQL bytes', 'predecessor SQL bytes', 'breakpoints'])(
    'SDK-MIG03 denies changed canonical %s even when effective SQL is otherwise valid',
    (kind) => {
      const path = profile('sdk-watermark');
      const migrations = trustedMigrations();
      const sdk = migrations[21];
      if (kind === 'hash') sdk.hash = 'e'.repeat(64);
      if (kind === 'timestamp') sdk.folderMillis += 1;
      if (kind === 'SQL bytes') sdk.sql[0] += '\n-- same SQL, different published bytes\n';
      if (kind === 'predecessor SQL bytes') migrations[0].sql[0] += '\n-- altered predecessor\n';
      if (kind === 'breakpoints') sdk.bps = false;
      rejectSuppliedMigrationsUnchanged(path, migrations);
    },
  );

  it('SDK-MIG03 never admits an additional below-watermark migration through the0021 exception', () => {
    const path = profile('sdk-watermark');
    const migrations = trustedMigrations();
    const sql = 'CREATE TABLE forbidden_future_fixture(id text PRIMARY KEY)';
    migrations.push({
      sql: [sql],
      hash: createHash('sha256').update(sql).digest('hex'),
      folderMillis: migrations[21].folderMillis + 1,
      bps: true,
    });
    rejectSuppliedMigrationsUnchanged(path, migrations);
  });

  it.each([
    [
      'different historical column',
      'ALTER TABLE messages RENAME COLUMN workspace_events_json TO different_workspace_json',
    ],
    ['extra historical column', 'ALTER TABLE messages ADD COLUMN another_workspace_json text'],
    ['partial endpoint column', 'ALTER TABLE model_configs ADD COLUMN base_url text'],
    [
      'partial continuation marker',
      'ALTER TABLE messages ADD COLUMN provider_continuation_format integer DEFAULT 0 NOT NULL',
    ],
    [
      'partial continuation table',
      'CREATE TABLE provider_continuations(message_id text PRIMARY KEY)',
    ],
    ['unrecognized touched column', 'ALTER TABLE messages ADD COLUMN unexpected text'],
    [
      'changed legacy index',
      'DROP INDEX tools_slug_idx; CREATE INDEX tools_slug_idx ON tools(slug)',
    ],
    [
      'legacy backfill prerequisite',
      'DROP INDEX agents_slug_idx; ALTER TABLE agents DROP COLUMN slug',
    ],
    [
      'legacy skills backfill prerequisite',
      'DROP INDEX skills_slug_idx; ALTER TABLE skills DROP COLUMN name',
    ],
    ['missing run index', 'DROP INDEX run_attempts_run_idx'],
    [
      'changed partial predicate',
      "DROP INDEX controlled_runs_active_session_idx; CREATE UNIQUE INDEX controlled_runs_active_session_idx ON controlled_runs(session_id) WHERE state='running'",
    ],
  ])('SDK-MIG04 denies %s before migration or incidental legacy backfill', (_name, sql) => {
    const path = profile('sdk-watermark');
    const sqlite = new Database(path);
    sqlite.exec(sql);
    sqlite.close();
    rejectUnchanged(path);
  });

  it.each(['type', 'default', 'order'])(
    'SDK-MIG04 denies changed historical column %s without normalizing its DDL',
    (kind) => {
      const path = profile('sdk-watermark');
      const sqlite = new Database(path);
      const original = (
        sqlite
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'")
          .get() as { sql: string }
      ).sql;
      let changed = original.replace(
        '`workspace_events_json` text',
        '`workspace_events_json` integer',
      );
      if (kind === 'default')
        changed = original.replace(
          '`workspace_events_json` text',
          "`workspace_events_json` text DEFAULT '{}'",
        );
      if (kind === 'order')
        changed = original.replace(
          '`tool_calls_json` text, `workspace_events_json` text',
          '`workspace_events_json` text, `tool_calls_json` text',
        );
      expect(changed).not.toBe(original);
      const message = sqlite.prepare('SELECT * FROM messages').get() as Record<string, unknown>;
      const indexes = sqlite
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='messages' AND sql IS NOT NULL",
        )
        .all() as { sql: string }[];
      sqlite.exec('DROP TABLE messages');
      sqlite.exec(changed);
      sqlite
        .prepare(
          `INSERT INTO messages(
        id,session_id,role,content,tool_call_id,created_at_ms,tool_calls_json,workspace_events_json
      ) VALUES(?,?,?,?,?,?,?,?)`,
        )
        .run(
          message.id,
          message.session_id,
          message.role,
          message.content,
          message.tool_call_id,
          message.created_at_ms,
          message.tool_calls_json,
          message.workspace_events_json,
        );
      for (const index of indexes) sqlite.exec(index.sql);
      sqlite.close();
      rejectUnchanged(path);
    },
  );

  it.each(['default', 'check'])(
    'SDK-MIG04 denies changed %s semantics with all indexes retained',
    (kind) => {
      const path = profile('sdk-watermark');
      const sqlite = new Database(path);
      const table = sqlite
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='controlled_runs'")
        .get() as { sql: string };
      const indexes = sqlite
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='controlled_runs' AND sql IS NOT NULL",
        )
        .all() as { sql: string }[];
      const changed =
        kind === 'default'
          ? table.sql.replace('DEFAULT 1', 'DEFAULT 2')
          : table.sql.replace('CHECK (version > 0)', 'CHECK (version >= 0)');
      expect(changed).not.toBe(table.sql);
      sqlite.exec('DROP TABLE controlled_runs');
      sqlite.exec(changed);
      for (const index of indexes) sqlite.exec(index.sql);
      sqlite.close();
      rejectUnchanged(path);
    },
  );

  it.each([
    '__drizzle_migrations',
    'messages',
    'model_configs',
    'approval_requests',
    'controlled_runs',
    'run_executions',
    'run_attempts',
    'git_delivery_operations',
    'agents',
    'mcp_servers',
    'skills',
    'tools',
  ])('SDK-MIG04 denies a trigger on %s before it can modify retained state', (table) => {
    const path = profile('sdk-watermark');
    const sqlite = new Database(path);
    sqlite.exec(`CREATE TRIGGER unexpected_bridge_effect AFTER INSERT ON ${table}
      BEGIN UPDATE messages SET content='bridge trigger fired' WHERE id='retained-message'; END`);
    sqlite.close();
    rejectUnchanged(path);
  });

  it.each(['third statement', 'journal prefix', 'final schema'])(
    'SDK-MIG04 rolls back the entire transaction after controlled %s failure',
    (kind) => {
      const path = profile('sdk-watermark');
      const before = inspect(path);
      const sqlite = new Database(path);
      const execute = sqlite.exec.bind(sqlite);
      let observedSdkColumns = false;
      const spy = vi.spyOn(sqlite, 'exec').mockImplementation((statement) => {
        if (!statement.includes('CREATE TABLE `provider_continuations`')) return execute(statement);
        observedSdkColumns =
          Boolean(
            sqlite
              .prepare(
                "SELECT 1 FROM pragma_table_info('messages') WHERE name='provider_continuation_format'",
              )
              .get(),
          ) &&
          Boolean(
            sqlite
              .prepare("SELECT 1 FROM pragma_table_info('model_configs') WHERE name='base_url'")
              .get(),
          );
        if (kind === 'third statement') throw new Error('synthetic migration failure');
        execute(statement);
        if (kind === 'journal prefix')
          execute(
            'UPDATE __drizzle_migrations SET created_at=created_at+1 WHERE created_at=1777800000000',
          );
        if (kind === 'final schema')
          execute('CREATE INDEX unexpected_bridge_index ON provider_continuations(session_id)');
        return sqlite;
      });
      try {
        expect(() => applyVerifiedMigrations(sqlite, trustedMigrations())).toThrow(
          /DATABASE_MIGRATION_HISTORY_MISMATCH/,
        );
        expect(observedSdkColumns).toBe(true);
      } finally {
        spy.mockRestore();
        sqlite.close();
      }
      expect(inspect(path)).toEqual(before);
      // The unmodified fixture can subsequently upgrade; failure did not retain a lock or partial DDL.
      openDatabase(path).sqlite.close();
    },
  );
});
