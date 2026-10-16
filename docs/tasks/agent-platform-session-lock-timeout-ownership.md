# Preserve session-lock ownership after a tail waiter timeout

**Beads:** `agent-platform-session-lock-timeout-ownership`, P2 OPEN follow-up.
**Discovered from:** [durable monitoring](agent-platform-local-diagnostics-monitoring.md).
**Authority:** investigation/backlog record only; no implementation or paused-work resumption granted.

## Observed evidence and scope

While naming monitoring counters, review found that the current session-lock map represents the
latest queue gate rather than every outstanding holder. A bounded in-memory unit reproduction on
16 October held callerA, allowed tail waiterB to time out with `SESSION_BUSY`, then observed callerC
acquire before A released. The timeout releases/removes B's tail gate. This is a concrete mutex-level
exclusion failure; exposure through actual API callers remains unverified because run-control and
client-admission safeguards may reject overlapping work first.

The reproduction exercised only compiled lock code, not a live API/user session. Source SHA256 was
`f2e240260e3df73940679610d7194e7090d97492eeb519887ad34facec92762d`; qualified upstream was
`a5d17683961236f9cf089030be51b813845d85da`. Safe evidence is
`/Users/letuscode/.codex/local-diagnostics-monitoring-20261016/session-lock-timeout-observation.json`.
Monitoring added waiter instrumentation but does not change this pre-existing mutex behavior.
Its metrics therefore distinguish map keys, pending waiters and process-owned runs/uncertain attempts.

## Bounded next plan and verification

First inspect real caller paths and reproduce held-owner/timed-out-tail/new-waiter ordering through
meaningful unit and API tests. Determine whether the existing controls make the case reachable and
record user/release impact. Propose a small ownership-preserving correction without a new scheduler,
distributed-lock backend or orchestration framework. Preserve timeout responses, later cancellation,
queue cleanup, Stop bypass and durable execution fences. Test middle/tail timeouts, several waiters,
repeated release, thrown callbacks and eventual cleanup; no overlapping admitted holder is allowed.

## Definition of done

A separately authorized repair has independent source review, focused ownership/concurrency tests,
affected API/Stop regression and quality gates, and normal PR/hosted delivery. Actual caller exposure
and priority disposition are recorded before claiming a release blocker fixed. Keep this OPEN until
its own work is approved and verified; it is not an added hard dependency for monitoring. The owner
trial remains bounded to one active request per session and does not claim general production capacity.
