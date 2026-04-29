# Architecture

## Overview

Agent Platform is a composable agent harness built with Node.js, TypeScript, and LangGraph. It treats the LLM as an untrusted, non-deterministic dependency inside a controlled execution system.

The platform follows clean architecture principles: dependencies point inward, control flows outward.

For the complete message lifecycle (request → security checks → LLM → tool dispatch → response), see **[Message Flow](architecture/message-flow.md)**.

## System Diagram

```mermaid
flowchart TB
    Web["apps/web<br/>Next.js chat UI + BFF<br/>:3001"]
    Api["apps/api<br/>Express REST API<br/>:3000"]

    subgraph ApiLayers["API Layers"]
        Http["interfaces/http<br/>routes + middleware"]
        App["application<br/>use cases"]
        Infra["infrastructure<br/>db + terminal + MCP"]
        Http --> App --> Infra
    end

    subgraph Runtime["Runtime Packages"]
        Harness["packages/harness<br/>LangGraph execution graph"]
        Router["packages/model-router<br/>provider/model/key routing"]
        Db["packages/db<br/>Drizzle + SQLite + secrets"]
        Mcp["packages/mcp-adapter<br/>MCP sessions + tool calls"]
        Security["security modules<br/>PathJail, HITL, guards"]
        Plugins["plugin packages<br/>session + observability"]
    end

    Web -->|"/api/chat → POST /v1/chat"| Api
    Api --> ApiLayers
    ApiLayers --> Harness
    ApiLayers --> Router
    ApiLayers --> Db
    Harness --> Mcp
    Harness --> Security
    Harness --> Plugins
    Harness --> Router
    Harness --> Db
```

## Package Dependency Graph

```mermaid
flowchart LR
    Api["apps/api"] --> Db["packages/db"]
    Api --> Contracts["packages/contracts"]
    Api --> Harness["packages/harness"]
    Api --> Router["packages/model-router"]
    Api --> Planner["packages/planner"]
    Api --> Logger["packages/logger"]
    Api --> Validation["packages/agent-validation"]

    Web["apps/web"] --> Contracts

    Harness --> Contracts
    Harness --> Router
    Harness --> Mcp["packages/mcp-adapter"]
    Harness --> PluginSdk["packages/plugin-sdk"]
    Harness --> Planner
    Harness --> Logger

    PluginSdk --> Contracts
    Mcp --> Contracts
    Validation --> Contracts
```

## Shared Packages

| Package                | Role                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `contracts`            | Zod schemas shared between all layers (agents, skills, tools, sessions, plans)                       |
| `db`                   | Drizzle ORM + better-sqlite3; migrations; AES-256-GCM secret storage                                 |
| `harness`              | LangGraph-based agent execution graph; security guards (injection, credential, MCP trust, path jail) |
| `model-router`         | OpenAI provider routing via Vercel AI SDK; provider+model+key configurable                           |
| `mcp-adapter`          | MCP client lifecycle; transforms MCP tools to contract tools                                         |
| `plugin-sdk`           | Plugin interface + hook dispatcher (7 lifecycle hooks, including DoD override)                       |
| `planner`              | LLM-driven planning layer producing structured JSON output                                           |
| `logger`               | Structured logging with context propagation                                                          |
| `agent-validation`     | Agent schema validation                                                                              |
| `plugin-session`       | Session plugin implementation                                                                        |
| `plugin-observability` | Logging/tracing plugin plus an in-memory, session-scoped observability store                         |

## Data Flow

```mermaid
flowchart TD
    User["User message"] --> Bff["Next.js BFF<br/>/api/chat"]
    Bff --> ApiChat["API POST /v1/chat<br/>NDJSON stream"]
    ApiChat --> Validate["Zod validate<br/>load session<br/>acquire session lock"]
    Validate --> Context["buildAgentContext"]
    Context --> Obs["Register observability plugin<br/>session-scoped store"]
    Context --> Trust["MCP Trust Guard filters tools"]
    Context --> Prompt["Append security reinforcement"]
    Prompt --> Window["buildWindowedContext<br/>system + history within budget"]
    Window --> React["Harness ReAct loop"]
    React --> Llm["LLM streamText<br/>model-router + budget checks"]
    Llm -->|"tool calls"| Dispatch["Tool dispatch"]
    Dispatch --> Allow["Allowlist + risk policy + HITL"]
    Allow --> Jail["PathJail + bash workspace policy"]
    Jail --> Execute["MCP/native/system tool execution"]
    Execute --> Scan["Injection scan<br/>credential scan<br/>untrusted wrapper"]
    Scan --> React
    Llm -->|"draft answer"| Critic["Critic evaluator<br/>accept or revise"]
    Critic --> Dod["Definition-of-Done check"]
    Dod --> Persist["Persist assistant/tool messages"]
    Persist --> Cleanup["Release lock<br/>close MCP sessions"]
    Cleanup --> Ui["Stream end to UI"]
```

> For the full lifecycle with all security checkpoints and error handling, see **[Message Flow](architecture/message-flow.md)**.

## Observability

The API owns a process-local observability store keyed by `sessionId` and `runId`. A global `plugin-observability` instance records lifecycle events into that store during each chat run, and the three zero-risk built-in observability tools read from the same store through a session-bound executor context.

This keeps observability queryable by the agent at runtime without allowing cross-session reads. Tool access is jailed by closure-bound `sessionId`/`runId`, not by model-supplied parameters.

## API Clean Architecture

The API app (`apps/api`) follows a layered architecture:

| Directory              | Layer          | Responsibility                               |
| ---------------------- | -------------- | -------------------------------------------- |
| `src/interfaces/http/` | Interface      | Express routes, controllers, middleware      |
| `src/application/`     | Application    | Use cases, orchestration                     |
| `src/infrastructure/`  | Infrastructure | Database access, MCP clients, external calls |

**Rules:**

- Routes are thin — delegate to application layer
- Application layer orchestrates but doesn't know about HTTP
- Infrastructure implements interfaces defined by inner layers

## Layer Responsibility Model

| Layer                         | Question                  |
| ----------------------------- | ------------------------- |
| Harness (Control Plane)       | Are you allowed?          |
| Runtime (Execution Engine)    | What happens next?        |
| Tooling (Capability Boundary) | What action can be taken? |
| Services (Domain Authority)   | What is correct?          |
| Data (Source of Truth)        | What is true?             |

## Security

The harness treats the LLM and external tool outputs as **untrusted**. Security guards execute at multiple phases:

| Phase         | Guards                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- |
| Agent boot    | MCP Trust Guard (shadowing, injection, schemas), security prompt suffix                   |
| Per-turn      | Wall-time deadline check, token/cost budget limits, abort signal                          |
| Pre-dispatch  | Agent allowlist, PathJail (mount enforcement), cumulative tool limit, per-tool rate limit |
| Post-dispatch | Injection scan, credential leak scan, untrusted content wrapping                          |
| Graph level   | Loop detection (3 identical calls), max steps, deadline routing guard                     |

See the full guard map in **[Message Flow § Security Checkpoints](architecture/message-flow.md#3-security-checkpoints)**.

## Lazy Skill Loading

Skills are **not** injected in full into the system prompt. Instead, the harness emits lightweight **stubs** (name, description, hint) and provides a `sys_get_skill_detail` system tool. The model calls this tool on demand to fetch full instructions before using a skill.

| Aspect         | Detail                                                            |
| -------------- | ----------------------------------------------------------------- |
| Stub format    | `- **id** (name): description` + optional hint                    |
| Full fetch     | `sys_get_skill_detail({ skill_id })` → goal + constraints + tools |
| State tracking | `loadedSkillIds` (append-only) in graph state                     |
| Governor       | Warn at 3 loads of same skill; hard error at 5 (loop detection)   |
| Token savings  | ~70% reduction for multi-skill agents                             |

Schema fields: `description` (one-liner for stub) and `hint` (when-to-use) are optional on the Skill contract. When absent, `goal` is truncated to ~100 chars for the stub.

For the full implementation guide (architecture decisions, data flow, governor logic, error cases), see **[Lazy Skill Loading](architecture/lazy-skill-loading.md)**.

## Streaming Protocol

The chat response uses **NDJSON** (`application/x-ndjson`). Each line is a JSON event:

| Event               | When                                     |
| ------------------- | ---------------------------------------- |
| `text`              | LLM text delta                           |
| `thinking`          | LLM reasoning delta                      |
| `tool_result`       | Tool execution complete                  |
| `approval_required` | Tool execution paused for human approval |
| `error`             | Fatal or budget limit hit                |
| `stream_aborted`    | Client disconnect or timeout             |

## Session Locking

In-process mutex per `sessionId`. Returns `409 SESSION_BUSY` if a second request arrives for the same session while one is in progress. The lock is always released in the `finally` block.

## Capability Map

This JSON map is intentionally compact and agent-readable. Update it when new first-class runtime capabilities are added.

```json
{
  "runtime": {
    "execution": ["react_loop", "plan_mode_stub", "critic_loop", "definition_of_done_gate"],
    "streaming": ["ndjson_text", "thinking", "tool_result", "approval_required", "error"],
    "state": ["sqlite_sessions", "session_lock", "windowed_context", "workspace_storage"]
  },
  "tooling": {
    "zero_risk": [
      "generate_uuid",
      "get_current_time",
      "json_parse",
      "json_stringify",
      "regex_match",
      "regex_replace",
      "count_tokens",
      "base64_encode",
      "base64_decode",
      "hash_string",
      "template_render"
    ],
    "filesystem": [
      "read_file",
      "write_file",
      "list_files",
      "file_exists",
      "file_info",
      "find_files",
      "append_file",
      "copy_file",
      "create_directory",
      "download_file"
    ],
    "runtime": ["bash"],
    "network": ["http_request"],
    "observability": ["query_logs", "query_recent_errors", "inspect_trace"],
    "extension": ["mcp_tools", "registry_tools", "lazy_skill_loading"]
  },
  "safety": {
    "pre_execution": ["agent_allowlist", "risk_tier_policy", "human_in_the_loop"],
    "filesystem": ["PathJail", "bash_workspace_policy", "workspace_relative_paths"],
    "network": ["url_guard", "outbound_body_secret_scan"],
    "post_execution": ["prompt_injection_scan", "credential_scan", "untrusted_output_wrap"],
    "graph": ["max_steps", "max_tokens", "max_cost", "tool_rate_limit", "loop_detection"]
  },
  "known_missing": [
    "native_patch_tool",
    "background_process_manager",
    "browser_automation_tool",
    "scheduled_task_runner",
    "persistent_semantic_memory",
    "multi_agent_orchestration",
    "git_pr_ci_feedback_loop"
  ]
}
```

For the full architecture philosophy, see `docs/planning/architecture.md`.
