# Post-merge cleanup — 19 October 2026

Beads: `agent-platform-post-merge-cleanup` (in progress). This is developer housekeeping, not a
runtime feature or stress-test result. The owner explicitly requested a current handoff and cleanup
of unused worktrees/test data after delivery, with the same check at the end of later runs.

## Verified delivery and app state

[PR378](https://github.com/jwill9999/agent-platform/pull/378) merged the repair into its feature;
[PR377](https://github.com/jwill9999/agent-platform/pull/377) delivered protected staging
`50f6e1b50879ad17420ada89cf87f3f4f080066a`, tree `fc553adaf2e6707a92617baa4a64810de112dcef`.
All 19 executed checks passed, including 75 Electron cases without retries and 20 real packaged-VM
cases; reviews were resolved. The three delivered branches were already removed with four verified
recovery tags. Workspace repair is closed and synced in canonical Beads.

The retained owner app uses that clean detached staging checkout. Its original profile/key, all 30
application tables, 23 migration rows and 4,153 prior monitoring samples were preserved. Listing,
recording, native exports (15 then 19 samples) and a clean restart passed independent review.
The prepared build's 473 compiled files still match. No live model call or owner stress trial ran.

**Stress remains blocked** by `agent-platform-desktop-fixture-log-isolation` and
`agent-platform-monitoring-storage-failure-provenance`. The earlier monitoring failure's cause is
unproven; restart recovery is not a root-cause fix. Historical gaps remain in reports. Do not discard
those failures or infer readiness from green delivery checks. Dependency upgrades are held; paused
orchestration/PR283, main and the disabled Docker gateway remain separate.

## Audit and retention

Initial inventory: 18 Git registrations, including one missing checkout. Sizes are allocated estimates,
not a promise of recovered filesystem space. Decisions use actual source/status, ignored files,
process handles and delivery evidence; clean status alone is insufficient.

| Checkout                             | Decision/reason                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-platform`                     | Retain dirty tracked/staged/untracked work; no deletions or cache pruning here.                                                                          |
| `agent-platform-pr265-review`        | Retain stale registration until narrow explicit prune is safe; no disk bytes to reclaim.                                                                 |
| `0980`                               | Reuse as small current housekeeping docs checkout; no dependency install.                                                                                |
| `73e7`                               | Retain unique/uncertain or paused work; clean status alone is not proof of completed delivery. No PR head match established for legacy webview checkout. |
| `ac94`                               | Retain dirty tracked/staged/untracked work; no deletions or cache pruning here.                                                                          |
| `codeql-redaction`                   | Retain unique/uncertain or paused work; clean status alone is not proof of completed delivery. No exact delivered-PR match established.                  |
| `dependency-upgrade-preview`         | Retain held unmerged dependency work and PR373.                                                                                                          |
| `diagnostic-review-checkpoints`      | Removed after exact merged task/staging proof, fresh no-use checks and remote recovery-tag readback. Source branch retained.                             |
| `harness-readiness`                  | Retain dirty tracked/staged/untracked work; no deletions or cache pruning here.                                                                          |
| `migration-hook-review`              | Rebuildable caches removed after verified private archive; managed archive queued, not confirmed complete. Source/recovery data retained.                |
| `pilot-zero-ci-tBQX1w`               | Retain unique/uncertain or paused work; clean status alone is not proof of completed delivery. No exact delivered-PR match established.                  |
| `pr335-handoff-review`               | Removed after exact merged task/staging proof, fresh no-use checks and remote recovery-tag readback. Source branch retained.                             |
| `repair4`                            | Retain dirty tracked/staged/untracked work; no deletions or cache pruning here.                                                                          |
| `toolkit-backlog`                    | Retain unique/uncertain or paused work; clean status alone is not proof of completed delivery. No exact delivered-PR match established.                  |
| `ui-evaluation-skill`                | Removed after exact merged task/staging proof, fresh no-use checks and remote recovery-tag readback. Source branch retained.                             |
| `workspace-session-scope`            | Retain running actual owner app at staging50f6; compiled outputs and profile-related runtime handles active.                                             |
| `agent-platform-harness-backlog`     | Retain unique/uncertain or paused work; clean status alone is not proof of completed delivery. No exact delivered-PR match established.                  |
| `agent-platform-workflow-evaluation` | Retain unique/uncertain or paused work; clean status alone is not proof of completed delivery. No exact delivered-PR match established.                  |

The three documentation checkouts have exact merged task heads PR306/338/333 and verified staging
promotions PR307/335/336; each staging merge is an ancestor of current staging. Three additional
annotated recovery tags were pushed and peeled values read back before retirement. Branch refs are
retained; this task does not broaden branch deletion.

## Required ignored data and review

Before archiving stopped `migration-hook-review` at `f526f4ef`, a private archive explicitly includes
its `.beads/embeddeddolt` durable store, local Beads metadata/backups and retained test/fixture evidence.
All entries, modes, file bytes and symlink targets were verified without following links or exposing
key values. The archive contains 60 regular files, is 51,708,091 bytes, and has SHA-256
`3b9f511fa6b1bc20e50fcb1b393f9a1d449c269990ab0b3a0adf14e70ca9f9f8`; archive permissions are 0600
inside a 0700 directory. Managed worktree Git snapshots omit ignored files, so the private archive is
required recovery material. Rebuildable dependency/build/cache copies need not be kept.

Independent critic finding CLEAN-P01 required explicit durable-store preservation. The correction
passed independent review: 84 archive entries, all 60 regular-file byte comparisons, including 12
embedded-Dolt entries. The bounded archive/removal plan and explicit cache-only fallback are approved.
The managed archive operation returned queued and remains unconfirmed; its checkout is not claimed
removed. Final documentation review is recorded with the frozen source/receipt hashes.

## Actual results and evidence

Removed the three documentation worktrees listed above. In the retired migration checkout,
removed only allowlisted ignored dependency/build/cache directories and incremental metadata:
2,114,568,192 estimated allocated bytes (about 1.97 GiB).
The three small checkout copies add 68,456,448 allocated bytes,
for approximately 2.03 GiB of removed copies overall. No branches were deleted.
During the cache step, observed filesystem free space rose by 0.80 GiB;
shared files/APFS and concurrent activity explain why this is not the allocated estimate. At the final
measurement, free space was 104.10 GiB versus 103.25 GiB before removal.

There are 15 remaining Git registrations, including the missing checkout. The large retired checkout
still contains its clean source and required local data while the managed archive is queued. Keep that
state explicit; do not recreate/reuse it or poll indefinitely. The archive and manifests outside it
remain recoverable. Dirty/paused/unique/uncertain, held dependency and running-app checkouts stay.

Four dirty checkouts retain their exact staged/unstaged/untracked hashes. The actual running app's
473 compiled files and clean detached staging source are unchanged. No packages were installed and
no app/fixture/provider calls were made. The small `0980` checkout is reused for these documents;
its temporary dependency symlink points to the live checkout for documentation commands only, not a
read-only filesystem mount. Remove that link after normal hooks and push; generated Git hooks remain
needed while the documentation task is active. No runtime/E2E test is needed for these documents.

Original five-file checks passed. The direct-staging follow-up includes the task README too; the
direct Markdown API explicitly validates all six authored documents, including CLI-ignored records. Formatting, local links,
diff and historical-suffix checks also apply. Full earlier f526 session history (511,129 bytes) remains
verbatim exactly once; only the current checkpoint is replaced, leaving session at 511,963 bytes.
The replaced 50f6 checkpoint remains in Git. Normal hooks, final independent review, pushed revision
and hosted PR status were tracked in Beads; at that pre-merge checkpoint this documentation had
not yet been promoted to staging.

Local receipts live under `/Users/letuscode/.codex/workspace-cleanup-20261019/`: inventory,
disposition plan, delivery proofs, recovery-tag readbacks, private ignored-data archive/manifest and
preservation checks. The source-bound PR377/app qualification remains under
`/Users/letuscode/.codex/native-workspace-listing-20261019/`. These are required local recovery/evidence
records; they are not external publications or a second task tracker.

The [recurring closeout checklist](../development/post-merge-cleanup.md) is linked from shared
instructions. The owner corrected the unnecessary two-merge route: existing PR379 targets protected
staging directly from its task branch, with the normal protection/review gates retained. The earlier
feature route is superseded; no second PR or feature merge is needed. The preceding pending
statements describe the pre-merge checkpoint.

## Verified protected delivery

PR379 subsequently merged directly to staging at `dee20500f9614c9645de50286262827e18d410d6` on
19October. Its fetched tree `0c9c2263b37df5b4be8c9dd02fbd8f2036ef5d2a` exactly matches the reviewed
`4adddc24` source. Independent current-head evidence verifies all13required contexts,21executed
successes, zero unresolved review threads/findings, genuine full scans and the signed packaged VM.
The recorded budget/optional skips and coverage limits remain disclosed. Cleanup task closeout is
still separate: the queued managed archive/remnant refs and final preservation/sync need verification.
The owner app remains on50f6; this documentation merge did not rebuild or restart it.
