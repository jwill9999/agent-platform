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
- Add agent scope and capability-profile metadata so sensors can declare whether they apply to coding, personal-assistant, research, automation, or custom agents.
- Represent when a sensor is `required`, `optional`, `manual_only`, or `disabled` for a given agent profile and task context.
- Support feedback sources such as local commands, IDE problems, IDE/plugin terminal output, IDE plugin findings, SonarQube local/remote, CodeQL local/remote, GitHub checks, PR reviews, PR annotations, agent code comments, and user feedback.
- Support trigger/cadence types for `on_meaningful_change`, `before_commit`, `before_push`, `after_push`, `before_completion`, `external_feedback`, `scheduled`, and `manual`.
- Represent provider capability and availability states including `available`, `unavailable`, `auth_required`, `not_configured`, and `permission_denied`.
- Represent sensor result states including `passed`, `failed`, `skipped`, `unavailable`, and `error`.
- Add runtime environment metadata for host, Docker container, Docker compose service, IDE plugin, and future sandboxed command runtimes.
- Represent environment limitation states including `runtime_unavailable`, `missing_mount`, `tool_unavailable`, `network_unavailable`, `path_mapping_required`, and `sandbox_policy_denied`.
- Add normalized finding contracts with source, severity, status, file/line, rule ID, message, evidence, and dedupe keys.
- Add bounded terminal evidence contracts with source command/task name, producer, timestamp, redaction state, output caps, and optional problem extraction metadata.
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
  - imported finding from SonarQube, CodeQL, GitHub annotation, IDE problem, IDE/plugin terminal output, or agent code comment
  - provider unavailable/auth-required result with repair action
  - Docker/container or sandbox runtime limitation with repair action
  - host/container path mapping metadata
  - sensor disabled for personal-assistant profile but required for coding profile
  - manual-only sensor can be selected explicitly without being globally enabled
  - bounded/redacted terminal evidence payload
  - trigger policy serialization
  - invalid definitions rejected by Zod

## Definition of done

- [x] Sensor schemas and types are exported from contracts.
- [x] Agent scope/profile metadata can represent profile-specific required/optional/manual/disabled sensor selection.
- [x] Normalized finding and provider availability schemas are exported.
- [x] Runtime environment and limitation schemas are exported.
- [x] IDE/plugin terminal evidence schemas are bounded and redactable.
- [x] Trace event types can represent sensor lifecycle outcomes.
- [x] Tests cover successful and invalid contract shapes.
- [x] No harness behavior changes are introduced yet except trace typing support.
- [x] Beads acceptance criteria are satisfied.
- [x] `bd close agent-platform-feedback-sensors.1 --reason "Sensor contracts and policy model defined"`

## Sign-off

- [x] Task branch created from `feature/feedback-sensors-harness`
- [x] Required tests executed and passing
- [x] Checklists in this document are complete
- [x] If segment tip: N/A - merge at segment end
- [x] `decisions.md` updated only if architectural decision changed
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
