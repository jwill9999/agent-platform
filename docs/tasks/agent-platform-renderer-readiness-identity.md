# Verify owned standalone renderer identity before trusting readiness

**Beads:** `agent-platform-renderer-readiness-identity`, P2 OPEN follow-up.
**Discovered from:** [durable monitoring](agent-platform-local-diagnostics-monitoring.md).
**Authority:** backlog investigation only; no production hardening or paused-work resumption granted.

## Observed evidence and scope

PR339 at `a2b867dfbc6aef38b2f16e6aede51e078413f24d` completed its hosted checks successfully, but
Electron reported 67 passed plus one flaky permission-policy network-block case. The first attempt
failed before any model call, policy mutation, approval, audit or file effect. Its screenshot and
frame snapshot show Chromium's DevTools discovery page at the expected renderer root, not a blank
or loading application. Startup evidence already reported healthy API, renderer-ready and
window-ready. The retry succeeded; it does not erase the original failure.

The fixture reserved its backend and renderer ports together, then released them before launching
Playwright/Electron. Installed Playwright adds OS-selected Node inspector and Chromium debug ports.
Those listeners can reuse the released renderer port. Production `rendererServer.ts` accepts any
HTTP status below 500 as readiness while the spawned renderer child has not yet exited. That check
does not establish which service answered. Current IPC checks the owned WebContents, main frame and
expected origin; it does not authenticate the HTTP document's server identity.

The bounded test repair uses four distinct jointly allocated ports and explicit debug flags. A
disposable installed Electron42.0.1/Playwright1.59.1 probe verified the actual flag behavior, app
content, debug listener addresses and cleanup. This addresses the fixture's own collision opportunity;
it neither reserves the ports after release nor fixes production server identity. No capability
disclosure or monitoring authority/privacy breach was observed. Independent critique accepts this
as a separate P2 finding, with severity to be reassessed if exposure is reproduced.

Evidence: CI `38936644754`, Electron artifact `12062354035`, first-attempt member prefix
`packaged-vm-command.e2e.ts-db32b-h-persisted-backend-effects/`; restricted selected traces,
screenshot and startup record under
`/Users/letuscode/.codex/local-diagnostics-monitoring-20261016/pr339-a2b-hosted-review`.
The large archive's API digest is recorded; only selected members were independently read and
verified. Raw fixture traces are not shareable product diagnostic reports.

## Bounded next plan and verification

Reproduce an occupied renderer port with real owned processes and show which content is loaded,
whether the child fails, and whether any bridge/capability exposure exceeds the documented trusted
sender/frame/origin semantics. Compare a small ownership or identity handshake with existing child
lifecycle controls; do not assume a successful HTTP response or a load wait proves ownership.
Propose the smallest fail-closed correction, retaining loopback binding, existing startup deadlines,
cancellation, owned cleanup and private IPC restrictions. No new server architecture or production
implementation follows this backlog record alone.

Test wrong-service HTTP success, delayed child failure, healthy owned startup, cancellation and
cleanup through meaningful unit and real-process controls. A separately approved implementation
also needs affected build/type/lint checks, browser/Electron regression, hosted security/quality
checks and independent source review. Reassess priority from observed user impact and exposure.

## Definition of done

The separately authorized repair rejects unrelated responding services, starts the actual owned
renderer normally, preserves current bounds and cleanup, and passes its declared local/hosted gates
with evidence of actual loaded content. Read back and sync Beads and full documentation mirrors.
Keep this OPEN until that work is approved and delivered; it is not an added hard dependency for
the bounded monitoring task. Before the owner trial, visibly confirm the actual Agent Platform UI
and working recording/export in addition to HTTP health. Do not describe the fixture repair as
general production startup or security hardening.
