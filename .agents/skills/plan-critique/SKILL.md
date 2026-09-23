---
name: plan-critique
description: Independently review a repository execution contract and return evidence-backed structured findings before human approval.
---

# Plan critique

Use the [documentation skill](../documentation/SKILL.md) and its canonical folder guide for artifact
locations, publication responsibility and cross-document consistency.

Remain read-only and independent from the planner. Do not edit the contract, dispose findings, approve
on behalf of the owner, or mutate Beads, Git, GitHub, or workflow state.

## Required independent review

Apply this gate to every feature execution plan before final human approval, whether delivery will
use orchestration or an explicitly permitted direct workflow. An inactive orchestration run does not
waive critique. The planner's self-review and an owner's approval do not substitute for a distinct
critic's assessment.

The coordinating agent supplies a separate critic with the proposed contract, document manifest,
linked task specifications, verification plan, source evidence and unresolved questions. Follow the
[specialist launch boundary](../../../docs/adr/0004-codex-development-orchestration-control-plane.md)
when selecting the reviewer path. Built-in collaboration is permitted only under that boundary;
calling a reviewer read-only in its prompt does not remove its exposed tools or grant isolation.
During a managed run use the supported isolated specialist launcher.

If no compliant reviewer path is available, report independent critique as blocked, identify the
missing capability and retain the draft for review. Do not silently skip the gate, invent a review,
or let the planner approve its own work. This skill defines the procedure; it does not install a
reviewer launcher or authorize changes to isolation policy.

## Review scope and result

Review the proposed contract and complete planning handoff against repository evidence and its stated
objective. Check:

- requirements, non-goals, and testable acceptance criteria are complete and consistent;
- every task has a valid dependency, branch parent, bounded role, allowed path, and operation set;
- specialist authority is contained by contract authority and delivery matches the owner-approved
  destination; do not infer staging or production authority from planning approval;
- security, retry, cancellation, recovery, evidence, quality-gate, and finalization obligations are
  represented where relevant;
- the task graph can deliver the objective without relying on untracked work or prompt-only policy;
- the document manifest resolves to specifications and verification material in the required locations,
  with Beads links, acceptance criteria and dependencies aligned;
- required tests map to requirements, include connected frontend journeys and independent backend-effect
  assertions where applicable, and disclose mocks and unverified boundaries;
- test environments, data, access and cost are feasible, and a named task owns final feature integration;
- failed or unexecuted required journeys prevent sign-off; planned tests are not reported as results;
- unresolved ambiguity has been returned to the human and answered before final agreement;
- publication responsibility and the exact reviewed-version handoff are explicit.

Return a `criticReviewSchema` result from `packages/workflow-control/src/planning.ts`, bound to the
canonical contract material digest. The review and every finding must cite content-addressed evidence;
each finding also names the affected requirement. Use:

- `approved` only with zero findings;
- `correction_required` for actionable omissions or inconsistencies;
- `rejected` only when a critical finding makes the proposal unsafe or infeasible;
- `human_decision_required` only when a focused owner choice is genuinely required.

On a second pass, reassess the revised contract from evidence rather than trusting dispositions. The
planner and critic identities must differ.

Return findings to the coordinating agent for correction or a focused human decision. Findings and
resolution evidence must be preserved through the authorized publication path. Re-review changed
material independently; only after the current review passes and all findings have dispositions may
the coordinator request final human approval under the
[planning rules](../../../docs/workflow-control-planning.md). Material changes after approval repeat
critique and approval. See [feature planning](../feature-planning/SKILL.md) for the complete handoff.
