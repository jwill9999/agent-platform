# Database

## Overview

Agent Platform uses **SQLite** via **Drizzle ORM** with **better-sqlite3**. The database package lives at `packages/db`.

**Expansion path:** PostgreSQL is the documented next step for multi-user/production deployments.

## Schema

### Core Tables

| Table         | Purpose            | Key Fields                                                                                            |
| ------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `agents`      | Agent definitions  | `id` (UUID), `slug` (unique), `name`, `system_prompt`, `execution_limits_json`, `model_override_json` |
| `skills`      | Skill definitions  | `id` (UUID), `slug` (unique), `name`, `goal`, `constraints_json`, `tool_ids_json`                     |
| `tools`       | Tool definitions   | `id` (UUID), `slug` (unique), `name`, `description`, `config_json`                                    |
| `mcp_servers` | MCP server configs | `id` (UUID), `slug` (unique), `name`, `transport`, `command`, `args_json`, `url`                      |
| `sessions`    | Chat sessions      | `id` (UUID), `agent_id` (FK → agents), timestamps                                                     |
| `messages`    | Chat messages      | `id` (UUID), `session_id` (FK → sessions), `role`, `content`, timestamps                              |
| `settings`    | Key-value settings | `key` (PK), `value`, timestamps                                                                       |

### Junction Tables (Agent Allowlists)

| Table               | Relationship       | Cascade                    |
| ------------------- | ------------------ | -------------------------- |
| `agent_skills`      | agent ↔ skill      | Delete cascade on both FKs |
| `agent_tools`       | agent ↔ tool       | Delete cascade on both FKs |
| `agent_mcp_servers` | agent ↔ mcp_server | Delete cascade on both FKs |

### Supporting Tables

| Table                 | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `plans`               | Stored plans (FK → sessions, SET NULL on delete) |
| `chat_metadata`       | Session metadata (unique session_id)             |
| `secret_refs`         | Encrypted secret references                      |
| `plugin_catalog_refs` | Plugin registry entries                          |

## Entity Relationships

```
agents ──< agent_skills >── skills
agents ──< agent_tools >── tools
agents ──< agent_mcp_servers >── mcp_servers
agents ──< sessions ──< messages
sessions ──< plans
sessions ── chat_metadata (1:1)
```

All foreign keys use **cascade delete** — deleting an agent removes its sessions, junction entries, etc.

## IDs and Slugs

- **IDs** are UUIDs, auto-generated on creation
- **Slugs** are human-readable, derived from entity names (lowercase, hyphens)
- Slugs have unique indexes — no duplicates allowed
- Entities can be looked up by either ID or slug

## Migrations

Migrations live in `packages/db/drizzle/` and are numbered sequentially:

| File                     | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `0000_initial.sql`       | Core schema (agents, skills, tools, mcp_servers, sessions, plans) |
| `0001_secret_crypto.sql` | AES-256-GCM columns on secret_refs                                |
| `0002_keen_owl.sql`      | Agent system_prompt and description                               |
| `0003_add_messages.sql`  | Messages table                                                    |
| `0004_add_settings.sql`  | Settings table                                                    |
| `0005_add_slugs.sql`     | Slug columns + unique indexes on all entities                     |

### Adding a New Migration

1. Update the Drizzle schema in `packages/db/src/schema.ts`
2. Generate the migration: `npx drizzle-kit generate`
3. The migration SQL appears in `packages/db/drizzle/`
4. Migrations run automatically on database open

## Secret Storage

Secrets are stored with **AES-256-GCM** encryption:

| Column           | Purpose                         |
| ---------------- | ------------------------------- |
| `ciphertext_b64` | Base64-encoded encrypted value  |
| `iv_b64`         | Initialization vector           |
| `auth_tag_b64`   | Authentication tag              |
| `key_version`    | Key rotation version            |
| `algorithm`      | Encryption algorithm identifier |

**Requirements:**

- `SECRETS_MASTER_KEY` env var — base64-encoded 32-byte key
- Key rotation supported via `key_version` field
- Secrets are **never** stored in plaintext

## Seeding

```bash
# Build first (seed uses compiled output)
pnpm build

# Seed the database (idempotent)
SQLITE_PATH=./data/dev.sqlite pnpm seed
```

The seed creates a default agent with demo skills and tools. It is idempotent — safe to run multiple times.

## Typed Error Handling

The DB package exports typed error classes for constraint violations:

| Error Class                | Trigger                                                    | HTTP Status |
| -------------------------- | ---------------------------------------------------------- | ----------- |
| `ForeignKeyViolationError` | FK constraint (e.g., session references nonexistent agent) | 404         |
| `UniqueConstraintError`    | Unique/PK constraint (e.g., duplicate slug)                | 409         |

These are caught and mapped centrally by the API error middleware.
