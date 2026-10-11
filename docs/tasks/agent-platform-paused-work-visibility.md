# Task: Make paused orchestration work clearly visible

**Beads issue:** `agent-platform-paused-work-visibility`  
**Status:** Open; task capture complete, implementation pending.  
**Priority:** P1, owner-requested next housekeeping task.  
**Parent epic:** None; standalone follow-up to completed native staging consolidation.

## Summary and owner request

The owner requested a task to make retained paused orchestration visibly distinct from current
features, epics and development, before moving forward with further work. Beads is authoritative
for task status. Creating this specification does not claim the GitHub metadata has been changed.

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
5. Record results, publish the complete changed documentation mirror, sync Dolt and close the
   Beads task only after every acceptance criterion is verified.

## Git and documentation delivery

Specification branch: `task/paused-work-visibility`, from `feature/paused-work-visibility`, itself
from the qualified staging baseline. Push the specification through normal hooks; no direct staging
or main commits. Repository documentation uses the normal task-to-feature and feature-to-staging
pull request workflow when integrated. Creating this task does not grant a new merge authorization.

The full specification is mirrored in the Agent Platform Notion hub with source revision and hash.
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
- Application build, unit, integration and Playwright tests are not applicable to metadata-only
  changes; normal repository hooks remain enabled. Any expanded code scope needs its own checks.

## Definition of done and sign-off

- The paused title, label and branch inventory are visible in GitHub and read back.
- Relevant Beads records clearly separate retained paused work from current development.
- Delivered code is not represented as unwritten; remaining acceptance work stays explicit.
- Existing source, branch identities, pull request relationships and dirty work are preserved.
- Required documentation delivery, full mirror readback and canonical Dolt sync are verified.
- Actual verification evidence is recorded before closure; this planning snapshot claims no
  implementation, independent review, metadata change or application test completion.

**Sign-off:** Pending implementation and verification. Owner requested task creation by voice on
11 October 2026. Next development priority remains undecided until this housekeeping is complete.
