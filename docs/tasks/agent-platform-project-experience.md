# Epic: Project experience and navigation

**Beads issue:** `agent-platform-project-experience`  
**Spec file:** `docs/tasks/agent-platform-project-experience.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.md`

## Objective

Turn Project into a clear, generic work context that users can reopen, chat with, and optionally
inspect in the IDE without being forced into coding or runtime implementation details.

This epic follows `agent-platform-project-onboarding`. The onboarding epic may remain focused on
`AGENTS.md` and coding-capable Projects, while this epic implements the broader Project product
experience: profile-aware Projects, chat-first entry, left-side navigation, recent/reopen Projects,
optional IDE handoff, breadcrumbs, and user-facing labels.

## Product Decisions

- Project means a folder/work context. It may be a code repository, docs/content folder, research
  folder, automation workspace, generated app, or mixed files.
- The coding agent is a Project profile/tooling choice, not the definition of Project.
- Opening a Project should land in project-scoped chat by default.
- The IDE is an optional deeper view that preserves the active Project and conversation.
- Primary navigation belongs in the left explorer: top-level app routes, recent/reopen Projects, and
  recent Chats/Sessions.
- User-facing copy should show Project name, folder/relevant relative path, profile/status, and
  branch only where useful. Runtime details such as `/workspace`, backend root, repository root, and
  backend accessibility are technical details.
- Font sizing should match the existing interface: sidebar rows around `text-sm`/14px, metadata
  `text-xs`, no oversized card-style navigation.

## Scope

In scope:

- Project profile/capability model for coding, docs/content, research, automation, mixed, and
  unknown Projects.
- Left explorer navigation for Projects and Chats/Sessions.
- Recent/reopen Project list backed by existing Project records and metadata.
- Open/New Project flow from the explorer.
- Project-scoped chat as the default Project surface.
- Explicit Open IDE action from an active Project Chat.
- Session/project continuity between Project Chat and IDE.
- Breadcrumbs or equivalent quiet location affordance for Home, Chat, Project, and IDE.
- User-facing Project labels that hide runtime implementation details.
- Playwright coverage for the navigation and context-preservation flows.

Out of scope:

- Full `AGENTS.md` onboarding implementation, which belongs to `agent-platform-project-onboarding`.
- External host IDE integration.
- Multi-user permissions or remote checkout management.
- Scheduled task/cron runtime implementation beyond representing automation as a Project profile.

## Proposed Task Chain

| Task                                  | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `agent-platform-project-experience.1` | Generalize Project profiles and capability metadata      |
| `agent-platform-project-experience.2` | Add left explorer Project and Chat navigation            |
| `agent-platform-project-experience.3` | Make Project Chat the default Project surface            |
| `agent-platform-project-experience.4` | Add optional IDE handoff with session continuity         |
| `agent-platform-project-experience.5` | Clean Project labels and add breadcrumbs                 |
| `agent-platform-project-experience.6` | Verify Project experience navigation with Playwright E2E |

## Testing Strategy Requirements

Each child task must include concrete local and remote verification:

- mandatory local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`, unless
  the task explains why a narrower gate is sufficient.
- focused unit/contract/component tests for touched behavior.
- Playwright coverage for user-visible navigation, Project reopen, Project Chat, IDE handoff, and
  context preservation when the task changes those flows.
- GitHub PR checks, SonarCloud/GitGuardian/Sourcery state, and review comments must be monitored
  before closing Beads tasks.

## Epic Definition Of Done

- [ ] Project records can represent generic folder/work contexts with profile/capability metadata.
- [ ] Users can see Projects and Chats/Sessions in the left explorer without scattered CTAs.
- [ ] Users can reopen previous Projects from stored metadata.
- [ ] Opening a Project lands in project-scoped chat by default.
- [ ] Users can explicitly open the IDE from a Project and keep the same Project/session context.
- [ ] Users can return to Home/Project Chat through breadcrumbs or equivalent quiet navigation.
- [ ] Normal UI hides `/workspace`, backend accessibility, backend root, and repository root.
- [ ] Playwright verifies Chat, Project reopen, Project Chat, IDE handoff, return navigation, and
      context preservation.
