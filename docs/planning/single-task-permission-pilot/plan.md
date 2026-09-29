# Single-task permission pilot — proposed planning handoff

Status: draft for independent review, not approved or launch-ready. Planning owner:
`agent-platform-pilot-zero.13`. Proposed execution task: owner-approved scoped child
`agent-platform-harness-baseline-p4.1`, **only the bounded post-approval hard-path restriction slice**.
This does not complete the broader P4 matrix or authorize a live run.

## Objective and requirements

Prove one managed implementation → test runner → independent code reviewer cycle, with governed
artifact import, coordinator progression and a reviewable result, without a human restarting phases.
The useful product evidence is that a legitimate approval never grants access outside its scope.

- PP1: Establish an allowed in-workspace write under Ask, approve it through the real UI, and verify
  its actual bytes and durable approval/audit outcome.
- PP2: In the same session, request an out-of-workspace write with a new tool-call identity. Verify
  denial, unchanged outside sentinel, no successful execution audit and no reuse of the first approval.
- PP3: Add backend regression coverage for the same sequence using real dispatch/policy/path checking,
  with executor-call assertions; retain the connected Electron journey as separate evidence.
- PP4: Record phase/run/task identities, exact revisions, import and verification receipts, handoff
  timestamps, retries and every human intervention. A manual restart is a pilot finding, not success.
- PP5: Publish evidence and a reviewable branch/PR; no staging, merge, task over-closure or second pilot.

This slice tests approval scope across successive requests. It does not mutate an already-approved
request's arguments or claim to test an approval-time TOCTOU attack. Such cases remain separate P4 gaps.
No framework migration, A2A, parallel tasks, new MCP access, real external model benchmark or product
permission-policy changes. If a test reproduces a product defect, preserve it and stop this test-only
pilot for triage; the broader historical repair rule is deliberately not exercised by this proposal.

## Identity and publication mapping

| Item                           | Exact reference                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Planning task                  | [agent-platform-pilot-zero.13](../../tasks/agent-platform-pilot-zero.13.md)                                  |
| Proposed execution task        | [agent-platform-harness-baseline-p4.1](../../tasks/agent-platform-harness-baseline-p4.1.md)                  |
| Specification addendum         | [Scoped task specification](../../tasks/agent-platform-harness-baseline-p4.1.md), read together with P4 spec |
| Verification plan              | [PP scenarios](../../testing/single-task-permission-pilot.md)                                                |
| Proposed contract              | `execution-contract.v1.json` in this folder                                                                  |
| Proposed scope policy          | [Planning policy](planning-policy.md); not installed runtime authority                                       |
| Review result                  | [Reviewer repair and handoff report](../../reviews/reviewer-skill-evidence-qualification.md)                 |
| Canonical repository/Beads     | `/Users/letuscode/projects/agent-platform`                                                                   |
| Current planning checkout      | `/Users/letuscode/projects/agent-platform-workflow-evaluation`                                               |
| Current planning branch        | `task/reviewer-skill-evidence`                                                                               |
| Proposed execution branch      | `task/single-task-permission-pilot` (not created)                                                            |
| Parent and delivery target     | `feature/harness-backlog-review`; no merge authority                                                         |
| Inspected integration baseline | `43157a8c99293da9c3894fe3c46d54cf877cf4ba` (PR279)                                                           |

Before launch, the reviewer repair must be integrated. Re-pin the actual feature head and complete
published document manifest, revalidate and re-critique any material changes, and record owner approval
through the supported approval API. The proposal's source is not a claim about a future merge commit.
Beads retains parent P4 open for its remaining category/scope matrix even if this slice passes.
The owner approved creating child `agent-platform-harness-baseline-p4.1` on 29 September. Its dependency
on `.13` blocks execution until the exact plan and required approval are complete. Only this child may
close when its own delivery criteria pass; do not mutate the wider P4 acceptance boundary.

## Roles, limits and technical handoff

Implementation worker may edit only the two named existing test files and the pilot result report.
Test runner verifies from a source snapshot with separate scratch/evidence writes; reviewer source is
read-only. Feature evaluator assesses the integrated evidence. Trusted coordinators own import, Git,
Beads and delivery; model workers never inherit those credentials or host MCP configuration.

Proposed maximums: two implementation attempts, two finding attempts, two infrastructure attempts,
300 seconds for any bounded wait. Zero automatic child repairs or scope expansion. Use the existing
Codex account only; no paid API key/provider or extra subscription. The owner budget remains $25/month
for role experiments, which this proposal does not authorize. Before launch prove how the runtime
bounds model execution and records usage; unknown dollar cost is not zero cost. Stop at quota failure.

The contract is a schema-valid **proposal**, with a planning-policy hash, not an installed broker
policy digest. No persisted run, policy grant or execution approval is created. Finalization must close only the scoped child, never all of P4. Launch remains blocked until runtime
coordinator authority is bound and the owner reviews the exact material.

## Readiness gaps to resolve before final agreement

1. Integrate this reviewer repair and reconcile `.10`/`.11`/`.12` and `.17` in live Beads; do not infer
   closure from static review or a healthy broker.
2. Verify child `.1` dependency and acceptance records at launch; the owner-approved child resolves
   the earlier P4 sub-slice/task-close mismatch without changing the parent acceptance criteria.
3. Qualify the **actual managed test-runner image** for repository dependencies, Node 24, pnpm,
   Electron/Chromium and Linux Xvfb or the supported macOS host. Worker snapshots exclude node_modules;
   a successful reviewer container does not prove application test feasibility. Verify approved
   scratch builds can consume source without making source mounts writable. Do not inherit host deps.
4. Bind the supported guarded admission, operator startup and configured production coordinators to
   the exact task/source/material, including feature evaluation, evidence return and delivery. The
   development host is currently stopped and has no workflow configured. Do not use journal edits or
   a generic subagent as a launch workaround.
5. Bind installed policy, exact documents, limits and current review to persisted owner approval.
   Recheck discovery, broker, credential issue/revoke, image and gateway immediately before launch.

The coordinator can prepare this draft under current authorization. Resolving new runtime changes or
launching the pilot is not included. Missing feasibility keeps final approval readiness blocked.

## Independent draft critique and unresolved execution bindings

The [draft critique](../../reviews/evidence/reviewer-skill-evidence/pilot-draft-review.json) identified
additional admission work. Owner-approved P4.1 resolves the task-closure mismatch. PP-E1 now specifies
real dispatch, a typed hard-path denial, distinct call/approval identities and a writable-fixture control.

External prerequisites are not omitted execution-graph nodes: this single-task contract has no internal
dependencies, while Beads P4.1 is blocked by `.13`; `.13` is blocked by `.12`, `.16`, `.17`. The parent
P4 coverage map is closed in Beads. Refresh all these statuses and their evidence before admission;
closure of `.16` or the map is not permission to bypass the open gates. Never insert nonexistent graph
nodes simply to mirror external Beads prerequisites.

The production phase acceptance path still needs a concrete check: do not require a verifier or worker
to claim future delivery has already passed. The revised draft acceptance criteria describe the test
outcome; PP-O1/delivery checks remain final pilot gates. Verify actual phase-specific result acceptance
and final coordinator checks against the installed policy before launch. The role-specific launcher
policy must intersect task operations with each role; a task-level list alone cannot enforce a reviewer's
read-only boundary. Existing role qualification is reference evidence to bind to the actual policy/image,
not a substitute for checking emitted packets for this run.

Proposed execution ceilings, subject to verified host support: 10 minutes per model attempt, 60 minutes
aggregate active run time, existing two-attempt counters (including failed attempts), and cancellation
with durable interruption/cleanup on exhaustion. The 300-second wait deadline is separate. If the
installed runtime cannot enforce these ceilings, report the gap and revise scope with the owner; do
not implement a new watchdog or treat prose as enforcement. No dollar-cost estimate is invented.

The draft contract intentionally omits installed coordinator delivery/closure authority and persisted
approval. Its publication manifest will bind the draft bytes, but that is not authorization to run them.
Remaining runtime binding/feasibility gaps block final agreement, not just the start command.
