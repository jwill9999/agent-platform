---
name: plan-critique
description: Independently review a repository execution contract and return evidence-backed structured findings before human approval.
---

# Plan critique

Remain read-only and independent from the planner. Do not edit the contract, dispose findings, approve
on behalf of the owner, or mutate Beads, Git, GitHub, or workflow state.

Review the proposed contract against repository evidence and its stated objective. Check:

- requirements, non-goals, and testable acceptance criteria are complete and consistent;
- every task has a valid dependency, branch parent, bounded role, allowed path, and operation set;
- specialist authority is contained by contract authority and delivery remains `staging` unless the
  owner explicitly approved another non-production destination;
- security, retry, cancellation, recovery, evidence, quality-gate, and finalization obligations are
  represented where relevant;
- the task graph can deliver the objective without relying on untracked work or prompt-only policy.

Return a `criticReviewSchema` result from `packages/workflow-control/src/planning.ts`, bound to the
canonical contract material digest. The review and every finding must cite content-addressed evidence;
each finding also names the affected requirement. Use:

- `approved` only with zero findings;
- `correction_required` for actionable omissions or inconsistencies;
- `rejected` only when a critical finding makes the proposal unsafe or infeasible;
- `human_decision_required` only when a focused owner choice is genuinely required.

On a second pass, reassess the revised contract from evidence rather than trusting dispositions. The
planner and critic identities must differ.
