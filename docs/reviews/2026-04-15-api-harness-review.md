# Code Review Report

**Date:** 2026-04-15  
**Scope:** `apps/api/`, `packages/harness/`, `packages/contracts/`, `packages/db/`, `packages/planner/`, `packages/model-router/`, `packages/mcp-adapter/`, `packages/plugin-sdk/`, `packages/plugin-session/`, `packages/plugin-observability/`, `packages/agent-validation/` — evaluated against Architecture ADR and 13 beads issues (2 epics + 11 tasks).  
**Reviewer:** ReviewBot (AI Harness & Runtime Specialist)

---

## Executive Summary

The codebase is in a **healthy Structured MVP** state with clean separation across 10 shared packages and a thin API surface. Epic 1 (Agent Schema & Factory) is complete and the foundation is sound: contracts are Zod-driven, the plugin SDK is well-isolated, MCP session lifecycle is robust, and allowlist enforcement is in place. However, the current harness graph is a **plan-execute stub** — the core runtime loop (LLM reasoning, tool dispatch, ReAct wiring) that the Architecture ADR demands does not yet exist. The 10 planned beads tasks form a precise, dependency-ordered path from current state to the Architecture ADR's "Transitional → Production" tier, but several architectural gaps and risks in the existing code will amplify in difficulty if not addressed at each task boundary.

---

## Current State vs Architecture ADR Mapping

| ADR Layer                      | Current State                                                 | Target (Post-Epic 2 + 3)                                                 | Gap                                                             |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Harness (Control Plane)**    | Factory builds context, allowlists enforced, plugins resolved | Plugin hooks fire during execution, limits enforced, HITL path available | Plugin dispatch not wired; limits only enforce `maxSteps`       |
| **Runtime (Execution Engine)** | Stub plan-execute graph; no LLM invocation                    | ReAct loop with LLM reasoning + tool dispatch + streaming output         | **Major gap** — no model invocation, no tool execution, no loop |
| **Tooling Layer**              | MCP adapter maps tools, `callToolAsOutput()` exists           | Tool dispatch node validates + executes via allowlist                    | Tool dispatch node doesn't exist yet                            |
| **Services (Domain)**          | DB CRUD, mappers, seed                                        | Conversation history, message store                                      | No message persistence                                          |
| **Data (Source of Truth)**     | SQLite schema, AES-256-GCM secrets                            | + messages table, plan storage                                           | Messages table missing                                          |

---

## Areas of Success

| #   | Area                              | Detail                                                                                                                                                                                                                                                                              | Files                                                                                                    |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | **Contract-first design**         | All shared types are Zod schemas in a single `contracts` package. API routes, DB mappers, factory, and planner all parse through these schemas. This is exactly what the ADR prescribes — contracts as the "single source of truth for shared types."                               | `packages/contracts/src/`                                                                                |
| 2   | **Clean layer separation in API** | Route handlers are thin: `parseBody()` → DB call → JSON response. No business logic in middleware. Error middleware strips internal details. Follows HTTP → application → infrastructure direction.                                                                                 | `apps/api/src/infrastructure/http/v1/v1Router.ts`, `apps/api/src/infrastructure/http/errorMiddleware.ts` |
| 3   | **Agent Factory composition**     | `buildAgentContext()` cleanly assembles runtime context from DB, MCP sessions, plugins, and model config without leaking infrastructure concerns. `destroyAgentContext()` provides deterministic cleanup.                                                                           | `packages/harness/src/factory.ts`                                                                        |
| 4   | **MCP session robustness**        | Parallel open with `Promise.allSettled`, graceful degradation on connection failure, reconnect support, error-swallowing `closeAll()`. This is production-quality lifecycle management.                                                                                             | `packages/mcp-adapter/src/manager.ts`                                                                    |
| 5   | **Plugin SDK design**             | Hooks are observer-only (can't mutate execution context), dispatched sequentially. `PromptBuildContext` is read-only. `ToolCallContext` fires after allowlist check. This prevents plugins from becoming a policy bypass vector — aligned with ADR's "harness decides if, not how." | `packages/plugin-sdk/src/hooks.ts`, `packages/plugin-sdk/src/contexts.ts`                                |
| 6   | **Secret handling**               | AES-256-GCM envelope encryption with `key_version` for rotation. Secrets never stored in plaintext. API keys resolved via gated chain — legacy env blocked unless opted in.                                                                                                         | `packages/db/src/crypto/envelope.ts`, `packages/model-router/src/resolveOpenAiApiKey.ts`                 |
| 7   | **Allowlist enforcement**         | `isToolExecutionAllowed()` parses composite MCP tool IDs (`serverId:toolName`) and checks both plain and MCP allowlists. Deny-list wins in plugin resolution. This is the "tool allowlisting required" principle from the ADR.                                                      | `packages/agent-validation/src/allowlists.ts`                                                            |
| 8   | **Test coverage for foundations** | 114 unit tests, all passing, across 12 packages. Factory tests verify context assembly, plugin resolution, MCP degradation. Planner tests cover JSON parse + schema + policy validation. Graph tests verify step limits.                                                            | All `test/` directories                                                                                  |

---

## Areas Requiring Improvement

| #   | Severity  | Area                                                 | Finding                                                                                                                                                                                                                                                                                                                                                                 | Recommendation                                                                                                                                                                                                                                                                                                                                                       | Files                                                                                                   |
| --- | --------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | 🔴 High   | **Runtime: no LLM invocation path**                  | The harness graph currently only executes a stub plan by calling `executeTool(toolId)` with a string. There is no LLM reasoning, no tool-call intent parsing, no ReAct loop. The `/v1/chat/stream` endpoint bypasses the harness entirely — it's a raw OpenAI proxy with no governance. This is the ADR's "Prototype" tier where "model + inline logic, no separation." | **This is the primary focus of Epic 2 (`agent-platform-n0l`).** Task `agent-platform-9v1` (LLM reasoning node) is correctly identified as the unblocked starting point. The existing `buildGraph.ts` will need significant restructuring — the current plan-execute architecture needs to coexist with the new ReAct loop as specified in task `agent-platform-40r`. | `packages/harness/src/buildGraph.ts`, `apps/api/src/infrastructure/http/v1/v1Router.ts` (lines 233–265) |
| 2   | 🔴 High   | **Error middleware leaks internal details**          | The 500 catch-all in `errorMiddleware.ts` returns `err.message` directly to the client: `const message = err instanceof Error ? err.message : 'Internal error'`. For unhandled errors (stack traces, SQL errors, MCP connection strings), this may expose internal system information. The ADR states: "error middleware strips internal details before responding."    | Replace with a generic message for production. Log the full error server-side. Consider: `res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } })` and log `err` via the structured logger.                                                                                                                             | `apps/api/src/infrastructure/http/errorMiddleware.ts` (lines 29–35)                                     |
| 3   | 🔴 High   | **`/v1/chat/stream` violates layered architecture**  | The streaming endpoint reads `model` from the request body, resolves an API key, and calls OpenAI directly — bypassing the harness, agent factory, plugin hooks, and all governance. Any user can specify any model. There's no agent context, no allowlist check, no execution limits. This is exactly the ADR anti-pattern: "Runtime becomes business layer."         | **Task `agent-platform-5pe` (Session-aware chat endpoint) explicitly replaces this.** Until then, document this endpoint as "ungoverned pass-through" and consider adding a deprecation header. The replacement flow: `sessionId → agent → factory → harness graph → streaming output` is correctly specified.                                                       | `apps/api/src/infrastructure/http/v1/v1Router.ts` (lines 218–265)                                       |
| 4   | 🟡 Medium | **Harness graph has no `AgentContext` input**        | The current `HarnessState` contains `plan`, `limits`, `trace`, `runId` but has no field for `AgentContext`, `messages`, `toolDefinitions`, or `modelConfig`. The graph is a plan-executor, not a runtime. Task `agent-platform-9v1` must extend state significantly, but the current graph must not break.                                                              | Follow task spec precisely: add `messages`, `toolDefinitions`, `llmOutput`, `modelConfig` to `HarnessState`. The existing plan-execute path should remain as an alternative mode per task `agent-platform-40r`. Use feature flag per `agent-platform-dtc` (planner integration).                                                                                     | `packages/harness/src/graphState.ts`                                                                    |
| 5   | 🟡 Medium | **Only `maxSteps` is enforced**                      | `ExecutionLimits` defines `maxSteps`, `timeoutMs`, `maxTokens`, and `maxCostUnits`, but only `maxSteps` is checked in the graph's execute node. There's no deadline timer, no token accumulation, no cost tracking.                                                                                                                                                     | **Task `agent-platform-9yb` (Execution limits enforcement) is correctly scoped.** It requires the full loop running first (depends on plugin dispatch). Recommend adding `totalTokensUsed` and `totalCostUnits` to `HarnessState` during task `agent-platform-9v1` as empty fields to avoid a second state migration.                                                | `packages/harness/src/buildGraph.ts` (lines 49–54), `packages/contracts/src/limits.ts`                  |
| 6   | 🟡 Medium | **Deprecated `SSEClientTransport`**                  | `transport.ts` uses `SSEClientTransport` from `@modelcontextprotocol/sdk/client/sse.js` which is flagged as deprecated by the MCP SDK. This will break on a future SDK update.                                                                                                                                                                                          | Replace with the current recommended transport (likely `StreamableHTTPClientTransport` or the SDK's updated SSE replacement). Check MCP SDK changelog for the migration path. This is independent of the planned beads work and can be done anytime.                                                                                                                 | `packages/mcp-adapter/src/transport.ts` (line 2)                                                        |
| 7   | 🟡 Medium | **No conversation persistence**                      | Chat sessions exist in the DB (`sessions` table) but there's no `messages` table. Multi-turn conversations can't survive between requests. The current `/v1/chat/stream` discards all history after streaming.                                                                                                                                                          | **Task `agent-platform-xk3` (Conversation history / message store) is the last task in Epic 3.** This is correctly positioned — it requires the full runtime loop to be functional. The spec defines the `messages` table schema, Drizzle migration, and repository functions.                                                                                       | `packages/db/src/schema.ts`                                                                             |
| 8   | 🟡 Medium | **`resolveModelConfig` uses `process.env` directly** | In `factory.ts`, the model config fallback reads `process.env.DEFAULT_MODEL_PROVIDER` and `process.env.DEFAULT_MODEL` at call time. This creates a hidden dependency on environment state and makes testing harder.                                                                                                                                                     | **Task `agent-platform-icb` (Model override resolution chain) redesigns this.** The planned `resolveModelConfig` function in `model-router` with a proper precedence chain (agent override → env → system fallback) is the correct fix. Consider injecting env values through options rather than reading `process.env` directly.                                    | `packages/harness/src/factory.ts` (lines 94–102)                                                        |
| 9   | 🟡 Medium | **Plugin hooks not wired to runtime**                | `createPluginDispatcher` exists and is built in the factory, but no graph node or endpoint actually calls `dispatcher.onToolCall()`, `dispatcher.onPromptBuild()`, etc. The plugins are constructed but never fire.                                                                                                                                                     | **Task `agent-platform-k7m` (Plugin dispatch integration) wires this.** The spec correctly identifies all integration points: `onSessionStart` at chat request start, `onToolCall` in tool dispatch, `onPromptBuild` before LLM calls, `onError` on node failures.                                                                                                   | `packages/plugin-sdk/src/dispatch.ts`                                                                   |
| 10  | 🟡 Medium | **Planner behind feature flag (never enabled)**      | `PLANNER_GRAPH_INTEGRATION_ENABLED` is `false` in `packages/planner/src/flags.ts`. The planner's `parseLlmPlanJson` and `runPlannerRepairLoop` exist but are not connected to the graph.                                                                                                                                                                                | **Task `agent-platform-dtc` (Planner-graph integration) connects this.** The spec adds a `plan_generate` node and a mode selector. The flag flips to `true` on completion. This is correctly sequenced after limits enforcement.                                                                                                                                     | `packages/planner/src/flags.ts`                                                                         |
| 11  | 🟢 Low    | **Logger lacks correlation ID**                      | `createLogger()` produces structured JSON but has no request-scoped correlation field (e.g., `requestId`, `sessionId`, `runId`). As the runtime loop adds more concurrent operations, tracing a request through logs will become difficult.                                                                                                                             | Add an optional `correlationId` parameter or use AsyncLocalStorage to propagate a request-scoped ID. This becomes critical when task `agent-platform-k7m` wires observability into the loop.                                                                                                                                                                         | `apps/api/src/infrastructure/logging/logger.ts`                                                         |
| 12  | 🟢 Low    | **V1 router is a single 270-line file**              | All CRUD routes (skills, tools, MCP servers, agents, sessions) plus the chat endpoint live in one file. As the runtime loop is added (`agent-platform-5pe`), this will grow significantly.                                                                                                                                                                              | Split into per-resource routers: `skillsRouter.ts`, `agentsRouter.ts`, `sessionsRouter.ts`, `chatRouter.ts`. Compose in `v1Router.ts`. This refactor should happen before or during task `agent-platform-5pe` to keep the new chat endpoint isolated.                                                                                                                | `apps/api/src/infrastructure/http/v1/v1Router.ts`                                                       |
| 13  | 🟢 Low    | **`console.warn` in production code**                | `factory.ts` and `manager.ts` use `console.warn()` for MCP failures instead of the structured logger. This produces unstructured output that won't match the JSON log format.                                                                                                                                                                                           | Replace with `createLogger('mcp-adapter')` and `createLogger('harness')` calls.                                                                                                                                                                                                                                                                                      | `packages/harness/src/factory.ts` (line 133), `packages/mcp-adapter/src/manager.ts` (line 54)           |

---

## Planned Work Assessment (Beads → Architecture ADR Alignment)

### Dependency Chain

```
[DONE] agent-platform-yvd (MCP session lifecycle)
  └─→ agent-platform-9v1 (LLM reasoning node)      ← READY, UNBLOCKED
        ├─→ agent-platform-6d5 (Tool dispatch node)
        │     └─→ agent-platform-40r (ReAct loop wiring)
        │           └─→ agent-platform-16f (Structured streaming)
        │                 └─→ agent-platform-5pe (Session-aware chat) ← SEGMENT TIP
        │                       └─→ agent-platform-k7m (Plugin dispatch)
        │                             └─→ agent-platform-9yb (Limits enforcement)
        │                                   └─→ agent-platform-dtc (Planner integration)
        │                                         └─→ agent-platform-xk3 (Message store)
        └─→ agent-platform-icb (Model override) ← PARALLEL BRANCH
```

### Assessment by Task

| Task                  | ADR Layer               | Risk                                                                                                                                                    | Notes                                                                                                                         |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `9v1` LLM reasoning   | Runtime                 | **Medium** — First real model integration. Must design `LlmOutput` union correctly as all downstream tasks depend on it.                                | `HarnessState` extension is the foundation. Get types right here.                                                             |
| `6d5` Tool dispatch   | Tooling                 | **Medium** — Must integrate `isToolExecutionAllowed` + `callToolAsOutput` + error handling. First time the Tooling Layer boundary from the ADR is real. | Watch for the "runtime accesses DB directly" anti-pattern — tool dispatch should use contract tools from state, not query DB. |
| `40r` ReAct loop      | Runtime                 | **High** — Fundamental architectural change. Must preserve plan-execute mode while adding ReAct. Loop detection logic is new.                           | This is the most complex task. The conditional edge routing (tool calls → tool node → LLM; text → END) must be bulletproof.   |
| `16f` Streaming       | Runtime → HTTP          | **Medium** — OutputEmitter interface spans harness and HTTP layers. NDJSON format must match `OutputSchema` from contracts.                             | Ensure backpressure handling on the HTTP stream (client disconnect, slow readers).                                            |
| `5pe` Session chat    | HTTP → Runtime          | **Low** — Well-specified integration task. Replaces the ungoverned pass-through.                                                                        | This is the segment tip — PR here. Split the v1Router before this.                                                            |
| `icb` Model override  | Runtime                 | **Low** — Isolated change to model-router. Can parallelize with 40r/16f.                                                                                | Clean up `process.env` reads in factory as part of this.                                                                      |
| `k7m` Plugin dispatch | Harness (Control Plane) | **Medium** — Wiring hooks into 5 different graph execution points. Must not introduce async ordering bugs.                                              | Test with both observability + session memory plugins simultaneously.                                                         |
| `9yb` Limits          | Harness                 | **Medium** — Timeout requires wrapping graph execution. Token accumulation needs LLM response metadata.                                                 | Deadline timer must handle MCP calls that hang (tool dispatch timeout separate from overall timeout).                         |
| `dtc` Planner         | Runtime                 | **Medium** — Repair loop adds retries (up to 3). Must respect execution limits during retries.                                                          | Feature flag flip is the final gate.                                                                                          |
| `xk3` Message store   | Data                    | **Low** — Straightforward Drizzle migration + CRUD. Well-specified.                                                                                     | Cascade delete on session is important — test this.                                                                           |

### Architectural Risk: Task `40r` (ReAct Loop)

This is the highest-risk task because it fundamentally changes the graph topology. The current graph is:

```
START → resolve_plan → execute (loop) → END
```

The target is:

```
START → mode_select ─→ [ReAct path] llm_reason → route → tool_dispatch → llm_reason → ... → END
                    └→ [Plan path]  plan_generate → resolve_plan → execute → ... → END
```

**Recommendation:** Design the mode selector in `40r` even though the plan path doesn't connect until `dtc`. Use the `PLANNER_GRAPH_INTEGRATION_ENABLED` flag to gate. This prevents a second graph restructuring.

---

## Future Features & Enhancements

| #   | Feature                                      | Rationale                                                                                                                                                 | Complexity | Depends On                                  |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------- |
| 1   | **Request-scoped correlation IDs**           | As the runtime loop grows, tracing a request across LLM calls, tool dispatches, and plugin hooks requires a correlation ID propagated through all layers. | S          | `agent-platform-k7m` (plugin wiring)        |
| 2   | **Streamable HTTP transport for MCP**        | `SSEClientTransport` is deprecated. The MCP SDK is moving toward `StreamableHTTPClientTransport`. Migrating prevents breakage on SDK updates.             | S          | None (independent)                          |
| 3   | **Router decomposition**                     | Split v1Router into per-resource files before the session-aware chat endpoint lands.                                                                      | S          | Should happen before `agent-platform-5pe`   |
| 4   | **Structured error logging in all packages** | Replace `console.warn` with structured logger. Add request context to log lines.                                                                          | S          | Correlation IDs                             |
| 5   | **HITL (Human-in-the-Loop) pause/resume**    | The ADR lists HITL as a production requirement. LangGraph's checkpointer supports state persistence, but no suspend/resume API exists yet.                | L          | All Epic 2 + 3                              |
| 6   | **Provider-agnostic model routing**          | Currently OpenAI-only. The `modelOverride` field has `provider` but only OpenAI is implemented. Anthropic, Ollama, etc. need routing.                     | M          | `agent-platform-icb` (model override chain) |
| 7   | **Rate limiting / cost guardrails**          | The ADR requires rate limiting in the harness. Currently no per-agent or global rate limits exist.                                                        | M          | `agent-platform-9yb` (limits enforcement)   |

---

## Test Health

- **Pass rate:** 114/114 (100%) across 12 packages
- **E2E:** 5 Playwright tests exist but require Docker compose (ECONNREFUSED — expected when not running)
- **Coverage gaps:**
  - No tests for the streaming chat endpoint (`/v1/chat/stream`) — it's being replaced
  - No integration test for factory + graph end-to-end (factory builds context, graph runs with it)
  - Planner repair loop is tested with mocks but not with real LLM output
  - No negative-path test for AES-256-GCM with wrong key version
  - MCP adapter tests mock the SDK client — no integration test with a real MCP server process
- **Recommendations:**
  - Each Epic 2 task spec includes specific test requirements — follow them precisely
  - Add factory-to-graph integration test during `agent-platform-9v1` (first task to connect them)
  - The `harness-path.integration.test.ts` in `apps/api/test/` is a good template for end-to-end harness tests

---

## Action Items (Priority Order)

1. **[P0]** Fix error middleware information leakage — replace `err.message` in 500 handler with generic message; log full error server-side. — _Before any new endpoint work_
2. **[P0]** Start `agent-platform-9v1` (LLM reasoning node) — this is the critical path. The `HarnessState` extension and `LlmOutput` type design will be the foundation for 9 downstream tasks. — _Next session_
3. **[P1]** Replace deprecated `SSEClientTransport` with current MCP SDK transport — independent of planned work, prevents future breakage. — _Can be a standalone chore_
4. **[P1]** Replace `console.warn` with structured logger in `factory.ts` and `manager.ts` — do during `agent-platform-9v1` while touching the harness package.
5. **[P1]** Split `v1Router.ts` into per-resource routers — do before `agent-platform-5pe` (session-aware chat) to keep the new endpoint isolated.
6. **[P2]** During `agent-platform-9v1`, pre-allocate empty `totalTokensUsed` and `totalCostUnits` fields in `HarnessState` to avoid a second state migration during `agent-platform-9yb`.
7. **[P2]** During `agent-platform-40r`, design the graph mode selector to support future planner integration — use `PLANNER_GRAPH_INTEGRATION_ENABLED` flag from the start.
8. **[P2]** Add request-scoped correlation IDs before `agent-platform-k7m` (plugin dispatch wiring).

---

## Beads Tracking Update (2026-04-15)

Following this review, beads was updated to reflect all findings and planned work.

### New MVP Tasks Created

| ID                   | Title                                                | Type  | Priority | Depends On       | Rationale                                          |
| -------------------- | ---------------------------------------------------- | ----- | -------- | ---------------- | -------------------------------------------------- |
| `agent-platform-oss` | Fix error middleware information leakage             | task  | P0       | —                | Review finding #2: 500 handler leaks `err.message` |
| `agent-platform-pe4` | Replace deprecated SSEClientTransport in MCP adapter | chore | P1       | —                | Review finding #6: SDK deprecation                 |
| `agent-platform-ptj` | Decompose v1Router into per-resource routers         | task  | P2       | — (blocks `5pe`) | Review finding #12: single 270-line file           |
| `agent-platform-qhe` | Replace console.warn with structured logger          | chore | P2       | `oss`            | Review finding #13: unstructured output            |

### New Post-MVP Backlog Tasks Created

| ID                   | Title                                               | Type    | Priority | Depends On            | Rationale                                            |
| -------------------- | --------------------------------------------------- | ------- | -------- | --------------------- | ---------------------------------------------------- |
| `agent-platform-fcm` | HITL pause/resume for agent execution               | feature | P4       | `xk3` (all Epics 2+3) | Review future feature #5: ADR production requirement |
| `agent-platform-bto` | Provider-agnostic model routing (Anthropic, Ollama) | feature | P3       | `icb`                 | Review future feature #6: OpenAI-only limitation     |
| `agent-platform-nqn` | Rate limiting and cost guardrails                   | feature | P3       | `9yb`                 | Review future feature #7: ADR requirement            |
| `agent-platform-hnx` | Request-scoped correlation IDs                      | task    | P3       | —                     | Review future feature #1: log traceability           |

### Existing Tasks Updated

| ID                   | Change                                                                                                | Why                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `agent-platform-9v1` | Added: pre-allocate `totalTokensUsed` and `totalCostUnits` in HarnessState; added dependency on `oss` | Avoids second state migration; error middleware must be fixed first |
| `agent-platform-40r` | Added: design graph mode selector with `PLANNER_GRAPH_INTEGRATION_ENABLED` flag stub                  | Prevents second graph restructuring when planner integrates         |

### Updated Dependency Graph

```
[READY — unblocked]
  agent-platform-oss (P0 — error middleware fix)
  agent-platform-pe4 (P1 — SSE transport replacement)
  agent-platform-ptj (P2 — router decomposition)
  agent-platform-hnx (P3 — correlation IDs)

[MVP — Epic 2: Agent Runtime Loop]
  oss → 9v1 (LLM reasoning) → 6d5 (tool dispatch) → 40r (ReAct loop) → 16f (streaming) → 5pe (session chat)
                              └→ icb (model override) ─────────────────────────────────────────→ [parallel]
  ptj → 5pe (router must be split before session chat)
  oss → qhe (structured logger)

[MVP — Epic 3: Harness Hardening]
  5pe → k7m (plugin dispatch) → 9yb (limits enforcement) → dtc (planner integration) → xk3 (message store)

[Post-MVP Backlog]
  icb → bto (multi-provider routing)
  9yb → nqn (rate limiting / cost guardrails)
  xk3 → fcm (HITL pause/resume)
```

### Execution Priority (Recommended Order)

1. `agent-platform-oss` — P0, security fix, blocks critical path
2. `agent-platform-pe4` — P1, independent chore, can parallel with oss
3. `agent-platform-9v1` — P1, critical path (after oss)
4. `agent-platform-qhe` — P2, can be done alongside 9v1 (same packages)
5. `agent-platform-6d5` → `40r` → `16f` — P1 chain (sequential)
6. `agent-platform-ptj` — P2, must complete before 5pe
7. `agent-platform-icb` — P1, parallel with 40r/16f
8. `agent-platform-5pe` — P1, segment tip (PR to feature branch)
9. `agent-platform-k7m` → `9yb` → `dtc` → `xk3` — P1 chain (Epic 3)
10. Backlog: `hnx`, `bto`, `nqn`, `fcm` — P3-P4, post-MVP
