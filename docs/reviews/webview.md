# Agent Platform Review — GitHub, Git, Chat Interface and Electron WebView/File Integration

## Executive Summary

This review examined the current implementation of the Git/GitHub workflow, chat interface architecture, and Electron integration within the agent platform.

The current implementation already demonstrates strong architectural direction:

- Clear separation between harness tooling and UI
- Strong typed contracts across services
- Structured Git tooling abstraction
- Workspace-aware development model
- Early HITL governance integration
- Thoughtful GitHub workflow UX planning
- Electron desktop runtime foundations

However, there are several architectural and UX gaps that will become increasingly important as the platform evolves into a full AI-native IDE and agent workspace.

The most important findings are:

1. Git and GitHub capabilities are currently read-heavy and workflow-oriented, but not yet deeply integrated into the conversational agent experience.
2. The chat interface is still operating primarily as a messaging surface rather than a fully integrated orchestration workspace.
3. The Electron runtime has foundational support but lacks a unified embedded workspace experience.
4. WebView and file opening behaviour should become first-class runtime capabilities.
5. Tool allowlisting is currently too static for agentic workflows and requires policy-driven runtime elevation.
6. The current architecture is well positioned for a secure capability-based runtime model.

---

# 1. Repository Architecture Review

## Observed Architecture

The repository demonstrates a relatively clean layered structure:

- `apps/web` → frontend application
- `apps/desktop` → Electron runtime
- `packages/harness` → orchestration runtime/tooling
- `contracts` → shared typed schemas/contracts
- `docs` → architecture, planning and workflow specs

This is a strong direction because it separates:

- UI concerns
- orchestration/runtime concerns
- contracts
- execution tooling
- platform integrations

The structure aligns well with:

- Clean Architecture
- Hexagonal Architecture
- Capability-based orchestration
- Tool-driven agent runtimes

---

# 2. Git Tooling Review

## Current Implementation

The Git tooling implementation located in:

`packages/harness/src/tools/gitTools.ts`

is well designed structurally.

### Strengths

## 2.1 Strong Tool Isolation

Each Git capability is encapsulated as a tool definition:

- `git_status`
- `git_diff`
- `git_log`
- `git_branch_info`
- `git_changed_files`

This is a strong design because:

- tools become composable runtime capabilities
- the harness can audit usage
- permissions can be layered later
- tools can be exposed selectively

---

## 2.2 Typed Contracts

The use of:

- Zod schemas
- typed tool contracts
- structured outputs

is a major architectural strength.

This enables:

- deterministic UI rendering
- runtime validation
- structured streaming
- agent planning reliability
- safe orchestration

---

## 2.3 Security Awareness

The implementation already demonstrates defensive thinking:

- bounded diff sizes
- workspace path validation
- controlled git execution
- explicit Git binary usage
- execution limits

This is important for AI-enabled tooling.

---

## 2.4 Git Execution Isolation

Using:

- `execFile`
- direct binary invocation
- bounded buffers

is substantially safer than shell interpolation.

This avoids many command injection risks.

---

# 3. Git Workflow Gaps

## 3.1 Git Tools Are Mostly Read-Only

Current tooling heavily favours inspection rather than orchestration.

Missing capabilities include:

- staging files
- unstaging files
- branch switching
- conflict resolution
- cherry-picking
- stash management
- rebase orchestration
- squash workflows
- revert/reset workflows
- worktree management
- repository creation
- clone/fork flows

The UI documents suggest many of these are planned, but the runtime abstraction is not yet complete.

---

## 3.2 Runtime Capability Escalation Missing

Current tooling appears tightly coupled to static allowlists.

This becomes problematic because:

- agents cannot dynamically adapt
- workflows fail unexpectedly
- users lose trust in orchestration
- capabilities become overly prescriptive

This is one of the largest architectural concerns.

---

## Recommendation — Dynamic Capability Governance

Replace static allowlists with:

## Capability Policy Engine

The runtime should evaluate:

- user intent
- workspace trust level
- project trust level
- tool risk level
- execution environment
- HITL state
- policy rules

instead of simply checking:

`tool in allowlist`

---

## Proposed Model

### Low Risk

Auto-execute:

- git status
- git diff
- read files
- search
- diagnostics

### Medium Risk

One-click approval:

- git add
- git commit
- npm install
- branch creation
- webview navigation

### High Risk

Explicit gated execution:

- rm -rf
- credential access
- production deployment
- external publishing
- arbitrary shell execution

### Trusted Workspace Mode

Allow the user to elevate an entire workspace:

- sandboxed
- trusted
- unrestricted

This aligns much more closely with modern IDE trust models.

---

# 4. GitHub Integration Review

## Current Strengths

The GitHub panel implementation:

`apps/web/components/project/project-git-github-panel.tsx`

is significantly more advanced than a traditional chat UI.

The implementation already includes:

- PR awareness
- checks awareness
- upstream state tracking
- publish workflows
- conflict awareness
- repository connection flows
- commit visualisation
- push/pull orchestration

This is a strong foundation.

---

## Positive UX Direction

The platform is already moving away from:

"chat with buttons"

into:

"AI-assisted development workspace"

This is the correct strategic direction.

---

# 5. GitHub Integration Gaps

## 5.1 GitHub Is Not Yet a Native Runtime Provider

GitHub appears mostly treated as:

- a repository endpoint
- PR metadata source
- publish target

rather than:

- a first-class workspace provider

---

## Missing Runtime Features

### Repository Lifecycle

- create repository
- fork repository
- clone repository
- manage remotes
- manage branches
- manage releases

### Pull Request Runtime

- inline review comments
- AI review suggestions
- conversational PR resolution
- review state management
- conflict assistance
- review-to-code loop

### Issue Integration

- open issues
- task extraction
- issue → branch automation
- issue → PR automation
- AI-generated issue summaries

### Actions Integration

- workflow visibility
- workflow logs
- deployment visibility
- AI debugging of CI failures

---

# 6. Chat Interface Review

## Current Direction

The current UI architecture appears to combine:

- conversational interaction
- workspace tooling
- Git workflows
- IDE concepts
- approval workflows

This is strategically correct.

However:

the chat interface still behaves primarily like:

- a conversational stream

rather than:

- a composable orchestration workspace.

---

# 7. Major Chat Interface Gaps

## 7.1 Missing Workspace Context Docking

The user should not need to constantly switch context.

The runtime should support:

- docked file editors
- diff viewers
- embedded terminals
- embedded webviews
- task inspectors
- agent activity timelines
- execution traces

inside the same workspace.

---

## 7.2 Chat Messages Are Too Ephemeral

Current conversational interfaces lose state visibility.

The platform needs:

- persistent execution cards
- expandable tool traces
- reusable task chains
- linked workspace context
- pinned outputs
- live activity panes

---

## 7.3 Agent Activity Visibility

The user needs visibility into:

- what the agent is doing
- what tools were called
- why a tool failed
- which files changed
- why approvals are required

without reading raw logs.

---

# 8. Electron Runtime Review

## Current Direction

The repository contains:

- Electron architecture planning
- Electron runtime docs
- Electron workflow docs
- Electron command sandbox planning

This indicates the correct direction.

---

## Strategic Opportunity

Electron should not simply host:

- the web application

Instead:

Electron should become:

# The AI Workspace Runtime

Meaning:

- file orchestration
- webview orchestration
- terminal orchestration
- local runtime execution
- permission governance
- capability management
- local MCP execution
- secure sandboxing

---

# 9. WebView Integration Review

## Current Gap

The platform currently lacks a unified embedded webview architecture.

This is critical.

AI-native IDE workflows require:

- embedded previews
- OAuth flows
- GitHub pages
- local dev servers
- documentation browsing
- landing page previews
- PR previews
- embedded dashboards

without leaving the workspace.

---

# 10. Recommended WebView Architecture

## Core Principle

WebViews should be treated as:

# Workspace Resources

not just browser windows.

---

# 11. Proposed Architecture

## WebView Runtime Service

Create:

`packages/runtime-webview`

or:

`packages/desktop-webview`

Responsibilities:

- create webviews
- track webview lifecycle
- persist sessions
- isolate permissions
- manage navigation
- intercept external URLs
- communicate with chat/runtime
- inject workspace context

---

## WebView Types

### Internal Workspace WebViews

Examples:

- localhost previews
- documentation
- PR previews
- generated sites

Permissions:

- relaxed
- workspace integrated

---

### External Trusted WebViews

Examples:

- GitHub
- Vercel
- Supabase
- OpenAI

Permissions:

- controlled
- OAuth enabled
- cookie/session isolated

---

### External Untrusted WebViews

Examples:

- arbitrary user links

Permissions:

- sandboxed
- restricted APIs
- isolated session

---

# 12. Electron WebView Recommendations

## Use BrowserView or WebContentsView

Avoid legacy Electron `<webview>` tags where possible.

Recommended:

- `BrowserView`
- `WebContentsView`

because they provide:

- stronger process isolation
- better lifecycle control
- permission management
- improved security

---

## Security Requirements

Every WebView must:

### Disable

- nodeIntegration
- unsafe preload exposure
- unrestricted IPC

### Enable

- contextIsolation
- permission mediation
- URL allowlists
- navigation interception
- download interception

---

# 13. Recommended Workspace Layout

## Multi-Panel Workspace

Recommended desktop layout:

### Left Sidebar

- files
- tasks
- branches
- chats
- MCP servers

### Centre Workspace

Tabbed:

- editors
- diffs
- terminals
- webviews
- previews

### Right Sidebar

- agent activity
- approvals
- PR comments
- tool traces
- diagnostics

### Bottom Panel

- terminal
- logs
- runtime output
- workflow execution

This aligns more closely with:

- VS Code
- Cursor
- Windsurf
- JetBrains

while preserving AI-native orchestration.

---

# 14. File Opening Architecture

## Current Gap

The platform does not yet appear to treat files as:

# Runtime Addressable Resources

---

# 15. Proposed File Resource System

Create:

`workspace://`

URI scheme.

Examples:

- `workspace://repo/src/app.ts`
- `workspace://diff/123`
- `workspace://preview/landing-page`
- `workspace://terminal/main`

---

# 16. Benefits

This allows:

- chat links to open tabs
- tool outputs to reference files
- persistent workspace references
- deep linking
- agent-driven navigation
- execution replay

---

# 17. Chat ↔ Workspace Integration

## Critical Missing Capability

The chat interface should be able to emit:

# Actionable Workspace Objects

instead of plain text.

---

## Example

Instead of:

"I created landing-page.tsx"

The runtime emits:

- file reference
- diff preview
- open action
- compare action
- apply action
- preview action

---

# 18. Proposed Unified Workspace Event Model

Introduce:

## Workspace Events

Examples:

- FILE_OPENED
- DIFF_CREATED
- WEBVIEW_CREATED
- TERMINAL_STARTED
- TOOL_EXECUTED
- APPROVAL_REQUESTED
- TASK_COMPLETED
- PREVIEW_AVAILABLE

---

## Why This Matters

This transforms the platform from:

"chat app with tooling"

into:

# AI Operating Environment

---

# 19. Approval Workflow Recommendations

## Current Direction

The HITL implementation direction is strong.

However:

approvals should evolve into:

# Policy-Aware Runtime Governance

rather than:

simple blocking prompts.

---

# 20. Recommended Approval Types

## Informational

No approval required.

---

## Passive Approval

Countdown auto-approve.

---

## Interactive Approval

User must confirm.

---

## Elevated Approval

Requires additional trust.

---

## Session Trust Approval

"Allow for this session"

---

## Workspace Trust Approval

"Always allow in this workspace"

---

# 21. WebView + Agent Integration

## Recommended Flow

The agent should be able to:

- open previews
- navigate tabs
- request browser actions
- inspect pages
- attach screenshots
- monitor dev servers

through a controlled runtime API.

---

# 22. Recommended Runtime Services

## Core Services To Add

### Workspace Service

Responsible for:

- tabs
- file lifecycle
- editors
- active resources

---

### WebView Service

Responsible for:

- browser instances
- permissions
- navigation
- previews

---

### Execution Service

Responsible for:

- tool orchestration
- task lifecycle
- activity tracing

---

### Approval Service

Responsible for:

- runtime policy
- trust state
- escalation

---

### Resource Registry

Responsible for:

- URI resolution
- file mapping
- resource metadata

---

# 23. Recommended Electron IPC Architecture

## Avoid Generic IPC

Do not expose unrestricted IPC.

Instead:

use capability-specific channels.

Examples:

- `workspace.openFile`
- `workspace.openDiff`
- `workspace.openWebView`
- `workspace.openTerminal`
- `workspace.revealInExplorer`

---

# 24. Agent Implementation Plan

# Phase 1 — Runtime Resource Layer

## Objectives

Introduce workspace-addressable resources.

## Tasks

- Create workspace URI model
- Create resource registry
- Add file open events
- Add diff open events
- Add preview open events
- Add tab management

---

# Phase 2 — Electron Workspace Shell

## Objectives

Transform Electron into an IDE workspace.

## Tasks

- Multi-tab layout
- Dockable panels
- Tab persistence
- Terminal integration
- Editor integration
- Activity timeline

---

# Phase 3 — Embedded WebView Runtime

## Objectives

Enable integrated previews and provider UX.

## Tasks

- BrowserView/WebContentsView abstraction
- WebView permission model
- OAuth handling
- Navigation interception
- Trusted domain model
- Preview runtime

---

# Phase 4 — GitHub Runtime Integration

## Objectives

Make GitHub a first-class orchestration provider.

## Tasks

- Repository creation
- PR review runtime
- Inline comments
- Actions integration
- Deployment previews
- AI review suggestions

---

# Phase 5 — Dynamic Capability Governance

## Objectives

Replace rigid allowlists.

## Tasks

- Capability policy engine
- Runtime trust model
- Session trust
- Workspace trust
- Escalation rules
- Tool approval workflows

---

# 25. Critical Architectural Recommendation

The platform should avoid becoming:

# "A chat UI with plugins"

and instead evolve into:

# "A capability-governed AI development operating environment"

This distinction is extremely important.

The strongest long-term direction is:

- runtime-governed capabilities
- workspace-centric orchestration
- embedded execution surfaces
- resource-addressable UI
- policy-aware automation
- composable agent workflows

The current architecture is already pointing in this direction.

The next stage is turning:

- files
- terminals
- webviews
- diffs
- PRs
- previews
- workflows

into first-class runtime resources that the agent and UI can orchestrate together.

---
