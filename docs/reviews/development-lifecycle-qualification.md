# Development lifecycle qualification

Task: `agent-platform-pilot-zero.17`. Planning and supervised implementation scope only;
no managed run, pilot, staging promotion or task-completion claim.

## Planning critique

Four isolated reviews examined source-bound snapshots through the existing qualified reviewer.
[First review](development-lifecycle-evidence/plan-review-1.json) identified interruption persistence,
monitoring, independent cleanup, service ownership, stale-owner fencing, effect reconciliation,
diagnostics and fault-injection gaps. The implementation design specifies those contracts.
[Second review](development-lifecycle-evidence/plan-review-2.json) required transactional callback
guards, retained workspace evidence, deadline/late-attempt fencing and a dedicated probe TTL protocol.
[Third review](development-lifecycle-evidence/plan-review-3.json) required independent recovery
prerequisites, lost-response probe reconciliation and a reachable private-network probe location.
All were incorporated into the design.

[Final recheck](development-lifecycle-evidence/plan-review-4.json) reports no remaining actionable
scope-design findings in those corrections, consistent with the complete design. This is independent
scope review, not persisted managed-run approval or evidence that runtime behavior works. The later
branch/merge bookkeeping update records PR275 integration without changing the reviewed behavior.

## Implementation and verification checkpoint

Implementation is active on `task/development-lifecycle-plan`, after incorporating the PR275 feature
merge. No live pilot or staging promotion has run. The [operator guide](../workflow-control-development.md)
describes the foreground command and its explicit approved-runtime boundary.

The first two isolated implementation reviews found actionable issues. The first required fresh
admission checks, exact runtime binding, recovery before readiness, crash-safe finalization, durable
cleanup accounting, persistence-failure containment, validated shutdown identity and operator-config
binding. The second identified issuance compensation ordering, cleanup authority independent of
execution leases, bounded attached-process shutdown, credential-file sanitization and cleanup-aware
readiness. Repairs and targeted checks are in progress; these reviews are not approval.

- [First implementation review](development-lifecycle-evidence/implementation-review-1.json).
- [Second implementation review](development-lifecycle-evidence/implementation-review-2.json).
- Real CLI/container service lifecycle check passed startup, competing-owner/config rejection,
  broker interruption, explicit recovery and idempotent restart.
- A real disposable worker wrote an evidence marker; the production host recorded interruption while
  the broker was unavailable and reconciled cleanup without repeating that marker. The worker used
  a deterministic fixture executable, not an autonomous model-driven task. Real account/provider
  discovery was separately exercised; no paid generation was requested by this check.
- Thirteen existing real-container role-isolation checks passed.
- Targeted Linux checks passed at intermediate revisions. The first full run found a clock-injection
  regression in the new staging binding; the affected 85-test rerun passed after repair.
- Further cleanup-authority and shutdown repairs still require final regression, connected recheck,
  independent review and hosted checks. No final pass or completed qualification is claimed here.

The [scenario matrix](../testing/development-lifecycle.md) remains the acceptance authority. Record the
final commands, counts and source identities after verification. `.17` remains open for this work and
R1–R3, and `.13` remains blocked.
