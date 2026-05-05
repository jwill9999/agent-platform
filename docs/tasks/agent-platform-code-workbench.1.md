# Task: Define code workbench product model

**Beads issue:** `agent-platform-code-workbench.1`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.1.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.1.md`

## Task requirements

Define the Codex-style product model for code workbench workflows before implementation begins.

The model must distinguish:

- general chats that are not tied to a project
- project-scoped chats that inherit repository/workspace context
- project-level files, branches, artifacts, diffs, and feedback
- what code context the agent can see
- when context is automatic, pinned, selected, unavailable, or explicitly removed

This task is documentation/design only.

The product model is documented in [Code Workbench Product Model](../design/code-workbench-product-model.md).

## Implementation plan

1. Document the project/grouping model for code work.
2. Define how chats relate to a project, repository/workspace, branch, files, and artifacts.
3. Define active file, pinned file, selected text, and open-tab context rules.
4. Define non-goals: full IDE, host IDE automation, language server, debugger.
5. Define implementation constraints for the next tasks.

## Git workflow

Branch `task/agent-platform-code-workbench.1` from `feature/agent-platform-code-workbench`.

## Tests

- Documentation/spec checks.

## Definition of done

- [x] Project-scoped code workbench model is documented.
- [x] General chat versus project chat behavior is defined.
- [x] File/context visibility rules are documented.
- [x] Non-goals and implementation constraints are clear.
- [x] No backend contracts or new UI libraries are introduced.

## Sign-off

- [x] Required checks pass.
- [x] `bd close agent-platform-code-workbench.1 --reason "Code workbench product model defined"`
- [x] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
