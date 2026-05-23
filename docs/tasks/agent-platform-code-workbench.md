# Epic: Codex-style code workbench

**Beads issue:** `agent-platform-code-workbench`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.md`

## Objective

Defer the earlier embedded code workbench plan and re-scope it around Project Chat, external/default
IDE handoff, explicit file context, and diff-first review. The product should not continue building
a full integrated IDE.

This epic refines the earlier `agent-platform-ide-rethink` direction. The current product decision is
that Project Chat is the primary surface and the user should use their local/default IDE for manual
editing. Any internal code surface should be limited to read/review/diff workflows unless a future
decision deliberately reopens embedded IDE investment.

## Current Status

This epic is **deferred/re-scoped** until Project Experience has delivered the chat-first workspace,
branch selector, governed terminal dock, preview rendering, activity panel, and external/default IDE
handoff.

## Product Model

Code work should be grouped under a **Project**. General chats remain separate.

```text
Project
  Repository / workspace
  Branch state
  Files and open tabs
  Artifacts
  Checks / feedback
  Chats
    Chat A: implement feature
    Chat B: review PR
    Chat C: investigate bug

General chats
  Chat D: personal assistant
  Chat E: planning
```

Project chats inherit project-level context when authorized and visible: repository/workspace,
branch, open files, pinned files, artifacts, diffs, and feedback state. General chats should not
silently inherit repository context.

## Scope

In scope:

- Chat-visible active and pinned file context.
- Opening files from chat, tool output, paths, and artifacts.
- Diff-first review for agent proposed edits.
- Preparation for branch/Git sidebar integration.
- Manual/visual verification guidance.

Out of scope for this epic:

- Full language server support.
- Debugger integration.
- Extension marketplace.
- Host IDE automation.
- Embedded IDE feature expansion.
- A CodeMirror/Monaco editor investment unless reapproved by a future decision.
- Desktop/Electron terminal implementation, which belongs to
  `agent-platform-project-experience.10`.
- Remote provider feedback import. That remains in `agent-platform-branch-feedback-status`.
- Changing backend contracts unless a child task explicitly expands scope during refinement.

## Architecture Direction

Use the current Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript stack. Do not introduce a
new component library.

Do not add or expand an editor engine as part of this epic while the Project Chat-first direction is
active. If a future task requires read-only code rendering or diff viewing, choose the smallest
component that satisfies that task rather than rebuilding IDE behavior.

Workbench UI components should continue the operator-experience design strategy:

- shadcn/ui and Radix primitives for component behavior
- Tailwind CSS and existing semantic tokens for styling
- lucide icons for iconography
- compact workbench layouts rather than marketing-style panels
- no new general-purpose UI libraries, styling systems, or animation libraries

The workbench should remain bounded:

- project and chat context are explicit
- user sees what code the agent can access
- edits are reviewed as diffs before application
- host/default IDE handoff is the preferred path for manual editing

## Proposed Task Chain

| Task                              | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `agent-platform-code-workbench.1` | Define code workbench product model           |
| `agent-platform-code-workbench.2` | Deferred: editor engine baseline              |
| `agent-platform-code-workbench.3` | Expose active and pinned file context to chat |
| `agent-platform-code-workbench.4` | Open files from chat and workbench evidence   |
| `agent-platform-code-workbench.5` | Add diff-first edit review                    |
| `agent-platform-code-workbench.6` | Prepare branch and Git sidebar integration    |
| `agent-platform-code-workbench.7` | Document code workbench verification guide    |

## Definition Of Done

- [ ] Child task specs exist for `.1` through `.7`.
- [ ] Beads dependencies match the proposed task chain.
- [ ] Code workbench product model distinguishes project chats from general chats.
- [ ] No further integrated IDE/editor investment occurs unless reapproved by a later decision.
- [ ] Agent-visible file context is explicit to the user.
- [ ] Proposed edits can be reviewed before application.
- [ ] Verification guide covers manual and automated checks.
