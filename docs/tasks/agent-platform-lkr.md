# Task: Label stale upstream branches in Project Git UI

## Problem

After `git fetch --prune`, Git removes stale remote-tracking refs but leaves local branches and their upstream configuration intact. A local branch can remain selectable while its configured upstream is gone, which currently looks like a normal branch in the Project Git UI.

## Requirements

- Detect when a local branch has a configured upstream whose remote-tracking ref no longer exists.
- Expose upstream state in the Project branch list and current Git status.
- Label missing upstreams clearly in the branch selector and Git panel.
- Do not treat a missing upstream as push-ready synced state.
- Keep publish/unset-upstream actions out of scope for this slice.

## Done

- Branch list API exposes upstream state for each local branch.
- Git status API exposes upstream state for the current branch.
- UI labels stale upstreams as `Upstream missing`.
- API/contracts tests cover missing-upstream state.
- Local quality gates pass.
