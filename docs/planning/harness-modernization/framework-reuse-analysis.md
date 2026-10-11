<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Framework reuse and harness gap analysis

Research for owner discussion — 13 September 2026

## Recommendation

Modernize the LangGraph foundation already in the platform and evaluate LangChain's standard agent loop and middleware as replacements for generic harness code. Retain the platform's application services, tool authorization, scoped knowledge, and user interface. Use Deep Agents where its packaged planning, filesystem and delegation behavior matches a specific agent profile; adopting the entire harness is not yet justified.

This is a research recommendation, not a compatibility or production certification. No packages were installed, no application code changed, and no failure scenarios were executed. The reviewed baseline advanced to e5410d07e7712aa519ff7ef30764585e97d79a67; the relevant harness/API/web/database/contracts paths had no diff from the earlier review baseline 4ae83195f78fbeacc73ff2a700331542ed89520f. Refresh after the active feature lands.

The largest architectural choice is deployment. For the existing local application, use LangGraph as an embedded library and retain SQLite initially. If independent background execution, managed queues and reconnectable runs are immediate requirements, assess Agent Server before writing those facilities ourselves. Agent Server brings a service topology and operational cost that cannot be treated as a free library upgrade.

## What we have already built

The stack is TypeScript with pnpm, Next.js/React, Express, Electron and SQLite/Drizzle. The harness already depends on LangGraph, LangChain Core and Vercel AI SDK. It is a custom harness built on frameworks, rather than an entirely in-house implementation or a standard framework agent with a thin wrapper.

| Area                      | Current implementation and implication                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution                 | Custom graph and ReAct/planning/critic/sensor/completion nodes. LangGraph supplies graph machinery; application code supplies much of the agent behavior.                                                            |
| Models                    | AI SDK calls inside custom graph nodes. Using LangGraph does not automatically expose all underlying model activity through its native event stream.                                                                 |
| Persistence               | Application messages, approvals and memories persist, but buildGraph creates an in-memory checkpointer. Durable application records do not alone make graph execution recoverable.                                   |
| UI                        | Existing tool, approval, workspace, attachment and artifact displays. The public output union and chat hook expose less structured lifecycle information than internal tracing knows.                                |
| Knowledge                 | Scoped lexical memory retrieval, confidence/safety filtering, source metadata, proposed memories and review controls already exist. Durable document ingestion and a complete source lifecycle remain separate work. |
| Development orchestration | Workflow-control specialists launch Codex processes for governed repository tasks. This is not a general implementation of delegation to saved platform agents.                                                      |

Relevant repository evidence: packages/harness/src/buildGraph.ts:501; packages/harness/src/nodes/llmReason.ts:245 and :632; packages/contracts/src/output.ts:28; apps/web/hooks/use-harness-chat.ts:279 and :484; packages/db/src/repositories/memoryRetrieval.ts; packages/db/src/repositories/memoryCandidates.ts. Source observations identify design risks; runtime failures remain unproven.

## Framework choice and delivery implications

| Option                                        | Reuse gained                                                                                    | Work and tradeoff                                                                                | Assessment                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Modern LangGraph + LangChain agent/middleware | Checkpoints, interrupts, standard agent loop, context summarization, retry and other middleware | Major dependency upgrade; map existing tools/policies/events and preserve current behavior       | Preferred target for controlled, recoverable agents                                                   |
| Modern AI SDK                                 | Standard loop, typed UI streams, tool approval, model integration and subagent patterns         | Major upgrade from v4; durable execution and cross-run policy still need an owner                | Strong alternative if interactive chat is the immediate scope; useful UI/model components selectively |
| Deep Agents                                   | Packaged planning, filesystem/context and delegation conventions                                | More behavior to reconcile with our existing workspace, tool permissions and agent configuration | Evaluate as an optional profile after base harness parity                                             |
| Agent Server                                  | Run/thread APIs, persistence and queued execution, server-backed streaming lifecycle            | PostgreSQL/Redis topology and deployment/commercial terms require review                         | Prefer over a homemade background scheduler if this operational model is acceptable                   |

Choose one agent loop and one execution authority. Do not put ToolLoopAgent inside a LangChain agent loop while also retaining the old custom loop. During migration, existing AI SDK model calls can remain graph-node dependencies. The target LangChain path should replace generic loop behavior, rather than add another nested owner. Likewise, application session records may reference runtime execution IDs without becoming a competing scheduler.

LangChain provides reusable [agent middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in). AI SDK provides a [standard agent abstraction](https://ai-sdk.dev/docs/agents/overview). Neither removes the need to preserve application authorization and external-action semantics.

## 1. Recovery, approvals and budgets

**Critic point:** approval resume is recorded before tool dispatch and result persistence. A process failure can leave an approval recorded as resumed without a trustworthy outcome. The endpoint returns already-resumed for a repeat request. See packages/db/src/repositories/approvalRequests.ts:199–232 and apps/api/src/infrastructure/http/v1/chatRouter.ts:1181–1308.

**Reuse:** persistent LangGraph checkpoints and interrupts can replace ad hoc execution suspension. Interrupts also support durable questions distinct from permission requests. However, replay can re-enter code around an interrupt. Follow the framework's [interrupt replay rules](https://docs.langchain.com/oss/javascript/langgraph/interrupts) and [persistence model](https://docs.langchain.com/oss/javascript/langgraph/persistence).

**Application work that remains:** give each external action a stable operation identity; persist request/claim/outcome; use provider idempotency where available; reconcile uncertain outcomes before retry. For tools without idempotency or queryable outcomes, surface “outcome unknown” and require a deliberate recovery decision. A checkpoint cannot make arbitrary external effects exactly once.

Before persisting graph state, remove credentials from it. The current model configuration type permits an API key and is included in initial graph state. Resolve secrets through runtime dependencies or references, and keep them out of checkpoints, telemetry and browser events.

Current counters reset on approval resume (chatRouter:1660–1668). The contract is per run: this is not automatically a defect. Proposed product policy is a logical-task budget spanning attempts and child work, with separate per-attempt safeguards. Framework step/token limits can enforce local limits; the platform must define aggregate accounting and reservations for concurrent children. Existing costUnits is tokens/1000, not currency; money requires provider/model pricing and explicit treatment of unknown usage.

SQLite checkpointers exist, but their documentation positions SQLite for local workflows/experimentation. Validate desktop crash behavior and load before making release guarantees. Hosted replicas need shared locking/storage. See [checkpointer options](https://docs.langchain.com/oss/javascript/langgraph/checkpointers).

## 2. Orchestration and subagents

Start with a parent invoking a bounded specialist as a tool, passing a scoped task and context, then receiving a structured result. Use framework delegation and execution facilities rather than building a new agent scheduler. LangChain documents [subagents](https://docs.langchain.com/oss/javascript/langchain/multi-agent/subagents); AI SDK documents [child-agent tools, cancellation propagation and progress](https://ai-sdk.dev/docs/agents/subagents).

The platform still owns which saved agent may be invoked, tool access, context visibility, delegation depth, concurrency/budget limits and result acceptance. Every child needs a parent ID and its own run ID. A child must not silently inherit unrestricted parent tools or all project knowledge. Route child approval/clarification to the user while retaining the correct child identity and parent waiting state.

For the first supported journey, keep children joined to the parent lifecycle. Independent background children introduce restart, join, cancellation and scheduling requirements. Deep Agents' [async subagent documentation](https://docs.langchain.com/oss/javascript/deepagents/async-subagents) involves server-backed agents; it should not be read as a free in-process background queue.

Reuse workflow-control concepts for identities, authorization and recovery where applicable. Do not make general product delegation depend on Beads, Git branches or Codex CLI roles.

## 3. UI feedback and events

Expose real activity through typed events instead of parsing “Calling tools” or other message text. Preserve the existing cards and add a concise current activity, expandable timeline and actionable waiting state.

| Event family        | What the user should see                                                              |
| ------------------- | ------------------------------------------------------------------------------------- |
| Run/child lifecycle | Starting, specialist working, completed, failed or stopped; parent/child relationship |
| Tool lifecycle      | Tool started, progress where available, finished and result                           |
| Waiting/retry       | Approval needed, answer needed, retry delay, reason work cannot advance               |
| Context             | Source selected, omitted with reason, earlier material summarized                     |
| Knowledge ingestion | Fetching, extracting, indexing, ready, failed, stale                                  |
| Recovery            | Connection lost, reconnecting, state restored, external outcome being checked         |

A minimal public event envelope should carry schema version, event ID, run/parent IDs, operation ID when applicable, sequence, timestamp, type and safe payload. Choose the authoritative runtime first; map its events once. Framework-native events should remain internal where they contain prompts, full state, credentials or irrelevant implementation detail. Progress events describe actions and outcomes, not private chain-of-thought.

Two viable library routes:

- AI SDK's [typed custom data streams](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data) can carry application progress and source parts alongside messages. Adopting its UI hook requires conforming to its protocol; the current NDJSON stream is not automatically compatible.
- LangChain's [React integration](https://docs.langchain.com/oss/javascript/langchain/frontend/overview) handles messages, tools, interrupts and graph state. Current [transport APIs](https://reference.langchain.com/javascript/langchain-react/transports) include AgentServerAdapter and HttpAgentServerAdapter; older FetchStreamTransport guidance is obsolete. A custom backend still has to provide the required command/event semantics.

Recommendation: with the LangGraph target, prefer the supported React integration if the backend adapter is small. Do not implement an entire Agent Server clone merely to reuse a hook. For an embedded local release, a small typed event projection plus persisted state restoration may be less work; state that it lacks seamless event replay until implemented and tested.

[LangChain join/rejoin](https://docs.langchain.com/oss/javascript/langchain/frontend/join-rejoin) is documented for Agent Server. [AI SDK resumable streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams) require additional stream/storage infrastructure. Neither browser reconnection facility proves process-crash recovery. Distinguish disconnecting from cancelling, and show cancellation only after server acknowledgement.

Continue the existing OpenTelemetry direction. Use framework instrumentation and a single correlation/redaction policy; monitoring must consume execution state rather than become its owner. See [AI SDK telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry).

## 4. Context, research and persistent knowledge

The first context correction is inside the model loop. Initial context is windowed, but subsequent calls accumulate tool results. Use summarization/context middleware before model calls, while preserving system instructions, relevant evidence and valid tool-call/result pairs. Audit external MCP output handling; many native tools already have limits, so a blanket “tools are unbounded” claim is wrong.

For knowledge, build on existing memory storage and review. Proposed flow:

Add URL/file → extract → retain source/version/scope → split/index → retrieve relevant passages → include a bounded selection → show citations → refresh, correct or delete.

Reuse LangChain [loaders/retrievers](https://docs.langchain.com/oss/javascript/deepagents/retrieval) and [text splitters](https://docs.langchain.com/oss/javascript/integrations/splitters/recursive_text_splitter). Select narrow loaders for supported formats; a generic loader catalog is not proof every format is safe or reliable. Current community package exports include PDF and Cheerio loaders, but runtime compatibility was not tested. The recursive splitter's default size is character-based; context limits still need token-aware budgeting.

For initial search, evaluate SQLite's existing [FTS5/BM25](https://sqlite.org/fts5.html) against our lexical scorer before adding a vector database. It reduces bespoke ranking while retaining the current storage topology. Verify FTS5 is available in the shipped SQLite build. Introduce embeddings through a supported integration only if a small relevance evaluation shows meaningful improvement, especially for paraphrases and conceptual queries.

The necessary application layer is provenance and policy: source ID/version, scope, fetch/extraction outcome, passage identity, permissions, freshness, deletion/reindexing and citation linkage. Framework stores and vector search do not provide the entire lifecycle. URL import also needs controlled fetching and document-size limits; imported content remains untrusted evidence.

UI distinctions matter:

- Attachment: supplied for this conversation. Existing PDF/docx unsupported states and image metadata should not be mistaken for complete document/vision ingestion.
- Saved source: reusable knowledge with import status, scope and freshness.
- Proposed memory: an agent suggestion awaiting the existing review process.
- Context used: exact source versions/passages supplied to this run, including omissions.

Persist selection receipts so the user can inspect why a source informed an answer. On removal, exclude it from future retrieval and apply an explicit retention policy to historical run evidence. Learning here means improving selected context and reviewed knowledge; it does not mean retraining model weights.

## 5. Clean architecture boundary

Keep application-facing operations such as start, answer, cancel, get status and subscribe behind a harness service interface. Infrastructure adapters translate to LangGraph or another selected runtime. Keep tool permissions and external-action handling in application services; framework tools call those services. Keep knowledge scope/provenance rules in the application, with extraction/search adapters underneath.

Use a small number of boundaries justified by real dependency changes: agent runtime, authorized tool execution, knowledge retrieval and public event projection. Do not wrap every framework class or recreate its graph, scheduler, checkpointer, parser or retriever. Framework middleware/configuration belongs in the infrastructure adapter. The UI consumes safe application data, while the framework may own its internal execution state.

## Version and deployment evidence

Registry metadata inspected on 13 September 2026; these are observed versions, not a tested install set.

| Component        | Observed metadata / issue                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Current harness  | ai ^4.3.0; @langchain/core ^0.3.0; @langchain/langgraph ^0.2.0. Lock resolves core 0.3.80 / graph 0.2.74.                      |
| AI SDK           | ai 7.0.99; @ai-sdk/react 4.0.102. Node >=22; current React peer constraints are narrower than simply “React 19”.               |
| LangChain cohort | langchain 1.5.11; core 1.2.11; graph 1.4.15; React package 1.1.0. Upgrade together against peer ranges.                        |
| Deep Agents      | 1.13.4, with current LangChain/Graph/checkpoint/LangSmith peer requirements. Larger compatibility surface.                     |
| SQLite saver     | 1.0.4 depends on better-sqlite3 ^12.10.0; repository uses 13.0.3. Potential duplicate native binaries/Electron packaging work. |
| Node             | Repository Node 24 meets observed engine minimums; that does not establish native ABI or application compatibility.            |

Source: public npm registry package metadata, e.g. [ai](https://registry.npmjs.org/ai/latest), [LangGraph](https://registry.npmjs.org/@langchain%2flanggraph/latest), [SQLite saver](https://registry.npmjs.org/@langchain%2flanggraph-checkpoint-sqlite/latest), [Deep Agents](https://registry.npmjs.org/deepagents/latest). Pin a coherent set after a compatibility check; “latest” is not itself the requirement. Current AI SDK docs use newer APIs, including toolApproval; copying older tutorial examples may produce deprecated or incompatible code.

[Agent Server](https://docs.langchain.com/langsmith/agent-server) supplies durable run resources and queue execution. Its documented resource storage uses PostgreSQL, with Redis handling signaling/streaming. It injects its own persistence components. Evaluate deployment terms, secret handling and operational ownership before selecting it for a local-first product.

The [Vercel harness course](https://vercel.com/academy/build-ai-agent-harness) remains useful reference architecture, rather than evidence our application meets production requirements. The supplied Medium article's body was inaccessible and was not used to substantiate technical recommendations. Python examples were not assumed to establish TypeScript availability.

## What is resolved, and what must be proved next

| Critic point        | Research answer                                                                             | Evidence still needed after current feature                                  |
| ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Approval recovery   | Reuse checkpoints/interrupts; retain application action identity and outcome reconciliation | Crash before dispatch and after effect; no lost approval or duplicate effect |
| Budget reset        | Define task versus attempt scope; framework limits plus aggregate application policy        | Resume and concurrent-child accounting                                       |
| Context growth      | Per-call middleware plus output handling audit                                              | Long loop retains constraints/citations and stays within budget              |
| UI visibility       | Framework stream support plus safe correlated public projection                             | Real tool/retry/wait/cancel events; reload and reconnect behavior            |
| Product delegation  | Framework child-agent tools with saved-agent configuration and permission scope             | Parent/child wait, failure, cancellation and result acceptance               |
| Clarification       | Typed durable interrupt distinct from approval                                              | Answer resumes intended parent/child after restart                           |
| Production scope    | Local baseline first; Agent Server/shared services conditional                              | Desktop packaging, backup/restore, latest CI and release gates               |
| Knowledge lifecycle | Reuse loaders/splitters/search and existing review/storage                                  | Import → retrieve → cited answer → refresh/delete, plus scope isolation      |

The next implementation investigation should be one bounded vertical slice after the active feature, rather than three full harness rewrites: a configured agent reads an imported source, delegates one specialist, requests approval or clarification, survives a controlled interruption, and displays an accurate timeline and cited result. Compare the existing path with the preferred LangGraph/LangChain path; use AI SDK as a fallback comparison if compatibility or adapter cost defeats the expected saving.

Measure behavior retained, bespoke code actually removable after adapters, recovery correctness, retrieval grounding, context retention, latency and usage. Do not estimate delivery savings from feature lists alone. Broader release evidence includes restore of messages/checkpoints/source records/artifacts, tool isolation, secret redaction, browser/Electron journeys and repository quality gates. No fresh evidence of those gates is claimed here.

Owner discussion should settle two points before the next critic review: whether the initial release must execute independently of an open client, and whether PostgreSQL/Redis services are acceptable. The default recommendation preserves the local deployment while preparing a runtime boundary that can adopt Agent Server if durable background execution is required.

## Addendum: affordable telemetry and human oversight

Owner discussion clarified that traceability must be affordable during development and the proof of concept. Treat it as an explicit design workstream, not an assumed consequence of adopting a framework. This proposal has not been implemented or independently reviewed.

### Two connected views

The platform should show live agent/run status, an expandable parent/child activity tree, last activity, tool outcomes, retries, context-source references and actionable approval/clarification requests. Human actions remain application commands, with runtime acknowledgement before the UI reports success. A heartbeat or open connection is not proof that useful work is progressing; distinguish last observed activity, explicit waiting state and lost contact.

A separate, locally hosted Phoenix dashboard should provide developer trace exploration. Link a platform run to its trace using shared identifiers, with the exact deep-link format verified during integration. Phoenix is an existing self-hostable OpenTelemetry-based tracing product; a hosted subscription is not required for this proposal. Local compute, storage and maintenance still have costs. Model API charges continue independently. Reference: [Phoenix project](https://github.com/Arize-ai/phoenix).

The current harness already defines trace events for models, tools, retries, approvals, context and limits in packages/harness/src/trace.ts. That is useful instrumentation groundwork, not proof of a complete durable end-to-end trace. Finished-span export alone cannot provide reliable live operation status: publish explicit start/wait/progress/end events for the platform view.

### Reuse and architecture

Use OpenTelemetry libraries and framework instrumentation for tracing, with narrow adapters for application-specific operations. Preserve task, run, parent-run, agent, operation and trace correlation. For retries or resumed runs, preserve logical task identity while distinguishing attempts; use trace links where separate execution lifetimes make them appropriate. Do not equate every durable task with one indefinitely open trace.

Start with direct OTLP export to Phoenix where supported; add a standalone collector only when routing, filtering or buffering warrants it. This narrows the earlier broader observability direction to a small LLM-focused proof of concept. It does not require running multiple dashboards. Keep runtime state authoritative and telemetry a read-only projection. Export failures must not prevent agent execution; bounded buffering must expose dropped telemetry rather than silently claiming complete coverage.

### Cost controls

- Collect timing, status, identifiers and provider-reported usage by default; avoid full prompts, documents, secrets and unrestricted tool payloads.
- Use a proposed seven-day retention window and an explicit storage cap. Verify backend retention support or use a documented cleanup mechanism before promising enforcement.
- Trace low-volume development runs fully at first; introduce sampling when measured volume requires it. Keep essential application decision/recovery records outside sampled diagnostic telemetry.
- Do not add model calls for routine tracing. AI-based evaluation is a separate optional workload with its own budget.
- Avoid duplicate automatic/manual model spans and double-counted parent/child usage. Show missing usage as unknown and monetary estimates with their pricing basis.
- Run Phoenix on the existing development machine initially. Measure memory, disk growth and runtime overhead before proposing hosted infrastructure.

### Critic review questions and acceptance evidence

The next critic should assess whether the proposed minimum is sufficient and avoids unnecessary bespoke dashboard work. In particular: Does event correlation survive delegation, approval, restart and retry? Does the UI distinguish waiting from stalled or disconnected? Are human commands authorized and acknowledged? Can tracing fail without breaking execution? Are sensitive payloads excluded? Are costs and retention actually bounded?

The first evidence journey should show a parent invoking a child, retrieving context, calling a tool, waiting for approval or clarification, resuming and completing, with an injected failure/retry. Verify the platform's live activity and the developer trace agree about identities and outcomes. Also verify cancellation acknowledgement, restoration after reload, telemetry-export failure, redaction and token aggregation. Restart recovery should be reported separately from browser reconnection. This is a proposed verification scope, not a claim that these behaviors currently pass.

## Final review: sequencing and dependencies

Final documentation check, 13 September 2026. Phoenix's official [self-hosting documentation](https://arize.com/docs/phoenix/self-hosting) confirms free self-hosting without feature gates. This confirms the subscription statement, not zero operating cost. LangGraph's [interrupt documentation](https://docs.langchain.com/oss/javascript/langgraph/interrupts) confirms that resumed nodes restart from their beginning: external-action replay precautions remain essential. Agent Server's documented topology remains distinct from embedded LangGraph. No dependency installation, runtime benchmark or full new repository audit was performed for this final check.

Two refinements to earlier sequencing:

1. The combined parent/child/knowledge/recovery journey is an integration milestone, not the first implementation slice. Start with one existing agent and one tool so basic traceability can ship before delegation and knowledge ingestion.
2. Adding durable checkpoints does not supply a background worker or wake-up mechanism. Before promising work continues after client disconnect or process restart, explicitly select the execution host, trigger for resumption, concurrency ownership and cancellation behavior. Agent Server is one supported option; an embedded runtime requires that lifecycle to be supplied separately.

### Proposed order

| Stage                              | Work                                                                                                                                  | Hard dependencies                                                       | Parallel opportunities / completion evidence                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| While current feature finishes     | Review contracts, source mapping, UI examples and this analysis; obtain critic feedback after owner discussion                        | None for research                                                       | Keep current branch/runtime untouched; no implementation commitment implied                                                                          |
| First implementation foundation    | Refresh merged baseline; agree logical task/run/attempt/child identity, safe event envelope, budget scope and execution ownership     | Current feature completed; owner agrees scope                           | Small shared contract enables independent UI and runtime work                                                                                        |
| Early visibility                   | Instrument an existing agent/tool; connect local Phoenix; expose current activity and trace reference                                 | Identity/event contract and redaction rules                             | Backend export and UI fixtures can proceed independently; integrate a real tool call, retry and approval wait before expanding                       |
| Runtime compatibility and recovery | Pin compatible framework cohort; isolate secrets; select/check persistent saver; implement interrupt/resume and action reconciliation | Deployment/runtime decision; secret removal before durable state writes | Compatibility check can run alongside early visibility; recovery integration needs the selected versions and persistence model                       |
| Knowledge foundation               | Source records, scoped import, loaders, splitting, indexing and refresh/delete semantics                                              | Source/scope contract                                                   | Can run alongside runtime work using a retrieval port; initial UI can use fixtures; actual cited answers need retrieval wired into context selection |
| Context management                 | Per-model-call context budget and summarization; source-selection receipt                                                             | Selected loop/middleware APIs                                           | Policy and evaluation cases can be prepared during compatibility work; implementation integrates with knowledge after retrieval exists               |
| Human control                      | Durable approval/clarification, acknowledged cancel, restored waiting state                                                           | Runtime commands and persistence for promised restart behavior          | UI presentation can be built earlier; reliable control requires backend integration                                                                  |
| Product subagents                  | Bounded child tool with scoped tools/context, parent/child events and aggregate limits                                                | Working single-agent lifecycle, identity, permissions and budget policy | Read-only experiments can precede complete recovery; release of resumable children needs recovery and human-control paths                            |
| Integration/release evidence       | Combined parent/child/source/approval journey; crash windows; reload; cancellation; restore; cost/retention and Electron checks       | Integrated workstreams                                                  | Targeted tests run within each workstream; full journey and release gates follow integration                                                         |

Critical dependencies: shared identity/event contracts precede correlated UI integration; secrets are removed before durable graph-state persistence; framework compatibility precedes migration; safe single-agent execution and delegation policy precede supported subagents; source/version/scope records precede trustworthy citations and deletion. Browser reconnection, durable resumption and background scheduling require separate evidence.

The fastest useful milestone is one agent whose real operation, waiting reason and trace can be inspected. Do not block that milestone on framework migration, a vector database, Deep Agents, a multi-agent dashboard or hosted infrastructure. Use narrow existing instrumentation adapters and carry the public event contract forward into migration.

For parallel implementation, allocate ownership to runtime/harness, telemetry adapters, UI, and knowledge modules, but integrate shared contracts once rather than letting each workstream invent identifiers or edit the same chat route independently. Parallel work reduces calendar time only after these interfaces are agreed. No additional agents have been dispatched by this review.

Do not assign calendar estimates yet: the major-version/native dependency check and chosen background-execution requirement materially affect effort. Estimate after the compatibility slice identifies actual adapters and code removable. Critic review can happen before implementation with these uncertainties explicitly listed; a later evidence review should assess the implemented vertical slice.

## Beads audit and project orchestration boundary

Owner clarification: Beads remains the preferred project board for priorities, epics/features and subtasks, including agent-driven project delivery. Framework evaluation concerns execution of that work; it does not imply replacing Beads with LangGraph or using Beads to drive every agent conversation.

See the [complete outstanding-work audit](archive/beads-outstanding-audit.md) and machine-readable snapshot (local audit snapshot; not included in this documentation bundle). Read-only audit found 32 outstanding records: 24 open, seven in progress, one deferred; these include 12 epics. There are 272 closed records to preserve. MCP ready returns 18 entries versus 16 in stats; one MCP issue read rejects a supersedes relationship and required the read-only CLI fallback.

Rebaseline the board after current feature acceptance and critic/owner review. Preserve history and stable IDs, reconcile old implementation/acceptance notes, refine existing observability/context/research/governance tickets, and explicitly link any replacements. No reset, issue mutation or remote synchronization has been performed. The snapshot is not a full restorable Beads backup.

Critic should assess: whether project work state and runtime execution authority are clearly separated; whether the existing broker safely maps issues to multiple run attempts; whether recorded ready states reflect actual prerequisites; and whether refinement can deliver a clean proof-of-concept backlog without discarding release gates or completed evidence. Tracker replacement remains an evaluation question, not the default recommendation.
