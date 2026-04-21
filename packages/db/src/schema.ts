import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Secret registry: label + optional **ciphertext-only** material (AES-256-GCM envelope).
 * Plaintext must never be persisted.
 */
export const secretRefs = sqliteTable('secret_refs', {
  id: text('id').primaryKey(),
  label: text('label'),
  ciphertextB64: text('ciphertext_b64'),
  ivB64: text('iv_b64'),
  authTagB64: text('auth_tag_b64'),
  keyVersion: integer('key_version', { mode: 'number' }),
  algorithm: text('algorithm'),
});

/** Normalized skill row; arrays stored as JSON (matches @agent-platform/contracts Skill). */
export const skills = sqliteTable(
  'skills',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().default(''),
    slug: text('slug').notNull().default(''),
    /** Short one-liner for system-prompt stubs (lazy loading). */
    description: text('description'),
    /** When-to-use hint for lazy loading stubs. */
    hint: text('hint'),
    goal: text('goal').notNull(),
    constraintsJson: text('constraints_json').notNull(),
    toolIdsJson: text('tool_ids_json').notNull(),
    outputSchemaJson: text('output_schema_json'),
  },
  (t) => ({
    slugIdx: uniqueIndex('skills_slug_idx').on(t.slug),
  }),
);

export const tools = sqliteTable(
  'tools',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().default(''),
    name: text('name').notNull(),
    description: text('description'),
    /** Non-secret tool configuration (JSON). */
    configJson: text('config_json'),
    /** Risk tier: zero, low, medium, high, critical (default medium). */
    riskTier: text('risk_tier').notNull().default('medium'),
    /** Whether this tool requires human approval before execution. */
    requiresApproval: integer('requires_approval', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({
    slugIdx: uniqueIndex('tools_slug_idx').on(t.slug),
  }),
);

/** MCP server registry; no secret values — only non-sensitive metadata (JSON). */
export const mcpServers = sqliteTable(
  'mcp_servers',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().default(''),
    name: text('name').notNull(),
    transport: text('transport').notNull(),
    command: text('command'),
    argsJson: text('args_json'),
    url: text('url'),
    metadataJson: text('metadata_json'),
  },
  (t) => ({
    slugIdx: uniqueIndex('mcp_servers_slug_idx').on(t.slug),
  }),
);

/**
 * Saved model configurations with securely stored API keys.
 * The API key itself lives in `secret_refs` — only the FK is here.
 */
export const modelConfigs = sqliteTable('model_configs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  /** FK to secret_refs; null when no key is stored (e.g. Ollama). */
  secretRefId: text('secret_ref_id').references(() => secretRefs.id, { onDelete: 'set null' }),
  createdAtMs: integer('created_at_ms', { mode: 'number' }).notNull(),
  updatedAtMs: integer('updated_at_ms', { mode: 'number' }).notNull(),
});

/** Persisted agent profile (matches Agent contract shape via JSON + join tables). */
export const agents = sqliteTable(
  'agents',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().default(''),
    name: text('name').notNull(),
    systemPrompt: text('system_prompt').notNull().default('You are a helpful assistant.'),
    description: text('description'),
    executionLimitsJson: text('execution_limits_json').notNull(),
    modelOverrideJson: text('model_override_json'),
    /** FK to model_configs; when set, its stored key takes precedence over env-var resolution. */
    modelConfigId: text('model_config_id').references(() => modelConfigs.id, {
      onDelete: 'set null',
    }),
    pluginAllowlistJson: text('plugin_allowlist_json'),
    pluginDenylistJson: text('plugin_denylist_json'),
    contextWindowJson: text('context_window_json'),
    createdAtMs: integer('created_at_ms', { mode: 'number' }).notNull(),
    updatedAtMs: integer('updated_at_ms', { mode: 'number' }).notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('agents_slug_idx').on(t.slug),
  }),
);

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
  title: text('title'),
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

/** Conversation messages linked to a session. */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user | assistant | system | tool
  content: text('content').notNull(),
  toolCallId: text('tool_call_id'),
  createdAtMs: integer('created_at_ms', { mode: 'number' }).notNull(),
});

/** Key-value platform settings (rate limits, cost budgets, etc.). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAtMs: integer('updated_at_ms', { mode: 'number' }).notNull(),
});

/** Audit log for tool executions (low+ risk tools). */
export const toolExecutions = sqliteTable('tool_executions', {
  id: text('id').primaryKey(),
  toolName: text('tool_name').notNull(),
  agentId: text('agent_id').notNull(),
  sessionId: text('session_id').notNull(),
  argsJson: text('args_json').notNull(),
  resultJson: text('result_json'),
  riskTier: text('risk_tier'),
  status: text('status').notNull().default('pending'),
  startedAtMs: integer('started_at_ms', { mode: 'number' }).notNull(),
  completedAtMs: integer('completed_at_ms', { mode: 'number' }),
  durationMs: integer('duration_ms', { mode: 'number' }),
});
