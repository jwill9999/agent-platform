# Task: Document browser tool usage guide

**Beads issue:** `agent-platform-browser-tools-guide`  
**Spec file:** `docs/tasks/agent-platform-browser-tools-guide.md` (this file)  
**Parent epic:** `agent-platform-browser-tools` - Browser automation tool pack

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-browser-tools-guide.md`

## Task requirements

Create a practical user/operator guide for the Playwright-backed browser tools. The guide should explain what the feature can do, when to use it, how to prompt it, how approvals work, where artifacts are stored, and how to troubleshoot common local development failures.

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. Do **not** close this issue until every **upstream** task below is already **closed**.

### Upstream — must be complete before this task

| Issue                            | Spec                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| `agent-platform-browser-tools.5` | [Validate browser tools](./agent-platform-browser-tools.5.md) |

### Downstream — waiting on this task

| Issue | Spec |
| ----- | ---- |
| N/A   | N/A  |

### Planning notes

This task is documentation-only. It captures usage guidance discovered during manual testing of local and external browser sessions.

## Implementation plan

1. Review existing browser tool documentation in API, architecture, development, and task specs.
2. Add a user-facing guide under `docs/`.
3. Link the guide from the browser-tools epic and task index.
4. Run focused markdown formatting checks.

## Git workflow (mandatory)

This is follow-up documentation on `feature/agent-platform-operator-experience`; no implementation branch chain is required unless this is later split into code work.

## Tests (required before sign-off)

- Run Prettier check for touched markdown files.
- Run `git diff --check`.

## Definition of done

- [x] Guide explains browser capabilities and example prompts.
- [x] Guide covers approvals, artifacts, limitations, and troubleshooting.
- [x] Guide links to existing API, architecture, development, and task documentation.
- [x] Task spec exists and Beads issue points to it.

## Sign-off

- [x] Documentation added.
- [x] Focused formatting check passed.
- [x] `bd close agent-platform-browser-tools-guide --reason "Browser tools usage guide documented"`

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
