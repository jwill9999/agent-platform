# Epic: Pre-production automation and release test gates

**Beads issue:** `agent-platform-pre-production-automation`  
**Spec file:** `docs/tasks/agent-platform-pre-production-automation.md`

## Summary

Collect automation and test-planning work that must be complete before promoting a production
release, without blocking normal staging and feature development.

This epic owns broad workflow expectation and regression coverage definitions that span multiple
desktop surfaces. Feature epics may continue to add their own focused E2E tests, but production
release readiness must confirm the cross-workflow matrix is defined and linked to the relevant
automation/manual QA evidence.

## Requirements

- Keep non-blocking automation follow-ups out of feature closeout epics when they are production
  readiness concerns rather than staging blockers.
- Define the desktop workflow expectation matrix before production release promotion.
- Keep Coding/Project Chat as the deepest automated E2E coverage path while allowing Personal Chat
  and future specialized workflows to mature in their owning epics.
- Link production release decisions to the automation matrix and any remaining manual-only checks.
- Do not block Project Experience development or staging merges while this epic is open.

## Initial Scope

| Issue                                      | Purpose                                                         | Production relevance                                  |
| ------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------- |
| `agent-platform-electron-stabilisation.20` | Define E2E workflow expectation matrix across desktop surfaces. | Must be complete before production release promotion. |

## Dependency Model

This epic is a production/release gate. It should block release-readiness work, not follow-on
development epics.

| Downstream work                     | Dependency                                                              |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `agent-platform-electron-release`   | Depends on this epic before production release readiness can complete.  |
| `agent-platform-project-experience` | Does not depend on this epic; it can proceed from the staging baseline. |

## Verification

- `bd show agent-platform-pre-production-automation`
- `bd show agent-platform-electron-stabilisation`
- `bd show agent-platform-project-experience.1`
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`

## Definition Of Done

- Cross-workflow desktop E2E expectation matrix is defined and linked from QA/test documentation.
- Production release handoff identifies which checks are automated and which remain manual.
- Feature-development epics are not blocked by this production-readiness planning work.
