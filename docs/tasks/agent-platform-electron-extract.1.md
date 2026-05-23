# Task: Audit current onboarding branch

**Beads issue:** `agent-platform-electron-extract.1`  
**Spec file:** `docs/tasks/agent-platform-electron-extract.1.md`  
**Parent epic:** `agent-platform-electron-extract` — Park and extract current onboarding work

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-extract.1.md`

## Task requirements

Audit the paused Project onboarding work and produce a concrete extraction decision record for the rest of this epic.

The audit must identify:

- architecture-neutral work that should be extracted now;
- browser-only or manual-path Project opening work that must be parked;
- tests that remain valid after the Electron decision;
- tests that accidentally lock in the rejected browser-only Project opening path;
- docs/spec updates needed before the Electron epics start.

This task should not implement the extraction. It should make the following tasks precise enough to execute safely.

## Dependency order

Execution order is enforced in Beads with `blocks` edges. Do not close this issue until every upstream task below is already closed.

### Upstream — must be complete before this task

| Issue | Spec |
| ----- | ---- |
| none  | none |

### Downstream — waiting on this task

| Issue                               | Spec                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-platform-electron-extract.2` | [Extract slash command infrastructure](./agent-platform-electron-extract.2.md)     |
| `agent-platform-electron-extract.3` | [Park browser-only Project opening](./agent-platform-electron-extract.3.md)        |
| `agent-platform-electron-extract.4` | [Re-scope onboarding and experience specs](./agent-platform-electron-extract.4.md) |

### Planning notes

If the audit discovers additional dependencies, add them here and update Beads with `bd dep add` so the tracker remains the schedule of record.

## Implementation plan

1. Inspect the current branch diff against the intended integration base.
2. Review changed web, hook, test, task spec, ADR, and session files.
3. Classify each changed area as keep, extract, park, or discard.
4. Identify the smallest safe extraction path for slash command infrastructure.
5. Identify tests that should move forward and tests that should be rewritten or removed.
6. Document the audit outcome in the task spec, session notes, or a dedicated planning note if the findings are too large for this spec.
7. Confirm downstream task scopes are still accurate; update them if needed.

## Audit outcome

Reviewed sources:

- committed `agent-platform-project-onboarding.8` changes since `task/agent-platform-project-onboarding.7`;
- current local working-tree changes on the paused onboarding branch;
- existing focused unit/integration/E2E test changes;
- desktop runtime decision in ADR-0002 and the Electron roadmap specs.

### Keep / extract

These changes are architecture-neutral enough to extract:

| Area                                             | Files                                                                                                | Decision                                                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slash command parser and invocation model        | `apps/api/src/application/slashCommands/parser.ts`, `types.ts`                                       | Keep. Parser treats leading `/command` messages as commands and leaves normal chat alone.                                                                      |
| Slash command registry and metadata              | `apps/api/src/application/slashCommands/registry.ts`, `builtin.ts`                                   | Keep. Registry metadata supports `/help`, future autocomplete, and swappable command sources.                                                                  |
| Command dispatch boundary                        | `apps/api/src/application/slashCommands/runSlashCommand.ts`                                          | Keep. Dispatch is application-layer and independent from Express/web components.                                                                               |
| `/help` behavior                                 | `builtin.ts`, `apps/api/test/slashCommands.test.ts`, `apps/api/test/sessionChat.integration.test.ts` | Keep. It is deterministic, model-free, and registry-backed.                                                                                                    |
| Safe no-Project `/init` response                 | `builtin.ts`, `apps/api/test/slashCommands.test.ts`                                                  | Keep. `/init` must not proceed without a backend-bound Project.                                                                                                |
| Chat-route command interception                  | `apps/api/src/infrastructure/http/v1/chatRouter.ts`                                                  | Keep with review. It dispatches commands before model execution and persists command messages.                                                                 |
| Shared onboarding draft workflow                 | `apps/api/src/infrastructure/projects/projectOnboardingWorkflow.ts`                                  | Keep with review. It extracts reusable onboarding orchestration from HTTP route code.                                                                          |
| Command and chat integration tests               | `apps/api/test/slashCommands.test.ts`, relevant session chat tests                                   | Keep. These validate model bypass, help, unknown commands, and no silent `AGENTS.md` writes.                                                                   |
| IDE message helper that preserves slash commands | `apps/web/test/ide-chat-message.test.ts`, `buildIdeChatMessage` concept                              | Extract with caution. The behavior is valid, but the helper should not stay buried in a large IDE component if task 2 can move it to a small UI/helper module. |

### Park / remove from product path

These changes should not ship as the desktop Product Project opener:

| Area                                                  | Files                                                                                                           | Decision                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Manual Project path entry as primary UI               | `apps/web/components/ide/ide-with-chat.tsx`, `e2e/mvp-e2e.spec.ts`, `e2e/project-workspaces.spec.ts`            | Park. Users should not have to know arbitrary host paths, and Docker/container paths are not the desktop product contract.   |
| Browser File System Access as backend Project binding | `apps/web/hooks/use-file-system.ts`, `apps/web/components/ide/ide-with-chat.tsx`, `e2e/ide-open-folder.spec.ts` | Park. Browser folder handles may show files to the renderer, but they do not give the backend a trusted arbitrary host path. |
| Single-opener web workaround                          | `ide-with-chat.tsx`, `ide-open-folder.spec.ts`                                                                  | Park. It reduces UI duplication but still cannot solve backend binding without Electron.                                     |
| Container path E2E fixture helpers                    | `e2e/mvp-e2e.spec.ts`                                                                                           | Park as dev-only evidence. Do not use as desktop acceptance.                                                                 |
| `/init` E2E through manual/container Project opening  | `e2e/project-workspaces.spec.ts`                                                                                | Park for now. The desired behavior is valid, but desktop acceptance must be reintroduced using Electron-native Project open. |

### Update / re-scope

These docs/specs should be updated during task 4:

| Area                                  | Files                                               | Required change                                                                                                                          |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Project onboarding slash command task | `docs/tasks/agent-platform-project-onboarding.8.md` | Mark browser/manual Project-opening E2E as superseded by Electron Project access. Keep slash command framework requirements.             |
| Project onboarding epic/specs         | `docs/tasks/agent-platform-project-onboarding*.md`  | Require backend-bound Project context for `/init` and review/approval before writes.                                                     |
| Project experience specs              | `docs/tasks/agent-platform-project-experience*.md`  | Require Project chat and IDE handoff to share backend Project/session binding.                                                           |
| Session handoff docs                  | `session.md`                                        | Preserve the warning that local Project-opening implementation changes are reference/extract candidates, not completed product behavior. |

### Test classification

Valid tests to carry forward:

- slash command parser tests;
- slash command registry/help tests;
- chat integration tests proving slash commands bypass model execution;
- no-Project `/init` tests;
- API-level `/init` tests that use a backend-created Project and verify no silent `AGENTS.md` write before approval;
- UI helper tests that prove slash commands are sent without prepended browser Project context.

Tests to rewrite or remove before product sign-off:

- Playwright tests that require users to type a Project folder path as the normal flow;
- Playwright tests that treat browser `showDirectoryPicker` output as sufficient Project binding;
- Playwright tests that use `/workspace` or container-mounted paths as desktop Product acceptance;
- tests that assert "Open Project" intentionally does not open a native picker, because Electron will reverse that expectation.

### Downstream scope confirmation

- `agent-platform-electron-extract.2` should extract the API slash command framework, `/help`, safe `/init`, and focused tests first.
- `agent-platform-electron-extract.3` should remove or park the web/manual-path Project opener changes and rewrite/remove the browser-only E2E expectations.
- `agent-platform-electron-extract.4` should update existing onboarding/experience specs so the next Electron epics are the source of truth for Project opening.

## Git workflow

Use the Electron extract feature branch for this epic. The first implementation task in the chain should branch from `feature/agent-platform-electron-extract` or the agreed feature branch for this cleanup segment. Do not commit directly to `main`.

## Tests and verification

This is an audit/spec task, so the main verification is documentation correctness and Beads alignment.

Required checks before sign-off:

- `bd show agent-platform-electron-extract.1 --json`
- `bd dep list agent-platform-electron-extract.1`
- `pnpm docs:lint`

No unit or E2E tests are required unless this task changes executable code.

## Definition of done

- [x] Current onboarding diff has been reviewed against the accepted Electron decision.
- [x] Keep/extract/park/discard decisions are documented.
- [x] Valid tests and invalid browser-only tests are identified.
- [x] Downstream task scopes are updated if the audit changes them.
- [x] Beads issue description points to this spec.
- [x] Beads parent is `agent-platform-electron-extract`.
- [x] Beads dependencies match this spec.
- [x] `pnpm docs:lint` passes.
- [x] No code is marked complete unless matching tests and gates are identified.

## Sign-off

- [x] Task branch created from the correct parent before implementation work.
- [x] Audit outcome captured in repo documentation.
- [x] `pnpm docs:lint` executed and passing.
- [x] PR/check/review requirements satisfied if this task is merged through a PR. PR #158 checks passed; no actionable review comments.
- [x] `bd close agent-platform-electron-extract.1 --reason "Audit complete"`
