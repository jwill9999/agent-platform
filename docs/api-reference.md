# API Reference

## Overview

The API server (`apps/api`) exposes a REST JSON API on port 3000. All resource endpoints live under `/v1`. Requires `SQLITE_PATH` environment variable at process start.

**Interactive docs:** When running, Swagger UI is available at `/api-docs`.

## Authentication

Single-user MVP — no authentication required. A stub middleware exists for future expansion.

## Request Headers

| Header         | Required | Description                                                                               |
| -------------- | -------- | ----------------------------------------------------------------------------------------- |
| `Content-Type` | Yes      | `application/json` for all POST/PUT bodies                                                |
| `x-openai-key` | No       | OpenAI API key override (falls back to `AGENT_OPENAI_API_KEY` env, then `OPENAI_API_KEY`) |

## Rate Limiting

All `/v1` endpoints are rate-limited via a dynamic rate limiter (express-rate-limit). Defaults: 100 requests per 60 s window. Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` env vars, and at runtime through the Settings API.

## Health Check

| Method | Path      | Description                              |
| ------ | --------- | ---------------------------------------- |
| `GET`  | `/health` | Returns server health (no DB dependency) |

```json
{ "status": "ok", "version": "1.0.0" }
```

## Resource Endpoints (`/v1`)

All endpoints accept and return JSON. IDs are UUIDs (auto-generated on create). Each entity also has a unique `slug` field derived from its name.

### Endpoint Exposure

The Next.js BFF exposes two proxy layers to the browser:

- **`/api/chat`** — dedicated BFF route with its own Zod validation, timeout, and error handling; proxies to `POST /v1/chat`.
- **`/api/v1/[...path]`** — catch-all proxy that forwards any `/v1` request to the API verbatim.

| Endpoint                                   | Frontend | curl / API-only | Notes                                        |
| ------------------------------------------ | :------: | :-------------: | -------------------------------------------- |
| `POST /v1/chat`                            |    ✅    |       ✅        | Primary chat — via dedicated `/api/chat` BFF |
| `GET /v1/agents`                           |    ✅    |       ✅        | Agent dashboard, agent editor, home page     |
| `POST /v1/agents`                          |    ✅    |       ✅        | Agent editor, duplicate                      |
| `PUT /v1/agents/:id`                       |    ✅    |       ✅        | Agent editor                                 |
| `DELETE /v1/agents/:id`                    |    ✅    |       ✅        | Agent dashboard                              |
| `GET /v1/sessions`                         |    ✅    |       ✅        | Sessions page                                |
| `POST /v1/sessions`                        |    ✅    |       ✅        | Home page, IDE chat                          |
| `GET /v1/skills`                           |    ✅    |       ✅        | Skills dashboard, agent editor               |
| `POST /v1/skills`                          |    ✅    |       ✅        | Skills dashboard                             |
| `PUT /v1/skills/:id`                       |    ✅    |       ✅        | Skills dashboard                             |
| `DELETE /v1/skills/:id`                    |    ✅    |       ✅        | Skills dashboard                             |
| `GET /v1/tools`                            |    ✅    |       ✅        | Tools dashboard                              |
| `POST /v1/tools`                           |    ✅    |       ✅        | Tools dashboard                              |
| `PUT /v1/tools/:id`                        |    ✅    |       ✅        | Tools dashboard                              |
| `DELETE /v1/tools/:id`                     |    ✅    |       ✅        | Tools dashboard                              |
| `GET /v1/mcp-servers`                      |    ✅    |       ✅        | MCP dashboard, agent editor                  |
| `POST /v1/mcp-servers`                     |    ✅    |       ✅        | MCP dashboard                                |
| `PUT /v1/mcp-servers/:id`                  |    ✅    |       ✅        | MCP dashboard                                |
| `DELETE /v1/mcp-servers/:id`               |    ✅    |       ✅        | MCP dashboard                                |
| `POST /v1/mcp-servers/:id/test`            |    ✅    |       ✅        | MCP dashboard — connection test              |
| `GET /v1/agents/:id`                       |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/skills/:id`                       |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/tools/:id`                        |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/mcp-servers/:id`                  |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/sessions/:id`                     |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/sessions/:id/working-memory`      |    —     |       ✅        | Inspect session-scoped working memory        |
| `PUT /v1/sessions/:id`                     |    —     |       ✅        | Update session (no UI)                       |
| `DELETE /v1/sessions/:id`                  |    —     |       ✅        | Delete session (no UI)                       |
| `GET /v1/memories`                         |    ✅    |       ✅        | Memory dashboard list/filter                 |
| `GET /v1/memories/export`                  |    ✅    |       ✅        | Export filtered memory records               |
| `GET /v1/memories/:id`                     |    ✅    |       ✅        | Memory dashboard detail                      |
| `PUT /v1/memories/:id`                     |    ✅    |       ✅        | Memory dashboard edit                        |
| `POST /v1/memories/:id/review`             |    ✅    |       ✅        | Approve or reject a memory record            |
| `DELETE /v1/memories/:id`                  |    ✅    |       ✅        | Delete a memory record                       |
| `POST /v1/memories/clear`                  |    ✅    |       ✅        | Explicit clear-by-scope memory action        |
| `POST /v1/memories/self-learning/evaluate` |    —     |       ✅        | Generate review-gated self-learning proposal |
| `GET /v1/model-configs`                    |    ✅    |       ✅        | Model configs dashboard                      |
| `POST /v1/model-configs`                   |    ✅    |       ✅        | Model configs dashboard — create             |
| `PUT /v1/model-configs/:id`                |    ✅    |       ✅        | Model configs dashboard — edit               |
| `DELETE /v1/model-configs/:id`             |    ✅    |       ✅        | Model configs dashboard — delete             |
| `POST /v1/model-configs/:id/test`          |    ✅    |       ✅        | Model configs dashboard — test connection    |
| `GET /v1/model-configs/:id`                |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/settings`                         |    —     |       ✅        | Platform settings — API / automation only    |
| `PUT /v1/settings/:key`                    |    —     |       ✅        | Set a setting — API / automation only        |
| `DELETE /v1/settings/:key`                 |    —     |       ✅        | Delete a setting — API / automation only     |
| `GET /v1/tool-executions`                  |    —     |       ✅        | Audit log query — API / automation only      |
| `GET /v1/approval-requests`                |    —     |       ✅        | HITL approval request query                  |
| `GET /v1/approval-requests/:id`            |    —     |       ✅        | HITL approval request detail                 |
| `POST /v1/approval-requests/:id/approve`   |    —     |       ✅        | Approve pending HITL request                 |
| `POST /v1/approval-requests/:id/reject`    |    —     |       ✅        | Reject pending HITL request                  |
| `POST /v1/approval-requests/:id/expire`    |    —     |       ✅        | Expire pending HITL request                  |
| `GET /v1/workspace/files`                  |    ✅    |       ✅        | List workspace files by managed area         |
| `GET /v1/workspace/files/download`         |    ✅    |       ✅        | Download a safe workspace-relative file      |
| `POST /v1/chat/stream`                     |    —     |       ✅        | ⚠️ Deprecated legacy pass-through            |
| `GET /health`                              |    —     |       ✅        | Health check (outside `/v1`)                 |

> **Note:** The catch-all BFF proxy makes all `/v1` endpoints technically reachable from the browser. The "—" entries above simply have no UI that calls them today.

### Skills

| Method   | Path             | Description     |
| -------- | ---------------- | --------------- |
| `GET`    | `/v1/skills`     | List all skills |
| `GET`    | `/v1/skills/:id` | Get skill by ID |
| `POST`   | `/v1/skills`     | Create a skill  |
| `PUT`    | `/v1/skills/:id` | Replace a skill |
| `DELETE` | `/v1/skills/:id` | Delete a skill  |

Body schema: `SkillSchema` — requires `goal` (string), `constraints` (string[]), `tools` (string[]).

### Tools

| Method   | Path            | Description                                             |
| -------- | --------------- | ------------------------------------------------------- |
| `GET`    | `/v1/tools`     | List all tools, including built-in system tools         |
| `GET`    | `/v1/tools/:id` | Get tool by ID or slug, including built-in system tools |
| `POST`   | `/v1/tools`     | Create a tool                                           |
| `PUT`    | `/v1/tools/:id` | Replace a tool                                          |
| `DELETE` | `/v1/tools/:id` | Delete a tool                                           |

Body schema: `ToolSchema` — requires `name`, `handler` with `{ type: 'inline', code: string }`.

Built-in observability tools exposed by `GET /v1/tools`:

| Tool ID                   | Name                  | Parameters                   | Result envelope                         |
| ------------------------- | --------------------- | ---------------------------- | --------------------------------------- |
| `sys_query_logs`          | `query_logs`          | `level?`, `since?`, `limit?` | `{ total, truncated, records }`         |
| `sys_query_recent_errors` | `query_recent_errors` | `limit?`                     | `{ total, truncated, records }`         |
| `sys_inspect_trace`       | `inspect_trace`       | `traceId?`                   | `{ traceId, total, truncated, events }` |

All three observability tools are read-only, zero-risk system tools. They are jailed to the current API session, and `inspect_trace` defaults to the current run when `traceId` is omitted.

### Approval Requests

| Method | Path                                | Description                        |
| ------ | ----------------------------------- | ---------------------------------- |
| `GET`  | `/v1/approval-requests`             | List approval requests             |
| `GET`  | `/v1/approval-requests/:id`         | Get approval request by ID         |
| `POST` | `/v1/approval-requests/:id/approve` | Approve a pending approval request |
| `POST` | `/v1/approval-requests/:id/reject`  | Reject a pending approval request  |
| `POST` | `/v1/approval-requests/:id/expire`  | Expire a pending approval request  |

Query filters: `sessionId`, `runId`, `agentId`, `toolName`, `riskTier`, `status`, `limit`, `offset`.

Decision body schema:

```json
{ "reason": "Optional human-readable reason" }
```

Approval request `argsJson` is always stored and returned with secret-looking argument keys redacted. Valid statuses are `pending`, `approved`, `rejected`, and `expired`. Pending requests can move to any terminal status; terminal requests are idempotent for the same status and reject flip-flops.

### Workspace Files

See [Workspace Storage](workspace-storage.md) for the host workspace model, security boundaries, UI behavior, cleanup commands, and verification flow.

| Method | Path                           | Description                                         |
| ------ | ------------------------------ | --------------------------------------------------- |
| `GET`  | `/v1/workspace/files`          | List files grouped by workspace area                |
| `GET`  | `/v1/workspace/files/download` | Download a workspace-relative file with `?path=...` |

`GET /v1/workspace/files` returns the managed workspace areas `uploads`, `generated`, `scratch`, and `exports`. The response uses workspace-relative paths only:

```json
{
  "data": {
    "areas": [
      {
        "area": "generated",
        "label": "Generated",
        "path": "generated",
        "files": [
          {
            "name": "summary.txt",
            "path": "generated/reports/summary.txt",
            "area": "generated",
            "kind": "file",
            "size": 12,
            "modifiedAt": "2026-04-29T12:00:00.000Z"
          }
        ]
      }
    ],
    "totalFiles": 1
  }
}
```

`GET /v1/workspace/files/download?path=generated/reports/summary.txt` streams the file as an attachment. Absolute paths, traversal paths, directories, and symlink escapes are rejected with human-readable errors.

### MCP Servers

| Method   | Path                  | Description           |
| -------- | --------------------- | --------------------- |
| `GET`    | `/v1/mcp-servers`     | List all MCP servers  |
| `GET`    | `/v1/mcp-servers/:id` | Get MCP server by ID  |
| `POST`   | `/v1/mcp-servers`     | Create an MCP server  |
| `PUT`    | `/v1/mcp-servers/:id` | Replace an MCP server |
| `DELETE` | `/v1/mcp-servers/:id` | Delete an MCP server  |

Body schema: `McpServerSchema` — requires `name`, `transport`. Optional: `command`, `args`, `url`, `metadata`.

### Agents

| Method   | Path             | Description                                           |
| -------- | ---------------- | ----------------------------------------------------- |
| `GET`    | `/v1/agents`     | List all agents                                       |
| `GET`    | `/v1/agents/:id` | Get agent by ID                                       |
| `POST`   | `/v1/agents`     | Create an agent                                       |
| `PUT`    | `/v1/agents/:id` | Replace an agent (includes skill/tool/MCP allowlists) |
| `DELETE` | `/v1/agents/:id` | Delete an agent (cascades to sessions)                |

Body schema: `AgentSchema` — requires `name`, `executionLimits`. Optional: `systemPrompt`, `description`, `modelOverride`, `modelConfigId`, `skills`, `tools`, `mcpServers`.

> **`modelConfigId`** — reference a saved model configuration (see [Model Configs](#model-configs) below). When set, it takes precedence over `modelOverride` and env-var key resolution. The API validates the referenced config exists on create/update.

### Model Configs

Saved LLM provider configurations with securely stored API keys. Assigned to agents to pin them to a specific model + key.

| Method   | Path                         | Description                                         |
| -------- | ---------------------------- | --------------------------------------------------- |
| `GET`    | `/v1/model-configs`          | List all model configs                              |
| `GET`    | `/v1/model-configs/:id`      | Get model config by ID                              |
| `POST`   | `/v1/model-configs`          | Create a model config                               |
| `PUT`    | `/v1/model-configs/:id`      | Update a model config                               |
| `DELETE` | `/v1/model-configs/:id`      | Delete a model config (unlinks agents via SET NULL) |
| `POST`   | `/v1/model-configs/:id/test` | Test connection — fires a minimal LLM ping          |

**Create / Update body:**

```json
{
  "name": "GPT-4o (production)",
  "provider": "openai",
  "model": "gpt-4o",
  "apiKey": "sk-..."
}
```

| Field      | Required on create | Notes                                                                                     |
| ---------- | :----------------: | ----------------------------------------------------------------------------------------- |
| `name`     |      **Yes**       | Display name                                                                              |
| `provider` |      **Yes**       | `openai` / `anthropic` / `ollama` / any string                                            |
| `model`    |      **Yes**       | Model identifier (e.g. `gpt-4o`, `claude-3-5-sonnet`)                                     |
| `apiKey`   |         No         | API key — encrypted at rest (AES-256-GCM). Omit to keep existing key. Pass `""` to clear. |

**Response shape** — API key is **never** returned:

```json
{
  "data": {
    "id": "uuid",
    "name": "GPT-4o (production)",
    "provider": "openai",
    "model": "gpt-4o",
    "hasApiKey": true,
    "createdAtMs": 1714000000000,
    "updatedAtMs": 1714000000000
  }
}
```

**Test connection response:**

```json
{
  "data": { "ok": true, "latencyMs": 312 }
}
```

On failure: `{ "data": { "ok": false, "latencyMs": 120, "error": "..." } }`

> **Security:** `SECRETS_MASTER_KEY` must be set to store or use API keys in model configs. Keys are encrypted with AES-256-GCM and never appear in API responses or logs.

### Sessions

| Method   | Path                              | Description                         |
| -------- | --------------------------------- | ----------------------------------- |
| `GET`    | `/v1/sessions`                    | List sessions (filter: `?agentId=`) |
| `GET`    | `/v1/sessions/:id`                | Get session by ID                   |
| `GET`    | `/v1/sessions/:id/working-memory` | Get session working memory artifact |
| `POST`   | `/v1/sessions`                    | Create a session                    |
| `PUT`    | `/v1/sessions/:id`                | Update a session                    |
| `DELETE` | `/v1/sessions/:id`                | Delete a session                    |

Body schema: `SessionCreateBodySchema` — requires `agentId`. Agent must exist (FK constraint → 404 on missing).

`GET /v1/sessions/:id/working-memory` returns `{ "data": null }` until the session has completed at least one chat or resume turn that produced working-memory state. When present, the artifact is scoped to the session and contains the current goal, active project/task, key decisions, important files, bounded tool summaries, blockers, pending approval IDs, next action, and a compact summary used for session continuity.

### Memories

| Method   | Path                                  | Description                                      |
| -------- | ------------------------------------- | ------------------------------------------------ |
| `GET`    | `/v1/memories`                        | List memory records with scope/status filters    |
| `GET`    | `/v1/memories/export`                 | Export filtered records as JSON-safe data        |
| `GET`    | `/v1/memories/:id`                    | Get one memory record                            |
| `PUT`    | `/v1/memories/:id`                    | Edit memory content, tags, metadata, or workflow |
| `POST`   | `/v1/memories/:id/review`             | Approve or reject a memory record                |
| `DELETE` | `/v1/memories/:id`                    | Delete one memory record                         |
| `POST`   | `/v1/memories/clear`                  | Delete records matching an explicit scope        |
| `POST`   | `/v1/memories/cleanup`                | Dry-run or delete expired records                |
| `POST`   | `/v1/memories/self-learning/evaluate` | Evaluate a narrow self-learning objective        |

`GET /v1/memories` accepts `scope`, `scopeId`, `kind`, `status`, `reviewStatus`, `safetyState`, `minConfidence`, `sourceKind`, `sourceId`, `tag`, `includeExpired`, `limit`, and `offset`. It returns `{ "data": { "items": [...], "total": 1, "limit": 100, "offset": 0 } }`.

Review requests use `{ "decision": "approved" | "rejected", "reason"?: "..." }`. Clear requests require `{ "scope": "...", "scopeId"?: "...", "confirm": true }` and may include status/review/safety filters. Cleanup requests target expired memories only; they default to dry-run and require `{ "dryRun": false, "confirm": true }` before deletion. Destructive memory operations are logged without memory content.

`POST /v1/memories/self-learning/evaluate` currently supports the narrow `recoverable_workspace_path_errors` objective. It combines supplied observed outcomes, recent observability errors for the session, and pending failure candidates. If the configured threshold is reached, it creates a `pending` / `unreviewed` `failure_learning` memory tagged `self-learning`; it does not create Beads tasks, code changes, policy changes, or prompt changes. Approval still happens through the normal memory review endpoint/UI.

### Chat

| Method | Path              | Description                                                  |
| ------ | ----------------- | ------------------------------------------------------------ |
| `POST` | `/v1/chat`        | Stream a chat message through the agent graph (NDJSON)       |
| `POST` | `/v1/chat/stream` | ⚠️ **Deprecated** — raw OpenAI pass-through (use `/v1/chat`) |

#### `POST /v1/chat`

The primary chat endpoint. Runs the full agent harness (ReAct loop, tool dispatch, security guards) and streams results as **NDJSON** (`application/x-ndjson`).

**Request body:**

```json
{ "sessionId": "uuid", "message": "user message text" }
```

**Headers:**

| Header              | Required | Description                                                                                                                                    |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-openai-key`      | No       | API key override for this request (falls back to env-var chain)                                                                                |
| `x-model-config-id` | No       | Override the agent's model config for this request — must be an ID from `/v1/model-configs`. Takes highest precedence in the resolution chain. |

**Response:** NDJSON stream. Each line is a JSON object with a `type` field:

| Event               | When                                     | Key fields                                                 |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `text`              | LLM text delta                           | `content`                                                  |
| `thinking`          | LLM reasoning delta                      | `content`                                                  |
| `tool_result`       | Tool execution complete                  | `toolId`, `data`                                           |
| `approval_required` | Tool execution paused for human approval | `approvalRequestId`, `toolName`, `riskTier`, `argsPreview` |
| `error`             | Fatal or budget limit hit                | `code`, `message`                                          |
| `stream_aborted`    | Client disconnect or timeout             | `reason`                                                   |

When `approval_required` is emitted, the harness has created a pending approval request and stopped before executing that tool. Remaining tool calls in the same model batch are skipped; approval/resume execution is handled by the HITL resume flow.

**Error responses (pre-stream):**

| Status | Code             | Cause                                               |
| ------ | ---------------- | --------------------------------------------------- |
| 400    | VALIDATION_ERROR | Body fails Zod validation                           |
| 400    | MISSING_KEY      | No API key available (header, env, or settings)     |
| 404    | NOT_FOUND        | Session or agent not found                          |
| 409    | SESSION_BUSY     | Another request is already running for this session |

### Tool Executions

| Method | Path                  | Description                    |
| ------ | --------------------- | ------------------------------ |
| `GET`  | `/v1/tool-executions` | Query tool execution audit log |

**Query parameters:** `agentId`, `sessionId`, `toolName`, `riskTier`, `status`, `limit` (default 100, max 1000), `offset` (default 0).

Returns `{ data, total, limit, offset }`.

### Settings

| Method   | Path                | Description         |
| -------- | ------------------- | ------------------- |
| `GET`    | `/v1/settings`      | List all settings   |
| `PUT`    | `/v1/settings/:key` | Set a setting value |
| `DELETE` | `/v1/settings/:key` | Delete a setting    |

## Error Responses

All errors follow a consistent shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [ ... ]
  }
}
```

### HTTP Status Codes

| Status | When                                                            |
| ------ | --------------------------------------------------------------- |
| `400`  | Validation error (Zod), malformed request, raw constraint error |
| `404`  | Resource not found, FK violation (referenced entity missing)    |
| `409`  | Unique constraint violation (duplicate slug), or `SESSION_BUSY` |
| `422`  | OpenAPI validation failure                                      |
| `429`  | Rate limit exceeded (`RATE_LIMITED`)                            |
| `500`  | Unexpected server error                                         |

### Error Types

| Error                           | Status | Cause                                                     |
| ------------------------------- | ------ | --------------------------------------------------------- |
| `ZodError`                      | 400    | Request body fails schema validation                      |
| `HttpError`                     | varies | Explicit HTTP error thrown by route handler               |
| `ForeignKeyViolationError`      | 404    | Referenced entity (e.g., agent for session) doesn't exist |
| `UniqueConstraintError`         | 409    | Duplicate slug or primary key                             |
| `SESSION_BUSY`                  | 409    | Concurrent chat request for same session                  |
| `RATE_LIMITED`                  | 429    | Too many requests in the current window                   |
| `OpenApiRequestValidationError` | 422    | Request doesn't match OpenAPI spec                        |
