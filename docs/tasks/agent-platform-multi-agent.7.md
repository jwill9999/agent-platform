# Task: Implement Git/ref and GitHub delivery brokers

**Beads issue:** `agent-platform-multi-agent.7`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Implement the only authorized task-ref, commit, push, pull-request, check, wait, and merge mutation
paths for an active run.

## Requirements

- Add typed Git/ref operations for approved branch creation, exact-tree commit, and CAS push.
- Add typed GitHub operations for PR/check observation and merge to protected `staging`.
- Bind every operation to repository, task/run, exact SHA/tree, contract, policy, role, and fence.
- Deny force pushes, arbitrary/protected refs, hooks/config injection, arbitrary API/workflow actions,
  stale heads/checks, changed bases/protection, credentials, and admin bypass.
- Journal and reconcile each operation through the shared saga protocol.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.6`.
- **Downstream:** `agent-platform-multi-agent.8`.
- **Branch parent:** `task/agent-platform-multi-agent.6`.

## Implementation plan

1. Implement Git/ref schemas, safe environment, tree validation, commits, and CAS pushes.
2. Implement GitHub PR/check/merge adapter and durable wait events.
3. Add stale-state revalidation immediately before every mutation.
4. Add crash recovery and comprehensive negative authorization tests.

## Tests and verification

- Exercise allowed delivery and every denied ref/tree/credential/API/protection condition.
- Inject crashes before/after commit, ref, push, PR, check, wait, and merge operations.
- Run build, typecheck, lint, format, integration tests, and Sonar analysis.

## Definition of done

- [x] No active-run direct Git/GitHub write credential path exists outside the brokers.
- [x] Intermediate integration gate and brokered Beads close pass.

## Completion evidence

- Typed, contract-bound Git/ref and GitHub requests are journaled through a fenced durable saga with
  exact replay, takeover adoption, reconciliation, and stable escalation.
- The Git port verifies canonical repository identity, exact trees and complete rename/copy diffs,
  blocks executable Git configuration and replacement metadata, and delegates only exact CAS pushes
  through a captured narrow remote client.
- The GitHub port permits only exact PR creation, check observation, and conditional protected merge;
  immutable merge attestation and the current/published head ledger reject stale or substituted PRs.
- Durable pipeline waits enforce exact contract and task binding, monotonic backoff, immutable
  deadlines, takeover recovery, idempotent response-loss replay, and exactly-once terminal cleanup.
- Production composition uses a package-private registration, frozen composite, and captured bound
  concrete/client methods; adversarial method-replacement regressions cover every dispatch layer.
- The final independent critic pass reported no actionable findings. Workflow-control gates passed:
  175 package tests (including 35 delivery tests), with one Docker test skipped in the normal run,
  plus the separately executed Docker isolation test, build, typecheck, lint, formatting,
  documentation lint, dependency-cycle analysis, and diff checks.

## Sign-off

**Owner:** Delivery-security implementation worker  
**Reviewer:** Git/GitHub security reviewer
