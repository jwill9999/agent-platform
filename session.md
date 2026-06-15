# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise,
and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive:
  [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads
  tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-06-15
- **Session:** Synced `staging` after Electron sign-off and Project Experience re-baseline merges.
- **Branch:** `staging`
- **Latest commit:** `f54d116` records the Electron stabilisation staging sign-off and re-baseline docs.

## Current State

- `staging` is synced with `origin/staging` at `f54d116`.
- Electron stabilisation has merged to `staging`; owner manual testing passed on 2026-06-15 and
  `agent-platform-electron-stabilisation.12` is closed.
- PR #231's desktop E2E flake is resolved on `staging`: Project access E2E now selects Active agent
  values through a retrying helper that waits for visibility and confirms the selected value.
- `.18` is closed: owner manual QA sign-off is recorded after the automation backfill.
- Project Experience re-baseline is merged to `staging`; `agent-platform-project-experience.14` is
  closed and the epic is now 7/14 complete.
- The next implementation task is `agent-platform-project-experience.1`, which generalizes Project
  profiles and capability metadata.
- `.17` is closed: deterministic `.12` gaps now have Electron Playwright coverage.
- `.19` is closed: first-loaded Workspaces layout is covered at compact and expanded Electron window
  sizes.
- `.20` is open as a non-blocking follow-up to define the broader E2E expectation matrix across
  Workspaces, Project Chat/Coding, Personal Chat, secondary file view, and future specialized
  workflows.
- Production macOS release remains blocked by `agent-platform-macos-production-sandbox.6.3`, which
  still requires real Developer ID signing and Apple notarization evidence.
- Terminal dock now defaults to `MesloLGS NF`; users can still choose the other terminal fonts from
  the toolbar.
- `.21` is closed: the Workspace Preview native WebView bounds regression shown when the Git/GitHub
  rail collapses is fixed and covered by targeted Electron E2E.
- `.22` is closed: the Git & GitHub Changes tab now renders structured, readable unified diffs in
  the desktop side panel and is covered by targeted Electron E2E.
- `.23` is closed: Workspace Preview sizing/controls are clearer, Open in IDE uses the desktop
  external launcher instead of `/ide`, the command-runner badge says `Agent commands off`, and the
  Push tab/action no longer shows an inline ahead-count badge.
- `.24` is closed: Personal Chat entered from Workspaces now marks the Chat nav item active,
  desktop/API startup seeds the Personal assistant profile into local runtime DBs, existing bad
  personal sessions are repaired to the Personal assistant profile, and model selection remains
  provider/model agnostic.
- `.25` is in final verification: zero usable model configs disable chat send with a `Configure
model` CTA; exactly one usable model config becomes the default; multiple configs remain
  selectable and agent preference still wins.
- `agent-platform-287` is closed: generated Electron preload now exposes `projects.openInIde`, so
  connected Project workspaces no longer hit the missing desktop bridge banner.
- `agent-platform-288` is closed: the PR creation panel now lets users choose the base branch, and
  Electron WebView navigation state uses `webContents.navigationHistory` instead of deprecated
  `canGoBack`/`canGoForward`.
- `agent-platform-289` is closed: PR creation now has an explicit target branch selector, visible
  quick choices, `source -> target` copy, and recommends `staging` when that branch exists.

## Recent Work

- Added `workspaceNavigationChangedEvent` so programmatic `history.pushState` navigation updates
  the left sidebar active state.
- Added `aria-current` to workspace sidebar links and covered the Chat active state in Electron
  E2E.
- Guarded Chat agent selection with system/user ownership so Personal Chat defaults to Personal
  assistant and Project/Coding selections do not leak into global Chat.
- Aligned frontend model selection with backend precedence: agent-assigned model first, otherwise
  the first usable platform default model config.
- Added API startup seeding so local managed desktop runs get the same Personal assistant/Coding
  baseline that Docker and E2E already seed.
- Added Personal Chat session repair so previously created `mode=chat` sessions with the wrong
  backend agent owner are normalized before use.
- Added `usableModelConfigs` so model availability is provider/model agnostic but explicit: keyed
  saved configs and local `ollama` configs can run.
- Disabled chat send and surfaced a Settings > Models setup CTA when no usable model config exists.
- Added focused model-selection tests for zero, one, and multiple usable model configs.
- Added Beads task/spec `agent-platform-electron-stabilisation.24` for the Personal Chat regression.
- Added Beads task/spec `agent-platform-electron-stabilisation.25` for required model-config UX.
- Updated `apps/web/components/project/project-webview-panel.tsx` so native WebView bounds are
  deduped by rounded viewport rectangle and resynced via `ResizeObserver`, window resize, and an
  animation-frame layout check while a WebView is active.
- Added optional `bounds` to `DesktopWorkspaceWebViewState` and recorded the last applied bounds in
  `apps/desktop/src/main/webviewService.ts` for diagnostics/E2E verification.
- Extended `apps/desktop/e2e/webview-runtime.e2e.ts` to collapse the Git/GitHub panel and assert the
  recorded native bounds still match the visible preview viewport.
- Added Beads task/spec `agent-platform-electron-stabilisation.21` for this regression.
- Updated `apps/web/components/project/project-git-github-panel.tsx` so the diff preview renders
  file headers, hunks, additions, deletions, and context lines with readable row styling, line
  numbers, stable scroll, and compact selected-file metadata.
- Extended `apps/desktop/e2e/project-git-workflow.e2e.ts` to select a modified README diff and
  assert hunk/addition rows render in the improved preview.
- Added Beads task/spec `agent-platform-electron-stabilisation.22` for the Git diff rendering
  improvement.
- Updated Workspace Preview controls to labeled `Wide` and `Focus` actions and responsive panel
  widths.
- Added desktop `projects.openInIde` bridge plus a system IDE/folder launcher with
  `AGENT_PLATFORM_DESKTOP_IDE_COMMAND` override and common IDE fallbacks.
- Updated Project Chat and Git conflict resolver Open in IDE actions to use the desktop launcher
  instead of the internal `/ide` route.
- Changed the command-runner badge from duplicate `disabled disabled` to `Agent commands off` and
  kept the Push tab/action label to `Push` without an inline count badge.
- Added explicit short-lived `Refreshing` feedback to the left-sidebar Recent Projects refresh
  control so fast reloads no longer feel inert.
- Added Beads task/spec `agent-platform-electron-stabilisation.23` for the preview/IDE/status UI
  refinement.
- Added `apps/desktop/e2e/stabilisation-backfill.e2e.ts`.
- Covered settings/model/API key persistence, restart persistence, Project-scoped versus Personal
  Chat sessions, missing/unavailable Projects, and UI leakage/layout smoke.
- Updated `apps/desktop/e2e/project-access.e2e.ts` to remove stale/flaky assumptions uncovered by
  full-suite ordering.
- Added `docs/qa/electron-stabilisation-automation-matrix.md`.
- Added Beads task `agent-platform-electron-stabilisation.18` for owner manual QA sign-off and made
  `.12` depend on `.17` and `.18`.
- Added Beads task `agent-platform-electron-stabilisation.19` for first-load responsive layout E2E
  coverage.
- Added Beads task `agent-platform-electron-stabilisation.20` as a non-blocking follow-up for the
  workflow expectation matrix.
- Changed `apps/web/components/project/project-terminal-dock.tsx` so new terminal sessions default
  to `MesloLGS NF`.
- Added `agent-platform-electron-stabilisation.26` for the local desktop model-chat failure caused
  by unstable `make electron-local` secrets master keys.
- Changed `make electron-local` to create and reuse
  `.agent-platform/desktop-runtime/config/secrets-master-key.b64` so saved model API keys remain
  decryptable across local restarts.
- Added an actionable `MODEL_CONFIG_KEY_DECRYPTION_FAILED` chat error when an existing saved model
  key was encrypted with an old/unavailable master key; users must re-enter that API key once.
- Extended managed Electron E2E model mocking so Playwright can assert visible assistant responses
  in both Personal Chat and Project/Coding workspaces.
- Seeded a throwaway encrypted E2E model config in `apps/desktop/e2e/project-access.e2e.ts` and
  asserted both workspace flows can send a prompt and receive `E2E model response received`.
- Added desktop supervisor and package-script unit coverage for E2E mock passthrough and stable
  `make electron-local` secrets key behavior.
- Fixed `agent-platform-287`: the generated CommonJS preload used by Electron now exposes
  `projects.openInIde` and `maintenance.repairMacosVmRuntime`, matching the TypeScript preload
  bridge. This resolves the connected-Project `Open in IDE is available...` banner.
- Extended Project access E2E so clicking `Open in IDE` fails the test if missing-bridge,
  missing-folder, or generic open-failure banners appear.
- Added `agent-platform-288` for the latest Git/GitHub panel follow-ups.
- Added branch-option derivation and an editable `Base branch` field to the PR creation card so
  users can merge a published feature branch into `staging`, `develop`, or another branch instead
  of silently defaulting to `main`.
- Updated PR creation tests so the fake GitHub CLI fails unless `--base staging` is passed.
- Replaced Electron WebView `webContents.canGoBack()` / `canGoForward()` calls with
  `webContents.navigationHistory.canGoBack()` / `canGoForward()` and updated tests.
- Added `agent-platform-289` after manual testing showed the base branch field was still too
  subtle and appeared to create `branch -> main` PRs.
- Replaced the PR target input with an explicit dropdown plus quick branch buttons and visible
  `current branch -> selected target` copy.
- Added `recommendPullRequestBaseBranch` so `staging` is the recommended PR target when available,
  while `main`, `develop`, and detected branches remain selectable.
- Added `agent-platform-290` for the CI regressions reported on run `27551242386`.
- Moved the encrypted `E2E model` fixture into shared `E2E_SEED` database seeding so browser,
  desktop, and packaged VM E2E runs have a usable model config whenever `SECRETS_MASTER_KEY` is set.
- Updated the parked IDE browser E2E to expect the current desktop-only Open in IDE guard instead
  of the removed internal `/ide` route.
- Addressed SonarCloud annotations in WebView navigation, Project PR UI, app-page conditions, and
  WebView runtime E2E globals; also removed duplicated project-access model seeding.
- Added `agent-platform-24u` after the E2E fix cleared CI but SonarCloud still reported `4.4%`
  duplicated new code.
- Moved shared desktop bridge DTO types into contracts so preload and web helpers stop duplicating
  project-folder, IDE handoff, and terminal event type definitions.
- Merged `jwill9999/electron-stabilisation-e2e-backfill` to `staging` as `ba0be9b`; staging CI/CD
  was green per owner report.
- Closed `agent-platform-electron-stabilisation.18` after owner manual testing passed.
- Added `agent-platform-project-experience.14` and re-baselined the Project Experience epic around
  the current chat-first staging product direction.
- Refined `.2`, `.4`, `.5`, and `.6` into audit/polish/staged-verification tasks rather than
  rebuild tasks; clarified `.7` previews and `.8` activity/evidence panel.

## Checks Run

- `pnpm --filter @agent-platform/contracts build`
- `pnpm --filter @agent-platform/contracts typecheck`
- `pnpm --filter @agent-platform/db build`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/packaged-vm-command.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-access.e2e.ts`
- `BASE_URL=http://127.0.0.1:3001 API_URL=http://127.0.0.1:3000 pnpm exec playwright test -c e2e/playwright.config.ts e2e/ide-project-opening-parked.spec.ts`
- `pnpm --filter @agent-platform/desktop test -- test/webviewService.test.ts test/backendSupervisor.test.ts test/packageScripts.test.ts`
- `pnpm --filter @agent-platform/web typecheck`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/api typecheck`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/stabilisation-backfill.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/webview-runtime.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-git-workflow.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-access.e2e.ts`
- `pnpm --filter @agent-platform/api test -- test/sessionChat.integration.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts`
- `pnpm --filter @agent-platform/api typecheck`
- `pnpm --filter @agent-platform/api lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts`
- `pnpm --filter @agent-platform/desktop build`
- `pnpm --filter @agent-platform/api test -- test/crud.integration.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts`
- `pnpm --filter @agent-platform/web test -- test/project-git-workflow-overview.test.ts`
- `pnpm --filter @agent-platform/api test -- test/projectsRouter.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/webviewService.test.ts`
- `pnpm --filter @agent-platform/web typecheck`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/web test -- test/modelSelection.test.ts test/default-agent.test.ts`
- `pnpm --filter @agent-platform/web test -- test/modelSelection.test.ts`
- `pnpm --filter @agent-platform/api lint`
- `pnpm --filter @agent-platform/api typecheck`
- `pnpm --filter @agent-platform/contracts typecheck`
- `pnpm --filter @agent-platform/desktop test:e2e` (`8 passed`)
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/web typecheck`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-access.e2e.ts` (`1 passed`)
- `pnpm --filter @agent-platform/desktop test:e2e` (`9 passed`)
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`

SonarQube MCP/tools were not exposed by tool discovery in this session, so the completion gate used
the documented fallback checks above.

## Next

1. Start `agent-platform-project-experience.1` from the accepted re-baselined `staging` plan.
2. Decide whether to move non-blocking `.20` to a broader automation/testing epic before closing the
   Electron stabilisation epic.
3. Keep production macOS release blocked until `agent-platform-macos-production-sandbox.6.3` has
   signed/notarized artifact evidence.
