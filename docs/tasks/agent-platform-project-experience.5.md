# Task: Clean Project labels and add breadcrumbs

**Beads issue:** `agent-platform-project-experience.5`  
**Spec file:** `docs/tasks/agent-platform-project-experience.5.md`

## Summary

Replace implementation-oriented Project labels with user-facing language and add quiet breadcrumbs or
equivalent location navigation.

## Requirements

- Hide `/workspace`, backend accessibility, backend root, and repository root from normal UI.
- Show Project name, relevant folder/relative path, profile/status, onboarding state, and branch only
  where useful.
- Add quiet breadcrumbs or equivalent navigation for Home, Chat, Project, and IDE.
- Breadcrumbs should not create oversized headings or scattered CTAs.
- Sidebar and breadcrumbs should use existing font scale, with most navigation rows around 14px.

## Implementation Plan

1. Audit Project/IDE/Chat labels for implementation terminology.
2. Replace primary copy with user-facing Project/folder language.
3. Move runtime details to technical details/debug affordances if still needed.
4. Add breadcrumbs or equivalent route context component.
5. Add tests for visible labels and navigation.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.4` | `agent-platform-project-experience.6` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Component tests for breadcrumb labels and Project status copy.
- Playwright: verify Project/IDE pages do not expose `/workspace` or backend accessibility in primary
  UI and verify breadcrumbs navigate back as expected.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Primary UI no longer exposes `/workspace` or backend accessibility.
- [ ] Project and IDE labels show user-relevant Project/folder context.
- [ ] Breadcrumbs or equivalent quiet navigation exists for Home, Chat, Project, and IDE.
- [ ] Font sizing matches existing compact navigation scale.
