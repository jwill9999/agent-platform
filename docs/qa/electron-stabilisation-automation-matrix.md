# Electron Stabilisation Automation Matrix

This matrix maps the `.12` manual QA checklist to automated Electron coverage so owner manual QA
can focus on checks automation cannot fully prove.

## Automated Coverage

| Manual QA area                                   | Automated coverage                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| App launch                                       | `apps/desktop/e2e/project-access.e2e.ts`, `apps/desktop/e2e/stabilisation-backfill.e2e.ts` |
| Settings and model/API key discovery             | `apps/desktop/e2e/stabilisation-backfill.e2e.ts`                                           |
| Settings persistence across restart              | `apps/desktop/e2e/stabilisation-backfill.e2e.ts`                                           |
| Native Open Project app behavior after selection | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Native Project folder IPC contract               | `apps/desktop/test/projectFolderPicker.test.ts`                                            |
| Native New Project flow                          | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Project Chat default surface                     | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Personal Chat separation                         | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Image/markdown attachments                       | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Slash command help and `/init`                   | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Project instructions approval before write       | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Secondary file view and Project Chat return      | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Recent Projects and duplicate folder names       | `apps/desktop/e2e/project-access.e2e.ts`                                                   |
| Project-scoped session history                   | `apps/desktop/e2e/stabilisation-backfill.e2e.ts`                                           |
| Missing/unavailable Project state                | `apps/desktop/e2e/stabilisation-backfill.e2e.ts`                                           |
| Internal path/state leakage smoke                | `apps/desktop/e2e/project-access.e2e.ts`, `apps/desktop/e2e/stabilisation-backfill.e2e.ts` |
| Layout/readability smoke                         | `apps/desktop/e2e/stabilisation-backfill.e2e.ts`                                           |
| First-load compact/expanded desktop layout       | `apps/desktop/e2e/stabilisation-backfill.e2e.ts`                                           |
| Packaged VM command execution                    | `apps/desktop/e2e/packaged-vm-command.e2e.ts`                                              |
| Git workflow panel and merge resolver            | `apps/desktop/e2e/project-git-workflow.e2e.ts`                                             |
| Workspace preview/WebView runtime                | `apps/desktop/e2e/webview-runtime.e2e.ts`                                                  |

## Manual-Only Or Manual-Preferred Checks

| Manual QA area                               | Reason                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Real macOS folder picker appearance and feel | E2E covers the app behavior and IPC contract, but not the human-visible native dialog.               |
| Subjective visual polish and flow coherence  | Automation can catch gross layout regressions, not product judgment.                                 |
| Real local environment quirks                | Requires owner machine/app data, real permissions, unusual paths, external drives, or cloud folders. |
| Copy quality judgment                        | Automation can scan for forbidden implementation details, not whether language feels right.          |

## Closeout Rule

Run automated Electron E2E first. Owner manual QA should then cover only the manual-only checks above
plus any area where automation failed or produced ambiguous evidence.
