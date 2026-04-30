import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { backupRuntimeConfig, restoreRuntimeConfig } from './runtime-config-backup.mjs';

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

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-runtime-config-test-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function createRuntimeDb(dbPath) {
  runSqlite(
    dbPath,
    `
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
  secret_ref_id text REFERENCES secret_refs(id) ON DELETE SET NULL,
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

CREATE TABLE agents (
  id text PRIMARY KEY,
  slug text NOT NULL DEFAULT '',
  name text NOT NULL,
  model_config_id text REFERENCES model_configs(id) ON DELETE SET NULL
);

CREATE TABLE agent_mcp_servers (
  agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mcp_server_id text NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, mcp_server_id)
);
`,
  );
}

test('backup and restore preserve encrypted model config and MCP assignments', async () =>
  withTempDir(async (dir) => {
    const sourceDb = join(dir, 'source.sqlite');
    const targetDb = join(dir, 'target.sqlite');
    const backupDb = join(dir, 'backup', 'runtime-config.sqlite');

    createRuntimeDb(sourceDb);
    runSqlite(
      sourceDb,
      `
INSERT INTO secret_refs VALUES ('secret-1', 'OpenAI', 'ciphertext', 'iv', 'tag', 1, 'aes-256-gcm');
INSERT INTO model_configs VALUES ('model-1', 'Default OpenAI', 'openai', 'gpt-test', 'secret-1', 1000, 2000);
INSERT INTO mcp_servers VALUES ('mcp-1', 'playwright', 'Playwright', 'stdio', 'npx', '["-y","@playwright/mcp"]', NULL, '{"enabled":true}');
INSERT INTO agents VALUES ('agent-1', 'default-agent', 'Personal assistant', 'model-1');
INSERT INTO agent_mcp_servers VALUES ('agent-1', 'mcp-1');
`,
    );

    const backupSummary = backupRuntimeConfig({ dbPath: sourceDb, backupPath: backupDb });
    assert.equal(existsSync(backupDb), true);
    assert.deepEqual(backupSummary, {
      modelConfigs: 1,
      secretRefs: 1,
      mcpServers: 1,
      agentMcpAssignments: 1,
      agentModelAssignments: 1,
    });

    createRuntimeDb(targetDb);
    runSqlite(
      targetDb,
      "INSERT INTO agents VALUES ('agent-1', 'default-agent', 'Personal assistant', NULL);",
    );

    const restoreSummary = restoreRuntimeConfig({ dbPath: targetDb, backupPath: backupDb });
    assert.equal(restoreSummary.modelConfigs, 1);

    assert.equal(
      runSqlite(targetDb, 'SELECT model_config_id FROM agents WHERE id = "agent-1";'),
      'model-1',
    );
    assert.equal(
      runSqlite(targetDb, 'SELECT ciphertext_b64 FROM secret_refs WHERE id = "secret-1";'),
      'ciphertext',
    );
    assert.equal(
      runSqlite(targetDb, 'SELECT args_json FROM mcp_servers WHERE id = "mcp-1";'),
      '["-y","@playwright/mcp"]',
    );
    assert.equal(runSqlite(targetDb, 'SELECT count(*) FROM agent_mcp_servers;'), '1');
  }));

test('restore tolerates an existing MCP slug with a different id', async () =>
  withTempDir(async (dir) => {
    const sourceDb = join(dir, 'source.sqlite');
    const targetDb = join(dir, 'target.sqlite');
    const backupDb = join(dir, 'backup', 'runtime-config.sqlite');

    createRuntimeDb(sourceDb);
    runSqlite(
      sourceDb,
      `
INSERT INTO mcp_servers VALUES ('backup-mcp', 'same-slug', 'Backup MCP', 'stdio', 'npx', '[]', NULL, NULL);
INSERT INTO agents VALUES ('agent-1', 'default-agent', 'Personal assistant', NULL);
INSERT INTO agent_mcp_servers VALUES ('agent-1', 'backup-mcp');
`,
    );
    backupRuntimeConfig({ dbPath: sourceDb, backupPath: backupDb });

    createRuntimeDb(targetDb);
    runSqlite(
      targetDb,
      `
INSERT INTO agents VALUES ('agent-1', 'default-agent', 'Personal assistant', NULL);
INSERT INTO mcp_servers VALUES ('target-mcp', 'same-slug', 'Existing MCP', 'stdio', 'node', '[]', NULL, NULL);
`,
    );

    restoreRuntimeConfig({ dbPath: targetDb, backupPath: backupDb });

    assert.equal(
      runSqlite(targetDb, 'SELECT count(*) FROM mcp_servers WHERE slug = "same-slug";'),
      '1',
    );
    assert.equal(
      runSqlite(targetDb, 'SELECT id FROM mcp_servers WHERE slug = "same-slug";'),
      'target-mcp',
    );
    assert.equal(runSqlite(targetDb, 'SELECT count(*) FROM agent_mcp_servers;'), '0');
  }));
