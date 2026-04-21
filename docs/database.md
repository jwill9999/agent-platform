# Database

## Overview

Agent Platform uses **SQLite** via **Drizzle ORM** with **better-sqlite3**. The database package lives at `packages/db`.

**Expansion path:** PostgreSQL is the documented next step for multi-user/production deployments.

## Schema

Source of truth: `packages/db/src/schema.ts`

### Core Tables

#### `agents` — Agent definitions

| Column                  | Type    | Notes                                               |
| ----------------------- | ------- | --------------------------------------------------- |
| `id`                    | text PK | UUID, auto-generated                                |
| `slug`                  | text    | Unique index, human-readable                        |
| `name`                  | text    | Required                                            |
| `system_prompt`         | text    | Default: `'You are a helpful assistant.'`           |
| `description`           | text    | Optional                                            |
| `execution_limits_json` | text    | JSON — `ExecutionLimitsSchema` (7 fields, required) |
| `model_override_json`   | text    | JSON — `{ provider, model }` (optional)             |
| `plugin_allowlist_json` | text    | JSON array of plugin IDs (optional)                 |
| `plugin_denylist_json`  | text    | JSON array of plugin IDs (optional)                 |
| `context_window_json`   | text    | JSON — `{ maxInputTokens, strategy }` (optional)    |
| `model_config_id`       | text FK | → `model_configs.id`, SET NULL on delete (optional) |
| `created_at_ms`         | integer | Unix epoch ms                                       |
| `updated_at_ms`         | integer | Unix epoch ms                                       |

#### `skills` — Skill definitions

| `goal` | text | Required |
| `constraints_json` | text | JSON array (required) |
| `tool_ids_json` | text | JSON array of tool IDs |
| `output_schema_json` | text | Optional JSON Schema for output |

#### `tools` — Tool definitions

| Column              | Type    | Notes                                                              |
| ------------------- | ------- | ------------------------------------------------------------------ |
| `id`                | text PK | UUID                                                               |
| `slug`              | text    | Unique index                                                       |
| `name`              | text    | Required                                                           |
| `description`       | text    | Optional                                                           |
| `config_json`       | text    | Non-secret tool configuration (JSON, optional)                     |
| `risk_tier`         | text    | `zero` / `low` / `medium` / `high` / `critical` (default `medium`) |
| `requires_approval` | integer | Boolean — HITL approval required (default `0`)                     |

#### `mcp_servers` — MCP server configurations

| Column          | Type    | Notes                                 |
| --------------- | ------- | ------------------------------------- |
| `id`            | text PK | UUID                                  |
| `slug`          | text    | Unique index                          |
| `name`          | text    | Required                              |
| `transport`     | text    | `stdio` / `sse` / `streamable-http`   |
| `command`       | text    | Stdio command (optional)              |
| `args_json`     | text    | Stdio args JSON array (optional)      |
| `url`           | text    | HTTP endpoint URL (optional)          |
| `metadata_json` | text    | Additional server metadata (optional) |

#### `sessions` — Chat sessions

| Column          | Type    | Notes                         |
| --------------- | ------- | ----------------------------- |
| `id`            | text PK | UUID                          |
| `agent_id`      | text FK | → `agents.id`, cascade delete |
| `created_at_ms` | integer | Unix epoch ms                 |
| `updated_at_ms` | integer | Unix epoch ms                 |

#### `messages` — Conversation messages

| Column          | Type    | Notes                                       |
| --------------- | ------- | ------------------------------------------- |
| `id`            | text PK | UUID                                        |
| `session_id`    | text FK | → `sessions.id`, cascade delete             |
| `role`          | text    | `user` / `assistant` / `system` / `tool`    |
| `content`       | text    | Required                                    |
| `tool_call_id`  | text    | Links tool results to their call (optional) |
| `created_at_ms` | integer | Unix epoch ms                               |

#### `settings` — Key-value platform settings

| Column          | Type    | Notes                                        |
| --------------- | ------- | -------------------------------------------- |
| `key`           | text PK | Setting key (e.g. rate limits, cost budgets) |
| `value`         | text    | Required                                     |
| `updated_at_ms` | integer | Unix epoch ms                                |

### Junction Tables (Agent Allowlists)

| Table               | Relationship       | PK                            | Cascade                    |
| ------------------- | ------------------ | ----------------------------- | -------------------------- |
| `agent_skills`      | agent ↔ skill      | (`agent_id`, `skill_id`)      | Delete cascade on both FKs |
| `agent_tools`       | agent ↔ tool       | (`agent_id`, `tool_id`)       | Delete cascade on both FKs |
| `agent_mcp_servers` | agent ↔ mcp_server | (`agent_id`, `mcp_server_id`) | Delete cascade on both FKs |

### Supporting Tables

#### `plans` — Stored execution plans

| Column         | Type    | Notes                               |
| -------------- | ------- | ----------------------------------- |
| `id`           | text PK | UUID                                |
| `session_id`   | text FK | → `sessions.id`, SET NULL on delete |
| `payload_json` | text    | Full plan payload (JSON, required)  |

#### `chat_metadata` — Session UI metadata

| Column          | Type    | Notes                                   |
| --------------- | ------- | --------------------------------------- |
| `id`            | text PK | UUID                                    |
| `session_id`    | text FK | → `sessions.id`, cascade delete, unique |
| `title`         | text    | Chat title (optional)                   |
| `metadata_json` | text    | Additional UI metadata (optional)       |

#### `model_configs` — Saved LLM provider configurations

| Column          | Type    | Notes                                                      |
| --------------- | ------- | ---------------------------------------------------------- |
| `id`            | text PK | UUID, auto-generated                                       |
| `name`          | text    | Display name (required)                                    |
| `provider`      | text    | LLM provider (e.g. `openai`, `anthropic`)                  |
| `model`         | text    | Model identifier (e.g. `gpt-4o`)                           |
| `secret_ref_id` | text FK | → `secret_refs.id`, holds the encrypted API key (optional) |
| `created_at_ms` | integer | Unix epoch ms                                              |
| `updated_at_ms` | integer | Unix epoch ms                                              |

> **API key** is never stored in plaintext. When `apiKey` is provided on create/update, it is encrypted with AES-256-GCM and stored in `secret_refs`. The `hasApiKey` flag in API responses indicates whether a key is stored.

#### `secret_refs` — Encrypted secret references

| Column           | Type    | Notes                          |
| ---------------- | ------- | ------------------------------ |
| `id`             | text PK | UUID                           |
| `label`          | text    | Human-readable label           |
| `ciphertext_b64` | text    | Base64-encoded encrypted value |
| `iv_b64`         | text    | Initialization vector          |
| `auth_tag_b64`   | text    | Authentication tag             |
| `key_version`    | integer | Key rotation version           |
| `algorithm`      | text    | e.g. `aes-256-gcm-v1`          |

#### `plugin_catalog_refs` — Plugin registry entries

| Column       | Type    | Notes                             |
| ------------ | ------- | --------------------------------- |
| `id`         | text PK | UUID                              |
| `plugin_id`  | text    | Plugin identifier (required)      |
| `version`    | text    | Semver (required)                 |
| `source_uri` | text    | Plugin source location (required) |
| `checksum`   | text    | Integrity hash (optional)         |

#### `tool_executions` — Tool execution audit log

| Column            | Type    | Notes                                                  |
| ----------------- | ------- | ------------------------------------------------------ |
| `id`              | text PK | UUID                                                   |
| `tool_name`       | text    | Tool identifier (required)                             |
| `agent_id`        | text    | Agent that invoked the tool                            |
| `session_id`      | text    | Session context                                        |
| `args_json`       | text    | Tool invocation arguments (JSON, required)             |
| `result_json`     | text    | Tool result (JSON, optional — filled on complete)      |
| `risk_tier`       | text    | Risk tier at time of execution                         |
| `status`          | text    | `pending` / `completed` / `failed` (default `pending`) |
| `started_at_ms`   | integer | Execution start time                                   |
| `completed_at_ms` | integer | Execution end time (optional)                          |
| `duration_ms`     | integer | Computed duration (optional)                           |

## Entity Relationships

```
agents ──< agent_skills >── skills
agents ──< agent_tools >── tools
agents ──< agent_mcp_servers >── mcp_servers
agents ──< sessions ──< messages
sessions ──< plans
sessions ── chat_metadata (1:1)
agents >── model_configs ──< secret_refs (model_config_id FK; SET NULL on delete)
tool_executions (references agent_id, session_id — no FK constraints)
```

All foreign keys use **cascade delete** — deleting an agent removes its sessions, junction entries, etc. The `tool_executions` table is a standalone audit log without FK constraints for performance.

## IDs and Slugs

- **IDs** are UUIDs, auto-generated on creation
- **Slugs** are human-readable, derived from entity names (lowercase, hyphens)
- Slugs have unique indexes — no duplicates allowed
- Entities can be looked up by either ID or slug

## Migrations

Migrations live in `packages/db/drizzle/` and are numbered sequentially:

| File                             | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| `0000_initial.sql`               | Core schema (agents, skills, tools, mcp_servers, sessions, plans) |
| `0001_secret_crypto.sql`         | AES-256-GCM columns on secret_refs                                |
| `0002_keen_owl.sql`              | Agent system_prompt and description                               |
| `0003_add_messages.sql`          | Messages table                                                    |
| `0004_add_settings.sql`          | Settings table                                                    |
| `0005_add_slugs.sql`             | Slug columns + unique indexes on all entities                     |
| `0006_add_context_window.sql`    | context_window_json on agents                                     |
| `0007_add_risk_tier.sql`         | risk_tier and requires_approval on tools                          |
| `0008_add_tool_executions.sql`   | tool_executions audit log table                                   |
| `0009_add_chat_metadata.sql`     | chat_metadata table for session titles                            |
| `0010_extend_session_schema.sql` | messages table, updated sessions columns                          |
| `0011_add_model_configs.sql`     | model_configs table + model_config_id FK on agents                |

### Adding a New Migration

1. Update the Drizzle schema in `packages/db/src/schema.ts`
2. Generate the migration: `npx drizzle-kit generate`
3. The migration SQL appears in `packages/db/drizzle/`
4. Migrations run automatically on database open

## Secret Storage

Secrets are stored with **AES-256-GCM** encryption in the `secret_refs` table.

**Requirements:**

- `SECRETS_MASTER_KEY` env var — base64-encoded 32-byte key
- Key rotation supported via `key_version` field
- Secrets are **never** stored in plaintext
- Never log master key, IV, ciphertext, or decrypted values

## Seeding

```bash
# Build first (seed uses compiled output)
pnpm build

# Seed the database (idempotent)
SQLITE_PATH=./data/dev.sqlite pnpm seed
```

The seed creates a **Personal assistant** (primary agent), a **Coding** specialist, and demo registry rows. It is idempotent — safe to run multiple times.

## Typed Error Handling

The DB package exports typed error classes for constraint violations:

| Error Class                | Trigger                                                    | HTTP Status |
| -------------------------- | ---------------------------------------------------------- | ----------- |
| `ForeignKeyViolationError` | FK constraint (e.g., session references nonexistent agent) | 404         |
| `UniqueConstraintError`    | Unique/PK constraint (e.g., duplicate slug)                | 409         |

These are caught and mapped centrally by the API error middleware.
