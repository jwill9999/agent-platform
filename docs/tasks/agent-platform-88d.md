# Task: Scope GitHub Checks to current PR or branch head

## Problem

The Project Git & GitHub Checks tab currently uses recent workflow runs for the branch. That can show old scheduled, Dependabot, or unrelated workflow history instead of the checks that matter for the current pull request or branch head.

## Requirements

- Prefer checks for the open pull request associated with the current branch.
- If no current-branch pull request exists, show checks for the exact current `HEAD` commit.
- Do not use broad workflow history as the main Checks tab data.
- Keep unavailable/auth states clear when GitHub CLI or GitHub auth is missing.
- Keep broader workflow history for a later secondary view.

## Done

- Checks count and list reflect current PR or exact branch `HEAD`.
- UI identifies whether the checks came from a pull request or the branch head.
- API tests cover PR-scoped checks and head-commit fallback.
- Local quality gates pass.
