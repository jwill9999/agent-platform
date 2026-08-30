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

- [ ] No active-run direct Git/GitHub write credential path exists outside the brokers.
- [ ] Intermediate integration gate and brokered Beads close pass.

## Sign-off

**Owner:** Delivery-security implementation worker  
**Reviewer:** Git/GitHub security reviewer
