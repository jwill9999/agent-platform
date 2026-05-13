# Task: Backfill UI regression E2E coverage plan

**Beads issue:** `agent-platform-electron-stabilisation.5`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.5.md`

## Summary

Compare manual QA findings with existing browser and Electron E2E coverage, then create/update
tasks for any missing regression tests.

## Requirements

- Identify which UI regressions were not caught by current tests.
- Distinguish browser Playwright coverage from Electron desktop E2E coverage.
- Ensure Electron-only flows are tested in Electron.
- Cover Project chat, `/help`, `/help init`, `/init`, IDE handoff, return navigation, Recent
  Projects, and active Project switching where relevant.
- Create or update Beads tasks for missing automated coverage.
- Update definitions of done so future Electron/UI tasks require the right test level.

## Coverage Review

### Existing automated coverage

| Flow / regression area                                             | Current coverage                                                                                                                          | Status  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Native **Open Project** uses Electron picker/test bridge           | `apps/desktop/e2e/project-access.e2e.ts` opens deterministic local folders through the Electron desktop runtime.                          | Covered |
| Opening a Project lands in Project Chat, not IDE                   | `apps/desktop/e2e/project-access.e2e.ts` asserts Project Chat header/input and no `/ide` URL after open/reopen.                           | Covered |
| Manual absolute path entry is not the Product path                 | `apps/desktop/e2e/project-access.e2e.ts` and `e2e/mvp-e2e.spec.ts` assert browser/manual Project open paths are absent.                   | Covered |
| Project Chat can submit slash commands as first messages           | `apps/desktop/e2e/project-access.e2e.ts` sends `/help`, `/help init`, and `/init` before requiring normal chat.                           | Covered |
| `/help` lists `/init`; `/help init` explains scope/state           | `apps/desktop/e2e/project-access.e2e.ts` asserts command list, `Scope: project`, and state-changing copy.                                 | Covered |
| `/init` uses active Project context and writes instructions safely | `apps/desktop/e2e/project-access.e2e.ts` approves the draft and asserts `AGENTS.md` is created in the selected Project.                   | Covered |
| Recent Projects list is single, deduped, and safe                  | `apps/desktop/e2e/project-access.e2e.ts` asserts one Recent Projects region; `apps/web/test/project-navigation.test.ts` covers filtering. | Covered |
| Reopening Recent Projects preserves Project Chat context           | `apps/desktop/e2e/project-access.e2e.ts` opens two Projects, reopens the first, and checks URL/header/IDE href.                           | Covered |
| Built-in IDE return navigation preserves Project/session context   | `apps/desktop/e2e/project-access.e2e.ts` opens IDE, returns through the Project/IDE link, and reopens IDE.                                | Covered |
| Internal path/state copy is hidden from primary UI                 | Desktop E2E plus web tests assert no selected host folder, `/workspace`, or old branch/provider diagnostic copy.                          | Covered |
| IDE assistant typed-but-unsendable state                           | `apps/web/test/ide-chat-message.test.ts` covers disabled/unavailable text and send guards.                                                | Covered |

### Remaining coverage gaps

| Gap                                                                 | Required test level                            | Assigned task                                     |
| ------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Settings/Home return navigation and quiet breadcrumbs across routes | Renderer tests plus browser/Electron E2E       | `agent-platform-project-experience.5`             |
| External/default IDE handoff from Project Chat                      | Electron E2E with host handoff mocked or gated | `agent-platform-project-experience.4`             |
| Generated HTML/app, Markdown/document, and PDF previews             | Renderer tests plus Electron/Playwright E2E    | `agent-platform-project-experience.7`             |
| Right-side Project activity panel                                   | Renderer tests plus Electron/Playwright E2E    | `agent-platform-project-experience.8`             |
| Full integrated Project Experience flow after follow-up tasks       | Production-like Electron E2E                   | `agent-platform-project-experience.6`             |
| Desktop local-data reset/settings persistence visible UI            | Electron settings E2E or release-gate QA       | `agent-platform-electron-security.5` / release QA |

### Browser vs Electron split

- Browser Playwright should continue to cover shared route, component, copy, and unavailable-state
  behavior.
- Electron E2E is mandatory for native Project selection, host Project binding, Recent Project
  reopen semantics, desktop app data, settings persistence, external IDE handoff, and any flow that
  crosses the preload/main-process boundary.
- Generated preview rendering can use renderer/component tests for mapping and fallback states, but
  Electron/Playwright must verify the production desktop user flow when previews are shown from
  Project Chat or the right-side Project activity panel.

### Closeout requirements for future UI tasks

Any task touching Project open/reopen, Project Chat, slash commands, Recent Projects, IDE/file
handoff, generated previews, breadcrumbs, or the right-side Project panel must include:

- focused unit/component coverage for changed logic,
- browser Playwright where shared web routing or copy changes,
- Electron E2E where desktop/native/project-binding behavior changes,
- assertions that primary UI hides `/workspace`, backend roots, host absolute paths, hashes, and raw
  internal state names,
- CI/check monitoring and review-comment resolution before Beads closure.

## Implementation Plan

1. Review existing browser and Electron E2E tests.
2. Compare tests against manual QA findings and checklist.
3. Produce a coverage gap list.
4. Add missing test work to existing tasks or create new Beads tasks.
5. Update affected specs with closeout gates.

## Dependencies

| Upstream                                  | Downstream |
| ----------------------------------------- | ---------- |
| `agent-platform-electron-stabilisation.4` | none       |

## Tests And Verification

- `pnpm --filter @agent-platform/desktop run test:e2e` when Electron E2E changes are made.
- `pnpm test:e2e` when browser E2E changes are made.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm docs:lint`
- `git diff --check`

## Definition Of Done

- E2E coverage gaps are identified.
- Each required regression test is assigned to a Beads task.
- Electron-only flows are distinguished from browser E2E flows.
- Closeout criteria are updated where needed.
