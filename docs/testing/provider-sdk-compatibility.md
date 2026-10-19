# Provider SDK compatibility verification

Status: implementation and qualification in progress; partial results are recorded in the
[review/results](../reviews/provider-sdk-compatibility.md). Required connected and hosted gates remain open. [Plan/requirements](../planning/provider-sdk-compatibility.md).
Owner permits researched emulated services; no paid CI calls. Disposable DB/Projects/keys/ports,
Node24.14/normal hooks/single worker/scoped tracingfalse, Docker gateway disabled.
Provider task owns final integration; diagnostics task owns S04/S05. Preserve failures and raw evidence.
For the pinned Vitest 4 cohort, use command-scoped `VITEST_MAX_WORKERS=1`; its old MAX_FORKS/MIN_FORKS
variables do not select a worker limit. CI retains its explicit maxWorkers/file-serial flags. Do not
change test assertions/deadlines or global configuration to accommodate a failed local run.

| Scenario                            | Requirement    | Method and evidence                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 native five + OpenRouter/Ollama | R1/R2          | Real pinned SDK against researched HTTP fixtures; exact request/response, streaming/tool args/usage. OpenAI Responses max_output_tokens/store:false, no max_tokens or unsupported temperature. Cover all five native rows and alternative adapters, no live-account claim.                                                                                                |
| S02 harness regression              | R1             | Existing unit/integration fixtures updated for SDK API; unchanged outer retry/Stop/backoff/partial text/length→no effects/fragmented tool args/output caps/context/unknown usage semantics.                                                                                                                                                                               |
| S03 config/endpoint/migration       | R3             | API+realSQLite create/edit/select/reopen all providers. Keys encrypted, model case preserved, unknown provider rejected. Credential clearing on provider change. Reject unsafe URL/redirect/key forwarding; explicit loopback works. Fresh/additive migration/reopen/backward histories and failure preservation, never owner DB.                                         |
| S04 honest probes                   | R4             | Real SDK HTTP400 max_tokens,401/403/404/429quota+rate/500/disconnect/timeout/malformed success/valid output. Exactly1request/no retries, bounded deadline; false stays false with fixed safe category. No raw secret/provider body.                                                                                                                                       |
| S05 durable probe outcomes          | R6             | Connected settings success+failure stored/exported/restarted with correlation/provider/duration. Store/logger failures preserve result. Check coverage/loss and secret/raw/private marker exclusion.                                                                                                                                                                      |
| S06 private continuation            | R5             | SDK Responses encrypted reasoning+function call→valid approval/tool output→second request. Distinguish same-process SQLite reopen from a real process restart. Completed-history continuation survives restart; old pending approvals remain interrupted. No server-only references/previous_response_id. Anthropic/Google signatures and private-data exclusion covered. |
| S07 private failure/switch          | R3/R5          | Corrupt/wrong-key/binding/missing/oversize/duplicate IDs/mismatched args fail before effects. Completed-turn switch retains public groups, drops foreign private data; pending switch blocks resume. Context estimate includes private bytes; group trimming stays atomic. Session cascade; legacy history works.                                                         |
| S08 browser                         | R2/R3/R4/R6/R7 | Connected Models UI+realAPI/DB/SDK fixture: create/edit/test providers, visible accessible failure; choose alternative in Project chat, verify actual provider request/persisted reply. Existing Git/Stop/MCP/reply/context/diagnostic paths regress.                                                                                                                     |
| S09 Electron                        | R5/R7          | Real backend/native disposable profile: approve before restart and verify one effect; restart completed history and replay private continuation, deny another action with no effect; restart pending work and assert409/no provider request/tool/file effect. Save/reopen/text/Stop/export and existing desktop/MIG-R06 regressions remain; never owner profile.          |
| S10 diagnostic review               | R6/R7          | Export actual app success and failure/wait reports, inspect waits/retries/coverage/freshness/drops/privacy. Confirm facts vs hypotheses; fix in-scope/deduplicate other Beads findings. Development transcript is not app report.                                                                                                                                         |
| S11 quality/hosted                  | All            | Builds/types/lint/format/full affected suites/unchanged900measured990call benchmark+limits/audit. Frozen source+evidence critic, exact-head checks/Sonar/CodeQL/comments. Protected full Promptfoo/VM required for staging promotion. No waived failures or blind reruns.                                                                                                 |
| S12 owner app preflight             | R7             | After tested build, coordinate rebuild/restart preserving profile/key/DB backup. Verify migrations/recording/export/restart. Owner-run real model or separately approved live request required before stress-ready claim; no paid test implied.                                                                                                                           |

Report pass/fail/skip/blocked/not-run, exact source/versions/run/attempt, assertions/retries and evidence.
Required failed or unexecuted connected journeys block delivery. Emulation does not prove live model
quality/availability/account permissions. No deadline increases or paused test changes in this scope.

S06/S07 additionally verify stable IDs/independent required-format marker, removed required private
row, atomic public/private write failure before approval/tool effect, crash/restart and repeated
persistence callback without duplicate records/effects. S04/S05/S10 additionally force streamed,
malformed-response, retry and plugin error paths containing secret/private markers; every public sink
must exclude them while preserving safe outcome, Stop identity and internal retry classification.

## Reviewed restart and persistence corrections

SDK-I01: the initial native approval/restart expectation conflicted with the existing Stop policy.
Startup marks previous-process runs interrupted; their approvals cannot dispatch. Independent review
approved the explicit S06/S09 correction on18October. Retain the failed native-second trace; it is
evidence of the test expectation error, not a failed protection. Same-process database reopening does
not qualify process restart. The revised journey must verify both valid continuation and stale denial.

SDK-I02: after an atomic assistant persistence barrier, checkpoint only the text already committed.
Stop/error must not duplicate that prefix, and a later partial reply must remain saveable once. Failed
commits must retain the unsaved buffer; final markSaved remains terminal. Persist completed tool
outcomes before the next model request so a later provider error cannot erase ordered history.

Plain nonthinking local text without a secrets master key must retain its existing behavior. Required
private provider content or durable tool bindings must fail closed when they cannot be persisted;
never create a default key or silently downgrade opaque continuation to legacy history.

## Legacy-watermark upgrade regressions

Owner: `agent-platform-sdk-legacy-migration`; requirements MIG-S1–6 in the
[repair specification](../tasks/agent-platform-sdk-legacy-migration.md). Synthetic fixtures only.

| Scenario                                 | Requirement | Input/action and independent expected evidence                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK-MIG01 eligible upgrade and reopen    | S1–4        | Real SQLite canonical0000–0020 plus valid opaque later journal entry, retained records and encrypted credential. Official open appends exactly original0021 hash/time; every original column value and full ordered journal prefix unchanged. Reopen is idempotent; no decryption/logged key.                                                                                                             |
| SDK-MIG02 existing adopters              | S1/S3       | Complete canonical0021 with later opaque entry reopens unchanged; no repeated DDL or journal row.                                                                                                                                                                                                                                                                                                         |
| SDK-MIG03 history denial                 | S2–4        | Missing/wrong-time/duplicate predecessors; malformed/duplicate journal; wrong SDK SQL/hash/time; any other below-water pending migration. Same safe error, unchanged schema/rows/journal and released lock.                                                                                                                                                                                               |
| SDK-MIG04 schema denial and rollback     | S2–4        | Partial SDK columns/table, differing defaults/checks/index definitions, scoped or migration-journal trigger, legacy backfill-needed schema and controlled mid-transaction failure. Eligibility denies or real transaction rolls back; no partial SDK stamp/effect. Journal triggers cannot alter original rows; the postcondition requires the exact original ordered journal plus one canonical0021 row. |
| SDK-MIG05 native managed startup/restart | S5/S6       | Real Electron/Node/SQLite/disposable native profile with owner-shaped history; visible retained model/Project data, health200, exact canonical SDK addition and unchanged original records/journal. Clean restart preserves state. Existing invalid-history native denial remains. Owned ports/processes released, no live generation.                                                                    |
| SDK-MIG06 owner preflight                | S6          | After actual protected delivery/build, private stopped-profile backup with original key and20GiB free; official private-copy upgrade first. Then native recording/export/clean restart with retained configs and truthful coverage. Owner live model check is separately manual before stress-ready claim.                                                                                                |

Use explicit Node24.14, normal hooks and single workers. Affected DB tests, native migration and SDK
continuation cases run locally; ordinary CI/browser/Electron, unchanged raw900/990 performance,
Sonar/CodeQL and actual protected scan/signed packagedVM qualify the exact delivered head. No budget,
assertion, workload, durability or history condition is weakened. A backend-only repair does not add
a dashboard or unrelated UI feature; native startup is required and public API/model regressions remain.

Escape analysis: previous positive fixtures modeled an ordinary v18 upgrade; the complete-unknown
fixture already had every known migration. The negative future-watermark case correctly checked
rejection. None exercised the repaired pre0021 profile retaining a later opaque journal entry. Add
that recurring scenario to ordinary DB and native CI, without treating the development transcript
as product diagnostics or claiming unknown-entry provenance.

Historical variant: SDK-MIG01/02/04/05 include the exact hash/time-bound nullable TEXT
workspace_events_json addition, positioned before0021. Derive trusted references from canonical
SQL plus the independently reconstructed legacy statement, never actual owner DDL. Preserve non-null
opaque values on upgrade/reopen; wrong binding, missing row, duplicate identity, altered type/default/
column order/extra definition and unrecognized schema fail closed. The historical ALTER is reference/
fixture-only and never replayed on the owner. Source identity proof does not establish its old commit
or execution provenance. Actual private-copy eligibility matched all34 derived definitions.

SDK-MIG02/04 also exercise historical-adopter reopen after a successful bridge: missing legacy
prerequisites or a journal trigger deny before incidental backfill, preserving schema/all rows/journal
and releasing the connection lock. Exactly22 published migrations are recognized; future extension
requires reviewed reference/identity coverage. Local81 controls and focused native/SDK results are
recorded in the review. Full73-case collection is inventory; fresh hosted execution remains mandatory.
