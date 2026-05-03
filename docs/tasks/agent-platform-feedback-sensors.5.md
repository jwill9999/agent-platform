# Task: Add sensor observability and feedback flywheel

**Beads issue:** `agent-platform-feedback-sensors.5`  
**Spec file:** `docs/tasks/agent-platform-feedback-sensors.5.md` (this file)  
**Parent epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-feedback-sensors.5.md`

## Task requirements

Persist and expose sensor outcomes and normalized findings so repeated failures can improve the harness over time.

Required outcomes:

- Record sensor runs/results in the observability store with redaction and truncation.
- Record the active agent profile, task context, and selected sensor profile for each sensor run/result.
- Record normalized findings from local commands, IDE problems, IDE/plugin terminal output, SonarQube, CodeQL, GitHub checks, PR annotations, agent code comments, and user feedback.
- Record runtime environment metadata and limitations for sensor runs, including Docker service/container identity, sandbox profile, missing tools, missing mounts, and path mappings where available.
- Expose sensor outcomes through existing observability tools where appropriate.
- Detect repeated failure patterns by sensor ID, rule, file area, or repair category.
- Deduplicate the same issue when it appears across local diagnostics, IDE problems, IDE/plugin terminal output, CI annotations, and remote code scanning.
- Generate reviewed improvement candidates:
  - Beads issue proposal
  - memory candidate
  - skill/instruction update proposal
  - custom linter/structural test proposal
- Do not automatically apply feedforward changes.

## Dependency order

### Upstream - must be complete before this task

| Issue                               | Spec                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.4` | [Add inferential sensor checkpoints](./agent-platform-feedback-sensors.4.md) |

### Downstream - waiting on this task

| Issue                               | Spec                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.6` | [Expose sensor controls and validate end to end](./agent-platform-feedback-sensors.6.md) |

## Implementation plan

1. Read `packages/plugin-observability/src/events.ts`, `packages/plugin-observability/src/store.ts`, and `packages/harness/src/tools/observabilityTools.ts`.
2. Add sensor event kinds to observability events.
3. Store compact sensor summaries and evidence references, not full unbounded logs.
4. Store provider availability/auth state so missing GitHub/SonarQube/CodeQL/IDE-plugin access can be explained and retried.
5. Store runtime limitation state so Docker/sandbox access problems can be explained, retried, and distinguished from code failures.
6. Add query support for recent sensor failures, open findings, provider availability, runtime limitations, selected sensor profile, and repeated failure patterns.
7. Integrate with the existing improvement-goals plan if it has landed; otherwise define a pending candidate shape that can be adopted by that work.
8. Add tests for redaction, truncation, ordering, session scoping, and deduplication.
9. Document the feedback flywheel rules: repeated failures propose reviewed feedforward changes, never direct autonomous updates.

## Tests (required before sign-off)

- `pnpm --filter @agent-platform/plugin-observability run test`
- `pnpm --filter @agent-platform/harness run test -- test/observabilityTools.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm typecheck`
- Add tests for:
  - sensor event storage
  - session-scoped sensor queries
  - provider auth/unavailable state storage
  - runtime limitation state storage
  - agent profile and selected sensor profile storage
  - finding deduplication across local and remote sources
  - repeated failure pattern aggregation
  - redaction of command output and paths where required
  - no autonomous mutation from candidate generation

## Definition of done

- [ ] Sensor outcomes are recorded in observability.
- [ ] Normalized findings and provider availability states are queryable.
- [ ] Runtime environment limitations are queryable and distinct from code failures.
- [ ] Sensor outcomes can be filtered by agent profile and selected sensor profile.
- [ ] Agents/users can query recent sensor failures.
- [ ] Repeated failures can produce reviewed improvement candidates.
- [ ] Automatic feedforward mutation is explicitly prevented.
- [ ] `bd close agent-platform-feedback-sensors.5 --reason "Sensor observability and feedback flywheel added"`

## Sign-off

- [ ] Task branch created from `task/agent-platform-feedback-sensors.4`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] If segment tip: N/A - merge at segment end
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
