<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Independent critique: revised harness research

13 September 2026. Reviewer: harness_research_final_critic, independently delegated. Repository HEAD reviewed: e5410d07e7712aa519ff7ef30764585e97d79a67. Input documents are identified in final-review-input-manifest.json. This document preserves the substantive findings and recommendations returned by the critic, condensed by the coordinating agent. It is a research review, not execution-contract approval. No implementation, tracker mutation or runtime testing was performed.

## Overall assessment

The revised recommendation is credible as a research direction, but does not establish that migrating to LangChain will shorten delivery. The strongest immediate decision is a small, affordable visibility slice on the existing runtime. Keep framework choice conditional on provider integration, preserved behavior and backend adapter work. Six refinements follow; none requires abandoning the proposal, replacing Beads, introducing hosted infrastructure or implementing every advanced capability.

## 1. High: make model and behavior migration explicit before committing

Affected report sections: Framework choice and delivery implications; Clean architecture boundary; Version and deployment evidence.

The current provider abstraction returns AI SDK LanguageModelV1. LangChain createAgent expects a LangChain chat model or supported model identifier. Retaining AI SDK calls in custom graph nodes does not itself obtain the standard LangChain agent loop and middleware.

Evidence: [providers.ts](../../../../packages/model-router/src/providers.ts), [llmReason.ts](../../../../packages/harness/src/nodes/llmReason.ts), [toolDispatch.ts](../../../../packages/harness/src/nodes/toolDispatch.ts), and [CreateAgentParams](https://reference.langchain.com/javascript/langchain/browser/CreateAgentParams).

Recommended correction: include a replacement map covering provider construction, generic tool loop, authorized tool execution, planner/critic/sensors/completion behavior, and UI transport. Preserve user-selected models, credentials, Ollama/base URLs, tool identities, guards, approval policy, audit hooks, streaming and error behavior. Explicitly decide which custom agent behaviors remain.

Prefer supported provider integrations over a bespoke AI SDK-to-LangChain model bridge. If adaptation exceeds the generic code removed, retain the current model path for the first increment. Provider/behavior parity belongs in the compatibility investigation before choosing the migration, and can run alongside telemetry work.

## 2. High: early telemetry needs a pinned compatibility check

Affected sections: affordable telemetry addendum; Early visibility.

Current Phoenix TypeScript integration documentation says bundled Vercel processing targets AI SDK 7; SDK 6 and earlier emit a different span shape. Guidance for an older SDK 6 integration does not prove compatibility with the platform's SDK 4. The documentation also covers ESM instrumentation considerations and default input/output capture by tracing helpers. See [Phoenix TypeScript integration](https://arize-ai.github.io/phoenix/modules/_arizeai_phoenix-otel.html).

The current [trace event definitions](../../../../packages/harness/src/trace.ts) lack complete paired start/end timings. [Model events](../../../../packages/harness/src/nodes/llmReason.ts) are appended after execution. Existing [plugin record timestamps](../../../../packages/plugin-observability/src/store.ts) are useful but do not establish complete operation timings.

Recommended first increment:

1. Select a compatible integration or use standard manual OpenTelemetry spans around current invocation boundaries.
2. Emit live start/wait/end events there; do not derive durations from retrospective graph events.
3. Verify redaction before sending real prompts or credential-bearing data.
4. Prove request, model and tool correlation, a real duration and retry.
5. Verify agent execution remains usable with the exporter disabled or unavailable.

Manual spans are narrow instrumentation, not a new tracing framework. Visibility can still precede the major runtime migration, but connecting an exporter alone is insufficient.

## 3. Medium: define durable-state and configuration migration

Affected sections: recovery, product subagents and integration evidence.

The report handles crashes but needs an explicit policy for resuming after runtime, node names, tools or saved-agent permissions change. LangGraph documents restrictions for interrupted threads when nodes are removed or renamed: [graph migrations](https://docs.langchain.com/oss/javascript/langgraph/graph-api#graph-migrations). Persisted legacy approval records cannot silently become new framework interrupts.

Recommended correction: record runtime/schema and relevant agent/tool configuration revisions; decide whether legacy approvals finish through the old path or are visibly invalidated; verify operation identity and current authorization on resume; drain, retain a compatible execution path for, or explicitly terminate affected suspended runs before incompatible upgrades. Preserve revision references in execution evidence.

A proof of concept can use a simple drain-before-upgrade policy. A general historical runtime registry is unnecessary. Decide this before creating durable state and test an interrupted run across an upgrade before making release promises.

## 4. Medium: include framework-generated model calls in cost accounting

Affected sections: budgets, context/knowledge and cost controls.

Summarization, planning, critic, fallback and optional embedding calls can all cost money. Summarization middleware is model-backed: [middleware documentation](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in). Current primary-call usage accounting does not prove these future calls will be covered.

Attribute billable calls to task and purpose; include them in reservations/estimates. Use bounded trimming when sufficient and summarization at deliberate thresholds. Measure total task cost and completion quality, rather than reduced prompt size alone. A monetary ceiling remains approximate unless provider behavior and reservations support stronger enforcement.

This extends the proposed identity/budget contract. Set the boundary before enabling model-backed middleware or parallel children; no separate billing system is required.

## 5. Medium: preserve general application diagnostics

Affected sections: telemetry addendum; Beads audit/refinement.

Phoenix is a reasonable narrow LLM-tracing choice. However, the existing [observability specification](../../../tasks/agent-platform-llm-observability-export.md) also covers frontend, BFF, API and desktop failures, including errors before an agent run exists.

Define the first increment and retained remainder when refining this issue. Preserve request-to-run correlation and an accessible local error/log path. A pre-run API failure must remain diagnosable. Existing structured logs/developer surfaces may suffice; another dashboard is not required. A successful Phoenix demo must not close the entire broader observability ticket.

## 6. Low: make the cheap local deployment concrete

Affected section: telemetry cost controls.

Phoenix is free to self-host and documents SQLite for local storage, so no PostgreSQL service is needed for this development proposal. Its configuration documents retention, with unlimited retention as the default. Sources: [self-hosting](https://arize.com/docs/phoenix/self-hosting), [storage architecture](https://arize.com/docs/phoenix/self-hosting/deployment), [configuration](https://arize.com/docs/phoenix/self-hosting/configuration).

Propose a pinned optional development Docker service, its own persistent volume, explicit local endpoint and configured retention. Measure disk growth and runtime resource use in the first smoke test. Age-based retention is not a hard disk cap; test storage exhaustion separately. Platform status must remain useful when Phoenix is absent, and diagnostic storage must remain separate from application recovery records.

## Larger choices

The evidence does not establish a delivery-time winner. Existing runtime plus narrow instrumentation is the smallest immediate visibility path. Embedded LangGraph/LangChain remains plausible if provider/policy adaptation is bounded. Agent Server deserves evaluation if independent background execution is immediate. AI SDK remains credible for interactive scope or if LangChain replaces too little custom code. Do not build three complete implementations or an Agent Server clone merely to reuse React hooks.

The deployment decision is an acknowledged owner choice, not a newly discovered defect. Two user views remain appropriate: authoritative platform activity/decisions and Phoenix developer traces. Diagnostic retention must not govern durable decision history. Restored/replayed timelines need evidence beyond basic live status.

Knowledge lifecycle and reuse of reviewed memories are sound. FTS5 before a new vector service is defensible. No additional database is justified by this review. Retrieval tools must enforce child scope, not just the child's initial prompt. Verify versioned citations, refresh/delete and improved answer grounding later.

Retain Beads for project epics, dependencies and acceptance. Rebaselining while preserving history is supported. Connector/readiness issues deserve reconciliation, but do not justify tracker replacement. The critic did not rerun the complete Beads inventory or verify remote synchronization; this review does not recertify the counts.

## Earlier findings reassessed

| Earlier concern                           | Assessment                                                    |
| ----------------------------------------- | ------------------------------------------------------------- |
| Approval claim before effect/outcome      | Addressed in proposal; runtime crash-window proof remains     |
| Counters reset on resume                  | Correctly distinguished from a defect in the per-run contract |
| Growing loop context                      | Valid priority; include middleware costs                      |
| UI lacks runtime visibility               | Correct; add real start/timing instrumentation                |
| Development specialists vs product agents | Correctly separated                                           |
| Clarification vs approval                 | Correctly treated as distinct durable interactions            |
| Local production scope                    | Appropriately constrained                                     |
| Knowledge beyond attachments              | Sound lifecycle built on existing foundations                 |

## Recommended sequence

1. Discuss immediate background-execution requirements and accept a bounded visibility increment.
2. Refine existing observability/context work after active feature acceptance, preserving unfinished acceptance criteria.
3. Investigate telemetry compatibility and framework/provider compatibility in parallel.
4. Deliver one real current-runtime trace and matching platform status.
5. Select migration using provider/policy parity and actual adapter/code-removal evidence.
6. Add durable execution with legacy approval and upgrade handling.
7. Develop knowledge ingestion independently against agreed interfaces.
8. Integrate context management, human control and one bounded child.
9. Review combined runtime evidence before expansion.

Proceed with the research direction and early visibility. Keep LangChain modernization provisional until adaptation costs are measured. These refinements improve delivery confidence; they do not call for a redesign or mandatory infrastructure expansion.
