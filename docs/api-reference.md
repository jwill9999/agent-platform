# API Reference

## Overview

The API server (`apps/api`) exposes a REST JSON API on port 3000. All resource endpoints live under `/v1`. Requires `SQLITE_PATH` environment variable at process start.

**Interactive docs:** When running, Swagger UI is available at `/api-docs`.

## Authentication

Single-user MVP — no authentication required. A stub middleware exists for future expansion.

## Health Check

| Method | Path      | Description                              |
| ------ | --------- | ---------------------------------------- |
| `GET`  | `/health` | Returns server health (no DB dependency) |

```json
{ "status": "ok", "version": "1.0.0" }
```

## Resource Endpoints (`/v1`)

All endpoints accept and return JSON. IDs are UUIDs (auto-generated on create). Each entity also has a unique `slug` field derived from its name.

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

| Method | Path              | Description                                   |
| ------ | ----------------- | --------------------------------------------- |
| `POST` | `/v1/chat/stream` | Stream a chat message through the agent graph |
| `POST` | `/v1/chat/plan`   | Generate a plan using the planner             |

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
| `409`  | Unique constraint violation (duplicate slug or ID)              |
| `422`  | OpenAPI validation failure                                      |
| `500`  | Unexpected server error                                         |

### Error Types

| Error                           | Status | Cause                                                     |
| ------------------------------- | ------ | --------------------------------------------------------- |
| `ZodError`                      | 400    | Request body fails schema validation                      |
| `HttpError`                     | varies | Explicit HTTP error thrown by route handler               |
| `ForeignKeyViolationError`      | 404    | Referenced entity (e.g., agent for session) doesn't exist |
| `UniqueConstraintError`         | 409    | Duplicate slug or primary key                             |
| `OpenApiRequestValidationError` | 422    | Request doesn't match OpenAPI spec                        |
