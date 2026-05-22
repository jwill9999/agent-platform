# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-05-22
- **Session:** Implemented capability recovery UX for allowlist failures on `task/capability-recovery-ux`.
- **Today’s outputs:** Added shared capability recovery schemas, emitted structured recovery metadata for `TOOL_NOT_ALLOWED` dispatch failures, preserved recovery data through the web stream parser, rendered capability-oriented statuses/options in the operator tool trace, and documented/closed bead `agent-platform-fxi`.
- **Validation:** Passed focused web/contracts/harness tests, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm docs:lint`, and a rerun of `projectsRouter.test.ts`. Full `pnpm test` passed all packages except one unrelated API `projectsRouter.test.ts` timeout on first run; the same file passed immediately on rerun. SonarQube MCP analysis was not available through the current tool surface, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-fxi` is closed. Branch is `task/capability-recovery-ux`; the current branch tip contains the capability recovery implementation and this handoff update.
- **Next:** Push Beads and the task branch. Follow-up architecture work can introduce a real capability registry/resolver and make recovery card actions interactive.
- **Date:** 2026-05-22
- **Session:** Implemented the GitHub repository create/connect flow on `task/divergent-pull-merge-resolver` and committed the completed Git workflow work.
- **Today’s outputs:** Added GitHub CLI-backed create/connect repository API routes, shared contracts, no-remote Publish UI with Create Repository and Connect Existing Repository actions, repository connection modal states, refreshed publish/PR/check routing after connection, task specs for the divergent resolver and repository connection work, and Electron/API/web regression coverage.
- **Validation:** Passed focused API Project router tests, focused web Git workflow tests, API/web/desktop typechecks, focused Electron Playwright `project-git-workflow.e2e.ts`, root lint, and desktop/web/API builds during E2E. SonarQube MCP analysis was not available through the current tool surface, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-y4u` is closed. Branch is `task/divergent-pull-merge-resolver`; commit `0b36ef6` contains the completed create/connect flow. `output/` remains unrelated/untracked and must not be committed.
- **Next:** Commit this session handoff update, push the branch, then start the next GitHub workflow slice: in-app pull request creation and monitoring.
- **Date:** 2026-05-21
- **Session:** Implemented the Git workflow continuation and safe cleanup pass on `task/agent-platform-terminal-git-panel-layout`: post-commit workflow now lands on Publish and unwanted local files can be stashed safely from Changes.
- **Today’s outputs:** Added `POST /v1/projects/:id/git/stash`, stash request contracts, local Git stash handling with repository-relative path validation, `Stash file` in the Changes diff actions, stale diff-selection cleanup after stash, and preferred-tab routing so Commit disappearing after success does not bounce the user back to Overview.
- **Validation:** Passed focused web Git workflow tests, elevated API Project router tests, elevated Electron Playwright `project-git-workflow.e2e.ts`, desktop/web/API builds during E2E, and `git diff --check`. The first API run failed only because sandboxed Supertest socket binding is blocked and passed with approved escalation.
- **Current state:** The Git workflow stash cleanup commit is on `task/agent-platform-terminal-git-panel-layout`; branch is ready to push after this session handoff update is included. `output/` remains unrelated/untracked and must not be committed.
- **Next:** Push this branch, then resume tomorrow with the next Git workflow improvement after manual review.
- **Date:** 2026-05-19
- **Session:** Implemented `agent-platform-59i` on `task/agent-platform-terminal-git-panel-layout`: the Git workflow now has explicit publish and stale-upstream recovery actions after local commits.
- **Today’s outputs:** Added API routes for `POST /projects/:id/git/publish` and `POST /projects/:id/git/clear-upstream`; Publish now creates/sets upstream with `git push -u origin <branch>` when an origin exists, no longer labels unpushed local commits as pushed, explains no-remote projects clearly, offers stale-upstream clearing, and keeps backtracking instructions visible for undoing the last local commit from the terminal. The Commit tab now disappears once staged files are committed and the workflow advances into Publish.
- **Validation:** Passed web typecheck, API typecheck, desktop typecheck, web lint, focused web Git workflow tests, elevated API route tests, elevated Electron Playwright `project-git-workflow.e2e.ts`, `pnpm format:check`, and `git diff --check`. The first sandbox API/Electron runs failed only because local socket binding is blocked in the sandbox (`listen EPERM`) and passed with approved escalation.
- **Current state:** Bead `agent-platform-59i` is ready to close. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push this task branch. Then continue with `agent-platform-4hm`: post-push completion and PR creation flow.
- **Date:** 2026-05-19
- **Session:** Implemented `agent-platform-5nv` on `task/agent-platform-terminal-git-panel-layout`: Git & GitHub panel tabs now reveal progressively by workflow state instead of showing every future action at once.
- **Today’s outputs:** Split the old Changes/Commits flow into workflow-specific Overview, Changes, Commit, Publish, PRs, and Checks steps; moved commit controls into the Commit step; auto-advances from commit success into Publish; and added focused Electron Playwright coverage that opens a real Git Project and walks clean → changed → staged → commit-ready UI states.
- **Validation:** Passed focused web workflow tests, web typecheck, web lint, desktop lint, desktop typecheck, focused Electron Playwright `project-git-workflow.e2e.ts`, `pnpm format:check`, and `git diff --check`. The older broad `project-access.e2e.ts` still has an unrelated attachment smoke assertion failure and should be split/fixed under the Electron stabilisation epic.
- **Current state:** Bead `agent-platform-5nv` is closed locally. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Push this commit, then continue with `agent-platform-59i`: upstream publish and clear actions.
- **Date:** 2026-05-19
- **Session:** Planned the next Git workflow UI iteration after manual feedback: progressive workflow steps, upstream actions, commit/push/PR flow, checks refinement, Web Explorer handoff, and Playwright journey coverage.
- **Today’s outputs:** Created Beads epic `agent-platform-ii1` and eight ordered P1 tasks (`agent-platform-5nv`, `agent-platform-59i`, `agent-platform-4hm`, `agent-platform-0ra`, `agent-platform-5zg`, `agent-platform-17h`, `agent-platform-e6g`, `agent-platform-7vf`). Added task specs in `docs/tasks/agent-platform-git-workflow-ui*.md` and implementation plan `docs/superpowers/plans/2026-05-19-git-workflow-ui.md`.
- **Validation:** Ran Prettier check for the new task/plan docs and verified the dependency tree for the final Playwright task.
- **Current state:** Beads has been pushed. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Commit and push the planning docs, then start task `agent-platform-5nv`: guide the Git panel by workflow state.
- **Date:** 2026-05-19
- **Session:** Fixed `agent-platform-asp` on `task/agent-platform-terminal-git-panel-layout`: Git & GitHub panel loading and stale diff state after testing feedback.
- **Today’s outputs:** Added a Project-scoped loading guard so the side panel shows `Loading Git state...` until the current Project status is loaded, reset Project-scoped Git/check/PR/change data on Project switches, and guarded diff fetches so stale selected files cannot request diffs against the wrong Project. Added focused regression coverage.
- **Validation:** Passed focused Git workflow overview tests, full web test suite, web typecheck, web lint, `pnpm format:check`, and `git diff --check`.
- **Current state:** Bead `agent-platform-asp` is closed and Beads has been pushed. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Commit and push the fix. Then owner can manually retest the side-panel loading state and Changes tab before moving to item 2.
- **Date:** 2026-05-19
- **Session:** Implemented `agent-platform-zzm` on `task/agent-platform-terminal-git-panel-layout`: Git & GitHub Overview now shows a workflow "Next step" state instead of the placeholder GitHub Sensors card.
- **Today’s outputs:** Added a tested workflow-state derivation for dirty worktrees, staged changes, missing upstreams, ahead commits, pushed branches without PRs, open PRs, and failing/running checks. Overview now loads PR/check summaries, renders a user-facing next-step card, and routes its CTA to the appropriate tab without adding new mutation actions yet.
- **Validation:** Passed focused Git workflow overview tests, full web test suite, web typecheck, web lint, `pnpm format:check`, and `git diff --check`.
- **Current state:** Bead `agent-platform-zzm` is closed and Beads has been pushed. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Commit and push the task branch. Then owner can manually test the Overview state before moving to item 2: missing-upstream publish/unset actions.
- **Date:** 2026-05-17
- **Session:** Implemented `agent-platform-lkr` on `task/agent-platform-terminal-git-panel-layout`: Project Git UI now labels local branches whose configured upstream no longer exists.
- **Today’s outputs:** Added upstream state to Project branch/status contracts, detected missing remote-tracking refs with local Git, labelled stale upstreams in the chat branch selector and Git & GitHub panel, and blocked the Push CTA/API path when a branch tracks an upstream that has been pruned. Added focused API coverage that creates a real stale-upstream branch after `git fetch --prune`.
- **Validation:** Passed contracts focused tests, contracts build, API typecheck, API lint, web typecheck, web lint, elevated focused API Project router tests after the expected Supertest listener restriction inside the sandbox, `pnpm format:check`, and `git diff --check`.
- **Current state:** Bead `agent-platform-lkr` is implemented and ready to close. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push the task branch. Later Git work can add publish/unset-upstream actions and richer PR interaction flows.
- **Date:** 2026-05-17
- **Session:** Implemented `agent-platform-88d` on `task/agent-platform-terminal-git-panel-layout`: Git & GitHub Checks now scope to merge-relevant checks.
- **Today’s outputs:** Added a task spec, extended the Project Git checks contract with source metadata, changed `GET /v1/projects/:id/git/checks` to prefer the current branch PR check rollup via `gh pr view`, fall back to exact `HEAD` check runs via `gh api`, and stop using broad `gh run list` workflow history for the main Checks tab. The Checks UI now labels whether data came from the current PR or branch head.
- **Validation:** Passed contracts project tests, contracts build, API typecheck, API lint, web typecheck, web lint, `pnpm format:check`, and `git diff --check`. Focused API Project router tests passed outside the sandbox after the expected Supertest listener restriction (`listen EPERM`) inside the sandbox.
- **Current state:** Bead `agent-platform-88d` is implemented and ready to close. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push the task branch. Later work can add a separate "Workflow history / all runs" view and interactive PR actions.
- **Date:** 2026-05-17
- **Session:** Implemented `agent-platform-hwt` on `task/agent-platform-terminal-git-panel-layout`: UI branch selector checkouts now trigger the shared Project Git refresh path.
- **Today’s outputs:** Added a Project branch-change handler that updates the active Project record, bumps `projectGitRefreshKey`, and schedules Project Git reconciliation so the Git & GitHub side panel reloads after a branch is changed from the chat input selector. Filed `agent-platform-lkr` for terminal-driven Git state and stale-upstream branch labelling, and `agent-platform-88d` for scoping Checks to current PR/head checks instead of broad workflow history.
- **Validation:** Passed web typecheck, web lint, web tests, `pnpm format:check`, and `git diff --check`. SonarQube MCP was not available in-session, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-hwt` is ready to close. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit the branch-selector refresh follow-up, and retry the branch push. The previous push attempt was blocked by unrelated harness `qualityGateTool.test.ts` timeout sensitivity in the pre-push affected-package run.
- **Date:** 2026-05-17
- **Session:** Implemented `agent-platform-1lg` on `task/agent-platform-terminal-git-panel-layout`: Project terminal now refits to the resized chat column when the Git & GitHub side panel is open.
- **Today’s outputs:** Added terminal dock section-level resize observation, backend terminal resize propagation after dock width changes, and overflow/min-width guards so the terminal toolbar and xterm canvas stay bounded to the main chat column. Filed follow-up `agent-platform-88d` to scope the Checks tab to current PR/head checks and move broader workflow history behind a secondary affordance.
- **Validation:** Passed web typecheck, web lint, web tests, `pnpm format:check`, and `git diff --check`. SonarQube MCP was not available in-session, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-1lg` is ready to close. Branch is `task/agent-platform-terminal-git-panel-layout`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push this branch, then owner can manually test opening/closing the Git side panel while the terminal is visible.
- **Date:** 2026-05-17
- **Session:** Implemented `agent-platform-0k7` on `task/agent-platform-git-push-action`: Project Git commits now surface an immediate success state and the Commits tab can push an ahead branch with an upstream.
- **Today’s outputs:** Added `POST /v1/projects/:id/git/push`, upstream validation with explicit no-upstream copy, focused API coverage for pushing to a configured upstream, Commits-tab success messaging after local commit, automatic navigation to the Commits tab after a commit, a Push CTA for ahead branches, and bottom breathing room for the Project terminal dock. The Git side panel resize-vs-overlay behavior remains a follow-up UI polish decision; the preferred direction is to resize the main chat/terminal column and collapse the Git panel only below a usable width.
- **Validation:** Passed focused API Project router tests, API typecheck, web typecheck, API lint, web lint, web tests, root `pnpm lint`, root `pnpm typecheck`, elevated root `pnpm test` after the expected sandbox `listen EPERM 127.0.0.1` restriction, `pnpm format:check`, and `git diff --check`. SonarQube MCP was not available via tool discovery in this session, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-0k7` is ready to close. Branch is `task/agent-platform-git-push-action`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push the branch, then owner can manually test edit → stage → commit auto-opens Commits with success, Push works for ahead upstream branches, no-upstream branches explain the terminal fallback, and the terminal no longer sits tight against the bottom canvas.
- **Date:** 2026-05-16
- **Session:** Implemented `agent-platform-github-prs-readonly` on `task/agent-platform-github-prs-readonly`: Git & GitHub PRs tab now has read-only GitHub pull request visibility, and Project Git state ignores app-owned runtime artifacts.
- **Today’s outputs:** Added shared PR contracts, `GET /v1/projects/:id/github/pull-requests`, GitHub CLI availability/auth handling, GitHub remote slug parsing reuse, PR state/review/check summary normalization, focused API coverage with a fake `gh` binary, and a real PRs tab UI with loading/unavailable states, current-branch highlighting, review/check summaries, and links back to GitHub. Git status/changes/stage-all/commit validation now excludes `.agent-platform/**` so internal browser/runtime artifacts do not appear as user Project changes. The Git side panel now keeps its own bounded scroll area, and the Changes file list is capped so opening Changes cannot collapse the terminal/chat layout. PR mutation, comment replies, merge, and branch actions remain intentionally out of scope for the next interactive PR task.
- **Validation:** Passed focused contracts PR tests, focused API Project router PR tests outside the sandbox after the expected Supertest socket restriction, API typecheck, web typecheck, web lint, full workspace `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm docs:lint:links`, and `git diff --check`. `pnpm docs:lint` remains blocked by an existing generated Playwright artifact under `apps/desktop/test-results/.../error-context.md`, not by this change set. SonarQube MCP was not available via tool discovery, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-github-prs-readonly` is implemented locally and ready to close. Branch is `task/agent-platform-github-prs-readonly`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push this branch, then owner can manually test the PRs tab in Electron with an authenticated GitHub CLI and a repo that has open PRs.
- **Date:** 2026-05-16
- **Session:** Implementing `agent-platform-github-checks-view` on `task/agent-platform-github-checks-view`: Git & GitHub Checks tab backed by local GitHub remote detection and GitHub CLI data when available.
- **Today’s outputs:** Added shared checks contracts, `GET /v1/projects/:id/git/checks`, GitHub remote slug parsing, `gh` availability/auth handling, check-run normalization and summaries, focused API coverage with a fake `gh` binary, and a real Checks tab UI with loading, unavailable, summary, run list, status badges, and GitHub links. Data remains explicit: no inferred checks when GitHub CLI/auth is unavailable.
- **Validation:** Passed contracts build/typecheck/test, API typecheck, focused API router tests outside the sandbox after the expected Supertest socket restriction in sandbox, full API test suite, web typecheck, web lint, web unit tests, `pnpm format:check`, and `git diff --check`. SonarQube MCP was not available via tool discovery, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-github-checks-view` is implemented locally and ready to close. Branch is `task/agent-platform-github-checks-view`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push this branch, then owner can later manually test the Checks tab in Electron with a GitHub repo and authenticated `gh`.
- **Date:** 2026-05-16
- **Session:** Implementing `agent-platform-cem` on `task/agent-platform-cem`: local Git commit flow from the Git & GitHub Changes tab.
- **Today’s outputs:** Added a shared commit body contract, `POST /v1/projects/:id/git/commit`, staged-change validation, refreshed Git status after commit, and a Changes-tab commit message/action UI. Commit remains local-only; push, PR creation, and GitHub auth are out of scope.
- **Validation:** Passed contracts test/typecheck/build, API typecheck, focused API router test outside the sandbox after the expected Supertest socket restriction in sandbox, web typecheck, web lint, web unit tests, `pnpm format:check`, and `git diff --check`. SonarQube MCP was not available via tool discovery, so the documented fallback gate was used.
- **Current state:** Bead `agent-platform-cem` is closed and pushed. Branch is `task/agent-platform-cem`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Owner can manually test edit → stage → commit in Electron, then the next Git slice can add push/remote sync.
- **Date:** 2026-05-16
- **Session:** Implemented `agent-platform-xlg` on `task/agent-platform-xlg`: Git & GitHub panel now has a local-only Changes review view.
- **Today’s outputs:** Added shared contracts and Project API endpoints for changed-file listing, file diff loading, staging, unstaging, and stage-all. Replaced the placeholder Changes tab with grouped staged/unstaged/untracked file rows, read-only diff previews, and safe staging actions. Destructive Git actions remain intentionally out of scope.
- **Validation:** Passed contracts project tests/typecheck, API typecheck, focused API Project router tests outside the sandbox due Supertest socket binding, web typecheck, web lint, full web tests, `pnpm format:check`, and `git diff --check`.
- **Current state:** Bead `agent-platform-xlg` is ready to close locally. Branch is `task/agent-platform-xlg`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push the task branch, then owner can manually test editing files, reviewing diffs, staging/unstaging, and stage-all in Electron.
- **Date:** 2026-05-16
- **Session:** Implemented `agent-platform-67u` on `task/agent-platform-project-instructions-cta`: Project Chat now gives a clear path to prepare missing Project instructions and hides raw provider/runtime error syntax from the user.
- **Today’s outputs:** Added a `Generate AGENTS.md` CTA in the Git & GitHub panel that uses the existing Project onboarding draft flow, mapped missing `AGENTS.md`, invalid request body, and tool-state provider failures to user-facing chat copy, and reset the Project Chat transcript viewport when switching Projects/sessions so old Project records are less likely to reopen with the composer stranded at the top.
- **Validation:** Passed focused harness chat parser tests, full web tests, web typecheck, web lint, `pnpm format:check`, and `git diff --check`. Electron E2E was attempted during the task and reached the built app, but the long Project access flow failed on existing flaky reopen assertions unrelated to the focused CTA/error-copy changes.
- **Current state:** Bead `agent-platform-67u` is ready to close locally. Branch is `task/agent-platform-project-instructions-cta`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Close the bead, push Beads, commit and push this task branch, then owner can manually test the Git panel CTA, friendly error copy, and Project reopen scroll behavior in Electron.
- **Date:** 2026-05-16
- **Session:** Implemented `agent-platform-za3` on `task/agent-platform-project-git-github-panel`: Project Chat now has a right-side Git & GitHub panel backed by local Git state.
- **Today’s outputs:** Added a Project Git status API, contracts, router coverage, a collapsible Git & GitHub panel with Overview/Changes/Commits/PRs/Checks tabs, explicit GitHub placeholder states, Electron E2E coverage, and hid the legacy Sensors rail in Project Chat. Stabilized API pre-push tests by running API Vitest in one fork to avoid Supertest listener interference.
- **Validation:** Passed contracts project tests, focused and full API tests, API/web/desktop typecheck, web lint, elevated Electron E2E, `pnpm format:check`, and `git diff --check`. Pre-push initially exposed API Supertest concurrency flakes; the one-fork config fixed the full API suite locally.
- **Current state:** Bead `agent-platform-za3` is closed locally. Branch is `task/agent-platform-project-git-github-panel`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Amend the session note into the task commit, push the branch, then scope local Changes and Commits detail views inside the Git & GitHub panel.
- **Date:** 2026-05-16
- **Session:** Implemented `agent-platform-8ib` on `task/agent-platform-branch-selector-git-switch`: Project Chat branch selector now explains why branch switching is blocked when the Project worktree is dirty.
- **Today’s outputs:** Kept conservative dirty-worktree branch blocking, added a clear disabled-state tooltip/accessibility label telling users to commit, stash, or use the terminal manually, and documented the scoped task. API coverage keeps dirty checkout blocking, and Electron E2E now opens a dirty Git Project and verifies the selector is disabled with the explanatory label.
- **Validation:** Passed web typecheck, web lint, desktop typecheck, API typecheck, elevated focused API router tests, and elevated Electron E2E. Initial sandboxed API test failed because supertest could not bind a local socket (`listen EPERM`), then passed outside the sandbox.
- **Current state:** Bead `agent-platform-8ib` is closed locally. Branch is `task/agent-platform-branch-selector-git-switch`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Run format/diff checks, close the bead, push Beads, commit, and push the task branch.
- **Date:** 2026-05-15
- **Date:** 2026-05-16
- **Session:** Implemented `agent-platform-57s` on `task/agent-platform-terminal-placement-polish`: Project terminal polish after owner manual testing.
- **Today’s outputs:** Moved the Project terminal dock below the Project Chat composer, replaced the confusing inert `open` badge with status text, changed terminal hide/close actions to explicit labelled controls, and added a terminal font selector with common monospace/Nerd Font choices for better prompt glyph rendering. Extended Electron E2E to assert the terminal appears below the composer, exposes the font selector, and keeps hide/show behavior working.
- **Validation:** Passed web typecheck, web lint, web unit tests, desktop typecheck, desktop unit tests, elevated Electron E2E, `pnpm format:check`, and `git diff --check`.
- **Current state:** Bead `agent-platform-57s` is closed locally. Branch is `task/agent-platform-terminal-placement-polish`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Run `bd dolt push`, commit and push the task branch, then owner can manually test the terminal placement and font selector in Electron.
- **Date:** 2026-05-15
- **Session:** Implemented `agent-platform-u9n` on `task/agent-platform-project-branch-selector-input`: Project Chat now exposes branch switching beside the composer model selector.
- **Today’s outputs:** Added Project branch contracts, backend branch listing/checkout endpoints with safe branch-name validation and dirty-worktree blocking, a Project Chat input branch selector beside the agent/model controls, and Electron E2E coverage that switches a real Git-backed Project from `main` to `feature/e2e-branch`.
- **Validation:** Passed contracts project tests, API router tests, API/contracts/web/desktop typecheck, API/web lint, full web unit tests, web build, desktop unit tests, elevated Electron E2E, `pnpm format:check`, and `git diff --check`. SonarQube MCP remained unavailable via tool discovery in this task chain, so the fallback gate used typecheck/lint/tests.
- **Current state:** Bead `agent-platform-u9n` is closed locally. Branch is `task/agent-platform-project-branch-selector-input`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Run `bd dolt push`, commit and push this branch, then owner can manually test changing branches from the Project Chat composer row.
- **Date:** 2026-05-15
- **Session:** Completed `agent-platform-1bg` on `task/agent-platform-project-experience-terminal-tabs`: Project Chat terminal dock now supports multiple human-controlled terminal tabs.
- **Today’s outputs:** Added tab state over the existing Electron PTY bridge, with independent PTY/xterm runtime per tab, New Terminal creation, tab selection, per-tab close, global hide preserving open tabs, and global close disposing all tabs. Extended Electron E2E to verify Terminal 1 and Terminal 2 keep independent shell output while both start at the active Project root.
- **Validation:** Passed web typecheck, web lint, web unit tests, web build, full desktop unit tests, elevated Electron E2E, `pnpm format:check`, and `git diff --check`. SonarQube MCP remained unavailable via tool discovery, so the documented fallback gate used typecheck/lint/tests.
- **Current state:** Bead `agent-platform-1bg` is closed locally. Branch is `task/agent-platform-project-experience-terminal-tabs`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Commit this session handoff and tab implementation, run `bd dolt push`, push the branch, confirm branch is up to date with origin, then owner can manually test multiple terminal tabs and terminal toggle behavior in Electron.
- **Date:** 2026-05-15
- **Session:** Completed `agent-platform-project-experience.10` on `task/agent-platform-project-experience.10`: Project Chat now has a native Electron terminal dock for human-controlled shell sessions.
- **Today’s outputs:** Added `node-pty` to the desktop app, created an Electron main terminal service with typed preload IPC, resolved the initial cwd from the active Project root when available, rendered a Project Chat `xterm.js` bottom dock with hide/show/close lifecycle, and kept the terminal separate from agent/harness command execution.
- **Validation:** Passed desktop/web typecheck, lint, builds, full desktop unit tests, web unit tests, `pnpm format:check`, and elevated Electron E2E verifying the terminal starts in the Project folder, accepts keyboard input, survives hide/show, and closes explicitly. SonarQube MCP was not available via tool discovery, so the documented fallback gate used typecheck/lint/tests.
- **Current state:** Bead `agent-platform-project-experience.10` is closed locally. Commit `a4ef037` contains the implementation before this session handoff amend. Branch is `task/agent-platform-project-experience.10`; `output/` remains unrelated/untracked and must not be committed.
- **Next:** Amend this handoff into the `.10` commit, run `bd dolt push`, push the task branch, confirm branch is up to date with origin, then owner can manually test the native terminal in the Electron app.
- **Date:** 2026-05-15
- **Session:** Implemented `agent-platform-electron-stabilisation.16` on `task/agent-platform-electron-stabilisation.16`: Personal Chat and Project Chat now use separate UI chrome and state boundaries.
- **Today’s outputs:** Hid Recent Projects from Personal Chat, hid the Sensors/Project activity panel outside Project Chat, stopped Personal Chat sessions from fetching repository sensors, cleared sensor state when switching to general chat, and extended the Electron Project access Playwright flow to verify that Personal Chat is clean after Project Chat usage. The `.16` task spec now includes a Gherkin Playwright E2E strategy.
- **Validation:** Passed `pnpm --filter @agent-platform/web typecheck`, `pnpm --filter @agent-platform/web lint`, `pnpm --filter @agent-platform/desktop typecheck`, `pnpm --filter @agent-platform/api typecheck`, `pnpm format:check`, `git diff --check`, and focused `pnpm --filter @agent-platform/desktop run test:e2e -- e2e/project-access.e2e.ts`.
- **Current state:** PR #220 passed CI, SonarCloud, GitGuardian, docs checks, browser e2e, and desktop-e2e after one unrelated verify rerun; it has been squash-merged into `feature/agent-platform-electron-stabilisation`, and Bead `.16` is closed. Unrelated local `AGENTS.md`, `Makefile`, and `output/` changes remain uncommitted and should not be included.
- **Next:** Push the `.16` Beads/session closeout on `feature/agent-platform-electron-stabilisation`, then move into the next Project Experience task chain: branch selector, terminal dock, generated-output previews, duplicate Project names/session history, and New Project creation.
- **Date:** 2026-05-15
- **Session:** Re-baselined the post-stabilisation plan after confirming the Product direction: Project Chat is the primary Project surface, the built-in IDE should not receive further feature investment, and manual editing should hand off to the user's local/default IDE.
- **Today’s outputs:** Updated Project Experience specs and Beads metadata to add `agent-platform-project-experience.9` for Project Chat branch selection, `agent-platform-project-experience.10` for a governed terminal dock using `node-pty` in Electron main, `xterm.js` in the renderer, typed IPC, and Project-root scoping, `agent-platform-project-experience.11` for duplicate Project name disambiguation plus Project-scoped session history, and `agent-platform-project-experience.12` for New Project creation. Added `agent-platform-electron-stabilisation.14` for common attachment support, `agent-platform-electron-stabilisation.15` for structured slash-command help output, and `agent-platform-electron-stabilisation.16` for separating Personal Chat state/chrome from Project workspace UI. Re-scoped the Code Workbench epic so it no longer competes with the Project Chat-first direction.
- **Validation:** `pnpm docs:lint` and `git diff --check` passed for the documentation changes. Beads shows Project Experience has follow-up work for branch selector, terminal dock, generated previews, activity panel, duplicate Project names, and Project session history. Bead `agent-platform-electron-stabilisation.12` remains blocked until owner manual QA/sign-off.
- **Current state:** Local branch `feature/agent-platform-electron-stabilisation` has the Project Experience rebaseline pushed. New manual QA findings are mapped in docs and Beads. Unrelated local `AGENTS.md`, `Makefile`, and `output/` changes remain uncommitted and should not be included.
- **Next:** Complete `agent-platform-electron-stabilisation.12` only after owner reruns or explicitly signs off `docs/qa/electron-project-experience-manual-qa.md`. Attachment support can be fixed under `.14`; slash-command help formatting can be fixed under `.15`; Personal Chat state/chrome separation can be fixed under `.16`; duplicate Project naming/session history can be fixed under Project Experience `.11`; New Project creation can be fixed under Project Experience `.12`.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-experience.8` on `task/agent-platform-electron-experience.8`. Added built-runtime Electron E2E coverage for the complete Project navigation/reopen path and fixed in-place Recent Project switching from Project chat.
- **Today’s outputs:** PR #204 targets `feature/agent-platform-project-onboarding` and adds queued Electron test Project folder overrides, a Project reopen request event from the Recent Projects sidebar, shared reopen handling for URL restore and in-place Project switching, and an Electron E2E flow that opens two Projects, reopens the first, verifies Project chat default entry, `/init` and `/help init` context, IDE handoff/return navigation, draft approval, and hidden host paths.
- **Validation:** Local gates passed: focused desktop picker tests, desktop Electron E2E, web lint/typecheck, root lint/typecheck/test, docs lint, format check, `git diff --check`, targeted rerun of two unrelated order-sensitive API failures, and pre-push affected-package build/typecheck/test. PR #204 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. Review-comment sweep found no inline comments; Sourcery skipped.
- **Current state:** `agent-platform-electron-experience.8` is closed in Beads after PR #204 went green. Beads auto-closed the parent `agent-platform-electron-experience` epic, then it was reopened for owner manual-test closeout per the agreed human-in-the-loop epic process. Branch `task/agent-platform-electron-experience.8` is pushed; `output/` remains generated/untracked and should not be committed. Next step is owner manual testing and merge decision for the Electron experience task chain, then the next ready epic is `agent-platform-electron-release`.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-experience.7` on `task/agent-platform-electron-experience.7`. Slash commands now resolve Project context through the same session resolver as ordinary Project chat, so `/init` works as the first Project chat message for backend-bound Project sessions.
- **Today’s outputs:** PR #203 targets `feature/agent-platform-project-onboarding` and removes the desktop-only slash Project context filter, adds API regression coverage for `/init` and `/help init` with backend-bound Project sessions, and extends Electron E2E coverage so Project chat and IDE assistant slash-command help share the selected Project context.
- **Validation:** Local gates passed: focused API slash/session tests, API lint/typecheck, desktop Electron E2E, root lint/typecheck/test, format check, `git diff --check`, and pre-push affected-package build/typecheck/test. PR #203 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. Review-comment sweep found no inline comments; Sourcery skipped.
- **Current state:** `agent-platform-electron-experience.7` is closed in Beads after PR #203 went green. Branch `task/agent-platform-electron-experience.7` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-experience.8`, Electron E2E for navigation and reopen.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-experience.6` on `task/agent-platform-electron-experience.6`. Added generic Project profile/capability labels while keeping Projects broader than coding.
- **Today’s outputs:** PR #202 targets `feature/agent-platform-project-onboarding` and adds shared profile/capability display helpers, Project chat header labels, assessed Project labels/chips in IDE Project panels, focused profile/capability tests, `docs/architecture/project-profiles.md`, and an E2E hardening fix so file-row clicks are not blocked by the Project binding card in narrow CI layouts.
- **Validation:** Local gates passed: focused web profile/onboarding tests, web lint/typecheck, repo lint/typecheck/test, docs lint, format check, `git diff --check`, focused Project-opening Playwright, full browser E2E, desktop Electron E2E, and pre-push affected-package gates. PR #202 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new issues and 0 security hotspots; review sweep found no inline comments. Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-experience.6` is ready to close in Beads after this session update is committed/pushed. Branch `task/agent-platform-electron-experience.6` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-experience.7`, Slash command context parity in Project chat.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-experience.5` on `task/agent-platform-electron-experience.5`. Added Project chat/IDE breadcrumbs and return navigation that preserves Project/session context.
- **Today’s outputs:** PR #201 targets `feature/agent-platform-project-onboarding` and adds a Project chat header with `Project / Chat`, Workspaces return, IDE breadcrumb return to Project chat, session-aware Project chat reopen URLs, browser/Electron E2E coverage for IDE -> chat -> IDE navigation, and E2E seed rate-limit headroom to prevent Playwright false failures under parallel load.
- **Validation:** Local gates passed: focused web lint/typecheck/navigation tests, focused browser Project-opening E2E, desktop Electron E2E, docs lint, format check, root lint/typecheck/test, full browser E2E, `git diff --check`, and pre-push affected-package build/typecheck/test. PR #201 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new issues and 0 security hotspots; review sweep found no inline comments. Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-experience.5` is closed in Beads after PR #201 went green. Branch `task/agent-platform-electron-experience.5` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-experience.6`, Project profile and capability labels.
- **Date:** 2026-05-12
- **Session:** Implemented `agent-platform-electron-experience.4` on `task/agent-platform-electron-experience.4`. The Project chat to IDE handoff now preserves both the selected Project and the active Project chat session.
- **Today’s outputs:** Added `sessionId` to the Project IDE handoff URL, made Project chat bind its Project session as soon as a Project opens, taught the IDE to validate and restore the handed-off Project session, and tightened browser/Electron E2E assertions so the handoff cannot silently drop session context.
- **Validation:** Local gates passed: focused Project navigation/onboarding tests, web lint/typecheck/tests, rebuilt compose stack via `make up`, focused browser Project-opening E2E, desktop Electron E2E, docs lint, format check, root lint/typecheck/test, full browser E2E, and pre-push affected-package build/typecheck/test. PR #200 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 open PR issues and 0 security hotspots after resolving the `void` finding. No inline review comments are present; Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-experience.4` is closed in Beads after PR #200 went green. Branch `task/agent-platform-electron-experience.4` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-experience.5`, breadcrumbs and return navigation.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-experience.3` on `task/agent-platform-electron-experience.3`. Project opening and reopening now land in Project chat by default, with the IDE available as an explicit `Open IDE` action.
- **Today’s outputs:** PR #199 targets `feature/agent-platform-project-onboarding` and adds shared desktop Project helpers, chat-first Project navigation, Project-bound session creation before first send, Project-specific chat copy, Recent Projects links into Project chat, and Electron/web E2E coverage for the chat-first flow plus IDE handoff.
- **Validation:** Local gates passed: focused renderer tests, web lint/typecheck/tests, focused Playwright, desktop Electron E2E, docs lint, root lint/typecheck/test, format check, root browser E2E, `git diff --check`, and pre-push affected-package gates. PR #199 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 open PR issues and 0 security hotspots after resolving page complexity/readonly-prop findings. No inline review comments are present; Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-experience.3` is closed in Beads after PR #199 went green. Branch `task/agent-platform-electron-experience.3` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-experience.4`, expected to refine the explicit IDE handoff from Project chat.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-experience.2` on `task/agent-platform-electron-experience.2`. Added Recent Projects to the left explorer and safe reopen-by-Project-id behavior.
- **Today’s outputs:** PR #198 targets `feature/agent-platform-project-onboarding` and adds a sidebar Recent Projects section driven by the desktop recent Projects API, shared Project navigation helpers for safe labels/availability/reopen hrefs, `/ide?projectId=...` reopen handling, and Electron E2E coverage that verifies a desktop Project appears as recent and reopens without exposing host paths.
- **Validation:** Local gates passed: focused renderer tests, web lint/typecheck/tests, `pnpm --filter @agent-platform/desktop run test:e2e`, root `pnpm docs:lint`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, root `pnpm run test:e2e`, `git diff --check`, and affected-package pre-push gates. PR #198 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new issues and 2.5% duplication on new code after the fixture cleanup. No inline review comments are present; Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-experience.2` is closed in Beads after PR #198 went green. Branch `task/agent-platform-electron-experience.2` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-experience.3`, Project chat as default entry.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-experience.1` on `task/agent-platform-electron-experience.1`. Created the Electron experience child task chain and added the first shared Project navigation model.
- **Today’s outputs:** PR #197 targets `feature/agent-platform-project-onboarding` and adds `apps/web/lib/project-navigation.ts`, focused navigation tests, sidebar/home copy driven from the shared model, and generic Project entry wording that avoids coding-only and runtime implementation labels. The Electron experience epic now has child specs `.1` through `.8` with Beads dependencies wired in order.
- **Validation:** Local gates passed: focused Project navigation tests, web lint/typecheck/tests, `pnpm format:check`, `pnpm docs:lint`, root `pnpm lint`, root `pnpm typecheck`, root `pnpm test`, `git diff --check`, and the sanitized pre-push affected build/typecheck/test gate. PR #197 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new unresolved issues; no inline review comments are present. Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-experience.1` is closed in Beads after PR #197 went green. Branch `task/agent-platform-electron-experience.1` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-experience.2`, Recent Projects in left explorer.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-onboarding.7` on `task/agent-platform-electron-onboarding.7`. Added built-runtime Electron E2E coverage for the Project onboarding approval path.
- **Today’s outputs:** PR #196 targets `feature/agent-platform-project-onboarding` and extends the Electron Project access E2E through `/help`, `/init`, draft review, approval, and `AGENTS.md` write verification inside the selected Project root. The web IDE now refreshes active Project metadata after slash commands so `/init` onboarding state appears without a manual reload. The task spec DoD is complete.
- **Validation:** Local gates passed: web typecheck/lint, desktop Electron E2E, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:lint`, `pnpm test`, `git diff --check`, targeted API rate-limit test after one transient pre-push timeout, and the sanitized pre-push affected build/typecheck/test gate. PR #196 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new unresolved issues; no inline review comments are present. Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-onboarding.7` and parent `agent-platform-electron-onboarding` are closed in Beads after PR #196 went green. Branch `task/agent-platform-electron-onboarding.7` is pushed; `output/` remains generated/untracked and should not be committed. Next step is to decide whether to merge the completed onboarding task chain into `feature/agent-platform-project-onboarding` and then run any manual epic-level testing before the final feature-to-main merge.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-onboarding.6` on `task/agent-platform-electron-onboarding.6`. Cleaned up the desktop Project onboarding UI so setup is user-facing and action-oriented.
- **Today’s outputs:** PR #195 targets `feature/agent-platform-project-onboarding` and renames Project setup states into human-readable labels, adds clear setup copy and a visible Start setup path as soon as an unapproved Project is open, removes the parked browser folder reconnect affordance, and adds focused render coverage for the pre-draft setup state.
- **Validation:** Local gates passed: focused web onboarding render tests, web lint/typecheck/tests, focused Playwright Project-opening E2E, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:lint`, `pnpm test`, `git diff --check`, and pre-push affected build/typecheck/test. PR #195 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new unresolved issues; no inline review comments are present. Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-onboarding.6` is closed in Beads after PR #195 went green. Branch `task/agent-platform-electron-onboarding.6` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-onboarding.7`, which should add or tighten Electron E2E coverage for the Project onboarding flow.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-onboarding.5` on `task/agent-platform-electron-onboarding.5`. Preserved approved Project onboarding during refresh/rescan while surfacing update candidates for material drift.
- **Today’s outputs:** PR #194 targets `feature/agent-platform-project-onboarding` and adds refresh assessment handling that keeps persisted `onboardingState: approved` by default, records `onboardingRefresh.nextState`, and exposes refresh-sourced pending instruction update candidates when a fresh scan detects review-worthy AGENTS changes. The task spec and Beads state were updated after verification.
- **Validation:** Local gates passed: focused Project router tests, API typecheck, root `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:lint`, `pnpm test`, `git diff --check`, and the pre-push affected build/typecheck/test gate for `apps/api`, `apps/desktop`, `apps/web`, `packages/contracts`, and `packages/harness`. PR #194 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new unresolved issues; no inline review comments are present. Sourcery skipped due cumulative diff size only.
- **Current state:** `agent-platform-electron-onboarding.5` is closed in Beads after PR #194 went green. Branch `task/agent-platform-electron-onboarding.5` is pushed; `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-onboarding.6`, which should handle Project onboarding UI cleanup.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-command-sandbox.5` on `task/agent-platform-electron-command-sandbox.5`. Added the first-release destructive shell command policy.
- **Today’s outputs:** PR #187 targets `feature/agent-platform-project-onboarding` and adds centralized bash command classification for read-only commands, approval-required writes/scripts/chaining/redirects, and blocked destructive host mutations. The policy is wired into Project write-onboarding checks, HITL approval reasons, direct system tool execution, and the Project-scoped command runner while keeping approval state out of user/audit args.
- **Validation:** Local gates passed: focused bash policy/runner/dispatch tests, full harness tests, harness lint/typecheck, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm docs:lint`, `pnpm format:check`, and `git diff --check`. PR #187 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports quality gate OK, 0 unresolved issues, 0 hotspots, and duplicate-line density reduced to 1.8%. No inline review comments are present; Sourcery skipped.
- **Current state:** `agent-platform-electron-command-sandbox.5` is ready for Beads closure after this closeout commit is pushed. `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-command-sandbox.6`, which should add sandbox regression coverage.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-command-sandbox.4` on `task/agent-platform-electron-command-sandbox.4`. Integrated command approval rejection and bounded audit logging with the existing HITL/tool audit loop.
- **Today’s outputs:** PR #186 targets `feature/agent-platform-project-onboarding` and adds bounded audit serialization/redaction for command args/results, rejected approval audit records, and error audit status for non-zero shell exits. API approval rejection now writes a denied audit entry with human rejection evidence.
- **Validation:** Local gates passed: focused harness/API approval audit tests, harness/API lint, full harness tests, full API tests, docs lint, format check, `git diff --check`, root `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test`. PR #186 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 unresolved issues and 0 security hotspots after the integration-test cleanup. No inline review comments are present; Sourcery skipped.
- **Current state:** `agent-platform-electron-command-sandbox.4` is ready for Beads closure after this closeout commit is pushed. `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-command-sandbox.5`, which should add destructive command policy.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-command-sandbox.3` on `task/agent-platform-electron-command-sandbox.3`. Added Project PathJail enforcement around host shell execution for Project-bound sessions.
- **Today’s outputs:** PR #185 targets `feature/agent-platform-project-onboarding` and adds `createProjectScopedCommandRunner`, API runtime wiring that passes the Project session `PathJail` into `createSystemToolExecutor`, `/workspace` path rewriting to resolved host Project paths, and regression coverage for in-root execution, outside-root cwd/path denial, and symlink escape denial.
- **Validation:** Local gates passed: focused harness typecheck/lint/tests, harness build plus API typecheck, `pnpm format:check`, `pnpm docs:lint`, `git diff --check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and pre-push affected-package gates. PR #185 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 open issues and 0 security hotspots. No inline review comments are present; Sourcery skipped.
- **Current state:** `agent-platform-electron-command-sandbox.3` is closed in Beads after PR #185 went green. `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-command-sandbox.4`, which should add command approval, timeout, and audit logging policy.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-command-sandbox.1` on `task/agent-platform-electron-command-sandbox.1`. Documented the command execution threat model before implementing host command execution.
- **Today’s outputs:** PR #183 targets `feature/agent-platform-project-onboarding` and adds [Command Execution Threat Model](docs/design/command-execution-threat-model.md), child specs for `agent-platform-electron-command-sandbox.1` through `.7`, parent epic links, and task index updates. The threat model covers protected assets, trust boundaries, first-release host-runner assumptions, denied operations, command classification, approval/audit requirements, residual risks, and testable follow-up requirements.
- **Validation:** Local docs gates passed: `pnpm docs:lint`, `git diff --check`, and pre-push affected-package build/typecheck/test gates. PR #183 is green across GitHub `verify`, `docker`, browser `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 open issues and 0 security hotspots. No inline review comments are present; Sourcery skipped because the cumulative diff exceeded its review limit.
- **Current state:** `agent-platform-electron-command-sandbox.1` is closed in Beads after PR #183 went green. `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-command-sandbox.2`, which should define the swappable `CommandRunner` interface from the threat-model requirements.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-project-access.8` on `task/agent-platform-electron-project-access.8`. Added production-like Electron E2E coverage for native Project opening through Project-bound `/help` and `/init`.
- **Today’s outputs:** PR #182 targets `feature/agent-platform-project-onboarding` and adds `apps/desktop/e2e/project-access.e2e.ts`, an Electron Playwright config, a `test:e2e` desktop script, a CI `desktop-e2e` job, an E2E-only Project picker override, and a sandbox-compatible self-contained CommonJS preload build step. The E2E verifies Electron bridge availability, backend desktop Project registration, safe Project labels, backend file-tree/file-read access, Project-bound session reuse, `/help`, `/init`, and that `/workspace` plus host absolute paths are not rendered by default.
- **Validation:** Local gates passed: focused desktop typecheck/lint/tests, `pnpm --filter @agent-platform/desktop test:e2e`, `pnpm format:check`, `pnpm lint`, `pnpm docs:lint`, `git diff --check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. PR #182 is green across GitHub `verify`, `docker`, browser `e2e`, new `desktop-e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud reports 0 new issues and 0 security hotspots after replacing dynamic build-script evaluation with AST extraction. No inline review comments are present; Sourcery skipped because the cumulative diff exceeded its review limit.
- **Current state:** `agent-platform-electron-project-access.8` and the parent native Project access/session-binding epic are closed in Beads after PR #182 went green. `output/` remains generated/untracked and should not be committed. The next ready work should come from the next Beads-ready item after the native Project access/session-binding chain.
- **Date:** 2026-05-12
- **Session:** Implemented `agent-platform-electron-project-access.6` on `task/agent-platform-electron-project-access.6`. Slash commands and ordinary Project chat now resolve Project context through the same session-bound resolver so `/init` can run as the first command after a desktop Project is opened.
- **Today’s outputs:** Added explicit resolved Project context (`projectId` plus `project`) to slash command execution, changed `/init` to use that context rather than reading `session.projectId` directly, shared `resolveSessionProjectContext` with the normal Project chat prompt path, added API coverage for desktop-registered Project `/init` as the first chat message, and added Playwright coverage for opening a desktop Project and running `/init` through the IDE chat.
- **Validation:** Local gates passed: API typecheck/lint/focused slash/session tests, `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm docs:lint`, `git diff --check`, focused compose-backed Playwright for `e2e/ide-project-opening-parked.spec.ts`, and full compose-backed `pnpm run test:e2e` (19 passed). Compose seed/workspace verification passed after waiting for API health following restart.
- **Current state:** `agent-platform-electron-project-access.6` is complete and PR #180 is green against `feature/agent-platform-project-onboarding`; Beads closure is being committed after the final spec update. Next task is `agent-platform-electron-project-access.7`, which should define the web-only Project fallback UI. `output/` remains generated/untracked and should not be committed.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-project-access.5` on `task/agent-platform-electron-project-access.5`. Added backend-backed Project file tree and file read support so an active desktop Project can render and open files from the backend-bound Project root without browser folder handles or exposed host paths.
- **Today’s outputs:** PR #179 targets `feature/agent-platform-project-onboarding` and adds `GET /v1/projects/:id/files/tree`, `GET /v1/projects/:id/files/read?path=...`, shared contracts, Project-root path-jail/read safeguards, IDE integration for active desktop Project trees/files, API docs, API guard tests for traversal/symlink/binary/large-file cases, and Playwright coverage for Docker-visible backend Project reads.
- **Validation:** Local gates passed: contracts build/typecheck/tests, API typecheck/lint/focused Project tests, web build/typecheck/lint/focused tests, docs lint, format check, root lint/typecheck/test/build, `git diff --check`, focused Playwright, and full compose-backed `pnpm run test:e2e` (18 passed). PR #179 is green across GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud. SonarCloud now reports 0 new open issues and 0 security hotspots after follow-up fixes. No inline PR review comments are present; Sourcery skipped on the cumulative diff.
- **Current state:** `agent-platform-electron-project-access.5` is ready for Beads closure after this closeout commit is pushed. `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-project-access.6`, which should share the same Project context across chat and slash commands.
- **Date:** 2026-05-12
- **Session:** Completed `agent-platform-electron-project-access.4` on `task/agent-platform-electron-project-access.4`. Added recent desktop Projects and a reopen flow so the IDE can show safe Project labels, reopen stored desktop Project metadata, and bind reopened Projects back through Project chat sessions without exposing host paths.
- **Today’s outputs:** PR #178 targets `feature/agent-platform-project-onboarding` and adds `GET /v1/projects/desktop/recent`, safe desktop Project response contracts, API coverage for ordering and moved-folder unavailable state, IDE recent Projects UI/reopen handling through the Electron preload bridge, Project chat session binding via `POST /v1/sessions/project`, API docs, task-spec closeout, and Playwright coverage for the single desktop Project opener path.
- **Validation:** Local gates passed: `pnpm format:check`, `pnpm docs:lint`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `git diff --check`, focused web/type/lint/tests after Sonar fixes, and full `pnpm run test:e2e` (17 passed) using a local production fallback because local Docker rebuild hung resolving `docker/dockerfile:1`. PR #178 is green across GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud with Quality Gate passed, 0 new issues, and 0 security hotspots. No inline PR review comments are present; Sourcery skipped because the cumulative diff exceeded its account review limit.
- **Current state:** `agent-platform-electron-project-access.4` is ready for Beads closure after this closeout commit is pushed. `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-project-access.5`, which should serve backend-backed Project file tree and file reads for the active desktop Project.
- **Date:** 2026-05-12
- **Session:** Implemented `agent-platform-electron-project-access.2` on `task/agent-platform-electron-project-access.2`. Added trusted desktop Project registration so Electron-selected host folders can create/reopen backend Project records without returning absolute host paths in the UI-facing registration payload.
- **Today’s outputs:** PR #176 targets `feature/agent-platform-project-onboarding` and adds `POST /v1/projects/desktop/register`, desktop registration contracts, stable non-reversible `desktop:<sha256>` workspace keys, safe desktop Project response metadata, API coverage for create/reopen/untrusted caller/uninspectable folder, and task-spec notes for the trusted boundary.
- **Validation:** Local gates passed: focused contracts/API build/lint/test, full API tests, `pnpm format:check`, `pnpm docs:lint`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and full `pnpm run test:e2e` (17 passed). Pre-push affected-package build/typecheck/test passed. PR #176 is green across GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud with Quality Gate passed, 0 new issues, and 0 security hotspots. Sourcery skipped because the PR diff exceeded its account review limit and posted no actionable inline comments.
- **Current state:** `agent-platform-electron-project-access.2` is ready for Beads closure after the session closeout commit is pushed. `output/` remains generated/untracked and should not be committed. Next task is `agent-platform-electron-project-access.3`, which should bind Project chat sessions to the registered desktop Project record so slash commands and normal chat receive the same Project context.
- **Date:** 2026-05-11
- **Session:** Completed `agent-platform-electron-foundation.2` on `task/agent-platform-electron-foundation.2`. Added a production-like desktop renderer path that starts the Next.js standalone web build on a local loopback port using Electron's Node mode, copies `.next/static` and `public` assets into the standalone tree, and loads that URL from the Electron window. Kept bootstrap mode as the fallback and explicit dev-server mode for contributor workflow.
- **Today’s outputs:** PR #165 targets `feature/agent-platform-project-onboarding` and contains `apps/desktop/src/main/rendererServer.ts`, renderer helper tests, desktop scripts `build:renderer`, `smoke:renderer`, `start:renderer`, and `start:dev-renderer`, plus documentation in the task spec and Electron planning spec. The renderer path does not require the normal Next dev server; it uses the existing standalone build contract from `apps/web/next.config.ts`.
- **Validation:** Focused desktop gates passed: `pnpm --filter @agent-platform/desktop build`, `typecheck`, `lint`, `test`, `smoke`, and `smoke:renderer`. Broad gates passed before PR: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm docs:lint`, and `git diff --check`. PR #165 is green across GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, SonarCloud quality gate with 0 open PR issues, and Sourcery.
- **Current state:** `agent-platform-electron-foundation.2` is closed after this closeout commit. `agent-platform-electron-foundation.3` is next and should implement the backend supervisor spike on top of the desktop renderer foundation. `output/` remains generated/untracked and should not be committed.
- **Date:** 2026-05-11
- **Session:** Added PR #164 from `task/promptfoo-pr-main-actions` to `main` to make Promptfoo Code Scan run automatically for pull requests targeting `main`, including commit pushes via `synchronize` and reopened PRs. Kept `promptfoo/code-scan-action@v0` because the PR proved `@v1` is not currently published/resolvable.
- **Validation:** Local workflow checks passed: `pnpm exec prettier --check .github/workflows/promptfoo-code-scan.yml` and `git diff --check`. PR #164 passed Promptfoo `security-scan`, CI `verify`/`docker`/`e2e`, CodeQL, SonarCloud, GitGuardian, and Sourcery. Promptfoo output for the successful run was JSON with `success: true`, `severity: none`, and the finding `No LLM security vulnerabilities were found in this PR.`
- **Current state:** `agent-platform-promptfoo-pr-main-actions` is closed in Beads. PR #164 is green and ready for owner merge to `main`. `output/` remains generated/untracked and should not be committed.
- **Date:** 2026-05-11
- **Session:** Paused implementation after manual testing exposed a core architecture blocker in the Project opener/onboarding flow. Slash command infrastructure from `agent-platform-project-onboarding.8` is useful and largely implemented locally (`/help`, `/init`, parser/registry/runner boundaries, `/v1/chat` dispatch before model execution, shared onboarding workflow, IDE slash-message preservation, and focused tests), but the attempted browser/Docker Project opening model is not product-correct: a browser folder picker can show files to the renderer but cannot provide a backend-usable arbitrary host path, while a Docker backend can only inspect mounted paths. Requiring users to type absolute paths is not acceptable, and browser-only folder access creates false "Project open" states where `/init` lacks backend Project context. Implementation work is stopped until the desktop runtime redesign is agreed.
- **Today’s outputs:** Added accepted architecture record [ADR-0002](docs/adr/0002-electron-desktop-runtime.md) and high-level spec [docs/planning/electron-desktop-runtime.md](docs/planning/electron-desktop-runtime.md). Updated [docs/adr/README.md](docs/adr/README.md) and [decisions.md](decisions.md). The spec captures the direction: Electron desktop runtime, macOS-first, local host backend supervised by Electron, React renderer reused inside Electron, SQLite under OS app data, secrets in secure storage or encrypted fallback, cloud model providers for inference, Docker retained for development/CI/optional sandboxing only, and production-like Electron E2E required for desktop completion. It also lists research areas: command sandboxing, Electron hardening, backend packaging/supervision, SQLite native packaging, secure secret storage, app data deletion/uninstall lifecycle, macOS release pipeline, Electron E2E, and web-only mode.
- **Validation:** Documentation lint passed after the ADR/spec/decision updates: `pnpm docs:lint`. Earlier local implementation gates for the slash-command work had passed in focused form, but the current feature branch should not be considered done because the Project opener contract is now known to be architecturally wrong.
- **Important working-tree note:** There are still local code/test edits from the attempted `agent-platform-project-onboarding.8` single-opener fix (`apps/web/components/ide/ide-with-chat.tsx`, `apps/web/hooks/use-file-system.ts`, E2E specs, and `apps/web/test/ide-chat-message.test.ts`). Do not merge or close the Bead from those changes without tomorrow’s retrospective decision. Treat them as reference/extract candidates, not a completed product path.
- **Decisions now accepted:** ADR-0002 is the working desktop architecture: Electron, macOS-first, local host backend supervised by Electron, SQLite in OS app data, Docker retained for development/CI/optional sandboxing, and cloud model providers for inference. The current Project onboarding branch should not be merged wholesale; park it as reference and extract only architecture-neutral pieces. Desktop app data must have a supported deletion flow that removes local app data and credentials without deleting user Project folders by default.
- **Next planning steps:** Review the proposed [Electron redesign epic roadmap](docs/planning/electron-epic-roadmap.md), then decide whether to accept or reorder the epics before creating Beads issues/specs. The roadmap currently proposes: park/extract current onboarding work, Electron runtime foundation, desktop security/data/lifecycle, native Project access/session binding, command runner/sandbox policy, desktop Project onboarding and `/init`, desktop Project experience, then macOS packaging/release readiness. Priority research tasks remain command sandboxing, backend supervision/packaging, app data/SQLite, secure storage, data deletion/uninstall lifecycle, Electron E2E, and web-only fallback posture.
- **Date:** 2026-05-11
- **Session:** Completed `agent-platform-electron-extract.2` on `task/agent-platform-electron-extract.2`. Extracted the architecture-neutral slash command layer: parser, registry, `/help`, safe `/init`, chat dispatch before model execution, shared Project onboarding workflow entry points, and IDE chat handling that preserves slash commands while keeping normal file context behavior.
- **Today’s outputs:** PR #159 targets `feature/agent-platform-project-onboarding` and contains the task 2 extraction. Sonar follow-up fixed the command parser hotspot, removed the nested template literal, reduced onboarding workflow duplication, and collapsed duplicated integration-test setup. The task spec now records PR/check/review completion before Beads closure.
- **Validation:** Local gates passed for the changed areas and broad repo checks before closeout: focused API slash/session/project tests, focused web IDE chat-message test, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, and `pnpm docs:lint`. PR #159 checks passed on the pushed head: GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and SonarCloud quality gate with 0 open/confirmed PR issues.
- **Current state:** `agent-platform-electron-extract.2` is being closed after the closeout docs/Beads commit. `agent-platform-electron-extract.3` is next and should park browser-only Project opening without reintroducing manual-path Project opening as the intended user flow.
- **Date:** 2026-05-11
- **Session:** Completed implementation for `agent-platform-electron-extract.3` on `task/agent-platform-electron-extract.3`. The web IDE no longer presents browser `Open Folder` or manual Project path entry as the product Project opener. Browser File System Access is parked behind an explicit disabled hook option for the IDE surface, persisted browser folder handles no longer restore into the product IDE, and the Project card now points forward to desktop Project opening.
- **Today’s outputs:** Removed the old browser-folder Playwright suite, removed the manual-path Project workspace E2E suite, added `e2e/ide-project-opening-parked.spec.ts`, updated MVP E2E assertions, and documented the parked E2E coverage in [docs/testing/project-workspaces-e2e-parked.md](docs/testing/project-workspaces-e2e-parked.md). The remaining Project onboarding API/contracts stay available for the Electron-native flow, but the rejected web/manual opener is no longer validated as the user path.
- **Validation:** Passed focused web typecheck and component tests, rebuilt the compose stack with `make restart` without wiping app data, then passed focused Playwright coverage, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` on rerun, `pnpm docs:lint`, and full `pnpm run test:e2e` (17 passed). The first two full `pnpm test` attempts showed unrelated API cross-file flakiness; each failed test passed in isolation and the full rerun passed.
- **Current state:** `agent-platform-electron-extract.3` implementation is ready for commit, push, PR #159 refresh, CI/Sonar/review monitoring, then Beads closure if remote checks stay green.
- **Date:** 2026-05-11
- **Session:** Started `agent-platform-electron-extract.4` on `task/agent-platform-electron-extract.4` after PR #160 for task 3 was green across CI, docs, GitGuardian, SonarCloud, Sourcery, and review-thread sweep. Re-scoped Project onboarding and Project experience specs so desktop acceptance requires Electron-native backend-bound Project access. `/init`, `/help`, ordinary Project chat, and IDE handoff now explicitly depend on the same Project/session binding; browser File System Access, duplicate folder CTAs, manual absolute path entry, Docker `/workspace`, and renderer-only folder handles are parked as non-Product acceptance paths.
- **Date:** 2026-05-11
- **Session:** Started `agent-platform-electron-foundation` and claimed `agent-platform-electron-foundation.1` on `task/agent-platform-electron-foundation.1`. Created the foundation task chain specs `.1` through `.5` and wired the parent spec toward a Mac-first Electron desktop runtime with local app data, native folder access, backend supervisor, and retained Docker developer/CI workflow.
- **Today’s outputs:** Added the first `apps/desktop` workspace package with Electron main/preload entry points, sandboxed renderer settings, a minimal bootstrap shell, package scripts for build/typecheck/lint/test/start/smoke, and unit coverage for the window security/configuration boundary. Updated the task spec index for the Electron foundation child specs.
- **Validation:** Focused desktop gates passed: `pnpm --filter @agent-platform/desktop build`, `typecheck`, `lint`, `test`, and `smoke`. Broader gates passed: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm docs:lint`, and `pnpm format:check` after formatting the new files. PR #162 went green across verify, docker, e2e, docs-ci, GitGuardian, SonarCloud, and Sourcery. Sourcery's slash-command persistence-order thread was addressed and resolved.
- **Current state:** `agent-platform-electron-foundation.1` is closed. PR #162 remains open from `task/agent-platform-electron-foundation.1` to `feature/agent-platform-project-onboarding`; per process, do not merge until the epic/integration decision. Next ready task is `agent-platform-electron-foundation.2`.
- **Date:** 2026-05-11
- **Session:** Addressed follow-up slash-command review feedback while on `task/agent-platform-electron-foundation.2`. `runSlashCommand` no longer hides a built-in registry fallback; every call-site now supplies the registry explicitly, and `createChatRouter` selects the built-in registry at the router boundary when no override is provided.
- **Today’s outputs:** Updated slash-command dispatch typing, chat router wiring, and slash-command unit tests. Confirmed `handleSlashCommandMessage` already uses the loaded `session` passed by the route instead of reloading it, preserving session consistency without a second DB lookup.
- **Validation:** Local gates passed: focused API slash/session tests, API typecheck/lint/build, `git diff --check`, `pnpm format:check`, root `pnpm lint`, root `pnpm typecheck`, root `pnpm test`, and root `pnpm build`. SonarQube MCP tools were not exposed in-session, so the repo fallback completion gate was used.
- **Current state:** Commit `aee8b96` contains the review fix on `task/agent-platform-electron-foundation.2`. PR #162 for `agent-platform-electron-foundation.1` remains open and green; this branch does not yet have its own PR. Next step is to push the review-fix branch, then continue `agent-platform-electron-foundation.2` renderer loading work.
- **Important working-tree note:** `output/` is generated/untracked and should not be committed.
- **Date:** 2026-05-11
- **Session:** Completed `agent-platform-electron-extract.4` on `task/agent-platform-electron-extract.4`. Re-scoped Project onboarding and Project experience specs so desktop acceptance requires Electron-native backend-bound Project access. `/init`, `/help`, ordinary Project chat, and IDE handoff now explicitly depend on the same Project/session binding; browser File System Access, duplicate folder CTAs, manual absolute path entry, Docker `/workspace`, and renderer-only folder handles are parked as non-Product acceptance paths.
- **Today’s outputs:** Updated the Project onboarding epic and key child specs, Project experience epic and key child specs, Electron Project access/onboarding/experience specs, `decisions.md`, and the task 4 spec. Documented that `agent-platform-project-onboarding.8` should not continue as originally written: slash-command infrastructure was extracted in task 2, and full `/init` onboarding belongs under the Electron onboarding epic after native Project access exists.
- **Validation:** Task 4 local gates passed: `pnpm docs:lint`, `git diff --check`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `make restart`, full `pnpm run test:e2e` (17 passed), `bd show agent-platform-electron-extract.4`, `bd show agent-platform-project-onboarding.8`, and `bd dep tree agent-platform-electron-foundation`. Review-fix commit `9be67c7` addressed Sourcery's slash-command feedback and passed focused API tests, root format/lint/typecheck/test, pre-push affected API build/typecheck/test, and PR #161 CI/docs/e2e/Sonar/Sourcery gates.
- **Current state:** `agent-platform-electron-extract.4` is closed, which auto-closed parent epic `agent-platform-electron-extract`. PR #161 from `task/agent-platform-electron-extract.4` to `feature/agent-platform-project-onboarding` is green and clean. Next ready epic is `agent-platform-electron-foundation`; start from updated Beads state after this closeout commit lands.
- **Important working-tree note:** `output/` is generated/untracked and should not be committed.
- **Date:** 2026-05-11
- **Session:** Completed `agent-platform-electron-extract.3` on `task/agent-platform-electron-extract.3` and PR #160. The web IDE no longer presents browser `Open Folder` or manual Project path entry as the product Project opener; browser File System Access is disabled for the IDE surface, persisted browser folder handles no longer restore into the product IDE, and the Project card points forward to desktop Project opening.
- **Today’s outputs:** Removed the old browser-folder Playwright suite, removed the manual-path Project workspace E2E suite, added `e2e/ide-project-opening-parked.spec.ts`, updated MVP E2E assertions, and documented parked coverage in [docs/testing/project-workspaces-e2e-parked.md](docs/testing/project-workspaces-e2e-parked.md). Addressed Sourcery feedback by running slash command handling under the session lock and adding integration coverage for that lock behavior.
- **Validation:** Local gates passed: focused web/API tests, web/API lint/typecheck, `make restart`, focused Playwright, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm docs:lint`, and full `pnpm run test:e2e` before the review fix. PR #160 is green on the latest commit across CI verify/docker/e2e, docs-ci markdownlint/lychee, GitGuardian, SonarCloud with 0 open issues, and Sourcery with the review thread resolved/outdated.
- **Current state:** `agent-platform-electron-extract.3` is closed in Beads. After the closeout commit is pushed and PR #160 is re-checked, the next task is `agent-platform-electron-extract.4` (re-scope onboarding and experience specs), branched from the task 3 tip.
- **Important working-tree note:** `output/` is generated/untracked and should not be committed. A reference stash from the paused browser/manual-path implementation may exist; inspect only if task 3 needs context and do not apply it blindly.
- **Date:** 2026-05-09
- **Session:** Reopened and re-closed `agent-platform-project-onboarding.7` after manual testing showed browser-picked Project assessment falling back to internal runtime paths. Added hidden browser Project context to IDE chat messages for non-backend-bound folders: selected folder name, bounded file-tree summary, and guidance not to infer from backend/container paths. Local gates passed: focused `file-context` test, web typecheck/lint/build, `pnpm format:check`, root `pnpm typecheck`, root `pnpm lint`, elevated `pnpm test`, full elevated `pnpm run test:e2e` after `make restart` restored stopped services without wiping the SQLite volume, `git diff --check`, and PR #156 Sonar issue query returned 0 open/confirmed issues. PR #156 refreshed green across verify, docker, e2e, markdownlint, lychee, GitGuardian, and SonarCloud; review-thread sweep found none. `agent-platform-project-onboarding.7` is closed again. Parent epic remains open for owner manual-test closeout; AGENTS.md creation remains explicit review/approval, not an automatic chat side effect.
- **Date:** 2026-05-09
- **Session:** Follow-up manual-test cleanup on `task/agent-platform-project-onboarding.7`: sanitized provider/API-key chat failures into user-facing agent connection copy, added an `Agent unavailable` Project card state after failed assessment attempts, collapsed branch/provider diagnostics out of the normal IDE panel, and removed path-first empty-editor wording. Local gates passed: focused web tests, `pnpm typecheck`, `pnpm format:check`, `pnpm lint`, `pnpm build`, elevated `pnpm test`, full elevated `pnpm run test:e2e`, and pre-push web build/typecheck/tests. PR #156 refreshed green across verify, docker, e2e, markdownlint, lychee, GitGuardian, Sourcery, and SonarCloud; PR Sonar issue query returned 0 open/confirmed issues and review-thread sweep found none. `agent-platform-project-onboarding.7` is closed again; parent epic remains open for owner manual-test closeout and merge decision.
- **Date:** 2026-05-08
- **Session:** Closed `agent-platform-project-onboarding.6` after PR #155 to `feature/agent-platform-project-onboarding` passed GitHub Actions (`verify`, `docker`, `e2e`), docs checks, GitGuardian, and SonarCloud with 0 new issues/hotspots. Expanded `e2e/project-workspaces.spec.ts` to cover sufficient/missing/insufficient/nested/ambiguous onboarding states, no-change/material-drift refresh, closeout apply/reject, docs/non-code Project framing, and deterministic fixture markdown newlines; updated the task DoD checklist. Local gates passed: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, elevated `pnpm test`, `pnpm docs:lint`, focused Project workspace Playwright, full elevated `pnpm run test:e2e`, and Sonar branch issue listing returned 0 issues. Sonar Agentic Analysis remains unavailable because the org has not enabled it. Sourcery was skipped due weekly rate limit and posted no actionable review thread. The parent onboarding epic was reopened after Beads auto-closed it, so it remains open for human manual-test closeout.
- **Date:** 2026-05-07
- **Session:** Implemented `agent-platform-project-onboarding.3` on `task/agent-platform-project-onboarding.3`: added persisted Project onboarding dialogue/draft contracts, API routes for starting drafts and answering focused questions, deterministic human-readable `AGENTS.md` draft generation with revision history, and sidebar UI for draft preview/Q&A. Removed remaining user-visible `/workspace` default and backend/root/repo implementation labels from the Project binding panel. Local gates passed: `pnpm format:check`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm docs:lint`, focused API/web/contract tests, Sonar CLI open/confirmed issue query (0 issues), and Playwright `e2e/mvp-e2e.spec.ts` plus `e2e/project-workspaces.spec.ts` against rebuilt Docker services. Remaining before closing the Bead: commit, push, open PR into `feature/agent-platform-project-onboarding`, then monitor CI/Sonar/review comments until green.
- **Date:** 2026-05-07
- **Session:** Closed `agent-platform-project-onboarding.2` after PR #151 passed CI (`verify`, `docker`, `e2e`), docs checks, GitGuardian, and SonarCloud. Fixed the CI-discovered non-git metadata validation bug, updated E2E assertions for the new `in_progress` assessment state, resolved Sonar maintainability findings to 0 unresolved issues, confirmed no actionable review threads, pushed Beads state, and prepared to start `agent-platform-project-onboarding.3`.
- **Date:** 2026-05-07
- **Session:** Closed `agent-platform-project-onboarding.1` after PR #150 passed CI/docs/GitGuardian checks, review-thread inspection found no actionable comments, direct Sonar issue search returned 0 unresolved issues, and Sonar agentic file analysis was unavailable because the organization has not enabled Agentic Analysis. Beads Dolt closeout state was pushed; next ready task is `agent-platform-project-onboarding.2`.
- **Date:** 2026-05-07
- **Session:** Started the `agent-platform-project-onboarding` epic from updated `main` on `feature/agent-platform-project-onboarding`, claimed `agent-platform-project-onboarding.1`, implemented typed Project onboarding assessment/draft/approval/refresh contracts plus transition tests, verified local gates, synced Beads, and committed the task implementation on `task/agent-platform-project-onboarding.1`. Next step is pushing the task branch, opening the PR into the onboarding feature branch, and monitoring remote checks/review comments before closing the Bead.
- **Date:** 2026-05-07
- **Session:** After pushing the onboarding/project-experience planning update to PR #149, all GitHub checks passed but SonarCloud reported two minor duplicate-import findings in `apps/api/src/infrastructure/http/v1/chatRouter.ts`. Consolidated the duplicate `@agent-platform/contracts` type import, verified API lint/typecheck plus docs lint/diff check, and prepared the Sonar cleanup commit for push.
- **Date:** 2026-05-07
- **Session:** Refined `agent-platform-project-onboarding` and all six child specs so Project is treated as a generic folder/work context with coding as a profile/capability, not the definition of Project. Created follow-up epic `agent-platform-project-experience` with six child tasks for Project profiles, left explorer navigation, project-chat-first entry, optional IDE handoff, user-facing labels/breadcrumbs, and Playwright navigation E2E. Beads dependencies chain the Project experience epic after onboarding.
- **Date:** 2026-05-07
- **Session:** Completed cleanup for `agent-platform-project-workspaces.6`: PR #148 is open against `feature/agent-platform-project-workspaces`, all GitHub Actions/docs checks/GitGuardian/SonarCloud gates passed, SonarCloud reports 0 unresolved issues and quality gate OK, review-thread sweep found no actionable comments, Sourcery was skipped only due weekly rate limit, and Beads closed both `.6` and the parent `agent-platform-project-workspaces` epic. Beads Dolt state was pushed; remaining cleanup is pushing the final session/Beads bookkeeping commits.
- **Date:** 2026-05-07
- **Session:** Closed `agent-platform-project-workspaces.5` after PR #147 passed GitHub Actions (`verify`, `docker`, `e2e`), docs checks, GitGuardian, and SonarCloud with 0 unresolved issues and no review threads. Claimed `agent-platform-project-workspaces.6` on `task/agent-platform-project-workspaces.6`, added deterministic Project workspace Playwright coverage for Chat/Project separation plus missing/review/approved `AGENTS.md` states, and updated architecture/development docs for the minimal Project onboarding gate. Local gates pass: build, format, lint, docs lint, unit tests, diff check, focused Playwright, and full Docker E2E; remaining before close: push PR and remote checks/comments.
- **Date:** 2026-05-07
- **Session:** Continued `agent-platform-project-workspaces.5` on `task/agent-platform-project-workspaces.5`: PR #147 is open against `feature/agent-platform-project-workspaces`; fixed SonarCloud maintainability/duplication findings, hardened the browser integration test after Actions `verify` exposed hosted-runner startup latency, and moved remaining Sonar-flagged test helpers to outer scope. Bead remains open until PR #147 reruns green with no unresolved comments/issues.
- **Date:** 2026-05-07
- **Session:** Claimed `agent-platform-project-workspaces.4` on new branch `task/agent-platform-project-workspaces.4` from the completed `.3` tip. Scope: resolve canonical `/workspace` to the active Project backend root and route file, terminal, Git, test, Docker, and sensor tools through the Project boundary with wrong-root regression coverage.
- **Date:** 2026-05-07
- **Session:** Completed and closed `agent-platform-project-workspaces.3` on `task/agent-platform-project-workspaces.3`: PR #145 is open against `feature/agent-platform-project-workspaces`, all local gates and PR checks passed, SonarCloud reports 0 new issues/hotspots after the Git PATH and nested-ternary cleanup, and review-thread inspection found no actionable comments. Next task is `agent-platform-project-workspaces.4` from this branch tip.
- **Date:** 2026-05-07
- **Session:** Implemented `agent-platform-project-workspaces.3` on `task/agent-platform-project-workspaces.3`: added backend Project open validation through `/v1/projects/open`, persisted backend root/repository/branch/capability/onboarding/default-agent metadata, bound Project sessions to the selected Project id, added the IDE backend Project binding panel with unavailable state and stale-context clearing, and covered valid `/workspace` plus inaccessible paths in API/contract/Playwright tests. Local format, build, lint, unit, focused API/contract, web typecheck, and targeted Playwright gates passed; next step is commit, push, PR, and remote CI/Sonar/Sourcery/comment monitoring before closing the Bead.
- **Date:** 2026-05-07
- **Session:** Claimed `agent-platform-project-workspaces.3` on new branch `task/agent-platform-project-workspaces.3` from the completed `.2` tip. Scope: bind Project sessions to backend-accessible working trees, persist root/repo/branch/capability/onboarding state, and keep inaccessible paths unavailable.
- **Date:** 2026-05-07
- **Session:** Completed and closed `agent-platform-project-workspaces.2` on `task/agent-platform-project-workspaces.2`: PR #144 to `feature/agent-platform-project-workspaces` is open, all local gates and PR checks passed, SonarCloud reports 0 new issues after the `String.raw` cleanup, and review-thread inspection found no unresolved actionable comments. Next task is `agent-platform-project-workspaces.3` from this branch tip.
- **Date:** 2026-05-07
- **Session:** Implemented and locally closed `agent-platform-project-workspaces.1` on `task/agent-platform-project-workspaces.1`: added shared Project/Chat mode contracts, Project workspace binding metadata, capability/onboarding states, write-eligibility helpers, focused contract tests, and architecture documentation. Local build, format, lint, and unit gates passed; broad docs lint remains blocked by ignored `.agent-platform/workspaces/...` Markdown files.
- **Date:** 2026-05-07
- **Session:** Opened PR #143 for `agent-platform-project-workspaces.1`, kept the Bead open until remote gates pass, fixed Sourcery review feedback by tightening project-relative path validation and making access policy handling exhaustive, and pushed the review-fix commit for CI rerun.
- **Date:** 2026-05-07
- **Session:** PR #143 rerun is green across GitHub Actions, SonarCloud, Sourcery, GitGuardian, markdownlint, and lychee. Sourcery review threads are resolved/outdated after the review-fix commit. Closed `agent-platform-project-workspaces.1` in Beads under the agreed PR-green definition of done.
- **Date:** 2026-05-07
- **Session:** Final planning pass added explicit per-task testing strategies to every Project workspace and Project onboarding child spec, including mandatory local gates, focused tests, Playwright UI actions/assertions where applicable, CI/GitHub monitoring, and no-close/no-merge until all gates are green.
- **Date:** 2026-05-07
- **Session:** Clarified the definition of done for Project workspace/onboarding work: pushed code is not done by itself. A task is done only when implementation is complete, local build/format/lint/unit and relevant E2E/Playwright checks pass, GitHub Actions/CI pipelines pass, and any review-required feedback is resolved. Failed CI means the task remains open and must be iterated until green.
- **Date:** 2026-05-07
- **Session:** Tightened the ticket-delivery skill requirements: agents must build and run local formatting, linting, unit, and relevant integration/E2E/Playwright gates before pushing/opening task PRs; Playwright strategies must specify UI actions and observable assertions; GitHub Actions logs/artifacts and reviews must be monitored after PR creation; no task can be closed, signed off, or merged while local gates, Playwright checks, CI checks, or review-required feedback remain unresolved.
- **Date:** 2026-05-07
- **Session:** Added the ticket-delivery skill expectation to the Project workspace and Project onboarding epic specs: each task uses one PR per ticket into the feature branch, local gates must pass before PR, GitHub checks/reviews are monitored until green, failures are fixed iteratively on the same branch, and every task spec must include a concrete testing strategy before implementation starts.
- **Date:** 2026-05-07
- **Session:** Refined the Project feature into two epics on `feature/agent-platform-project-workspaces`: Epic 1 `agent-platform-project-workspaces` now covers Project vs Chat entry paths, backend-accessible Project binding, `/workspace` and tool scoping, the minimal `AGENTS.md` write safety gate, and Playwright E2E verification. Created Epic 2 `agent-platform-project-onboarding` for the full `AGENTS.md` lifecycle: read-only assessment, gap analysis, collaborative onboarding dialogue, review/approval, closeout update candidates, refresh/rescan, and Playwright E2E. Beads dependencies chain Epic 2 after Epic 1.
- **Date:** 2026-05-06
- **Session:** Main was updated after the code-workbench merge and stale branches were pruned. Claimed the next P1 epic, `agent-platform-project-workspaces`, pushed the Beads/Dolt state, and created `feature/agent-platform-project-workspaces` from `main` for refinement/planning. Start with the epic spec at `docs/tasks/agent-platform-project-workspaces.md`; first implementation task is `agent-platform-project-workspaces.1` once refinement is complete.
- **Date:** 2026-05-06
- **Session:** Deferred `agent-platform-code-workbench.7`, committed the project-workspaces follow-up planning on `task/agent-platform-code-workbench.6`, and prepared the branch for push. The next implementation priority after merge is `agent-platform-project-workspaces.1`.
- **Date:** 2026-05-06
- **Session:** Follow-up fix on `task/agent-platform-code-workbench.6`: corrected the folder picker follow-up to use the stable `showDirectoryPicker({ mode: 'readwrite' })` behavior again, while retaining only the narrow native picker re-entry guard. Playwright stub verification confirmed the Explorer renders a returned folder and that the app calls the picker with `readwrite`.
- **Date:** 2026-05-06
- **Session:** Follow-up fix on `task/agent-platform-code-workbench.6`: restored the previous working IDE folder picker pattern by opening folders with read permission first, guarding native picker re-entry, and requesting write permission only when saving files. Playwright stub verification confirmed the Explorer renders a selected folder when the picker returns a handle; the running Docker image must be rebuilt to exercise the local source change.
- **Date:** 2026-05-06
- **Session:** Follow-up fix on `task/agent-platform-code-workbench.6`: guarded IDE Markdown replacement actions so truncated Markdown code blocks with unmatched nested fences no longer expose Apply/Diff, and filename-bearing fences such as `markdown:README.md` now route to the correct review action.
- **Date:** 2026-05-06
- **Session:** Follow-up fix on `task/agent-platform-code-workbench.6`: clarified browser workbench file-context instructions so agents propose reviewed replacement code blocks for attached files instead of attempting backend/container patch tools against host-selected File System Access API files.
- **Date:** 2026-05-06
- **Session:** Follow-up fix on `task/agent-platform-code-workbench.6`: IDE chat assistant bubbles now render hidden tool activity, browser artifact previews, and HITL approval cards from `useHarnessChat`, preventing empty bubbles when the agent attempts tool-backed work such as editing `README.md`. Added regression coverage for tool-only and approval-only IDE assistant responses.
- **Date:** 2026-05-06
- **Session:** Completed `agent-platform-code-workbench.6` on `task/agent-platform-code-workbench.6`: added a frontend-only branch/change summary model and compact IDE chat sidebar panel showing workspace, explicit branch-provider unavailable state, local dirty open tabs, and pending diff-review proposals. Live branch discovery, PR/check import, GitHub, CodeQL, SonarQube, reviews, and provider auth remain owned by `agent-platform-branch-feedback-status`.
- **Date:** 2026-05-06
- **Session:** Completed `agent-platform-code-workbench.5` on `task/agent-platform-code-workbench.5`: added frontend-only diff-first edit review for assistant code-block changes, with pending edit proposals, unified-style line diffs, explicit Apply/Reject controls, dirty-tab updates only after Apply, and reject behavior that leaves files unchanged.
- **Date:** 2026-05-06
- **Session:** Completed `agent-platform-code-workbench.4` on `task/agent-platform-code-workbench.4`: added safe workbench file-reference parsing, rendered inline Markdown code and Markdown links as open-in-workbench actions when they resolve inside the active file tree, and surfaced unavailable states for no workspace, missing files, directories, and unsupported file types without adding backend contracts.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-code-workbench.3` on `task/agent-platform-code-workbench.3`: added a visible code-context panel for the IDE chat showing workspace, active file inclusion, pinned files, sanitisation/exclusion warnings, and next-message context counts. Fixed broken pinning by reading unloaded explorer file content when possible and deriving pinned context from fresh open-tab content, so the sanitised user-visible context now matches what is submitted to the agent.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-code-workbench.2` on `task/agent-platform-code-workbench.2`: replaced the IDE textarea with a focused CodeMirror 6 editor baseline, added language mapping and dirty-state helpers, added focused web tests, and verified `/ide` with unit tests, typecheck, lint, build, and a headless browser check confirming the editor, line-number gutter, and opened file content. SonarQube MCP was not callable, so the repo fallback gate was used.
- **Date:** 2026-05-05
- **Session:** Started `agent-platform-code-workbench.1` on `task/agent-platform-code-workbench.1`: added the Code Workbench Product Model documenting project-scoped code chats versus general chats, workbench surfaces, active/pinned/selected file context rules, agent visibility states, diff-first edit flow, branch/artifact relationships, deployment boundaries, design constraints, and open refinement questions.
- **Date:** 2026-05-05
- **Session:** Created the `agent-platform-code-workbench` Beads epic on `feature/agent-platform-code-workbench`, added child tasks `.1` through `.7`, wired linear dependencies, and drafted specs for a project-scoped Codex-style code workbench with proper editor baseline, visible chat file context, file-open workflows, diff-first edit review, branch/Git sidebar preparation, and verification guidance. Updated `agent-platform-ide-rethink` as superseded/refined by this epic. Code workbench specs preserve the operator-experience design strategy: shadcn/ui, Radix primitives, Tailwind CSS, TypeScript, lucide icons, and CodeMirror only as a focused editor engine if added.
- **Date:** 2026-05-05
- **Session:** Completed design work for `agent-platform-operator-experience.9` on `task/agent-platform-operator-experience.9`: documented Docker host integration constraints, local Docker versus hosted versus desktop deployment modes, supported/unsupported/future bridge behavior, user-facing unavailable-state copy, and security requirements for any future host bridge.
- **Date:** 2026-05-05
- **Session:** Completed design work for `agent-platform-operator-experience.8` on `task/agent-platform-operator-experience.8`: added the IDE/workbench architecture reassessment recommending a hybrid model, with the platform focused on branch/diff review, evidence, artifacts, approvals, and bounded inspection while host IDE/browser handoff remains optional for deep editing and plugin feedback.
- **Date:** 2026-05-05
- **Session:** Claimed `agent-platform-operator-experience.8` and created `task/agent-platform-operator-experience.8` from the pushed `.7` branch tip. Next work is the IDE/workbench architecture reassessment.
- **Date:** 2026-05-05
- **Session:** Completed design work for `agent-platform-operator-experience.7` on `task/agent-platform-operator-experience.7`: added branch and diff workflow patterns covering branch status states, diff review shell, branch approval decision states, CI/SonarQube/CodeQL/review feedback linkage, unavailable states, and the implementation boundary with `agent-platform-branch-feedback-status`.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-operator-experience.6` on `task/agent-platform-operator-experience.6`: added generalized artifact viewer patterns, mapped browser evidence into image/text/JSON/download artifact cards, kept screenshots in the in-app zoomable viewer, added text/JSON in-app inspection, documented artifact states, and added focused artifact tests.
- **Date:** 2026-05-05
- **Session:** Follow-up on `task/agent-platform-operator-experience.5`: fixed the `/e2e/approval-card` visual fixture so it owns an absolute inset scroll container inside the app shell's overflow-hidden layout.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-operator-experience.5` on `task/agent-platform-operator-experience.5`: added a frontend-only operator trace view model, exposed a nested engineer-facing Trace details panel inside tool activity, surfaced existing trace ids/policy/errors/artifact counts/payloads when available, and added focused trace view tests.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-operator-experience.4` on `task/agent-platform-operator-experience.4`: added a frontend-only approval display mapper, redesigned HITL approval cards around action/target/reason/risk/outcome copy, moved raw/redacted approval payloads behind technical details, expanded the approval-card E2E fixture states, and added focused mapper tests.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-operator-experience.3` on `task/agent-platform-operator-experience.3`: added a frontend-only operator tool event display mapper, updated chat tool activity rows to show human-readable summaries by default, moved raw/redacted payloads behind nested technical details, preserved browser artifacts, and added focused mapper tests.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-operator-experience.2` on `task/agent-platform-operator-experience.2`: added `docs/design/operator-tool-event-display-model.md` defining current frontend tool inputs, display statuses, risk mapping, friendly tool labels, summary copy rules, details affordances, browser policy copy, approval states, and implementation guidance without changing contracts.
- **Date:** 2026-05-05
- **Session:** Completed `agent-platform-operator-experience.1` on `task/agent-platform-operator-experience.1`: added `docs/design/operator-experience-design-system.md` defining stack constraints, product posture, layout rules, status/risk vocabulary, component inventory, artifact/debug/approval patterns, example states, and follow-up task alignment.
- **Date:** 2026-05-05
- **Session:** Expanded `agent-platform-operator-experience` into a full Beads task chain on `feature/agent-platform-operator-experience-tasks`: child tasks `.1` through `.9` now cover design-system foundations, human-readable tool events, activity/debug separation, approval cards, observability details, artifact viewers, branch/diff review, IDE/workbench direction, and Docker host constraints.
- **Date:** 2026-05-05
- **Session:** Baked operator-experience design-system constraints into planning on `main`: parent epic now requires Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript, and child task `agent-platform-operator-experience.1` captures the design-system foundation work with no new UI libraries, backend logic, or data-contract changes.
- **Date:** 2026-05-05
- **Session:** Captured agent-governed authoring refinement context on `feature/agent-platform-operator-experience`: added planning note `docs/planning/agent-governed-authoring.md`, created Beads epic `agent-platform-agent-profile-governance`, linked related epics, and saved project memory for collaborative skill/profile authoring, policy scopes, orchestration guardrails, artifacts, and phased observability.
- **Date:** 2026-05-05
- **Session:** Added and closed `agent-platform-browser-tools-guide` on `feature/agent-platform-operator-experience`: created the practical Browser Tools Guide, linked it from the browser-tools epic and task index, and pushed Beads state for the completed documentation task.
- **Date:** 2026-05-05
- **Session:** Captured future operator-experience direction on `feature/agent-platform-operator-experience`: added Beads epic `agent-platform-operator-experience`, created `docs/tasks/agent-platform-operator-experience.md`, updated the task-spec index, and saved project memory for human-readable tool activity, HITL approvals, artifact/workbench UX, and Docker/host integration constraints.
- **Date:** 2026-05-04
- **Session:** Corrected full-page browser screenshot handling on `task/agent-platform-browser-tools.5`: the viewer now opens in fit-page mode with opt-in fit-width/zoom, chat previews are scrollable instead of cropped, and default screenshot artifacts now keep multi-megabyte PNGs intact instead of truncating at 2 MB.
- **Date:** 2026-05-04
- **Session:** Improved browser screenshot viewing on `task/agent-platform-browser-tools.5`: full-page screenshots now render as cropped readable thumbnails in chat and open into a width-filling, scrollable in-chat viewer with zoom controls.
- **Date:** 2026-05-04
- **Session:** Fixed the browser runtime `ENOSPC` launch failure path on `task/agent-platform-browser-tools.5`: Docker build cache had filled the container overlay, cache was pruned, and Playwright temp profiles now default to the host-backed workspace temp directory instead of container `/tmp`.
- **Date:** 2026-05-04
- **Session:** Fixed a browser-tools approval-resume regression on `task/agent-platform-browser-tools.5`: approved external browser starts now share the same runtime tool executor with the resumed graph, so immediate follow-up snapshot/screenshot calls keep access to the active browser session.
- **Date:** 2026-05-04
- **Session:** Implemented `agent-platform-browser-tools.5` on `task/agent-platform-browser-tools.5`: added real Playwright browser-tool integration validation, documented browser runtime troubleshooting, completed the browser-tools epic checklist, and verified root typecheck/lint/test/format plus Playwright E2E after applying the E2E seed.
- **Date:** 2026-05-04
- **Session:** Updated the docs-policy hook on `task/agent-platform-browser-tools.5` so agents are explicitly instructed to scan/update docs or record TODOs at hook time, and fixed SonarCloud hotspot `javascript:S4036` in `scripts/coding-runtime-verify.mjs` by resolving commands from fixed absolute directories instead of ambient `PATH`.
- **Date:** 2026-05-04
- **Session:** Completed `agent-platform-browser-tools.1` through `.4` on `task/agent-platform-browser-tools.4`: added governed Playwright browser contracts/tools, evidence artifacts, API artifact listing/download routes, compact chat UI summaries, tests, docs, and closed `.4` locally. Commit `3581388` is ready to push; Beads Dolt auto-push is still blocked by GitHub DNS/auth from the sandbox.
- **Date:** 2026-05-04
- **Session:** Planned next epic `agent-platform-browser-tools` on `feature/agent-platform-browser-tools`: claimed the epic, created child Beads tasks `.1` through `.5`, added chained dependencies, and wrote specs documenting Playwright as the core runtime with platform-owned policy/HITL/evidence handling.
- **Date:** 2026-05-04
- **Session:** Merged `origin/main` into `task/agent-platform-feedback-sensors.6`, resolved conflicts in Beads interactions, `sessionsRouter`, and `session.md`, and verified the refreshed branch with focused API checks plus root typecheck/lint.
- **Date:** 2026-05-04
- **Session:** Completed and closed `agent-platform-feedback-sensors.6` on `task/agent-platform-feedback-sensors.6`: exposed session sensor dashboards through API/contracts, moved sensor status into a right-side feedback drawer, added API/E2E coverage, created follow-up epic `agent-platform-branch-feedback-status`, opened PR #134 to `feature/feedback-sensors-harness`, and pushed through the pre-push gate.
- **Date:** 2026-05-04
- **Session:** Claimed `agent-platform-feedback-sensors.6` and created `task/agent-platform-feedback-sensors.6` from the pushed `.5` branch tip. Next work: expose sensor configuration/results/provider/runtime states through API/UI and add end-to-end validation for self-correction and completion gates.
- **Date:** 2026-05-04
- **Session:** Investigated SonarCloud failure on PR #133 for `agent-platform-feedback-sensors.5`: quality gate failed because `new_security_rating=5` from one new vulnerability (`typescript:S6418`) in `packages/plugin-observability/test/store.test.ts`; patched the test placeholder and cleaned up the accompanying Sonar maintainability findings.
- **Date:** 2026-05-04
- **Session:** Completed and closed `agent-platform-feedback-sensors.5` on `task/agent-platform-feedback-sensors.5`: sensor runs now persist compact sanitized observability events, sensor findings/provider/runtime/MCP capability states are queryable through session-bound tools, repeated failures produce review-required feedforward candidates only, and local gates plus SonarQube Blocker/Critical query are green.
- **Date:** 2026-05-04
- **Session:** Fixed the GitHub Actions unit-test regression on `task/agent-platform-feedback-sensors.4`: the combined feedback sensor runner no longer spends an implicit inferential evaluator call unless an evaluator is explicitly supplied. Root typecheck, lint, and unit tests pass locally; SonarQube CLI found no open Blocker/Critical issues on the PR branch. A separate `.5` spec update for MCP feedback-provider discovery remains uncommitted.
- **Date:** 2026-05-03
- **Session:** Implemented and closed `agent-platform-feedback-sensors.4`: added inferential feedback sensors, wired them into the default sensor runner, verified gates, and prepared `task/agent-platform-feedback-sensors.4` for push.
- **Date:** 2026-05-03
- **Session:** Completed `.3` closeout after SonarCloud passed on PR #131, claimed `agent-platform-feedback-sensors.4`, synced Beads/Dolt, and pushed `task/agent-platform-feedback-sensors.4` from the `.3` chain tip.
- **Date:** 2026-05-03
- **Session:** Addressed the remaining SonarCloud PR #131 duplication source in `packages/harness/test/reactLoop.test.ts` by extracting shared ReAct test fixtures; local gates are green and the branch is ready for the final Sonar rerun before claiming `.4`.
- **Date:** 2026-05-03
- **Session:** Addressed the second SonarCloud PR #131 pass after duplication dropped to 3.6% but remained above the 3% gate: extracted ReAct graph assembly helpers from `buildHarnessGraph`, verified local gates, and prepared the branch for another analysis run.
- **Date:** 2026-05-03
- **Session:** Addressed SonarCloud PR #131 feedback on `task/agent-platform-feedback-sensors.3`: refactored duplicated ReAct graph construction, reduced reported complexity/style findings, verified focused gates, and prepared the branch for re-analysis.
- **Date:** 2026-05-03
- **Session:** Implemented `agent-platform-feedback-sensors.3` on `task/agent-platform-feedback-sensors.3`: wired sensor checks into ReAct routing, added bounded repair feedback/escalation behavior, enabled API graph support, and closed the bead after green gates.
- **Date:** 2026-05-03
- **Session:** Implemented `agent-platform-feedback-sensors.2` on `task/agent-platform-feedback-sensors.2`: added deterministic computational sensor runner, imported finding normalization, bounded terminal evidence handling, runtime limitation reporting, and focused/broad quality gates.
- **Date:** 2026-05-03
- **Session:** Implemented `agent-platform-feedback-sensors.1` on `task/agent-platform-feedback-sensors.1`: added shared sensor contracts, public exports, trace lifecycle event types, and contract/trace tests.
- **Date:** 2026-05-03
- **Session:** Created Beads epic `agent-platform-ui-quality-sensors` and spec for future UI/UX grading sensors that use browser evidence, deterministic UI checks, and rubric-based design review.
- **Date:** 2026-05-03
- **Session:** Added agent-scope/profile policy to feedback-sensors specs so coding sensors apply to coding agents by default, while personal-assistant/research/automation agents only use relevant sensors or explicit/manual selections.
- **Date:** 2026-05-03
- **Session:** Added Docker/container and future command-sandbox edge cases to feedback-sensors specs, including runtime discovery, missing mounts/tools/network, host/container path mapping, and distinct environment-limitation states.
- **Date:** 2026-05-03
- **Session:** Added IDE/plugin feedback-provider requirements to the feedback-sensors specs, including bounded terminal-output ingestion, diagnostics/problem providers, setup guidance, and provider availability states.
- **Date:** 2026-05-03
- **Session:** Refined `agent-platform-feedback-sensors` specs after owner review to make sensors source-aware, cadence-aware, provider-auth-aware, and focused on pre-push local validation plus post-push GitHub/SonarQube/CodeQL/review feedback import.
- **Date:** 2026-05-03
- **Session:** Confirmed `agent-platform-scheduler` is already closed in Beads, then claimed the next planned epic `agent-platform-feedback-sensors`. Child tasks `.1` through `.6` already exist with specs; implementation should wait for owner refinement before claiming `.1`.
- **Date:** 2026-05-03
- **Session:** README was checked after the docs audit and updated with a concise current-capabilities section plus a link to the implemented Memory Model guide.
- **Date:** 2026-05-03
- **Session:** Audited and updated feature documentation after the scheduler/feedback-sensors merge: README now links the Scheduler guide; API docs include scheduler delete/update details and local timezone behaviour; database docs cover projects, memory, working memory, HITL approvals, and scheduler tables/migrations; scheduler docs cover edit/delete/manual refresh behaviour.
- **Date:** 2026-05-03
- **Session:** Feedback-sensors planning branch was merged to `main`; local `main` is updated and old feature/task branches were pruned. No implementation task is active. Pause here until the owner is ready to refine and claim the first feedback-sensors task.
- **Date:** 2026-05-03
- **Session:** Added follow-up Beads task `agent-platform-session-handoff-hygiene` with a spec for capping/rotating `session.md`; linked it as a dependency of `agent-platform-context-optimisation`.
- **Date:** 2026-05-03
- **Session:** Planned the feedback sensors harness epic from the Böckeler/Thoughtworks harness-engineering discussion. Created Beads epic `agent-platform-feedback-sensors`, six chained child tasks, linked spec files under `docs/tasks/`, and committed the planning docs on `feature/feedback-sensors-harness`.
- **Date:** 2026-05-02
- **Session:** Memory epic closeout complete. The epic was manually tested, merged to `main`, local `main` was updated, old task/feature branches were pruned, and `agent-platform-memory` plus child tasks `.1` through `.7` are closed in Beads. Pause here; next session should start planning/refinement for the next epic from updated `main`.
- **Date:** 2026-05-02
- **Session:** Addressed follow-up memory review feedback on `task/agent-platform-memory.7`: prompt memory retrieval now queries only visible, approved, safe/redacted, unexpired, minimum-confidence scopes; tool error parsing is shared; memory tools return structured scope errors; working-memory overwrite semantics are documented; important-file extraction avoids obvious URLs; and the memory.2 spec typo is fixed.
- **Date:** 2026-05-02
- **Session:** Polished the Settings Memory dashboard after manual review: promoted pending/approved/rejected states into larger colored badges, added clearer action hover/active/busy feedback, and reduced visual noise in each memory record card.
- **Date:** 2026-05-02
- **Session:** Implemented and verified `agent-platform-memory.7` on `task/agent-platform-memory.7`: added dry-run-first expired memory cleanup, cleanup API contracts/routes, scoped export/clear safety coverage, retention docs, and focused/broader package quality gates.
- **Date:** 2026-05-02
- **Session:** Added the missing Memory entry to the main Settings sidebar dropdown after manual epic testing confirmed the page worked but was not discoverable from the sidebar.
- **Date:** 2026-05-02
- **Session:** Addressed SonarCloud maintainability/reliability feedback on the final memory branch: simplified self-learning evidence mapping, added explicit string sort comparators, reduced chat history sanitiser complexity, and removed voided promise handlers from the Memory dashboard.
- **Date:** 2026-05-02
- **Session:** Closed out `agent-platform-memory.6` and claimed the final memory epic task, `agent-platform-memory.7`, on new branch `task/agent-platform-memory.7`. Beads/Dolt claim sync succeeded.
- **Date:** 2026-05-02
- **Session:** Addressed SonarCloud reliability findings on `task/agent-platform-memory.6`: removed loop-index reassignment in chat history sanitisation, replaced `charCodeAt()` with `codePointAt()` in workspace path checks, and reduced overlapping maintainability findings in the touched chat/bash workspace policy code.
- **Date:** 2026-05-02
- **Session:** Addressed review feedback on `task/agent-platform-memory.6`: working-memory JSON array reads now tolerate malformed persisted data, memory export URL construction no longer relies on string replacement, retrieval omitted counts now exercise cross-scope memories, and memory secret redaction utilities are centralized.
- **Date:** 2026-05-02
- **Session:** Started `agent-platform-memory.5` on `task/agent-platform-memory.5`; added memory management APIs, scoped native memory tools, Settings Memory UI, and focused tests. Remaining before close: full quality gate, Beads close, commit, and push.
- **Date:** 2026-05-02
- **Session:** Addressed review feedback on `task/agent-platform-memory.5`: malformed persisted memory JSON now falls back safely during reads, with DB regression coverage.
- **Date:** 2026-05-02
- **Session:** Started `agent-platform-memory.6` on `task/agent-platform-memory.6`; added the first review-gated self-learning evaluator for repeated recoverable workspace/path errors with API and DB tests.
- **Date:** 2026-04-26
- **Session:** `task/agent-platform-7d1` merged into `feature/agent-platform-ui-ux` and closed in Beads. Next chain task started: `task/agent-platform-de4` claimed (`in_progress`).
- **Date:** 2026-04-27
- **Session:** Completed UI input refactor and feedback-only changes; closed `agent-platform-de4`, `agent-platform-ucg`, and `agent-platform-lt6` in Beads.
- **Date:** 2026-04-29
- **Session:** Created HITL epic/task specs and branches; completed `agent-platform-hitl.1` deny-by-default approval gate on `task/agent-platform-hitl.1`.
- **Date:** 2026-04-29
- **Session:** Addressed Sourcery review feedback for HITL.1 approval gating and audit risk-tier handling.
- **Date:** 2026-04-29
- **Session:** HITL.1 was merged into `feature/agent-platform-hitl`; completed `agent-platform-hitl.2` approval request persistence/API on `task/agent-platform-hitl.2`.
- **Date:** 2026-04-29
- **Session:** HITL.2 was merged into `feature/agent-platform-hitl`; started `agent-platform-hitl.3` on `task/agent-platform-hitl.3`.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-hitl.3` approval-required NDJSON events on `task/agent-platform-hitl.3`; ready for PR into `feature/agent-platform-hitl`.
- **Date:** 2026-04-29
- **Session:** Addressed HITL.3 review feedback: pending approvals now audit as pending, approval output has a fallback renderer, and API stream tests assert no assistant text leaks on approval halt.
- **Date:** 2026-04-29
- **Session:** HITL.3 was merged into `feature/agent-platform-hitl`; claimed next task `agent-platform-hitl.4` and created `task/agent-platform-hitl.4` from the updated feature branch.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-hitl.4` durable approval resume execution on `task/agent-platform-hitl.4`; ready for PR into `feature/agent-platform-hitl`.
- **Date:** 2026-04-29
- **Session:** Queried SonarCloud PR `#93` duplicate-code metrics; refactored shared chat test helpers and amended `agent-platform-hitl.4`.
- **Date:** 2026-04-29
- **Session:** Refactored `chatRouter.ts` runtime error/finalization helpers to clear remaining SonarCloud duplicate-code block.
- **Date:** 2026-04-29
- **Session:** HITL.4 was merged into `feature/agent-platform-hitl`; selected `agent-platform-hitl.5` as the next epic task.
- **Date:** 2026-04-29
- **Session:** Started HITL.5 frontend approval UX: hook state, inline approval cards, decision/resume handling, and focused tests.
- **Date:** 2026-04-29
- **Session:** Fixed OpenAI tool-schema rejection for MCP schemas using unsupported `propertyNames` keyword.
- **Date:** 2026-04-29
- **Session:** Fixed replay of unresolved pending approval tool calls causing OpenAI missing tool response errors.
- **Date:** 2026-04-29
- **Session:** Fixed HITL approval resume to reuse the selected model config and block new prompts while an approval is unresolved.
- **Date:** 2026-04-29
- **Session:** Fixed approval-resume draft accumulation across DoD revisions and stopped DoD cap failures from showing as global chat errors.
- **Date:** 2026-04-29
- **Session:** Added spacing above the final critic review block in chat output.
- **Date:** 2026-04-29
- **Session:** Made shell command failure results feed back to the assistant in plain language instead of raw stdout/stderr/exitCode jargon.
- **Date:** 2026-04-29
- **Session:** Refactored duplicated HITL stream/lifecycle handling in `chatRouter.ts` and `use-harness-chat.ts` for SonarCloud PR 94.
- **Date:** 2026-04-29
- **Session:** `feature/agent-platform-hitl` merged into `main`; closed `agent-platform-hitl.5` and auto-closed HITL epic in Beads.
- **Date:** 2026-04-29
- **Session:** Planned next epic `agent-platform-ws` for host workspace storage, with six chained Beads tasks and task specs.
- **Date:** 2026-04-29
- **Session:** Started workspace storage epic on `task/agent-platform-ws.1`; documented host workspace conventions and config names for Linux, macOS, and Windows.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.1a` platform behavior: workspace config resolver, `make workspace-init`, startup lifecycle wiring, and PathJail-backed file path normalization.
- **Date:** 2026-04-29
- **Session:** Added backlog task `agent-platform-ws.6` for guarded host workspace data removal on uninstall/reset.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.2` Docker runtime mount wiring: `/workspace` and `/data` are host-backed through workspace env vars, with compose/docs/tests updated.
- **Date:** 2026-04-29
- **Session:** Fixed CI E2E startup for `agent-platform-ws.2` by adding `make workspace-init` before `docker compose up`.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.3` workspace PathJail/tool-policy enforcement on `task/agent-platform-ws.3`.
- **Date:** 2026-04-29
- **Session:** Addressed SonarCloud regex backtracking risk in the `agent-platform-ws.3` bash workspace policy.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.4` workspace file UI/API on `task/agent-platform-ws.4`.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.6` guarded workspace data cleanup flow on `task/agent-platform-ws.6`.
- **Date:** 2026-04-29
- **Session:** Fixed the `agent-platform-ws.6` E2E pipeline failure in `workspace-init.mjs`; GitHub pipelines are passing.
- **Date:** 2026-04-29
- **Session:** Started `agent-platform-ws.5` final workspace verification on `task/agent-platform-ws.5`; added compose persistence/security verification and Workspace UI e2e coverage.
- **Date:** 2026-04-29
- **Session:** Added user-facing workspace storage documentation and README references for setup, security, cleanup, UI/API, and verification behavior.
- **Date:** 2026-04-29
- **Session:** `task/agent-platform-ws.5` merged into `feature/agent-platform-workspace-storage`; removed generated workspace test artifacts from the feature-to-main PR.
- **Date:** 2026-04-29
- **Session:** `feature/agent-platform-workspace-storage` merged into `main`; workspace epic and all child tasks are closed in Beads.
- **Date:** 2026-04-29
- **Session:** Started post-epic harness capability review; converted top-level architecture diagrams to Mermaid and added a coding/general automation gap-analysis report.
- **Date:** 2026-04-29
- **Session:** Added memory management architecture covering short-term memory, long-term memory, and self-learning from mistakes.
- **Date:** 2026-04-29
- **Session:** Created Highest-Value Additions epics in Beads and added matching epic specification files under `docs/tasks/`.
- **Date:** 2026-04-29
- **Session:** Broke down `agent-platform-code-tools` into seven Beads child tasks with detailed linked specs.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-code-tools.1` on `task/agent-platform-code-tools.1`; added coding runtime baseline policy, API runner CLI installs, runtime verification wiring, and documentation links.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-code-tools.2` on `task/agent-platform-code-tools.2`; documented coding tool contracts, shared evidence artifacts, audit events, and truncation/storage rules.
- **Date:** 2026-04-30
- **Session:** Fixed chat UI/model-config override and API-key error leakage on `task/ui-chat-api-key-error-redaction`.
- **Date:** 2026-04-30
- **Session:** Follow-up local fix: chat now leaves agents without an assigned model config on the platform default path, and the Next.js BFF no longer injects its own env key as an explicit API override.
- **Date:** 2026-04-30
- **Session:** Added ignored local runtime-config backup/restore support for encrypted saved model configs, agent model assignments, and MCP server assignments.
- **Date:** 2026-04-30
- **Session:** Created Beads follow-up `agent-platform-runtime-backup-auto` and task spec for stage-two automatic runtime-config backup refresh.
- **Date:** 2026-04-30
- **Session:** Addressed SonarCloud hotspot `javascript:S4036` by using a fixed absolute sqlite3 path for runtime-config backup.
- **Date:** 2026-04-30
- **Session:** Completed `agent-platform-code-tools.3` structured edit tool on `task/agent-platform-code-tools.3`.
- **Date:** 2026-04-30
- **Session:** Follow-up Sonar cleanup on `task/agent-platform-code-tools.3`: deduplicated coding-envelope audit log tests.
- **Date:** 2026-04-30
- **Session:** Verified `agent-platform-code-tools.3` is closed, pushed, and paused before starting `agent-platform-code-tools.4`.
- **Date:** 2026-04-30
- **Session:** Started `agent-platform-code-tools.4` on `task/agent-platform-code-tools.4`; implemented read-only git status/diff/log/branch/changed-file tools with focused tests.
- **Date:** 2026-04-30
- **Session:** Completed `agent-platform-code-tools.4` read-only git tools on `task/agent-platform-code-tools.4`.
- **Date:** 2026-04-30
- **Session:** `task/agent-platform-code-tools.4` pipelines are green; claimed `agent-platform-code-tools.5` and created `task/agent-platform-code-tools.5`.
- **Date:** 2026-04-30
- **Session:** Implemented `agent-platform-code-tools.5` governed quality-gate runner on `task/agent-platform-code-tools.5`.
- **Date:** 2026-04-30
- **Session:** Completed `agent-platform-code-tools.5` governed quality-gate runner; Beads is closed/synced and the branch is ready for PR after push.
- **Date:** 2026-04-30
- **Session:** Reverted IDE folder-picker follow-up commits and disabled runtime chat evaluator nodes so internal DoD/critic JSON cannot replace normal assistant responses.
- **Date:** 2026-04-30
- **Session:** Created follow-up `agent-platform-ide-rethink` to reassess the browser IDE/code viewing direction before further implementation.
- **Date:** 2026-04-30
- **Session:** Fixed quality-gate package filters so chat agents can run lint/typecheck/build/test when they infer workspace paths such as `apps/web`.
- **Date:** 2026-04-30
- **Session:** Fixed CI unit-test failure in `qualityGateTool.test.ts` by resolving pnpm from absolute npm/pnpm environment paths before local fallback paths.
- **Date:** 2026-04-30
- **Session:** Closed out `agent-platform-code-tools.5` after green pipelines; claimed `agent-platform-code-tools.6` and created `task/agent-platform-code-tools.6` from the `.5` chain tip.
- **Date:** 2026-04-30
- **Session:** Implemented `agent-platform-code-tools.6` repository map, code search, and related-test discovery tools on `task/agent-platform-code-tools.6`.
- **Date:** 2026-04-30
- **Session:** Started `agent-platform-code-tools.7` on `task/agent-platform-code-tools.7`; changed chat tool activity to render separately from final assistant text and collapse after completion.
- **Date:** 2026-04-30
- **Session:** Closed `agent-platform-code-tools.7`; the structured coding tool pack epic auto-closed at 7/7 complete after green pipelines.
- **Date:** 2026-04-30
- **Session:** Added backlog task `agent-platform-context-optimisation` for context window/token-budget optimisation after memory foundations exist.
- **Date:** 2026-04-30
- **Session:** Added backlog task `agent-platform-llm-observability-export` for OpenTelemetry/OpenInference-compatible export strategy for LLM/context/memory observability.
- **Date:** 2026-04-30
- **Session:** Added backlog task `agent-platform-improvement-goals` for a limited observability-driven self-improvement loop with reviewed candidates.
- **Date:** 2026-04-30
- **Session:** Remembered future epic refinement workflow: review specs/tickets with owner before moving epics from refinement/planning to ready.
- **Date:** 2026-04-30
- **Session:** Started memory epic setup: created `feature/agent-platform-memory`, created `task/agent-platform-memory.1`, created seven memory child tasks/specs, and claimed `.1`.
- **Date:** 2026-04-30
- **Session:** Paused before implementing `agent-platform-memory.1`; remembered long-term memory v1 should use a relational store with optional links, not a graph database.
- **Date:** 2026-05-01
- **Session:** Implemented `agent-platform-memory.1` memory contracts, SQLite schema/migration, repository CRUD/query APIs, metadata redaction, relationship links, tests, and docs on `task/agent-platform-memory.1`.
- **Date:** 2026-05-01
- **Session:** Implemented `agent-platform-memory.2` short-term session working memory artifacts, prompt continuity hook, inspectable API endpoint, tests, and docs on `task/agent-platform-memory.2`.
- **Date:** 2026-05-01
- **Session:** Implemented `agent-platform-memory.3` pending memory candidate extraction from explicit remember instructions, corrections, repeated failures, and remediations on `task/agent-platform-memory.3`.
- **Date:** 2026-05-01
- **Session:** Addressed review feedback for `agent-platform-memory.3`: shared text compaction, safer credential regex flags, escaped source-metadata JSON paths, non-hardcoded candidate scoping, explicit working-memory list clearing, and docs/session typo fixes.
- **Date:** 2026-05-01
- **Session:** Reduced SonarCloud new-code duplication for `agent-platform-memory.3` by extracting shared memory contract shapes, working-memory persistence mapping, and DB test fixtures.
- **Date:** 2026-05-01
- **Session:** Closed out `agent-platform-memory.3` after green pipelines, claimed `agent-platform-memory.4`, and created `task/agent-platform-memory.4`. Implementation has not started.
- **Date:** 2026-05-02
- **Session:** Implemented `agent-platform-memory.4` approved long-term memory retrieval with conservative ranking, prompt bundle formatting, chat prompt integration, trace metadata, tests, and docs.

### Session-close guardrail (required)

- Local-only changes are not complete.
- Before ending a task/session, ensure work is committed and pushed to `origin`.
- Verify the remote branch/ref exists (for example `git ls-remote --heads origin <branch>` or `git status -sb` showing `origin/<branch>` tracking).
- `--no-verify` is high-risk: it skips Husky/local checks. If used, you must run the skipped build/typecheck/test checks manually and confirm they pass before closing work.

---

## What happened (this session)

### Project onboarding closeout updates implemented

Branch state: `task/agent-platform-project-onboarding.5` is active and contains the `.5` implementation commit.

- Added shared contracts for durable Project instruction update candidates, proposal metadata, candidate decisions, and explicit refresh/rescan update statuses.
- Added API support for collecting candidates during work, preparing low-risk closeout proposals, applying/rejecting candidates, and refreshing/rescanning Project onboarding state.
- Refresh/rescan now records `no_change`, `proposed_update`, or `material_drift`, and preserves previous mixed/non-code Project profile framing unless the user explicitly confirms a change.
- Added the IDE sidebar closeout update panel with Prepare, Apply, and Reject controls.
- Added API, contract, web component, and Playwright coverage for candidate filtering/proposal/apply/reject plus refresh no-change/proposed-update/material-drift states.
- Marked `docs/tasks/agent-platform-project-onboarding.5.md` DoD complete.

Verification:

- `pnpm build`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm lint`
- `pnpm test` with elevated local port binding
- `docker compose up -d --build api web`
- `docker compose exec -T --env E2E_SEED=1 api node packages/db/dist/seed/run.js`
- `BASE_URL=http://127.0.0.1:3001 API_URL=http://127.0.0.1:3000 pnpm run test:e2e` (22 passed)
- SonarQube CLI project filtering: 0 open Blocker/Critical issues on touched implementation files. Sonar Agentic Analysis is still unavailable because the organization has not enabled it.

### Project onboarding contracts started

Branch state: `task/agent-platform-project-onboarding.1` is active from `feature/agent-platform-project-onboarding`, which was created from updated `main` after PR #149 merged.

- Claimed Bead `agent-platform-project-onboarding.1` and synced Beads Dolt state after the claim.
- Added shared Project onboarding contracts in `packages/contracts/src/project.ts` for assessment output, evidence, commands, gaps, questions, instruction-update recommendations, user-visible display context, drafts, approval decisions, refresh results, fixture states, project profiles, and capabilities.
- Added `transitionProjectOnboardingState` to keep onboarding state changes explicit and reject invalid jumps.
- Exported the new contracts and helper from `packages/contracts/src/index.ts`.
- Added focused contract coverage in `packages/contracts/test/projectOnboarding.test.ts`.
- Marked the task spec DoD checklist complete in `docs/tasks/agent-platform-project-onboarding.1.md`.

Verification:

- `pnpm exec prettier --write packages/contracts/src/project.ts packages/contracts/src/index.ts packages/contracts/test/projectOnboarding.test.ts`
- `pnpm --filter @agent-platform/contracts run test -- test/projectOnboarding.test.ts test/project.test.ts`
- `pnpm --filter @agent-platform/contracts run typecheck`
- `pnpm format:check`
- `pnpm lint`
- `pnpm docs:lint`
- `git diff --check`
- `pnpm build`
- `pnpm test` with elevated local server/browser permissions after the sandboxed run hit browser integration hook timeouts

Completion gate:

- Local fallback gate passed: formatting, lint, docs lint, build, contract typecheck/tests, full unit test suite, and diff whitespace check.
- Remote completion gate passed for PR #150: `verify`, `docker`, `e2e`, `markdownlint`, `lychee`, and GitGuardian passed; GitHub review-thread sweep returned no review threads; direct Sonar issue search returned 0 unresolved issues.
- Sonar agentic file analysis could not run because the SonarCloud organization has not enabled Agentic Analysis. Sourcery skipped due the weekly diff-character rate limit and left no actionable review threads.

### Project onboarding assessment implemented

Branch state: `task/agent-platform-project-onboarding.2` is active from the completed `.1` tip.

- Claimed Bead `agent-platform-project-onboarding.2` and synced Beads Dolt state.
- Added read-only Project assessment in `apps/api/src/infrastructure/projects/projectAssessment.ts`.
- Assessment scans bounded filesystem evidence, classifies Project profile/capabilities, infers package commands and subproject scopes, evaluates `AGENTS.md` sufficiency, and produces the structured assessment contract from `.1`.
- `POST /v1/projects/open` now persists onboarding assessment metadata on first load; `POST /v1/projects/:id/onboarding/assess` refreshes it.
- Missing or insufficient instructions move to `in_progress`; sufficient existing root `AGENTS.md` can auto-approve; changed approved instructions move back to `needs_review`.
- Added a user-facing Project assessment panel in the IDE sidebar with summary, gaps, questions, and refresh action, without exposing `/workspace` or backend-accessibility labels in the assessment copy.
- Marked the `.2` task spec DoD checklist complete.

Verification:

- `pnpm --filter @agent-platform/api run typecheck`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/api exec vitest run test/projectsRouter.test.ts` with elevated local binding
- `pnpm --filter @agent-platform/web run test -- test/project-onboarding-assessment-panel.test.ts`
- `pnpm --filter @agent-platform/api run lint`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/api run build`
- `pnpm --filter @agent-platform/web run build`
- `pnpm format:check`
- `pnpm lint`
- `pnpm docs:lint`
- `git diff --check`
- `pnpm build`
- `pnpm test` with elevated local server/browser permissions

### Project workspace epic closeout

Branch state: `task/agent-platform-project-workspaces.6` is active. PR #148 is open against `feature/agent-platform-project-workspaces`; do not merge it yet.

- Created PR #148 for `agent-platform-project-workspaces.6` after the local `.6` gates had passed.
- Monitored PR #148 through GitHub Actions and external checks: `verify`, `docker`, `e2e`, `markdownlint`, `lychee`, GitGuardian, and SonarCloud all passed.
- Checked review/comment state with the thread-aware GitHub review script: no review threads were present; the only review was Sourcery's weekly rate-limit notice with no actionable code feedback.
- Queried SonarCloud directly: quality gate `OK`, 0 unresolved issues, 1.3% duplication on new code, and all quality-gate conditions passed.
- Closed Bead `agent-platform-project-workspaces.6`; Beads auto-closed the parent epic `agent-platform-project-workspaces`.
- `bd dolt push` initially failed through auto-push due non-interactive GitHub DNS/auth, then succeeded with elevated network access.
- Added a Beads closeout commit and began final session handoff cleanup.

Verification:

- Local `.6` gates already passed before PR creation: `pnpm format:check`, `pnpm docs:lint`, `git diff --check`, `pnpm build`, `pnpm lint`, `pnpm test`, focused `e2e/project-workspaces.spec.ts`, and full Docker-backed `pnpm run test:e2e`.
- PR #148 remote gates passed: `verify`, `docker`, `e2e`, `markdownlint`, `lychee`, `GitGuardian Security Checks`, and `SonarCloud Code Analysis`.
- SonarCloud direct API checks passed: quality gate `OK`, 0 unresolved issues.
- GitHub review-thread sweep returned `review_threads: []`.

### Project workspace model implemented

Branch state: `task/agent-platform-project-workspaces.1` contains the first Project workspace task.

- Started from `feature/agent-platform-project-workspaces`, claimed `agent-platform-project-workspaces.1`, and created the task branch.
- Added shared contracts in `packages/contracts/src/project.ts` for Project vs Chat modes, default agent profile, Project capability state, onboarding state, instruction-file references, subproject scope, Project workspace binding metadata, and access/write policy.
- Exported the new contracts and helpers from `packages/contracts/src/index.ts`.
- Added focused contract tests in `packages/contracts/test/project.test.ts` covering default agent selection, Project working-tree metadata, root/nested `AGENTS.md` references, read eligibility, and write eligibility.
- Documented Project vs Chat semantics, `/workspace`, capability states, onboarding states, and instruction precedence in `docs/architecture.md`.
- Marked the task spec checklist complete in `docs/tasks/agent-platform-project-workspaces.1.md`.
- Root cause for the initial full `pnpm test` failure was sandbox denial of local TCP bind (`listen EPERM 127.0.0.1`) in browser integration setup; rerunning the suite with approved local server binding passed.
- Opened PR #143 from `task/agent-platform-project-workspaces.1` to `feature/agent-platform-project-workspaces`.
- Initial remote checks passed: verify, docker, e2e, markdownlint, lychee, GitGuardian, SonarCloud Code Analysis, and Sourcery review.
- Sourcery still left two actionable code review threads. Fixed them by tightening project-relative path validation, adding a shared access-policy block reason schema, and making access policy logic exhaustive over capability/onboarding states.
- Pushed review-fix commit `98aeefb` for CI and review rerun.
- Pushed handoff commit `c9e0556`, which triggered the final PR rerun.
- Final PR #143 checks are green: `verify`, `docker`, `e2e`, `markdownlint`, `lychee`,
  `GitGuardian Security Checks`, `SonarCloud Code Analysis`, and `Sourcery review`.
- Rechecked GitHub review threads after the fix; both Sourcery threads are resolved and outdated.

Verification:

- `pnpm --filter @agent-platform/contracts run test -- test/project.test.ts`
- `pnpm --filter @agent-platform/contracts run typecheck`
- `pnpm --filter @agent-platform/contracts run test`
- `pnpm --filter @agent-platform/contracts run lint`
- `pnpm format:check`
- `pnpm build`
- `pnpm lint`
- `pnpm test` with escalation for browser integration local fixture servers
- `pnpm exec markdownlint-cli2 docs/architecture.md`
- `pnpm docs:lint` failed only on ignored generated `.agent-platform/workspaces/default/...` Markdown files, not touched tracked docs.
- `pnpm --filter @agent-platform/contracts run test -- test/project.test.ts` after review fixes
- `pnpm --filter @agent-platform/contracts run typecheck` after review fixes
- `pnpm --filter @agent-platform/contracts run lint` after review fixes
- `pnpm format:check` after review fixes
- pre-push affected-package `build`, `typecheck`, and `test`

Completion gate:

- SonarQube MCP/CLI was not available in this session.
- IDE Problems diagnostics were not exposed in the current tool surface.
- Fallback gate passed with contracts typecheck/lint/tests, root build/lint/test, formatting, and touched-doc markdownlint.

### Project workspace binding follow-up scoped

Branch state: `task/agent-platform-code-workbench.6` now contains the code workbench follow-up fixes plus the next epic planning.

- Deferred `agent-platform-code-workbench.7` until 2026-05-20 because the verification guide should follow the workspace-binding architecture rather than document the current partial behavior.
- Created Beads epic `agent-platform-project-workspaces` with tasks `.1` through `.6`.
- Added specs for project workspace model, workbench chat binding, `/workspace` active-project resolution, browser create file/folder behavior, capability-gated tools, and verification.
- Updated `docs/tasks/README.md` so the new epic is discoverable.
- Kept the rejected `disabledToolIds` approach out of the codebase; the next work should solve the root source-of-truth split between browser-selected host folders and backend `/workspace`.
- Committed the current changes as `4db2320` (`Document project workspace binding epic`).

Verification:

- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/web run test -- test/use-harness-chat.test.ts test/file-context.test.ts test/chat-route.test.ts`
- `pnpm docs:lint:md` remains blocked by pre-existing markdownlint issues under `.agent-platform/workspaces/default/...`, not the new task specs.

### Code workbench IDE chat feedback fixed

Branch state: `task/agent-platform-code-workbench.6` contains the completed task 6 implementation plus a follow-up bug fix.

- Investigated an owner-reported manual test where asking the IDE assistant to change the README title created an empty assistant bubble.
- Root cause: the IDE chat panel used `useHarnessChat` but only rendered assistant text/thinking/critic state. Tool events and HITL approval events were recorded by the hook but not passed into the IDE assistant renderer.
- Fixed the IDE assistant renderer to show tool activity, browser artifact previews, and approval cards in the right chat panel, including tool-only and approval-only responses.
- Confirmed the follow-up edit failure was caused by a source-of-truth mismatch: browser workbench files can come from the host via the browser File System Access API, while backend edit tools run in the Docker workspace/path jail. Added file-context guidance telling agents to propose reviewed replacement code blocks for attached workbench files instead of patching backend files.
- Investigated the next owner screenshot where Apply replaced README with only the first section. Root cause: Markdown replacements containing nested ``` fences can be parsed as partial/truncated code blocks. The IDE now hides Apply/Diff for Markdown blocks with unmatched nested fences and asks for a valid reviewed replacement instead.
- Updated code fence parsing to preserve filename hints such as `markdown:README.md`, so correctly fenced replacements can route straight to the intended file review action.
- Addressed the folder-open regression by preserving the stable `showDirectoryPicker({ mode: 'readwrite' })` path and keeping only a narrow single-flight guard for native picker re-entry.
- Added regression coverage in `apps/web/test/ide-assistant-content.test.ts`.
- Added regression coverage in `apps/web/test/file-context.test.ts`.
- Added regression coverage in `apps/web/test/ide-markdown-file-reference.test.ts`.

Verification:

- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/web run test -- test/ide-assistant-content.test.ts` (package runner executed 22 files / 86 tests)
- `pnpm --filter @agent-platform/web run test -- test/file-context.test.ts test/ide-assistant-content.test.ts` (package runner executed 22 files / 87 tests)
- `pnpm --filter @agent-platform/web run test -- test/ide-markdown-file-reference.test.ts test/file-context.test.ts` (package runner executed 22 files / 89 tests)
- `pnpm --filter @agent-platform/web run build`
- Playwright stub check against `/ide` with a fake directory picker confirmed the Explorer renders `demo-folder` and `README.md` after a handle is returned and that the picker is invoked with `{ mode: 'readwrite' }`.
- `pnpm exec prettier --check apps/web/components/ide/ide-with-chat.tsx apps/web/test/ide-assistant-content.test.ts`
- `pnpm exec prettier --check apps/web/lib/file-context.ts apps/web/test/file-context.test.ts`
- `pnpm exec prettier --check apps/web/components/ide/ide-markdown.tsx apps/web/test/ide-markdown-file-reference.test.ts apps/web/lib/file-context.ts apps/web/test/file-context.test.ts`
- `git diff --check`

### Browser screenshot full-page handling corrected

Branch state: `task/agent-platform-browser-tools.5` has an additional follow-up fix pending commit.

- Reviewed owner screenshots showing that the previous chat thumbnail still cropped full-page screenshots and the modal felt zoomed in because it defaulted to fit-width.
- Identified a deeper capture-side issue: the screenshot artifact was marked `truncated`, so the PNG itself could be cut at the 2 MB default cap before the UI ever received it.
- Changed chat previews to use a full-width, scrollable screenshot area instead of `object-cover` cropping.
- Changed the modal to open in fit-page mode first, so the whole screenshot is visible before the user chooses fit-width or zoom.
- Kept fit-width and 100-200% zoom controls for detailed inspection.
- Raised the default screenshot artifact limit from 2 MB to 12 MB and added regression coverage proving a 2.2 MB screenshot is stored intact by default.

Quality gates passed:

- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/web run build`
- `pnpm --filter @agent-platform/harness exec vitest run test/browserTools.test.ts`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/harness run build`
- `pnpm format:check`
- `git diff --check`

Completion gate:

- SonarQube MCP was not exposed in the current tool surface.
- IDE Problems diagnostics were not exposed in the current tool surface.
- Fallback gate passed with affected web/harness typecheck, lint, tests, builds, formatting, and diff whitespace checks.

### Browser screenshot viewer improved

Branch state: `task/agent-platform-browser-tools.5` has an additional follow-up fix pending commit.

- Reviewed manual screenshots showing full-page browser captures rendered as tiny images in the chat preview card and difficult-to-inspect images in the modal viewer.
- Changed chat screenshot previews from whole-image fit to a fixed-height, top-aligned cropped thumbnail so a tall full-page capture fills the card instead of shrinking to a sliver.
- Reworked the in-chat viewer into a width-filling, scrollable lightbox:
  - default view fills the available modal width
  - vertical scrolling exposes the rest of a full-page screenshot
  - zoom controls allow 100% to 200% inspection without opening a new tab
  - metadata remains visible in the viewer header

Quality gates passed:

- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/web run build`
- `pnpm format:check`
- `git diff --check`

Completion gate:

- SonarQube MCP was not exposed in the current tool surface.
- IDE Problems diagnostics were not exposed in the current tool surface.
- Fallback gate passed with web typecheck, lint, tests, build, formatting, and diff whitespace checks.

### Browser runtime ENOSPC hardening

Branch state: `task/agent-platform-browser-tools.5` has an additional follow-up fix pending commit.

- Investigated manual browser-tool failure:
  - `sys_browser_start` failed before opening `http://web:3001`.
  - Error was `ENOSPC: no space left on device, mkdtemp '/tmp/playwright-artifacts-XXXXXX'`.
- Confirmed the API container overlay filesystem was full: `/` was `59G` used with `0` available, while `/workspace` still had free space.
- Confirmed Docker build cache was the main local pressure source. Ran `docker builder prune -f`, reclaiming `41.51GB`; the API container now reports about `47G` free on `/`.
- Added Compose defaults:
  - `AGENT_BROWSER_TMPDIR=/workspace/.agent-platform/tmp/browser`
  - `TMPDIR=/workspace/.agent-platform/tmp/browser`
- Hardened `BrowserSessionManager` so it creates the browser temp directory under the workspace and temporarily applies `TMPDIR`/`TMP`/`TEMP` around browser launch.
- Documented the workspace-backed temp path and `ENOSPC` troubleshooting in `docs/development.md`.

Quality gates passed:

- `pnpm --filter @agent-platform/harness exec vitest run test/browserTools.test.ts`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/harness run build`
- `pnpm format:check`
- `pnpm exec markdownlint-cli2 docs/development.md`
- `git diff --check`

Completion gate:

- SonarQube MCP was not exposed in the current tool surface.
- IDE Problems diagnostics were not exposed in the current tool surface.
- Fallback gate passed with focused tests, typecheck, lint, build, formatting, docs lint, and diff whitespace checks.

### Browser approval resume session continuity fixed

Branch state: `task/agent-platform-browser-tools.5` is ahead of origin with follow-up commit `82ddcb2`.

- Investigated a manual browser-tool run where approving `https://bbc.co.uk` successfully opened the page, but the immediate `sys_browser_snapshot` and `sys_browser_screenshot` calls failed with `BROWSER_SESSION_UNAVAILABLE`.
- Root cause: `handleSessionResume` executed the approved browser start with one native system-tool executor, then built a separate resumed runtime graph with a new executor. Browser sessions are stored in the executor-owned `BrowserSessionManager`, so the continuation graph could not see the approved start session.
- Added a shared runtime native-tool executor path for approval resume. The approved tool dispatch and resumed graph now receive the same executor instance for that resume cycle.
- Added a focused API regression test with a stateful fake browser executor. The test fails if `sys_browser_start` and the follow-up `sys_browser_snapshot` use different executor instances.
- Exposed the test-only executor factory through the v1 chat router options so the regression can be validated without launching a real browser.

Quality gates passed:

- `pnpm --filter @agent-platform/api exec vitest run test/sessionChat.integration.test.ts` (required sandbox escalation for Supertest listener binding)
- `pnpm --filter @agent-platform/api run typecheck`
- `pnpm --filter @agent-platform/api run lint`
- `pnpm --filter @agent-platform/api run build`
- `pnpm format:check`
- `git diff --check`

Completion gate:

- SonarQube MCP did not become available through tool discovery in this session.
- IDE Problems diagnostics were not exposed in the current tool surface.
- Fallback gate passed with focused tests, typecheck, lint, build, formatting, and diff whitespace checks.

### Browser tools validation implemented

Branch state: `task/agent-platform-browser-tools.5` contains the browser-tools segment tip.

- Added `packages/harness/test/browserTools.integration.test.ts`, which drives a real Playwright browser against a local HTML fixture.
- The integration test covers `browser_start`, `browser_navigate`, `browser_snapshot`, `browser_screenshot`, `browser_click`, `browser_type`, `browser_press`, and `browser_close`.
- Negative coverage now includes external-domain navigation approval, redirect-to-external approval, sensitive input approval, ambiguous target failure, inactive-session failure after close, and bounded artifact/sidecar metadata.
- Added browser runtime troubleshooting to `docs/development.md`.
- Updated `docs/tasks/agent-platform-browser-tools.md` and `.5` with validation results and completed checklist items.
- Addressed SonarCloud PR #137 hotspot `typescript:S2245` in
  `apps/api/test/browserRouter.test.ts` by replacing `Math.random()` test path
  generation with `mkdtempSync`.

Quality gates passed:

- `pnpm --filter @agent-platform/harness exec vitest run test/browserTools.integration.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm exec markdownlint-cli2 docs/development.md docs/tasks/agent-platform-browser-tools.md docs/tasks/agent-platform-browser-tools.5.md`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `docker compose --profile services exec -T api sh -lc 'E2E_SEED=1 SQLITE_PATH=/data/agent.sqlite node packages/db/dist/seed/run.js'`
- `pnpm test:e2e`
- `pnpm --filter @agent-platform/api exec vitest run test/browserRouter.test.ts`
- `pnpm --filter @agent-platform/api run lint`
- `pnpm --filter @agent-platform/api run typecheck`

Completion gate:

- SonarQube MCP tools and IDE Problems were not available through the current tool surface.
- Fallback typecheck/lint/test/E2E gates passed.
- Earlier `pnpm test:e2e` failed before applying `E2E_SEED=1`; after applying the E2E seed to the running API container, all 16 E2E tests passed.
- `sonar verify` could not confirm the hotspot fix because SonarCloud returned
  `A3S analysis is not activated for this organization`; PR analysis should
  verify after the fix is pushed.

### Browser tools tickets 1-4 implemented

Branch state: `task/agent-platform-browser-tools.4` contains the cumulative browser-tools implementation for `.1` through `.4`.

- Completed and locally closed:
  - `agent-platform-browser-tools.1` - shared browser contracts and policy schemas.
  - `agent-platform-browser-tools.2` - read-only browser runtime/session/snapshot/screenshot tools.
  - `agent-platform-browser-tools.3` - governed navigation, click, type, and keypress actions with URL/approval policy.
  - `agent-platform-browser-tools.4` - browser evidence observability through API routes and compact chat UI summaries.
- Added shared browser contracts in `packages/contracts/src/browserTool.ts`, exported through `packages/contracts/src/index.ts`.
- Added Playwright-backed harness browser tools in `packages/harness/src/tools/browserTools.ts`, with Docker-friendly Chromium resolution, bounded artifacts, sidecar metadata, URL policy, approval-required states, and structured runtime limitations.
- Updated the default browser URL policy to allow the Docker Compose `web`
  service hostname, so manual in-container browser-tool prompts can open
  `http://web:3001` without an external-domain approval interruption.
- Added inline chat previews for stored browser screenshot artifacts while
  keeping the original artifact download link.
- Moved browser screenshot previews out of the collapsible tool trace and into
  persistent assistant message content, with an in-chat click-to-close image
  viewer.
- Routed external browser start/navigation approvals through the durable HITL
  approval-card flow; approved resumes now retry the browser action with an
  internal approval marker instead of relying on conversational approval text.
- Added API routes under `/v1/browser/artifacts` to list browser artifact sidecars and download bounded workspace-relative artifacts through `PathJail`.
- Updated chat tool rendering to summarize browser tool results and link evidence artifacts without flooding the transcript with raw JSON.
- Updated API/architecture/task docs and all `.1` through `.4` task specs.
- Commit created: `3581388 feat(browser-tools): add governed browser automation`.

Quality gates passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/contracts run test`
- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/api run test`
- `pnpm --filter @agent-platform/api exec vitest run test/browserRouter.test.ts`
- `pnpm --filter @agent-platform/api run typecheck`
- `pnpm --filter @agent-platform/api run lint`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm exec markdownlint-cli2 docs/api-reference.md docs/architecture.md docs/tasks/agent-platform-browser-tools.md docs/tasks/agent-platform-browser-tools.1.md docs/tasks/agent-platform-browser-tools.2.md docs/tasks/agent-platform-browser-tools.3.md docs/tasks/agent-platform-browser-tools.4.md`
- `git diff --check`

Completion gate:

- SonarQube MCP tools were not exposed through the currently callable tool list.
- IDE Problems were not available in the local tool surface.
- Fallback gates above passed. Full `pnpm docs:lint` is blocked by unrelated generated scratch content under `.agent-platform/workspaces/default/scratch/demo-app/README.md`; touched docs pass.
- Beads close succeeded locally for `.4`; Beads Dolt auto-push failed because GitHub DNS/auth was unavailable from the sandbox.

### Browser tools epic planned

Branch state: `feature/agent-platform-browser-tools` contains planning docs for the next P1 epic.

- Claimed `agent-platform-browser-tools` in Beads.
- Created child tasks `agent-platform-browser-tools.1` through `.5`.
- Linked each child to `agent-platform-browser-tools` and chained dependencies `.1 -> .2 -> .3 -> .4 -> .5`.
- Added specs:
  - `docs/tasks/agent-platform-browser-tools.1.md`
  - `docs/tasks/agent-platform-browser-tools.2.md`
  - `docs/tasks/agent-platform-browser-tools.3.md`
  - `docs/tasks/agent-platform-browser-tools.4.md`
  - `docs/tasks/agent-platform-browser-tools.5.md`
- Updated the epic spec to record the implementation direction: Playwright as the internal runtime, optional MCP/browser adapters, local/dev URLs first, platform-owned policy/HITL/evidence storage, and UI-quality grading deferred to `agent-platform-ui-quality-sensors`.
- Updated `docs/tasks/README.md` so Browser tools points at the child spec files.

### Sensor controls and right feedback drawer completed

Branch state: `task/agent-platform-feedback-sensors.6` contains the final feedback-sensors task and has been refreshed with `origin/main`.

- Preserved the scheduler/project work and documentation updates merged to `main`.
- Preserved the feedback-sensors implementation branch work on top of the refreshed mainline.

- Added shared `SensorDashboardResponse` contracts for session-scoped sensor dashboards, MCP capability availability, repeated-failure patterns, feedback candidates, setup guidance, and status summaries.
- Added `GET /v1/sessions/:id/sensors` and `POST /v1/sessions/:id/sensors/retry`.
- The API dashboard combines configured sensor definitions, active agent profile, selected sensor profile, recent observability outcomes, provider availability, MCP capabilities, normalized findings, runtime limitations, repeated-failure patterns, and reviewed improvement candidates.
- Added default provider guidance for IDE Problems, IDE terminal output, GitHub check runs, SonarQube issues, and CodeQL alerts when the coding profile is active but providers have not reported findings.
- Moved the sensor UI out of the chat transcript and into a right-side feedback drawer collapsed by default.
- The drawer shows pass/fail/open/unavailable counts, recent outcomes, provider auth/setup states, open findings, and Docker/sandbox/runtime limitations with manual retry.
- Added an E2E fixture page at `/e2e/sensor-status` and Playwright coverage proving the drawer is hidden until opened and then renders providers, findings, corrected outcomes, and sandbox limitations.
- Updated API, architecture, development, and task docs.
- Closed `agent-platform-feedback-sensors.6`; Beads auto-closed the parent `agent-platform-feedback-sensors` epic locally.

### Branch-aware feedback follow-up epic created

- Created Beads epic `agent-platform-branch-feedback-status`.
- Added `docs/tasks/agent-platform-branch-feedback-status.md`.
- The follow-up epic tracks branch/PR-aware feedback: current branch discovery, PR mapping, GitHub Actions/CodeQL/SonarQube/review import, MCP capability discovery, right-drawer integration, and sensor reflection.

Quality gates passed:

- `pnpm --filter @agent-platform/contracts run build`
- `pnpm --filter @agent-platform/contracts exec vitest run test/sensor.test.ts`
- `pnpm --filter @agent-platform/api exec vitest run test/sensorDashboard.integration.test.ts`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`
- `pnpm exec playwright test -c e2e/playwright.config.ts e2e/mvp-e2e.spec.ts -g "sensor status panel"`
- `pnpm test:e2e` passed before the drawer move; the focused sensor drawer E2E passed after the drawer move and Docker rebuild.

Completion gate:

- SonarQube MCP tools were not exposed through the currently callable MCP tool list in this session.
- IDE Problems were not available in the local tool surface.
- Fallback gates above passed. `pnpm docs:lint` failed only after Docker/E2E generated `.agent-platform/workspaces/default/scratch/demo-app/README.md`; tracked docs pass with `.agent-platform` excluded.

### Inferential sensor checkpoints implemented

Branch state: `task/agent-platform-feedback-sensors.4` contains the fourth feedback-sensors task.

- Added `packages/harness/src/sensors/inferentialSensorRunner.ts`.
- Inferential checks now emit normal `SensorResult`/`SensorRunRecord` records with `inferential:*` IDs, shared sensor categories, evidence, severity, and repair instructions.
- Coding profiles run six bounded semantic checks at final/manual/external checkpoints: task satisfaction, diff intent, architecture boundary risk, test quality, unresolved findings, and readiness to commit/push/review.
- Personal-assistant profiles only run task satisfaction and readiness checks by default.
- The default `createSensorCheckNode` runner now calls `runFeedbackSensors`, which runs computational sensors first and then inferential sensors. This preserves required local gates; self-assessment cannot disable or replace typecheck/test/lint findings.
- Open findings from computational collectors and quality gates are passed into the inferential evaluator as evidence.
- Model-backed evaluator prompt requires JSON-only output with evidence-backed failed criteria. Malformed output fails closed as `inferential:self_assessment`.
- Missing model config is reported as an unavailable inferential self-assessment sensor.
- Added `packages/harness/test/inferentialSensorRunner.test.ts` covering pass, fail, unresolved findings, coding vs personal-assistant profile selection, malformed output, max-sensor cap behavior, and combined computational + inferential gate preservation.
- Updated `docs/tasks/agent-platform-feedback-sensors.4.md` checklist and closed Beads task `agent-platform-feedback-sensors.4`.

Quality gates passed:

- `pnpm --filter @agent-platform/harness run test -- test/inferentialSensorRunner.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/critic.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/dodCheck.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/sensorCheck.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/plugin-sdk run test`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm lint`

Completion gate:

- SonarQube MCP tools were not exposed through the currently callable MCP tool list.
- Authenticated SonarCloud CLI/API access works. `sonar auth status` is connected to `https://sonarcloud.io`, org `jwill9999`.
- Current PR `#131` quality gate read via SonarCloud API is `OK`, with `new_duplicated_lines_density` at `0.0` and security hotspot review at `100.0`.
- `bd close` succeeded locally; its Dolt auto-push failed because GitHub DNS/auth was unavailable from the sandbox. The normal git push still needs to be completed for the branch.

### Short-term working memory implemented

Branch state: `task/agent-platform-memory.2` contains the second memory epic task.

- Added shared working-memory contracts for session-scoped artifacts and bounded tool summaries.
- Added `working_memory_artifacts` SQLite table plus repository APIs for get/upsert/delete with merge/de-dupe behavior.
- Chat and resume flows now refresh session working memory after successful graph runs.
- Prompt building now appends a compact short-term working-memory summary to the system prompt when a session artifact exists.
- Added `GET /v1/sessions/:id/working-memory` so the artifact is inspectable through the API.
- Working memory captures current goal, active project/task, decisions, important files, tool names, bounded tool summaries, blockers, pending approval IDs, next action, and a compact summary.
- Tool payloads are summarized before persistence; raw tool output is not copied wholesale.
- Updated `docs/memory.md` and `docs/api-reference.md` for the working-memory layer and endpoint.

---

## Hook and Sonar hotspot update (2026-05-04)

- **Summary:** Updated `.github/hooks/inject-docs-policy.sh` so the hook explicitly instructs agents to summarize implemented changes, scan relevant docs, update the right documentation, or append precise TODOs to `session.md` when the correct documentation change is unclear.
- Fixed SonarCloud hotspot `javascript:S4036` in `scripts/coding-runtime-verify.mjs`; the runtime verifier now resolves required commands from a fixed set of absolute binary directories and executes the resolved absolute path instead of using `sh -lc "command -v ..."` or relying on ambient `PATH`.
- Confirmed no `package.json` or `pnpm-lock.yaml` changes are present on `task/agent-platform-browser-tools.5`; no lockfile update is pending on this branch.

Quality gates passed:

- `pnpm lint`
- `node --check scripts/coding-runtime-verify.mjs`
- `node scripts/coding-runtime-verify.mjs`
- `pnpm exec prettier --check scripts/coding-runtime-verify.mjs`
- `pnpm exec markdownlint-cli2 session.md`
- `git diff --check`

Completion gate:

- SonarCloud hotspot `AZ3mxfDpWfC-ETgZrxdI` was inspected through the Sonar API.
- Local `sonar verify` could not confirm the fix because SonarCloud returned `A3S analysis is not activated for this organization`; the code path flagged by `javascript:S4036` has been removed.

### Memory foundation implemented

Branch state: `task/agent-platform-memory.1` contains the first memory epic task.

- Added shared memory contracts for scopes, kinds, status, review status, source metadata, confidence, expiry, and safety state.
- Added `memories` and `memory_links` SQLite tables plus repository APIs for create/read/update/delete/query/count and memory links.
- Repository queries support scope, kind, status, review status, confidence floor, source kind/id, source metadata, tags, and expiry filtering.
- Metadata redaction happens before persistence for common secret-bearing keys, including nested objects and arrays.
- Added `docs/memory.md` describing the v1 relational model, storage boundary, and explicit no-automatic-prompt-retrieval decision.
- Added focused contract and DB tests for round-trip validation, CRUD/query, expiry filtering, metadata redaction, migration, and link cascade behavior.

Quality gates passed:

- `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
- `pnpm --filter @agent-platform/db run test -- test/memories.test.ts test/migrate.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test` (run with escalation because Supertest API tests bind local HTTP listeners)
- `pnpm docs:lint`

### Chat UI model-config and stream error handling fixed

Branch state: `task/ui-chat-api-key-error-redaction` contains an unrelated UI/runtime bug fix before continuing the coding-tools epic.

- Changed the chat page to default the model selector to the selected agent's saved model config instead of blindly using the first stored config as a request override.
- Follow-up: changed the chat page so agents without an assigned saved model config send no `modelConfigId`, preserving the platform default model/key path.
- Follow-up: changed the Next.js `/api/chat` proxy so it forwards only an explicit caller `x-openai-key`; it no longer turns `AGENT_OPENAI_API_KEY`/`NEXT_OPENAI_API_KEY` from the web process into an API override.
- Follow-up: changed the API model resolver so the first saved Settings > Models config with credentials is the platform default before env-var fallback.
- Follow-up: excluded `**/.next` from Docker build context and removed OpenAI key env injection from the web container so stale web bundles/env cannot override API model resolution.
- Runtime finding: workspace-storage changed Docker SQLite from named volume `agent-platform_sqlite_data` to host bind mount `.agent-platform/data/agent.sqlite`; the previously saved model configs were still in the old named volume.
- Migrated only `model_configs` and referenced `secret_refs` from the old named volume DB into the current host-mounted DB. Both restored OpenAI model configs pass `POST /v1/model-configs/:id/test`.
- Added focused regression tests for model selection precedence and BFF header forwarding.
- Added a harness regression test proving built-in system tools are passed to the SDK with provider-safe names and strict schemas.
- Added an API integration test proving chat uses an encrypted saved model config when the agent has no override and no env key is configured.
- Sanitized streamed NDJSON output, API stream error events, web stream error rendering, and observability task/error events so provider messages cannot leak API-key-shaped values.
- Added a `MODEL_AUTH_FAILED` stream code for provider authentication failures that happen after NDJSON headers are already sent.
- Added regression coverage for API post-header auth errors, web stream error rendering, harness NDJSON redaction, output guard OpenAI key detection, and observability redaction.

### Local runtime config backup added

Follow-up owner request: preserve local default agent/model/API-key/MCP setup across accidental DB wipes without committing secrets or encrypted secret material to Git.

- Added `scripts/runtime-config-backup.mjs` with `backup` and `restore` actions.
- Added `make runtime-config-backup` and `make runtime-config-restore`.
- Backup writes to ignored `.agent-platform/backups/runtime-config.sqlite` by default.
- Backup captures saved `model_configs`, referenced encrypted `secret_refs`, agent `model_config_id` assignments, `mcp_servers`, and `agent_mcp_servers`.
- Restore copies encrypted secret envelopes as-is; it does not decrypt or print API keys.
- Set local runtime data so seeded Personal assistant uses `gpt-5.4-nano` and seeded Coding uses `gpt-5.4`, then created a local ignored backup containing 2 model configs, 2 encrypted secret refs, 2 MCP servers, 1 agent MCP assignment, and 2 agent model assignments.
- Documented the recovery flow in `docs/workspace-storage.md`: `make reset`, `make runtime-config-restore`, `make restart`.

Quality gates passed:

- `pnpm --filter @agent-platform/harness run test -- test/outputGuard.test.ts test/backpressure.test.ts`
- `pnpm --filter @agent-platform/web run test -- test/use-harness-chat.test.ts`
- `pnpm --filter @agent-platform/plugin-observability run test -- test/observability.test.ts`
- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/plugin-observability run test`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/plugin-observability run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/plugin-observability run lint`
- `pnpm --filter @agent-platform/api run test -- test/sessionChat.integration.test.ts` (run with escalation because Supertest binds local ports)
- `pnpm --filter @agent-platform/api exec vitest run test/sessionChat.integration.test.ts` (run with escalation because Supertest binds local ports)
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `node --test scripts/runtime-config-backup.test.mjs scripts/workspace-clean.test.mjs`
- `node --check scripts/runtime-config-backup.mjs`
- `node --check scripts/runtime-config-backup.test.mjs`
- `pnpm exec prettier --check scripts/runtime-config-backup.mjs scripts/runtime-config-backup.test.mjs docs/workspace-storage.md`
- `make runtime-config-backup`
- Restore smoke check against `/private/tmp/agent-platform-restore-check.sqlite`
- SonarCloud hotspot fix checks:
  - `node --test scripts/runtime-config-backup.test.mjs scripts/workspace-clean.test.mjs`
  - `node --check scripts/runtime-config-backup.mjs`
  - `pnpm exec prettier --check scripts/runtime-config-backup.mjs scripts/runtime-config-backup.test.mjs`
  - `pnpm lint`
  - `git diff --check`

### Runtime backup automation follow-up tracked

- Created Beads task `agent-platform-runtime-backup-auto`.
- Added `docs/tasks/agent-platform-runtime-backup-auto.md` describing the stage-two automation work: refresh the ignored local runtime-config backup after successful model config, agent assignment, MCP server, and agent MCP assignment writes.
- Synced Beads/Dolt remote state with `bd dolt push`.

### SonarCloud runtime backup hotspot fixed

- SonarCloud hotspot `AZ3btIyTPSDrC3lo9zwa` flagged `scripts/runtime-config-backup.mjs` for searching OS commands via `PATH`.
- Updated runtime-config backup to invoke `/usr/bin/sqlite3` by default instead of `sqlite3`.
- Added `SQLITE3_BIN` override support only when set to an absolute path.
- Added regression coverage that relative command overrides are rejected.

### Structured coding edit tool implemented

- Created `task/agent-platform-code-tools.3` from `task/agent-platform-code-tools.2`.
- Added shared coding tool schemas in `packages/contracts/src/codingTool.ts`.
- Added built-in `coding_apply_patch` as a medium-risk structured edit tool.
- The tool supports exact text replacement, create/append behavior when `oldText` is omitted, dry-run previews, changed-file output, diff stats, inline diff evidence, and coding evidence envelopes.
- Dispatch now enforces PathJail on nested patch operation paths before native execution and rejects traversal/symlink escapes before mutation.
- Audit logging now records `ok: false` coding envelopes as `error` or `denied` instead of `success`.

### Quality gate workspace path filters fixed

Follow-up from manual UI testing on `task/agent-platform-code-tools.5`: chat could call `run_quality_gate`, but lint requests inferred from UI/file context could send a safe workspace path such as `apps/web` as `packageName`. The tool contract only accepted scoped pnpm package names like `@agent-platform/web`, so validation denied the run before lint started.

- Extended the quality-gate input schema to accept `@agent-platform/<name>`, `apps/<name>`, and `packages/<name>`.
- Added runtime normalization from workspace package paths to the package name in that path's `package.json`.
- Kept execution constrained to pnpm allowlisted profiles and validated `@agent-platform/*` package names before command construction.
- Added harness coverage proving `packageName: "apps/web"` runs as `pnpm --filter @agent-platform/web run lint`.

Quality gates passed:

- `pnpm --filter @agent-platform/contracts run build`
- `pnpm --filter @agent-platform/contracts run typecheck`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
- `pnpm --filter @agent-platform/harness exec vitest run test/qualityGateTool.test.ts`
- `pnpm exec prettier --check packages/contracts/src/codingTool.ts packages/harness/src/tools/qualityGateTool.ts packages/harness/test/qualityGateTool.test.ts docs/coding-tool-contracts.md`
- `git diff --check`
- MCP trust guard now prevents MCP tools from shadowing `coding_apply_patch`.
- Added regression coverage for schema round-trips, coding tool allowlist behavior, dry-run/apply/create, binary denial, traversal denial, symlink denial, and coding audit statuses.

### Sonar duplicate-code follow-up

- Refactored duplicated coding-envelope setup in `packages/harness/test/toolAuditLog.test.ts` into a shared helper while keeping distinct error/denied status assertions.

### Read-only git tools implemented

- Created `task/agent-platform-code-tools.4` from the pushed `.3` chain tip.
- Claimed `agent-platform-code-tools.4` in Beads and synced Beads/Dolt.
- Added structured contracts for git status, diff, log, branch info, and changed-file result payloads.
- Added low-risk built-in tools: `sys_git_status`, `sys_git_diff`, `sys_git_log`, `sys_git_branch_info`, and `sys_git_changed_files`.
- Git tools use absolute `/usr/bin/git`, bounded output, workspace/repository scoping, structured coding evidence envelopes, and no mutating git commands.
- PathJail now treats `repoPath` as path-like, dispatch read-enforces all git tools, and MCP trust guard blocks git tool name shadowing.
- Added temporary-repo regression tests for clean/dirty status, staged/unstaged/untracked files, bounded diff truncation, log, branch info, non-repo denial, outside-workspace denial, and unknown tool IDs.
- Closed `agent-platform-code-tools.4` in Beads and synced Beads/Dolt.
- Pushed `task/agent-platform-code-tools.4`; GitHub pipelines passed green.

### Governed test runner task claimed

- Claimed `agent-platform-code-tools.5` in Beads and synced Beads/Dolt.
- Created `task/agent-platform-code-tools.5` from the `.4` chain tip.
- Added strict shared contracts for `run_quality_gate` input/output, profiles, failures, command display, timeout status, and bounded stdout/stderr tails.
- Added medium-risk built-in tool `sys_run_quality_gate` / `run_quality_gate`.
- The runner uses fixed profile-to-script mappings (`test`, `typecheck`, `lint`, `format`, `docs`, `build`, `e2e`), `execFile` without a shell, fixed absolute `pnpm` discovery, timeout controls, output truncation, and structured coding evidence.
- Arbitrary command-shaped input is denied by strict schema validation; package filters are limited to package-supported profiles.
- PathJail read-enforces `repoPath`, and MCP trust guard prevents MCP tools from shadowing `run_quality_gate`.
- Added regression tests for allowed passing runs, non-zero exits with failure summaries, timeout, truncation, arbitrary-command denial, unsupported package filters, workspace escape denial, registration, and unknown tool IDs.
- Completed broad terminal quality gates for `.5`.
- Closed `agent-platform-code-tools.5` in Beads and synced Beads/Dolt.

### Chat runtime evaluator leak fixed

- Manual testing found chat could return internal DoD criteria JSON, for example `{"criteria":[...]}`, instead of a normal assistant response.
- Reverted the three IDE folder-picker follow-up commits on `task/agent-platform-code-tools.5`; the bespoke IDE folder tree work is paused for a separate product/architecture rethink.
- Disabled critic/DoD evaluator nodes in the user-facing runtime chat graph for now, so the main assistant response is the only model output streamed back to chat.
- Added API regression coverage proving the chat runtime does not run DoD criteria-generation prompts and does not persist streamed criteria JSON as the assistant response.
- Created Beads follow-up `agent-platform-ide-rethink` with spec `docs/tasks/agent-platform-ide-rethink.md` for deciding whether to keep the bespoke browser IDE, integrate a proven editor/file browser, or rely on repository tools plus external IDE workflows.

### Quality-gate follow-ups completed

- Fixed quality-gate package filters so chat agents can send workspace paths like `apps/web` or `packages/harness`; the tool normalizes those paths to scoped pnpm package names before running allowlisted profiles.
- Fixed the GitHub Actions unit-test failure where `qualityGateTool.test.ts` only looked for Homebrew/system pnpm locations; tests now resolve absolute `npm_execpath` or `PNPM_HOME/pnpm` before local fallback paths.
- Latest `.5` pipeline was green after commit `8e27369`.

### Repository discovery tools implemented

- Added low-risk built-in tools `sys_repo_map` / `repo_map`, `sys_code_search` / `code_search`, and `sys_find_related_tests` / `find_related_tests`.
- Repository discovery uses a bounded Node walker, skips symlinks, excludes ignored directories such as `.git`, `.agent-platform`, `.next`, `dist`, `coverage`, `node_modules`, and `test-results`, and enforces workspace scoping through PathJail dispatch checks.
- `repo_map` returns bounded file summaries, package boundaries, detected test directories, ignored directory names, total counts, and truncation state.
- `code_search` supports literal and explicit regex search with bounded file bytes, result counts, snippets, line/column locations, and structured search evidence.
- `find_related_tests` maps source files to likely tests by basename and repository proximity, returning bounded structured evidence.
- Added shared contracts, schema round-trip coverage, harness tool tests, MCP shadowing protection, docs, and system tool registration.

### Coding tool visibility follow-up started

- Manual chat testing against `/workspace/scratch/demo-app` proved the `.6` repo discovery tools work when the target app is inside the runtime workspace.
- Finding: recoverable tool failures such as `WRITE_FAILED` / `ENOENT` were being surfaced as global chat errors even when the agent recovered and completed the task.
- Finding: streamed `tool_result` events were appended into the assistant's final markdown answer, leaving large tool-call JSON blocks permanently visible.
- Started `.7` and changed the web chat stream parser so tool-call placeholders, tool results, and recoverable tool errors are tracked as tool activity instead of answer text.
- Added a compact tool activity block that is open while streaming and collapses by default after the assistant answer completes, while remaining expandable for auditability.
- Pipeline checks passed green on `task/agent-platform-code-tools.7`.
- Closed `.7` in Beads; `agent-platform-code-tools` auto-closed with all seven child tasks complete.
- Captured `agent-platform-active-project` as a follow-up for active project defaults so users do not need to type `/workspace/...` paths in normal coding workflows.
- Captured `agent-platform-context-optimisation` as a follow-up for context window management and token-budget optimisation. This should be picked up after the memory epic has short-term working memory and prompt memory bundle foundations.
- Captured `agent-platform-llm-observability-export` as a follow-up for vendor-neutral LLM observability export strategy. The intended direction is platform-native canonical events first, optional Phoenix/Langfuse/Helicone-style export adapters later.
- Captured `agent-platform-improvement-goals` as a follow-up for monitored goals and reviewed self-improvement candidates. First pass should start with one narrow objective and no autonomous changes.
- Added Beads memory `when-creating-new-epics-schedule-or-explicitly-run`: new epics should have a refinement session with the owner before implementation, including ticket/spec review, requirement changes, tradeoff discussion, and moving from refinement/planning to ready only after that review.

### Memory epic started

- Confirmed `agent-platform-code-tools` is closed with all seven child tasks complete.
- Created and pushed `feature/agent-platform-memory` from the updated `main`.
- Created `task/agent-platform-memory.1` from the memory feature branch.
- Created memory child specs:
  - `docs/tasks/agent-platform-memory.1.md`
  - `docs/tasks/agent-platform-memory.2.md`
  - `docs/tasks/agent-platform-memory.3.md`
  - `docs/tasks/agent-platform-memory.4.md`
  - `docs/tasks/agent-platform-memory.5.md`
  - `docs/tasks/agent-platform-memory.6.md`
  - `docs/tasks/agent-platform-memory.7.md`
- Created matching Beads child tasks, linked them under `agent-platform-memory`, chained dependencies from `.1` through `.7`, claimed `agent-platform-memory.1`, and synced Beads/Dolt.
- Long-term memory planning decision: v1 should use a relational SQLite/Postgres-compatible memory table with scope, kind, review status, confidence/source metadata, tags/metadata, expiry, and optional `memory_links` for graph-like relationships. Do not introduce a graph database initially; consider vector search or graph traversal later if retrieval needs prove it.
- Added Beads memory `memory-epic-planning-decision-start-long-term-memory` with this direction.

## Current state

### Git

- **Current branch:** `task/agent-platform-project-onboarding.7`
- **Current base:** chained from the completed onboarding task tips; PR target is `feature/agent-platform-project-onboarding`.
- **Current work:** PR #156 is refreshed green after the browser-picked Project assessment context follow-up.
- **Remote sync:** Branch is pushed to origin; only final Beads/session bookkeeping may need a final Git push if modified. `output/` remains an unrelated untracked artifact.

### Beads

- `agent-platform-project-workspaces` is closed in Beads.
- `agent-platform-project-workspaces.1` through `.6` are closed.
- `agent-platform-project-onboarding` is open and refined to treat Project as a generic folder/work context with coding/file-changing behavior as a profile/capability.
- `agent-platform-project-onboarding.1` through `.6` are closed.
- `agent-platform-project-onboarding.7` is closed after browser-picked Project assessment context cleanup and refreshed PR verification.
- `agent-platform-project-experience` is open as a P1 follow-up epic after onboarding, with child tasks `.1` through `.6` covering Project profiles, left explorer navigation, project-chat-first entry, optional IDE handoff, label cleanup/breadcrumbs, and Playwright navigation E2E.
- `agent-platform-code-workbench.6` is closed.
- `agent-platform-code-workbench.7` is deliberately deferred until 2026-05-20.
- `agent-platform-browser-tools` is closed locally.
- `agent-platform-browser-tools.1` is closed locally.
- `agent-platform-browser-tools.2` is closed locally.
- `agent-platform-browser-tools.3` is closed locally.
- `agent-platform-browser-tools.4` is closed locally.
- `agent-platform-browser-tools.5` is closed locally.
- `agent-platform-feedback-sensors` is closed locally.
- `agent-platform-feedback-sensors.1` is closed.
- `agent-platform-feedback-sensors.2` is closed.
- `agent-platform-feedback-sensors.3` is closed.
- `agent-platform-feedback-sensors.4` is closed.
- `agent-platform-feedback-sensors.5` is closed.
- `agent-platform-feedback-sensors.6` is closed locally.
- `agent-platform-branch-feedback-status` is open as a P2 follow-up epic with spec `docs/tasks/agent-platform-branch-feedback-status.md`.
- `agent-platform-operator-experience` is open as a P2 follow-up epic with spec `docs/tasks/agent-platform-operator-experience.md`.
- Specs exist under `docs/tasks/agent-platform-feedback-sensors*.md` and now cover capability discovery, agent-scope/profile policy, normalized findings, IDE/problem and IDE/plugin terminal feedback, SonarQube/CodeQL/GitHub feedback, Docker/container/sandbox limitations, provider auth states, pre-push validation, and post-push feedback import.
- `agent-platform-session-handoff-hygiene` is open as a P2 task and blocks `agent-platform-context-optimisation`.
- `agent-platform-ui-quality-sensors` is open as a P2 epic with parent spec only; child specs are pending refinement.
- Per stored memory, schedule or explicitly run owner refinement before moving this epic from planning/refinement to implementation-ready.

### Quality

- Latest `agent-platform-project-onboarding.7` follow-up local gates passed:
  - `pnpm --filter @agent-platform/web test -- test/file-context.test.ts`
  - `pnpm --filter @agent-platform/web run typecheck`
  - `pnpm --filter @agent-platform/web run lint`
  - `pnpm --filter @agent-platform/web run build`
  - `pnpm format:check`
  - `pnpm typecheck`
  - `pnpm lint`
  - elevated `pnpm test`
  - full elevated `BASE_URL=http://127.0.0.1:3001 API_URL=http://127.0.0.1:3000 pnpm run test:e2e` (25 passed) after `make restart` restored stopped services without resetting data
  - `git diff --check`
  - PR #156 Sonar issue query: 0 open/confirmed issues
  - PR #156 refreshed checks: verify, docker, e2e, markdownlint, lychee, GitGuardian, and SonarCloud all passed; review-thread sweep found none
- Previous `agent-platform-project-onboarding.7` follow-up local gates passed:
  - `pnpm --filter @agent-platform/web test -- test/use-harness-chat.test.ts test/code-workbench-branch-summary.test.ts`
  - `pnpm typecheck`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm build`
  - elevated `pnpm test`
  - full elevated `BASE_URL=http://127.0.0.1:3001 API_URL=http://127.0.0.1:3000 pnpm run test:e2e` (25 passed)
  - pre-push web build/typecheck/tests
  - PR #156 refreshed checks: verify, docker, e2e, markdownlint, lychee, GitGuardian, Sourcery, and SonarCloud all passed
  - PR #156 Sonar issue query: 0 open/confirmed issues; review-thread sweep found none. Sonar Agentic Analysis remains unavailable because the org has not enabled it.
- Latest `agent-platform-project-onboarding.1` local gates passed:
  - `pnpm --filter @agent-platform/contracts run test -- test/projectOnboarding.test.ts test/project.test.ts`
  - `pnpm --filter @agent-platform/contracts run typecheck`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm docs:lint`
  - `git diff --check`
  - `pnpm build`
  - `pnpm test` with elevated permissions for local browser/server integration tests after the sandboxed run hit browser integration hook timeouts
- Latest `agent-platform-project-onboarding.2` local gates passed:
  - `pnpm --filter @agent-platform/api run typecheck`
  - `pnpm --filter @agent-platform/web run typecheck`
  - `pnpm --filter @agent-platform/api exec vitest run test/projectsRouter.test.ts` with elevated local binding
  - `pnpm --filter @agent-platform/web run test -- test/project-onboarding-assessment-panel.test.ts`
  - `pnpm --filter @agent-platform/api run lint`
  - `pnpm --filter @agent-platform/web run lint`
  - `pnpm --filter @agent-platform/api run build`
  - `pnpm --filter @agent-platform/web run build`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm docs:lint`
  - `git diff --check`
  - `pnpm build`
  - `pnpm test` with elevated local server/browser permissions
- Latest `agent-platform-project-workspaces.3` gates passed:
  - `pnpm format:check`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm --filter @agent-platform/contracts run test -- test/project.test.ts`
  - `pnpm --filter @agent-platform/contracts run build`
  - `pnpm --filter @agent-platform/api exec vitest run test/projectsRouter.test.ts`
  - `pnpm --filter @agent-platform/web run typecheck`
  - `pnpm --filter @agent-platform/api run typecheck`
  - `pnpm --filter @agent-platform/web run lint`
  - `pnpm --filter @agent-platform/api run lint`
  - targeted Playwright `Project path binding`
  - targeted Playwright `e2e/mvp-e2e.spec.ts e2e/input-selectors.spec.ts`
  - pre-push affected-package `build`, `typecheck`, and `test`
- PR #145 final remote gates passed:
  - `verify`
  - `docker`
  - `e2e`
  - `markdownlint`
  - `lychee`
  - `GitGuardian Security Checks`
  - `SonarCloud Code Analysis`
  - `Sourcery review`
- SonarCloud PR #145 reports 0 new issues and 0 security hotspots. GitHub review-thread sweep returned no review threads.
- Earlier `agent-platform-project-workspaces.1` gates passed:
  - `pnpm --filter @agent-platform/contracts run test -- test/project.test.ts`
  - `pnpm --filter @agent-platform/contracts run typecheck`
  - `pnpm --filter @agent-platform/contracts run test`
  - `pnpm --filter @agent-platform/contracts run lint`
  - `pnpm format:check`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm test` with escalation for browser integration local fixture servers
  - `pnpm exec markdownlint-cli2 docs/architecture.md`
- Latest review-fix gates passed:
  - `pnpm --filter @agent-platform/contracts run test -- test/project.test.ts`
  - `pnpm --filter @agent-platform/contracts run typecheck`
  - `pnpm --filter @agent-platform/contracts run lint`
  - `pnpm format:check`
  - pre-push affected-package `build`, `typecheck`, and `test`
- PR #143 final remote gates passed:
  - `verify`
  - `docker`
  - `e2e`
  - `markdownlint`
  - `lychee`
  - `GitGuardian Security Checks`
  - `SonarCloud Code Analysis`
  - `Sourcery review`
- `pnpm docs:lint` still fails on ignored local workspace Markdown under `.agent-platform/workspaces/default/...`; touched tracked docs pass markdownlint directly.
- Latest full-page browser screenshot handling gates passed:
  - `pnpm --filter @agent-platform/web run typecheck`
  - `pnpm --filter @agent-platform/web run lint`
  - `pnpm --filter @agent-platform/web run test`
  - `pnpm --filter @agent-platform/web run build`
  - `pnpm --filter @agent-platform/harness exec vitest run test/browserTools.test.ts`
  - `pnpm --filter @agent-platform/harness run typecheck`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm --filter @agent-platform/harness run build`
  - `pnpm format:check`
  - `git diff --check`
- Latest browser screenshot viewer gates passed:
  - `pnpm --filter @agent-platform/web run typecheck`
  - `pnpm --filter @agent-platform/web run lint`
  - `pnpm --filter @agent-platform/web run test`
  - `pnpm --filter @agent-platform/web run build`
  - `pnpm format:check`
  - `git diff --check`
- Latest browser runtime ENOSPC hardening gates passed:
  - `pnpm --filter @agent-platform/harness exec vitest run test/browserTools.test.ts`
  - `pnpm --filter @agent-platform/harness run typecheck`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm --filter @agent-platform/harness run build`
  - `pnpm format:check`
  - `pnpm exec markdownlint-cli2 docs/development.md`
  - `git diff --check`
- Latest browser approval resume fix gates passed:
  - `pnpm --filter @agent-platform/api exec vitest run test/sessionChat.integration.test.ts`
  - `pnpm --filter @agent-platform/api run typecheck`
  - `pnpm --filter @agent-platform/api run lint`
  - `pnpm --filter @agent-platform/api run build`
  - `pnpm format:check`
  - `git diff --check`
- Browser-tools `.1-.4` gates passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - harness/contracts/web/API tests listed in the latest session entry
  - touched-doc markdownlint
  - `git diff --check`
- Browser-tools `.5` gates passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`
  - `pnpm test:e2e` after applying `E2E_SEED=1`
  - focused harness browser integration test
- Latest `.6` gates passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`
  - focused API sensor dashboard integration test
  - focused Playwright sensor drawer test
- `pnpm docs:lint` is blocked by ignored generated workspace content under `.agent-platform`; tracked docs pass with `.agent-platform` excluded.
- After the `main` merge, focused API/contracts checks plus root typecheck/lint passed.

---

## Next (priority order)

1. Commit and push the final Beads/session bookkeeping for the `.7` re-close if not already pushed.
2. Owner manually tests PR #156 / `task/agent-platform-project-onboarding.7`.
3. If manual testing finds more issues, patch them on the same branch/PR and rerun local + PR gates.
4. If manual testing passes, decide whether to merge the onboarding task chain into `feature/agent-platform-project-onboarding`.
5. Keep parent epic `agent-platform-project-onboarding` open until owner manual-test closeout and end-of-epic merge decision.

---

## Blockers / questions for owner

- SonarQube MCP tools and IDE Problems were not exposed in this session; fallback typecheck/lint/test/E2E gates passed.
- Beads Dolt auto-push can fail in the sandbox due GitHub DNS/auth; rerun `bd dolt push` with elevated access after Beads changes.
- SonarQube CLI issue and hotspot listing works with elevated access; SonarQube MCP tools are still not exposed in the current tool surface.

---

## Key references

| Document                                  | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `docs/architecture.md`                    | System design, package roles, data flow    |
| `docs/architecture/message-flow.md`       | Mermaid diagrams: chat → LLM → tools       |
| `docs/api-reference.md`                   | REST endpoints, error shapes, schemas      |
| `docs/configuration.md`                   | Env vars, model routing, limits, MCP setup |
| `docs/workspace-storage.md`               | Workspace setup, security, cleanup, tests  |
| `docs/planning/lazy-skill-loading.md`     | Lazy skill pattern (planning reference)    |
| `docs/architecture/lazy-skill-loading.md` | Lazy skill loading implementation guide    |
| `docs/planning/security.md`               | Threat model (8 categories)                |
| `docs/tasks/agent-platform-hitl.md`       | Completed HITL epic                        |
| `docs/tasks/agent-platform-hitl.5.md`     | Final completed HITL frontend task         |
| `docs/tasks/agent-platform-ws.md`         | Planned workspace storage epic             |
| `docs/planning/frontend-ui-phases.md`     | Frontend UI phased plan (unblocked)        |
| `docs/tasks/`                             | Task spec files                            |

---

## Quick commands

```bash
make up          # Docker build + start + seed
make restart     # Rebuild + restart (keeps DB)
make reset       # Wipe DB + rebuild + reseed
pnpm test        # Vitest unit tests
pnpm typecheck   # TypeScript across all packages
pnpm lint        # ESLint (max-warnings 0)
```

---

## UI/UX Ticket Specifications (manual beads reference)

### 1. Display a thinking block with model logic before streaming the answer -completed

**Requirements:**

- When a user sends a message, a "thinking" block should appear in the chat UI before the agent's answer begins streaming.
- The "thinking" block must clearly indicate the agent/model is processing, using a visual distinct from the final answer.
- The block should disappear as soon as the agent's answer starts streaming.
- The implementation must not block or delay the streaming of the actual answer.
- The design should be consistent with the rest of the chat UI (bright, clean, minimalistic).
  **Definition of Done:**
- Thinking block appears before agent response and disappears on stream start.
- Playwright test covers this interaction.
- SonarQube/Problems show no new issues in touched files.

### 2. Refactor sidebar: only show Chat/IDE, move other items to Settings, remove Sessions/Tools

Tracked in Beads: `agent-platform-ucg`

### 3. Remove sessions sidebar, move sessions under menu as collapsible agent dropdowns

Tracked in Beads: `agent-platform-7d1`

### 4. Update chat UI: show only feedback block for agent responses, remove agent bubble, keep user bubble

Tracked in Beads: `agent-platform-de4`

### 5. Refactor input bar controls into unified chat input

Tracked in Beads: `agent-platform-lt6`

---

## 2026-05-04 Browser Tools SonarCloud Follow-Up

- PR 137 SonarCloud reported 16 security hotspots and 6 maintainability issues on `task/agent-platform-browser-tools.5`.
- Fixed the hotspot cluster by removing browser launch reliance on `TMPDIR`/`TMP`/`TEMP`; Playwright now receives explicit workspace-backed artifact, download, trace, and user-data directories.
- Updated browser tests to use workspace-backed scratch directories instead of OS temp directories where this branch touches them.
- Replaced the insecure `http://web:3001` policy test URL with `https://web:3001`.
- Cleaned Sonar code-smell findings: nested ternary labels/actions, in-place sort in response construction, repeated `push`, redundant role assertion, and `filter().at(0)`.
- Verification completed: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `git diff --check`, focused browser/contract tests, browser integration test with local-server escalation, and full `pnpm test` with local-server escalation all pass.
- SonarQube CLI file-level `sonar verify` could not run because SonarCloud returned `403` for A3S analysis not being activated in the organization; final Sonar status requires the pushed PR analysis rerun.

## 2026-05-05 Skill Authoring Direction

- Created Beads epic `agent-platform-skill-authoring` with spec `docs/tasks/agent-platform-skill-authoring.md`.
- Direction: move beyond DB-backed skill prompt records toward governed skill packages that may include instructions, tool dependencies, scripts, references, assets, examples, tests, and policy metadata.
- Product goal: users describe the desired capability in natural language, then an agent collaborates with them to design, scaffold, validate, and activate the skill under harness security and approval constraints.
- Key constraint: skill-owned scripts/functions must not bypass sandboxing, path jail, approval, observability, or capability assignment controls.

## 2026-05-07 Project Workspace Onboarding Gate

- Task `agent-platform-project-workspaces.5` adds AGENTS.md discovery, approval metadata, prompt context injection, and write-tool gating for Project-bound sessions.
- Root `AGENTS.md` is required before Project writes unlock; changed instruction file hashes move onboarding back to `needs_review`.
- Read-only inspection remains available before approval; write tools, mutating shell, and patch tools are hidden from the model and denied if invoked.
- Verification completed locally: format, typecheck, lint, build, full unit tests, docs lint, Docker rebuild/seed, and Playwright e2e all pass.
- SonarQube CLI authentication works, but file-level `sonar verify` returns SonarCloud `403` because Agentic Analysis is not activated for the organization; PR SonarCloud remains the required remote quality gate.

## 2026-05-07 Project Onboarding Assessment

- Task `agent-platform-project-onboarding.2` adds deterministic Project assessment contracts, API assessment/open integration, and an IDE assessment panel.
- PR 151 CI exposed a non-git workspace regression: assessment display metadata included an undefined branch label, causing project-open request validation to fail in Docker E2E.
- Fixed assessment display metadata to omit unknown branch labels and added a plain-folder API regression test.
- Updated the Project workspace E2E assertions to match the new assessment flow: incomplete or missing onboarding now reports `in_progress` until approved.
- SonarCloud PR sweep identified command inference complexity and nested template literals; refactored command construction into focused helpers.

## 2026-05-12 Electron Foundation `.4`

- Task `agent-platform-electron-foundation.4` resolves desktop runtime paths through Electron OS path APIs instead of defaulting desktop storage to repository-relative directories.
- Desktop app data/config/data now resolve from `app.getPath('userData')`; logs resolve from `app.getPath('logs')`; runtime scratch/temp resolves from `app.getPath('temp')`.
- The managed desktop backend receives explicit SQLite, runtime config, stdout log, and stderr log paths from the runtime path resolver.
- Docker development and CI storage remain unchanged. Environment overrides remain available for development and tests.
- Uninstall/reset cleanup remains future work: delete app metadata, SQLite/config/log/temp state, and stored credentials, but do not delete user Project folders.
- Local verification passed:
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop smoke:backend`
  - `pnpm --filter @agent-platform/desktop smoke`
  - `pnpm --filter @agent-platform/desktop smoke:renderer`
  - `pnpm format:check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm docs:lint`
  - `git diff --check`
  - focused rerun of the transient API timeout test
  - `pnpm test`
- SonarQube MCP tools were not exposed in the current tool surface after discovery; local fallback completion gates passed. Final Sonar/Promptfoo/CI status still requires the pushed PR.
- PR #167 initially failed SonarCloud rule `typescript:S5443` in `apps/desktop/test/runtimePaths.test.ts`; the test was patched to use private `mkdtempSync` paths instead of hardcoded public temp paths.
- PR #167 is now clean: `verify`, `docker`, `e2e`, docs lint/link checks, GitGuardian, and SonarCloud all passed. Sonar reports 0 open issues. Sourcery was skipped due the account rate limit and posted no actionable code comments.

## 2026-05-12 Electron Foundation `.5`

- Task `agent-platform-electron-foundation.5` closed on
  `task/agent-platform-electron-foundation.5`.
- Added `docs/desktop-runtime.md` to document the Docker versus Electron runtime split, current
  desktop commands, app data/log/config locations, troubleshooting, cleanup expectations, and
  macOS-first limitations.
- Updated `docs/development.md`, `README.md`, and the Electron foundation epic/task specs to point
  developers toward the desktop workflow without changing the default Docker development path.
- PR #168 is clean: `verify`, `docker`, `e2e`, docs lint/link checks, GitGuardian, and SonarCloud
  all passed. Sonar reports 0 open issues. Sourcery was skipped due the account rate limit and
  posted no actionable code comments.

## 2026-05-12 Electron Security `.1`

- Created the six child tasks under `agent-platform-electron-security` and claimed
  `agent-platform-electron-security.1`.
- Task `.1` locks the baseline desktop window security posture before native Project access is
  added.
- Electron shell hardening added:
  - explicit secure `BrowserWindow` web preferences,
  - DevTools disabled unless `AGENT_PLATFORM_DESKTOP_DEVTOOLS=1`,
  - renderer popup denial,
  - top-level navigation constrained to the active renderer origin,
  - webview attachment denial,
  - restrictive CSP for the bootstrap data URL.
- Local verification passed so far:
  - `pnpm --filter @agent-platform/desktop test -- test/windowConfig.test.ts`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop build`
  - `pnpm --filter @agent-platform/desktop smoke`
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `git diff --check`
  - `pnpm test`
- Remaining closeout for `.1`: commit, push, open PR, monitor CI/Sonar/review comments, then close
  the Beads task only after the remote gates are clear.

## 2026-05-12 Electron Security `.2`

- Task `agent-platform-electron-security.2` completed on
  `task/agent-platform-electron-security.2`.
- Added an explicit typed preload bridge contract:
  - global API name: `agentPlatformDesktop`,
  - current root key: `versions`,
  - no generic IPC, filesystem, shell, path, or process API is exposed to the renderer.
- Added reusable main-process IPC validation helpers for no-payload channels, typed payload
  validators, and trusted sender checks.
- There are still no production IPC channels; this task establishes the safe pattern before native
  desktop APIs are added.
- Local verification passed so far:
  - `pnpm --filter @agent-platform/desktop test -- test/ipcValidation.test.ts test/preloadContract.test.ts`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop build`
  - `pnpm --filter @agent-platform/desktop smoke`
  - `pnpm format:check`
  - `pnpm docs:lint`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `git diff --check`
  - `pnpm test`
- PR #170 is clean: `verify`, `docker`, `e2e`, docs checks, GitGuardian, and SonarCloud all
  passed. SonarCloud reports 0 new issues after the minor test assertion cleanup. Sourcery was
  skipped due the account rate limit and posted no actionable inline comments.
- Next task is `agent-platform-electron-security.3`: move desktop SQLite/config usage to app data
  paths.

## 2026-05-12 Electron Security `.3`

- Task `agent-platform-electron-security.3` started on
  `task/agent-platform-electron-security.3`.
- Tightened the desktop app-data contract:
  - desktop SQLite overrides now use `AGENT_PLATFORM_DESKTOP_SQLITE_PATH`,
  - generic Docker/API `SQLITE_PATH` is ignored while resolving desktop app data,
  - the managed backend child still receives `SQLITE_PATH` after Electron resolves the desktop
    path.
- The managed backend environment now receives resolved desktop config, data, log, and temp paths.
- First-run behavior is documented: desktop creates app-data directories and does not migrate
  Docker `/data/agent.sqlite` automatically.
- Local verification passed:
  - `pnpm --filter @agent-platform/desktop test -- test/runtimePaths.test.ts test/backendSupervisor.test.ts`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop smoke:backend`
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `git diff --check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
- PR #175 passed GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and
  SonarCloud. SonarCloud reported 0 new issues and 0 security hotspots. Sourcery skipped because the
  PR diff exceeded the account review limit and posted no actionable inline comments.
- PR #174 passed GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and
  SonarCloud. SonarCloud reported 0 new issues and 0 security hotspots. Sourcery skipped because the
  PR diff exceeded the account review limit and posted no actionable inline comments.

## 2026-05-12 Electron Project Access `.1`

- Branch `task/agent-platform-electron-project-access.1` started from the completed Electron
  security chain.
- Created child task specs for `agent-platform-electron-project-access.{1-8}` and linked the Beads
  dependency chain.
- Task `agent-platform-electron-project-access.1` claimed and implemented:
  - added `projects.selectFolder()` to the typed desktop preload bridge,
  - added dedicated Project folder picker IPC channel `agent-platform:select-project-folder`,
  - added main-process native folder picker handling with trusted-sender/no-payload validation,
  - normalized native folder selection into Project metadata and treated cancellation as non-error,
  - kept the bridge narrow with no generic filesystem, shell, path, or raw IPC exposure.
- Local verification passed:
  - `pnpm --filter @agent-platform/desktop test -- test/projectFolderPicker.test.ts test/preloadContract.test.ts test/ipcValidation.test.ts`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop smoke`
  - `pnpm --filter @agent-platform/desktop smoke:backend`
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `git diff --check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
- PR #172 passed GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and
  SonarCloud. SonarCloud reported 0 new issues and 0 security hotspots. Sourcery skipped because the
  PR diff exceeded the account review limit and posted no actionable inline comments.

## 2026-05-12 Electron Experience `.3`

- Task `agent-platform-electron-experience.3` started on
  `task/agent-platform-electron-experience.3`.
- Made Project chat the default desktop Project entry:
  - desktop Project selection now opens a Project-bound chat session on the home surface,
  - recent Projects in the left explorer reopen into Project chat,
  - Project chat exposes `Open IDE` as the optional deeper workspace,
  - the first Project chat message is sent through the Project session binding,
  - normal chat remains separate from Project chat.
- Added shared desktop Project helpers for folder selection, Project registration, recent Project
  loading, and Project session binding.
- Updated browser and Electron E2E coverage for chat-first Project opening and IDE continuation.
- Local verification passed:
  - `pnpm --filter @agent-platform/web exec vitest run test/project-navigation.test.ts test/project-onboarding-assessment-panel.test.ts`
  - `pnpm --filter @agent-platform/web run lint`
  - `pnpm --filter @agent-platform/web run typecheck`
  - `pnpm --filter @agent-platform/web run test`
  - `pnpm exec playwright test -c e2e/playwright.config.ts e2e/ide-project-opening-parked.spec.ts`
  - `pnpm --filter @agent-platform/desktop run test:e2e`
  - `pnpm docs:lint`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm format:check`
  - `pnpm run test:e2e`
  - `git diff --check`
  - `sh .husky/pre-push`

## 2026-05-15 Electron Stabilisation `.15`

- Task `agent-platform-electron-stabilisation.15` started on
  `task/agent-platform-electron-stabilisation.15`.
- Updated slash command help to render from reusable command metadata as readable Markdown entries:
  - `/help` now lists commands as separate entries with usage, scope, and state effect,
  - `/help init` now shows focused usage, selected-Project scope, and setup side-effect guidance,
  - the formatter is API-side and can be reused by non-chat surfaces later.
- Added a Gherkin E2E strategy to
  [agent-platform-electron-stabilisation.15.md](docs/tasks/agent-platform-electron-stabilisation.15.md).
- Updated Electron Playwright coverage so Project Chat and IDE assistant `/help` output are checked
  through the real UI flow.
- Local verification passed:
  - `pnpm --filter @agent-platform/api test -- slashCommands.test.ts sessionChat.integration.test.ts`
  - `pnpm --filter @agent-platform/api typecheck`
  - `pnpm --filter @agent-platform/api lint`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop run test:e2e -- e2e/project-access.e2e.ts`
- PR #219 passed GitHub `verify`, `docker`, `e2e`, `desktop-e2e`, docs `markdownlint`/`lychee`,
  GitGuardian, and SonarCloud. Sourcery skipped because the account weekly diff limit was reached and
  posted no actionable inline comments. The PR was merged into
  `feature/agent-platform-electron-stabilisation`, and Beads task `.15` was closed.

## 2026-05-16 Project Git and GitHub Panel

- Task `agent-platform-za3` started on `task/agent-platform-project-git-github-panel`.
- Added the first Project Git/GitHub side panel shell:
  - API now exposes local Git status for a Project, including repository name, origin remote,
    current/upstream branch, ahead/behind counts, working tree summary, recent commit, and GitHub
    remote detection.
  - Web Project Chat can render a collapsible right-side Git & GitHub panel with Overview, Changes,
    Commits, PRs, and Checks tabs.
  - The legacy Sensors rail is hidden in Project Chat so Git/GitHub state has a single right-side
    home.
  - PRs and Checks are explicit placeholders until GitHub sensors are wired; the panel does not
    infer unavailable remote state.
  - Electron E2E coverage verifies the panel appears for Project Chat and reacts to local Git changes.
- Focused verification passed:
  - `pnpm --filter @agent-platform/contracts test -- test/project.test.ts`
  - `pnpm --filter @agent-platform/api test -- test/projectsRouter.test.ts`
  - `pnpm --filter @agent-platform/api typecheck`
  - `pnpm --filter @agent-platform/web typecheck`
  - `pnpm --filter @agent-platform/web lint`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop test:e2e`
  - `pnpm format:check`
  - `git diff --check`

## 2026-05-12 Electron Security `.5`

- Task `agent-platform-electron-security.5` started on
  `task/agent-platform-electron-security.5`.
- Added the desktop local-data reset service and maintenance preload bridge:
  - reset requires exact confirmation text `DELETE LOCAL APP DATA`,
  - main-process IPC validates trusted sender and payload shape,
  - reset stops the managed backend before deleting app-owned data,
  - reset deletes config/data/log/temp runtime directories and recreates empty directories,
  - user Project folders are outside the deletion scope and preserved by default.
- Local verification passed:
  - `pnpm --filter @agent-platform/desktop test -- test/localDataReset.test.ts test/preloadContract.test.ts test/ipcValidation.test.ts`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop smoke:backend`
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `git diff --check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
- PR #173 passed GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`, GitGuardian, and
  SonarCloud. SonarCloud reported 0 new issues and 0 security hotspots. Sourcery skipped because the
  PR diff exceeded the account review limit and posted no actionable inline comments.

## 2026-05-12 Electron Security `.4`

- Task `agent-platform-electron-security.4` started on
  `task/agent-platform-electron-security.4`.
- Implemented the first desktop secret-storage boundary:
  - model/provider credentials still persist through encrypted API `secret_refs`,
  - Electron now creates or loads the desktop `SECRETS_MASTER_KEY` via OS-backed `safeStorage`,
  - the managed backend receives the resolved master key through its private environment,
  - the renderer does not receive the master key or secret-storage API.
- Documented fail-closed behavior when OS secure storage is unavailable and no explicit
  development/test `SECRETS_MASTER_KEY` is configured.
- Local verification passed:
  - `pnpm --filter @agent-platform/desktop test -- test/secretStorage.test.ts test/runtimePaths.test.ts test/backendSupervisor.test.ts`
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop smoke:backend`
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `git diff --check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`

## 2026-05-12 Electron Security `.6`

- Task `agent-platform-electron-security.6` started on
  `task/agent-platform-electron-security.6`.
- Expanded desktop regression coverage for the completed Electron security/data lifecycle work:
  - renderer navigation and webview guards now assert runtime prevention behavior,
  - preload bridge tests cover the explicit maintenance IPC channel surface,
  - local-data reset tests cover malformed payloads, missing app-owned paths, Project-folder
    preservation, and protected credential key deletion,
  - secret storage tests reject malformed explicit master keys.
- Documented the current package-test coverage matrix and the remaining packaged Electron E2E gaps
  in [Desktop Runtime](docs/desktop-runtime.md).
- Focused verification passed:
  - `pnpm --filter @agent-platform/desktop test -- test/windowConfig.test.ts test/preloadContract.test.ts test/ipcValidation.test.ts test/localDataReset.test.ts test/secretStorage.test.ts`
- Local gates passed:
  - `pnpm --filter @agent-platform/desktop typecheck`
  - `pnpm --filter @agent-platform/desktop lint`
  - `pnpm --filter @agent-platform/desktop test`
  - `pnpm --filter @agent-platform/desktop smoke:backend`
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `git diff --check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
