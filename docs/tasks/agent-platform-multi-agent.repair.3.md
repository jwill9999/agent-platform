# Task: Repair the pilot workspace binding

**Beads issue:** `agent-platform-multi-agent.repair.3`

**Parent task:** `agent-platform-multi-agent.10` — Run autonomous feature-delivery pilot

## Summary

Replace the unusable workspace-bound pilot authority with a new immutable recovery contract and use
a new brokered task-to-feature merge as the only origin for subsequent protected-staging delivery.

## Requirements

- Preserve the original invalid contract, PR #252, and the empty failed `47138…` workflow journal as
  historical evidence; do not adopt, rewrite, replay, or delete them.
- Add the exact schema-valid recovery contract at
  `docs/reviews/2026-08-31-multi-agent-recovery-contract.json`.
- Record that the original workspace digest included a trailing newline and that the correct raw
  canonical `realpathSync` digest is `sha256:28d0df6d…`.
- Keep changes within `.beads` and `docs`; do not change workflow-control source code.
- Obtain independent critic and explicit owner approval before brokered execution.
- Before merging this task to the feature branch, persist a fresh owner-approved staging intent bound
  to the exact repair head and current staging protection snapshot.
- Squash-merge only to `feature/multi-agent-orchestration`, without administrative bypass.

## Implementation plan

1. Validate the exact recovery contract schema, execution digest, and material digest.
2. Record the invalid prior binding, quarantined empty journal, and corrected recovery procedure in
   the pilot report and authoritative Beads task record.
3. Obtain independent review of the exact contract and repair candidate, then explicit owner
   approvals at each immutable boundary.
4. Use the production delivery broker for the task ref, exact-tree commit, CAS push, PR, checks, and
   squash merge.
5. Use the committed repair merge attestation—not PR #252—to derive the feature-to-staging contract.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.10` task merge PR #252 and its failed historical-adoption
  review.
- **Downstream:** exact feature-to-`staging` contract review and approval.
- **Branch parent:** `feature/multi-agent-orchestration` at its exact approved head.

## Tests and verification

- Execution-contract schema validation and canonical digest derivation.
- Workspace digest recomputed from the raw canonical repository path.
- Prettier, markdownlint, and link validation for changed documentation.
- Independent critic review of the exact contract and repair candidate.
- Hosted `verify`, `docker`, `e2e`, `desktop-e2e`, `markdownlint`, `lychee`, and
  `deps:check-cycles` at the exact published repair head.

## Definition of Done

- [ ] The exact recovery contract and task records are independently reviewed and owner-approved.
- [ ] The original invalid contract, empty failed journal, and PR #252 remain quarantined evidence.
- [ ] A brokered repair PR passes every required feature-boundary check and squash-merges without
      bypass into `feature/multi-agent-orchestration`.
- [ ] The new merge attestation is the sole origin of the separately approved staging contract.
- [ ] No staging-to-main or production promotion occurs.

## Sign-off

**Owner:** Authenticated human approver

**Executor:** Workflow orchestrator

**Reviewer:** Independent plan critic
