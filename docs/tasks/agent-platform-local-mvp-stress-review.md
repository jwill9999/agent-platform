# Owner local MVP trial and evidence review

**Beads:** `agent-platform-local-mvp-stress-review`, P1 OPEN/blocked/planning-only.
**Delivered foundations:** `agent-platform-harness-r3.cancel` and
`agent-platform-local-diagnostics-monitoring` are qualified and integrated. The existing
[fixture-log isolation](agent-platform-desktop-fixture-log-isolation.md) and
[failure provenance](agent-platform-monitoring-storage-failure-provenance.md) P1s remain current
hard prerequisites pending their actual PR380 delivery and applicable app preflight. Canonical
Beads dependencies are authoritative; older readiness notes are historical.
[Plan](../planning/project-chat-stop-mvp.md); [Q01 verification](../testing/project-chat-stop-mvp.md).

## Readiness before inviting the owner

Actual current source passes automated Stop headless/browser/Electron/diagnostic and protected real-VM
checks, and review findings are resolved. Check the participating native app/runner and at least
20 GiB free space on participating hosts/volumes; record unavailable measurements. Docker is needed
only if a selected scenario actually uses it; the normal desktop app runs natively. Verify durable recording is
ready, can read a prior run after restart, and an agent can identify a seeded delay from saved data
without witnessing it. Capture-health gaps must be visible. No manual symptom report is needed for
routine evidence retention; if recording fails, postpone trial and fix its owning task first.

Visibly confirm the actual Agent Platform workspace and working recording/export, not merely an
HTTP success or a renderer-ready startup phase. PR339's retained first Electron attempt loaded a
debugger discovery page at the expected renderer URL. Its fixture port repair does not authenticate
production server identity; the separate P2 [readiness follow-up](agent-platform-renderer-readiness-identity.md)
remains OPEN. If unexpected content is shown, postpone the trial and preserve the failed evidence.

## Trial boundaries

Finish the two existing evidence-preservation prerequisites and one applicable preflight, then
freeze the qualified build for the manual trial. Do not add general profiling or further dependency
upgrades as new prerequisites. During the exercise, make no patches, rebuilds or configuration
experiments to fix ordinary bugs. Record them and finish the block; a slow response, handled error
or UI glitch alone does not stop the trial.

This is a bounded first functional trial, not a requirement to exercise every feature. The owner
can make an optional approximate-time/one-line symptom note for unexpected behaviour; automatic
recording must not depend on the owner collecting technical logs. Run one evidence review after the
block, deduplicate findings and group ordinary repairs into one protected-staging PR. Expedite a
severe blocker separately. Do not repair and resume the same trial after an immediate-stop event.

## Proposed bounded workload

One 30-minute local session: five-minute preflight, twenty-minute exercise, five-minute export/check.
Use only disposable projects; at most two simultaneous independent sessions, one active run per
session, at most twenty deliberately started requests. Exercise ordinary chat, approval wait/deny,
safe local read/write and Stop during model/tool work, then reload and inspect a new request.
Permission controls stay intact. No real push/PR creation or destructive commands in the load fixture.
Default deterministic/local provider fixture and zero paid spend; any live external-provider trial
requires the owner's chosen provider and explicit request/cost cap before that part runs. Keep
scripted capacity measurements separate from subjective owner feedback.

Stop immediately on any cross-session effect, unexpected paid dispatch, secret exposure,
unintended destructive effect, lost Stop/control fence, disk below 10 GiB, unbounded resource growth
or repeated unrecoverable freezes. Stop deliberate workload if recording becomes disabled/unknown,
reports new loss/conflict or cannot preserve the trial window. Existing historical gaps, an initial
CPU baseline and disclosed unavailable metrics are not themselves new capture failures.
Save the failed window and use known owned-process cleanup; never blindly kill unrelated work.
Stop tests do not prove every external action terminates; inspect reported unknown effects.

## Coverage and remaining visibility limits

Stored evidence includes agent-run request/model/tool timings, failures/waits and API-process CPU,
RSS memory, event-loop delay, active/admitted runs, session-lock counts and app-volume free space
sampled every30seconds. Recording runs in the backend and survives normal restart; default7-day
retention is configurable. Health and coverage identify missing data rather than treating it as clean.

Detailed renderer/subprocess/whole-host profiling, disk-I/O latency, finer hotspot attribution and
UI-only correctness are outside this capture. A saved timeline may show where a delay occurred
without establishing its cause. Keep unexplained symptoms unknown and propose targeted evidence
only when needed by a concrete finding; full APM is not a prerequisite for this first trial.
PR380 retains completed safe first-failure snapshots on normal restart; abrupt exit or filesystem
failure can still prevent best-effort publication. It does not eliminate these coverage limits.

## Review and completion

Read the stored trial window at the end and again later, using the same source/window/coverage.
If export fails, preserve available status/failure artifacts and mark the trial incomplete.
Retain safe summary/JSON, control/effect evidence and numeric resource samples; no secrets/content
or identifying paths in shared reports. Triage concrete bugs/bottlenecks into existing/new Beads
issues with severity, evidence, uncertainty and next test; no automatic remediation. Mark incomplete
capture as incomplete, not clean. Owner records whether the local experience is useful and which
follow-ups to select. Trial task closes after this evidence review and readback/sync, not merely a
passing automation or an uneventful click-through. Broad release qualification, distribution,
external dashboards and unbounded soak/load are excluded. No calendar date or automatic daily
review has been booked; agree practical timing once the prerequisites are delivered.
