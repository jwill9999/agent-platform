# Configuration

## Environment Variables

All configuration ultimately flows through environment variables and the Settings API.

### API Server (`apps/api`)

| Variable                 | Required | Default                     | Description                                                                                         |
| ------------------------ | -------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `SQLITE_PATH`            | **Yes**  | —                           | Absolute path to the SQLite database file                                                           |
| `SECRETS_MASTER_KEY`     | No       | —                           | Base64-encoded 32-byte key for AES-256-GCM secret encryption. Required to use encrypted secret refs |
| `PORT`                   | No       | `3000`                      | API listen port                                                                                     |
| `HOST`                   | No       | `0.0.0.0`                   | API bind address                                                                                    |
| `RATE_LIMIT_WINDOW_MS`   | No       | `60000`                     | Rate-limiter sliding window (ms)                                                                    |
| `RATE_LIMIT_MAX`         | No       | `100`                       | Maximum requests per window                                                                         |
| `DEFAULT_MODEL_PROVIDER` | No       | `openai`                    | Default LLM provider when no agent override is set                                                  |
| `DEFAULT_MODEL`          | No       | Provider default            | Default model name when no agent override is set                                                    |
| `OLLAMA_BASE_URL`        | No       | `http://localhost:11434/v1` | Base URL for the Ollama provider                                                                    |
| `NODE_ENV`               | No       | —                           | Set to `production` to disable OpenAPI response validation                                          |

### LLM API Keys (API Server)

Keys are resolved in order of precedence:

1. **`x-openai-key`** request header (per-request)
2. Provider-specific env var (see table below)
3. Legacy env var — blocked unless opt-in is enabled

| Provider    | Preferred Env Var         | Legacy Env Var      | Legacy Opt-In Gate                                  |
| ----------- | ------------------------- | ------------------- | --------------------------------------------------- |
| `openai`    | `AGENT_OPENAI_API_KEY`    | `OPENAI_API_KEY`    | `OPENAI_ALLOW_LEGACY_ENV=1` or `ALLOW_LEGACY_ENV=1` |
| `anthropic` | `AGENT_ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | `ALLOW_LEGACY_ENV=1`                                |
| `ollama`    | — (no key needed)         | —                   | —                                                   |

### Web BFF (`apps/web`)

| Variable                       | Required | Default                 | Description                                   |
| ------------------------------ | -------- | ----------------------- | --------------------------------------------- |
| `API_PROXY_URL`                | No       | `http://127.0.0.1:3000` | Target URL for BFF → API proxy                |
| `CHAT_PROXY_HEADER_TIMEOUT_MS` | No       | `90000`                 | Header timeout for the `/api/chat` proxy (ms) |
| `NEXT_OPENAI_API_KEY`          | No       | —                       | OpenAI key injected by the BFF chat route     |
| `AGENT_OPENAI_API_KEY`         | No       | —                       | Fallback checked before `NEXT_OPENAI_API_KEY` |

---

## Model Routing

Model configuration is fully user-controlled — no hardcoded model IDs. The `model-router` package routes requests to the configured LLM provider using the Vercel AI SDK.

### Agent-Level Model Override

Each agent can specify a model override in its configuration:

```json
{
  "name": "My Agent",
  "systemPrompt": "You are a helpful assistant.",
  "executionLimits": {
    "maxSteps": 10,
    "maxParallelTasks": 1,
    "timeoutMs": 120000
  },
  "modelOverride": {
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

> **Note:** `modelOverride` contains `provider` and `model` only. API keys are resolved separately via the precedence chain above — they are never stored in the agent record.

### Settings-Based Configuration

Global model settings can be stored via the Settings API:

```bash
# Set default model provider
curl -X PUT http://localhost:3000/v1/settings/model.provider \
  -H 'Content-Type: application/json' \
  -d '{"value": "openai"}'

# Set default model
curl -X PUT http://localhost:3000/v1/settings/model.name \
  -H 'Content-Type: application/json' \
  -d '{"value": "gpt-4o"}'
```

---

## Agent Configuration

### Creating an Agent

```bash
curl -X POST http://localhost:3000/v1/agents \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Research Agent",
    "systemPrompt": "You are a research assistant.",
    "description": "Helps with research tasks",
    "executionLimits": {
      "maxSteps": 20,
      "maxParallelTasks": 2,
      "timeoutMs": 180000,
      "toolTimeoutMs": 30000,
      "maxTokens": 8192,
      "maxToolCallsTotal": 100
    },
    "contextWindow": {
      "maxInputTokens": 8000,
      "strategy": "truncate"
    },
    "allowedSkillIds": ["<skill-id>"],
    "allowedToolIds": ["<tool-id>"],
    "allowedMcpServerIds": ["<mcp-server-id>"],
    "pluginAllowlist": null,
    "pluginDenylist": null
  }'
```

### Execution Limits

All limits are enforced by the harness per request.

| Field               | Required | Description                                                                                                                                                                                                                                                                 |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxSteps`          | **Yes**  | Maximum agent reasoning steps (LLM turns) per request                                                                                                                                                                                                                       |
| `maxParallelTasks`  | **Yes**  | Maximum concurrent parallel tasks                                                                                                                                                                                                                                           |
| `timeoutMs`         | **Yes**  | Wall-time deadline for the entire run (ms). The harness propagates this into graph state so every node (LLM calls, tool dispatch) checks remaining time before starting work. Individual tool calls are capped at the lesser of `toolTimeoutMs` and the remaining deadline. |
| `toolTimeoutMs`     | No       | Per-tool-call timeout (ms); defaults to harness global                                                                                                                                                                                                                      |
| `maxTokens`         | No       | Cumulative token budget across the request                                                                                                                                                                                                                                  |
| `maxCostUnits`      | No       | Cumulative cost cap (provider-defined units)                                                                                                                                                                                                                                |
| `maxToolCallsTotal` | No       | Maximum total tool calls across the entire request                                                                                                                                                                                                                          |

Budget warnings are emitted at 80% utilisation for `maxTokens`, `maxCostUnits`, and `maxToolCallsTotal`.

### Context Window

Controls how conversation history is windowed before each LLM call.

| Field            | Default    | Description                                                         |
| ---------------- | ---------- | ------------------------------------------------------------------- |
| `maxInputTokens` | `8000`     | Maximum input tokens (system prompt + history + new message)        |
| `strategy`       | `truncate` | Overflow strategy: `truncate` (drop oldest messages) or `summarize` |

### Allowlists

Agents control access to resources through ID-based allowlists:

| Field                 | Type               | Description                                         |
| --------------------- | ------------------ | --------------------------------------------------- |
| `allowedSkillIds`     | `string[]`         | Which skills the agent can use                      |
| `allowedToolIds`      | `string[]`         | Which inline tools are available                    |
| `allowedMcpServerIds` | `string[]`         | Which MCP tool servers to connect                   |
| `pluginAllowlist`     | `string[] \| null` | Restrict to named plugins only (`null` = allow all) |
| `pluginDenylist`      | `string[] \| null` | Block specific plugins (`null` = block none)        |

---

## MCP Server Configuration

MCP (Model Context Protocol) servers extend agent capabilities by providing tools.

### Creating an MCP Server

```bash
curl -X POST http://localhost:3000/v1/mcp-servers \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Filesystem MCP",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
  }'
```

### Transport Types

| Transport         | Fields            | Use Case                                        |
| ----------------- | ----------------- | ----------------------------------------------- |
| `stdio`           | `command`, `args` | Local process (e.g., filesystem server)         |
| `sse`             | `url`             | Remote HTTP server (legacy SSE protocol)        |
| `streamable-http` | `url`             | Remote HTTP server (current MCP HTTP transport) |

> Both `sse` and `streamable-http` use the `StreamableHTTPClientTransport` under the hood.

### Assigning to Agents

MCP servers are assigned to agents through the `allowedMcpServerIds` field:

```bash
curl -X PUT http://localhost:3000/v1/agents/<id> \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My Agent",
    "systemPrompt": "You are a helpful assistant.",
    "allowedMcpServerIds": ["<mcp-server-id>"],
    "allowedSkillIds": [],
    "allowedToolIds": [],
    "executionLimits": { "maxSteps": 10, "maxParallelTasks": 1, "timeoutMs": 120000 }
  }'
```

---

## Skill Configuration

Skills combine a name, goal, constraints, and tools:

```bash
curl -X POST http://localhost:3000/v1/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Web Research",
    "goal": "Search and summarize web content",
    "constraints": ["Only use approved sources", "Limit to 500 words"],
    "tools": ["<tool-id>"]
  }'
```

| Field          | Required | Description                                       |
| -------------- | -------- | ------------------------------------------------- |
| `name`         | **Yes**  | Display name for the skill                        |
| `goal`         | **Yes**  | What the skill achieves                           |
| `constraints`  | **Yes**  | Rules the agent must follow when using this skill |
| `tools`        | **Yes**  | Tool IDs available to this skill                  |
| `outputSchema` | No       | JSON schema for structured skill output           |

---

## Tool Configuration

Tools define discrete capabilities available to agents:

```bash
curl -X POST http://localhost:3000/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "calculator",
    "description": "Perform mathematical calculations",
    "config": {},
    "riskTier": "low",
    "requiresApproval": false
  }'
```

| Field              | Required | Description                                  |
| ------------------ | -------- | -------------------------------------------- |
| `name`             | **Yes**  | Tool identifier                              |
| `description`      | No       | What the tool does (included in LLM context) |
| `config`           | No       | Arbitrary key/value configuration            |
| `riskTier`         | No       | Risk classification: `low`, `medium`, `high` |
| `requiresApproval` | No       | Whether tool calls need human approval       |

---

## Rate Limiting

The API includes a dynamic rate limiter (express-rate-limit) that can be configured at startup via environment variables or at runtime via the Settings API.

| Setting      | Env Var                | Default | Description                  |
| ------------ | ---------------------- | ------- | ---------------------------- |
| Window       | `RATE_LIMIT_WINDOW_MS` | `60000` | Sliding window duration (ms) |
| Max requests | `RATE_LIMIT_MAX`       | `100`   | Maximum requests per window  |

Runtime reconfiguration:

```bash
curl -X PUT http://localhost:3000/v1/settings/rateLimit.windowMs \
  -H 'Content-Type: application/json' \
  -d '{"value": "30000"}'

curl -X PUT http://localhost:3000/v1/settings/rateLimit.max \
  -H 'Content-Type: application/json' \
  -d '{"value": "200"}'
```

Exceeding the limit returns `429 RATE_LIMITED`.
