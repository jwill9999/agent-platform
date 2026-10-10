# Task: Consolidate the native development baseline in staging

**Beads:** `agent-platform-native-staging-integration`  
**Source:** `feature/harness-backlog-review`  
**Destination:** protected `staging`

## Owner authorization and requirements

On 10 October 2026 the owner authorized finishing PR285, then merging the feature branch into staging
once checks pass. Preserve paused orchestration work separately so product development can proceed.
This authorizes scoped documentation/CI repairs and integration, not prototype resumption, main
promotion, deletion of retained work or global configuration changes. The next product priority remains
undecided pending a live backlog review with the owner.

Finish the native handoff PR with current-head checks and review findings clear. Repair the historical
Agent Zero usage link by pointing to the same official Markdown source, rather than weakening link
checking. Read back full changed documentation mirrors with source identity and preserve human notes.

Preserve the existing optional prototype components already integrated into the feature and staging.
Keep PR283, `task/pilot-active-budget`, `task/test-runner-offline-adapter` and the paused checkout's
unfinished edits outside this promotion. No separate paused branch is merged or deleted.

## Sequence and dependencies

The handoff delivery task `agent-platform-native-development-handoff` is closed; its integration PR285
is still open at planning time. This task owns the remaining merge and staging validation. No prototype
readiness task blocks ordinary development. Beads remains authoritative for actual delivery state.

1. Rehearse feature/staging integration on the clean handoff branch before finishing PR285. Preserve
   staging's documentation MCP and URL additions and both session histories. Initial rehearsal found
   only a `session.md` conflict. Include that resolution in PR285; preserve staging ancestry when
   integrating this PR into the feature so the later staging promotion is conflict-free.
2. Validate the scoped PR285 repairs, independent source-aware review and full Notion readbacks.
3. Wait for every executed current-head PR285 check to succeed; staging-only VM may be skipped there.
   Resolve actionable review findings and merge using the exact head SHA without bypassing protections.
4. Recheck the integrated feature/staging trees and open the feature-to-staging promotion PR.
5. Run the actual staging-targeted CI, including the self-hosted packaged macOS VM journey and all
   protection-required checks. Do not skip, disable or fabricate missing checks to obtain a green gate.
   Report unavailable runner/assets or stale protection contexts as concrete external blockers.
6. Merge only the reviewed current head after checks pass. Verify staging's committed tree matches
   the tested integration, record actual merge SHA and preserved branch/worktree evidence, sync Beads.

## Verification and definition of done

- Markdown, formatting and links pass for changed documentation; substantive mirrors are read back.
- Merge rehearsal contains both branch histories and staging-only docs/configuration changes.
- PR285 and promotion heads are pinned; required reviews/threads and terminal checks are clear.
- Hosted quality, build, unit, Docker, desktop/browser E2E and staging VM checks pass on the promotion.
- Staging contains the tested native baseline, with no new paused task branch/checkpoint incorporation.
- Preserved dirty worktrees and retained branch tips match their before snapshots.
- Actual merged revisions, check evidence and any external blocker are recorded in Beads and synced.

Documentation is a planning snapshot; passing local checks does not imply hosted success or a merge.
Record completion only after the actual staging integration is verified. No runtime code changes are
planned; any necessary code repair requires the repository's code quality gate and meaningful tests.
