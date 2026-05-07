# Task: Generalize Project profiles and capability metadata

**Beads issue:** `agent-platform-project-experience.1`  
**Spec file:** `docs/tasks/agent-platform-project-experience.1.md`

## Summary

Define Project as a generic folder/work context and add profile/capability metadata so coding is one
supported mode rather than the meaning of Project.

## Requirements

- Add Project profile concepts for coding, docs/content, research, automation, mixed, and unknown.
- Represent enabled capabilities separately from the Project record name/path: files, chat,
  coding-tools, terminal, git, tests, automation, and docs/research where applicable.
- Preserve compatibility with existing coding Project behavior and onboarding state.
- Ensure default agent selection can be derived from Project profile/capabilities, while coding
  remains the default only for coding-capable Projects.
- Keep runtime metadata separate from user-facing display metadata.

## Implementation Plan

1. Review existing Project contracts and database metadata usage.
2. Add shared profile/capability schemas and helpers.
3. Update API mapping for opened Projects to populate default profile/capability metadata.
4. Add tests for profile defaults, unknown/mixed Projects, and backwards compatibility.
5. Document the product model in architecture/development docs.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-onboarding.6` | `agent-platform-project-experience.2` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused contract/API tests for profile schemas, defaults, and metadata round trips.
- Playwright not required unless visible profile labels are added in this task.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Project profile and capability contracts exist.
- [ ] Coding is represented as a profile/capability, not the definition of Project.
- [ ] Existing coding Project metadata remains compatible.
- [ ] Runtime metadata remains separate from user-facing display metadata.
