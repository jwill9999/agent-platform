<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Independent critique: agent harness research

Reviewed 2026-09-13 against checkout `4ae83195f78fbeacc73ff2a700331542ed89520f` and live official documentation. This is a research review, not execution-plan approval or production certification. Repository reads only; no tests, Beads mutations, Git mutations or dependency installations.

## Verdict

The initial assessment is directionally sound, especially its separation of platform governance from execution mechanics. It is not yet a sufficient basis to select a replacement framework. The most consequential corrections are to make approval recovery and budget semantics concrete, avoid understating existing tool bounds, and treat frontend event delivery as a first-class capability. A smaller local release must not inherit hosted-service requirements by default.

Priority labels indicate research/implementation attention, not reproduced incident severity. “Confirmed gap” means demonstrated by inspected source within the stated path; inferred failure scenarios still require runtime proof.

## Findings

### 1. High: approval claim is not durable execution completion

**Classification: partial implementation, with a confirmed recovery-design gap in the inspected resume path.**

The platform already atomically prevents duplicate approval claims; it does not simply lack duplicate handling. `packages/db/src/repositories/approvalRequests.ts:199` checks approval state and conditionally sets `resumedAtMs` at line 216. `apps/api/src/infrastructure/http/v1/chatRouter.ts:1207` performs this claim before dispatch, while lines 1181–1183 return early whenever that timestamp exists. Tool dispatch occurs at line 1270 and new messages are persisted after graph execution at line 1308.

**Correction:** distinguish claimed, executing, succeeded, failed and outcome-unknown. A process death after claim but before tool dispatch can leave a request marked resumed although no execution occurred; death after a side effect but before persistence can leave its outcome unknown. These are source-inferred crash windows, not reproduced failures. Adding a checkpointer alone would not make the separate DB claim and external action atomic.

**Impact:** recoverability should lead the work, with an explicit reconciliation policy for each side-effect class. Do not “fix” it by blindly clearing the claim and rerunning tools. Include crash injection before dispatch and after the external action, plus concurrent duplicate resume tests.

### 2. High: define budget scope across approval continuations before claiming whole-task control

**Classification: confirmed behavior; requirement gap conditional on logical-task budget promise.**

Resume allocates a new run ID at `chatRouter.ts:1201`, then calls `buildInitialState` for dispatch and continuation. That helper resets steps, token/cost/tool totals, retries and start time at lines 1660–1668. `packages/contracts/src/limits.ts:3` intentionally describes caps for a single agent run.

**Correction:** do not label this automatically a violation of the current contract. It is consistent with treating each resume as a new run. But a user who expects a budget for the original task will not receive that guarantee. Define session, logical task, execution attempt and child-run budgets explicitly, and carry aggregate accounting across the chosen boundary. `maxCostUnits` is explicitly an internal unit; monetary budgets are not established requirements.

**Impact:** important for useful user-facing remaining-budget displays and safe delegation; premature UI totals could mislead users even if per-run enforcement works.

### 3. High: context management gap is within the loop, not universal absence of output limits

**Classification: partial implementation.**

The initial brief correctly recognizes memory. More specifically, `chatRouter.ts:1584` windows initial input, whereas `packages/harness/src/nodes/llmReason.ts:632` converts the accumulated state messages directly for each model call. `packages/harness/src/graphState.ts:46` appends messages. No per-model-call windowing appears in that path. Required input can exceed the configured window (`contextBuilder.ts:48`).

However, many native tools already bound output: `tools/qualityGateTool.ts:364`, `tools/gitTools.ts:381`, `tools/browserTools.ts:1128`, `tools/mediumRiskTools.ts:290`, and repository-discovery caps. A blanket recommendation to add output caps would duplicate existing work.

**Correction:** audit coverage, especially external MCP results; measure growth through repeated tool calls; then introduce context budgeting before each model call, retaining instructions and valid tool-call/result relationships. Test long-loop success, not just an oversized first message. Compare pruning/compaction on retained task correctness, not merely token reduction. The [Vercel course](https://vercel.com/academy/build-ai-agent-harness) explicitly makes context pruning and bounded outputs separate harness concerns.

### 4. High: event/UI work should be an explicit parallel track, not a later SDK choice

**Classification: partial implementation, with missing typed lifecycle coverage in the inspected output contract.**

`packages/contracts/src/output.ts:28` defines text, code, tool result, image, error, thinking, approval-required and workspace events. `apps/web/hooks/use-harness-chat.ts:279` additionally parses tool status and critic content from text. Existing feedback is richer than a spinner; workspace/artifact events must be preserved. Main status is nevertheless only ready/streaming (`:484`). Context-window and memory-retrieval traces are constructed in graph state (`chatRouter.ts:1631`), not exposed as dedicated event types in this contract.

**Correction:** specify a small public event model now: run ID, event ID/order, timestamp, event kind, parent/child reference, safe display payload and optional user action. First show authoritative start/end, current operation, approval waiting/resumed, failure reason, cancel acknowledgement and reconnect state. Add children, retry/backoff and resource summaries when their backend semantics exist. Do not label an event “lost” without tracing the emitter, transport and renderer: some existing trace/sensor data has other presentation paths.

Framework comparison:

| Capability                      | What a framework offers                                | What remains ours                                                                                                   |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| LangGraph node/state progress   | Updates/custom streams and graph metadata              | Stable public vocabulary, IDs, redaction and UI mapping                                                             |
| Model/tool progress             | Current docs expose message and tool lifecycle streams | Our AI SDK model calls require an explicit bridge; LangGraph does not automatically make them LangChain model calls |
| Child visibility                | Subgraph namespaces; Deep Agents async task operations | Child authorization, relationship to product agents, aggregate budgets and durable UI replay                        |
| Reconnect, queues, cancellation | Server/runtime capabilities when actually adopted      | These guarantees are not created merely by installing a React hook                                                  |

The [LangGraph streaming documentation](https://docs.langchain.com/oss/javascript/langgraph/streaming) lists state updates, custom data and tool lifecycle streaming; its newer typed event projections are documented as introduced in v1.2. Installed dependencies are 0.2-era. Verify exact supported APIs in a pinned prototype. The page also explicitly directs non-LangChain model integrations to custom streaming.

**Important:** send safe progress summaries, not raw `values`/`debug` dumps. Current graph state contains model configuration with an optional API key (`graphState.ts:52`, `types.ts:53`). Internal prompts, private reasoning and credentials are not suitable UI progress. The same boundary is a prerequisite for persistent checkpoints.

AI SDK's current custom-data documentation failed to load in this review, so exact modern AI SDK event API parity is not certified here; retain it in the comparison rather than claiming a LangGraph advantage without equivalent inspection.

One concrete bridge limitation is visible now: `llmReason.ts:245` consumes the AI SDK full stream but explicitly forwards only text and reasoning, throwing on errors. Tool-input streaming phases are not forwarded there; completed tool results have a separate path. Enhancing useful operation feedback can therefore begin in our event bridge without waiting for a wholesale framework change. A transport heartbeat is not evidence that an agent is making progress.

### 5. Medium: product orchestration must not inherit the workflow-control implementation wholesale

**Classification: product delegation not demonstrated; existing development orchestration confirmed.**

`packages/workflow-control/src/specialistLauncher.ts:239` launches `codex exec` inside a role-controlled container; lines 194–199 apply source/config mount policy, and line 788 provides process cancellation. `phaseRuntime.ts:294` assigns workflow roles. This is substantial existing orchestration, but it does not invoke a saved platform agent configuration through the chat harness. Searches of API/harness/contracts did not find a general product subagent tool; this is scoped evidence, not proof of global absence.

**Correction:** reuse concepts and interfaces selectively. Do not tie general product research agents to Beads authority or repository-delivery phase semantics. Compare a simple coordinator with blocking child execution first; independently managed async children should be justified by the user journey. Parallel work is possible without a fully asynchronous distributed agent service.

The [Deep Agents async documentation](https://docs.langchain.com/oss/javascript/deepagents/async-subagents) requires an Agent Protocol-compatible server and defines update as interrupting the existing run and starting another on the same thread. That is a material operational dependency and semantic choice. Its TypeScript page also contains ASGI/Python deployment examples: verify package support and deployment topology, do not assume the heading establishes a drop-in Node implementation.

### 6. Medium: clarify what human steering means beyond approving a tool

**Classification: partial implementation; additional capability is requirement-dependent.**

There are approval cards and resume endpoints, but no general structured clarification tool was found in `packages/harness/src/tools`. `ask_user` in sensor contracts/runners is an action label, not evidence of a durable user-question request/response lifecycle. Conversational questions are of course already possible.

**Correction:** distinguish tool approval, asking for missing information, editing a task, and stopping work. For subagents, decide where the question appears, which agent owns the answer, and whether the parent waits. The [Vercel course](https://vercel.com/academy/build-ai-agent-harness) treats structured questions separately from approval modes. This deserves explicit acceptance coverage if interactive background agents are in scope; it is not a mandatory prerequisite for every local single-agent release.

### 7. Medium: narrow “production readiness” and rank evidence separately from missing code

**Classification: deployment-conditional and evidence gaps.**

`decisions.md:88` explicitly states single-user, local-only with no multi-tenant product requirement. `docs/agent-instructions-shared.md:215` agrees. Therefore multi-user identity, replicas, distributed queues and a database replacement are not default blockers. External OTLP dashboards may be valuable but are not the definition of a functional local harness.

**Correction:** choose an explicit release scenario and require local access controls, supported sandbox behavior, credential handling, ordinary-task quality and restore/recovery evidence for that scenario. Distinguish “no current test evidence was read” from “feature absent.” Persistent event retention should be scoped with deletion, secret filtering and artifact availability, rather than adding unlimited traces.

The [production guide](https://docs.langchain.com/oss/javascript/deepagents/going-to-production) distinguishes memory scope, execution, guardrails and deployment infrastructure, and allows JavaScript deployment without LangSmith Cloud. Its managed offering is not a requirement for this product.

### 8. Medium: persistent knowledge deserves its own product lifecycle and UI

**Classification: partial implementation; comprehensive research ingestion not demonstrated in this bounded review.**

The owner's clarification is a knowledge base that improves agent understanding over time. Existing attachment support must be credited: `apps/web/lib/file-context.ts:1` describes sanitizing and prepending file context with count, individual and aggregate limits. This is useful per-request context, not by itself a durable knowledge base. Existing memory foundations also deserve credit: `packages/db/src/index.ts:20` exports memory candidates and self-learning repositories; `packages/contracts/src/memory.ts:65` defines source information and lines 165–167 include source identifiers/metadata. Initial chat preparation already retrieves memory. Do not rebuild those capabilities without an integration assessment.

**Correction:** define a source lifecycle: add article/file; show fetch/extraction success or failure; retain source URL/file, version and scope; review proposed learned memories; retrieve selected information for later tasks and children; display which sources were included or omitted and why; refresh stale sources and delete/revoke access. The UI should clearly separate an attached document, an indexed source, a proposed learned fact and knowledge actually supplied to a run. A submitted URL must not appear as successfully read if extraction failed, as happened with the Medium reference in this research.

Framework stores/retrievers can support persistence and selection, but they do not supply this full ingestion, ownership and receipt UI automatically. Link these receipts to the public event model. Treat imported content as source data rather than agent instructions, preserve source provenance through summaries, and evaluate retrieval relevance and supported answers over repeated tasks. This is retrieval and curated memory, not automatic model training. Exact gaps in the existing memory dashboard, candidate review and source-refresh routes require a focused follow-up; they were not exhaustively inspected here.

## Corrected minimal sequence

1. After the active feature completes, refresh the baseline and define two or three supported user journeys and the local release boundary. Agree what one logical run means across approvals and children.
2. Establish representative task/evaluation cases and current latency, context-growth and user-feedback baselines before choosing libraries. Include normal successful work as well as failures.
3. Prototype one lifecycle slice: durable execution attempt, explicit approval claim/outcome reconciliation, secret-free state, stable run identity, budget scope and typed frontend progress. Exercise refresh and restart through the actual BFF/browser path. Alongside it, define and test one persistent research-source journey through ingestion, retrieval, visible citation and deletion using existing memory foundations.
4. Compare the current harness, modern AI SDK and LangChain/Deep Agents on that same slice; count removed application logic after adapters, migration and backend dependencies. Dependency upgrades are part of this comparison, not an assumed trivial preliminary step.
5. Add one bounded child role, then parallel roles where they demonstrably help. Verify permission inheritance, child approval routing, shared limits and artifact ownership before async steering/recovery promises.
6. Qualify the selected local deployment: ordinary task quality, context stress, crash windows, repeated resume, cancellation and full restore. Add hosted-only requirements only if product scope changes.

## Runtime proof still required

No reported source inference establishes browser disconnect behavior through every layer, sandbox isolation on the release target, exactly-once side effects, successful restore, latest CI health, agent effectiveness or modern SDK compatibility. Validate those explicitly. Current source assessment supports prioritization, not a production pass.

## Review limits

Inspected shared instructions, brief, harness/state/context/model loop, approval repository/resume and state initialization, tool output bounds, workflow specialist launcher, selected UI event rendering and output contract, dependency manifest and local-scope decisions. Read live official LangGraph streaming/persistence, Deep Agents async/production and Vercel course/task pages. Deep Agents synchronous-subagents page failed to fetch due to size; modern AI SDK custom-data page also failed. Medium article not used. No repository files changed; code quality gates are not applicable to this research artifact.
