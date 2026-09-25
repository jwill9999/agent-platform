# Approved-document binding implementation checkpoint

Status: **in progress; completion gate blocked; not ready to merge**.
Task authority: Beads `agent-platform-pilot-zero.16`. Owner approved the exact planning material;
[approval record](approved-document-binding-owner-approval.json) preserves that decision.
Delivery is supervised direct implementation, not a managed orchestration run or pilot.
The frozen plan/spec/test documents remain unchanged; their original proposed-status text is historical.

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

## Verification actually executed

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

1. Restore Docker responsiveness and remove only the disposable `document-binding-linux-suite`
   container if it remains. Its forced-removal request timed out; cleanup is unverified.
2. Finish the operator validation command and document the supported publication/validation API.
   Audit trusted source/workspace resolution and fencing against the approved requirements.
3. Complete the authority-entry tamper matrix, publication failure cases, legacy cleanup/replan proof,
   and connected real-Git/public-coordinator/SQLite/artifact/container/restart scenario.
4. Run the current-source Linux full suite and real mount test; retain failures and actual outcomes.
5. Run the qualified isolated code reviewer; fix findings and re-review material revisions.
6. Finish documentation checks and current-head hosted browser, desktop and Sonar regression gates.
   Only then recommend feature-branch merge. Staging and the live pilot remain separate.

No claim of complete coverage, independent approval, task closure, merge readiness or autonomous
acceptance is made. The owner does not need to repeat implementation scope approval.
