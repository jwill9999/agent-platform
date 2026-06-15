# Task: Generalize Project profiles and capability metadata

**Beads issue:** `agent-platform-project-experience.1`  
**Spec file:** `docs/tasks/agent-platform-project-experience.1.md`

## Summary

Define Project as a generic folder/work context and add profile/capability metadata so coding is one
supported mode rather than the meaning of Project.

## Requirements

- Add Project profile concepts for coding, docs/content, research, automation, mixed, and unknown.
- Represent enabled capabilities separately from the Project record name/path: chat, files,
  coding-tools, terminal, git, tests/checks, generated previews, activity evidence, automation, and
  docs/research where applicable.
- Preserve compatibility with existing coding Project behavior and onboarding state.
- Keep agent/model selection provider-agnostic. Profiles may suggest default tools and UI
  expectations, but they must not hard-code a model or make the coding agent the only valid Project
  agent.
- Ensure Project surfaces can derive expected UI affordances from profile/capabilities. Coding
  Projects get the deepest initial coverage; docs/content, research, automation, mixed, and unknown
  Projects get explicit fallback expectations until their dedicated workflows are implemented.
- Keep runtime metadata separate from user-facing display metadata.
- Keep existing Project records compatible by deriving default profile/capabilities from current
  metadata when explicit values are absent.

## Implementation Plan

1. Review existing Project contracts, database metadata, default-agent selection, and Project UI
   capability assumptions.
2. Add shared profile/capability schemas and helpers.
3. Update API mapping for opened/created Projects to expose explicit or derived
   profile/capability metadata.
4. Add tests for profile defaults, unknown/mixed Projects, and backwards compatibility.
5. Document the product model and how it maps to workspace expectations.

## Dependency Order

| Upstream                               | Downstream                            |
| -------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.14` | `agent-platform-project-experience.1` |
| `agent-platform-project-onboarding.6`  | `agent-platform-project-experience.2` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused contract/API tests for profile schemas, defaults, and metadata round trips.
- Playwright not required unless visible profile labels are added in this task.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Project profile and capability contracts exist and are exported through the shared contracts.
- [ ] Coding is represented as one profile/capability set, not the definition of Project.
- [ ] Existing coding Project metadata remains compatible.
- [ ] Runtime metadata remains separate from user-facing display metadata.
- [ ] Profile/capability metadata can drive the staged E2E/workspace expectation matrix.
