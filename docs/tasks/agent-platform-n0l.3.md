# Task: ReAct loop wiring in harness graph

**Beads issue:** `agent-platform-40r`  
**Spec file:** `docs/tasks/agent-platform-n0l.3.md` (this file)  
**Parent epic:** `agent-platform-n0l` — Epic: Agent Runtime Loop

## Task requirements

After this task, the harness graph supports a full ReAct (Reason + Act) loop:

- Updated `StateGraph` in `packages/harness/src/buildGraph.ts`:
  - `llm_reason` → conditional edge:
    - If `llmOutput.kind === 'tool_calls'` → `tool_dispatch`
    - If `llmOutput.kind === 'text'` (or null) → `END`
  - `tool_dispatch` → conditional edge:
    - If step count < `limits.maxSteps` → `llm_reason` (loop back)
    - If step count >= `limits.maxSteps` → `END` (halt with limit_hit trace)
- New `HarnessState` field: `stepCount: number` — incremented on each `llm_reason` invocation.
- Loop detection: track the last N tool calls (tool name + args hash). If the same call appears 3 times consecutively, halt with `{ type: 'loop_detected' }` trace event and error Output.
- The existing `resolve_plan` → `execute` path remains available. A `mode` field in initial state (`'react' | 'plan'`) determines which path the graph takes from `START`:
  - `mode === 'react'` → `llm_reason` (new default)
  - `mode === 'plan'` → `resolve_plan` (existing path)
- Graph structure:
  ```
  START → mode_router → (react: llm_reason ↔ tool_dispatch) | (plan: resolve_plan → execute)
  ```

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-6d5` | [Tool dispatch node](./agent-platform-n0l.2.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-16f` | [Structured streaming output](./agent-platform-n0l.4.md) |

## Implementation plan

1. Create **`task/agent-platform-40r`** from **`task/agent-platform-6d5`**.
2. Add `stepCount` and `mode` to `HarnessState` in `graphState.ts`.
3. Create `packages/harness/src/nodes/modeRouter.ts`:
   - Simple node that reads `mode` and routes via conditional edge.
4. Refactor `buildGraph.ts`:
   - Add `mode_router` node at `START`.
   - Wire `llm_reason` and `tool_dispatch` nodes with conditional edges.
   - Keep existing `resolve_plan` and `execute` nodes, routed from `mode_router` when `mode === 'plan'`.
   - `routeAfterLlm`: check `llmOutput.kind` — tool_calls → `tool_dispatch`, text → END.
   - `routeAfterDispatch`: check `stepCount` vs `limits.maxSteps` — under limit → `llm_reason`, at limit → END with halt.
5. Add loop detection in `tool_dispatch` or a post-dispatch check:
   - Maintain a rolling window of last 3 tool calls (serialized name+args).
   - If all 3 match, set `halted = true`, emit `loop_detected` trace.
6. Update `BuildHarnessGraphOptions` to accept `AgentContext` (or its tool dispatch dependencies).
7. Unit tests:
   - ReAct loop: mock LLM → tool call → mock LLM → text response → verify END reached.
   - Max steps enforcement: mock LLM to always return tool calls → verify halt at maxSteps.
   - Loop detection: mock LLM to return same tool call repeatedly → verify halt at 3 repeats.
   - Plan mode: verify existing plan-execute path still works when `mode === 'plan'`.
8. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-6d5`** |
| **This task's branch** | **`task/agent-platform-40r`** |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** Full ReAct loop cycle, step limit, loop detection, plan mode fallback.

## Definition of done

- [ ] ReAct loop: `llm_reason` ↔ `tool_dispatch` with conditional routing.
- [ ] Mode router selects between `react` and `plan` paths.
- [ ] `stepCount` tracks iterations, enforces `maxSteps`.
- [ ] Loop detection halts on 3 identical consecutive tool calls.
- [ ] Existing plan-execute path continues to work.
- [ ] Unit tests pass for all paths.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-6d5`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-40r --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
