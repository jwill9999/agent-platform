# agent-platform-electron-stabilisation.21 - Fix WebView bounds after Git rail collapse

## Summary

Fix the desktop Workspace Preview rendering regression where collapsing the Git/GitHub rail can leave the native Electron WebView drawing with stale bounds.

## Requirements

- Keep the native WebView aligned to the visible preview viewport after adjacent panel collapse or expansion.
- Avoid excessive IPC churn while still catching position-only layout changes.
- Add regression coverage to the Electron WebView runtime E2E path.

## Implementation Plan

- Dedupe WebView bounds updates by the active WebView id and rounded viewport rectangle.
- Sync bounds through `ResizeObserver`, window resize, and animation-frame layout checks while a native WebView is active.
- Record the last applied native bounds in desktop WebView state for runtime diagnostics and E2E verification.
- Extend the WebView runtime E2E to collapse the Git/GitHub panel and verify the recorded bounds match the visible viewport.

## Tests And Verification

- `pnpm --filter @agent-platform/contracts typecheck`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/web typecheck`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/webview-runtime.e2e.ts`

## Definition Of Done

- WebView bounds remain aligned after Git/GitHub rail collapse.
- Electron runtime E2E covers the regression.
- Task is closed in Beads with verification evidence.
