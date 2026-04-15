# Platform Capability Assessment

**Date:** 2026-04-15  
**Reviewer:** ReviewBot (AI Harness & Runtime Specialist)  
**Scope:** Full platform architecture — contracts, DB schema, factory, harness, plugin SDK, model-router, MCP adapter, seed data

---

## 1. Default Generalist Agent

**Status: ✅ Implemented**

The seed in `packages/db/src/seed/runSeed.ts` creates a `'default'` agent with:

- **Base system prompt:** `"You are a helpful assistant. Use available tools to help the user accomplish their tasks. Be concise and accurate."`
- **Execution limits:** `maxSteps: 32`, `maxParallelTasks: 4`, `timeoutMs: 600_000`, `maxTokens: 128_000`
- **Skill:** `'demo-skill'` linked via `agent_skills` join table
- **MCP servers:** None assigned by default (empty allowlist — addable via API)
- **Model override:** `null` → falls back to env defaults (`DEFAULT_MODEL_PROVIDER` / `DEFAULT_MODEL`)
- **Plugin allowlist:** `null` → all plugins allowed

Seeding is **idempotent** — runs on every startup, skips existing rows.

---

## 2. Specialised Agents with Independent Scoped Configs

**Status: ✅ Implemented**

Full CRUD on `POST/GET/PUT/DELETE /v1/agents`. The `AgentSchema` in `packages/contracts/src/agent.ts` defines per-agent scoping:

| Field                                | Scoping                             |
| ------------------------------------ | ----------------------------------- |
| `systemPrompt`                       | Role-specific prompt per agent      |
| `allowedSkillIds[]`                  | Independent skill set               |
| `allowedToolIds[]`                   | Independent tool set                |
| `allowedMcpServerIds[]`              | Independent MCP integrations        |
| `modelOverride`                      | Per-agent provider + model          |
| `pluginAllowlist` / `pluginDenylist` | Per-agent plugin filtering          |
| `executionLimits`                    | Per-agent maxSteps, timeout, tokens |

The DB uses **join tables** (`agent_skills`, `agent_tools`, `agent_mcp_servers` in `packages/db/src/schema.ts`) for the many-to-many relationships. Updates are **transactional** — `replaceAgent()` in `packages/db/src/repositories/registry.ts` deletes and reinserts all allowlist rows atomically.

A working example exists: the E2E specialist agent in `packages/db/src/seed/e2eSeed.ts` with a custom prompt, scoped MCP server (`e2e-fs`), and constrained skill/tool set.

---

## 3. Globally Defined Skills & MCP Servers, Selectively Assigned

**Status: ✅ Implemented**

Skills, tools, and MCP servers are **first-class global resources** with their own CRUD routes:

| Resource    | Routes                                                       | Schema Table  |
| ----------- | ------------------------------------------------------------ | ------------- |
| Skills      | `GET/POST /v1/skills`, `GET/DELETE /v1/skills/:id`           | `skills`      |
| Tools       | `GET/POST /v1/tools`, `GET/DELETE /v1/tools/:id`             | `tools`       |
| MCP Servers | `GET/POST /v1/mcp-servers`, `GET/DELETE /v1/mcp-servers/:id` | `mcp_servers` |

These exist independently of any agent. Assignment is via the join tables — an agent's `allowedSkillIds`, `allowedToolIds`, and `allowedMcpServerIds` act as scoped references into the global pool. Central management (create/update/delete a skill once) propagates to all agents that reference it.

---

## 4. Model Provider Assignment with Secure Credentials

**Status: ✅ Implemented**

**Per-agent model selection** via `modelOverride` (provider + model). Resolution chain in `packages/harness/src/factory.ts`:

```
Session override → Agent modelOverride → ENV defaults → System fallback (openai/gpt-4o)
```

**Secure credential storage:**

- `secret_refs` table — **no plaintext ever stored**
- **AES-256-GCM** envelope encryption in `packages/db/src/crypto/envelope.ts`: unique 12-byte IV per encryption, 16-byte auth tag, `SECRETS_MASTER_KEY` (base64-encoded 32-byte key)
- `keyVersion` field enables **key rotation** without re-encrypting all rows at once
- API key resolution is gated — legacy env fallback requires explicit opt-in

**Gap (planned):** Per-agent API key assignment (linking a `secret_ref` to a specific agent's model config) is not yet wired end-to-end. The encryption infrastructure exists, but the `modelOverride` schema currently accepts `provider` + `model` only — not an `apiKeySecretId` reference. This is tracked as part of the runtime loop work.

---

## 5. Default Capabilities + Plugin Extensibility

**Status: ✅ Implemented (foundation) / 🟡 Expanding**

**Plugin SDK** (`packages/plugin-sdk/src/hooks.ts`) provides 6 lifecycle hooks:

| Hook             | Phase                       |
| ---------------- | --------------------------- |
| `onSessionStart` | Session begins              |
| `onTaskStart`    | Before task execution       |
| `onPromptBuild`  | Prompt assembly (read-only) |
| `onToolCall`     | Tool invocation (observer)  |
| `onTaskEnd`      | Task completion             |
| `onError`        | Error handling              |

**Per-agent filtering** via `packages/plugin-session/src/resolve.ts`: denylist wins over allowlist; `null` allowlist = all plugins enabled.

**Shipped plugins:**

| Plugin                 | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `plugin-observability` | Structured logging of all lifecycle events (redacts tool args by default) |
| `plugin-session`       | In-memory session state management                                        |

**Extensibility path:**

| Layer       | Current                     | Planned                                                 |
| ----------- | --------------------------- | ------------------------------------------------------- |
| **Plugins** | SDK + 2 first-party plugins | User-registered plugins (global + per-agent)            |
| **Skills**  | JSON-defined, tool-scoped   | Richer skill composition (task `6d5` — skill executor)  |
| **MCP**     | Stdio + SSE transports      | Streamable HTTP (`pe4`), multi-provider routing (`bto`) |
| **Planner** | JSON structured output      | Graph mode selector (`40r`), HITL pause/resume (`fcm`)  |

---

## Summary Matrix

| Requirement                            | Status        | Key Gaps                                                                     |
| -------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| Default generalist agent               | ✅ Done       | MCP servers not pre-assigned (by design — user adds)                         |
| Specialised agents via API             | ✅ Done       | Frontend creation paused (see `frontend-ui-phases.md`)                       |
| Global resources, selective assignment | ✅ Done       | No bulk assign/unassign API yet                                              |
| Model provider + secure credentials    | ✅ Foundation | Per-agent `apiKeySecretId` not yet wired to `modelOverride`                  |
| Plugin extensibility                   | ✅ Foundation | Only 2 first-party plugins; user plugin registration not yet exposed via API |

---

## Key File References

| Area                                               | File                                                 |
| -------------------------------------------------- | ---------------------------------------------------- |
| Agent schema                                       | `packages/contracts/src/agent.ts`                    |
| DB schema (tables + joins)                         | `packages/db/src/schema.ts`                          |
| Agent repository (CRUD + transactional allowlists) | `packages/db/src/repositories/registry.ts`           |
| DB mappers                                         | `packages/db/src/mappers.ts`                         |
| Factory (model resolution, plugin wiring)          | `packages/harness/src/factory.ts`                    |
| Secret encryption                                  | `packages/db/src/crypto/envelope.ts`                 |
| Plugin SDK hooks                                   | `packages/plugin-sdk/src/hooks.ts`                   |
| Plugin resolution (allow/deny)                     | `packages/plugin-session/src/resolve.ts`             |
| Observability plugin                               | `packages/plugin-observability/src/observability.ts` |
| Default agent seed                                 | `packages/db/src/seed/runSeed.ts`                    |
| E2E specialist seed                                | `packages/db/src/seed/e2eSeed.ts`                    |
| API routes                                         | `apps/api/src/infrastructure/http/v1/v1Router.ts`    |
| Model router                                       | `packages/model-router/src/resolveOpenAiApiKey.ts`   |

---

_The architecture fully supports all listed requirements. Remaining work is wiring (secret_refs → agent model configs, plugin registration API) and expansion (more skills, transport upgrades, HITL) — all tracked in beads._
