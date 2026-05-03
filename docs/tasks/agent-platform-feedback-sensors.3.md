# Task: Wire sensors into the ReAct loop

**Beads issue:** `agent-platform-feedback-sensors.3`  
**Spec file:** `docs/tasks/agent-platform-feedback-sensors.3.md` (this file)  
**Parent epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-feedback-sensors.3.md`

## Task requirements

Add a sensor-check phase to the ReAct graph so failed computational sensors feed repair signals into the next model turn.

Required outcomes:

- Add optional `sensorCheckNode` support to `buildHarnessGraph`.
- Route relevant tool dispatches through the sensor node after code-changing tools.
- Feed failed sensor repair instructions into `state.messages` as bounded system feedback.
- Continue when sensors pass.
- Stop or escalate when the same sensor failure repeats without progress.
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
3. Create `packages/harness/src/nodes/sensorCheck.ts`.
4. Detect code-changing tool calls using system tool IDs and coding edit tool IDs.
5. Add graph variants for:
   - ReAct only + sensors
   - ReAct + critic + sensors
   - ReAct + DoD + sensors
   - ReAct + critic + DoD + sensors
6. Reuse existing deadline, `maxSteps`, and critic iteration cap patterns.
7. Add focused tests in `packages/harness/test/sensorCheck.test.ts` and route tests in `packages/harness/test/reactLoop.test.ts`.

## Tests (required before sign-off)

- `pnpm --filter @agent-platform/harness run test -- test/sensorCheck.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/reactLoop.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm typecheck`
- Add tests for:
  - no sensor run after read-only tools
  - sensor run after code edit tool
  - failed sensor adds repair feedback and loops to `react_llm_reason`
  - passed sensor permits normal routing
  - repeated identical failure halts with a clear error

## Definition of done

- [ ] Sensor node participates in the ReAct loop.
- [ ] Failed sensor output is LLM-facing and bounded.
- [ ] Passing sensors do not add noisy context.
- [ ] Routing is covered for graph variants used by the API.
- [ ] `bd close agent-platform-feedback-sensors.3 --reason "Sensors wired into ReAct loop"`

## Sign-off

- [ ] Task branch created from `task/agent-platform-feedback-sensors.2`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] If segment tip: N/A - merge at segment end
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
