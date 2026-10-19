# Post-merge handoff and cleanup

Beads: `agent-platform-post-merge-cleanup` (P1, in progress).

## Objective and authorization

On 19 October the owner requested a current `session.md` after staging delivery, an audit of many
worktrees/test files to reclaim space, and routine end-of-run removal of no-longer-needed metadata
and test data. PR378 and PR377 have delivered to staging `50f6e1b5`; this task changes documentation
and performs bounded developer housekeeping. It does not repair the separately tracked monitoring
issues or authorize a dependency upgrade, live model call or owner stress trial. The owner's later
correction removes the unnecessary feature merge: PR379 must target protected staging directly.
The same live protection checks, resolved comments and applicable merge authority still apply.

## Requirements

- Reflect actual delivery/checks/app handover and the still-open stress blockers in `session.md`.
- Establish the [post-merge cleanup checklist](../development/post-merge-cleanup.md) in shared guidance.
- Inventory every registered checkout and classify retention before removal, including ignored files
  and actual process/handle use. Preserve original source/data, paused and held work, dirty checkouts,
  live app files and evidence needed by open investigations.
- Retire only proven delivered unused checkouts, preserving Git recovery and any necessary ignored
  database/evidence with complete private archive verification. Report removals and space measurements.
- Do not use deletion to hide failures. Keep small source-bound audit/results; remove redundant
  disposable data after retention is resolved rather than retaining every generated copy indefinitely.

## Implementation and dependency order

1. Use canonical Beads and a stopped small checkout from actual staging, separate from the live app.
2. Inventory current refs/status/ignored data/sizes/processes and confirm exact merged PR heads.
3. Obtain independent critique of the cleanup plan and correct findings before destructive work.
4. Preserve required ignored data and Git tips, verify archive bytes/entries/links, then perform
   allowlisted retirement. Retain uncertain/unique/paused/in-use worktrees.
5. Update the existing handoff/current shared closeout protocol and this task's result record.
6. Validate/review the final documents and receipts, commit/push with normal hooks, and open the
   task-to-staging PR. Hosted checks/reviews and actual merge authority remain separate.

| Relationship            | Task                                                   | State                                    |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Delivered prerequisite  | `agent-platform-native-workspace-listing`              | Closed after PR377 staging delivery      |
| Separate stress blocker | `agent-platform-desktop-fixture-log-isolation`         | Open; retain its failure evidence        |
| Separate stress blocker | `agent-platform-monitoring-storage-failure-provenance` | Open; retain its failure evidence        |
| Downstream owner trial  | `agent-platform-local-mvp-stress-review`               | Open; no live model/stress trial claimed |

The housekeeping task depends on the delivered Workspace prerequisite in Beads. The two monitoring
blockers remain hard prerequisites of the separate stress review.

## Verification

Documentation-only: Markdown, formatting, relative links and factual source-bound readback;
application build/browser/Electron/VM/diagnostic execution is not applicable. Do not rebuild the
running app or rerun successful product tests to validate documentation.

For cleanup, verify exact heads/status before each removal, no active consumers, complete private
archive manifest/bytes/symlinks and recoverable Git history, preservation of other work, and final
actual worktree inventory. Record allocated bytes and filesystem free-space observations separately.
Independent review covers destructive selections and final documentation. Normal hooks remain enabled.

## Definition of done and sign-off

- Current handoff and recurring cleanup guidance validated, reviewed, committed and pushed.
- Audit/results state actual removals, preserved data, uncertainty and measured space, with receipts.
- Beads readback and terminal Dolt sync complete; do not close while its declared PR delivery is pending.
- Task branch `task/post-merge-housekeeping`, from staging50f6, uses existing PR379 directly into
  protected `staging`. The earlier feature destination is superseded; do not create a second PR or
  feature merge. Actual current-head staging checks/reviews and applicable merge authority remain
  required; no protection bypass or runtime restart is implied.

Owner authorization is the request in this chat. Independent plan/final review and actual results
are recorded in [the cleanup results](../reviews/post-merge-cleanup-20261019.md).
