# Task: Implement QA, feature evaluation, and secure evidence

**Beads issue:** `agent-platform-multi-agent.8`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Implement behavioral QA, feature-contract evaluation, secure evidence storage, and contract-bounded
append-only repair children.

## Requirements

- Store hashed, content-addressed, size-bounded evidence with producer/run/contract/head identity.
- Redact and secret-scan before persistence; enforce role reads, immutability, retention, and deletion.
- Map QA and feature results to acceptance criteria and exact commits.
- Create only pre-authorized repair children with derived ids, linear branch/dependency semantics, and
  bounded scope/paths/roles; otherwise return to human approval.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.7`.
- **Downstream:** `agent-platform-multi-agent.9`.
- **Branch parent:** `task/agent-platform-multi-agent.7`.

## Implementation plan

1. Implement evidence metadata/blob storage, scanning, access, retention, and tombstones.
2. Implement QA/evaluator packets and acceptance traceability.
3. Implement repair-envelope validation and brokered append-only child/ref creation.
4. Add security, tamper, and repair-scope fixtures.

## Tests and verification

- Reject traversal, symlink escape, secrets, unsupported/oversized media, tamper, and unauthorized reads.
- Accept an in-envelope repair child; reject count/path/role/authority expansion.
- Run build, typecheck, lint, format, browser/Playwright where applicable, and Sonar analysis.

## Definition of done

- [ ] Evidence and repair paths satisfy security and traceability contracts.
- [ ] Intermediate integration gate and brokered close pass.

## Sign-off

**Owner:** Evidence/QA implementation worker  
**Reviewer:** Security reviewer and feature evaluator
