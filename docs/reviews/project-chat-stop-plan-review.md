# Shared Stop plan — independent critique and dispositions

**Date:** 16 October 2026. **Planning task:** `agent-platform-project-chat-stop-plan`.
**Reviewer:** distinct native `stop_plan_critic` (plan_critic role).
**Reviewed source baseline:** 369ae33440aff2c9e7067d28c02176390650448a, runtime equal staging cf5f0452.
[Plan](../planning/project-chat-stop-mvp.md); [verification](../testing/project-chat-stop-mvp.md);
[interface audit](harness-interface-audit.md).

The critic inspected actual source and all draft specs, plus canonical Beads dependencies. Read-only
responsibility was procedural; no technical inherited-tool isolation is claimed. Source investigation
and formal first pass required corrections. Final corrected-source recheck returned **approved**, with zero actionable findings.
The critic verified all eight substantive plan/spec/test/audit file SHA-256 values against the frozen
snapshot after C8–C10 corrections; the external receipt is
`/Users/letuscode/.codex/project-chat-stop-plan-20261016/frozen-draft-hashes.json`.
Critic approval is not owner implementation or merge authorization. No product tests ran.

| Finding  | Severity | Actual issue / correction and verification                                                                                                                                                                                                         |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STOP-C1  | High     | Stop could wait behind execution mutex. Plan uses independent committed control transaction, bounded ack/error and S01 blocked-setup/lock proof.                                                                                                   |
| STOP-C2  | High     | Approval continuation generates fresh runId with no stopped-source predicate. Logical parent owns continuation; atomic claim/admission and S05 stale/post-claim effect checks.                                                                     |
| STOP-C3  | High     | Abort check precedes awaits and native retry loses signal. Final durable admission fence, owned underlying-work tracking, supported cancellation and honest unknown; S02–S06 effects/backoff proof.                                                |
| STOP-C4  | Medium   | Abort reasons conflated with disconnect/provider failures. Distinct user_stop/timeout/disconnect and authoritative terminal state; S11 report/control/UI consistency.                                                                              |
| STOP-C5  | High     | Async/droppable diagnostics cannot authorize execution. Separate main DB authority, fail-closed control and S09/S10 degraded/restart proof.                                                                                                        |
| STOP-C6  | Medium   | V1 lacks ordinary-use resource/queue/Stop timing and some failed attempts lacked cause evidence. Separate MON-1 task, M01–M06 durable recording/historical diagnosis, QA-1 bounded owner trial. No dashboard prerequisite or invented cause.       |
| STOP-C7  | High     | Button-only cancellation would exclude voice/CLI clients. Shared application service and typed contracts; S01/S07 headless and S12 same backend/effect verification. Existing API audit distinguishes missing clients from actual gaps.            |
| STOP-C8  | High     | Reachable sensor node can start commands outside toolDispatch. Inventory/fence these starts; S13 required sensors interrupted/not-run, never a fabricated pass. Disabled evaluators remain out of scope.                                           |
| STOP-C9  | High     | Pinned AI SDK retries internally outside outer attempt fence. Explicit chat maxRetries0 and retained controlled outer retry policy; S14 actual HTTP503/backoff ledger. No SDK upgrade or invented attempt visibility.                              |
| STOP-C10 | Medium   | Control and monitor bounds deferred to implementation. Plan sets control age/count/protected ceilings and legacy-approval safety; monitoring sets interval/row/byte/journal/read/shutdown limits; S10/M03/M05 test limits, migration and failures. |

## Planning validation and result boundaries

Direct Markdown, formatting, relative-link consistency, runtime-tree comparison, exact prior-session
suffix, actual Beads edges and full source-bound Notion readback are the planning gates. Runtime
verification S01–S14/M01–M06/Q01 remains entirely planned. Later results belong in the dedicated result
reports specified by verification. Existing PR330 diagnostics and benchmark repairs are historical
baseline evidence, not Stop acceptance. Preserve original failures whose causes remain unproven.

No owner decision is needed for the above technical corrections. The completed proposal still
requires the owner's scope/implementation review. A live-provider trial needs an explicit provider
and spending cap if later selected; recurring review timing has not been scheduled. Disk/runner
preflight remains an execution prerequisite, not a successful test claim.
