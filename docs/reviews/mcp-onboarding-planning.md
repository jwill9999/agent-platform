# MCP onboarding planning review and results

**Status:** planning approved by owner; implementation and final verification in progress.
**Task:** `agent-platform-mcp-onboarding`. **Source baseline:** `26e90126a1987b1dc6e689438b471fe5ed932235`.  
**Plan:** [Bounded MCP onboarding](../planning/mcp-onboarding-mvp.md).  
**Verification:** [V01–V09](../testing/mcp-onboarding-mvp.md).

## Actual investigation

Inspected current import/editor, shared contracts, registry/mappers, encrypted secret store, API test route, adapter transport/session/manager, harness factory/trust guard/tool dispatch and existing tests. Confirmed `http` mismatch, ignored env/headers, plaintext metadata exposure risk, discovery versus eligibility difference, and host-process execution boundary. Existing mocks do not establish end-to-end onboarding.

Read versioned MCP SDK1.29.0 stdio/Streamable HTTP sources and current upstream Everything documentation. No dependency upgrade or third-party server installation was performed. Docker engine29.8.0 responded; dev macOS runner was online/idle during planning. This is feasibility evidence, not a running app stack or executed product test.

Read live Beads parent and historical related records, created one P1 owning task and kept its status in progress. No cross-task blockers were fabricated. Planning authority permits docs/Beads/publication; owner expressly reserved scope agreement before implementation. No runtime code changed and V01–V09 remain not run.

## Independent critique

Independent `runner_plan_critic` inspected the actual draft and relevant source under the plan-critique skill. Initial verdict: correction required. The corrected plan and verification map were independently rechecked; final verdict **approved**, with no actionable findings. All four dispositions below are resolved.

| Finding | Severity | Correction and verification                                                                                                                                                                  |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP-C01 | High     | MCP-06 binds pending approval to configuration and tool-schema revision, rejects stale/missing binding; V04 checks endpoint/command/credential/schema substitution and unassignment/deletion |
| MCP-C02 | High     | MCP-07 halts automatic turn continuation after ambiguous post-dispatch outcome; V06 uses a model attempting a duplicate call and asserts exactly one effect                                  |
| MCP-C03 | High     | MCP-04 sanitizes legacy credential-bearing URLs on public paths and blocks activation pending explicit replacement; V03 adds URL canaries                                                    |
| MCP-C04 | Medium   | MCP-04 distinguishes structural key validation from authenticated decryption; V03 wrong-key test uses existing ciphertext                                                                    |

All four corrections remain within the proposed connection safety boundary. No runtime implementation or product test was performed. A review assignment is procedurally read-only; it does not technically remove inherited tool access. Independent approval does not imply owner acceptance.

## Planning quality and publication

Direct Markdown validation of all five documents, explicit Prettier and new relative-link checks passed. The complete previous session body remains byte-for-byte intact. A local Markdown invocation initially used an unavailable direct dependency/config path; the corrected check resolves the existing CLI dependency and repository configuration. The retained historical title uses a scoped MD025 directive. No lint rules for the new plan were weakened.

The source-aware critic approved the corrected plan hash `2f416b17ea258cb9b8e05826a0b56a8b6adadf3e14c46595f1015912dff7773a`, verification hash `11e67535d51f6a0f0b0a8512aed4223ede04e34a359279f83a9dc54aeac0151c` and spec hash `e79c5283793ab9efcf69488ae278292dbef9ab072d36df3bc74427e583dd1af5`. Hashes describe the reviewed bytes, not a product qualification.

Planning publication requires normal commit/push hooks and complete branch-specific Notion body/source/hash/destination readbacks before the owner briefing. Final publication receipts are maintained outside the mirrored source to avoid self-referential revision churn, in the scoped external evidence directory `/Users/letuscode/.codex/mcp-onboarding-plan-20261013`; no test success is inferred from those receipts. Product execution results will be appended against actual implementation revisions after owner agreement.

## Execution update — 13 October 2026

The owner approved reviewed planning revision `f75fba7de65957e071a6cf7e99ad860cfddd01b9`
and instructed delivery of the epic's concrete tasks. The sole live child remains
`agent-platform-mcp-onboarding`; the broader registry epic and paused orchestration are separate.
The planning-only statements above describe that earlier phase, not current authority.

Implementation is on `task/mcp-onboarding-connection` from the reviewed planning tip.
Runtime implementation is committed at `ab98c705eda72025aeadc8aebebb75f6bd5a1c06`;
the reviewed test-only fixture repair is pushed at `4769f41c9a67e6e362b42b80a7ec1cf37881f513`.
Current `task/mcp-onboarding-verification` branches from that qualified connection tip to record delivery results.
The owner authorized documentation publication, the cumulative PR and hosted checks/reviews to merge readiness, without merging.
No hosted qualification, owner acceptance or merge is claimed before its actual gates.
The scoped evidence root is `/Users/letuscode/.codex/mcp-onboarding-plan-20261013`.

### Implemented behavior

Shared validation now governs import/save/Test/chat. Env/header values use encrypted
server-owned storage with masked public fields and explicit retain/replace/clear behavior.
Legacy malformed or unsafe records fail closed; successful migration is atomic.
Connection tests discover and trust-filter without calling tools. Actual chat uses the same
resolver and binds approval to assignment/configuration/schema, halting on stale or uncertain
outcomes without automatic replay. The existing settings UI reviews imports, explains the
execution host, manages credentials and marks stale test results.

### Independent implementation findings

| Finding                                         | Disposition                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MCP-I01 malformed legacy metadata/envelopes     | Corrected: activation fails closed; retained storage is not silently rewritten; focused tests pass                                                     |
| MCP-I02 pre-stream model/lock failure leaks     | Corrected: acquired MCP context is closed on model-resolution or lock failure; real-process tests pass                                                 |
| MCP-I03 repeated assignment/session ownership   | Corrected: deduplicated assignment and serialized manager ownership; real lifecycle tests pass                                                         |
| MCP-I04 failure evidence prevents teardown      | Corrected: guarded observations and independent finally cleanup preserve original failures; critic approved                                            |
| MCP-I05 terminal MCP failure appears successful | Corrected: explicit MCP halt discriminator drives normal/resumed task-end and V1 failure categories; 14 harness and 16 API tests pass; critic approved |

The critic inspected cumulative production source and found no further concrete backend
blocker. Connected browser/native evidence is verified below; full regression and hosted gates
remain separate.
The joined unknown-outcome journey also exposed an approval-card success label after
an uncertain result. The bounded terminal-state repair is source-reviewed and passes 22 focused
tests plus the final browser unknown/reload scenario. No retry or completed label is shown.
Final acceptance critique found one missing composed context-budget refusal test (MCP-Q01).
The added real API/SQLite/MCP test passes: saved input budget1, real discovered eligible catalog,
zero provider calls/effects/approvals, and durable context/request refusal diagnostics. No
production change was needed for that case. The critic verified the exact test and terminal
16/16 log, and approved the cumulative source and connected evidence with no remaining findings.

### Current test evidence and remaining qualification

- Shared contract, DB secret/migration, real-transport API, adapter and real-process chat tests
  passed in focused runs. Full repository typecheck passed before the last diagnostic/UI changes;
  final cumulative typecheck and lint now pass. A deliberate header-control regex was replaced
  with an equivalent character-code predicate; all128 ASCII values and representative Unicode
  pass equivalence coverage, and the critic approved the exact source/test delta. Historical
  connected receipts retain their original hashes and remain applicable to accepted inputs.
- Final browser suite **7/7 passed in 24.1 seconds**, zero skips, on rebuilt API/web images.
  Import/Test/assignment, approve, reject, Block, stale credentials and unknown outcome/reload
  have independent backend/effect assertions. `browser-final-verification.json` binds source,
  image IDs and artifacts. Compose diagnostic export remains denied by its existing boundary;
  native export evidence below supplies the required V1 reports.
- Final source-tree Electron suite **3/3 passed in 43.6 seconds**: stdio, Streamable HTTP and
  unknown outcome, including import/Test/assignment/restart and actual UI approval. Successful
  cases record one effect/two model requests; unknown records one effect/one model request,
  no replay and a failed terminal request. All cleanup evidence is clear.
- Final official upstream native reference refresh **2/2 passed in 15.5 seconds**, using pinned
  Everything 1.0.0, client SDK 1.29.0 and reference SDK 1.32.1, actual UI approval and read-only echo.
  `native-final-verification.json` binds current source, native/upstream artifacts and V1 reports;
  earlier package integrity remains in `upstream-reference/native-interoperability-result.json`.
- Actual waiting, successful and failed native V1 reports are durable/verified, untruncated,
  with zero dropped, pending, conflict or pruned records. Unknown ends failed/tool_error; nested
  outer/inner tool spans do not imply duplicate side effects. This is deterministic-provider,
  source-tree proof, not live-model or checkout-free release qualification or a latency benchmark.
- Earlier native startup/report HTTP 503 failures and assertion errors remain in evidence. Final runs
  pass after observable test-control corrections and the product terminal-state repair; resource
  pressure was a hypothesis, not an established sole cause. No timeout/policy was weakened.
- Initial broad unit run failed three existing workflow-control tests. All three pass isolated
  at unchanged timeouts. The 100 ms lease fixture also uses real monotonic elapsed time; concurrent
  load is plausible but not proven as the sole cause. No paused runtime/test policy was changed.
  `workflow-failure-diagnosis.json` and `workflow-failures-isolated.log` retain the diagnosis.
  The later four-fork full run again failed: 1,137 passed, 4 failed, 77 existing optional skips in
  workflow-control, stopping later tiers. Two lease failures and two five-second timeouts
  all pass individually at one fork with identical assertions/timeouts. The complete one-fork
  run then passed: **2,958 passed, 77 existing optional skips, zero failures** across 15 packages.
  Workflow-control itself passed 1,141 with 77 optional skips. `final-broad-verification.json` and
  `final-regression-diagnosis.json` bind exact source/logs, both scheduling settings and failures.
  Full typecheck, lint, root formatting, explicit TSX/MJS formatting and direct Markdown pass.
  Sonar/IDE Problems tools were unavailable locally; the documented local fallback passed.
  Hosted Sonar/CodeQL remain separate mandatory PR evidence.

A later normal push hook failed an existing error-middleware fixture (HTTP400 instead of404).
An owned-server probe reproduced a host test hazard: IPv4 and IPv6 wildcard listeners can own
separate servers on the same port while Supertest sends to127.0.0.1. The identity of the original
400 responder is unknown. Subsequent full API verification exposed other bare-listener fixtures.
The completed test-only repair binds 23 affected fixtures to owned IPv4 listeners, awaits their
cleanup and adds route-ownership proof. The complete API run at that checkpoint passed **276 tests across
35 files, zero failures or skips**, in 39.28 seconds; `ipv4-all-fixtures-verification.json` binds
source hashes and the terminal log. Original assertions, runtime behavior and timeouts remain
unchanged. Final critique then identified session-chat SQLite disposal occurring before its
owned listener closed. That test-only teardown-order repair passed all 39 session-chat tests
with tracing disabled and independent source review; the 276-pass log predates it. The first
focused run omitted tracing-off exports and logged denied tracing requests; its evidence is
retained separately from the corrected run. The earlier 2,958-test full pass
remains evidence for its run; it was not repeated at
this later fixture-only delta and does not qualify the failed push hook.

Runtime source remains committed at `ab98c705`; the reviewed test-only fixture repair is
committed and pushed at `4769f41c9a67e6e362b42b80a7ec1cf37881f513`. Final fixture critique is approved.
The subsequent normal, unmodified push gate passed build, typecheck, cycles and **1,715 tests across
seven affected packages**, including **276 API tests after the final cleanup repair**.
`implementation-push-qualified.json` binds the exact local/remote tip and successful terminal log;
the earlier failed push remains retained. This affected-package gate is distinct from the historical
2,958-test full-suite run. Full source-bound documentation readbacks
and exact-head hosted checks also remain delivery gates. Final owner acceptance and authorized feature
merge remain separate. No setup or product decision is currently required from the owner.
No task closure or staging readiness is claimed.

### PR312 publication and hosted quality repair

[PR312](https://github.com/jwill9999/agent-platform/pull/312) targets `feature/mcp-onboarding`.
All seven complete verification-branch documentation mirrors were published and read back at
`a2b80f44842cce2847dd071e6a0c40b9c534eddf`; `publication-a2b80f44.json` records body, revision,
hash and destination verification, independently approved. Earlier publication requirements
above describe their respective checkpoints. Subsequent changed documents require fresh readbacks.

The first hosted Sonar quality gate passed, but detailed inspection found 16 open maintainability
findings. These were repaired rather than dismissed: equivalent contract predicates, smaller
credential and approval helpers, semantic status outputs, explicit branches, synchronous Express
handlers and an equivalent raw fixture string. No security policy, timeout or assertion was weakened.
Focused verification passed **174 tests**: 27 contract/database, 34 web, 93 harness and 20 API.
Build/typecheck, scoped lint/format and diff checks passed. An exhaustive 1,114,112-code-point
comparison verifies contract predicate equivalence, including lone surrogates. The generated
upstream program remains byte-identical at 501 bytes; eight fixture-response and nine denial-code
cases preserve behavior. Independent review approved all ten frozen source files with no findings.
The three `pr312-*-sonar-*.json` receipts retain source and test bindings.

Fresh exact-head hosted qualification is still required after this repair. Sourcery skipped PR312
because its diff exceeds the 150,000-character review limit; this is a review limitation, not a pass.
Independent source review remains recorded. The feature-targeted packaged VM skip does not qualify
a future staging promotion. Full staging security analysis and actual packaged VM execution are
separate future gates. No owner acceptance, merge or staging readiness is claimed here.
