# Task: Bind detailed planning artifacts to execution approval

**Beads issue:** `agent-platform-pilot-zero.16`

**Spec file:** `docs/tasks/agent-platform-pilot-zero.16.md`

**Parent epic:** `agent-platform-pilot-zero` — orchestration assessment

## Task requirements

Implement DB-1–DB-8 in the [feature plan](../planning/approved-document-binding/plan.md): exact document
manifest, publication integrity, contract/critic/approval binding, enforcement at every execution and
resume boundary, immutable worker input, durable recovery, compatible historical reads and evidence.
This specification is proposed; owner authorized planning/critique, not implementation yet.

## Dependency order

There is no upstream blocking task on this record. The verified restricted-review route from `.15`
is integrated in PR271; that broader task's closure is not claimed here. Existing `.13` depends on
`.16` and remains blocked until implementation, verification, review and integration satisfy this spec.
Related `.9` and `.12` own broader skills/qualification; do not close them from this task's results.
Beads remains authoritative for scheduling.

## Implementation plan

Follow the design, source-entry inventory and bounded sequence in the linked plan. Deliver the schema
and publication path, durable approval enforcement, packet/launch/resume/broker wiring and final
connected tests as one coupled slice. Use a shared guard; do not leave alternate approval paths open.
Keep historical immutable records and existing security controls. Update the existing planning and
implementation guidance after the mechanism is proven, without claiming a managed pilot succeeded.

## Git workflow

Planning branch: `task/approved-document-binding-plan`, from feature merge `5e5f7f2`.
Proposed implementation branch: `task/approved-document-binding`, from the approved planning tip.
One segment-tip review targets `feature/harness-backlog-review`. No main/staging changes or automatic
merge. If the planning PR is integrated first, start implementation from that updated feature baseline
and record its exact SHA. The implementation agent announces the chosen task, branch and approved docs.

## Tests

[Verification plan](../testing/approved-document-binding.md) defines DB-T01–11, covering unit,
filesystem/SQLite integration, real isolated snapshot handoff and final coordinator E2E. It names
fixtures, negative cases, backend effects and limitations. Task `.16` owns the final integration gate.
No unrelated UI feature is added; existing browser/desktop CI remains a regression gate.

## Definition of done

- DB-1–DB-8 and DB-T01–11 are implemented and proven at the recorded revision.
- Every approval producer/consumer and authority-bearing path is mapped and negatively tested.
- Unchanged material passes; changed, missing, tampered or legacy-unbound material blocks authority.
- Durable invalidation and restart behavior are demonstrated; no silent reapproval or inherited bypass.
- Independent plan and implementation critique, required quality gates and owner approvals are recorded.
- Documentation, Beads criteria/edges and actual result evidence agree; no invented runtime approval.
- Segment PR is integrated into the feature branch before closure; no pilot or staging acceptance implied.

## Pre-close sign-off

Pending implementation authorization, tests, independent code review, owner acceptance and feature
integration. Keep this record in progress for planning; do not close it when the draft is reviewed.
After approved closure, reread Beads and `.13` readiness. No close transition exists yet.
