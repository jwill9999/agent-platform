# Task: Add proper editor engine baseline

**Beads issue:** `agent-platform-code-workbench.2`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.2.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.2.md`

## Task requirements

Replace the plain textarea editor in the workbench with a proper browser editor engine.

Recommended default: CodeMirror 6, unless implementation discovery finds a materially better fit in
the existing stack.

CodeMirror is allowed only as the editor engine. Surrounding UI must continue to use the existing
design constraints: Next.js App Router, shadcn/ui/Radix primitives, Tailwind CSS, TypeScript, and
lucide icons. Do not introduce a new general-purpose UI library, styling system, or animation
library.

The editor baseline should support:

- line numbers
- syntax highlighting for common project file types
- basic editing and selection
- controlled content updates
- existing open-tab behavior
- existing dirty-state behavior
- existing save behavior through File System Access handles
- light/dark theme compatibility
- accessible keyboard behavior

Do not add language servers, debugger behavior, extension systems, or external IDE handoff in this
task.

## Dependency order

### Upstream

| Issue                             | Spec                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- |
| `agent-platform-code-workbench.1` | [Define code workbench product model](./agent-platform-code-workbench.1.md) |

### Downstream

| Issue                             | Spec                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.3` | [Expose active and pinned file context to chat](./agent-platform-code-workbench.3.md) |

## Implementation plan

1. Confirm editor dependency choice and bundle implications.
2. Add the editor dependency.
3. Create a focused editor component for the IDE/workbench surface.
4. Map existing `OpenTab` content/language/dirty-state behavior into the editor.
5. Preserve current save/open/close tab flows.
6. Add focused web tests for content changes, language mapping, and dirty state.

## Git workflow

Branch `task/agent-platform-code-workbench.2` from `task/agent-platform-code-workbench.1`.

## Tests

- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/web run typecheck`
- targeted manual browser check for line numbers, highlighting, editing, dirty state, and save

## Definition of done

- [ ] Workbench editor uses a proper editor engine instead of a plain textarea.
- [ ] Line numbers and syntax highlighting are visible.
- [ ] Existing open/save/dirty behavior still works.
- [ ] Tests cover editor state behavior.
- [ ] No backend contracts are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-code-workbench.2 --reason "Editor engine baseline added"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
