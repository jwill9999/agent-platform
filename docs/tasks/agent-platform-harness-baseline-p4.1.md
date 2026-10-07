# Single-task pilot: hard path restrictions after legitimate approval

Planning: `agent-platform-pilot-zero.13`. Execution task: `agent-platform-harness-baseline-p4.1`; parent: `agent-platform-harness-baseline-p4`.
Spec: `docs/tasks/agent-platform-harness-baseline-p4.1.md`. Owner approved this scoped subtask on 29 September.
Read the [plan](../planning/single-task-permission-pilot/plan.md), [canonical P4 spec](agent-platform-harness-baseline-p4.md) and
[verification plan](../testing/single-task-permission-pilot.md) together. This is the scoped child specification, not permission to close the wider P4 task or launch execution.

## Dependency and authorization

Blocked by `agent-platform-pilot-zero.13`: exact plan, feasibility, critique and persisted owner approval.
Task creation is approved; execution remains unstarted. Branch proposed: `task/single-task-permission-pilot`,
parent/destination `feature/harness-backlog-review`; no merge/staging authority.

## Requirements and implementation boundary

Implement PP1–PP3 as test-only changes in `packages/harness/test/toolDispatch.test.ts` and
`apps/desktop/e2e/packaged-vm-command.e2e.ts`. Publish results in
`docs/reviews/single-task-permission-pilot-results.md` (future output, not existing evidence).
Use the existing local provider HTTP fixture and disposable project/app-data fixtures. Never use
personal project files, global user settings, paid external providers or a real outside sentinel.
The outside sentinel must be a sibling within the disposable test root, outside the approved project.

Done for this slice means the allowed write succeeds once, subsequent escape is denied, outside
bytes remain unchanged, durable audits/approval identities agree, and backend plus connected UI
checks pass. Managed phase progression, imported artifact integrity and independent review must also
be demonstrated. Failure, skip, unavailable environment, uncertain cleanup, unexplained approval or
manual progression remains explicit and blocks pilot acceptance. Wider P4 remains open.

## Verification and definition of done

The PP-U1, PP-E1, PP-O1 and PP-G1 scenarios are mandatory. Independent reviewer and delivered-head
checks must pass; retain logs and material/revision bindings. On application defects, preserve evidence
and stop rather than changing product behavior. Close this child only after its declared delivery
gate; the parent P4 keeps the remaining category/scope coverage.
