# Task: Less-Rigid Execution Policy

**Beads issue:** `agent-platform-ld3`  
**Spec file:** `docs/tasks/agent-platform-less-rigid-execution-policy.md`  
**Parent epic:** capability-oriented orchestration

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-less-rigid-execution-policy.md`

## Task requirements

Implement workspace-configurable execution policy so the old allowlist acts as an auto-run boundary, not a universal hard stop:

- Add `executionPolicy` to platform settings with conservative defaults.
- Keep hard-deny shell checks non-configurable for destructive host actions.
- Route reviewable unknown or state-changing shell commands into the durable approval flow.
- Route registered but unallowlisted tools into the durable approval flow when workspace policy allows.
- Keep missing tools/providers on capability recovery instead of approval.
- Expose policy controls on the Workspace settings page.
- Update approval copy and metadata to describe workspace policy decisions.

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. Do **not** close this issue until every **upstream** task below is already **closed**.

### Upstream — must be complete before this task

| Issue | Spec |
| ----- | ---- |
| None  | N/A  |

### Downstream — waiting on this task

| Issue | Spec |
| ----- | ---- |
| None  | N/A  |

### Planning notes

This task builds on existing HITL approval storage, bash policy classification, workspace settings, and capability recovery output. V1 approvals are intentionally one-shot only.

## Implementation plan

1. Extend contracts and settings persistence with `executionPolicy` defaults and partial update support.
2. Split shell hard-deny validation from approval policy classification.
3. Pass workspace execution policy into harness tool dispatch.
4. Add approval metadata for policy category, reason, target command/tool, and allowlist status.
5. Allow reviewable registered/MCP-backed unallowlisted tools to request approval; leave missing providers/tools on capability recovery.
6. Add Workspace settings controls for command/tool policy categories.
7. Cover contracts, db, harness, API streaming, and web settings behavior with tests.

## Git workflow

Branch: `task/less-rigid-execution-policy`, chained from the prior task branch in the capability recovery segment.

## Tests

- Contracts: settings defaults and partial updates.
- DB: persisted settings merge without dropping existing settings.
- Harness: bash guard, command policy, tool dispatch approval/recovery behavior.
- API: session chat streams policy metadata on approval events.
- Web: Workspace dashboard renders and saves execution policy controls.
- Quality gates: build, typecheck, lint, format check, docs lint, and relevant/full unit tests.

## Definition of done

- [x] Beads description and acceptance criteria satisfied.
- [x] Settings schema and persistence support `executionPolicy`.
- [x] Reviewable unknown shell commands request approval by default.
- [x] Destructive shell commands remain blocked and non-approvable.
- [x] Registered unallowlisted tools can request approval when policy allows.
- [x] Workspace settings exposes policy controls.
- [x] Focused and repository quality gates pass, or any residual gate issue is documented.
- [x] Branch is committed and pushed.

## Sign-off

- [x] Task branch created before implementation work.
- [x] Unit and integration tests executed and passing.
- [x] Definition of done complete except final commit/push.
- [x] PR merge: N/A — merge at segment end.
- [x] `bd close agent-platform-ld3 --reason "..."`
- [x] `session.md` updated for handoff.

**Reviewer / owner:** Codex  
**Date:** 2026-05-22
