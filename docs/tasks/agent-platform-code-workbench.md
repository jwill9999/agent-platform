# Epic: Codex-style code workbench

**Beads issue:** `agent-platform-code-workbench`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.md`

## Objective

Build a practical code workbench where chat is the primary surface, project context is explicit, users
can open and discuss files, the agent can clearly see active/pinned code context, and proposed edits
are reviewed through diffs before application.

This epic refines the earlier `agent-platform-ide-rethink` direction. The product should not try to
be a full browser IDE, but it does need a credible internal code surface for reading, small edits,
agent collaboration, and review.

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

- CodeMirror-style editor baseline with line numbers and syntax highlighting.
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
- Desktop/Electron companion.
- Remote provider feedback import. That remains in `agent-platform-branch-feedback-status`.
- Changing backend contracts unless a child task explicitly expands scope during refinement.

## Architecture Direction

Use the current Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript stack. Do not introduce a
new component library.

The editor engine should be a focused editor dependency, not a UI framework. CodeMirror 6 is the
recommended default because it is smaller and easier to embed than Monaco while still providing the
minimum editor baseline: line numbers, highlighting, selections, keyboard behavior, and controlled
editing.

Workbench UI components should continue the operator-experience design strategy:

- shadcn/ui and Radix primitives for component behavior
- Tailwind CSS and existing semantic tokens for styling
- lucide icons for iconography
- compact workbench layouts rather than marketing-style panels
- no new general-purpose UI libraries, styling systems, or animation libraries

CodeMirror, if added, is permitted only as the editor engine for the code surface.

The workbench should remain bounded:

- project and chat context are explicit
- user sees what code the agent can access
- edits are reviewed as diffs before application
- host IDE handoff remains optional/future

## Proposed Task Chain

| Task                              | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `agent-platform-code-workbench.1` | Define code workbench product model           |
| `agent-platform-code-workbench.2` | Add proper editor engine baseline             |
| `agent-platform-code-workbench.3` | Expose active and pinned file context to chat |
| `agent-platform-code-workbench.4` | Open files from chat and workbench evidence   |
| `agent-platform-code-workbench.5` | Add diff-first edit review                    |
| `agent-platform-code-workbench.6` | Prepare branch and Git sidebar integration    |
| `agent-platform-code-workbench.7` | Document code workbench verification guide    |

## Definition Of Done

- [ ] Child task specs exist for `.1` through `.7`.
- [ ] Beads dependencies match the proposed task chain.
- [ ] Code workbench product model distinguishes project chats from general chats.
- [ ] Internal editor baseline is good enough for practical code reading and small edits.
- [ ] Agent-visible file context is explicit to the user.
- [ ] Proposed edits can be reviewed before application.
- [ ] Verification guide covers manual and automated checks.
