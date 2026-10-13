# Context and token optimisation — bounded local MVP plan

**Owner task:** `agent-platform-context-optimisation` — Add context window and token optimisation.

**Status:** Proposed implementation scope; planning authorised on 13 October 2026.

**Runtime source reviewed:** `d199ad0172dfe016490533444d5b7c46733c8f4d` (`origin/staging`).

## Outcome and stopping point

Keep local Project Chat and ordinary session chat useful as conversations and tool loops grow.
Before each in-scope reasoning request, send a bounded, valid context containing required instructions,
the current request and existing scoped continuity information. If required content cannot fit, stop
with an understandable explanation instead of sending a knowingly oversized request or silently
removing instructions. Use the V1 diagnostic export to explain the decision.

Stop when first-call, multi-tool-loop and approval-resume journeys meet the verification map, with
short-chat regression and restart evidence. This is one implementation task with three internal
slices, not a new infrastructure programme. A green unit suite alone does not meet the stopping point.

Owner explicitly requested a reviewed plan **before implementation**. This document and its publication
are not implementation, paid-call, merge, staging-promotion or release approval. Phase one remains a
working local single-user MVP; distribution, multi-user architecture and its operating model are phase two.

## Existing foundations and verified gaps

| Source at reviewed revision                                                 | Finding and implication                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/agent.ts`                                           | Existing agent `contextWindow.maxInputTokens` defaults to 8000 and accepts `truncate`/`summarize`; task spec's old P2 priority differs from live P1 Beads.                                                          |
| `packages/harness/src/contextBuilder.ts`, `tokenCount.ts`                   | Approximate character counting and newest-first individual-message selection exist. Required system/user messages are returned even over budget; strategy does not change selection. Tool schemas are not included. |
| `apps/api/src/infrastructure/http/v1/chatRouter.ts`                         | Initial chat builds windowed history plus project instructions, working memory and retrieved memory. Approval resume has a different construction path.                                                             |
| `packages/harness/src/nodes/llmReason.ts`                                   | Every reasoning call converts accumulated graph messages and schemas to SDK input; subsequent calls lack another context guard. AI SDK `streamText` has no explicit output-token limit here.                        |
| `packages/harness/src/graphState.ts`                                        | Messages use an append reducer. Replacing that state with compacted provider messages could break persistence offsets or replay accounting. Keep provider projection separate.                                      |
| `packages/db/src/repositories/workingMemory.ts`, chat router memory helpers | Durable structured memory already exists and is refreshed after normal runs/resume. It is continuity data, not approval authority or a guaranteed perfect semantic summary.                                         |
| `packages/contracts/src/diagnostics.ts`, API diagnostic observations        | V1 has strict metadata allowlists and exports. Context-decision fields are not currently exposed; add only bounded typed counters/reasons needed for this task.                                                     |

Beads records a June incident with 87 messages, large tool outputs and a TPM rejection. This is useful
historical evidence, not a newly reproduced failure or proof of one present-day cause. Input budgeting
can reduce avoidable request volume; it cannot guarantee provider rate limits will never be hit.
Memory epic and tasks `.2`/`.4` are closed. No dependency on dashboards or paused orchestration is needed.

## Proposed requirements and decisions

### CT-R1 — One admission point for conversational reasoning

Apply a shared provider-context projection in `llmReason` for initial normal chat, subsequent ReAct
iterations, critic-returned revisions that re-enter this node, and approval-resume reasoning. Pass the
resolved agent context policy through `buildInitialState`/graph state; absent values use documented
backward-compatible defaults. Every retry of one logical model operation uses the same already-admitted
snapshot. Config changes take effect on the next run, including a new resumed run; no mid-retry selection drift.

Replace the old initial `buildWindowedContext` truncation in the chat router; do not layer the new
projection over history it has already discarded. Both normal and resumed assembly supply complete
validated session history, scoped continuity and explicit current-turn identity to the shared projection.
The full graph/persistence stream remains separate from the admitted provider view; preserve append
offsets and reconstructed approval-call accounting. Add a regression whose old cutoff would bisect
a multi-tool group. This is a change to request assembly, not deletion or rewriting of stored history.

Independent planner, critic-model, DoD, sensor, connection-test and deprecated `/stream` calls are
outside this first slice. Inventory them in the result report; do not claim provider-wide enforcement.
Do not change their budgets, SDK versions, model routing or evaluator activation.

### CT-R2 — Explicit estimated input and bounded output

Retain the existing **8000 estimated input tokens** default. Count the actual selected message roles,
content, tool names/IDs/arguments/results and the final mapped tool definitions/schema descriptions
used by the SDK, not only plain text. Define a versioned deterministic estimator covering the serialised
request data. Retain character-based estimation for this MVP; test Unicode and JSON escaping and label
all counts as estimates. Reserve 10% of the configured input allowance for unmodelled provider framing:
`admissionEstimate <= floor(maxInputTokens * 0.9)`. The margin is a conservative policy choice, not a
measured accuracy guarantee. Keep estimated and provider-reported usage distinct.

Propose `contextWindow.maxOutputTokens`, default **2048**, positive integer, persisted through the
existing agent configuration API. Pass it to installed AI SDK 4.3.19's `maxTokens` request option.
Input allowance and output allowance are separate; neither is the existing cumulative run
`executionLimits.maxTokens`. Document that the owner must configure their sum below the selected
provider/model context capacity. Automatic model-capacity discovery and a universal exact tokenizer
are deferred. A provider-specific incompatibility fails visibly; never silently remove the cap or retry
without it. No new settings screen: document the existing configuration API and preserve copy/save round trips.

Surface provider length-limited completion as incomplete, not successful task completion. Preserve
partial text as such and prohibit dispatch of incomplete/invalid tool arguments. Test actual installed
provider serialization using a local protocol fixture; live provider compatibility remains unverified.

### CT-R3 — Atomic history selection and honest continuity

Keep complete assistant tool-call groups and all matching tool results together; never admit an orphan
result, partially matched multi-call group or duplicate result ID. Preserve chronological order. Carry
current user-turn identity explicitly so a resume marker is not mistaken for the original request.
Required content includes effective system/project instructions, the current user request, existing
scoped working-memory summary and latest unresolved/current-turn tool-call group or active feedback.
Keep all completed tool groups from the active user turn available for its next reasoning step;
working memory from a previous run does not summarize those new effects. If a required group cannot
fit, use CT-R4; do not erase arguments/results or remove tool definitions to manufacture a fit.
Completed groups from older user turns may be omitted as complete groups, newest-first, with explicit
omission counts. A long active turn may therefore halt rather than forget its earlier effects; continued
automatic summarisation of an active turn is deferred.
This MVP does not truncate individual tool results or invent replacement result text.

Reuse the already bounded deterministic working-memory fields (goal, task/project, decisions, blockers,
important files, tool summaries, next action). Preserve provenance through session/project/run identity.
Reload from the current session DB for new and resumed runs. Re-check live pending approvals separately;
never infer approval, authority or completion from memory text. Missing or stale continuity is disclosed;
if required current-turn context is unavailable, fail clearly rather than pretend it was remembered.
Do not add a summariser model call, durable transcript rewrite, new storage table or summary service.
The original transcript, audits and completed tool effects remain unchanged by provider projection.

Compatibility: accept existing `truncate` and `summarize` configurations. For this MVP both use safe
group windowing plus existing working memory; report requested strategy and effective policy
`group_window_working_memory_v1` separately. Document `summarize` as a compatibility value, not a promise
of generative summarisation. Do not silently migrate saved records or claim all conversation meaning survives.

### CT-R4 — Safe budget halt, retries and approval resume

When mandatory content plus schema cost exceeds the effective input allowance, return a typed context
budget halt before the provider call: show that the request/context is too large and suggest reducing
input/tools or adjusting the configured budget. Do not put raw provider bodies, prompts or paths in
that error. Mark the run failed/halted, unlock the session and restore the composer; no automatic retry
for this deterministic error. Record no provider attempt when none occurred.

For a later-call overflow, persist completed messages/tool effects through the normal append path and
truthfully state that earlier effects are retained; do not replay or roll back tools. Return accumulated
graph state with the halt so existing persistence offsets remain valid; ensure task-end reporting does
not claim success for this specific halt. On approval resume, existing permission checks and one-time
execution remain authoritative. The approved tool may already have executed before reasoning admission;
if that next call cannot fit, report the completed effect and halt reasoning, not the approved action.
Rejected or cancelled work must never acquire permission through compaction. Do not add new Stop/recovery semantics.

### CT-R5 — Local, content-free explanations

Extend the existing context trace and V1 projection with a fixed, strictly validated context-decision
record: estimator/effective-policy version, configured/effective budget, estimated before/after totals,
schema estimate, included/omitted group counts, configured output cap and decision reason
(`unchanged`, `windowed`, `required_overflow`, `invalid_history`). Distinguish local admission from an
actual model attempt and preserve run/operation correlation. No prompt/tool/memory content, tool names,
API keys, free-text errors, paths or hashes of sensitive content in diagnostics.

Evolve event/report compatibility explicitly: additive optional fields with bounded enums/counts,
old V1 records remain readable and existing strict unknown-field rejection remains. Validate the actual
SQLite event encoding and renderer/export parser before selecting the additive representation; no blind
schema-version bump or permissive free-form metadata. Update readable summary and CLI formatting together.
Use diagnostic reports after meaningful E2E and before completion; missing/dropped records are a coverage
gap, not a clean pass. Diagnostics remain observational: storage failure never changes admission results.

## Implementation boundary and delivery map

| Item                          | Mapping                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing owning task          | `agent-platform-context-optimisation`, P1; in progress for planning only                                                                                                                              |
| Spec / tests / critique       | [Task spec](../tasks/agent-platform-context-optimisation.md), [verification map](../testing/context-token-optimisation-mvp.md), [critic record](../reviews/context-token-optimisation-plan-review.md) |
| Related closed foundation     | `agent-platform-memory`, `.2`, `.4`; V1 `agent-platform-harness-v1`                                                                                                                                   |
| Current checkout              | `/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`                                                                                                                           |
| Feature / planning branch     | `feature/context-token-optimisation` from reviewed staging; `task/context-token-plan`                                                                                                                 |
| Proposed implementation chain | After owner review: `task/context-token-boundary` from planning tip, then `task/context-token-verification`; one cumulative segment-tip PR into the feature                                           |
| Final integration owner       | Same existing Beads task owns all three slices and the connected feature gate; do not close after an intermediate slice                                                                               |
| Ultimate destination          | Protected staging through feature PR only with owner merge authority and all current-head gates; no main/release implied                                                                              |

Expected product paths: contracts agent/context and diagnostic types/tests; harness context builder,
token count, graph state, reasoning node and focused tests; API chat/resume assembly, diagnostic projection
and their tests; existing web error presentation only if needed for safe wording; diagnostic CLI/report
formatters and browser/Electron fixtures. Documentation: configuration, diagnostics guide and results.
No workflow security policy, runner reconfiguration, unrelated Git UI, dependency upgrade or paused branch code.

PR308's documentation-only handoff remains separate and open at planning start; do not merge it as a
side effect. Preserve its phase-one/phase-two owner decision in this plan. The old local
`jwill9999/context-optimisation-session-compaction` branch is retained; its context-start commits changed
session/ignore files only. It is not the implementation base or permission to integrate other historical work.

## Bounded execution, effort and escalation

1. **Boundary and regression evidence:** inspect complete payload construction and add focused controls;
   pin configuration/error/history semantics. Estimated 0.5–1 focused engineering day.
2. **MVP implementation:** shared projection, API/resume propagation, output cap and strict diagnostic
   projection. Estimated 1–2 days.
3. **Connected verification and delivery:** fixture journeys, effect/persistence checks, reports, review,
   documentation and CI. Estimated 1 day plus hosted queue time.

Total estimate **2.5–4 focused engineering days**, not a deadline or commitment to indefinite repair.
Reassess after the first slice. If this requires a new summarisation service, broad graph rewrite,
provider upgrade, non-additive storage redesign or expansion into auxiliary callers, stop that expansion
and return the concrete smaller alternative/decision. Fix routine in-scope defects and critic findings.
Retries are evidence-driven: inspect the failing artifact first; do not repeat unchanged failures or hide
flakiness with increased timeouts. No paid calls or external dashboard installation in planned tests.

## Feasibility, tests and acceptance

Docker engine 29.8.0 was reachable and hosted `dev` macOS/ARM64 runner online/idle at planning inspection.
Existing provider-journey and diagnostic-export fixtures supply isolated data, ports and deterministic
provider responses. Other running containers were left untouched. No connected test has run for this
proposal. Use repository Docker runtime for browser/API tests and the supported standalone desktop
harness for Electron; preserve local diagnostic topology restrictions. Before implementation verify
fixture images, browser/Electron assets and ports, and provision only owned disposable resources.

Use explicit matching loopback binding in new/touched local HTTP fixtures. Existing V5's broader macOS
HTTP isolation finding remains open; this plan does not promise to repair unrelated suites or waive
required failures. Credentials are fixture-only; do not read user secrets or issue paid requests.

The [verification map](../testing/context-token-optimisation-mvp.md) defines the measurable gate.
Owner agreement is needed on this proposed scope before implementation. Planning completion means
critic findings resolved, consistent Beads/spec/verification, pushed source and full mirror readbacks;
it does not mean product tests passed or the feature is delivered.
