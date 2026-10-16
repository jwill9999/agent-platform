# Owner local MVP trial and evidence review

**Beads:** `agent-platform-local-mvp-stress-review`, P1 OPEN/blocked/planning-only.
**Hard prerequisites:** `agent-platform-harness-r3.cancel` and
`agent-platform-local-diagnostics-monitoring`, both actually qualified and integrated.
[Plan](../planning/project-chat-stop-mvp.md); [Q01 verification](../testing/project-chat-stop-mvp.md).

## Readiness before inviting the owner

Actual current source passes automated Stop headless/browser/Electron/diagnostic and protected real-VM
checks, and review findings are resolved. Check Docker/runner/app readiness and at least 20 GiB free
space on participating hosts/volumes; record unavailable measurements. Verify durable recording is
ready, can read a prior run after restart, and an agent can identify a seeded delay from saved data
without witnessing it. Capture-health gaps must be visible. No manual symptom report is needed for
routine evidence retention; if recording fails, postpone trial and fix its owning task first.

## Proposed bounded workload

One 30-minute local session: five-minute preflight, twenty-minute exercise, five-minute export/check.
Use only disposable projects; at most two simultaneous independent sessions, one active run per
session, at most twenty deliberately started requests. Exercise ordinary chat, approval wait/deny,
safe local read/write and Stop during model/tool work, then reload and inspect a new request.
Permission controls stay intact. No real push/PR creation or destructive commands in the load fixture.
Default deterministic/local provider fixture and zero paid spend; any live external-provider trial
requires the owner's chosen provider and explicit request/cost cap before that part runs. Keep
scripted capacity measurements separate from subjective owner feedback.

Stop the trial on cross-session effect, unexpected paid dispatch, secret exposure, lost control
fence, disk below 10 GiB, unbounded resource growth, recording degradation or repeated freezes.
Save the failed window and use known owned-process cleanup; never blindly kill unrelated work.
Stop tests do not prove every external action terminates; inspect reported unknown effects.

## Review and completion

Read the stored trial window at the end and again later, using the same source/window/coverage.
Retain safe summary/JSON, control/effect evidence and numeric resource samples; no secrets/content
or identifying paths in shared reports. Triage concrete bugs/bottlenecks into existing/new Beads
issues with severity, evidence, uncertainty and next test; no automatic remediation. Mark incomplete
capture as incomplete, not clean. Owner records whether the local experience is useful and which
follow-ups to select. Trial task closes after this evidence review and readback/sync, not merely a
passing automation or an uneventful click-through. Broad release qualification, distribution,
external dashboards and unbounded soak/load are excluded. No calendar date or automatic daily
review has been booked; agree practical timing once the prerequisites are delivered.
