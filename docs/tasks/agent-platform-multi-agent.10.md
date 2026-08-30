# Task: Run autonomous feature-delivery pilot

**Beads issue:** `agent-platform-multi-agent.10`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Deliver one bounded real repository feature through the approved control plane and collect the final
evidence required to authorize continued use.

## Requirements

- Select a low-risk pilot with explicit human-approved contract and protected-`staging` destination.
- Seed at least one plan omission and one implementation/verification failure.
- Exercise isolated specialists, repair, review, QA, Sonar, hosted/self-hosted CI, delivery, finalizing,
  Beads epic close, Dolt sync, and final reporting.
- Do not promote `staging` to `main` or production without a separate human approval.
- Record residual risks, cost, latency, retries, conflicts, and recommended policy tuning.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.9`.
- **Downstream:** None; this is the segment tip.
- **Branch parent:** `task/agent-platform-multi-agent.9`.

## Implementation plan

1. Approve the pilot contract and exact capability/delivery envelope.
2. Run the workflow without manual restart, recording all transitions and evidence.
3. Resolve seeded failures through bounded loops.
4. Verify protected-staging delivery and authoritative closeout.
5. Publish the final acceptance trace and operational recommendation.

## Tests and verification

- All local, Sonar, review, QA, hosted, and required self-hosted gates pass for the exact delivered head.
- One final task-tip PR merges into `feature/multi-agent-orchestration`; cumulative feature gates then
  authorize the feature-to-`staging` PR only.
- Final report maps every epic criterion to immutable evidence.

## Definition of done

- [ ] End-to-end pilot acceptance criteria pass without unauthorized human intervention.
- [ ] Segment-tip PR and all hosted checks pass.
- [ ] Feature delivery stops at protected `staging`.
- [ ] Beads/Dolt and workflow finalization are verified.

## Sign-off

**Owner:** Workflow orchestrator  
**Reviewers:** Independent code, security, QA, and feature evaluators
