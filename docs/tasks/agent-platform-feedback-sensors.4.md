# Task: Add inferential sensor checkpoints

**Beads issue:** `agent-platform-feedback-sensors.4`  
**Spec file:** `docs/tasks/agent-platform-feedback-sensors.4.md` (this file)  
**Parent epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-feedback-sensors.4.md`

## Task requirements

Extend checkpoint evaluation so semantic sensors can review the agent's result when deterministic checks are insufficient, including future orchestrated agents that need to self-assess before asking for human review.

Required outcomes:

- Model inferential sensors as structured checks compatible with the sensor contracts.
- Reuse or wrap existing critic and DoD behavior rather than duplicating semantic review machinery.
- Add support for checkpoint categories:
  - task satisfaction
  - diff intent versus user request
  - architecture boundary risk
  - test quality concerns
  - unresolved security/code-quality findings
  - readiness to commit, push, or request review
- Evaluate readiness against the active agent profile. Coding agents should be checked against repository/task DoD; personal-assistant agents should be checked against task satisfaction, safety, and external-action risk.
- Allow orchestrated agents to expose their available self-assessment tools and selected sensor profile without autonomously weakening required gates.
- Keep inferential sensors bounded by model config, timeout, cost, and max-iteration limits.
- Make failed criteria feed back as concise revise instructions.

## Dependency order

### Upstream - must be complete before this task

| Issue                               | Spec                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.3` | [Wire sensors into the ReAct loop](./agent-platform-feedback-sensors.3.md) |

### Downstream - waiting on this task

| Issue                               | Spec                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.5` | [Add sensor observability and feedback flywheel](./agent-platform-feedback-sensors.5.md) |

## Implementation plan

1. Read `packages/harness/src/nodes/critic.ts`, `packages/harness/src/nodes/dodCheck.ts`, and `packages/plugin-sdk/src/hooks.ts`.
2. Define inferential sensor evaluator interfaces in the harness.
3. Add plugin extension points if existing `onDodCheck` cannot represent the needed categories cleanly.
4. Implement a default evaluator that returns structured sensor results from model output.
5. Include normalized open findings from computational sensors as evidence for inferential review.
6. Add prompt text that asks for JSON only and requires evidence-backed failed criteria.
7. Ensure malformed model output fails closed with a useful sensor failure.
8. Add tests with mocked model/evaluator output.

## Tests (required before sign-off)

- `pnpm --filter @agent-platform/harness run test -- test/critic.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/dodCheck.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/plugin-sdk run test`
- `pnpm typecheck`
- Add tests for:
  - accepted inferential sensor result
  - failed result with revise criteria
  - unresolved security/code-quality finding blocks readiness when required
  - profile-specific readiness checks differ for coding and personal-assistant agents
  - self-assessment tool/profile exposure cannot disable required gates
  - malformed model output fails closed
  - plugin override behavior if new hooks are added
  - cap reached behavior

## Definition of done

- [ ] Inferential sensors are represented by the shared sensor model.
- [ ] Existing critic/DoD behavior remains compatible.
- [ ] Open required findings can influence semantic readiness checks.
- [ ] Readiness criteria can vary by active agent profile without weakening required gates.
- [ ] Semantic failures produce actionable feedback for the next model turn.
- [ ] Tests cover pass, fail, malformed, and cap-reached paths.
- [ ] `bd close agent-platform-feedback-sensors.4 --reason "Inferential sensor checkpoints added"`

## Sign-off

- [ ] Task branch created from `task/agent-platform-feedback-sensors.3`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] If segment tip: N/A - merge at segment end
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
