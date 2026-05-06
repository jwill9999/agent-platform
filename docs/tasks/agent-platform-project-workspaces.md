# Epic: Project workspace binding and safety gate

**Beads issue:** `agent-platform-project-workspaces`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-workspaces.md`

## Objective

Make code-related work run inside an explicit Project that is backed by a command-line-accessible
working tree. Project sessions must use the coding agent by default, resolve `/workspace` to the
active Project root, and expose file/Git/terminal/test/Docker/sensor tools only when the Project
state allows them.

This epic intentionally delivers the functional and testable foundation. The richer collaborative
`AGENTS.md` onboarding lifecycle is delivered by the follow-up epic
`agent-platform-project-onboarding`.

## Product Decisions

- The user chooses either **Open Project** or **Open Chat** before entering the main interface.
- **Open Project** creates or selects a code Project, defaults to the coding agent, and uses the
  project/code interface.
- **Open Chat** opens a general chat, defaults to the personal assistant, and does not expose branch
  pickers, Git tools, terminal tools, project file trees, or code-write tools by default.
- A Project is a backend-accessible working tree. Browser-only folder access is not enough for
  code-agent execution.
- The working tree can be a monorepo. Root `AGENTS.md` provides repo-wide guidance; nested
  `AGENTS.md` files may refine app/package/service-specific guidance.
- If monorepo scope is ambiguous, the agent asks the user instead of guessing.
- Root `AGENTS.md` is required before code writes. Missing or unapproved onboarding state permits
  read-only investigation and chat, but blocks writes, deletes, file creation, commits, and
  destructive commands.
- Tool exposure is policy-driven from Project capability and onboarding state, not prompt-only.
- `/workspace` is the canonical agent-facing path for the active Project root.

## Terms

- **Project working tree:** backend-accessible repository or folder selected by the user.
- **Project root:** the path exposed to the coding agent as `/workspace`.
- **Repository root:** the Git boundary, which is usually the Project root but may be discovered
  separately.
- **Subproject scope:** app/package/service within a monorepo.
- **General chat workspace:** non-project storage/artifact area for personal assistant chats.

## Epic 1 Scope

In scope:

- Project vs Chat entry-path split.
- Default agent selection by mode: coding agent for Project, personal assistant for Chat.
- Project metadata and onboarding state foundation.
- Backend-accessible working-tree validation.
- `/workspace` resolver and PathJail/tool scoping.
- Capability-based tool gating.
- Root and nested `AGENTS.md` context loading.
- Minimal onboarding safety gate: approved onboarding required before code writes.
- Automated and Playwright E2E verification that acts as a human using the UI.

Out of scope for this epic:

- LLM-led project gap analysis.
- Collaborative `AGENTS.md` drafting/revision dialogue.
- Initial `AGENTS.md` review/approval UI polish.
- Closeout update candidates and refresh/rescan actions.
- Multi-agent orchestration beyond mode-based default agent selection.

Those items belong to `agent-platform-project-onboarding`.

## Proposed Task Chain

| Task                                  | Purpose                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `agent-platform-project-workspaces.1` | Define Project, mode, capability, and onboarding state model  |
| `agent-platform-project-workspaces.2` | Add Project vs Chat entry paths and default agent selection   |
| `agent-platform-project-workspaces.3` | Bind Project sessions to a backend-accessible working tree    |
| `agent-platform-project-workspaces.4` | Resolve `/workspace` and scope runtime tools to the Project   |
| `agent-platform-project-workspaces.5` | Enforce `AGENTS.md` onboarding gate and instruction context   |
| `agent-platform-project-workspaces.6` | Verify Project binding, safety gate, and Playwright E2E flows |

## Epic Definition Of Done

- [ ] Each child task has a Beads issue, spec file, dependency edge, and Definition of Done.
- [ ] Users can choose Project or Chat before entering the main work surface.
- [ ] Project mode defaults to the coding agent and Chat mode defaults to the personal assistant.
- [ ] Chat mode remains project-neutral and does not expose code/project tools by default.
- [ ] Project mode requires a backend-accessible working tree before code-agent tools run.
- [ ] Project sessions persist explicit Project metadata and onboarding state.
- [ ] `/workspace` resolves to the active Project root for code-agent sessions.
- [ ] File, Git, terminal, test, Docker, and sensor tools are scoped to the active Project root.
- [ ] Missing or unapproved root `AGENTS.md` allows read-only investigation but blocks code writes,
      deletions, file creation, commits, and destructive commands.
- [ ] Root `AGENTS.md` and relevant nested `AGENTS.md` files are included in code-agent context.
- [ ] Ambiguous monorepo scope triggers a user question instead of an assumed edit path.
- [ ] Playwright E2E covers Project opening, Chat opening, tool visibility, onboarding gate behavior,
      wrong-root write prevention, and a successful approved Project code interaction.
- [ ] The follow-up epic `agent-platform-project-onboarding` exists and is dependency-linked so the
      full feature goal is not lost.
