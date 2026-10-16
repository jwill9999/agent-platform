# Durable local monitoring for later agent review

**Beads:** `agent-platform-local-diagnostics-monitoring`, P1 OPEN; implementation authorized after Stop, still dependency-blocked.
**Parent:** `agent-platform-llm-observability-export` (scope only).
**Hard upstream:** acknowledged Stop `agent-platform-harness-r3.cancel`.
**Hard downstream:** `agent-platform-local-mvp-stress-review`.
[Plan](../planning/project-chat-stop-mvp.md); [M01–M06 verification](../testing/project-chat-stop-mvp.md).

The working Stop implementation adds safe control/admission/settlement events to existing V1
diagnostics. This does not implement the periodic resource sampler, retained recording preference,
historical monitoring windows or M01–M06 below. Those remain unstarted; the
[Stop results](../reviews/project-chat-stop-results.md) must not be used as monitoring sign-off.

## Outcome and bounded scope

Normal harness use must leave enough safe, durable evidence for an agent and owner to review later,
without a live observer, symptom recognition or a manual export after every run. Existing V1 events
already persist; extend them with safe control/resource evidence and a bounded historical review
workflow. Enable recording once with a retained local preference; use the same backend for UI and
headless clients. Do not make monitoring a renderer lifetime, console-only stream or optional manual
stress script. Review from stored evidence must work after the app/API has restarted.

Proposed capture: retain request/model/tool/approval/Stop metadata and admissions/settlements at
boundaries, plus numeric API process CPU deltas/RSS, event-loop p95/max, owned-run queue/admitted counts
and free app-volume disk every 30 seconds while enabled. Record metric source, units, interval,
process/version and safe generated IDs; monotonic durations and UTC window timestamps serve different
purposes. Do not sum container/host/process CPU or call a correlation a cause. Initial capture is API
process and app-volume scoped; renderer or Docker VM saturation without captured data remains unknown.
No prompts, file paths, shell arguments, custom names, raw errors, keys, uploads or external agents.

Keep this capture local behind the existing private diagnostics capability. Reuse the bounded store
worker/interface or a companion worker-owned SQLite table, not synchronous writes on every request.
Default seven-day retention configurable from 1–90 whole days, at most 25,000 sample rows
(each containing the fixed numeric metric set, not one row per scalar metric) and 32 MiB database pages
plus a 34 MiB rollback-journal budget. Use existing 200 ms diagnostic read and two-second
bounded shutdown budgets; a failed flush is reported and unacknowledged samples stay uncertain; no unbounded files or forgotten observers. Expose recording enabled/ready/
degraded, last durable timestamp, gaps/drops/expired windows and unexpected shutdown. Failed or
incomplete attempts remain reviewable. Data/recording failure must not change execution permission.

Provide a trusted local API window query and diagnostic CLI readable/JSON report for a bounded time
range, page/snapshot limits, and safe capture-health summary. Maximum single output remains 5 MiB;
when a full interval cannot fit, explicit pagination/gaps prevent a misleading complete report.
Desktop uses its main-process capability/export bridge; never expose that capability to renderer or
voice/model prompts. An agent receives only owner-authorized sanitized exported/read-window data.
No access to an unrelated user's sessions or cloud collection is implied.

## Agent review and backlog loop

At daily/periodic review, record revision/window/coverage and compare run timings, Stop acknowledgement
versus settlement, queue pressure and resource samples. Keep errors, outliers and missing data;
prioritize repeatable user impact and permission/control failures. An issue records safe evidence
reference, reproducible steps if known, observed impact, confidence, competing hypotheses and next
validation. Search existing Beads issues first; append evidence rather than create duplicates. Do
not auto-edit code, dismiss a failure, invent a bottleneck cause or infer absent effects from absent
events. Review cadence can be manual/agent-requested initially; no recurring automation or paid
review service is scheduled by this plan. The stored record exists even between reviews.

## Delivery, tests and stopping point

Owner approved Stop followed by this delivery on 16 October. Planned branch chain remains
feature/local-diagnostics-monitoring -> task/local-diagnostics-monitoring;
expected contracts/store/API/CLI/desktop bridge tests and docs. Verify M01–M06, one connected browser
and Electron recording/history journey, restart, storage/retention/privacy failures, and existing
benchmark thresholds without normalization. The agent must locate a seeded issue using historical
records alone. Failed coverage preflight blocks owner stress testing. Source/results critic,
quality/hosted security/tests, full mirrors/readbacks, guarded feature integration, Beads readback and
sync apply; protected staging has its own actual scan/VM/review/authority gates. Estimate 1–2 days,
then revisit if the minimal capture grows into a dashboard or tracing system. Implementation is
authorized but has not started; the Stop delivery dependency and declared gates remain. Existing benchmark/readiness repairs stay closed; V2/V3 are separately gated.
