# Configuration

## Environment Variables

All configuration ultimately flows through environment variables and the Settings API.

### API Server (`apps/api`)

| Variable                 | Required | Default                     | Description                                                                                                                            |
| ------------------------ | -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `SQLITE_PATH`            | **Yes**  | —                           | Absolute path to the SQLite database file                                                                                              |
| `SECRETS_MASTER_KEY`     | No \*    | —                           | Base64-encoded 32-byte key for AES-256-GCM secret encryption. **Required** for saved credentials and durable private/tool continuation |
| `PORT`                   | No       | `3000`                      | API listen port                                                                                                                        |
| `HOST`                   | No       | `0.0.0.0`                   | API bind address                                                                                                                       |
| `RATE_LIMIT_WINDOW_MS`   | No       | `60000`                     | Rate-limiter sliding window (ms)                                                                                                       |
| `RATE_LIMIT_MAX`         | No       | `100`                       | Maximum requests per window                                                                                                            |
| `DEFAULT_MODEL_PROVIDER` | No       | `openai`                    | Default LLM provider when no agent override is set                                                                                     |
| `DEFAULT_MODEL`          | No       | Provider default            | Default model name when no agent override is set                                                                                       |
| `OLLAMA_BASE_URL`        | No       | `http://localhost:11434/v1` | Base URL for the Ollama provider                                                                                                       |
| `NODE_ENV`               | No       | —                           | Set to `production` to disable OpenAPI response validation                                                                             |

### Workspace Storage

Workspace storage is the user-file area exposed to agents. The host path is operating-system specific, while the container path is stable so tools, Docker mounts, and tests can target the same location.

See [Workspace Storage](workspace-storage.md) for the full setup, security, UI/API, cleanup, and verification reference.

| Variable                         | Required | Default / convention                      | Description                                                                |
| -------------------------------- | -------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| `AGENT_PLATFORM_HOME`            | No       | OS-specific app home                      | Root directory for Agent Platform host-side config, data, workspaces, logs |
| `AGENT_WORKSPACE_HOST_PATH`      | No       | `$AGENT_PLATFORM_HOME/workspaces/default` | Host directory mounted into the runtime as the user workspace              |
| `AGENT_WORKSPACE_CONTAINER_PATH` | No       | `/workspace`                              | Stable container path used by file tools and filesystem MCP configuration  |
| `AGENT_DATA_HOST_PATH`           | No       | `$AGENT_PLATFORM_HOME/data`               | Host directory for app/runtime data separate from user workspace files     |

Default `AGENT_PLATFORM_HOME` conventions:

| Host OS | Default home                                  |
| ------- | --------------------------------------------- |
| Linux   | `~/.agent-platform`                           |
| macOS   | `~/Library/Application Support/AgentPlatform` |
| Windows | `%LOCALAPPDATA%\\AgentPlatform`               |

Default host layout:

```text
AgentPlatform/
  config/
  data/
  workspaces/
    default/
      uploads/
      generated/
      scratch/
      exports/
  logs/
```

For repo-local development, setup may fall back to `./.agent-platform/`; that directory is ignored by Git. Agents should operate on workspace-relative paths under `AGENT_WORKSPACE_CONTAINER_PATH`, not on host-specific paths.

### Workspace Cleanup and Uninstall

Docker cleanup and host data cleanup are deliberately separate:

- `make clean` removes Docker containers, Docker volumes, and locally built images.
- `make workspace-clean-dry-run` shows the host-side Agent Platform paths that would be removed.
- `make workspace-clean` removes host-side workspace/data/config/log directories only after a typed confirmation.
- `make workspace-clean-force` removes host-side workspace/data/config/log directories without prompting and is intended only for automation.

The workspace cleanup command uses the same resolver as `make workspace-init`, so custom `AGENT_PLATFORM_HOME`, `AGENT_WORKSPACE_HOST_PATH`, and `AGENT_DATA_HOST_PATH` values are respected. Dry-run output lists the resolved platform home, workspace host path, data path, workspace container path, resolved directories, and actual removal targets.

Default dry-run commands:

| Host OS | Command                                      | Default host data home                        |
| ------- | -------------------------------------------- | --------------------------------------------- |
| Linux   | `make workspace-clean-dry-run`               | `~/.agent-platform`                           |
| macOS   | `make workspace-clean-dry-run`               | `~/Library/Application Support/AgentPlatform` |
| Windows | `node scripts/workspace-clean.mjs --dry-run` | `%LOCALAPPDATA%\\AgentPlatform`               |

Default removal commands:

| Host OS | Interactive command                | Non-interactive command                    |
| ------- | ---------------------------------- | ------------------------------------------ |
| Linux   | `make workspace-clean`             | `make workspace-clean-force`               |
| macOS   | `make workspace-clean`             | `make workspace-clean-force`               |
| Windows | `node scripts/workspace-clean.mjs` | `node scripts/workspace-clean.mjs --force` |

The cleanup script refuses to delete broad or unsafe paths, including an empty path, `/`, a Windows drive root such as `C:\\`, the user home directory, the repository root, and top-level directories. Always run the dry-run command first when using custom host paths.

### LLM API Keys (API Server)

Keys are resolved in order of precedence:

1. **`x-openai-key`** request header (per-request)
2. Provider-specific env var (see table below)
3. Legacy env var — blocked unless opt-in is enabled

| Provider            | Preferred Env Var          | Legacy Env Var                 | Legacy Opt-In Gate                                  |
| ------------------- | -------------------------- | ------------------------------ | --------------------------------------------------- |
| `openai`            | `AGENT_OPENAI_API_KEY`     | `OPENAI_API_KEY`               | `OPENAI_ALLOW_LEGACY_ENV=1` or `ALLOW_LEGACY_ENV=1` |
| `anthropic`         | `AGENT_ANTHROPIC_API_KEY`  | `ANTHROPIC_API_KEY`            | `ALLOW_LEGACY_ENV=1`                                |
| `google`            | `AGENT_GOOGLE_API_KEY`     | `GOOGLE_GENERATIVE_AI_API_KEY` | `ALLOW_LEGACY_ENV=1`                                |
| `deepseek`          | `AGENT_DEEPSEEK_API_KEY`   | `DEEPSEEK_API_KEY`             | `ALLOW_LEGACY_ENV=1`                                |
| `xai`               | `AGENT_XAI_API_KEY`        | `XAI_API_KEY`                  | `ALLOW_LEGACY_ENV=1`                                |
| `openrouter`        | `AGENT_OPENROUTER_API_KEY` | `OPENROUTER_API_KEY`           | `ALLOW_LEGACY_ENV=1`                                |
| `openai-compatible` | — (optional saved key)     | —                              | —                                                   |
| `ollama`            | — (no key needed)          | —                              | —                                                   |

### Web BFF (`apps/web`)

| Variable                       | Required | Default                 | Description                                   |
| ------------------------------ | -------- | ----------------------- | --------------------------------------------- |
| `API_PROXY_URL`                | No       | `http://127.0.0.1:3000` | Target URL for BFF → API proxy                |
| `CHAT_PROXY_HEADER_TIMEOUT_MS` | No       | `90000`                 | Header timeout for the `/api/chat` proxy (ms) |
| `NEXT_OPENAI_API_KEY`          | No       | —                       | OpenAI key injected by the BFF chat route     |
| `AGENT_OPENAI_API_KEY`         | No       | —                       | Fallback checked before `NEXT_OPENAI_API_KEY` |

### Desktop App (`apps/desktop`)

| Variable                               | Required | Default     | Description                                                                                   |
| -------------------------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------- |
| `AGENT_PLATFORM_DESKTOP_IDE_COMMAND`   | No       | auto-detect | Command used by **Open local IDE**. Receives the active Project folder path as its first arg. |
| `AGENT_PLATFORM_DESKTOP_TEST_OPEN_IDE` | No       | —           | Set to `1` in Electron E2E to acknowledge the IDE handoff without launching host apps.        |

When no explicit IDE command is configured, macOS desktop builds try common local editors first
(`Visual Studio Code`, `Cursor`, `Windsurf`, `Zed`, then matching CLI commands) and fall back to
the operating system folder opener if no editor launch succeeds. The handoff always uses the active
Electron-selected Project folder; users should not type absolute Project paths for this flow.

---

## Model Routing

Model configuration is fully user-controlled — no hardcoded model IDs. The `model-router` package routes requests to the configured LLM provider using the Vercel AI SDK.

### Resolution Order

For each chat request the API resolves the model + API key in this precedence order:

1. **Per-request modelConfigId** — explicit saved configuration selected by the caller.
2. **Agent saved modelConfigId** — shared configuration assigned to that agent.
3. **Saved platform default** — first usable saved configuration (credentials, or a keyless local adapter).
4. **Agent modelOverride / environment** — provider/model with its provider-specific key resolution.
5. **Legacy system fallback** — OpenAI/gpt-4o when no provider/model is supplied; new provider families require an explicit model ID.

Saved configurations share the same backend for UI, agent/chat and future voice/CLI clients. Unsupported
providers fail explicitly; they never silently borrow an OpenAI credential. Per-request picker state is
currently transient; the configuration and agent assignment are durable. Re-select an override after
reopening the app when needed. A pending approval stays bound to its original provider configuration.

### Saved Model Configs (recommended)

Model configs store provider, exact case-sensitive model ID, optional endpoint and encrypted API key.
The supported catalogue is available at GET /v1/model-configs/providers: OpenAI, Anthropic, Google,
DeepSeek, xAI, OpenRouter, Ollama and generic OpenAI-compatible services.

OpenRouter uses its own saved credential and the full provider/model ID (for example
openai/gpt-6.1-sol). Native examples and researched protocol coverage are in the
[SDK plan](planning/provider-sdk-compatibility.md); model availability remains account-dependent.

An endpoint override must use HTTPS, or explicit loopback HTTP for a local service, without URL
credentials/query/fragment. Redirects are rejected before forwarding a key. The configured endpoint
receives that configuration's credential. Changing provider clears the old key/endpoint unless
explicitly replaced; keep a separate saved configuration for each provider/account.

Example saved configuration:

```bash
# Create a saved config
curl -X POST http://localhost:3000/v1/model-configs \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "GPT-4o (production)",
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "sk-..."
  }'

# Assign to an agent
curl -X PUT http://localhost:3000/v1/agents/<id> \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My Agent",
    "modelConfigId": "<model-config-id>",
    "executionLimits": { "maxSteps": 10, "maxParallelTasks": 1, "timeoutMs": 120000 }
  }'
```

See the [API Reference — Model Configs](./api-reference.md#model-configs) for the full endpoint spec.

### Private provider continuation

Stateless OpenAI/xAI Responses calls disable provider storage. Reasoning/signature/tool continuation
is retained separately from public messages, encrypted with the existing secrets master key. Internal
stable message identities/required-format markers detect missing/corrupt continuation; writes finish
before approval/tool effects. Private bytes are excluded from public message APIs, plugins, logs and
diagnostic reports. Raw provider reasoning is not an assistant reply; application status/tool activity
remains visible. Model switching after a completed turn keeps public history and omits foreign private
data. Changing configuration during a pending approval fails closed.

Developer-operated APIs need `SECRETS_MASTER_KEY` for durable tool/approval turns, including keyless
local providers: the tool history still needs a bound private record. Plain nonthinking local text
can run without it. Missing required private storage fails before tool effects. Make/native desktop
startup creates or propagates its existing key; preserve that same key with the profile and database.
This is separate from a provider API credential, and no default replacement key is introduced.

Limits are256KiB per serialized private message and4MiB per session. Data follows conversation
lifecycle and cascades on deletion; it is not controlled by diagnostic retention. Oversized or invalid
required state is rejected without truncation/effects. Keep the existing profile/master key when
upgrading. Startup migration checks and disposable upgrade/restart regressions apply.

### Agent-Level Model Override

Each agent can also specify a free-form model override (no stored key):

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

> **Note:** `modelOverride` contains `provider` and `model` only. API keys are resolved from the env-var chain. `modelConfigId` takes precedence when both are set.

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
      "maxInputTokens": 16000,
      "maxOutputTokens": 2048,
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

| Field                    | Required | Description                                                                                                                                                                                                                                                                 |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxSteps`               | **Yes**  | Maximum agent reasoning steps (LLM turns) per request                                                                                                                                                                                                                       |
| `maxParallelTasks`       | **Yes**  | Maximum concurrent parallel tasks                                                                                                                                                                                                                                           |
| `timeoutMs`              | **Yes**  | Wall-time deadline for the entire run (ms). The harness propagates this into graph state so every node (LLM calls, tool dispatch) checks remaining time before starting work. Individual tool calls are capped at the lesser of `toolTimeoutMs` and the remaining deadline. |
| `toolTimeoutMs`          | No       | Per-tool-call timeout (ms); defaults to harness global                                                                                                                                                                                                                      |
| `maxTokens`              | No       | Cumulative token budget across the request                                                                                                                                                                                                                                  |
| `maxCostUnits`           | No       | Cumulative cost cap (provider-defined units)                                                                                                                                                                                                                                |
| `maxToolCallsTotal`      | No       | Maximum total tool calls across the entire request                                                                                                                                                                                                                          |
| `toolRateLimitPerMinute` | No       | Sliding-window rate limit per tool name (calls/min). Defaults to 30. Prevents a single tool from being hammered in rapid succession within one run.                                                                                                                         |

Budget warnings are emitted at 80% utilisation for `maxTokens`, `maxCostUnits`, and `maxToolCallsTotal`.

### Context Window

The context/token MVP branch applies admission before each conversational reasoning call, including
tool-loop iterations and approval resume. It is under verification; see the
[task and delivery status](tasks/agent-platform-context-optimisation.md).

| Field             | Default    | Description                                                                                                                  |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `maxInputTokens`  | `16000`    | Approximate input allowance for complete mapped messages and tool schemas; admission uses 90% of this value.                 |
| `maxOutputTokens` | `2048`     | Separate positive-integer completion allowance sent as SDK7 `maxOutputTokens`; native adapters serialize their own protocol. |
| `strategy`        | `truncate` | Both `truncate` and legacy `summarize` use atomic history groups plus existing working memory.                               |

The owner-approved16,000 default applies to absent/new settings. Explicitly saved budgets remain
unchanged, including the previous8,000 value; no automatic migration increases existing limits.
If a saved limit cannot fit required instructions and tools, explicitly adjust it through the existing
configuration API. Configure
input plus output below the selected model's capacity. Estimates are character-based, not exact token
counts, billing measurements or provider rate-limit guarantees. Auxiliary planner, critic-model,
sensor, DoD and connection-test calls are outside this conversational guard.

Configure these fields through the existing agent create/update API; no new settings screen is added.
An update uses the complete agent body, as before. Keep the explicit provider/model selection.
The input/output allowances are distinct from the cumulative `executionLimits.maxTokens` run budget.

The provider view retains system instructions, scoped working memory, the current request and all
active-turn tool effects. Older complete groups may be omitted without changing saved history.
An older pending approval group is omitted only with matching durable provenance; no approval or
result is invented. `summarize` does not enable a model-generated summary in this MVP.

If required context cannot fit, the application reports a context-budget error before that model call.
Reduce the input or configure a suitable allowance; earlier completed tool effects remain retained.
A model response stopped by its output limit is marked incomplete and its tool calls are not executed.
[Diagnostic reports](development/diagnostics.md) distinguish estimates, local admission and real attempts.

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

MCP (Model Context Protocol) servers extend agent capabilities with tools. This local MVP
connects to a server you have reviewed and installed, or an existing Streamable HTTP endpoint.
It does not install packages, provision servers, or provide interactive OAuth sign-in.

### Import, Save and Test

In the MCP dashboard, import an endpoint URL, a single configuration object, a named server map,
or a `mcpServers` wrapper. Review the parsed entries and validation errors before saving.
Unsupported fields and environment interpolation such as `${TOKEN}` are rejected.
Saving, listing and assigning a server do not start a process or make a connection. Explicit
**Test** opens the saved connection, performs the MCP handshake and tool discovery, applies the
same trust filter as chat, then closes it. Test does not call a tool. Starting a stdio server still
executes that server's code: use software you trust, with only the credentials it needs.

Install both the stdio executable and its server package on the **API execution host** first.
For the native app that is the managed local backend's host; with Docker it is the API container,
so a path installed only on your laptop may not exist there. Commands run without a shell, with
an argument array and explicit environment values plus the SDK's minimal default environment.
This connection is not a sandbox for untrusted server code.

### Creating an MCP Server

Replace the example path with a reviewed server already installed on the API execution host;
`node` must also be available to that host. This request saves configuration only:

```bash
curl -X POST http://localhost:3000/v1/mcp-servers \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Reviewed local MCP",
    "transport": "stdio",
    "command": "node",
    "args": ["/absolute/path/to/reviewed-server.js"]
  }'
```

Then explicitly test the returned ID with `POST /v1/mcp-servers/:id/test`. The result distinguishes
discovered tools, eligible tools and trust-policy rejections. A successful connection with zero
eligible tools does not give an agent usable tools. Repair a failed or outdated configuration,
save it, and test again; a result is evidence for its recorded configuration revision.

### Transport Types

| Transport         | Fields                     | Meaning                                                                                                    |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `stdio`           | `command`, optional `args` | Preinstalled executable on the API execution host                                                          |
| `streamable-http` | `url`                      | MCP Streamable HTTP endpoint                                                                               |
| `http`            | `url`                      | Input alias saved as `streamable-http`                                                                     |
| `sse`             | `url`                      | Retained legacy configuration alias using the Streamable HTTP client; not support for the old SSE protocol |

HTTP endpoints must use HTTPS, or local HTTP on `localhost`, `127.x.x.x`, `[::1]` or
`host.docker.internal`. URL user information, query strings, fragments and interpolation are
rejected. Redirects are not followed. Supply credentials through the credential fields rather
than embedding them in a URL. A legacy SSE-only endpoint requires a compatible Streamable HTTP
endpoint; changing its label alone does not change its protocol.

### Credentials and Duplication

Create and update bodies accept `credentials.env` for stdio or `credentials.headers` for HTTP.
Saved values use encrypted secret storage; public responses expose field names and boolean
`credentialStatus` flags, never the values or secret references. Keep sensitive values out of
command arguments and display names, which are public configuration.

On edit, omit a credential field to retain it, provide a string to replace it, or provide `null`
to clear it. An empty string replaces the value with an empty string; it does not clear the field.
For example, `"credentials": { "headers": { "Authorization": null } }` clears that header.
When switching transports, explicitly clear incompatible stored fields. Reserved environment
variables and transport-managed headers are rejected, as are case-insensitive duplicate header
names. If the API cannot access its encryption key, fix that setup before saving secrets.

Duplicate copies configuration and credential field names, but never copies credential values.
Re-enter the needed values on the copy and test it. `needsReconfiguration` also identifies unsafe
or unsupported legacy configuration; it is not a live connection-health indicator.

### Assigning to Agents

MCP servers are assigned to agents through `allowedMcpServerIds`:

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

Assignment permits connection and discovery during chat; it does not bypass trust checks,
Ask/Block policy or approval. Approval is bound to the current server configuration and tool
definition. If those change, start a new request and review it again. If a tool call loses its
response after dispatch, the action may already have happened: the turn stops with
`MCP_OUTCOME_UNKNOWN` and does not automatically retry or continue with another model/tool call.
Inspect the server's actual effect before starting a new request.

See [MCP API endpoints](api-reference.md#mcp-servers) for request and response details.

---

## Skill Configuration

Skills combine a name, goal, constraints, and tools:

```bash
curl -X POST http://localhost:3000/v1/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Web Research",
    "goal": "Search and summarize web content",
    "description": "Searches the web and summarizes findings",
    "hint": "Use when user asks about current events or external information",
    "constraints": ["Only use approved sources", "Limit to 500 words"],
    "tools": ["<tool-id>"]
  }'
```

| Field          | Required | Description                                       |
| -------------- | -------- | ------------------------------------------------- |
| `name`         | **Yes**  | Display name for the skill                        |
| `goal`         | **Yes**  | What the skill achieves (full instructions body)  |
| `description`  | No       | One-line summary (used as stub in system prompt)  |
| `hint`         | No       | When-to-use guidance (helps model decide)         |
| `constraints`  | **Yes**  | Rules the agent must follow when using this skill |
| `tools`        | **Yes**  | Tool IDs available to this skill                  |
| `outputSchema` | No       | JSON schema for structured skill output           |

> **Lazy loading:** Only `name`, `description`, and `hint` are injected into the system prompt. The model calls `sys_get_skill_detail` to fetch the full `goal` and `constraints` before using a skill. If `description` is not set, the first ~100 characters of `goal` are used as the stub.

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
