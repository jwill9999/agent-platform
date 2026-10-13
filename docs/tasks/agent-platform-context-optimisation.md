# Task: Context window and token optimisation — local MVP

Actual implementation outcomes: [result record](../reviews/context-token-optimisation-results.md).

**Beads issue:** `agent-platform-context-optimisation`

**Priority:** P1 (live Beads; corrects historical P2 document label).

**Related closed foundation:** `agent-platform-memory`; this task is independently scheduled.

**Status:** Implementation in progress under owner approval; final verification and integration remain open.

## Summary and owner scope

Make normal local session/Project Chat reasoning requests bounded and inspectable as history and tool
loops grow. Reuse current working memory and V1 diagnostics. The owner selected this task on 13 October
and asked for Feature Planning plus independent critique, with a plan presented before implementation.
The owner subsequently approved the plan and requested implementation, critic review and agreed tests.
Distribution architecture and releases to other users remain phase two.

Canonical detail: [MVP plan](../planning/context-token-optimisation-mvp.md),
[verification map](../testing/context-token-optimisation-mvp.md),
[critic record](../reviews/context-token-optimisation-plan-review.md).
The plan replaces this document's historical timing proposal; it does not reopen the memory epic.

## Task requirements and acceptance

- CT-R1: Budget initial, subsequent and resumed conversational reasoning calls through one shared
  provider projection, replacing the old initial lossy cutoff and retaining stable payload/cap across
  a retry. Auxiliary model calls are excluded.
- CT-R2: Count complete selected messages and mapped tool schemas under an explicitly approximate
  input budget with 10% margin. The input8000 default has a measured feasibility conflict and an owner decision pending in the plan;
  retain it until resolved. Default output2048; persist configurable output cap,
  preserve configured model/provider and distinguish cumulative run limits and actual provider usage.
- CT-R3: Preserve current instructions/request/continuity and atomic tool groups; reuse scoped durable
  working memory; leave transcript/audit/effect persistence unchanged. Accept legacy strategy values
  with explicitly documented effective deterministic policy, without claiming generative summarisation.
- CT-R4: Required-content overflow halts before that provider call, visibly and without retry/replay;
  retain prior effects/messages, settle the stream, release the session and report failure honestly.
  Existing approval, cancellation, deadline and policy authority remain unchanged.
- CT-R5: V1 report/CLI exposes strict content-free decision metadata and honest coverage, backward
  compatible with existing records; diagnostics failure must not affect execution admission.

The [plan](../planning/context-token-optimisation-mvp.md) defines exact semantics and non-goals.
The bounded scope is approved. Implementation/test results are recorded separately and do not imply delivery.

## Dependency order

No open blocking edges currently exist in Beads. Closed capability prerequisites verified during
planning: `agent-platform-memory.2`, `agent-platform-memory.4`, `agent-platform-harness-v1`.
Existing deferred downstream D1/K4 records remain untouched; this task does not start them.
The broader V5 local HTTP test-isolation finding must inform new/touched fixtures; unrelated suite
failures must be diagnosed, not waived. No blanket dependency on all of V5 or old review-gate records.

## Implementation plan and branch mapping

Runtime baseline: staging `d199ad0172dfe016490533444d5b7c46733c8f4d`.
Planning work: `feature/context-token-optimisation` → `task/context-token-plan`.
The authorised chained implementation branches are `task/context-token-boundary` →
`task/context-token-verification`, with one final cumulative segment-tip PR to the feature.
The existing Beads task owns all slices; no new epic or independent completion claims per slice.
Refresh staging/ref compatibility before execution and preserve separate PR308 and all paused work.

1. Pin boundary/error/configuration semantics and regression fixtures (CT-T01–03).
2. Implement shared projection, chat/resume policy propagation, cap and diagnostics (CT-T04–11).
3. Verify connected journeys and full regression/diagnostic evidence (CT-T12–13), independent source
   review, publication and exact-head CI. Do not close the task before actual feature integration.

Expected scope and 2.5–4 day provisional effort, pause/escalation thresholds, costs and destinations
are in the plan. No new tokenizer service, model summariser, framework upgrade, dashboard, distributed
architecture, automatic session selection change or prototype resumption.

## Gherkin E2E strategy

The [verification map](../testing/context-token-optimisation-mvp.md#connected-gherkin-strategy)
contains the authoritative Gherkin scenarios: long-chat success, mandatory overflow/recovery,
approved effect followed by reasoning overflow, and restart/local export. CT-T12 requires the real
UI plus independent backend/SQLite/audit/effect evidence and bounded synthetic provider captures.
No live-provider or release-artifact claim follows from deterministic fixture passes.

## Definition of done and sign-off

All CT-R1–R5 and required CT-T01–T13 pass on the actual final source; every exclusion has an explicit
reason. Independent review has no unresolved actionable findings, V1 reports reviewed at both
checkpoints, scoped local and hosted quality/security/UI gates pass, full result and documentation
mirrors are read back, source pushed and authorised feature PR merged, Beads read back and Dolt synced.
Protected staging needs its own authority and full gates. Main/distribution are outside this task.

Planning sign-off is narrower: complete reviewed plan/spec/test map, Beads alignment, preserved prior
scope/history, pushed documentation and full mirror verification; product task stays in progress.
Actual implementation results will be recorded at `docs/reviews/context-token-optimisation-results.md`
during implementation. A draft or partial result record does not establish final acceptance.
