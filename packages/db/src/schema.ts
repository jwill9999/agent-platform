import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Normalized skill row; arrays stored as JSON (matches @agent-platform/contracts Skill). */
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  goal: text('goal').notNull(),
  constraintsJson: text('constraints_json').notNull(),
  toolIdsJson: text('tool_ids_json').notNull(),
  outputSchemaJson: text('output_schema_json'),
});

export const tools = sqliteTable('tools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  /** Non-secret tool configuration (JSON). */
  configJson: text('config_json'),
});

/** MCP server registry; no secret values — only non-sensitive metadata (JSON). */
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  transport: text('transport').notNull(),
  command: text('command'),
  argsJson: text('args_json'),
  url: text('url'),
  metadataJson: text('metadata_json'),
});

/** Persisted agent profile (matches Agent contract shape via JSON + join tables). */
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  executionLimitsJson: text('execution_limits_json').notNull(),
  modelOverrideJson: text('model_override_json'),
  pluginAllowlistJson: text('plugin_allowlist_json'),
  pluginDenylistJson: text('plugin_denylist_json'),
  createdAtMs: integer('created_at_ms', { mode: 'number' }).notNull(),
  updatedAtMs: integer('updated_at_ms', { mode: 'number' }).notNull(),
});

export const agentSkills = sqliteTable(
  'agent_skills',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agentId, t.skillId] }),
  }),
);

export const agentTools = sqliteTable(
  'agent_tools',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    toolId: text('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agentId, t.toolId] }),
  }),
);

export const agentMcpServers = sqliteTable(
  'agent_mcp_servers',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    mcpServerId: text('mcp_server_id')
      .notNull()
      .references(() => mcpServers.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agentId, t.mcpServerId] }),
  }),
);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  createdAtMs: integer('created_at_ms', { mode: 'number' }).notNull(),
  updatedAtMs: integer('updated_at_ms', { mode: 'number' }).notNull(),
});

/** Chat / session UI metadata (title, extra JSON). */
export const chatMetadata = sqliteTable('chat_metadata', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' })
    .unique(),
  title: text('title'),
  metadataJson: text('metadata_json'),
});

/** Plan payload (Plan contract) keyed by id; optional session scope. */
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  payloadJson: text('payload_json').notNull(),
});

/** References into the plugin catalog (not full plugin binaries). */
export const pluginCatalogRefs = sqliteTable('plugin_catalog_refs', {
  id: text('id').primaryKey(),
  pluginId: text('plugin_id').notNull(),
  version: text('version').notNull(),
  sourceUri: text('source_uri').notNull(),
  checksum: text('checksum'),
});

/** Secret references only (id + label); ciphertext lands in j9x.2+. */
export const secretRefs = sqliteTable('secret_refs', {
  id: text('id').primaryKey(),
  label: text('label'),
});
