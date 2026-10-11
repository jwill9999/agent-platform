# Task: Make paused orchestration work clearly visible

**Beads issue:** `agent-platform-paused-work-visibility`  
**Status:** Metadata complete; owner-authorized documentation integration in progress.

**Priority:** P1, owner-requested next housekeeping task.  
**Parent epic:** None; standalone follow-up to completed native staging consolidation.

## Summary and owner request

The owner requested a task to make retained paused orchestration visibly distinct from current
features, epics and development, before moving forward with further work. Beads is authoritative
for task status. The GitHub metadata and ten related Beads notes are now verified complete.
The owner subsequently authorized merging these two documentation branches into staging after
checks and review, then removing those delivered temporary branches.

## Requirements

- R1: Prefix the existing runner-controls pull request title with `Paused:` and apply the
  `paused orchestration` label. Preserve the existing title text and other labels.
- R2: Preserve its existing description and add a concise paused-work section explaining that
  the prototype is retained, excluded from current native development, and awaits a future owner
  decision on resumption or decommissioning.
- R3: List the four retained branches and their roles:
  - `feature/harness-backlog-review`: retained base of the paused pull request; delivered baseline
    already consolidated into staging, retained to preserve that pull request relationship.
  - `task/harness-readiness-reconciliation`: paused runner-controls qualification pull request head.
  - `task/pilot-active-budget`: retained unfinished aggregate-budget work.
  - `task/test-runner-offline-adapter`: retained offline-adapter work and dirty paused checkout.
- R4: Audit related Beads records and make their deferred status and exclusion from current
  development explicit. Preserve the distinction between code already delivered, pushed unfinished
  checkpoints, local unfinished work and deferred operational evidence. Do not reopen closed work.
- R5: Preserve branch names and tips, pull request base/head and draft state, existing history,
  dirty worktrees and human notes. No prototype resumption, pilot, source deletion or main promotion.
- R6: Integrate this specification and the session handoff through the existing task/feature
  branches into protected staging after all actual current-head checks and review findings clear.
  Recovery-protect and remove only the two delivered visibility branches after verifying staging.

## Dependency order

Upstream: `agent-platform-native-staging-integration`, already closed with final staging merge
`3a22ac8f45d2257fe1a9200e936e4bd2923c9eae`. The matching Beads blocking edge is recorded.

Downstream: complete this housekeeping before choosing or starting the next product task. No new
product task has been selected, so no invented downstream issue or bulk dependency changes apply.

## Implementation plan

1. Read live GitHub metadata and retained refs, and the related Beads records; save before evidence.
2. Add the label, paused title prefix and scoped description section while preserving other content.
3. Reconcile only relevant Beads notes/status descriptions with retained delivery evidence.
4. Read back actual GitHub and Beads changes and compare ref tips, pull request relationships,
   draft state and worktree preservation against the before snapshot.
5. Record results and publish the complete changed documentation mirrors with source-bound readback.
6. Independently review the two-file source, deliver task to feature through a guarded merge,
   then qualify the protected staging request with fresh full security analysis, actual packaged
   macOS VM, every required/executed check and resolved review findings before guarded squash.
7. Verify the actual staging tree, preserve recovery tags, delete only the two delivered visibility
   branches with SHA guards, verify retained work, sync Dolt and close the task.

## Git and documentation delivery

Specification branch: `task/paused-work-visibility`, from `feature/paused-work-visibility`, itself
from the qualified staging baseline. Push the specification through normal hooks; no direct staging
or main commits. Repository documentation uses the normal task-to-feature and feature-to-staging
pull request workflow. The owner's subsequent voice instruction explicitly authorizes this
documentation integration and two-branch cleanup after passing checks and resolved reviews.

The full specification and session at `d1bbb33d8b1ca96b8088c75b491f83f16740a90b` were published
and read back against their source hashes in the Agent Platform Notion hub; the receipt is
`visibility-integration-publication-d1.json` in the consolidation evidence directory. That receipt
qualifies only that revision. This review correction requires a new complete publication/readback
after commit and push, recorded against its actual revision before merging. A prior mirror or
this handoff text is not proof that a later revision has been synchronized.
No runtime code, dependency, security policy or Git branch rename is required by this task.

## Tests and verification

- V1 / R1-R3: Read GitHub title, labels and entire description before and after. Confirm the paused
  section lists all four exact branch names and preserves the previous description.
- V2 / R4: Read related Beads records before and after; closed deliveries stay closed, remaining
  paused work stays deferred, and implementation location versus outstanding evidence is explicit.
- V3 / R5: Compare remote SHA tips, pull request base/head and draft flag; inspect affected
  worktree status without modifying dirty files. All preserved values must match.
- V4: Validate Markdown, formatting and source links; read the complete Notion mirror back and
  verify source metadata and content. Verify canonical Beads Dolt push completes.
- V5 / R6: Verify independent source review, latest task/feature and staging checks, no unresolved
  review findings, actual completed full security scan and actual packaged macOS VM. Compare the
  protected merge tree to reviewed source. Verify recovery tags and SHA-guarded cleanup readbacks.
- Application build, unit, integration and Playwright tests are not applicable to metadata-only
  changes; normal repository hooks remain enabled. Any expanded code scope needs its own checks.

## Definition of done and sign-off

- The paused title, label and branch inventory are visible in GitHub and read back.
- Relevant Beads records clearly separate retained paused work from current development.
- Delivered code is not represented as unwritten; remaining acceptance work stays explicit.
- Existing source, branch identities, pull request relationships and dirty work are preserved.
- Required documentation delivery, full mirror readback and canonical Dolt sync are verified.
- Both visibility documentation branches are integrated into staging, their delivered tips are
  recovery-protected, and only those two temporary branches are removed.
- Actual verification evidence is recorded before closure. Metadata completion and documentation
  integration are separate milestones; earlier checks do not qualify a changed source revision.

## Verified metadata outcome

The runner-controls pull request now has the title
`Paused: test: qualify runner controls and expose local-network blocker`, label
`paused orchestration`, and an opening four-branch inventory. Full readback preserves the original
description, OPEN/DRAFT state, base/head names and head SHA. All ten relevant Beads records retain
their deferred status and full previous notes, with an explicit current exclusion from native
development. Closed delivered records were not reopened. Original primary and paused worktrees
were verified byte-exact, including dirty diffs and untracked hashes. No runtime code changed.

The initial specification/handoff at `dc42a3c1` passed formatting, direct Markdown and normal
commit/push gates; two full source-bound Notion mirrors and subsequent metadata acceptance notes
were read back. One MCP read rejected an existing `supersedes` dependency type; official CLI
readback succeeded without changing that dependency. Metadata task closure and Dolt sync completed.
The task is now reopened solely for the newly authorized documentation integration and cleanup.

**Sign-off:** Metadata verified; documentation integration pending fresh source review, publication,
hosted gates, protected merge and recovery-protected cleanup. The owner authorized this delivery
by voice on 11 October 2026. Next product priority remains for owner-led backlog review.
