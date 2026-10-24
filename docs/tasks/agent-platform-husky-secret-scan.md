# Run the shared secret scan from the husky pre-commit hook

## Requirements

Husky sets `core.hooksPath` to `.husky/_`, so the owner's global `~/.agents/git/hooks` dispatcher
and its gitleaks secret scan never run in this repository. Call
`~/.agents/git/hooks/secret-scan.sh` from `.husky/pre-commit`, before lint-staged, when it is
installed. Skip it cleanly when it is not, so contributors without `~/.agents` are unaffected.
Local developer hook only; no CI, dependency or runtime changes.

## Implementation and dependency order

No task dependencies. Guard the call with an `if [ -x … ]` block rather than `[ -x … ] && …`,
because husky v9 runs hooks with `sh -e` and a bare failed test would fail the hook. Deliver
`task/husky-secret-scan` to `feature/husky-secret-scan` (cut from `staging`) for review.

## Verification and definition of done

In a disposable copy of the hook: a staged GitHub-token-shaped string is blocked, a clean commit
reaches lint-staged and succeeds, and a missing script is skipped without failing. Real commit of
this change passes the hook. Push the branch, open the PR to the feature branch and record it in
Beads.
