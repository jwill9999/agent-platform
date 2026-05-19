# Git Workflow UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Git & GitHub side panel into a calm, guided delivery workflow with clear next actions, reversible steps, and tested visual behavior.

**Architecture:** Keep local Git state as the workflow source of truth and use GitHub state only when a remote/PR/check context exists. The right panel should render progressive workflow steps derived from state, while mutation actions remain explicit and policy-aware.

**Tech Stack:** Next.js/React UI in `apps/web`, Express Project Git APIs in `apps/api`, shared contracts in `packages/contracts`, Beads for task tracking, Vitest for unit/API tests, and Playwright/Electron for visual journey coverage.

---

## Working Backlog

1. `agent-platform-5nv` — derive and render progressive workflow steps.
2. `agent-platform-59i` — implement Publish branch and Clear stale upstream actions.
3. `agent-platform-4hm` — improve commit step, completion state, and commit-message generation.
4. `agent-platform-0ra` — add push completion and PR creation flow.
5. `agent-platform-5zg` — build focused read-only PR detail view.
6. `agent-platform-17h` — refine Checks around current PR/head status.
7. `agent-platform-e6g` — design the in-app Web Explorer handoff.
8. `agent-platform-7vf` — add Playwright/Electron journey coverage.

## Execution Rhythm

- Implement one Beads task at a time.
- Use a failing test before implementation where practical.
- Run focused tests, then relevant typecheck/lint/test gates.
- Commit and push at the end of each task.
- Stop for manual visual/practical testing before proceeding.

## User Journey Target

Overview is always visible. It should answer: “What can I do now?”

Visible steps should be state-driven:

- Dirty tree: Changes.
- Staged files: Commit.
- Clean branch with no/missing upstream: Publish branch / Clear stale upstream.
- Ahead branch with valid upstream: Push.
- Pushed non-primary branch without PR: Create PR.
- Open PR: PR detail and Checks.
- Passing PR checks: ready for human review/merge decision.

## Design Constraints

- Do not expose actions before they are useful.
- Do not hide recovery paths; users must be able to go back.
- Keep GitHub links available as a fallback.
- Prefer in-app Web Explorer routing once that exists.
- Keep labels friendly and concise, with exact Git terms as secondary detail.
