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

| Endpoint                        | Frontend | curl / API-only | Notes                                        |
| ------------------------------- | :------: | :-------------: | -------------------------------------------- |
| `POST /v1/chat`                 |    ✅    |       ✅        | Primary chat — via dedicated `/api/chat` BFF |
| `GET /v1/agents`                |    ✅    |       ✅        | Agent dashboard, agent editor, home page     |
| `POST /v1/agents`               |    ✅    |       ✅        | Agent editor, duplicate                      |
| `PUT /v1/agents/:id`            |    ✅    |       ✅        | Agent editor                                 |
| `DELETE /v1/agents/:id`         |    ✅    |       ✅        | Agent dashboard                              |
| `GET /v1/sessions`              |    ✅    |       ✅        | Sessions page                                |
| `POST /v1/sessions`             |    ✅    |       ✅        | Home page, IDE chat                          |
| `GET /v1/skills`                |    ✅    |       ✅        | Skills dashboard, agent editor               |
| `POST /v1/skills`               |    ✅    |       ✅        | Skills dashboard                             |
| `PUT /v1/skills/:id`            |    ✅    |       ✅        | Skills dashboard                             |
| `DELETE /v1/skills/:id`         |    ✅    |       ✅        | Skills dashboard                             |
| `GET /v1/tools`                 |    ✅    |       ✅        | Tools dashboard                              |
| `POST /v1/tools`                |    ✅    |       ✅        | Tools dashboard                              |
| `PUT /v1/tools/:id`             |    ✅    |       ✅        | Tools dashboard                              |
| `DELETE /v1/tools/:id`          |    ✅    |       ✅        | Tools dashboard                              |
| `GET /v1/mcp-servers`           |    ✅    |       ✅        | MCP dashboard, agent editor                  |
| `POST /v1/mcp-servers`          |    ✅    |       ✅        | MCP dashboard                                |
| `PUT /v1/mcp-servers/:id`       |    ✅    |       ✅        | MCP dashboard                                |
| `DELETE /v1/mcp-servers/:id`    |    ✅    |       ✅        | MCP dashboard                                |
| `POST /v1/mcp-servers/:id/test` |    ✅    |       ✅        | MCP dashboard — connection test              |
| `GET /v1/agents/:id`            |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/skills/:id`            |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/tools/:id`             |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/mcp-servers/:id`       |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `GET /v1/sessions/:id`          |    —     |       ✅        | Single resource fetch (no dedicated UI)      |
| `PUT /v1/sessions/:id`          |    —     |       ✅        | Update session (no UI)                       |
| `DELETE /v1/sessions/:id`       |    —     |       ✅        | Delete session (no UI)                       |
| `GET /v1/settings`              |    —     |       ✅        | Platform settings — API / automation only    |
| `PUT /v1/settings/:key`         |    —     |       ✅        | Set a setting — API / automation only        |
| `DELETE /v1/settings/:key`      |    —     |       ✅        | Delete a setting — API / automation only     |
| `GET /v1/tool-executions`       |    —     |       ✅        | Audit log query — API / automation only      |
| `POST /v1/chat/stream`          |    —     |       ✅        | ⚠️ Deprecated legacy pass-through            |
| `GET /health`                   |    —     |       ✅        | Health check (outside `/v1`)                 |

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

| Method   | Path            | Description    |
| -------- | --------------- | -------------- |
| `GET`    | `/v1/tools`     | List all tools |
| `GET`    | `/v1/tools/:id` | Get tool by ID |
| `POST`   | `/v1/tools`     | Create a tool  |
| `PUT`    | `/v1/tools/:id` | Replace a tool |
| `DELETE` | `/v1/tools/:id` | Delete a tool  |

Body schema: `ToolSchema` — requires `name`, `handler` with `{ type: 'inline', code: string }`.

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

Body schema: `AgentSchema` — requires `name`, `executionLimits`. Optional: `systemPrompt`, `description`, `modelOverride`, `skills`, `tools`, `mcpServers`.

### Sessions

| Method   | Path               | Description                         |
| -------- | ------------------ | ----------------------------------- |
| `GET`    | `/v1/sessions`     | List sessions (filter: `?agentId=`) |
| `GET`    | `/v1/sessions/:id` | Get session by ID                   |
| `POST`   | `/v1/sessions`     | Create a session                    |
| `PUT`    | `/v1/sessions/:id` | Update a session                    |
| `DELETE` | `/v1/sessions/:id` | Delete a session                    |

Body schema: `SessionCreateBodySchema` — requires `agentId`. Agent must exist (FK constraint → 404 on missing).

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

**Headers:** `x-openai-key` (optional) — overrides the configured API key for this request.

**Response:** NDJSON stream. Each line is a JSON object with a `type` field:

| Event            | When                         | Key fields        |
| ---------------- | ---------------------------- | ----------------- |
| `text`           | LLM text delta               | `content`         |
| `thinking`       | LLM reasoning delta          | `content`         |
| `tool_result`    | Tool execution complete      | `toolId`, `data`  |
| `error`          | Fatal or budget limit hit    | `code`, `message` |
| `stream_aborted` | Client disconnect or timeout | `reason`          |

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
