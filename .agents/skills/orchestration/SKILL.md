---
name: orchestration
description: Assess readiness and start or resume an approved Agent Platform development workflow through supported workflow-control interfaces; surface missing authority or runtime capabilities before execution.
---

# Orchestration

Use for managed development execution, continuation, or readiness assessment. This skill supplies a
procedure, not a launcher, permission grant, or proof of unattended delivery.

## Establish the execution boundary

Read [shared instructions](../../../docs/agent-instructions-shared.md),
[ADR-0004](../../../docs/adr/0004-codex-development-orchestration-control-plane.md), and
[orchestrator guidance](../../../docs/workflow-control-orchestrator.md).
Resolve the canonical repository, Beads task, exact approved contract version/material digest,
critic evidence, source revision, allowed paths/operations, roles, destination, checks, retry and
spend limits. Reuse valid recorded authorization; ask only for missing material decisions.
Do not equate merged planning, a general go-ahead, or product Ask/Auto/Block with a workflow grant.

## Choose new run or continuation

Establish task eligibility before looking for workflow state. Use a supported read-only status
interface for the canonical workspace and matching task/material. Check run identity, terminal state,
leases and ownership; never initialize a database merely because lookup failed.

- A matching nonterminal run: assess authorized continuation and current runtime health.
- Confirmed no matching run: assess readiness to create a new run. Absence is not a manual fallback.
- Failed, ambiguous, or unavailable lookup: report unknown state; do not create a possible duplicate.
- Completed or cancelled run: inspect its outcome; do not restart it or assume its grants apply anew.

## Verify the actual execution path

Read [security](../../../docs/workflow-control-security.md) and
[continuations](../../../docs/workflow-control-continuations.md) for the selected host.
Verify the installed supported launcher, immutable isolated environment, credential broker, policy
binding, result import, phase coordination, notification/continuation, and evidence retrieval.
Confirm effective model selection and budget without exposing credentials or issuing a paid call.
Read source when documentation and installed capabilities disagree; record the mismatch.

The repository MCP server currently exposes status and resume preview only. Neither launches work.
The standalone phase runtime currently rejects implementation artifact import; phase completion
and desktop continuation also have explicit unsupported paths. Recheck these in
[phase runtime](../../../packages/workflow-control/src/phaseRuntime.ts),
[phase jobs](../../../packages/workflow-control/src/phaseJobs.ts), and
[continuation worker](../../../packages/workflow-control/src/continuationWorker.ts).
[Bootstrap](../../../packages/workflow-control/src/bootstrap.ts) can adopt an approved candidate and
broker delivery; that is not proof of a complete autonomous implementation cycle.
Do not invent a start command, edit journal state to bypass a gate, or substitute a generic subagent.

Only use a verified supported start/resume operation when its prerequisites and exact scope are
satisfied. If unavailable, return a concrete blocker with the missing capability, evidence and next
bounded assessment or repair. Do not launch to discover an already-known authorization failure.

## Follow the run through its outcome

During an active run, use journaled brokers exclusively for Beads, Git and delivery mutations.
Follow the approved dependency graph: verified acceptance of a predecessor enables the next task;
failure or unresolved authority prevents progression. Observe persisted evidence and runtime health;
missing updates alone do not prove failure. Stay within approved retries and stop/recovery policy.
Preserve approval across handoffs only where its binding remains valid; changed material, revocation,
or a genuine exception requires the appropriate decision, not routine repeated permission prompts.

Report selected mode, run state, checks and artifacts, manual interventions, blockers, and the next
permitted step. Separate static checks, simulated evidence, supervised execution and live autonomous
acceptance. Record gaps in the [field evaluation](../../../docs/reviews/orchestration-field-evaluation.md)
under the applicable broker/manual write rules. Use the
[staged assessment](../../../docs/reviews/orchestration-staged-assessment.md) before claiming pilot success.
