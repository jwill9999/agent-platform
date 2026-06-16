# Task: Define Chat and Coding Project capability metadata

**Beads issue:** `agent-platform-project-experience.1`  
**Spec file:** `docs/tasks/agent-platform-project-experience.1.md`

## Summary

Define the near-term workspace model and capability metadata for the two current product surfaces:
general Chat and Coding Project. Keep the contracts extensible for future automation/task
workspaces, but do not expose those as current Workspaces options.

## Requirements

- Add workspace/profile concepts for general Chat and Coding Project.
- Represent enabled capabilities separately from the display name/path. Current capabilities should
  cover chat, general tooling/app context, project files, coding tools, terminal, Git/GitHub,
  branch selection, tests/checks, generated previews, activity evidence, and external/default IDE
  handoff.
- Preserve compatibility with existing coding Project behavior and onboarding state.
- Keep agent/model selection provider-agnostic. Profiles may suggest default tools and UI
  expectations, but they must not hard-code a model or make the coding agent the only valid Project
  agent.
- Ensure surfaces can derive expected UI affordances from capabilities:
  - Chat exposes assistant conversation and general tooling/app context, but no branch, Git,
    terminal, Project folder, or IDE handoff controls.
  - Coding Project exposes folder/repository context, Git/GitHub, branch selection, terminal,
    generated previews, activity/evidence, and local/default IDE handoff.
- Keep future docs/content, research, automation, scheduled-task, email, and application workflow
  profiles as deferred extension points only. They should not appear as Workspaces cards or user
  flows until their dedicated epics define them.
- Keep runtime metadata separate from user-facing display metadata.
- Keep existing Project records compatible by deriving default profile/capabilities from current
  metadata when explicit values are absent.

## Implementation Plan

1. Review existing Project contracts, database metadata, default-agent selection, and Project UI
   capability assumptions.
2. Add shared workspace/profile/capability schemas and helpers.
3. Update API mapping for opened/created Projects to expose explicit or derived
   profile/capability metadata.
4. Add tests for Chat defaults, Coding Project defaults, deferred/future profile fallbacks, and
   backwards compatibility.
5. Document the product model and how it maps to workspace expectations.

## Dependency Order

| Upstream                               | Downstream                            |
| -------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.14` | `agent-platform-project-experience.1` |
| `agent-platform-project-onboarding.6`  | `agent-platform-project-experience.2` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused contract/API tests for workspace/profile schemas, defaults, and metadata round trips.
- Playwright not required unless visible profile labels are added in this task.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Workspace/profile and capability contracts exist and are exported through the shared
      contracts.
- [ ] Chat and Coding Project are distinct profile/capability sets.
- [ ] Coding Project is represented as the current folder/repository workspace, not the definition
      of all assistant work.
- [ ] Existing coding Project metadata remains compatible.
- [ ] Future automation/task/docs/research profiles are deferred extension points and are not
      exposed as current Workspaces UI.
- [ ] Runtime metadata remains separate from user-facing display metadata.
- [ ] Profile/capability metadata can drive the staged E2E/workspace expectation matrix.
