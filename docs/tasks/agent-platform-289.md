# agent-platform-289: explicit PR target branch selection

## Summary

The Git/GitHub panel still looks like it will create `current branch -> main` pull requests with no visible choice. Replace the subtle text/datalist field with an explicit target branch selector.

## Requirements

- Show a clear target/base branch selector in the pull request creation card.
- Include obvious default choices: `staging`, `develop`, `main`, and detected local branches where available.
- Keep the current branch excluded as a target.
- Submit the selected target branch to the pull request creation API.
- Preserve existing non-`main` API regression coverage.

## Tests and Verification

- Web unit tests for PR base branch option ordering and selected/fallback value resolution.
- API route test proving `--base staging` reaches GitHub CLI PR creation.
- Web typecheck/lint, focused tests, format, docs lint, and diff check.

## Definition of Done

- Users can visibly choose a PR target branch before clicking `Create pull request`.
- The form copy reads as `current branch -> selected target`, not a fixed `-> main` workflow.
