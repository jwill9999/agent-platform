# Agent Platform Architecture Decision Record (Detailed + Frontend)

## 1. Purpose

Comprehensive ADR for building a composable agent platform with UI,
runtime, and extensibility.

------------------------------------------------------------------------

## 2. Frontend Architecture (NEW)

### Strategy

Do NOT build from scratch. Use composable SDK + component libraries.

### Recommended Stack

-   Framework: Next.js (TypeScript)
-   State/Streaming: Vercel AI SDK (`useChat`)
-   UI Components: assistant-ui OR AI Elements (shadcn-based)

### Responsibilities

#### Chat Interface

-   Streaming responses
-   Code blocks
-   Tool outputs (structured)
-   Errors
-   Optional "thinking" display (gated)

#### Configuration UI

-   Skill Factory
-   Template (agent scope) management
-   MCP Tool configuration
-   Plugin enable/disable
-   Model + API key configuration

### Key Principle

Frontend = rendering layer ONLY

-   No agent logic
-   No planning logic
-   No orchestration

------------------------------------------------------------------------

### Data Flow

User Input → useChat() → API → Backend Harness\
Backend → stream → UI renders components

------------------------------------------------------------------------

### UI Output Types

``` ts
type Output =
  | { type: "text"; content: string }
  | { type: "code"; language: string; content: string }
  | { type: "tool_result"; data: any }
  | { type: "error"; message: string }
  | { type: "thinking"; content: string };
```

------------------------------------------------------------------------

### Alternative Options

-   Chatbot UI → fastest MVP
-   LangGraph Agent Chat UI → reference for orchestration UI
-   LlamaIndex Chat UI → lightweight component approach

------------------------------------------------------------------------

## 3. Core Architecture (unchanged summary)

Backend = Harness + Runtime\
Execution = LangGraph\
Tools = MCP\
Extensibility = Plugin system

------------------------------------------------------------------------

## 4. Key Decisions (updated)

-   Use Vercel AI SDK for frontend state/streaming
-   Use assistant-ui / AI Elements for UI components
-   Keep frontend stateless and orchestration-free
-   Backend remains single source of truth

------------------------------------------------------------------------

## 5. Next Steps

-   Define API contracts between FE and backend
-   Map backend outputs → UI components
-   Build initial chat UI
-   Build configuration panels (skills/templates/tools/plugins)
