# Task: Evaluator agent + iteration loop

**Beads issue:** `agent-platform-7ga`
**Spec file:** `docs/tasks/agent-platform-7ga.md` (this file)
**Parent epic:** `agent-platform-d87` — [Tier 1 gap remediation](./agent-platform-d87.md)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-7ga.md`

## Source gaps

- `docs/planning/anthropic-gap-analysis.md` items #1, #3, #4 — no critic, no self-correction loop, no evaluator persona.
- `docs/planning/harness-optimisation.md` — recommends a deliberate critic phase between LLM reasoning and final emission.

## Task requirements

After this task, the harness graph contains a **critic / evaluator node** that runs after the LLM reasoning produces a tentative final answer (i.e. no further tool calls). The critic decides one of:

- `accept` → graph proceeds to END.
- `revise` → graph routes back to `llmReason` with critique appended to the message history; iteration counter increments.

Hard cap on revise loops to prevent infinite cycles; cap is sourced from the existing execution-limits config (no new env var unless missing).

### Concrete deliverables

- New node file: `packages/harness/src/nodes/critic.ts` (export `criticNode`).
- New persona prompt: `packages/harness/src/personas/evaluator.ts` (export `EVALUATOR_SYSTEM_PROMPT`).
- `HarnessStateType` (in `packages/harness/src/graphState.ts`) gains:
  - `iterations: number` (LangGraph reducer: increment).
  - `critique: string | undefined` (last critique text, cleared on `accept`).
- `buildGraph` (in `packages/harness/src/buildGraph.ts`) wires the critic:
  - Conditional edge from `llmReason`: if assistant message has tool calls → `toolDispatch` (existing); else → `critic` (new).
  - Conditional edge from `critic`: `accept` → `END`; `revise` and under cap → `llmReason`; cap reached → `END` with a final `error`/note in the output stream.
- Cap key: `executionLimits.maxCriticIterations` in `packages/contracts/src/limits.ts` (default `3`); resolution in `factory.ts` follows existing pattern.
- The evaluator output must be a small structured JSON `{ verdict: 'accept' | 'revise', reasons: string[] }` parsed via Zod (`packages/contracts/src/critic.ts`).
- Streaming: critic emits a `thinking` Output event (`packages/contracts/src/output.ts`) for each iteration so the UI shows what's happening.

### Out of scope

- DoD contract enforcement (that is `agent-platform-fc8`).
- Plan-mode evaluator (current scope is ReAct loop only).

## Dependency order

### Upstream — must be complete before this task

| Issue                          | Spec |
| ------------------------------ | ---- |
| _none — first task in segment_ | —    |

### Downstream — waiting on this task

| Issue                | Spec                                          |
| -------------------- | --------------------------------------------- |
| `agent-platform-fc8` | [DoD contract phase](./agent-platform-fc8.md) |

## Implementation plan

1. Create branch **`task/agent-platform-7ga`** from **`feature/agent-platform-d87`**.
2. Add Zod schema `CriticVerdictSchema` in `packages/contracts/src/critic.ts`; export from barrel.
3. Add `maxCriticIterations` to `executionLimits` in `packages/contracts/src/limits.ts` with default `3`.
4. Extend `HarnessStateType` (`packages/harness/src/graphState.ts`) with `iterations` (number reducer) and `critique` (last-write-wins).
5. Create `packages/harness/src/personas/evaluator.ts` with the system prompt — terse, scoped to "verify the assistant's last message satisfies the user's most recent request, considering tool results in this turn".
6. Create `packages/harness/src/nodes/critic.ts`:
   - Receives state; constructs an evaluator-only message thread (user request + assistant tentative answer + relevant tool results).
   - Calls model-router with structured-output mode; parses with `CriticVerdictSchema`.
   - On parse failure: treat as `accept` to avoid hangs, but log via plugin-sdk `onError`.
   - Emits a `thinking` Output event summarising the verdict.
   - Returns a state delta `{ critique?, iterations: 1 }`.
7. Update `packages/harness/src/buildGraph.ts`:
   - Replace the current `llmReason → END` (no-tools) edge with `llmReason → critic`.
   - Conditional edge from `critic`: `verdict === 'accept' || iterations >= cap` → `END`; else → `llmReason` with `critique` injected as a system message via `contextBuilder`.
8. Update `packages/harness/src/contextBuilder.ts` to surface `critique` as a `<critique>...</critique>` system note when present.
9. Tests in `packages/harness/test/`:
   - `critic.test.ts` — unit: accept path, revise path, malformed verdict path, cap enforcement.
   - Extend `reactLoop.test.ts` — integration: simulated revise cycle terminates; iteration counter present in final state.
10. Update `docs/architecture.md` and `docs/architecture/message-flow.md` Mermaid to include `critic`.
11. Run quality gates; push branch; hand off to `agent-platform-fc8` (no PR yet — segment-internal).

## Git workflow (mandatory)

|                            |                                            |
| -------------------------- | ------------------------------------------ |
| **Parent for this branch** | **`feature/agent-platform-d87`**           |
| **This task's branch**     | **`task/agent-platform-7ga`**              |
| **Segment tip?**           | **No** — next task branches from this one. |

## Tests (required before sign-off)

- **Unit:** `packages/harness/test/critic.test.ts` — verdict parsing, accept/revise/cap.
- **Integration:** `packages/harness/test/reactLoop.test.ts` — revise loop converges within cap.
- **Contracts:** `packages/contracts/test/roundtrip.test.ts` extended with `CriticVerdictSchema`.
- **Quality gates:** `pnpm typecheck && pnpm lint && pnpm test`.

## Definition of done

- [ ] `criticNode` added; `buildGraph` routes `llmReason → critic → (END | llmReason)`.
- [ ] `CriticVerdictSchema` in contracts; exported.
- [ ] Iteration cap from `executionLimits.maxCriticIterations`; respected in tests.
- [ ] Evaluator persona prompt written and used by `criticNode`.
- [ ] `thinking` Output event emitted per critic invocation.
- [ ] Unit + integration tests pass; coverage of accept / revise / malformed / cap.
- [ ] `docs/architecture.md` and `docs/architecture/message-flow.md` updated.
- [ ] Quality gates green (`pnpm build && pnpm typecheck && pnpm lint && pnpm test`).
- [ ] Branch pushed.

## Sign-off

- [ ] **Task branch** created from **`feature/agent-platform-d87`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-7ga --reason "Critic node + evaluator persona wired with iteration cap"`

**Reviewer / owner:** **********\_********** **Date:** ******\_******
