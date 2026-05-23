# Task: Stabilisation closeout and next-epic gate

**Beads issue:** `agent-platform-electron-stabilisation.12`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.12.md`

## Summary

Close the Electron stabilisation effort by confirming the chat-first Project flow, rerunning the
manual QA checklist, checking automated regression coverage, and deciding whether follow-on Project
Experience or release work can start.

## Requirements

- Confirm blocker tasks for Project Chat, Project binding, slash commands, Recent Projects, and
  user-facing copy are complete or explicitly parked with owner approval.
- Confirm generated preview and external/default IDE handoff design is documented.
- Confirm the revised product direction is documented: Project Chat remains primary, no further
  built-in IDE investment, branch selection and terminal dock move into Project Experience.
- Rerun the Electron manual QA checklist against the stabilisation branch.
- Confirm automated Electron/browser E2E coverage exists or has explicit follow-up tasks.
- Record the final merge/release recommendation.

## Closeout Review

### Stabilisation task status

| Area                            | Task                                       | Outcome                                                                                                                |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Development workflow            | `agent-platform-electron-stabilisation.1`  | Closed; Electron development workflow is documented.                                                                   |
| Manual QA checklist             | `agent-platform-electron-stabilisation.2`  | Closed; repeatable checklist exists in `docs/qa/electron-project-experience-manual-qa.md`.                             |
| Finding triage                  | `agent-platform-electron-stabilisation.3`  | Closed; owner QA findings are classified and mapped to Beads.                                                          |
| Staging branch plan             | `agent-platform-electron-stabilisation.4`  | Closed; `feature/agent-platform-electron-stabilisation` is the integration branch.                                     |
| Regression coverage plan        | `agent-platform-electron-stabilisation.5`  | Closed; Electron/browser E2E gaps are mapped to follow-up tasks.                                                       |
| Chat-first navigation           | `agent-platform-electron-stabilisation.6`  | Closed through PR #208; Projects open into Project Chat and IDE is removed from the primary path.                      |
| Native Project binding          | `agent-platform-electron-stabilisation.7`  | Closed through PR #209; host folders bind as Projects without path entry or folder copying.                            |
| Project Chat and slash commands | `agent-platform-electron-stabilisation.8`  | Closed through PR #210; normal messages and `/help`, `/help init`, `/init` work with Project context.                  |
| Recent Projects                 | `agent-platform-electron-stabilisation.9`  | Closed through PR #211; Recent Projects is single, safer, and can reopen Projects.                                     |
| User-facing copy                | `agent-platform-electron-stabilisation.10` | Closed through PR #212; internal diagnostics are moved out of primary copy.                                            |
| IDE handoff and previews design | `agent-platform-electron-stabilisation.11` | Closed through PR #213; external/default IDE handoff, generated previews, and activity panel are scoped for follow-up. |

### Manual QA finding disposition

| Finding group                                             | Disposition                                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Stale or duplicated Recent Projects                       | Fixed in `.9`; follow-on integrated Project Experience E2E remains assigned to `agent-platform-project-experience.6`. |
| Open Project did not bind selected local folders          | Fixed in `.7`; Electron E2E covers native picker/test-bridge Project binding.                                         |
| Project Chat input and slash commands would not submit    | Fixed in `.8`; Electron E2E covers normal Project chat and slash command first messages.                              |
| Workspace chooser and IDE-first navigation were confusing | Fixed in `.6`; Project Chat is the default Project destination.                                                       |
| Backend/internal copy leaked into normal UI               | Fixed in `.10`; future UI work must keep raw diagnostics out of primary copy.                                         |
| Breadcrumbs/settings return navigation                    | Deferred to `agent-platform-project-experience.5`.                                                                    |
| External/default IDE handoff                              | Deferred to `agent-platform-project-experience.4`.                                                                    |
| Generated artifact previews                               | Deferred to `agent-platform-project-experience.7`.                                                                    |
| Right-side Project activity panel                         | Deferred to `agent-platform-project-experience.8`.                                                                    |
| Project Chat branch selector                              | Deferred to `agent-platform-project-experience.9`.                                                                    |
| Governed Project terminal dock                            | Deferred to `agent-platform-project-experience.10`.                                                                   |
| Image attachments rejected as text files                  | Mapped to `agent-platform-electron-stabilisation.14`.                                                                 |
| Duplicate Project names and Project session history       | Mapped to `agent-platform-project-experience.11`.                                                                     |
| Slash command help streams as one line                    | Mapped to `agent-platform-electron-stabilisation.15`.                                                                 |
| Personal Chat shows Project UI and stale context          | Mapped to `agent-platform-electron-stabilisation.16`.                                                                 |
| Full integrated desktop Project Experience pass           | Deferred to `agent-platform-project-experience.6`.                                                                    |

### Product direction after re-baseline

The post-stabilisation Product direction is:

- Project Chat is the default and primary Project surface.
- The built-in IDE should not receive further feature investment.
- Manual editing should hand off to the user's local/default IDE.
- Branch selection belongs in Project Chat.
- Terminal access belongs in Project Chat through a governed terminal dock using `node-pty` in
  Electron main, `xterm.js` in the renderer, and typed IPC.
- Generated HTML, Markdown, PDF, app, and document outputs should be previewed from Project Chat or
  the Project activity panel rather than requiring file-tree navigation.
- The `agent-platform-code-workbench` epic is deferred/re-scoped so it does not compete with the
  Project Chat-first direction.

### Automated gate status

The stabilisation branch has passed the normal task-level gates for the merged fix PRs:

- local docs lint and whitespace checks for documentation tasks;
- affected-package pre-push build, typecheck, and test gates for changed packages;
- GitHub `verify`, `docker`, browser `e2e`, desktop `desktop-e2e`, docs `markdownlint`/`lychee`,
  SonarCloud, and GitGuardian on the stabilisation task PRs;
- PR review-comment sweeps before task closure.

`agent-platform-electron-stabilisation.5` records the test ownership split and remaining coverage
gaps. Future Project UI tasks must include Electron E2E when they touch native folder selection,
Project binding, Recent Projects, external IDE handoff, desktop app data, or preload/main-process
behavior.

### Human sign-off status

Owner manual QA has **not** been rerun by the agent after the final stabilisation fixes. That is a
human gate, not an automated one.

Recommended state:

- The stabilisation feature branch is ready for owner manual QA using
  `docs/qa/electron-project-experience-manual-qa.md`.
- The manual QA checklist has been re-baselined so Project Chat is the proof path, the built-in file
  view is secondary/legacy, and branch selector/terminal/preview/activity work is tracked under
  Project Experience.
- Owner manual QA has confirmed the core Project Chat flow works when excluding the legacy built-in
  IDE path. Remaining findings are now mapped rather than left ambiguous:
  - image attachments belong to `agent-platform-electron-stabilisation.14`;
  - slash command help formatting belongs to `agent-platform-electron-stabilisation.15`;
  - Personal Chat state/chrome separation belongs to `agent-platform-electron-stabilisation.16`;
  - duplicate Project names and Project-scoped session history belong to
    `agent-platform-project-experience.11`.
- Do not merge `feature/agent-platform-electron-stabilisation` into `main` for release until the
  owner reruns or signs off the checklist.
- Follow-on Project Experience planning can proceed from the stabilised direction, but release/main
  promotion remains gated on owner QA.

### Merge and next-epic recommendation

Recommendation: keep `feature/agent-platform-electron-stabilisation` as the current stable
integration branch until owner manual QA is complete. If manual QA passes, merge the feature branch
to `main` and begin `agent-platform-project-experience.1`.

If manual QA finds more blocker regressions, create fix-forward tasks under this stabilisation epic
or the Project Experience epic depending on scope:

- regressions in already stabilised behavior stay in `agent-platform-electron-stabilisation`;
- planned enhancements such as breadcrumbs, external IDE handoff, previews, and activity panel stay
  in `agent-platform-project-experience`.

## Implementation Plan

1. Review stabilisation tasks `.3` through `.11`.
2. Confirm each manual QA finding is fixed, deferred, or accepted by the owner.
3. Rerun manual QA or capture owner manual QA sign-off.
4. Review CI/CD and required local gates.
5. Record whether the staging branch can merge, remain parked, or continue fix-forward work.

## Tests And Verification

- Manual QA checklist rerun or owner sign-off.
- Required local and CI gates from the completed fix tasks.
- `bd list --parent agent-platform-electron-stabilisation` shows all stabilisation work resolved or
  explicitly deferred.
- `pnpm docs:lint`
- `git diff --check`

## Definition Of Done

- Stabilisation blockers are resolved, deferred with owner approval, or converted into later epics.
- Chat-first Project flow is accepted as the basis for next work.
- Project Experience follow-up work is unblocked only after this closeout gate is satisfied.
- Merge/release recommendation is documented.
