# Follow-up: complete Electron fixture port groups

**Beads issue:** `agent-platform-desktop-grouped-ports`

**Status:** Open follow-up; no implementation in this repair.

## Requirements and scope

Independent review of [the packaged fixture repair](agent-platform-desktop-fixture-ports.md)
found the same sequential allocation pattern in other Electron fixtures. The webview fixture
also needs a preview port, so replacing only its API/renderer pair would leave collision risk.
Review the remaining callers of `getOpenPort` in `apps/desktop/e2e` and implement a small complete
port-group allocator retaining all reservations until every group member is assigned.

## Dependencies and delivery

Discovered from `agent-platform-desktop-fixture-ports`; this is a soft discovery link, not a blocker
for its bounded repair or current staging promotion. Beads owns priority and scheduling. Select an
appropriate task/feature branch from the then-current staging baseline when this work is taken.
Do not change paused orchestration, runtime policies, timeouts or retry counts.

## Plan and tests

Map each fixture's complete group, including API, renderer and webview preview. Test deterministic
lowest-free port reuse across two and three members, partial allocation failure and release on all
paths, then run affected connected Electron journeys with first-attempt evidence. Use real sockets
for distinct/rebind control and keep the external-process race during child handoff explicit.

## Definition of done and sign-off

All affected fixtures use complete-group allocation; focused regressions and required affected
Electron journeys pass without retry/timeout inflation; source review and quality gates clear;
full documentation mirrors and Beads readbacks are verified; proper task-to-feature delivery is
qualified. No tests, implementation or completion are claimed by this follow-up specification.
