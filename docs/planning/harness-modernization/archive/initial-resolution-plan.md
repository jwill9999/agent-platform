<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Harness research: initial resolution and oversight plan

Version 1 — 13 September 2026. Proposed investigation sequence for owner discussion. This is not an approved implementation contract, a replacement task tracker, or authorization to reset Beads. Beads remains the task-state authority. The mappings below reference existing audited issues; refinements and any missing issues must be recorded there before implementation. No issue mutations are claimed by this document.

## Objective and scope

Resolve the uncertainties identified in the independent review sufficiently to select a small, affordable framework-based implementation. Deliver evidence for choices rather than assume that new libraries reduce delivery time. Preserve the current feature until its acceptance is reconciled. Prefer local deployment, existing tools and bounded adapters. Keep Beads for project work and the runtime for execution.

Research source: [independent critic review](../reviews/final-independent-critic-review.md). Existing backlog source: [Beads audit](beads-outstanding-audit.md). Earlier findings remain in [framework analysis](../framework-reuse-analysis.md). This plan adds sequencing and ownership; it does not assert that the findings have been resolved.

## Oversight mechanism

Use existing Beads issues to hold assignment, status, dependencies and acceptance evidence. During refinement, attach each critic finding to an existing issue or a specifically justified missing issue. Do not create six duplicate epics. Beads descriptions/specs should reference the relevant critic finding, the question being answered, evidence required and decision reached.

Each investigation should return the same small evidence packet: question; baseline and tested versions; options; observed result; relevant code/test/source links; recommendation and tradeoff; remaining uncertainty. Distinguish documentation evidence, source inspection and runtime proof. Record any supersession with links rather than erase earlier conclusions.

Parent updates at each milestone should state what was resolved, what remains uncertain, what depends on it, and any owner decision needed. During active work provide progress updates when meaningful findings or blockers arise. This plan does not create scheduled monitoring or promise background work after the conversation stops.

## Investigation sequence and proposed ownership

| Work package                            | Parent's resolution method                                                                                                                                                 | Evidence required to resolve the question                                                                                                           | Existing Beads relationship                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope and baseline                      | Refresh accepted feature state; separate client-connected POC from independent background requirements; map current configuration and accepted behaviors                   | Explicit first-release behavior, current commit, acknowledged limits and a small acceptance journey                                                 | pilot-zero / multi-agent acceptance work; preserve these before migration                                                                        |
| Telemetry compatibility and live status | Check compatible OTel/OpenInference integration for AI SDK4; use standard manual spans if needed; correlate request/model/tool and public start/wait/end events            | Real duration, retry and approval wait; no sensitive payload capture; operation succeeds with exporter unavailable                                  | agent-platform-llm-observability-export                                                                                                          |
| Provider and framework parity           | Compare existing provider/loop against supported LangChain integrations, including OpenAI, Anthropic and Ollama configuration; enumerate custom behavior retained/replaced | Coherent package set, representative provider/tool execution, streaming/permission parity, adapter work and code actually removable                 | Candidate refinement associated with context-optimisation and agent-profile-governance; add bounded compatibility issue if none fits             |
| Durable execution and upgrade policy    | Select execution owner/checkpointer; remove secrets from persistent state; specify side-effect reconciliation and treatment of legacy approvals/configuration changes      | Crash-window results; pending approval preserved or visibly invalidated; interrupted run across upgrade; acknowledged cancellation                  | Existing orchestration issues cover project delivery only; separately scope product-harness recovery rather than silently expanding those issues |
| Full task cost                          | Enumerate main/summary/planner/critic/fallback/child/embedding calls; attribute purpose and usage; define reservation and unknown-cost policy                              | Total accounting without double counting, including middleware calls; threshold comparison for trimming vs summarizing                              | agent-platform-context-optimisation and observability-export                                                                                     |
| Affordable diagnostics                  | Configure pinned optional Phoenix service with local storage and explicit retention; preserve pre-run application error/log path                                           | Resource and disk growth measurement; exporter/storage failure behavior; pre-run error can be diagnosed; no mandatory subscription/model evaluation | agent-platform-llm-observability-export; keep wider diagnostics remainder open                                                                   |
| Knowledge lifecycle                     | Map existing memories/review and narrow loaders/search behind scoped retrieval; define source/version/deletion receipts                                                    | Import → scoped retrieval → cited answer → refresh/delete; failed import visible; child retrieval respects scope                                    | agent-platform-research-tools, context-optimisation and governance; source lifecycle may require new bounded scope                               |
| Backlog reconciliation                  | Resolve readiness discrepancy and connector supersedes handling; review old notes against accepted evidence; propose retain/refine/supersede/defer/close dispositions      | Traceable mapping from old work to proposed backlog, preserved release gates/history and reliable dependency view                                   | Beads audit; dedicated maintenance issue if no existing fit                                                                                      |

These rows are proposed investigation work packages, not live task statuses. Parent coordinates each package; specialists may be assigned later when delegation is authorized and their scope can run independently. Parent remains responsible for integrating and verifying their findings.

## Timing and dependencies

Before changing the implementation, complete active feature acceptance reconciliation and agree the first-release execution behavior. Research and specification can continue during that period without mutating the active feature. Do not rely on old parent notes as current completion evidence.

After shared task/run/attempt/child identifiers, event fields and redaction rules are agreed, telemetry compatibility and provider/framework compatibility can proceed in parallel. Knowledge source-schema/retrieval design and backlog reconciliation are also independent investigations. Multiple workers must not independently alter shared contracts or the same chat route; parent assigns file ownership before implementation.

The first runtime milestone is deliberately one existing agent and one tool, with a real wait/retry and useful current status. It need not wait for migration, knowledge ingestion, subagents or a vector database. Traceability instrumentation compatibility is a prerequisite to this milestone.

Select the framework after provider/behavior parity and adaptation effort are demonstrated. Do not perform a full three-way rewrite. If evidence fails to justify LangChain migration, retain the current runtime or pursue the narrower AI SDK path; record why. If independent background work is immediately required, compare supported Agent Server deployment against an embedded lifecycle before building a scheduler.

Before durable rollout, resolve legacy approvals, runtime/configuration versions and safe external-action recovery. Decide the budget boundary before enabling paid middleware or parallel children. Scoped knowledge ingestion can proceed independently; integrate source selection with the chosen context middleware afterward. Supported subagents follow reliable single-agent lifecycle, permissions, budgets and human-control paths.

The combined parent/child/knowledge/recovery demonstration comes after those foundations. Run focused verification within each increment, then browser/Electron, restore and applicable repository quality gates at integration. Calendar estimates follow the compatibility investigations; no numeric delivery saving is currently evidenced.

## Parent-agent responsibilities

I will keep an evidence-based disposition for each finding in its Beads issue/spec: resolved with evidence, deferred with reason and dependency, or awaiting a focused owner decision. A tool result, green test suite or framework feature list alone does not close broader acceptance criteria.

I will inspect the relevant repository paths and official TypeScript APIs; design the smallest experiment that can answer each question; identify reuse before bespoke work; and define acceptance checks before implementation. Once implementation is authorized, I will coordinate bounded changes and appropriate tests, challenge specialist conclusions, reconcile overlaps and preserve clean architecture boundaries.

I will keep the user-facing report concise while retaining detailed evidence links. If the recommendation changes, I will state what evidence changed it and the impact on cost, scope and timing. I will avoid requesting decisions that can be settled by evidence, but bring material deployment, budget and product-behavior tradeoffs to the owner with a recommendation.

I will route Beads changes through the governed broker during an active autonomous workflow, preserve Git/run/approval references, and avoid treating a research plan as permission to merge, deploy or reset the board. The owner remains responsible for accepting material scope and policy choices.

## Review checkpoints

1. **Scope checkpoint:** agreed local/background behavior and acceptance journey; no hidden hosted infrastructure requirement.
2. **Evidence checkpoint:** real current-runtime visibility and framework/provider comparison. Decide whether migration is justified.
3. **Execution-plan checkpoint:** bounded work, ownership, dependencies and measurable acceptance. Where repository workflow requires it, produce and validate the formal execution contract and obtain independent critique before authorized implementation.
4. **Integration checkpoint:** demonstrate durable human control, scoped context/knowledge, costs and bounded delegation; review residual risks against evidence.
5. **Backlog checkpoint:** rebaseline Beads with preserved history and approved dispositions, rather than destructive reset.

The existing critic review need not be repeated merely because this plan exists. Re-engage the critic when evidence materially updates the recommendation or an execution plan is ready, so the next review can assess progress rather than rephrase the same open questions.
