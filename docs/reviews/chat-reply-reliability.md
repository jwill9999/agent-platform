# Disappearing replies — planning review and execution record

Task: `agent-platform-sizx`. Source reviewed: staging211916739642f5b095ba35100b3b452779969feb.
Documents: [plan](../planning/chat-reply-reliability.md), [spec](../tasks/agent-platform-sizx.md),
[verification](../testing/chat-reply-reliability.md).

## Planning evidence

Current source inspection confirms unconditional restoration replacement, final update by placeholder
ID, missing restoration readiness and incomplete old-operation guards. Existing tests cover parsing,
approvals and completed connected context journeys, not controlled restoration/submission interleavings.
Earlier bug evidence is retained under `/Users/letuscode/.codex/context-token-plan-20261013`; it was
not re-executed in this planning turn. No fresh product-test pass is claimed.

Docker29.8.0 reachable, Electron executable and Chromium cache present on macOS ARM64. Existing
managed-runtime provider/SQLite and browser diagnostic export fixtures inspected. This establishes
feasible provision, not that a current build or journey passed. No account, purchase or installation
is needed for the planned deterministic tests.

## Independent critique

Reviewer: distinct `runner_plan_critic`, using actual current source and the plan-critique skill.
The assignment is read-only responsibility, not technical tool isolation. Final verdict: **approved**, with no actionable findings, after correction recheck on13October.

| Finding | Evidence and disposition                                                                                                                                                                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-C01  | Saved Project requested-session reopen resets resume=false then selects a saved session without restoring it (page.tsx966,1045–1054). Added explicit saved-session entry-point correction to plan/spec/R1 and a real requested-session link/reopen regression to CR-T06. Rechecked and resolved by the critic. |

CR-C02 (low, final metadata recheck): replaced premature “receipts are recorded” wording with
“will be recorded when publication completes” in the review and session. This concerns publication
status only; implementation requirements and test map are unchanged.

## Implementation authorization and investigation

On 13 October the owner approved plan `34d6397b` and authorized bounded implementation, Beads,
critic review and the agreed browser, Electron and diagnostics checks. New merging/promotion remains
reserved. Implementation branch `task/chat-reply-reliability` chains from that planning tip into
`feature/chat-reply-reliability`; paused orchestration remains separate.

Before runtime edits, a production renderer/API/Electron baseline was built from unchanged runtime
`21191673`. Controlled delivery of an actual saved history response reproduced the defect in both
Chromium and Electron: the UI admitted a send, stale history replaced its optimistic message, the
provider completed, and SQLite contained exactly one final assistant that was absent from the UI.
Two successful reproduction assertions confirm the defect, not repaired acceptance. The source
receipt binds 420 baseline build artifacts. Both actual V1 reports were durable and verified with
zero dropped/pending events and a successful request; that is consistent with a UI lifecycle defect.
Diagnostic run success alone cannot establish a visible reply.

Evidence root: `/Users/letuscode/.codex/chat-reply-implementation-20261013`;
`baseline-build-source.json`, `baseline-first.log` and `baseline-first/` retain source, actual response
ordering, traces, screenshots, SQLite and safe diagnostic reports. No user conversations or paid
provider calls were used.

## Implemented behavior and source review

Restoration now reads history and approvals together, gates sending until both succeed, and uses a
15-second deadline with explicit safe failure and manual read-only retry. Each session selection,
layout epoch and admitted operation owns its publications. Stale streams are drained without replay
or cross-session state updates. Synchronous send/approval admission prevents same-tick duplicates;
callers clear drafts/attachments only after acceptance. Users can draft during restoration.

Saved Project links restore correctly. Caller navigation generations also guard asynchronous
selection/binding and later sensor/Project refreshes. Delayed or cancelled picker results cannot
replace a newer selection; the IDE's Change Project cancellation preserves its current conversation.
This remains a frontend lifecycle correction; provider protocols,
SQLite schemas, VM/security policy and paused orchestration are unchanged.

The existing Node Vitest environment remains unchanged. A single web test-only dependency,
`jsdom`28.1.0, supports mounted React19 lifecycle tests on the agreed Node24.14 runtime. Lockfile
peer bindings include the new optional test environment; no production dependency was introduced.

Distinct critic `runner_plan_critic` approved the runtime freeze after CR-I01–03 were corrected:

- CR-I01: delayed selection/binding/normalization/creation could select an old conversation.
  Added navigation ownership checks and guarded refresh publication.
- CR-I02: opening the native picker could permit old-Project auto-binding in the same selection.
  Preserve the old conversation while pending and explicitly bind the chosen Project.
- CR-I03: post-bind dialog updates needed another ownership check after the await. Added it.

The source freeze approval is recorded in `runtime-freeze-review.json`; it is not final connected,
hosted or merge qualification. Read-only assignments are procedural, not technical tool isolation.

## Actual verification

- Baseline: two successful reproduction assertions (Chromium and Electron) confirmed the defect
  against unchanged runtime21191673, before any runtime repair.
- Fixed connected matrix: **18 passed, zero failed/skipped**, nine Chromium and nine source-tree
  Electron cases in one terminal run (3.0 minutes), on one frozen runtime/build. The receipt binds
  source hashes, 420 build artifacts, traces, screenshots, SQLite snapshots and actual reports.
- Normal Docker browser: **one passed**, including teardown, with retained JSON, screenshot,
  trace ZIP and SQLite backup. This uses the real isolated Compose API/BFF/SQLite and a loopback
  provider. It is separate from the native managed-runtime diagnostic-export topology.
- Mounted Home/IDE/hook/composer: **35 passed** across four files (Home9, IDE5, hook18, composer3).
  Actual HomePage and hook run with deferred boundary calls; IDE uses its actual caller/input and a
  mocked hook admission boundary. Connected IDE sending is not claimed. The normal affected-package push gates
  passed412 assertions: web259 across44 files and desktop153 across22 files, zero failed/skipped.
  Earlier web245 results remain retained before the14 new caller tests.
- Full repository typecheck, lint, formatting and cycle check passed. Cycle analysis reported81
  resolution warnings and no cycles. Direct strict TypeScript checks cover the five new desktop E2E
  files that are outside the normal desktop source tsconfig. Scoped test lint/format also passed.
- Eight unchanged adjacent connected regressions passed (context/token5; MCP stdio/HTTP/unknown3),
  zero failed/skipped, in1.0 minute from the required desktop working directory. Normal cumulative
  build/typecheck/test/cycle push hooks passed on implementation commit `699f39c8`; hosted checks
  remain a separate pending gate at this source checkpoint.

Evidence: `connected-final-receipt.json`, `fixed-fourth-full.log`, `fixed-fourth-full/`,
`fixed-build-source.json`, `caller-mounted-final-receipt.json`, `local-quality-checkpoint.json` and
`docker-browser/captured-artifacts/` under the evidence root above. No test timeout, product policy
or required assertion was waived. Source-bound receipts distinguish the uncommitted runtime hashes
used for testing from the eventual commit that carries those exact bytes.

## Diagnostic review and retained findings

Ten complete actual V1 exports cover successful replies, admitted provider failures, approval/denial
and context-limit refusal. Browser downloads and Electron SaveAs exports match the selected session
and actual chat/resume response request IDs. Every export has durable, verified, untruncated coverage,
zero pending/dropped/conflict counters and tested prompt/credential/path canaries absent. Provider
call counts and safe tool effects are independently checked; UI visibility is established by actual
Playwright assertions and SQLite comparisons, not by diagnostic success alone.

The failure reports explain the deliberately injected provider error and context refusal. Restoration
GET failures/timeouts happen before chat admission: wire/provider/SQLite checks prove no run/effect;
absence of a run report is not used as proof. Late operations may still complete in their original
session; navigation is not advertised as server cancellation. No new in-scope product finding remains
from these diagnostic checkpoints. The final checkpoint reuses this frozen-source evidence unless
later source changes invalidate it. These controlled samples do not establish a latency benchmark.

Distinct critic `runner_plan_critic` independently verified all136 connected artifact hashes,
readable traces/SQLite, current test-source hashes and all10 exports, approving the connected evidence
with no findings. CR-Q01 added explicit final-reply visibility alongside uniqueness; CR-Q02 made
fixture teardown independent so one failure cannot skip other cleanup. Final Docker evidence is also independently approved: all four retained artifact hashes/sizes,
trace integrity and actual SQLite rows match; POST/provider counts are one with no fixture error.
Adjacent regressions have `adjacent-native-receipt.json`; source review does not imply hosted qualification.

Earlier failures remain available with dispositions:

- The first adjacent run was invoked from repository root instead of the desktop package required
  by its existing relative stdio fixture path. Six cases passed and two failed before chat; all eight
  passed from the correct directory with unchanged test source, timeouts and assertions.
- Automatic/manual Playwright tracing collided before a product assertion. The test now owns and
  retains its explicit trace; no loss of the required capture.
- A stale-operation fixture selected Sessions while it was intentionally disabled during streaming.
  It now uses the available Workspaces/recent-Project navigation before selecting B.
- The rejection fixture expected a Reject button rather than the existing Deny label, then omitted
  the intentional live APPROVAL_REJECTED notice. Exact live combined text, exact persisted model text
  and exact reopened text are now all checked. The recorded denied action had zero effects.
- Docker initially timed out before compilation; read-only engine/builder checks and one bounded
  retry built successfully. Cause is not established. Fixture setup then corrected required execution
  limits, a synthetic stored model key, A-only held reads after B readiness and the actual chat route.
- Repeated Docker setup attempts exhausted the existing rate window during teardown. Only the owned
  API was reset and known fixture records removed with verified responses; fresh terminal tests,
  including cleanup, passed. The final capture stores path-based artifacts that survive successful runs.

No user conversations, paid model calls, Docker pruning or unrelated service changes were used.
Deterministic provider fixtures and source-tree Electron do not qualify live providers, a distributed
release artifact or the protected staging packaged-VM job. Those delivery gates remain separate.

## Publication and completion boundary

Planning publication is complete at `34d6397b`: five full mirrors/readbacks, normal hooks and Dolt
sync are retained in `/Users/letuscode/.codex/chat-reply-plan-20261013/publication.json`. Implementation
publication follows the pushed implementation `699f39c8` and binds the final documentation revision
and all five changed full bodies; historical pages
and human notes remain intact. Beads stays in progress through its owner-authorized integration gate.
No implementation PR, merge or task closure is claimed at this source checkpoint. Final hosted
results and publication receipts are recorded in Beads against the actual revision; this document's
pending checkpoints are superseded only by that evidence, not automatically by opening a PR.
