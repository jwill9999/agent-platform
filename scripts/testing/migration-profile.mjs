import { Buffer } from 'node:buffer';
import { createCipheriv, randomBytes } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  closeSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const requireFromDb = createRequire(join(root, 'packages/db/package.json'));
const Database = requireFromDb('better-sqlite3');
const { drizzle } = requireFromDb('drizzle-orm/better-sqlite3');
const { migrate } = requireFromDb('drizzle-orm/better-sqlite3/migrator');

/** Synthetic retained profile, constructed independently of production openDatabase/seed. */
export function createMigrationProfile(sqlitePath, mode) {
  if (!['legacy', 'blocked', 'complete', 'complete-unknown', 'sdk-watermark'].includes(mode)) {
    throw new Error('Unknown synthetic migration profile');
  }
  mkdirSync(dirname(sqlitePath), { recursive: true });
  closeSync(openSync(sqlitePath, 'wx', 0o600));
  const folder = mkdtempSync(join(dirname(sqlitePath), 'migration-source-'));
  const sqlite = new Database(sqlitePath, { fileMustExist: true });
  try {
    cpSync(join(root, 'packages/db/drizzle'), folder, { recursive: true });
    const journalPath = join(folder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    const latest = Math.max(...journal.entries.map((entry) => entry.when));
    if (mode === 'legacy' || mode === 'blocked') {
      journal.entries = journal.entries.filter((entry) => entry.idx < 19);
      writeFileSync(journalPath, JSON.stringify(journal));
    } else if (mode === 'sdk-watermark') {
      journal.entries = journal.entries.filter((entry) => entry.idx < 21);
      writeFileSync(journalPath, JSON.stringify(journal));
    }
    sqlite.pragma('foreign_keys = ON');
    // Keep the upstream migrator here: exercising the new production guard would mask the escape.
    migrate(drizzle(sqlite), { migrationsFolder: folder });
    sqlite.exec(`
      INSERT INTO agents(id,name,slug,execution_limits_json,created_at_ms,updated_at_ms)
      VALUES('retained-agent','Retained synthetic agent','retained-agent','{}',1000,1000);
      INSERT INTO sessions(id,agent_id,title,created_at_ms,updated_at_ms)
      VALUES('retained-session','retained-agent','Retained synthetic session',1000,1000);
      INSERT INTO messages(id,session_id,role,content,created_at_ms)
      VALUES('retained-message','retained-session','user','Synthetic retained message',1000);
      INSERT INTO approval_requests(id,session_id,run_id,agent_id,tool_name,args_json,risk_tier,status,created_at_ms)
      VALUES('retained-approval','retained-session','legacy-run','retained-agent','synthetic-tool','{}','high','pending',1000);
    `);
    const key = randomBytes(32);
    const iv = randomBytes(12);
    try {
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([
        cipher.update('synthetic-only-credential'),
        cipher.final(),
      ]);
      sqlite
        .prepare(
          'INSERT INTO secret_refs(id,label,ciphertext_b64,iv_b64,auth_tag_b64,key_version,algorithm) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          'retained-secret',
          'Synthetic fixture only',
          ciphertext.toString('base64'),
          iv.toString('base64'),
          cipher.getAuthTag().toString('base64'),
          1,
          'aes-256-gcm-v1',
        );
    } finally {
      key.fill(0);
    }
    if (mode === 'sdk-watermark') {
      sqlite
        .prepare('UPDATE agents SET execution_limits_json=? WHERE id=?')
        .run(
          JSON.stringify({ maxSteps: 5, maxParallelTasks: 1, timeoutMs: 30000 }),
          'retained-agent',
        );
      // Synthetic reproduction of the cryptographically proven historical schema variant.
      sqlite.exec('ALTER TABLE `messages` ADD COLUMN `workspace_events_json` text;\n');
      sqlite
        .prepare('UPDATE messages SET workspace_events_json=? WHERE id=?')
        .run('{"syntheticOpaqueWorkspaceEvent":"retain-exactly"}', 'retained-message');
      const workspace = join(dirname(sqlitePath), 'retained-workspace');
      mkdirSync(workspace, { recursive: true });
      sqlite
        .prepare(
          `INSERT INTO model_configs(
        id,name,provider,model,secret_ref_id,created_at_ms,updated_at_ms
      ) VALUES(?,?,?,?,?,?,?)`,
        )
        .run(
          'retained-model-config',
          'Retained synthetic model',
          'openai',
          'synthetic-retained-model',
          'retained-secret',
          1000,
          1000,
        );
      sqlite
        .prepare(
          `INSERT INTO projects(
        id,slug,name,workspace_path,workspace_key,metadata_json,created_at_ms,updated_at_ms
      ) VALUES(?,?,?,?,?,?,?,?)`,
        )
        .run(
          'retained-project',
          'retained-synthetic-project',
          'Retained synthetic Project',
          workspace,
          'synthetic-retained-workspace',
          JSON.stringify({ source: 'desktop' }),
          1000,
          1000,
        );
      sqlite
        .prepare('UPDATE sessions SET project_id=? WHERE id=?')
        .run('retained-project', 'retained-session');
    }
    if (mode === 'blocked' || mode === 'complete-unknown' || mode === 'sdk-watermark') {
      sqlite
        .prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)')
        .run(
          mode === 'sdk-watermark'
            ? '43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915'
            : 'f'.repeat(64),
          mode === 'sdk-watermark' ? 1785803000000 : latest + 86_400_000,
        );
    }
  } finally {
    sqlite.close();
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Read only synthetic fixture state; never opens through the production migration path. */
export function inspectMigrationProfile(sqlitePath) {
  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  try {
    const retained = {};
    for (const table of ['agents', 'sessions', 'messages', 'approval_requests', 'secret_refs']) {
      retained[table] = sqlite.prepare(`SELECT * FROM ${table} WHERE id LIKE 'retained-%'`).all();
    }
    return {
      retained,
      journal: sqlite.prepare('SELECT * FROM __drizzle_migrations ORDER BY rowid').all(),
      schema: sqlite
        .prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name')
        .all(),
      tables: sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all()
        .map((row) => row.name),
      integrity: sqlite.pragma('integrity_check', { simple: true }),
      foreignKeyViolations: sqlite.pragma('foreign_key_check').length,
    };
  } finally {
    sqlite.close();
  }
}
