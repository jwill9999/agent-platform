# R2 artifact import and R3 coordinator qualification — draft

Status: incomplete; not merge-ready. Beads: `agent-platform-pilot-zero.17`.
Branch: `task/artifact-import-coordinator`.
Baseline: PR277 merged to `feature/harness-backlog-review` at
`b7be3d6fcbf62c257e68f24dc46eca397cd02ffb`.

## Scope and execution mode

The owner authorized R2 governed worker-produced changes and R3 coordinator completion.
The [approved scope](../planning/standalone-pilot/plan.md) and
[verification matrix](../testing/standalone-pilot-prerequisites.md) remain authoritative.
Work uses the explicitly permitted supervised prerequisite route. It does not establish an
orchestrated task cycle. No live pilot, real delivery mutation, merge or staging promotion occurred.
The canonical journal was inspected read-only: four cancelled runs and no live leases at admission.
Notion alignment remains a separate deferred task.

## R2 implemented draft

The worker returns a bounded UTF-8 regular-file envelope with task, execution, base, approved-material
and content digests. It supports additions, modifications and deletions; limits are 256 files,
1 MiB per file and 16 MiB total. It rejects forbidden paths, binaries, renames, modes and symlinks.
Source is collected only after worker settlement and credential revocation.

The trusted importer records prepared/applied/verified intent, compares the approved Git base,
checks retained evidence and current leases, imports to the exact task ref and records a committed
callback only after verification. Crash replay reuses the recorded intent. Uncertain partial writes
block recovery instead of repeating edits. Pinned Git disables hooks and filesystem monitors and
rejects filters and index flags that hide changes. Checked directory anchors prevent pathname
redirection through symlink parents. Git ref publication uses a prepared transaction and checks the
immutable deadline before the commit decision; lock acquisition is non-waiting.

This does **not** yet guarantee exclusion of a concurrent editor or another host process writing
the destination. Same-inode changes after inspection can be overwritten. Workflow leases exclude
managed agents, not arbitrary filesystem writers. Independent review identified this as an
unresolved high-severity finding. Do not advertise safe shared-checkout import or approve R2 yet.

## R3 implemented draft and missing qualification

Typed coordinator proofs and receipts distinguish actual committed broker operations from generic
callback evidence. Phase bookkeeping can queue one successor from a verified coordinator receipt.
The draft production composition connects existing task acceptance, exact-head integration, pipeline,
delivery and finalization classes through a pinned operator service adapter. The adapter has explicit
configuration and an empty inherited environment; missing configuration blocks execution.

This composition is incomplete. Repair handoff and later verified acceptance need consistent durable
state; feature evaluation and repair planning are not enabled by the standalone packet path. Initial
feature evaluation and evaluation of an integrated delivery head must retain their different approval
requirements. The finalization path must satisfy the existing mandatory feature-delivery contract;
it cannot bypass it to close a fixture. Pending/failed pipeline checks, uncertain external operations,
coordinator restart and shutdown reconciliation still need connected coverage. Direct adapter process
cancellation is tested; descendant-process containment and cancellation of gate commands are not.
No live operator adapter has been qualified. No full R3 independent review or end-to-end pass exists.

## Executed evidence and limits

- Package build and lint pass; repository-wide type checks pass at this checkpoint.
- The focused import/phase suite passed 73 tests, including one real Docker journey through the
  production CLI/runtime, credential broker, actual Codex tool execution, retained output, import,
  Git commit and callback. Its model Responses transport is controlled and its credentials are dummy;
  this is not live model-service evidence or an orchestration pilot.
- A later focused Git/import suite passed 32 tests, including real ref-lock contention, expired
  authority, exact-head publication and stale compare-and-swap rejection.
- Four coordinator transport tests pass: structured invocation without host credential inheritance,
  changed executable/revoked admission, revocation before reply acceptance and direct process stop.
  macOS may inject its locale environment value; no host credential is permitted by the test.
- Earlier full sequential results were 1,035 passed, two failed and 64 skipped. The two launcher
  failures were retested successfully after the absent-path fix. A fresh full run is pending;
  the earlier run is not reported as green. Required skipped scenarios remain unqualified.
- Independent isolated reviews found and drove corrections for source identity, callback head
  binding, Git configuration, recovery admission, absent new paths, symlink races and lease timing.
  Focused review 7 found no concrete defect under commit-dispatch deadline semantics, but noted
  that publication can finish after the deadline. That limitation remains explicit; it is not proof
  of publication-before-expiry. Added deterministic adapter tests prove no commit after delayed
  preparation and uncertain status when commit acknowledgement is lost (seven Git tests pass).
  Review evidence is advisory,
  not execution approval. R3 has not received final independent review.

Retained evidence snapshots live in `docs/reviews/evidence/artifact-import-coordinator/`.
Tests do not qualify staging, paid service latency, host editing races or unattended final delivery.
The Sonar/Problems completion gate remains **blocked** by the unresolved import finding and missing
required connected coordinator coverage, even where individual build/lint/type/test checks pass.

## Decision and continuation boundary

The owner has been asked whether to qualify a broker-owned isolated import workspace instead of
rewriting a shared checkout. That changes workspace ownership and must not be silently assumed.
The plan limits repeated repairs per finding; the concurrent-writer finding has reached escalation.
A separate earlier question about the later pilot delivery target is not a blocker for disposable
coordinator qualification and does not expand this repair's delivery authority.

After the workspace decision, complete the bounded import design and its adversarial tests, finish
coordinator composition and connected recovery/repair/finalization tests, rerun the exact changed
source checks and independent review, then present a ready PR only when all required gates pass.
Keep `.17` open and `.13` blocked. A draft checkpoint is preservation, not completion or approval.
