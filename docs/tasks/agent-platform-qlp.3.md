# Task: Planner-graph integration

**Beads issue:** `agent-platform-dtc`  
**Spec file:** `docs/tasks/agent-platform-qlp.3.md` (this file)  
**Parent epic:** `agent-platform-qlp` — Epic: Harness Hardening

## Task requirements

After this task, the existing planner package is connected to the harness graph as an optional execution mode:

- New `plan_generate` graph node:
  - Takes the user message + agent context (tool manifest, system prompt).
  - Constructs a planning prompt that asks the LLM to produce a structured JSON plan matching `PlanSchema`.
  - Calls the LLM via model-router.
  - Feeds the response through `parseLlmPlanJson(raw, agent)` for validation.
  - On parse failure: uses `runPlannerRepairLoop` with max 3 attempts.
  - On success: stores the validated `Plan` in graph state, routes to `resolve_plan` → `execute` loop.
  - On final failure: halts with error trace event and error Output.
- Update the `mode_router` (from task n0l.3):
  - `mode === 'plan'` → `plan_generate` → `resolve_plan` → `execute`
  - This replaces the current direct path to `resolve_plan` which expects a pre-built plan in state.
- The plan-mode execute loop should also use the tool dispatch infrastructure from the ReAct path (not the old stub `executeTool` callback) so that MCP tools are actually invoked with proper args.
- Flip `PLANNER_GRAPH_INTEGRATION_ENABLED` to `true` in `packages/planner/src/flags.ts`.
- The planning prompt should:
  - Include the available tool names and descriptions.
  - Request output as JSON matching `{ id, tasks: [{ id, description, toolIds }] }`.
  - Include the agent's constraints from skills.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-9yb` | [Execution limits enforcement](./agent-platform-qlp.2.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-xk3` | [Conversation history / message store](./agent-platform-qlp.4.md) |

## Implementation plan

1. Create **`task/agent-platform-dtc`** from **`task/agent-platform-9yb`**.
2. Create `packages/harness/src/nodes/planGenerate.ts`:
   - Build planning prompt from agent system prompt + tool descriptions + user message.
   - Call LLM via model-router (use `generateText` — planning doesn't need streaming).
   - Parse response with `parseLlmPlanJson`.
   - If failed, use `runPlannerRepairLoop` with `generate` callback that re-prompts with error feedback.
   - On success: return `{ plan, trace: [{ type: 'plan_ready', ... }] }`.
   - On failure: return `{ halted: true, trace: [{ type: 'plan_failed', ... }] }`.
3. Add `plan_failed` trace event type.
4. Update `buildGraph.ts`:
   - Route `mode === 'plan'` → `plan_generate` → `resolve_plan` → `execute`.
   - Update `execute` node to use the tool dispatch infrastructure (resolve tool, validate allowlist, execute via MCP/native).
5. Flip `PLANNER_GRAPH_INTEGRATION_ENABLED = true` in `packages/planner/src/flags.ts`.
6. Unit tests:
   - Mock LLM → valid plan JSON → verify plan stored in state, execution proceeds.
   - Mock LLM → invalid JSON → repair loop → valid on attempt 2 → verify recovery.
   - Mock LLM → all attempts fail → verify halt with plan_failed trace.
   - Verify tool allowlist enforcement in plan validation.
7. Integration test:
   - Seed agent with allowed tools → POST /v1/chat with planning mode → verify plan generated and at least one task executed.
8. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-9yb`** |
| **This task's branch** | **`task/agent-platform-dtc`** |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** Plan generation, repair loop, validation, plan-mode execution.
- **Integration:** Agent with planning mode → chat → verify plan generated and executed.

## Definition of done

- [ ] `plan_generate` node produces validated plans from LLM output.
- [ ] Repair loop retries on malformed output (max 3 attempts).
- [ ] Plan-mode execution uses real tool dispatch (not stub).
- [ ] Mode router correctly routes `plan` vs `react`.
- [ ] `PLANNER_GRAPH_INTEGRATION_ENABLED` flipped to `true`.
- [ ] Unit and integration tests pass.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-9yb`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-dtc --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
