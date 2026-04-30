#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { resolveWorkspaceConfig } from './workspace-config.mjs';

export const DEFAULT_BACKUP_NAME = 'runtime-config.sqlite';
export const DEFAULT_DB_NAME = 'agent.sqlite';

const BACKUP_SCHEMA = `
CREATE TABLE secret_refs (
  id text PRIMARY KEY,
  label text,
  ciphertext_b64 text,
  iv_b64 text,
  auth_tag_b64 text,
  key_version integer,
  algorithm text
);

CREATE TABLE model_configs (
  id text PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  secret_ref_id text,
  created_at_ms integer NOT NULL,
  updated_at_ms integer NOT NULL
);

CREATE TABLE mcp_servers (
  id text PRIMARY KEY,
  slug text NOT NULL DEFAULT '',
  name text NOT NULL,
  transport text NOT NULL,
  command text,
  args_json text,
  url text,
  metadata_json text
);

CREATE TABLE agent_mcp_servers (
  agent_id text NOT NULL,
  mcp_server_id text NOT NULL,
  PRIMARY KEY (agent_id, mcp_server_id)
);

CREATE TABLE agent_model_config_assignments (
  agent_id text PRIMARY KEY,
  model_config_id text NOT NULL
);
`;

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runSqlite(dbPath, sql) {
  const result = spawnSync('sqlite3', ['-batch', dbPath], {
    input: sql,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `sqlite3 exited ${result.status}`).trim());
  }
  return result.stdout.trim();
}

function tableExists(dbPath, tableName) {
  const output = runSqlite(
    dbPath,
    `SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ${quoteSql(tableName)};`,
  );
  return output === '1';
}

function requireTables(dbPath, tableNames) {
  for (const tableName of tableNames) {
    if (!tableExists(dbPath, tableName)) {
      throw new Error(`Required table ${tableName} was not found in ${dbPath}`);
    }
  }
}

function countRows(dbPath, tableName) {
  const output = runSqlite(dbPath, `SELECT count(*) FROM ${tableName};`);
  return Number.parseInt(output || '0', 10);
}

function parseArgs(argv) {
  const args = {
    action: argv[0],
    dbPath: undefined,
    backupPath: undefined,
    help: argv.includes('--help') || argv.includes('-h'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db') args.dbPath = argv[index + 1];
    if (arg === '--backup') args.backupPath = argv[index + 1];
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-config-backup.mjs <backup|restore> [--db path] [--backup path]

Backs up or restores local runtime configuration:
  - saved model configs
  - encrypted model API key secret_refs
  - agent model-config assignments
  - MCP server registry rows
  - agent MCP server assignments

Defaults:
  --db      $AGENT_DATA_HOST_PATH/${DEFAULT_DB_NAME}
  --backup $AGENT_PLATFORM_HOME/backups/${DEFAULT_BACKUP_NAME}`);
}

export function resolveRuntimeConfigPaths(env = process.env, options = {}) {
  const config = resolveWorkspaceConfig(env);
  return {
    dbPath: resolve(options.dbPath ?? join(config.dataHostPath, DEFAULT_DB_NAME)),
    backupPath: resolve(
      options.backupPath ?? join(config.platformHome, 'backups', DEFAULT_BACKUP_NAME),
    ),
  };
}

export function backupRuntimeConfig(paths) {
  const dbPath = resolve(paths.dbPath);
  const backupPath = resolve(paths.backupPath);
  if (!existsSync(dbPath)) {
    throw new Error(`Runtime database was not found: ${dbPath}`);
  }

  requireTables(dbPath, [
    'secret_refs',
    'model_configs',
    'mcp_servers',
    'agent_mcp_servers',
    'agents',
  ]);

  mkdirSync(dirname(backupPath), { recursive: true });
  const tempPath = `${backupPath}.tmp`;
  rmSync(tempPath, { force: true });

  runSqlite(
    tempPath,
    `
${BACKUP_SCHEMA}
ATTACH DATABASE ${quoteSql(dbPath)} AS src;

INSERT INTO secret_refs (id, label, ciphertext_b64, iv_b64, auth_tag_b64, key_version, algorithm)
SELECT sr.id, sr.label, sr.ciphertext_b64, sr.iv_b64, sr.auth_tag_b64, sr.key_version, sr.algorithm
FROM src.secret_refs sr
WHERE sr.id IN (
  SELECT secret_ref_id FROM src.model_configs WHERE secret_ref_id IS NOT NULL
);

INSERT INTO model_configs (id, name, provider, model, secret_ref_id, created_at_ms, updated_at_ms)
SELECT id, name, provider, model, secret_ref_id, created_at_ms, updated_at_ms
FROM src.model_configs;

INSERT INTO mcp_servers (id, slug, name, transport, command, args_json, url, metadata_json)
SELECT id, slug, name, transport, command, args_json, url, metadata_json
FROM src.mcp_servers;

INSERT INTO agent_mcp_servers (agent_id, mcp_server_id)
SELECT agent_id, mcp_server_id
FROM src.agent_mcp_servers;

INSERT INTO agent_model_config_assignments (agent_id, model_config_id)
SELECT id, model_config_id
FROM src.agents
WHERE model_config_id IS NOT NULL;

DETACH DATABASE src;
`,
  );

  rmSync(backupPath, { force: true });
  runSqlite(tempPath, 'PRAGMA integrity_check;');
  renameSync(tempPath, backupPath);

  return summarizeBackup(backupPath);
}

export function restoreRuntimeConfig(paths) {
  const dbPath = resolve(paths.dbPath);
  const backupPath = resolve(paths.backupPath);
  if (!existsSync(dbPath)) {
    throw new Error(`Runtime database was not found: ${dbPath}`);
  }
  if (!existsSync(backupPath)) {
    throw new Error(`Runtime config backup was not found: ${backupPath}`);
  }

  requireTables(dbPath, [
    'secret_refs',
    'model_configs',
    'mcp_servers',
    'agent_mcp_servers',
    'agents',
  ]);
  requireTables(backupPath, [
    'secret_refs',
    'model_configs',
    'mcp_servers',
    'agent_mcp_servers',
    'agent_model_config_assignments',
  ]);

  runSqlite(
    dbPath,
    `
PRAGMA foreign_keys = ON;
ATTACH DATABASE ${quoteSql(backupPath)} AS backup;
BEGIN;

INSERT OR IGNORE INTO secret_refs (
  id, label, ciphertext_b64, iv_b64, auth_tag_b64, key_version, algorithm
)
SELECT id, label, ciphertext_b64, iv_b64, auth_tag_b64, key_version, algorithm
FROM backup.secret_refs;

UPDATE secret_refs
SET
  label = (SELECT label FROM backup.secret_refs WHERE backup.secret_refs.id = secret_refs.id),
  ciphertext_b64 = (SELECT ciphertext_b64 FROM backup.secret_refs WHERE backup.secret_refs.id = secret_refs.id),
  iv_b64 = (SELECT iv_b64 FROM backup.secret_refs WHERE backup.secret_refs.id = secret_refs.id),
  auth_tag_b64 = (SELECT auth_tag_b64 FROM backup.secret_refs WHERE backup.secret_refs.id = secret_refs.id),
  key_version = (SELECT key_version FROM backup.secret_refs WHERE backup.secret_refs.id = secret_refs.id),
  algorithm = (SELECT algorithm FROM backup.secret_refs WHERE backup.secret_refs.id = secret_refs.id)
WHERE id IN (SELECT id FROM backup.secret_refs);

INSERT OR IGNORE INTO model_configs (
  id, name, provider, model, secret_ref_id, created_at_ms, updated_at_ms
)
SELECT id, name, provider, model, secret_ref_id, created_at_ms, updated_at_ms
FROM backup.model_configs;

UPDATE model_configs
SET
  name = (SELECT name FROM backup.model_configs WHERE backup.model_configs.id = model_configs.id),
  provider = (SELECT provider FROM backup.model_configs WHERE backup.model_configs.id = model_configs.id),
  model = (SELECT model FROM backup.model_configs WHERE backup.model_configs.id = model_configs.id),
  secret_ref_id = (SELECT secret_ref_id FROM backup.model_configs WHERE backup.model_configs.id = model_configs.id),
  created_at_ms = (SELECT created_at_ms FROM backup.model_configs WHERE backup.model_configs.id = model_configs.id),
  updated_at_ms = (SELECT updated_at_ms FROM backup.model_configs WHERE backup.model_configs.id = model_configs.id)
WHERE id IN (SELECT id FROM backup.model_configs);

INSERT OR IGNORE INTO mcp_servers (
  id, slug, name, transport, command, args_json, url, metadata_json
)
SELECT id, slug, name, transport, command, args_json, url, metadata_json
FROM backup.mcp_servers backup_mcp
WHERE NOT EXISTS (SELECT 1 FROM mcp_servers WHERE mcp_servers.id = backup_mcp.id)
  AND NOT EXISTS (SELECT 1 FROM mcp_servers WHERE mcp_servers.slug = backup_mcp.slug);

UPDATE mcp_servers
SET
  name = (SELECT name FROM backup.mcp_servers WHERE backup.mcp_servers.id = mcp_servers.id),
  transport = (SELECT transport FROM backup.mcp_servers WHERE backup.mcp_servers.id = mcp_servers.id),
  command = (SELECT command FROM backup.mcp_servers WHERE backup.mcp_servers.id = mcp_servers.id),
  args_json = (SELECT args_json FROM backup.mcp_servers WHERE backup.mcp_servers.id = mcp_servers.id),
  url = (SELECT url FROM backup.mcp_servers WHERE backup.mcp_servers.id = mcp_servers.id),
  metadata_json = (SELECT metadata_json FROM backup.mcp_servers WHERE backup.mcp_servers.id = mcp_servers.id)
WHERE id IN (SELECT id FROM backup.mcp_servers);

INSERT OR IGNORE INTO agent_mcp_servers (agent_id, mcp_server_id)
SELECT agent_id, mcp_server_id
FROM backup.agent_mcp_servers
WHERE agent_id IN (SELECT id FROM agents)
  AND mcp_server_id IN (SELECT id FROM mcp_servers);

UPDATE agents
SET model_config_id = (
  SELECT model_config_id
  FROM backup.agent_model_config_assignments assignment
  WHERE assignment.agent_id = agents.id
)
WHERE id IN (SELECT agent_id FROM backup.agent_model_config_assignments)
  AND (
    SELECT model_config_id
    FROM backup.agent_model_config_assignments assignment
    WHERE assignment.agent_id = agents.id
  ) IN (SELECT id FROM model_configs);

COMMIT;
DETACH DATABASE backup;
`,
  );

  return summarizeBackup(backupPath);
}

export function summarizeBackup(backupPath) {
  return {
    modelConfigs: countRows(backupPath, 'model_configs'),
    secretRefs: countRows(backupPath, 'secret_refs'),
    mcpServers: countRows(backupPath, 'mcp_servers'),
    agentMcpAssignments: countRows(backupPath, 'agent_mcp_servers'),
    agentModelAssignments: countRows(backupPath, 'agent_model_config_assignments'),
  };
}

export async function runRuntimeConfigBackup(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.help || !args.action) {
    printHelp();
    return args.help ? 0 : 1;
  }

  const paths = resolveRuntimeConfigPaths(env, {
    dbPath: args.dbPath,
    backupPath: args.backupPath,
  });

  if (args.action === 'backup') {
    const summary = await backupRuntimeConfig(paths);
    console.log(`Runtime config backup written: ${paths.backupPath}`);
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  if (args.action === 'restore') {
    const summary = restoreRuntimeConfig(paths);
    console.log(`Runtime config restored from: ${paths.backupPath}`);
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  console.error(`Unknown action: ${args.action}`);
  printHelp();
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRuntimeConfigBackup()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
