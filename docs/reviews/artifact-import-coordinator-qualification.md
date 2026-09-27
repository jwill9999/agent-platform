# R2 artifact import and R3 coordinator qualification

Status: R2/R3 prerequisite qualification complete; owner feature-branch integration outstanding. Beads: `agent-platform-pilot-zero.17`.
Branch: `task/artifact-import-coordinator`.
[PR278](https://github.com/jwill9999/agent-platform/pull/278) targets the feature branch; owner integration remains outstanding.
Baseline: PR277 merged to `feature/harness-backlog-review` at
`b7be3d6fcbf62c257e68f24dc46eca397cd02ffb`.

## Current qualification checkpoint

Source `4e4a3a1a` passes the Node 24 qualification:

- [Full workflow regression](evidence/artifact-import-coordinator/final-regression.txt): 1,125 passed, 76 gated tests skipped.
- [Connected Docker journeys](evidence/artifact-import-coordinator/thirteen-connected-with-config.txt): all 13 passed, including cancellation cleanup, changed approval documents, process restart and lost notification.
- Unchanged role/launcher path: [role and tool enforcement](evidence/artifact-import-coordinator/role-final.txt): all 25 passed.
- [Focused cleanup and completion-fence checks](evidence/artifact-import-coordinator/import-cleanup-completion-fences.txt): 115 passed.
- [Node 24 adapter and pinned Git checks](evidence/artifact-import-coordinator/node24-adapter-check.txt): 40 passed.
- [Provenance manifest](evidence/artifact-import-coordinator/configuration-qualification-manifest.json): source, built output, configuration and retained-result hashes verified unchanged during qualification.

All nine executed [hosted checks](evidence/artifact-import-coordinator/final-source-hosted-checks.json) passed on that source, including browser E2E, desktop E2E, full verification and SonarCloud. The [CI execution record](evidence/artifact-import-coordinator/final-source-hosted-ci.json) binds job URLs and results to the source commit. The staging packaged macOS VM check was skipped. Publication-head checks remain authoritative on PR278.

Reviews 22 and 23 drove fixes for durable cleanup after expired import recovery, fresh coordinator completion fences and killed-process fixture shutdown. Reviews 24–26 requested configuration provenance, hosted results and a lease-expiry contention test. All are retained: 26 exact configuration hashes recomputed across 13 successful scenarios, nine hosted successes bound to the source SHA, and 10 cancellation tests passing. [Final review 27](evidence/artifact-import-coordinator/review-27.json) confirms those findings are resolved and establishes no additional production blocker. Its stale provenance-label finding is corrected: the final manifest identifies one qualified source commit, labels the earlier baseline and records the cancellation repair history. Source/build/evidence hashes were rechecked after that metadata-only correction. Historical sections below preserve earlier failed or superseded checkpoints.

These are prerequisite tests using real Docker/Codex tools and production runtime, with controlled model responses, dummy credentials and disposable GitHub/Beads services. They do not prove a live paid autonomous pilot or real remote delivery. Cancellation proves interruption cleanup and blocked work while the run remains `cancelling`; it does not prove terminal cancellation. Recorded dispatch timings end at specialist reservation, not first model response, and establish no latency SLO.

The canonical real journal contains four cancelled runs and no live leases, but lacks the R1 workspace identity binding. Discovery correctly returns unavailable. Provisioning and rechecking that binding belongs to the subsequent pilot readiness assessment; no real journal migration was performed.

## Scope and execution mode

The owner authorized R2 governed worker-produced changes and R3 coordinator completion.
The [approved scope](../planning/standalone-pilot/plan.md) and
[verification matrix](../testing/standalone-pilot-prerequisites.md) remain authoritative.
Work uses the explicitly permitted supervised prerequisite route. It does not establish an
orchestrated task cycle. No live pilot, real delivery mutation, merge or staging promotion occurred.
The canonical journal was inspected read-only: four cancelled runs and no live leases at admission.
Notion alignment remains a separate deferred task.

## R2 implementation and historical qualification

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

## R3 implementation and historical qualification

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

## Connected coordinator qualification checkpoint

The latest real-container controlled-response run passed five journeys in 234.31 seconds: import,
verification/review, full coordinator closeout, verifier repair and reviewer repair. A sixth separate
lost-close-acknowledgement journey passed in 51.60 seconds. Both repair journeys prove two distinct
implementation attempts and a single accepted repair dispatch. The uncertain-close case records one
recovery and exactly two close mutations (task and epic), without duplicating the uncertain task close.
These tests run production CLI/runtime/supervisors, real Docker/Codex tools and private Git workspaces;
model Responses, credentials and external Beads/GitHub are controlled disposable services. They do
not establish live model quality, real external delivery, staging or the later paid pilot.

Composition defects discovered and corrected: acceptance now uses approved task authority plus
completed reviewer evidence; transport checks avoid nested document-verification transactions while
brokers retain their approval checks; same-owner uncertain recovery verifies existing fences rather
than attempting takeover; and PR results use the production snapshot's `number` field.

Review 13 identified four additional defects, now repaired pending final independent re-review:
execution-bound repair identifiers must survive evidence redaction; successful pipeline observations
must obey the immutable deadline; coordinator cancellation must allow newly admitted recovery while
permanent shutdown stays closed; and NUL-delimited Git paths must preserve whitespace and Unicode.
The focused deadline/path suite passes 42 tests. The storage suite passes 29 tests. The latest full
regression is still running; earlier failed runs remain historical evidence.

The design critique confirms feature-evaluation repair remains unimplemented as a composed route.
It needs an explicitly authorized planner, a durable bounded child, an authoritative parent-to-child
handoff, inherited document and role checks, remaining-budget accounting, and connected recovery
coverage. Neither successful verifier/reviewer repair nor happy-path closeout proves that route.

Correction to earlier wording: the feature-delivery contract is mandatory when feature-to-staging
intent/contract/approval exists; missing or invalid authority then fails closed. When no such intent
exists, the approved feature-branch-only route may finalize after its task delivery. The disposable
happy-path test uses that narrower route; it does not bypass an existing staging requirement.

PR278 remains draft; final qualification, current-head detailed Sonar checks and independent review
are outstanding. No live pilot or production delivery has been launched.

## Feature-evaluation repair and recovery checkpoint

The composed repair-planning path now passes a real-container controlled-response journey in
130.40 seconds. The initial 90-second limit expired during the second feature evaluation; a
180-second bound allows the longer nine-specialist journey to complete. Production runtime,
credential lifecycle, private Git import and coordinator code run unchanged; model responses and
external services are controlled substitutes. One child claim and three close effects are verified.
See [connected evidence](evidence/artifact-import-coordinator/feature-repair-connected.txt).

The durable handoff preserves parent callback identity while the successor action selects only a
committed child. The child packet receives the exact proposal and evidence. Canonical and private
approved document bytes are checked, and child reservation plus later verifier retries share the
feature budget even when a new finding identifier appears.

Independent [review 15](evidence/artifact-import-coordinator/review-15.json) identified async
transaction handling, proposal delivery and recovery heartbeat issues, subsequently repaired.
Approved repair-policy role changes remain intentional: a QA predecessor may lead to an explicitly
approved implementation child. [Review 16](evidence/artifact-import-coordinator/review-16.json)
confirmed those fixes and identified active scheduler capacity stranded after planner recovery
exhaustion. The latest fix records an interruption, then uses durable cleanup before escalation;
retained handoff bytes survive. Its [restart journal check](evidence/artifact-import-coordinator/planner-exhaustion-test.txt)
passes; independent follow-up remains in progress.

The initial broad run reported 1088 passing and 22 failing tests. Corrected child authority fixtures
and a Git fallback, then reran the five affected files serially: [114 passed](evidence/artifact-import-coordinator/regression-recheck.txt).
This does not replace the final full run. New [private document checks](evidence/artifact-import-coordinator/private-document-tests.txt)
and [child budget check](evidence/artifact-import-coordinator/child-budget-test.txt) also pass.
All-current-source connected qualification, independent review and hosted quality checks remain
required. PR278 stays draft; Beads .17 stays in progress and .13 remains blocked.

[Review 17](evidence/artifact-import-coordinator/review-17.json) additionally identified retry charging
while a previous owner's resource leases are still valid. Coordinator and planner recovery now share
the admission-wait decision. The [focused runtime check](evidence/artifact-import-coordinator/planner-owner-wait.txt)
proves no worker launch, interruption or retry charge during this wait. Review 18 is pending.

## Final repair review checkpoint

[Review 18](evidence/artifact-import-coordinator/review-18.json) found import recovery could terminally
block while a previous owner's resource lease remained valid. The [expanded runtime test](evidence/artifact-import-coordinator/import-owner-wait.txt)
now proves waiting without retry charge, followed by successful reconciliation after lease expiry
without relaunching the worker. The proposed predecessor-only permission restriction was resolved
against the existing frozen feature/repair policy, which explicitly supports implementation repair
after QA-only work; it is not a new mandatory policy.

[Review 19](evidence/artifact-import-coordinator/review-19.json) found contradictory evaluator status
and criterion outcomes. These now block before either evaluation persistence or callback creation.
[Review 20](evidence/artifact-import-coordinator/review-20.json) found a cancellation race at final
child commitment and a request-builder mismatch with the supported QA predecessor. Finalization now
rechecks current state and fences inside its transaction, leaving uncertain external effects prepared
for reconciliation. The builder uses the approved feature/repair envelope. The
[53 focused tests](evidence/artifact-import-coordinator/cancellation-repair-tests.txt) pass.

[Review 21](evidence/artifact-import-coordinator/review-21.json) reports no remaining concrete defect
in those fixes. This is static independent review with explicit evidence limits, not pilot approval.
The previous [nine connected journeys](evidence/artifact-import-coordinator/nine-connected-checkpoint.txt)
passed, and a final rebuilt-source rerun is running. Final full regression and hosted gates also remain
pending. Earlier serial regression was not used as final evidence because test/source edits occurred
during its run and produced six cached-module failures; the dedicated focused run passed afterward.


## Import recovery and completion fence review

[Review 22](evidence/artifact-import-coordinator/review-22.json) found retained import failures could
strand active scheduler capacity, and coordinator completion could reuse a timestamp captured before
synchronous document verification. Import failure now uses durable interruption cleanup, retaining
uncertain import evidence while settling the scheduler. Completion samples elapsed time after writer
acquisition and applies it to resource and phase fences. The [115-test focused run](evidence/artifact-import-coordinator/import-cleanup-completion-fences.txt)
passes, including expired import recovery without worker replay and rejection with no receipt or successor.

[Review 23](evidence/artifact-import-coordinator/review-23.json) confirms both production fixes and
identifies a signal-terminated test process that could be awaited twice. The fixture now recognizes
both exit code and signal as terminal. Four additional connected failure modes are under qualification
for SP-12: cancellation, changed verification documents, killed runtime/restart and lost notification.
The first fixture attempt used an incorrect deterministic lifecycle-worker image and a closed setup
store; those fixture/configuration errors are corrected. They are not claimed as product defects or
passing qualification. A rerun uses the pinned real Codex image and a freshly opened production store.


## Interpreter qualification correction

The thirteen connected scenarios passed on the earlier host invocation, but its PATH selected Node
25.8.2 despite the interactive shell showing Node 24. The broad run then failed copied-interpreter
adapter fixtures. That run is not the final supported-environment result. Explicit PATH selection
uses the repository Node 24.14.0; the 40 adapter/Git checks pass there.

Hosted verification exposed a separate deployment prerequisite: the shared runner Node binary is
group-writable, so production pin checks correctly reject it during ref transactions. CI now makes
an owner-only private copy for tests, leaving the shared toolcache and production restrictions
unchanged. This is test-environment provisioning within qualification, not a wider worker grant.
The Node 24 full suite and connected rerun, final evidence review and hosted gates remain pending.

## Cancellation contention found during evidence qualification

The configuration-retention rerun passed 12 scenarios but exposed a cancellation request failure.
[Repeated real-container attempts](evidence/artifact-import-coordinator/cancellation-contention-reproduction.txt)
located SQLite snapshot-upgrade contention at the production cancellation INSERT. This was not
treated as a passing or merely environmental test. The request now acquires the writer lock before
reading workflow state and checks resource leases using elapsed time after lock acquisition.
The immutable request identity/timestamps remain unchanged. A
[competing-writer regression](evidence/artifact-import-coordinator/cancellation-writer-regression.txt)
passes with the existing cancellation suite and real competing-writer lease-expiry test (10 tests). The failed
[13-scenario run](evidence/artifact-import-coordinator/configuration-run-cancellation-failure.txt)
is retained separately. The production fix at `bb534b1` plus the extra regression at `4e4a3a1` pass the final full suite (1,125) and all 13 connected scenarios with configuration readback.
