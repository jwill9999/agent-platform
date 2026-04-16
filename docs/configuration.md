# Configuration

## Model Routing

Model configuration is fully user-controlled — no hardcoded model IDs. The `model-router` package routes requests to the configured LLM provider using the Vercel AI SDK.

### Agent-Level Model Override

Each agent can specify a model override in its configuration:

```json
{
  "name": "My Agent",
  "systemPrompt": "You are a helpful assistant.",
  "executionLimits": { "maxTurns": 10, "maxTokens": 4096 },
  "modelOverride": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "ref:secret-ref-id"
  }
}
```

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

### API Key Configuration

- **`AGENT_OPENAI_API_KEY`** — environment variable for API-side chat
- **`NEXT_OPENAI_API_KEY`** — environment variable for Next.js BFF
- **`OPENAI_API_KEY`** — blocked by default; enable with `OPENAI_ALLOW_LEGACY_ENV=1`
- **Secret refs** — encrypted API keys stored in database (AES-256-GCM)

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

| Transport | Fields            | Use Case                                |
| --------- | ----------------- | --------------------------------------- |
| `stdio`   | `command`, `args` | Local process (e.g., filesystem server) |
| `sse`     | `url`             | Remote HTTP server                      |

### Assigning to Agents

MCP servers are assigned to agents through allowlists when creating/updating an agent:

```bash
curl -X PUT http://localhost:3000/v1/agents/<id> \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My Agent",
    "mcpServers": ["<mcp-server-id>"],
    "skills": [],
    "tools": []
  }'
```

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
      "maxTurns": 20,
      "maxTokens": 8192
    },
    "skills": ["<skill-id>"],
    "tools": ["<tool-id>"],
    "mcpServers": ["<mcp-server-id>"]
  }'
```

### Execution Limits

| Field       | Description                               |
| ----------- | ----------------------------------------- |
| `maxTurns`  | Maximum agent reasoning turns per request |
| `maxTokens` | Maximum tokens per LLM call               |

### Allowlists

Agents control access through allowlists:

- **Skills** — which skills the agent can use
- **Tools** — which inline tools are available
- **MCP Servers** — which MCP tool servers to connect

## Skill Configuration

Skills combine a goal, constraints, and tools:

```bash
curl -X POST http://localhost:3000/v1/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "goal": "Search and summarize web content",
    "constraints": ["Only use approved sources", "Limit to 500 words"],
    "tools": ["<tool-id>"]
  }'
```

## Tool Configuration

Tools define discrete capabilities:

```bash
curl -X POST http://localhost:3000/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "calculator",
    "description": "Perform mathematical calculations",
    "handler": {
      "type": "inline",
      "code": "return eval(input.expression)"
    }
  }'
```
