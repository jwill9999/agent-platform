# Task: Wire sensors into the ReAct loop

**Beads issue:** `agent-platform-feedback-sensors.3`  
**Spec file:** `docs/tasks/agent-platform-feedback-sensors.3.md` (this file)  
**Parent epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-feedback-sensors.3.md`

## Task requirements

Add sensor-check phases to the ReAct graph so targeted checks can run during work, required local gates run before commit/push, and remote/imported findings feed repair signals into the next model turn.

Required outcomes:

- Add optional `sensorCheckNode` support to `buildHarnessGraph`.
- Route relevant tool dispatches through the sensor node only when trigger policy marks the event as a meaningful checkpoint.
- Route sensor checks only when the active agent profile and task context allow or require the selected sensors.
- Add explicit support for `before_commit`, `before_push`, `after_push`, `external_feedback`, `manual`, and `scheduled` trigger contexts.
- Feed failed sensor repair instructions into `state.messages` as bounded system feedback.
- Continue when sensors pass.
- Stop or escalate when a required sensor is unavailable, provider auth is required, a runtime/sandbox limitation blocks a required check, or the same sensor failure repeats without progress.
- Record sensor trace events and emit user-visible `thinking`/`error` events when appropriate.

## Dependency order

### Upstream - must be complete before this task

| Issue                               | Spec                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.2` | [Implement computational sensor runner](./agent-platform-feedback-sensors.2.md) |

### Downstream - waiting on this task

| Issue                               | Spec                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.4` | [Add inferential sensor checkpoints](./agent-platform-feedback-sensors.4.md) |

## Implementation plan

1. Read `packages/harness/src/buildGraph.ts`, `packages/harness/src/graphState.ts`, and `packages/harness/src/nodes/dodCheck.ts`.
2. Add `sensorResults`, `sensorAttempts`, and minimal loop-detection state to `HarnessState`.
3. Include active agent profile and task context in sensor selection state.
4. Create `packages/harness/src/nodes/sensorCheck.ts`.
5. Detect code-changing tool calls using system tool IDs and coding edit tool IDs, but default to targeted checks rather than full validation.
6. Add a pre-completion/pre-push route that runs required local sensors before the agent declares work ready.
7. Add an external feedback route for imported GitHub/SonarQube/CodeQL/review results after push or manual refresh.
8. Add routing behavior for environment limitations:
   - optional sensor blocked by runtime limitation records a skipped/unavailable result
   - required sensor blocked by runtime limitation escalates with repair instructions
   - transient runtime limitation can be retried manually or after environment repair
9. Add graph variants for:
   - ReAct only + sensors
   - ReAct + critic + sensors
   - ReAct + DoD + sensors
   - ReAct + critic + DoD + sensors
10. Reuse existing deadline, `maxSteps`, and critic iteration cap patterns.
11. Add focused tests in `packages/harness/test/sensorCheck.test.ts` and route tests in `packages/harness/test/reactLoop.test.ts`.

## Tests (required before sign-off)

- `pnpm --filter @agent-platform/harness run test -- test/sensorCheck.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/reactLoop.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm typecheck`
- Add tests for:
  - no sensor run after read-only tools
  - targeted sensor run after meaningful code edit checkpoint
  - no full gate after every edit
  - required local sensor run before completion/push
  - personal-assistant profile does not run coding sensors for non-coding task
  - coding profile runs required repository sensors before push
  - external feedback import after push/manual refresh
  - failed sensor adds repair feedback and loops to `react_llm_reason`
  - passed sensor permits normal routing
  - required auth/unavailable provider escalates clearly
  - required runtime/sandbox limitation escalates clearly
  - optional runtime/sandbox limitation records skipped/unavailable state
  - repeated identical failure halts with a clear error

## Definition of done

- [x] Sensor node participates in the ReAct loop.
- [x] Full validation runs at pre-completion/pre-push checkpoints, not after every edit.
- [x] Sensor routing respects active agent profile and task context.
- [x] Failed sensor output is LLM-facing and bounded.
- [x] Passing sensors do not add noisy context.
- [x] Routing is covered for graph variants used by the API.
- [x] `bd close agent-platform-feedback-sensors.3 --reason "Sensors wired into ReAct loop"`

## Sign-off

- [x] Task branch created from `task/agent-platform-feedback-sensors.2`
- [x] Required tests executed and passing
- [x] Checklists in this document are complete
- [x] If segment tip: N/A - merge at segment end
- [x] `decisions.md` updated only if architectural decision changed
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
