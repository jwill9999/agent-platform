# Architecture

## Overview

Agent Platform is a composable agent harness built with Node.js, TypeScript, and LangGraph. It treats the LLM as an untrusted, non-deterministic dependency inside a controlled execution system.

The platform follows clean architecture principles: dependencies point inward, control flows outward.

For the complete message lifecycle (request → security checks → LLM → tool dispatch → response), see **[Message Flow](architecture/message-flow.md)**.

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    apps/web (Next.js 15)             │
│               Chat UI + BFF proxy (:3001)            │
└──────────────────────┬──────────────────────────────┘
                       │ /api/chat → POST /v1/chat
┌──────────────────────▼──────────────────────────────┐
│                    apps/api (Express)                 │
│               REST JSON API (:3000)                  │
│  ┌────────────────────────────────────────────────┐  │
│  │  interfaces/http  →  application  →  infra/db  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐  ┌───────────┐  ┌──────────┐
   │ harness  │  │model-router│  │    db    │
   │(LangGraph│  │ (Vercel AI │  │ (Drizzle │
   │  graph)  │  │   SDK)     │  │ + SQLite)│
   └────┬─────┘  └───────────┘  └──────────┘
        │
   ┌────┼──────────┐
   ▼               ▼
┌───────────┐ ┌──────────┐
│mcp-adapter│ │ security │
│ (MCP tool │ │ (guards, │
│  bridge)  │ │  scans)  │
└───────────┘ └──────────┘
```

## Package Dependency Graph

```
apps/api
  ├── packages/db              (Drizzle ORM, SQLite)
  ├── packages/contracts       (Zod schemas)
  ├── packages/harness         (LangGraph agent graph)
  ├── packages/model-router    (LLM provider routing)
  ├── packages/planner         (LLM planning layer)
  ├── packages/logger          (Structured logging)
  └── packages/agent-validation

apps/web
  └── packages/contracts

packages/harness
  ├── packages/contracts
  ├── packages/model-router
  ├── packages/mcp-adapter
  ├── packages/plugin-sdk
  ├── packages/planner
  └── packages/logger

packages/plugin-sdk
  └── packages/contracts

packages/mcp-adapter
  └── packages/contracts
```

## Shared Packages

| Package                | Role                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `contracts`            | Zod schemas shared between all layers (agents, skills, tools, sessions, plans)                       |
| `db`                   | Drizzle ORM + better-sqlite3; migrations; AES-256-GCM secret storage                                 |
| `harness`              | LangGraph-based agent execution graph; security guards (injection, credential, MCP trust, path jail) |
| `model-router`         | OpenAI provider routing via Vercel AI SDK; provider+model+key configurable                           |
| `mcp-adapter`          | MCP client lifecycle; transforms MCP tools to contract tools                                         |
| `plugin-sdk`           | Plugin interface + hook dispatcher (6 lifecycle hooks)                                               |
| `planner`              | LLM-driven planning layer producing structured JSON output                                           |
| `logger`               | Structured logging with context propagation                                                          |
| `agent-validation`     | Agent schema validation                                                                              |
| `plugin-session`       | Session plugin implementation                                                                        |
| `plugin-observability` | Logging/tracing plugin                                                                               |

## Data Flow

```
User message
  → Next.js BFF (/api/chat)
    → API POST /v1/chat (NDJSON stream)
      → Zod validate → load session → session lock
        → buildAgentContext
          → 🔒 MCP Trust Guard filters tools
          → 🔒 Security reinforcement on system prompt
        → buildWindowedContext (system + history within budget)
          → harness ReAct loop
            → LLM streamText (model-router) + budget checks
              → tool calls
                → 🔒 Allowlist → PathJail → MCP/native dispatch
                → 🔒 Injection scan → credential scan → wrap result
              → 🔒 Loop detection → step limit
            → streaming NDJSON text/tool_result events to UI
      → persist messages → release lock → close MCP sessions
```

> For the full lifecycle with all security checkpoints and error handling, see **[Message Flow](architecture/message-flow.md)**.

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

| Phase         | Guards                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Agent boot    | MCP Trust Guard (shadowing, injection, schemas), security prompt suffix |
| Per-turn      | Wall-time deadline check, token/cost budget limits, abort signal        |
| Pre-dispatch  | Agent allowlist, PathJail (mount enforcement), cumulative tool limit    |
| Post-dispatch | Injection scan, credential leak scan, untrusted content wrapping        |
| Graph level   | Loop detection (3 identical calls), max steps, deadline routing guard   |

See the full guard map in **[Message Flow § Security Checkpoints](architecture/message-flow.md#3-security-checkpoints)**.

## Streaming Protocol

The chat response uses **NDJSON** (`application/x-ndjson`). Each line is a JSON event:

| Event            | When                         |
| ---------------- | ---------------------------- |
| `text`           | LLM text delta               |
| `thinking`       | LLM reasoning delta          |
| `tool_result`    | Tool execution complete      |
| `error`          | Fatal or budget limit hit    |
| `stream_aborted` | Client disconnect or timeout |

## Session Locking

In-process mutex per `sessionId`. Returns `409 SESSION_BUSY` if a second request arrives for the same session while one is in progress. The lock is always released in the `finally` block.

For the full architecture philosophy, see `docs/planning/architecture.md`.
