# Post-merge handoff and cleanup

Run this closeout after each authorized delivery. Cleanup is part of the task, not permission to
change another task or remove useful evidence. Beads remains authoritative for status.

1. Verify the actual merged revision/tree and current checks/reviews. Update `session.md` with the
   delivered SHA, verification, remaining blockers and next action. Keep detailed results in the
   existing task/review record; label older pending statements as historical. Commit/push the handoff
   through the normal branch/PR process. Updating a handoff grants no additional merge authority.
2. Inventory worktrees, branches, staged/unstaged/untracked **and ignored** files, running processes,
   open handles and generated test artifacts. A clean Git status alone is insufficient. Record each
   worktree as retain, retire or uncertain, with a reason and an allocated-size estimate.
3. Retain primary/dirty checkouts, paused and unfinished work, unique or uncertain changes, the actual
   running app checkout and everything it needs, owner profiles/credentials/databases, and held PRs.
   Do not switch, build in, or remove an in-use runtime. Do not clear unrelated stashes or prune
   shared package stores, Docker volumes, images or global caches as routine task cleanup.
4. Before retiring a delivered unused checkout, verify exact delivery, preserve recoverable Git
   history/tips, and inspect ignored data. Managed worktree snapshots omit ignored files: privately
   preserve any needed local database, including `.beads/embeddeddolt`, logs and evidence first.
   Verify complete archive entries/file bytes/symlink targets without following links or exposing
   credentials. Use the Codex managed archive operation for attached managed worktrees; otherwise
   use guarded Git worktree removal. Keep unrelated branch refs unless separately qualified.
5. Remove only identified disposable fixtures, temporary test databases/profiles, generated metadata,
   build outputs, caches and duplicate extracts after their consumers stop and retention is resolved.
   For completed work, keep a compact source/run-bound result and necessary raw qualification evidence.
   Keep original failure traces/logs and diagnostic gaps while their investigation or acceptance is
   open. A verified retained archive may replace duplicate extracted files; record how to recover them.
   Ignored data is not automatically disposable. Never remove canonical source fixtures, task specs,
   original app backups or live diagnostic history under this rule.
6. Recheck source/dirty-work/runtime preservation and the retained evidence. Record exact removals,
   retained items and why, estimated allocated bytes removed, and observed filesystem free space.
   Reflinks, hardlinks and concurrent activity mean these are not interchangeable measures. Update
   the existing task result/Beads record, read it back and complete `bd dolt push` before claiming sync.

Use explicit paths and expected SHAs, never a blanket `git clean`, recursive worktree-root deletion,
volume prune or age-only deletion. Preserve non-ignored untracked work too. If ownership, active use
or evidence retention cannot be established, retain the item and record the uncertainty. A recurring
scheduler is unnecessary: apply this checklist at the end of each delivered run.
