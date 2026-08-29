# Project Experience Automation Matrix

This matrix defines the staged Project Experience release gate tracked by
`agent-platform-project-experience.6`. The GitHub `desktop-e2e` and browser `e2e` jobs are both
required: Electron owns native Project behavior, while browser Playwright protects shared rendering
without pretending to open host folders.

## Gate Coverage

| Phase | Product guarantee                                                                                                                                                                                                               | Required coverage                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Native open, create, reopen, Project Chat default, Project-bound sessions, `/help`, `/init`, branch selection, terminal command/resize/hide/close, explicit IDE handoff, breadcrumbs, Personal Chat separation, and safe labels | `apps/desktop/e2e/project-access.e2e.ts`                                                                                                      |
| 1     | Restart persistence, Project-only session history, Personal Chat-only history, unavailable Project recovery, and compact/expanded layout                                                                                        | `apps/desktop/e2e/stabilisation-backfill.e2e.ts`                                                                                              |
| 1     | Browser surfaces do not offer a fake native folder picker or manual absolute-path binding                                                                                                                                       | `e2e/mvp-e2e.spec.ts`, `e2e/ide-project-opening-parked.spec.ts`                                                                               |
| 2     | HTML, Markdown, image, PDF, source, diff, missing-file, export, multi-tab, minimize/restore, and Project/session isolation behavior                                                                                             | `e2e/project-chat-workspace-resources.spec.ts`, `apps/desktop/e2e/workspace-resource-export.e2e.ts`                                           |
| 2     | Repository and local preview URLs remain inside the production Electron WebView surface                                                                                                                                         | `apps/desktop/e2e/webview-runtime.e2e.ts`                                                                                                     |
| 3     | Activity evidence grouping, changed/generated resources, safe provider fallback, panel collapse/restore, and context preservation                                                                                               | `e2e/project-chat-workspace-resources.spec.ts`, `apps/desktop/e2e/workspace-resource-export.e2e.ts`, `apps/desktop/e2e/project-access.e2e.ts` |
| 4     | A docs/content, non-Git Project shows profile-aware evidence copy and a safe Git-unavailable state without leaking coding evidence                                                                                              | `apps/desktop/e2e/project-access.e2e.ts`                                                                                                      |

## Required Commands

Run the same production-like gates used by CI:

```bash
pnpm test:e2e
pnpm --filter @agent-platform/desktop test:e2e
```

The desktop command builds the backend, standalone renderer, preload, and main process before
launching Electron. The browser command runs against the Docker API/web runtime. Tests must use
visible, accessible controls except for deterministic fixture setup and native test bridges that
produce the same Project/session records as the product path.

The separate `staging-packaged-macos-vm-e2e` lane is evidence for the packaged macOS VM sandbox. It
does not replace this Project Experience gate and remains dependent on its dedicated runner and
signing/notarization prerequisites.
