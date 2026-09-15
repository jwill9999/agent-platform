# Current runtime evidence baseline — proposed plan v1

September 15, 2026. **Planning only; owner review pending.** This adds a decision-focused baseline before the existing F1/F2 framework experiments. It does not select a framework, approve implementation, or conclude that the backend is broken. Beads planning record: `agent-platform-harness-baseline-plan`, under the existing modernization epic.

## Decision and scope

Determine which custom harness responsibilities demonstrably work, which have reproducible defects, and where evidence is insufficient to judge retention, repair or replacement. Functional correctness and maintenance cost are separate decision dimensions: working code can still be expensive to maintain, and a failed test does not by itself justify migration.

Start with one supported provider protocol and one Project Chat tool loop. Run sequentially. No new UI framework, telemetry platform, subagent feature, real-model spend or broad migration is part of this plan. The first implementation slice should be reviewed separately before work begins; later slices remain provisional.

## Existing evidence and limits

This table is based on targeted source inspection, not a new run of every listed test. Broader coverage must be mapped before adding duplicate tests.

| Responsibility                        | Existing evidence anchor                                                                                                                                                                               | Boundary and remaining question                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model/provider and message conversion | [LLM reasoning tests](../../../packages/harness/test/llmReason.test.ts), [provider tests](../../../packages/model-router/test/providers.test.ts)                                                       | The reasoning tests mock AI SDK and OpenAI creation. They exercise custom mapping but do not establish the real SDK/provider wire path through the full application |
| Approval, dispatch and effects        | [disposable journey evaluation](../../reviews/project-chat-journey-evaluation.md), [dispatch tests](../../../packages/harness/test/toolDispatch.test.ts)                                               | New journeys verify UI/API/approval/audit/file behavior, but substitute the reasoning node and default VM runner; evaluator nodes are disabled                      |
| Planning                              | [plan-generation tests](../../../packages/harness/test/planGenerate.test.ts)                                                                                                                           | AI SDK is mocked; map exact validation/routing assertions and determine missing composed execution evidence                                                         |
| Critic/completion                     | [critic tests](../../../packages/harness/test/critic.test.ts), [DoD tests](../../../packages/harness/test/dodCheck.test.ts)                                                                            | Includes evaluator substitutions or absent model configuration; inspect actual default evaluator paths before claiming full-chain coverage                          |
| Context, retry and deadlines          | [context tests](../../../packages/harness/test/contextBuilder.test.ts), [retry tests](../../../packages/harness/test/retry.test.ts), [deadline tests](../../../packages/harness/test/deadline.test.ts) | Existing focused tests are valuable; establish whether composed cancellation, accumulated history and retry effects are covered                                     |

A test filename or line coverage percentage is not evidence that a behavioral contract works. Count explicit, verified requirements and declare the path exercised.

## First slice: real model-to-tool loop with a deterministic provider

**Question:** Does the current AI SDK plus LangGraph plus custom application code correctly convert a provider response into one authorized tool action, feed its result back, and complete the user turn?

Use a local protocol fixture at the outbound model HTTP boundary, preserving the real provider factory, AI SDK parsing, reasoning node, graph routing, application authorization, persistence and UI. The fixture supplies protocol-valid streamed text/tool calls and final responses, and records sanitized requests. Do not use the existing whole-reasoning-node override for the code being assessed. Run no external paid calls; fail the fixture if unexpected model requests occur.

First resolve how the production code can be directed to that fixture using existing configuration. The source assessment established that the ordinary reasoning path does not forward custom baseURL. Prefer a supported existing transport/configuration seam. If none exists, propose the smallest test seam and its effect for review; do not silently add end-user URL support or bypass the provider factory. This feasibility check is part of planning the implementation slice, not proof that a fixture route already exists.

### Proposed journey and assertions

1. Open an isolated Project Chat with known file content and approved project onboarding. Record selected provider/model and relevant policy without secrets.
2. Send a request requiring one fixture file operation. The local provider returns a streamed tool request with controlled arguments and call identity.
3. Confirm the real reasoning node converts the tool schema/arguments and emits the expected approval where the selected tool's actual policy requires it. Verify no effect while pending.
4. Approve through the UI. Verify exactly one dispatch and expected file result, and that the provider receives the corresponding tool result under the same call identity.
5. Return a final provider message. Verify streamed content, durable user-visible result and settled execution. Capture reported usage without treating fixture token values as real cost.
6. Repeat with approval denied; after settlement, verify no side effect and a truthful denial response. Reuse the already-built approval checks where possible.
7. Add one controlled provider error/invalid response only if existing tests do not already establish the relevant composed behavior; confirm no fabricated success and retain failure evidence.

For shell actions, the existing fixed-command VM fixture can continue to isolate the external execution boundary. Label it clearly; it must not stand in for the real model-to-tool transformation under assessment. An actual native file tool may reduce fixture scope if its policy and behavior meet the selected journey. Choose the tool explicitly in the implementation specification.

Default mode may include critic/DoD calls. Inventory these before scripting the provider: either provide deterministic valid responses to keep those nodes active, or explicitly identify them as out of the first slice and avoid claiming their coverage. Never silently inherit evaluator-disabling E2E mode.

## Later slices, only after first-slice review

| Slice                   | Evidence question                                                                                           | Proposed minimum variation                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning and completion | Do real plan parsing, routing, critic revision and completion gates execute in the correct order?           | Script a valid plan, an initial revise verdict and a subsequent accepted result; test one unmet completion criterion without replacing the evaluator nodes |
| Execution controls      | Are limits/cancellation/retry enforced in composed execution without duplicate effects or false completion? | One interrupted provider stream, one bounded retry before side effects, and a context/step-limit case selected from actual coverage gaps                   |

These are hypotheses to design and evaluate, not assertions of current defects. Avoid treating disconnected unit tests as the entire composed proof, and avoid replacing those fast unit tests with expensive UI tests. Use integration tests for detailed permutations and a small number of Playwright journeys to prove composition.

## Evidence and scorecard

Each row records: requirement, source revision, test identifier, real/mocked boundaries, expected outcome, observed outcome, reproducible command, artifact reference, result and remaining uncertainty. Results are **verified**, **defect reproduced**, **blocked**, or **not exercised**. Keep fixture failures distinct from product defects. Existing results are not promoted to current verified status without matching execution evidence.

Capture provider request/response sequencing, application stream events, approval/session/run identifiers, durable audit facts and before/after file state. Correlate resumed runs via the durable approval/session; do not assume the run ID remains unchanged. Existing logging lacks a complete durable graph span tree: state that limitation, and add only narrowly justified test capture needed for a specific assertion. Store sanitized artifacts on success and failure and clean up disposable data reliably.

Attach a separate maintainability observation to each candidate replacement: current responsibility, potential library replacement, application policy that remains, adaptation cost and evidence confidence. A passing functional baseline does not measure migration savings.

## Delivery order, limits and review points

The next implementation proposal should first resolve the provider fixture seam and enumerate existing coverage. Deliver one provider/one journey family before expanding. A provisional budget is 0.5–1 developer-day for the coverage/seam spike, followed by 1–2 developer-days for the first journey and scorecard if the seam is straightforward. These are planning estimates, not commitments or approved spend. At the spike boundary, report the evidence and any required production seam before extending scope. Later slices are not estimated until their coverage gaps are known.

Review the first scorecard with the owner. Decide whether enough evidence exists for a bounded framework comparison or whether one specific unresolved behavior warrants another test. Do not wait for exhaustive coverage to make a narrow decision. Existing F1/F2/F3 experiment tasks remain queued; no hard dependency edges or original acceptance gates are closed by this proposal.

## Acceptance of the planning deliverable

The plan names the decision, current evidence, first journey, mock boundary, evidence schema, sequential scope, uncertainty and stop conditions. Owner review is required before implementation of this next baseline slice. This document is a planning proposal, not a validated workflow-control execution contract or authorization for a managed launch.
