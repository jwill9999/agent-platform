# Task: Run the shared secret scan from the husky pre-commit hook

**Beads issue:** `agent-platform-husky-secret-scan`  
**Spec file:** `docs/tasks/agent-platform-husky-secret-scan.md` (this file)  
**Parent epic:** none — standalone developer-tooling task

The Beads issue **description** begins with: `Spec: docs/tasks/agent-platform-husky-secret-scan.md`

## Task requirements

Husky sets `core.hooksPath` to `.husky/_`, so the owner's global `~/.agents/git/hooks` dispatcher
and its gitleaks secret scan never run in this repository. Call
`~/.agents/git/hooks/secret-scan.sh` from `.husky/pre-commit`, before lint-staged, when it is
installed. Skip it cleanly when it is not, so contributors without `~/.agents` are unaffected.
Local developer hook only; no CI, dependency or runtime changes.

## Dependency order

### Upstream — must be complete before this task

None.

### Downstream — waiting on this task

None.

### Planning notes

No Beads dependency edges are needed.

## Implementation plan

1. Guard the call with an `if [ -x … ]` block rather than `[ -x … ] && …`: husky v9 runs hooks
   with `sh -e`, and a bare failed test would fail the hook when the script is absent.
2. Deliver as the default bounded batch: `task/husky-secret-scan` from actual `staging`, one PR
   directly into protected `staging`. No feature integration branch is needed.

## Tests (required before sign-off)

- **Hook behaviour:** in a disposable repository, run the hook under `sh -e` with lint-staged
  stubbed: a staged GitHub-token-shaped string is blocked; a clean file reaches lint-staged and
  exits 0; with the script absent the scan is skipped and lint-staged still runs.
- **Real commits:** commits on this branch run the scan (`sh -x` trace shows the call).
- **Unit / build / Playwright:** not applicable; no package, runtime or UI code changes, and the
  pre-push hook reports no affected packages.
- **Hosted:** monitor the PR's required GitHub Actions checks and SonarQube quality gate.

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] Hook behaviour tests above pass.
- [ ] PR into `staging` has all required exact-head checks passing and review comments resolved.
- [ ] PR merged with owner destination authority.

## Pre-close sign-off

- [x] Task branch created from actual current `staging` before implementation work
- [x] Hook behaviour tests executed and passing
- [ ] PR merged into `staging` (link: <https://github.com/jwill9999/agent-platform/pull/381>)
- [x] `decisions.md` unchanged — no architectural decision changed
- [x] `session.md` updated for handoff

## Post-close verification

- [ ] Close reason recorded in Beads
- [ ] Beads issue re-read as `closed`

**Reviewer / owner:** _pending_ **Date:** _pending_
