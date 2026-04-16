# Architecture

## Overview

Agent Platform is a composable agent harness built with Node.js, TypeScript, and LangGraph. It treats the LLM as an untrusted, non-deterministic dependency inside a controlled execution system.

The platform follows clean architecture principles: dependencies point inward, control flows outward.

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    apps/web (Next.js 15)             │
│               Chat UI + BFF proxy (:3001)            │
└──────────────────────┬──────────────────────────────┘
                       │ /api/chat → POST /v1/chat/stream
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
   ┌────▼─────┐
   │mcp-adapter│
   │ (MCP tool │
   │ bridge)   │
   └───────────┘
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

| Package                | Role                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `contracts`            | Zod schemas shared between all layers (agents, skills, tools, sessions, plans)      |
| `db`                   | Drizzle ORM + better-sqlite3; migrations; AES-256-GCM secret storage                |
| `harness`              | LangGraph-based agent execution graph (`buildGraph.ts`) and state (`graphState.ts`) |
| `model-router`         | OpenAI provider routing via Vercel AI SDK; provider+model+key configurable          |
| `mcp-adapter`          | MCP client lifecycle; transforms MCP tools to contract tools                        |
| `plugin-sdk`           | Plugin interface + hook dispatcher (6 lifecycle hooks)                              |
| `planner`              | LLM-driven planning layer producing structured JSON output                          |
| `logger`               | Structured logging with context propagation                                         |
| `agent-validation`     | Agent schema validation                                                             |
| `plugin-session`       | Session plugin implementation                                                       |
| `plugin-observability` | Logging/tracing plugin                                                              |

## Data Flow

```
User message
  → Next.js BFF (/api/chat)
    → API POST /v1/chat/stream
      → harness (buildGraph)
        → plugin hooks (onSessionStart, onTaskStart, onPromptBuild)
          → model-router → LLM
            → tool calls → mcp-adapter / inline tools
              → plugin hooks (onToolCall, onTaskEnd)
                → streaming response back to UI
```

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

For the full architecture philosophy, see `docs/planning/architecture.md`.
