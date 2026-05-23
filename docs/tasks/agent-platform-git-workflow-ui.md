# agent-platform-ii1 — Git workflow UI and in-app web explorer

## Goal

Turn the Git & GitHub panel from a diagnostic dashboard into a guided delivery workflow that helps users move from local changes to commit, publish/push, pull request, checks, and review without leaving AI Studio.

## Product Principles

- Overview is always available and shows one clear next action.
- Workflow steps are revealed only when they are currently useful.
- Users can go back to previous/completed steps without being trapped in a wizard.
- GitHub links remain available as an escape hatch.
- Long term, external GitHub and web links should open inside an in-app Web Explorer.
- Playwright visual checks are part of the quality gate for this work.

## Task Order

1. `agent-platform-5nv` — Guide Git panel by workflow state.
2. `agent-platform-59i` — Add upstream publish and clear actions.
3. `agent-platform-4hm` — Improve commit step and generated commit messages.
4. `agent-platform-0ra` — Add push completion and PR creation flow.
5. `agent-platform-5zg` — Add focused PR review view.
6. `agent-platform-17h` — Refine checks as PR/head status.
7. `agent-platform-e6g` — Design in-app Web Explorer handoff.
8. `agent-platform-7vf` — Add Playwright journey coverage for Git workflow.

## Definition of Done

- Each task is independently testable.
- User-facing labels avoid unnecessary Git jargon.
- The panel shows clear loading, empty, success, warning, and error states.
- Manual visual testing is requested after each task before moving to the next.
