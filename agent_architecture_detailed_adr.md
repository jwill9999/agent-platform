# Agent Platform Architecture Decision Record (Detailed)

## 1. Purpose

This document captures the **full architectural decisions** for the
Agent Platform MVP.\
It is intended to be: - A **source of truth** - Input for **agent-driven
task decomposition** - A foundation for **implementation planning**

------------------------------------------------------------------------

## 2. Architectural Vision

Build a:

> **Composable, extensible AI execution platform (Agent OS)**

Key characteristics: - Deterministic runtime - LLM-driven planning -
Strong governance boundaries - Plugin-based extensibility - UI-driven
configuration

------------------------------------------------------------------------

## 3. Core Principles

1.  **Controlled execution over autonomy**
2.  **Agents are ephemeral (constructed at runtime)**
3.  **Standards at the boundary, control at the core**
4.  **Skills define behaviour, tools execute capability**
5.  **Templates define governance**
6.  **Plugins extend, never control**
7.  **Strict validation before execution**
8.  **Everything typed (TypeScript-first)**

------------------------------------------------------------------------

## 4. System Architecture

### High-Level Layers

Frontend (UI) Backend (Harness + API) Execution (LangGraph) Tool Layer
(MCP) Plugin Layer (cross-cutting)

------------------------------------------------------------------------

## 5. Backend (Harness + Runtime)

Responsibilities:

-   Planner (LLM-driven)
-   Validation Layer
-   Agent Factory
-   Plugin Manager
-   Model Router
-   Tool Adapter (MCP)
-   Execution Limits Enforcement

------------------------------------------------------------------------

## 6. Agent Model

Agents are NOT persisted.

Agent = Template + Skill + Tools + Scope

Constructed dynamically via Agent Factory.

------------------------------------------------------------------------

## 7. Agent Templates (Scopes)

Templates define:

-   Allowed Skills
-   Allowed Tools
-   Execution Limits
-   Optional Model Override

Example:

``` ts
type Template = {
  id: string;
  allowedSkills: string[];
  allowedTools: string[];
  limits: ExecutionLimits;
}
```

------------------------------------------------------------------------

## 8. Skills

### Format

-   Markdown-based
-   Parsed into structured object

### Responsibilities

-   Define behaviour
-   Define constraints
-   Suggest tools
-   Define output expectations

### Internal Interface

``` ts
type Skill = {
  id: string;
  goal: string;
  constraints: string[];
  tools: string[];
  outputSchema?: object;
}
```

------------------------------------------------------------------------

## 9. Tools (MCP)

### Decision

Use MCP as the **external standard**

### Internal Adaptation

``` ts
type Tool = {
  id: string;
  inputSchema: object;
  execute: (input: unknown) => Promise<unknown>;
}
```

### Key Rule

Tools are assigned to **templates**, not agents.

------------------------------------------------------------------------

## 10. Plugin System

### Decision

Custom plugin interface (no external standard adopted)

### Interface

``` ts
interface Plugin {
  name: string;
  version: string;
  hooks?: Partial<PluginHooks>;
}
```

### Hooks

-   onSessionStart
-   onTaskStart
-   onPromptBuild
-   onToolCall
-   onTaskEnd
-   onError

------------------------------------------------------------------------

### Plugin Types

-   Memory
-   Observability
-   Context Injection
-   Tool Extension

------------------------------------------------------------------------

### Key Rule

Plugins: - CAN inject context, log, store data - CANNOT bypass
validation or execution logic

------------------------------------------------------------------------

## 11. Planner + Validation

### Planner (LLM)

Outputs structured JSON plan

### Validation Layer

Enforces: - Skill exists - Tool allowed by template - Execution limits
respected

------------------------------------------------------------------------

## 12. Agent Factory

Converts:

Template + Skill + Tools → LangGraph Node

------------------------------------------------------------------------

## 13. Execution (LangGraph)

Use LangGraph for: - DAG execution - Parallel tasks - State handling -
Retry + checkpointing

------------------------------------------------------------------------

## 14. UI (Frontend)

### Responsibilities

1.  Chat Interface
    -   Streaming responses
    -   Code blocks
    -   Tool outputs
    -   Errors
    -   Optional thinking display
2.  Configuration Interface
    -   Skill Factory
    -   Template management
    -   Tool (MCP) configuration
    -   Plugin enable/disable
    -   Model configuration

------------------------------------------------------------------------

## 15. Model Layer

### Features

-   Multiple providers
-   Per-user API keys
-   Optional per-template overrides

### Rule

Model is a **dependency**, not part of agent definition.

------------------------------------------------------------------------

## 16. TypeScript-First Design

All core interfaces defined in TypeScript:

-   Skill
-   Tool
-   Template
-   Plugin
-   Plan
-   Task
-   Context objects

Runtime validation via: - Zod or similar

------------------------------------------------------------------------

## 17. Observability

### Decision

Plugin-based

### Minimum Logging

-   Skills used
-   Tools used
-   Execution path
-   Errors

------------------------------------------------------------------------

## 18. Memory

### Decision

Plugin-based

### MVP

-   Session memory only

### Future

-   Vector DB
-   External systems

------------------------------------------------------------------------

## 19. Execution Safety

Must include:

-   Max steps
-   Max parallel tasks
-   Timeout
-   Cost/token limits

------------------------------------------------------------------------

## 20. Data Storage (MVP)

Store:

-   Skills
-   Templates
-   Tools (MCP configs)
-   Plugins config
-   User configs
-   Chat sessions

------------------------------------------------------------------------

## 21. Key Architectural Decisions

1.  Use LangGraph for orchestration
2.  Use MCP for tools
3.  Define internal Skill standard (markdown + typed)
4.  Build custom Plugin SDK
5.  Agent Factory for dynamic construction
6.  Templates for governance (no static agents)
7.  Strict validation layer
8.  Plugin-based memory + observability
9.  TypeScript-first architecture
10. UI-driven configuration system

------------------------------------------------------------------------

## 22. Next Steps (for agent breakdown)

-   Define DB schema
-   Define API contracts
-   Build Plugin SDK
-   Implement Skill parser
-   Implement MCP adapter
-   Implement Agent Factory
-   Implement Planner schema
-   Build UI scaffolding
