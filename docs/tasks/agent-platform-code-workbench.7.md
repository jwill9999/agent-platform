# Task: Document code workbench verification guide

**Beads issue:** `agent-platform-code-workbench.7`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.7.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.7.md`

## Task requirements

Document manual and automated verification flows for the code workbench after implementation.

The guide should cover:

- opening a project/workspace
- distinguishing general chat from project chat
- opening files
- editor line numbers and syntax highlighting
- active/pinned file context visible to chat
- chat-file context matching the next message
- opening file references from chat/tool/artifact surfaces
- diff-first edit review
- apply/reject behavior
- branch/Git sidebar expectations
- common Docker/host unavailable states

## Dependency order

### Upstream

| Issue                             | Spec                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.6` | [Prepare branch and Git sidebar integration](./agent-platform-code-workbench.6.md) |

### Downstream

| Issue | Spec |
| ----- | ---- |
| N/A   | N/A  |

## Implementation plan

1. Create or update the workbench user/developer guide.
2. Add manual testing scenarios.
3. List automated test commands and expected coverage.
4. Include Docker/host caveats for local and hosted deployments.
5. Link guide from relevant task/epic docs.

## Git workflow

Branch `task/agent-platform-code-workbench.7` from `task/agent-platform-code-workbench.6`.

This is the expected segment tip. Open one PR from `task/agent-platform-code-workbench.7` to
`feature/agent-platform-code-workbench` after completion.

## Tests

- documentation/spec checks
- all relevant web quality gates from implementation tasks

## Definition of done

- [ ] Verification guide exists and is linked.
- [ ] Manual scenarios cover the complete workbench flow.
- [ ] Automated checks are listed.
- [ ] Known local Docker/host limitations are documented.
- [ ] Segment tip is ready for feature-branch PR.

## Sign-off

- [ ] Required checks pass.
- [ ] If segment tip: PR merged `task/agent-platform-code-workbench.7 -> feature/agent-platform-code-workbench`; otherwise write “N/A — merge at segment end”.
- [ ] `bd close agent-platform-code-workbench.7 --reason "Code workbench verification guide documented"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
