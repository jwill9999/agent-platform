# Code Workbench Product Model

This document defines the product model for the Codex-style code workbench.

It is documentation/design only. It does not add backend contracts, frontend components, data
migrations, or editor dependencies.

## Decision

Code work is **project-scoped**. General chat remains separate.

The platform should not treat every chat as an isolated workspace. When a chat is about a
repository, branch, or file set, it should live under a project so the user and agent share stable
context: workspace, branch, open files, artifacts, diffs, checks, and decisions.

```text
Project
  Repository / workspace
  Branch state
  Files and open tabs
  Artifacts
  Checks / feedback
  Chats
    Implement feature
    Review pull request
    Investigate bug

General chats
  Personal assistant
  Research
  Planning
```

## Goals

- Make chat the primary code collaboration surface.
- Make project context visible before the agent relies on it.
- Let users open code from chat and ask questions about it.
- Let users see exactly which files the agent can use as context.
- Keep small code edits practical inside the platform.
- Review proposed code changes as diffs before applying them.
- Preserve the option for future host IDE handoff without depending on it.

## Non-Goals

- Full browser IDE replacement.
- Language server protocol integration.
- Debugger integration.
- Extension marketplace.
- Host IDE automation.
- Desktop/Electron companion.
- Remote provider feedback import.
- Hidden access to repository context from general chats.

## Information Architecture

### General Chat

General chat is not bound to a repository or project.

It is for:

- personal assistant work
- general planning
- research
- non-code questions
- cross-project conversation where no repository context should be assumed

General chat should not silently include repository files, branch state, diffs, or project artifacts.
If the user brings code into a general chat, the UI should make that attachment explicit and should
not convert the conversation into a project chat without a visible user action.

### Project

A project is the organizing unit for code work.

A project may represent:

- a local workspace
- a repository clone
- a future hosted sandbox workspace
- a future remote repository connection

Project-level context includes:

- repository or workspace identity
- active branch when known
- open files and tabs
- pinned files
- selected text or code ranges
- generated artifacts
- browser evidence
- local checks and feedback
- future GitHub/SonarQube/CodeQL/review feedback
- decisions and approvals related to code changes

### Project Chat

A project chat is a conversation attached to a project.

Project chats should show the active project and should make inherited context visible. A project may
have multiple chats, each with its own purpose, while sharing project-level artifacts and workbench
state where appropriate.

Examples:

- implement a feature
- investigate a failing test
- review a pull request
- analyze a SonarQube issue
- polish a UI surface

Project chats may use project context, but the user still needs visibility into what is included in a
specific message.

## Workbench Surface

The workbench is the project-level code surface.

It should include:

- file explorer or file-open surface
- editor with line numbers and syntax highlighting
- active file indicator
- pinned context list
- chat panel
- artifact and evidence access
- diff review surface
- future branch/Git sidebar
- unavailable states for missing project, missing file, missing provider, or unsupported host action

The workbench should feel like a focused review and collaboration space, not a full IDE clone.

## Context Rules

Context must be visible and predictable.

| Context type        | Meaning                                                   | Default behavior                                                      |
| ------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| Active file         | File currently open in the editor.                        | Visible in chat; may be included automatically if the UI says so.     |
| Pinned file         | File intentionally added to chat context.                 | Included until user removes it or context expires.                    |
| Selected text       | User-selected range from the active file.                 | Prefer selected text over full file when explicitly used.             |
| Open tab            | File open in the editor but not active.                   | Not automatically included unless pinned or policy says otherwise.    |
| Artifact            | Screenshot, log, report, snapshot, or generated evidence. | Linked or summarized; raw content included only when explicitly used. |
| Diff                | Proposed or detected change.                              | Reviewable evidence; not automatically applied.                       |
| Branch feedback     | Checks, SonarQube, CodeQL, reviews, local sensors.        | Summary context only until user/agent drills into evidence.           |
| General attachment  | File attached outside a project.                          | Explicit one-off context; does not imply project state.               |
| Unavailable context | File/provider cannot be read or trusted.                  | Show unavailable state and exclude from message context.              |

## Message Composition

Before a project chat message is sent, the user should be able to see:

- active project
- active branch when known
- active file when included
- pinned files
- selected text ranges
- artifacts or diffs attached to the prompt
- excluded files and why they are excluded

The sent prompt context should match the visible context. If sanitization removes content, truncates
a file, or redacts secrets, the UI should be able to represent that state.

## File Visibility States

| State        | Meaning                                             | UI expectation                                       |
| ------------ | --------------------------------------------------- | ---------------------------------------------------- |
| Visible      | File content can be shown and sent as context.      | Show file name/path and inclusion state.             |
| Pinned       | User intentionally included the file.               | Persistent visible chip/row with remove action.      |
| Active       | File is currently selected in editor.               | Prominent label in editor and chat context strip.    |
| Selected     | A range is selected for targeted context.           | Show line/range metadata when available.             |
| Dirty        | Editor content differs from saved file.             | Show dirty indicator and avoid ambiguous save state. |
| Too large    | File exceeds context/display limits.                | Offer summary/path-only state; exclude full text.    |
| Binary       | File is not text-renderable.                        | Show metadata only; do not send raw content.         |
| Missing      | File reference cannot be resolved.                  | Show unavailable state.                              |
| Out of scope | File is outside current project/workspace boundary. | Block or require explicit safe import/mount flow.    |

## Agent Visibility

The agent should not need to infer what it can see.

The workbench should communicate:

- "The agent can see this file"
- "The agent can see these pinned files"
- "The agent cannot see this file"
- "This artifact is available as evidence"
- "This provider is not connected"
- "This file was excluded because it is too large/binary/outside scope"

This improves trust and reduces accidental hidden context.

## Edit Flow

The preferred edit flow is diff-first:

1. User asks a project chat question or requests a change.
2. Agent references active/pinned files and proposes edits.
3. Workbench shows proposed changes as diffs.
4. User applies or rejects each change.
5. Applied changes update editor/workbench state.
6. User saves or commits through the appropriate future flow.

The first implementation can use frontend-local editor state where practical. Persistence and branch
state should stay aligned with existing workspace/file behavior until a later task expands contracts.

## Branch And Artifact Relationship

Branch and diff state belong at project/workbench level, not inside a single chat message only.

Project chats should be able to reference:

- current branch
- changed files
- proposed edits
- browser screenshots
- logs and reports
- quality feedback
- review decisions

`agent-platform-branch-feedback-status` remains responsible for remote provider import and normalized
branch feedback. The code workbench should prepare UI surfaces that can consume that future data
without inventing provider contracts in this epic.

## Deployment Boundary

The workbench should work in the web-first Docker model:

- files come from the managed workspace, browser file handles, or future project/repository sources
- host IDE access is optional/future
- hosted deployments should use managed workspaces or sandboxes rather than host bind mounts
- unsupported host actions should show clear unavailable states

The design must not assume Electron or desktop host access for v1.

## Design Constraints

The workbench must continue the operator-experience design strategy:

- Next.js App Router
- shadcn/ui and Radix primitives
- Tailwind CSS with existing semantic tokens
- TypeScript
- lucide icons
- compact workbench layouts
- no new general-purpose UI libraries
- no new styling systems
- no animation library

CodeMirror 6 is acceptable as a focused editor engine if selected by the implementation task. It
should not be treated as a broader UI framework.

## Open Questions

These can be refined after initial usage:

- Should a project have one default chat or many named chats?
- Should active file context be included by default or require an explicit toggle?
- How long should pinned context persist across chats in the same project?
- Should unsaved editor content be sent to the agent, saved content only, or both with labels?
- How should project identity map to current database concepts?
- How should future hosted sandboxes represent projects and chat history?

The first implementation should choose conservative defaults and make the current behavior visible.
