# agent-platform-17h — Refine checks as PR/head status

## Problem

Checks should represent the current PR/head state, not a broad list of historical GitHub Actions runs.

## Requirements

- Show Checks only when there is a current PR or current HEAD check context.
- Summarize passing, failing, running, and unknown checks clearly.
- If checks fail, make failure detail easier to reach.
- Provide GitHub fallback links for checks and reruns.
- Do not show broad workflow history in this view.

## Acceptance

- The Checks step answers “is this change passing?” rather than “what has run in this repository?”
- PR checks are preferred when a PR exists.
- HEAD checks are used only when there is no PR context.
