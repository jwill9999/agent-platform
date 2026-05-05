# Task: Prepare branch and Git sidebar integration

**Beads issue:** `agent-platform-code-workbench.6`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.6.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.6.md`

## Task requirements

Prepare the code workbench UI model for branch, changed-file, and Git/diff sidebar integration.

This task should align with:

- `docs/design/operator-branch-diff-workflows.md`
- `agent-platform-branch-feedback-status`
- the diff-first edit review task

Do not implement remote provider feedback, GitHub checks, CodeQL, SonarQube, or PR mapping in this
task unless explicitly refined later.

## Dependency order

### Upstream

| Issue                             | Spec                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| `agent-platform-code-workbench.5` | [Add diff-first edit review](./agent-platform-code-workbench.5.md) |

### Downstream

| Issue                             | Spec                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.7` | [Document code workbench verification guide](./agent-platform-code-workbench.7.md) |

## Implementation plan

1. Define workbench sidebar placement for changed files and branch summary.
2. Reuse the operator branch/diff workflow states where possible.
3. Surface local changed-file state from existing frontend state where available.
4. Add placeholders/unavailable states for branch feedback providers.
5. Document handoff to `agent-platform-branch-feedback-status`.

## Git workflow

Branch `task/agent-platform-code-workbench.6` from `task/agent-platform-code-workbench.5`.

## Tests

- focused web tests if UI is implemented
- documentation/spec checks if design-only
- manual check that sidebar states do not imply unavailable provider data exists

## Definition of done

- [ ] Workbench sidebar model for changed files/branch summary is defined or implemented.
- [ ] States align with operator branch/diff workflow docs.
- [ ] Provider-unavailable states are clear.
- [ ] Relationship to `agent-platform-branch-feedback-status` is explicit.
- [ ] No remote provider contracts are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-code-workbench.6 --reason "Branch and Git sidebar integration prepared"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
