# Task: Definition-of-Done contract phase

**Beads issue:** `agent-platform-fc8`
**Spec file:** `docs/tasks/agent-platform-fc8.md` (this file)
**Parent epic:** `agent-platform-d87` — [Tier 1 gap remediation](./agent-platform-d87.md)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-fc8.md`

## Source gaps

- `docs/planning/anthropic-gap-analysis.md` item #2 — no explicit DoD phase; the agent declares success implicitly.
- `docs/planning/gap-analysis.md` codex review — recommends an explicit success contract carried in state.

## Task requirements

After this task, the harness cannot reach `END` without a **passing Definition-of-Done contract**. A `DodContract` artifact lives in `HarnessStateType`, is produced before final emission, and is verified by a dedicated check node.

A DoD failure routes back to `llmReason` (subject to the iteration cap from `agent-platform-7ga`); a DoD pass releases the run to END.

A new plugin-sdk hook `onDodCheck` lets plugins observe / amend / veto the contract.

### Concrete deliverables

- New contract: `packages/contracts/src/dod.ts` exporting:
  ```ts
  export const DodContractSchema = z.object({
    criteria: z.array(z.string()).min(1),
    evidence: z.array(z.string()),
    passed: z.boolean(),
    failedCriteria: z.array(z.string()).default([]),
  });
  export type DodContract = z.infer<typeof DodContractSchema>;
  ```
- Barrel export from `packages/contracts/src/index.ts`.
- `HarnessStateType` gains `dodContract: DodContract | undefined` (last-write-wins reducer).
- New nodes in `packages/harness/src/nodes/`:
  - `dodPropose.ts` — derives `criteria` from the user request once at run start (or after the first plan), persists into state.
  - `dodCheck.ts` — runs after `critic` (or after `llmReason` when the critic is bypassed), evaluates `evidence` collected during the run against `criteria`, sets `passed`/`failedCriteria`.
- `buildGraph` wiring (in `packages/harness/src/buildGraph.ts`):
  - After session start: `dodPropose` runs once.
  - Final routing becomes: `critic → dodCheck → (END if passed, else llmReason if iteration cap not reached, else END with error)`.
- New plugin-sdk hook in `packages/plugin-sdk/src/hooks.ts`:
  ```ts
  onDodCheck(ctx: DodCheckContext): MaybePromise<DodContract | void>;
  ```

  - If a plugin returns a `DodContract`, the harness uses it instead (allows external evaluators to override).
  - Dispatcher in `packages/plugin-sdk/src/dispatch.ts` handles sequential override semantics.
- Streaming: emit one `text` Output line summarising the DoD result on END (e.g. `DoD: 3/3 criteria met`).
- Plugin-observability records each `dod_check` as a span event.

### Out of scope

- A UI surface for DoD (tracked separately).
- Domain-specific evaluators beyond the generic LLM verifier.

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                                        |
| -------------------- | ----------------------------------------------------------- |
| `agent-platform-7ga` | [Evaluator agent + iteration loop](./agent-platform-7ga.md) |

### Downstream — waiting on this task

| Issue                | Spec                                                           |
| -------------------- | -------------------------------------------------------------- |
| `agent-platform-2v6` | [Agent-queryable observability tools](./agent-platform-2v6.md) |

## Implementation plan

1. Create branch **`task/agent-platform-fc8`** from **`task/agent-platform-7ga`**.
2. Add `DodContractSchema` to `packages/contracts/src/dod.ts`; export from barrel.
3. Extend `HarnessStateType` with `dodContract` (last-write-wins) in `packages/harness/src/graphState.ts`.
4. Add `onDodCheck` hook + context type in `packages/plugin-sdk/src/hooks.ts` and `contexts.ts`. Update `dispatch.ts` to support a return value that overrides the in-progress contract.
5. Create `packages/harness/src/nodes/dodPropose.ts`:
   - Calls model-router with a small structured-output prompt to extract testable criteria from the user's first message.
   - Falls back to a single criterion `"Answer the user's question."` on parse failure.
   - Sets `dodContract = { criteria, evidence: [], passed: false, failedCriteria: [] }`.
6. Create `packages/harness/src/nodes/dodCheck.ts`:
   - Builds an evaluation prompt from `criteria` + assistant message + evidence (tool results so far + final answer).
   - Calls plugin dispatcher `onDodCheck`; if a plugin returns a contract, use it.
   - Else uses the LLM verifier; parses `DodContractSchema`; on parse failure, mark `passed=false` with reason "DoD verifier returned malformed output".
7. Update `buildGraph`:
   - Insert `dodPropose` between session start and the first `llmReason`.
   - Replace the existing `critic → END` edge with `critic → dodCheck`.
   - Conditional edge from `dodCheck`: `passed === true` → `END`; else if iterations < cap → `llmReason` (with failed criteria injected via `contextBuilder` as `<dod-failed>...</dod-failed>`); else → `END` with an `error` Output `code: 'DOD_FAILED'`.
8. Update `contextBuilder` to surface failed DoD criteria as a system note.
9. Update `plugin-observability` to record `dod_check` events; add to query surface (`agent-platform-2v6` will consume).
10. Tests:
    - `packages/contracts/test/dod.test.ts` — schema round-trip.
    - `packages/harness/test/dodCheck.test.ts` — pass / fail / malformed / plugin-override paths.
    - `packages/harness/test/dodPropose.test.ts` — extract criteria; fallback path.
    - Extend `packages/harness/test/reactLoop.test.ts` to assert no run reaches END without `dodContract.passed === true` (or cap exhaustion path).
    - `packages/plugin-sdk/test/dispatch.test.ts` extended for override semantics.
11. Update `docs/architecture.md`, `docs/architecture/message-flow.md` (Mermaid), and `docs/plugin-guide.md` (new hook).
12. Run quality gates; push branch; hand off to `agent-platform-2v6`.

## Git workflow (mandatory)

|                            |                               |
| -------------------------- | ----------------------------- |
| **Parent for this branch** | **`task/agent-platform-7ga`** |
| **This task's branch**     | **`task/agent-platform-fc8`** |
| **Segment tip?**           | **No**                        |

## Tests (required before sign-off)

- **Unit:** `dodCheck`, `dodPropose`, schema round-trip, dispatcher override.
- **Integration:** `reactLoop.test.ts` — END only when DoD passes (or cap reached).
- **Quality gates:** `pnpm typecheck && pnpm lint && pnpm test`.

## Definition of done

- [ ] `DodContractSchema` in contracts; exported.
- [ ] `dodPropose` runs once per session; `dodCheck` runs before END.
- [ ] `onDodCheck` plugin hook implemented with override semantics.
- [ ] Failed DoD routes back to `llmReason` (under iteration cap); cap-exhausted runs end with `code: 'DOD_FAILED'`.
- [ ] `text` Output line summarises DoD result on END.
- [ ] Plugin-observability records `dod_check` events.
- [ ] All tests above written and passing.
- [ ] Docs updated (architecture + message-flow + plugin-guide).
- [ ] Quality gates green.
- [ ] Branch pushed.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-7ga`**
- [ ] **Unit + integration tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-fc8 --reason "DoD contract phase wired with onDodCheck hook"`

**Reviewer / owner:** **********\_********** **Date:** ******\_******
