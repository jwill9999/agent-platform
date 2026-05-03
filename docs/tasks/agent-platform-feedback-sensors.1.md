# Task: Define sensor contracts and policy model

**Beads issue:** `agent-platform-feedback-sensors.1`  
**Spec file:** `docs/tasks/agent-platform-feedback-sensors.1.md` (this file)  
**Parent epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-feedback-sensors.1.md`

## Task requirements

Define the shared vocabulary and contracts for feedback sensors before any runtime behavior changes. The model must support executable checks, imported findings, provider availability, and user-facing repair actions.

Required outcomes:

- Add contract types for sensor definitions, trigger policies, sensor run records, sensor results, repair instructions, and evidence links.
- Support at least two execution types: `computational` and `inferential`.
- Support feedback sources such as local commands, IDE problems, SonarQube local/remote, CodeQL local/remote, GitHub checks, PR reviews, PR annotations, agent code comments, and user feedback.
- Support trigger/cadence types for `on_meaningful_change`, `before_commit`, `before_push`, `after_push`, `before_completion`, `external_feedback`, `scheduled`, and `manual`.
- Represent provider capability and availability states including `available`, `unavailable`, `auth_required`, `not_configured`, and `permission_denied`.
- Represent sensor result states including `passed`, `failed`, `skipped`, `unavailable`, and `error`.
- Add normalized finding contracts with source, severity, status, file/line, rule ID, message, evidence, and dedupe keys.
- Add repair actions suitable for UI/agent flows, including `fix_code`, `run_command`, `connect_provider`, `authenticate_cli`, `retry`, `open_external`, `ask_user`, and `defer_with_reason`.
- Extend trace/event contracts with sensor run lifecycle events.
- Keep contracts generic enough for quality gates, SonarQube, browser checks, critic/DoD, observability drift checks, and future custom linters.

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. Do **not** close this issue until every **upstream** task below is already **closed**.

### Upstream - must be complete before this task

| Issue | Spec |
| ----- | ---- |
| None  | N/A  |

### Downstream - waiting on this task

| Issue                               | Spec                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.2` | [Implement computational sensor runner](./agent-platform-feedback-sensors.2.md) |

## Implementation plan

1. Read existing contracts in `packages/contracts/src/codingTool.ts`, `packages/contracts/src/dod.ts`, and `packages/contracts/src/output.ts`.
2. Add `packages/contracts/src/sensor.ts` with Zod schemas and exported TypeScript types.
3. Export the new sensor contracts from `packages/contracts/src/index.ts`.
4. Extend `packages/harness/src/trace.ts` with sensor lifecycle events such as `sensor_run`, `sensor_result`, and `sensor_loop_limit`.
5. Add round-trip tests in `packages/contracts/test/sensor.test.ts`.
6. Add trace typing tests or update existing harness tests that assert trace event discriminants.
7. Document the contract shape in `docs/architecture.md` or `docs/api-reference.md` only if public API exposure is introduced in this task.

## Tests (required before sign-off)

- `pnpm --filter @agent-platform/contracts run test`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm typecheck`
- Add tests for:
  - valid computational and inferential sensor definitions
  - failed sensor result with repair instruction and evidence artifact
  - imported finding from SonarQube, CodeQL, GitHub annotation, IDE problem, or agent code comment
  - provider unavailable/auth-required result with repair action
  - trigger policy serialization
  - invalid definitions rejected by Zod

## Definition of done

- [ ] Sensor schemas and types are exported from contracts.
- [ ] Normalized finding and provider availability schemas are exported.
- [ ] Trace event types can represent sensor lifecycle outcomes.
- [ ] Tests cover successful and invalid contract shapes.
- [ ] No harness behavior changes are introduced yet except trace typing support.
- [ ] Beads acceptance criteria are satisfied.
- [ ] `bd close agent-platform-feedback-sensors.1 --reason "Sensor contracts and policy model defined"`

## Sign-off

- [ ] Task branch created from `feature/feedback-sensors-harness`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] If segment tip: N/A - merge at segment end
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
