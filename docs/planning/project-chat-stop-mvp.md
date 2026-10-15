# Shared harness Stop — bounded local MVP plan

**Status:** Proposed for owner review; planning only. **Date:** 16 October 2026.
**Product baseline:** staging `cf5f04524c25c29635b0d84bda4e76282f28ddcb`, tree
`e4212ec7b8362cbd7fc25120d6dd856df8ad9691`. Planning starts from documentation head
`369ae33440aff2c9e7067d28c02176390650448a`; runtime source is identical to that baseline.

## Outcome and owner decisions

Give the user a reliable way to stop one logical harness run through a shared backend capability.
The Project Chat button is its first client; future CLI/voice clients must use the same identity,
permissions, acknowledgement and state contract. No control authority lives solely in a renderer.
The owner requested current-source planning and independent critique before implementation, then
added an interface-neutral API audit and durable recording for later agent reviews. No implementation,
new client, paid run, automatic remediation, merge or release has been authorized by this plan.

Stop is the first delivery. A separate small monitoring delivery must record normal use durably
before a bounded owner hands-on trial. The owner need not notice symptoms or remember to export.
Daily/periodic review can inspect stored windows and produce evidence-linked Beads issues. A
recurring review automation has not been scheduled; cadence and runtime authority stay separate.

## Source evidence and existing work

- `apps/web/components/chat/chat-input.tsx` has send/loading controls but no Stop capability.
  `apps/web/hooks/use-harness-chat.ts` drains obsolete streams; selection changes are not cancellation.
- `apps/api/src/infrastructure/http/v1/chatRouter.ts` owns disconnect/timeout abort controllers,
  acquires a session mutex for execution and assigns a fresh execution run ID on approval resume.
  `sessionLock.ts` can wait 120 seconds: Stop must bypass that execution mutex.
- `packages/harness/src/nodes/toolDispatch.ts` checks abort before each tool, then awaits hooks and
  preparation; generic retries/native dispatch do not consistently forward the parent signal.
  `llmReason.ts` forwards a provider abort signal but reports non-timeout abort as disconnect.
- `packages/db/src/repositories/approvalRequests.ts` claims resumed approvals without a stopped-run
  predicate. Existing Git-specific ownership/receipt controls must be preserved.
- `packages/contracts/src/diagnostics.ts` and the async diagnostics store are observational and can
  drop/degrade. They cannot authorize execution. V1 already persists safe history and has an API/CLI.
- Existing signal tests in harness `backpressure.test.ts`, MCP `connected.test.ts` and API
  `diagnostics.integration.test.ts` are useful baselines, not proof of an explicit durable Stop.
- Completed benchmark-isolation and fixture-readiness repairs are closed. They added controlled
  CPU/GC/RSS evidence and readiness handling, not ongoing normal-use monitoring or universal causes.
  Broader tracing/Phoenix remain open and separately gated. See the [API audit](../reviews/harness-interface-audit.md).

## Bounded requirements

| ID     | Required behaviour                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STOP-1 | Shared application service plus strict backend identity/read/Stop contracts. Publish server-owned logical run identity before provider/MCP setup; no-renderer clients can discover it. UI calls the same service. Target session plus logical run, never an ambient selected tab or latest run.                                                                              |
| STOP-2 | Durably acknowledge `stop_requested` within two seconds in controlled responsive local fixtures, independently of execution mutex/provider completion. Acknowledgement follows committed authority, not a queued diagnostic event. A bounded failed DB write returns a retriable error, never a successful acknowledgement.                                                  |
| STOP-3 | After acknowledgement no new model/tool/retry/approval continuation is admitted for that logical run. Final durable admission fence immediately precedes each invocation with no unrelated await between fence and call. Previously admitted effects may still complete; report them as in flight/unknown until verified. No rollback or universal remote termination claim. |
| STOP-4 | Stable logical identity owns all execution IDs and approval continuations. Stop/claim/admission use atomic checks. Cover duplicate Stop, completion race, preflight, approval wait, post-claim race, retry/backoff, stale tab and next-run isolation.                                                                                                                        |
| STOP-5 | Preserve Ask/Auto/Block, approval/risk/project/path/repository/secret controls and existing Git receipts. Cancellation never grants permission, replay or resume. Use existing local API exposure rules; add no credential to a renderer and no arbitrary-origin mutation access.                                                                                            |
| STOP-6 | Backend-authoritative scoped status survives reload; process restart marks unfinished previous-process runs interrupted/unknown and does not replay. Keep partial messages and completed effects. Show stopping versus stopped, failure and uncertain outcomes honestly; selection alone never stops a run.                                                                  |
| STOP-7 | Persist safe user-stop request, acknowledgement, admission and settlement timings/reasons, correlated with execution/approval IDs. Separate user_stop, timeout and disconnect. Diagnostic degradation cannot change control authority; exports disclose coverage. No content, paths, command arguments or raw errors.                                                        |
| MON-1  | Separate monitoring task persistently records ordinary use without a live observer, supports bounded historical agent review across restarts, and proves privacy, retention and failure visibility before owner stress testing.                                                                                                                                              |
| QA-1   | Owner trial is bounded and reproducible, retains failures and gaps, and yields reviewed Beads candidates rather than production-readiness or automated-fix claims.                                                                                                                                                                                                           |

## Minimal control design

Use the installed TypeScript/LangGraph/AI SDK and SQLite stack; no SDK migration or managed workflow
prototype. Add an application-owned run-control repository in the main app DB, separate from
`diagnostics.sqlite`, and a small in-process registry of owned controllers and admitted work.
A logical run record contains server-generated ID, session/project binding, process instance,
state/version, requested/acknowledged/settled timestamps and fixed reason. Each execution/approval
continuation points to that logical run; never trust caller-supplied actor/owner identities.

Proposed typed routes are `GET /v1/sessions/:id/active-run`,
`GET /v1/sessions/:id/runs/:runId` and `POST /v1/sessions/:id/runs/:runId/stop`.
These are proposed new APIs, not existing endpoints. Return stable error codes and authoritative
state/version with the same session/run IDs for every client. Publish identity in the accepted
chat response before asynchronous setup; status lookup recovers a lost response. Enforce one active
logical run per session transactionally; reject conflicting starts rather than create uncontrolled
queued executions. The existing session lock remains for normal execution, not Stop.

Allowed state progression: running -> waiting_for_approval -> running; active states ->
stop_requested -> cancelled only when every admitted action is known settled/terminated. Completion
and Stop serialize: completed wins if already committed; Stop wins admission if committed first.
A genuine failure remains failed. Unknown in-flight effects become outcome_unknown; startup marks
unfinished old-process rows interrupted/unknown. Freshness is a separate observation, not proof of
termination. A later result can refine unknown only with actual settlement evidence. Never rewrite
completed effect receipts or silently label all aborts cancelled.

The admission transaction checks current logical state, approval/source binding and expected
version, records the attempt, then synchronously hands off to the provider/tool invocation.
Stop commits a fence and aborts owned controllers without waiting for the work. Test barriers on
both sides of that fence. Recheck after asynchronous hooks and on every retry/resume. Wire supported
provider/MCP/Git/native signals; an unsupported cancellation remains explicitly unknown. Do not
build a generic process-kill facility. Track underlying promises after timeout races so a returned
wrapper is not mistaken for effect settlement. Prevent further automatic work for the fenced run.
A new explicit user request gets a new identity and warning when prior effects remain uncertain;
there is no automatic continuation, cleanup effect or recovery/reconciliation engine in this slice.

Inventory all reachable chat sub-dispatches, including `sensorCheckNode` and its feedback quality-gate
commands, not only toolDispatch. Apply the same fence/signal to sensor command starts and retries;
a suppressed required sensor is cancelled/not-run, never passed. Preserve Git before-push checks.
The actual pinned stack is `ai@4.3.19` and `@langchain/langgraph@0.2.74`. AI SDK internal retries
currently bypass the outer observation boundary. For this slice explicitly set `maxRetries: 0`
at this chat provider call and retain the existing controlled outer retry policy/count/backoff,
so every actual HTTP attempt crosses admission and receives its own diagnostic attempt. Review
that bounded retry-ownership change and test a real local 503/backoff ledger; do not silently
multiply attempts, migrate SDKs or apply it to unreachable evaluator nodes.

Persist mandatory control writes fail-closed; diagnostics remain best-effort. The status API and
button can function when diagnostics are disabled. Retain at most 10,000 settled control records for 30 days and at most 1,000 unresolved records;
per-run attempts obey existing execution limits. Do not prune active/unknown records or a fence
needed by an actionable approval. Missing/expired source control is never resumable: reject and ask
for a fresh request. If protected unresolved/fence rows prevent safe pruning at the bound, deny new
admissions visibly instead of discarding authority. An additive migration must leave historical
approvals readable but refuse unbound legacy execution resumes; show review/new-request guidance
rather than invent a control binding. Test this deliberate stale-approval safety disposition with
legacy Git/non-Git data, row-limit pressure, migration rollback/failure and crash paths.

## Task, document and branch manifest

| Work / title                | Beads and canonical spec                                                                               | Order / branch mapping                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan shared Stop            | [agent-platform-project-chat-stop-plan](../tasks/agent-platform-project-chat-stop-plan.md)             | Current docs task `task/project-chat-stop-plan` chained from `task/post-git-handoff-review` at 369ae; documentation integration `feature/local-mvp-handoff-review`. PR332 remains the earlier documentation segment, not Stop delivery.                            |
| Audit client independence   | [agent-platform-harness-interface-audit](../tasks/agent-platform-harness-interface-audit.md)           | Source audit in this planning branch; [findings](../reviews/harness-interface-audit.md). No broad repair allocation.                                                                                                                                               |
| Implement acknowledged Stop | [agent-platform-harness-r3.cancel](../tasks/agent-platform-harness-r3.cancel.md)                       | After owner approval and scoped gate reconciliation: proposed `feature/project-chat-stop` from actual staging, then `task/project-chat-stop`. Copy reviewed planning docs only if not yet integrated; review resulting diff. These code branches do not exist yet. |
| Durable local monitoring    | [agent-platform-local-diagnostics-monitoring](../tasks/agent-platform-local-diagnostics-monitoring.md) | Queued after Stop; own proposed `feature/local-diagnostics-monitoring` then `task/local-diagnostics-monitoring`. Not part of Stop implementation approval by implication.                                                                                          |
| Owner stress/review         | [agent-platform-local-mvp-stress-review](../tasks/agent-platform-local-mvp-stress-review.md)           | Hard-blocked by Stop and monitoring; run only on actual qualified integrated revision. No code feature branch required for evidence-only trial; any repair follows a scoped task.                                                                                  |

Other artifacts: [verification](../testing/project-chat-stop-mvp.md), [independent critique](../reviews/project-chat-stop-plan-review.md),
[ADR0005](../adr/0005-native-codex-development.md), [message flow](../architecture/message-flow.md),
[diagnostics guide](../development/diagnostics.md), and `session.md`. Repository is
`jwill9999/agent-platform`; canonical Beads root `/Users/letuscode/projects/agent-platform`;
working docs checkout `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`.
Older [MVP reliability plan](mvp-reliability/plan.md) remains historical/broader; this contract refines
only Stop and the explicit later monitoring/trial requirements, not the whole modernization program.

Stop retains hard blockers review-gate OPEN and V1 CLOSED. On owner acceptance, record the exact
Stop-only grant and remove only its historical review-gate edge, without closing the global gate or
changing parent R3/R2, reconciliation or dashboard edges. Until that decision, Stop remains OPEN and
planning-only. Monitoring remains OPEN/planning-only under the observability parent; owner trial
remains OPEN/blocked. No broad parent auto-closure or unrelated status change.

## Verification and feasibility

All product scenarios are **planned, not run**; [S01–S14/M01–M06/Q01](../testing/project-chat-stop-mvp.md)
define actions, independent control/effect assertions, fixtures, evidence and gate ownership.
Use real API/SQLite/harness, connected Docker browser, standalone Electron and mandatory actual
packaged macOS VM. A no-renderer HTTP journey must prove the same authority. External providers,
GitHub and MCP effects may use declared deterministic local fixtures; no real provider billing or
production-capacity conclusion. Reuse real Git/approval/path tests for regression.

Docker engine was reachable (29.8.0) during planning. About 13 GiB host free space is insufficient
for the proposed 20 GiB preflight reserve; restore space before VM/build/stress runs, never delete
unknown data. Recheck engine, app storage, pinned VM assets, macOS virtualization/entitlements,
runner labels/online state and free disk before promising execution. Existing PR330 VM/browser/
Electron evidence proves a feasible route, not future Stop qualification. CI/cloud runner availability
can still block later delivery. No new application execution or VM tests were run while planning.

## Effort, stopping point and delivery

Stop: **4–6 focused developer days**, including control/DB 1–2, dispatch/approval propagation 1–2,
client/report/test/review 1–2. Two-day checkpoint: prove headless durable fence, one approval race and
honest uncooperative outcome before extending UI. If the minimum cannot fit this bound, bring a
reviewed cut or revised estimate to the owner; do not absorb recovery infrastructure silently.
Monitoring: **1–2 additional days** after Stop, then one **30-minute owner trial** plus analysis.
These are estimates, not dates or authorization. Dashboard, voice/CLI clients, distributed execution,
full tracing, release accounts/distribution, universal hard cancellation and broad recovery are excluded.

Stop DoD is S01–S14 plus affected quality/connected/diagnostic gates, independent source/result
review, full documentation mirrors, resolved comments, exact-head feature integration and task
readback/sync. Monitor DoD is M01–M06 and historical evidence-only diagnosis. Owner trial is its own
checkpoint, not a hidden unbounded Stop acceptance loop. Existing benchmark limits remain unchanged.
Every actual result records source/version, pass/fail/skip/blocked/not-run and first-attempt evidence.
Two focused repair iterations or two environment retries per recurring failure trigger evidence-backed
replanning; no unchanged endless reruns or relaxed assertions. Default paid spend is zero.
Protected staging requires actual current-head full security/quality checks, actual packaged VM and
resolved reviews plus explicit merge authority; this planning request grants no merge. Preserve
main, PR283/four paused refs and every dirty/unrelated checkout. No background orchestration resumes.
