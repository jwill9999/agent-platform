# Approved-document binding implementation checkpoint

Status: **in progress; completion gate blocked; not ready to merge**.
Task authority: Beads `agent-platform-pilot-zero.16`. Owner approved the exact planning material;
[approval record](approved-document-binding-owner-approval.json) preserves that decision.
Delivery is supervised direct implementation, not a managed orchestration run or pilot.
The frozen plan/spec/test documents remain unchanged; their original proposed-status text is historical.

## Docker restart and independent review follow-up

Docker recovered after the owner restarted Desktop. The stale Linux test container was absent.
The current full Linux suite passes **744 tests, 14 optional skips** (46 files pass, 5 skipped).
The separate real-container document suite passes **15 tests**, including the connected public
orchestrator packet, actual read-only mount, recorded artifact evidence, store/coordinator reopen,
and denial after test-plan tampering. These do not prove a managed live-model workflow or the full
required negative matrix. TypeScript build and lint pass.

The first independent isolated code review returned **changes required**. Its exact material manifest
and results are retained in [round one](evidence/approved-document-binding-code-review-round1.json).
Follow-up changes add in-transaction authority checks, terminal-status replay checks, actual snapshot
verification before start, bounded attempt lifetime and fenced recovery, retryable live contention,
and an operator validation command. A two-connection broker test confirms zero external mutations
when a peer invalidates or quarantines authority after verification. Bootstrap fixtures now include
normative documents in the initial Git tree instead of changing the reviewed candidate afterward.

Remaining blockers include trusted publication/current task workspace binding, bootstrap
terminalization after approval invalidation, and exhaustive authority/recovery test coverage.
Several transaction paths still require the final audit; passing helper or regression tests do not
resolve an independent finding. The follow-up [independent review](evidence/approved-document-binding-code-review-round2.json)
returned changes required. Both reviews used the qualified isolated read-only container; neither
is owner approval.
The first review's commands were disabled as expected; its returned code-mode availability warning
does not imply a tool ran. Findings came from the supplied immutable source snapshot.

The earlier planning request was closed as superseded by the cumulative draft
[implementation request](https://github.com/jwill9999/agent-platform/pull/273).
Nothing was merged. Scope remains approved; this checkpoint must not be used to launch the pilot.

## Remaining independent findings after the repair pass

| Finding | Severity | Disposition |
| --- | --- | --- |
| Publication provenance and current accepted workspace | High | Open: fixed publication directory is insufficient proof of current task source |
| Durable snapshot-tamper denial | High | Open: snapshot check runs after source verification settles; mismatch must invalidate durably |
| Supplied packet versus durable scheduler input | High | Open: compare complete canonical packet/envelope before staging and dispatch |
| Conflicting terminal result on replay | Medium | Open: status mismatch is denied, but same-status different result needs rejection |
| Bootstrap terminalization after lost approval | Medium | Open: separate cancellation identity checks from active execution authorization |
| Complete production-path negative evidence | High | Open: real launcher lifecycle, process crash and every authority consumer remain required |

Two implementation/review passes have now surfaced unresolved problems, as anticipated by the
plan's bounded-attempt rule. This report escalates them; no finding is waived or hidden by the
passing regression suite. Next repair work remains within the existing task, followed by full
regression and another exact-snapshot review. No completion or merge recommendation is issued.

## Implemented at this checkpoint

Typed canonical document manifests participate in the contract material digest. Explicit publication
stages regular files and content-addressed objects, then records a durable receipt. Historical contracts
retain their old digest but cannot acquire new execution authority without a manifest.

A durable verification attempt precedes document reads at execution boundaries. Mismatch invalidates
all approvals sharing the publication. Failed settlement leaves a pending attempt that blocks sibling
runs and survives restart even when the original bytes are restored. Recovery invalidates authority;
it cannot restore approval. Regression tests cover replaced leases, failed writes and migration rollback.

Task packets carry approval/manifest/material identity and the fixed snapshot location. The specialist
launcher supplies a separate read-only document mount. Source verification also checks the configured
source root at launcher/bootstrap boundaries. Cancellation and diagnostic paths remain available.

## Enforcement inventory — implementation, not exhaustive acceptance proof

| Area | Guarded boundaries |
| --- | --- |
| Approval | Creation, revalidation, notification preparation and resume acceptance |
| Scheduling | Packet creation, continuation enqueue, phase claim/start, scheduler reservation |
| Worker | Capability issuance, snapshot staging, lifecycle checks, result acceptance |
| Effects | Transition prepare/commit, governed mutation, delivery prepare/readiness/commit |
| Recovery | Callback acceptance, lineage import, repair dispatch/accept and child effects |
| Feature | Delivery approval/contract, merge observation, evaluation and finalization |
| Bootstrap | Capability issuance, journal mutation and phase advancement |

The inventory still needs a completed negative-test matrix and independent review. Successful
historical receipt reads and cleanup deliberately do not create new execution authority. Nested
synchronous governed commits reuse only the private in-transaction operation scope established by
the immediately preceding durable guard; this requires explicit review, not a caller verification flag.

## Earlier checkpoint verification (superseded by follow-up above)

- Workflow-control TypeScript build: passed.
- Workflow-control ESLint with zero warnings: passed.
- Supported native regression: **663 passed, 15 skipped**, 42 files passed and 5 skipped.
  The invocation excludes bootstrap/Git delivery suites and the real-Git ancestry test because
  hardcoded Apple Git requires an unaccepted Xcode licence. These exclusions are not passing evidence.
- Targeted adapter regression: 23 passed after increasing only that success test's 100-ms run lease.
  Production lease enforcement and expiry tests remain intact.
- Earlier direct-mount Docker snapshot probe passed, but the strengthened production-generated mount
  probe **timed out**. The earlier result does not validate the latest probe or the full connected path.
- Linux full-suite attempts did not produce a completed result. Docker inspection and cleanup also
  stalled. Bounded infrastructure attempts are exhausted; no Docker restart or unrelated container
  removal was attempted.
- Independent restricted implementation review: **not run**. Hosted checks: not yet established.
- Direct Markdown lint and Git whitespace checks passed. Checkpoint publication skips local Git
  hooks because the pre-push hook hardcodes unavailable Apple Git; this is not a passing full gate.

The optional Docker test is opt-in; a default-suite skip must not be counted as DB-T05 completion.
Required final connected DB-T10 is not implemented/proven by the standalone snapshot probe.
Retained command/result summaries and source hashes are in
[evidence](evidence/approved-document-binding-checkpoint.json).

## Remaining acceptance work

This is the remaining scope of the existing Beads task, not a new backlog:

1. Resolve independent implementation findings; Docker responsiveness is restored.
2. The operator command and API guide are present. Finish trusted source/workspace resolution
   and fencing against the approved requirements.
3. Complete the authority-entry tamper matrix, publication failure cases, legacy cleanup/replan proof,
   and connected real-Git/public-coordinator/SQLite/artifact/container/restart scenario.
4. Linux regression and real mount tests pass; repeat after material repairs and retain their outcomes.
5. Run the qualified isolated code reviewer; fix findings and re-review material revisions.
6. Finish documentation checks and current-head hosted browser, desktop and Sonar regression gates.
   Only then recommend feature-branch merge. Staging and the live pilot remain separate.

No claim of complete coverage, independent approval, task closure, merge readiness or autonomous
acceptance is made. The owner does not need to repeat implementation scope approval.
