# Task: Plugin dispatch integration into runtime loop

**Beads issue:** `agent-platform-k7m`  
**Spec file:** `docs/tasks/agent-platform-qlp.1.md` (this file)  
**Parent epic:** `agent-platform-qlp` — Epic: Harness Hardening

## Task requirements

After this task, the existing plugin SDK hooks fire during real agent execution:

- The `PluginDispatcher` from `AgentContext` is called at these points in the runtime loop:
  - **`onSessionStart`** — called once at the start of `runChat` (after AgentContext is built, before graph invocation). Context: `{ sessionId, agentId, agent }`.
  - **`onPromptBuild`** — called in `llm_reason` node before each LLM call. Context: `{ sessionId, runId, plan, messages }`.
  - **`onToolCall`** — called in `tool_dispatch` node after allowlist validation, before tool execution. Context: `{ sessionId, runId, toolId, args }`.
  - **`onTaskStart` / `onTaskEnd`** — called in the `execute` node when running in plan mode. Context: task start/end details.
  - **`onError`** — called on any unhandled error in graph nodes, in `runChat` catch block, or on MCP session failures during execution.
- The dispatcher is passed through the graph via `BuildHarnessGraphOptions` or via `AgentContext` reference in state.
- Plugin errors must not crash the graph — wrap each dispatch call in try/catch, log the error, continue execution.
- Integration test: create an agent, register the observability plugin as global, send a chat message, capture the structured log events, verify `session_start`, `prompt_build`, and at minimum one `tool_call` or `task_start` event was emitted.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-5pe` | [Session-aware chat endpoint](./agent-platform-n0l.5.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-9yb` | [Execution limits enforcement](./agent-platform-qlp.2.md) |

### Planning notes

- This task starts a **new segment** for Epic 3. Branch from updated `feature/agent-platform-runtime` after Epic 2 segment PR is merged.
- Plugin hooks are async (return Promise<void>) — the graph nodes must `await` them. This adds latency per hook per plugin; for MVP this is acceptable.
- The `onPromptBuild` context includes `messages` as read-only. Plugins can observe but not mutate.

## Implementation plan

1. Create **`task/agent-platform-k7m`** from **`feature/agent-platform-runtime`** (new segment after Epic 2 merges).
2. Update `llm_reason` node: before calling the model, `await dispatcher.onPromptBuild(ctx)`.
3. Update `tool_dispatch` node: before executing each tool, `await dispatcher.onToolCall(ctx)`.
4. Update `execute` node (plan mode): `await dispatcher.onTaskStart(ctx)` before execution, `await dispatcher.onTaskEnd(ctx)` after.
5. Update `runChat` in `apps/api/src/application/chat/runChat.ts`:
   - After building AgentContext: `await dispatcher.onSessionStart(ctx)`.
   - In catch block: `await dispatcher.onError(ctx)`.
6. Wrap all dispatch calls in try/catch — log plugin errors via the API logger, do not re-throw.
7. Integration test in `apps/api/test/plugin-integration.test.ts`:
   - Register observability plugin with a capturing log function.
   - Seed agent + session → POST /v1/chat → collect emitted events.
   - Assert: `session_start`, `prompt_build` events present.
8. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`feature/agent-platform-runtime`** (new segment) |
| **This task's branch** | **`task/agent-platform-k7m`** |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** Verify dispatch calls at each integration point with mock dispatcher.
- **Integration:** Observability plugin produces events during a real chat request.

## Definition of done

- [ ] `onSessionStart` called at chat request start.
- [ ] `onPromptBuild` called before each LLM call.
- [ ] `onToolCall` called before each tool execution.
- [ ] `onTaskStart`/`onTaskEnd` called in plan mode.
- [ ] `onError` called on failures.
- [ ] Plugin errors caught and logged (no crash).
- [ ] Integration test verifies observability events.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`feature/agent-platform-runtime`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-k7m --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
