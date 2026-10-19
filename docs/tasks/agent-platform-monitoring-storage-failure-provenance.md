# Retain bounded monitoring storage failure evidence

**Beads:** `agent-platform-monitoring-storage-failure-provenance`, P1 bug, in progress.
**Plan:** [Monitoring preparation](../planning/monitoring-stress-readiness.md).
**Git:** following task from the accepted fixture-isolation tip; final segment PR to
`feature/monitoring-stress-readiness`, then protected staging after all actual gates and authority.

## Requirements and original observation

OBS01–03 address OBS-OWN02. The retained app reported disabled/unknown `storage_unavailable`,
with dropped1; SQLite integrity and4153 retained samples did not identify a cause. A later durable
ACK and restart recovery do not establish why the original worker was disabled. Preserve these
failures and distinguish any future deterministic reproduction from that historical incident.

Add fixed, privacy-safe first-failure provenance distinguishing append/read/startup/shutdown timeout,
worker construction/error/exit and sanitized reply failure. Include bounded operation/cause enums
and numeric monotonic elapsed/deadline/timestamps/counters; never raw exceptions, SQL, paths,
payloads, provider labels, capabilities, credentials or stacks. A later exit/late ACK must not replace
the initiating failure or revive disabled health. Expected input/cursor rejection and an existing
successful busy retry must not become a false terminal storage failure.

## Reviewed bounded evidence contract

The private status route can inspect health without DB RPC, but ordinary window reads can return503
after failure. Health-only evidence disappears on restart; current backend stdout/stderr are opened
with `w`. Initial critique OBS-P01/02 therefore rejects successful-report-only and log-only claims.

Independent source-aware critique approved a dedicated snapshot as narrower than changing generic
backend log retention. Add a sticky first terminal failure to current health/status and a guarded
API sink. Keep exactly two retained files total, one latest first failure per store under the trusted
app-data directory. Healthy restart preserves them as historical `previousFailure`, separate from
current healthy capture. Only a new process's first terminal fault of that store may replace its file.

Use a strict versioned schema, at most2048 encoded bytes: process UUID, fixed store/operation/cause
enums, observation time, bounded monotonic elapsed time, deadline or null and optional numeric exit
code. No raw strings, paths, SQL, payloads, cursors, credentials or stacks. Status reads cached
validated snapshots, not failing database RPC or synchronous filesystem I/O. Successful window
enrichment is optional; unavailable ordinary window reads remain503.

Publication is asynchronous and best effort, outside capture/permission/deadline paths. One
outstanding write per store, no retry or queue. Use a private owned directory, fixed bounded files,
regular-file/no-symlink validation and atomic replacement only after write/close succeed. Preserve
the previous valid record on failure. Exclusive cross-process ownership must not steal a foreign
claim based on PID; bound temporary and claim artifacts and expose unavailability honestly.

Do not await publication in capture or existing shutdown cleanup. The API explicitly exits after
cleanup: a pending publication can be interrupted. Only a completed publication supports retained
evidence across an ordinary restart; there is no immediate-quit, power-loss or filesystem-failure
guarantee. A stale foreign claim fails closed rather than silently taking ownership. Test and
document this limitation. No separate telemetry service, new DB or cross-store failure sink.

## Dependencies and implementation order

Fixture isolation is required before local native connected tests. Both existing P1 tasks block
`agent-platform-local-mvp-stress-review`; preserve those Beads edges. No closure dependency cycle.

After the accepted isolation tip and frozen contract review: implement narrow provenance,
run the mapped tests, inspect real success/failure reports/logs, repair findings, update results and
session, run normal hooks and final segment PR checks. Fresh protected full scan/real packaged VM,
reviews/security and actual tree/app verification are required before stress readiness. No merge
authority is inferred from this plan or passing CI.

## Tests, invariants and definition of done

OBS-T01–05 in [verification](../testing/monitoring-stress-readiness.md) must prove exact boundaries,
first-failure retention, no revival/duplicate flood, hostile/error/sink privacy and throw safety,
status readability and actual artifact publication/restart, missing/oversized/malformed/extra-key
records, symlinks/concurrent publishers, interrupted publication, bounded temporary lifecycle and
no extra shutdown wait or false stored claim. Reuse real-worker durability
and existing connected recording/export/restart cases for unchanged behavior.

No deadline/retry/durability/queue/sampling/permission changes, automatic recovery, SDK upgrade,
credential changes or paused orchestration work. Original cause remains unproven unless new actual
evidence establishes it. Required affected builds/types/lint/tests/benchmark and source-aware critic,
fresh hosted checks and resolved comments, final declared staging delivery and owner-data preservation
all precede close. Results, Gherkin mapping for affected visible exports and sign-off remain pending.
