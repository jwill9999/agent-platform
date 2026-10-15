# Task: Isolate the required diagnostic benchmark process

**Beads issue:** `agent-platform-diagnostics-benchmark-isolation`  
**Parent:** `agent-platform-local-mvp-promotion`  
**Status:** in progress; local validation and independent review approved; hooks, publication and hosted qualification pending.

## Evidence and bounded requirements

PR324 at `5a3e283f846bde2c45caa30a2bfb3faf63ea2e16` fails the diagnostic benchmark:
healthy p95 108.676917 ms minus disabled 49.757511 ms exceeds the unchanged 20 ms overhead
limit by producing 58.919406 ms. All 321 other API tests pass. Independent review confirms the
300 retained request durations and API artifact digest. Median disabled/healthy/locked timings
are 14.81/14.96/13.74 ms; event-loop p95 values differ across the sequential windows. Healthy
enqueue p95 is 0.036925 ms and all 660 events are durable. These observations do not establish
a runtime, scheduler, connection or storage cause. Earlier failures remain retained.

The API suite deliberately uses one reused fork with `isolate: false`. Its benchmark already
serializes modes, awaits storage readiness and releases every mode's workers, servers and DBs.
This task removes preceding test files' process history as a confounder; it is an isolation
experiment, not a claimed fix for an established product performance defect.

R1: Route exactly the existing benchmark from the serialized general CI test command into an
immediately following required fresh Vitest process. Preserve every test; local package test
scripts and hooks retain their complete inventory. No `continue-on-error`, `passWithNoTests`,
conditional success, deadline change or automatic benchmark retry.

R2: Preserve 100 measured requests plus 10 warm-up requests per mode, three balanced repetitions,
all provider/outcome/durability/queue/loss assertions, the 90-second test deadline, 20 ms overhead
and 2 ms enqueue limits. Keep raw samples and incomplete failure artifacts. Do not subtract
CPU/GC/event-loop measurements or average away a failed repetition.

R3: Add safe numeric wall-time, process CPU, resident-memory and observed GC durations for each
warm-up/measurement window. Process CPU includes worker threads; asynchronous GC records may
be incomplete. Disconnect observers on success and failure. These are diagnostic observations,
never inputs to qualification decisions. No prompts, secrets or user payloads are captured.

## Plan and dependencies

The independent promotion critic approved this bounded CI-only routing and observation plan on
15 October. Branch `task/diagnostics-benchmark-isolation` starts from actual feature head 5a3.
The parent promotion is blocked by this child; completed asset-copy delivery remains closed.
No paused orchestration or active Git delivery work changes.

1. Route the one test and add observations while preserving its assertions.
2. Verify selected inventory and execute the dedicated benchmark locally; inspect all raw samples.
3. Obtain independent source/evidence review, normal quality/hooks, complete task/session mirrors
   and readbacks, then open a segment PR into `feature/github-read-responsiveness`.
4. Require fresh exact-head feature checks and comments before guarded feature merge. Parent PR324
   then needs entirely new protected checks, actual full scan, real VM and independent evidence.

The separate PR324 VM retry addresses a confirmed setup ENOSPC incident after reviewed byte-identical
APFS deduplication. It does not explain or qualify the failed hosted benchmark.

## Verification and definition of done

- Confirm the main exclusion matches exactly `apps/api/test/diagnostics.performance.test.ts`, and
  the dedicated command selects that file's one test. Verify all other package scripts accept the
  unchanged Vitest arguments and the benchmark cannot silently pass with no selected tests.
- Run the dedicated command with its artifact variable and inspect all nine mode samples, 900
  measured requests, 90 warm-ups, unchanged bounds, complete healthy durability and locked-loss control.
- Verify numeric CPU/GC/memory fields are finite and nonnegative and request samples remain raw.
  Failure cleanup retains measurements and disconnects observers; source review covers this path.
- Run API typecheck, scoped lint/format, direct Markdown and normal commit/push hooks. Hosted
  Sonar/CodeQL and current reviews remain mandatory; local IDE Problems is unavailable.
- Browser/Electron and packaged real-VM behavior is unchanged. Reuse existing local connected
  evidence; require new hosted feature/browser/Electron and protected actual-VM qualification after
  source changes. Do not repeat successful unrelated local journeys for this test-routing change.
- Feature DoD: preceding evidence, full source-bound mirrors/readback, independent review, every
  executed current-head feature check and resolved actionable comments, then guarded feature merge.
  Close/readback/sync this child only then. Parent stays open through protected delivery/cleanup.

## Results and diagnostic disposition

The dedicated local command selects exactly one test and passes all nine mode samples: 900 measured
requests plus 90 warm-ups, maximum overhead 0.249750 ms and enqueue p95 0.013166 ms under the unchanged
limits. Every numeric CPU/memory observation is finite and nonnegative; observed GC durations remain
raw. Healthy modes retain all events and locked modes preserve the existing bounded-loss control.
This local pass does not establish the cause of hosted latency or qualify a future hosted revision.

The exclusion matches exactly one tracked file. All 15 package test commands end with Vitest and
accept its arguments; none are changed. API typecheck, scoped lint/format, direct Markdown and diff
validation apply; normal hooks and fresh hosted qualification remain pending. Evidence files are
`benchmark-isolation-inventory.json`, `benchmark-isolation-selected-tests.json`,
`benchmark-isolation-local.json` and `benchmark-isolation-local-verification.json` in the external
promotion evidence directory. The raw local artifact SHA-256 is
`272c7fa658cef7d530665d9f5f9776d2d467fce5ed7a4b8a379faa412b61f4a3`.

The original failed source and raw evidence remain in `pr324-5a3-evidence`, including
`critic-failed-benchmark-analysis.json`. The separate ENOSPC VM recovery passes all 19 hosted cases
on the unchanged 5a source. Independent review verifies all 19 first attempts and shutdowns, 18 VM
releases and ten complete clean diagnostic reports; all 104 retained files pass hash verification.
No prior failure is relabeled as passing. Any further failure must retain actual evidence and receive
an explicit disposition without relaxing the agreed criteria.
