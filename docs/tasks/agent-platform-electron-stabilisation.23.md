# agent-platform-electron-stabilisation.23 - Refine preview controls and external IDE launch

## Summary

Refine Project Chat desktop UI around Workspace Preview sizing, preview mode controls, system IDE launch, and command-runner status copy.

## Requirements

- Avoid forcing a poor initial Workspace Preview layout on smaller desktop windows.
- Make preview mode controls explicit so users can distinguish side-panel widening from focused overlay mode.
- Replace internal `/ide` navigation from Project Chat and Git conflict flows with a desktop bridge that opens the Project folder in the user's system IDE or OS folder handler.
- Replace duplicate `disabled disabled` command-runner badge copy with a clear user-facing label.

## Implementation Plan

- Change Workspace Preview panel widths to responsive `clamp(...)` sizing and keep native bounds sync coverage.
- Replace duplicate icon-only preview actions with labeled `Wide` and `Focus` controls.
- Add a desktop `projects.openInIde` bridge and main-process launcher with `AGENT_PLATFORM_DESKTOP_IDE_COMMAND`, common IDE candidates, and OS fallback.
- Change Project Chat and Git conflict resolver IDE buttons to call the desktop bridge rather than linking to `/ide`.
- Collapse duplicate command-runner mode/status text to a clear label.

## Tests And Verification

- `pnpm --filter @agent-platform/web typecheck`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/webview-runtime.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-git-workflow.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-access.e2e.ts`

## Definition Of Done

- Preview controls are readable and responsive.
- Open in IDE no longer routes users into the internal workbench from Project Chat/Git flows.
- Command-runner status badge no longer duplicates disabled state.
- Targeted Electron E2E passes.
