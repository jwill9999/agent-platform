# R2 artifact import and R3 coordinator qualification — draft

Status: incomplete; not merge-ready. Beads: `agent-platform-pilot-zero.17`.
Branch: `task/artifact-import-coordinator`.
[Draft PR278](https://github.com/jwill9999/agent-platform/pull/278) is preservation only.
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

The owner approved changing workspace ownership after the concurrent-editor finding. Import now
creates a broker-private checkout with independent source inodes, index and Git objects; it never
rewrites the original checkout. The durable registry binds run/source/directory identity and recovery
fails closed if that identity changes. Worker containers receive separate copies or bounded source
evidence, never the broker checkout. Original document paths remain the approval authority. Git
replacement refs and grafts are rejected; the last published SHA is retained for remote push CAS.

This protects the original checkout from import overwrites; it is not a sandbox against a hostile
same-UID host process or a Docker administrator. The broker workspace is retained for recovery and
must not be manually edited. Missing or dirty recovery state blocks progress rather than being reset.

New evidence: 33 importer tests pass, including concurrent same-inode editor writes during modification
and deletion, symlink replacement, independent files and crash replay. A focused 71-test runtime,
Git-delivery and coordinator-transport run passes. The real Docker qualification now passes both the
single import and a continuously supervised implement → verify → review journey: the test runner reads
the imported source, the reviewer receives that exact source through its bounded evidence input,
and all three phases complete without a human restart. Controlled model transport/dummy credentials
remain explicit. This does not qualify the later coordinators or the live pilot.

Independent review 8 identified lost published-head CAS state, outdated fixture source assumptions
and Git replacement metadata. Corrections are implemented. Review 9 found no confirmed actionable R2 defect under the stated
private-workspace threat model. Its requested missing/replaced/symlinked registry and private-object
CAS publication tests now pass. Per-command authority renewal also fixes an observed synchronous
clone lease-expiry regression without extending the execution deadline.

## R3 implemented draft and missing qualification

Typed coordinator proofs and receipts distinguish actual committed broker operations from generic
callback evidence. Phase bookkeeping can queue one successor from a verified coordinator receipt.
The draft production composition connects existing task acceptance, exact-head integration, pipeline,
delivery and finalization classes through a pinned operator service adapter. The adapter has explicit
configuration and an empty inherited environment; missing configuration blocks execution.

The current draft additionally connects bounded repair dispatch and verifier acceptance, task-head
feature evaluation, persistent pipeline waits, prepared delivery reconciliation, bounded coordinator
recovery and closeout lease renewal. Gate and adapter commands use abortable POSIX process groups.
The trusted coordinator configuration must explicitly supply approved parent SHAs; no empty policy
or inferred parent is accepted. Review 10 found five defects; fixes are implemented but follow-up
review and connected qualification are not yet complete.

Repeated repair keeps its canonical finding identity and budget while separately binding a newer
failure observation to producer evidence and a descendant head. Finalization receipts reject reports
for another run, feature, repository or task. Fifty-five queue/transport tests and 29 repair tests
pass, including bounded recovery, stale-owner rejection and repeated-finding attempts. These are
component tests, not the SP-11/SP-13 full production composition.

This composition remains incomplete: repair planning/child dispatch, integrated-head evaluation,
approved feature delivery and finalization are not yet composed end to end. The finalization path
must satisfy the existing mandatory feature-delivery contract; it cannot bypass approval to close a
fixture. Pipeline/recovery fixes still need production-composition crash tests. Process-group abort
is tested with an ordinary descendant; hostile process escape is outside that guarantee. No live
operator adapter or full R3 unattended cycle has been qualified.

## Follow-up review 11

The follow-up found five further boundaries: integration must use the configured approved parent;
resource-lease contention must not consume coordinator recovery budget; retained successful checks
must settle any existing durable wait and obey its deadline; a repair callback must contain an
actionable hypothesis; and the initial implementation must consume its attempt budget.
Draft fixes are in place. Initial execution reserves a durable attempt once; repair execution reuses
its dispatch reservation. Non-actionable verifier results escalate before queuing repair, rather than
looping on missing information. None of these changes waives the pending full composition tests.

## Latest regression checkpoint

The first broader private-workspace run reported 1,053 passed, 17 failed and 65 skipped. Fifteen
failures exposed bootstrap source identity being incorrectly treated as owned-import identity;
explicit ownership tracking fixes that regression and all 65 bootstrap/storage checks now pass.
One queue test observed an older module during active editing; the isolated fresh 55-test run passes.
The remaining storage identity test used a 100 ms lease while performing unrelated verification;
its lease-expiry assertions are separate, and a longer fixture lease removes this timing dependency.
All 28 storage tests pass independently. Retain the failed run; it is not final-head green evidence.

## Earlier executed evidence and limits

- Package build and lint pass; repository-wide type checks pass at this checkpoint.
- The focused import/phase suite passed 73 tests, including one real Docker journey through the
  production CLI/runtime, credential broker, actual Codex tool execution, retained output, import,
  Git commit and callback. Its model Responses transport is controlled and its credentials are dummy;
  this is not live model-service evidence or an orchestration pilot. The same real-container
  journey passed again after the Git deadline correction.
- A later focused Git/import suite passed 32 tests, including real ref-lock contention, expired
  authority, exact-head publication and stale compare-and-swap rejection.
- Four coordinator transport tests pass: structured invocation without host credential inheritance,
  changed executable/revoked admission, revocation before reply acceptance and direct process stop.
  macOS may inject its locale environment value; no host credential is permitted by the test.
- Earlier full sequential results were 1,035 passed, two failed and 64 skipped. The two launcher
  failures were retested successfully after the absent-path fix. The fresh full sequential run
  passes: **1,054 passed, 64 skipped**, 57 test files passed and nine skipped. Required skipped
  scenarios remain unqualified. The final type-only receipt dependency cleanup also passes build
  and the dependency-cycle check; the initial hosted cycle failure is fixed locally.
- Independent isolated reviews found and drove corrections for source identity, callback head
  binding, Git configuration, recovery admission, absent new paths, symlink races and lease timing.
  Focused review 7 found no concrete defect under commit-dispatch deadline semantics, but noted
  that publication can finish after the deadline. That limitation remains explicit; it is not proof
  of publication-before-expiry. Added deterministic adapter tests prove no commit after delayed
  preparation and uncertain status when commit acknowledgement is lost (seven Git tests pass).
  Review evidence is advisory,
  not execution approval. R3 has not received final independent review.

The initial SonarCloud analysis reported 20 findings, including two bugs and complexity issues.
The refactor makes file ordering explicit, uses the recovery Git validation result and extracts
focused validation/coordinator helpers. Build/lint pass; 215 focused tests and 29 storage/container
tests pass after refactoring. SonarCloud's gate is OK on `f15147e`; its one remaining minor readability
finding was subsequently corrected. The 1,054-test full suite above predates this refactor; do not
present it as a new full-suite run at the final head. Current-head hosted checks remain pending.
No final independent review of the entire R2/R3 composition is claimed.

Retained evidence snapshots live in the [evidence directory](evidence/artifact-import-coordinator/).
Task-owned isolated-review gateway/networks are used only for bounded reviews. Their cleanup is
recorded in the session handoff. Current-head hosted checks remain pending.
Tests do not qualify staging, paid service latency, hostile host process isolation or unattended final delivery.
The Sonar/Problems completion gate remains **blocked** by remaining R3 review/qualification and missing
required connected coordinator coverage, even where individual build/lint/type/test checks pass.

## Decision and continuation boundary

The owner explicitly approved the broker-private import workspace change. No further ownership
approval is pending. Continue the authorized R2/R3 qualification; the private workspace design
preserves the original source identity and leaves shared-checkout contents untouched.
A separate earlier question about the later pilot delivery target is not a blocker for disposable
coordinator qualification and does not expand this repair's delivery authority.

Finish the independent workspace re-review, then finish
coordinator composition and connected recovery/repair/finalization tests, rerun the exact changed
source checks and independent review, then present a ready PR only when all required gates pass.
Keep `.17` open and `.13` blocked. A draft checkpoint is preservation, not completion or approval.
