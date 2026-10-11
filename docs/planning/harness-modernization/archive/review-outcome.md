<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Harness research: outcome of independent critique

2026-09-13. Research only; implementation remains deferred until the active feature is finished. Baseline reviewed: 4ae83195f78fbeacc73ff2a700331542ed89520f.

## Outcome

The primary analysis is directionally supported, but framework selection is still open. The independent critic identified specific corrections that replace broad claims of missing production functionality. Accepted below means accepted into the research assessment, not approval to implement or certification that a failure has been reproduced.

| Critic finding                                                   | Research disposition                                                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approval is claimed before execution and result persistence      | Accept as source-demonstrated recovery design concern. Reproduce crash windows and design outcome reconciliation; do not unquestioningly replay side effects.        |
| Budgets reset on approval resume.                                | Accept observed behaviour. The current contract is per run; define logical task/attempt/child scope before labelling a defect or showing aggregate remaining budget. |
| Context grows inside tool loops despite initial windowing        | Accept as higher priority than generic context refactoring. Preserve existing native output limits and evaluate external tool coverage.                              |
| UI stream exposes fewer structured events than runtime knows     | Accept as a first-class user experience track. Some useful feedback can improve before a framework migration.                                                        |
| Workflow specialists are not equivalent to saved platform agents | Accept. Reuse authorization/recovery patterns selectively without binding all product agents to Beads or repository delivery.                                        |
| Structured clarification differs from tool approval.             | Accept as a requirement to assess for background/child agents; conversation questions already exist.                                                                 |
| Production requirements must respect local scope.                | Accept. Hosted identity, replicas and distributed storage remain conditional.                                                                                        |
| Knowledge base requires a lifecycle beyond attachments           | Accept and incorporate owner's clarified objective. Build on current memory retrieval, source metadata, candidates and review controls.                              |

## User experience: make runtime activity understandable

The product should provide a concise current activity, expandable history, and actionable waits. Examples of proposed public events and displays:

| Event category            | End-user feedback                                    | Dependency                                                                    |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| Run started / queued      | Starting work / waiting for capacity                 | Authoritative run scheduler or controller                                     |
| Tool lifecycle            | Reading files / running tests / finished with result | Emit operation IDs and start/end events from actual execution                 |
| Retry                     | Provider unavailable; retrying after delay           | Existing retry trace connected to a safe UI event                             |
| Approval or clarification | Waiting for your decision or answer                  | Durable request linked to correct run/child                                   |
| Child lifecycle           | Researcher working / reviewer blocked / result ready | Product delegation and parent/child identity                                  |
| Context preparation       | Selected sources loaded; some omitted with reasons   | Retrieval and context-selection receipt                                       |
| Context reduction         | Earlier results summarized to fit context            | Actual compaction implementation; do not imply summarization if only trimming |
| Source ingestion          | Fetching / extracting / ready / failed               | Persistent source lifecycle                                                   |
| Recovery / cancellation   | Reconnecting / outcome being checked / stopped       | Backend acknowledgement, not optimistic browser-only state                    |

Retain existing tool, approval, workspace and artifact displays. Runtime trace events are not all necessarily useful or safe for users. Do not expose full graph state or private prompts/credentials. Framework event support must be checked for the installed/proposed TypeScript version. AI SDK calls inside LangGraph need explicit instrumentation or custom events; changing the React hook does not automatically recover missing runtime signals.

## Persistent knowledge base

Goal: agents use accumulated source material and reviewed experience in future work. This improves supplied context rather than training the model.

Recommended lifecycle: add link/file -> fetch/extract with visible outcome -> retain source version and scope -> index/retrieve -> supply bounded relevant passages to parent/child -> show source citations and what was included -> review proposed learnings -> refresh/correct/delete.

Distinguish four objects in the UI: an attached document, a persistent source, a proposed memory and knowledge actually supplied to a run. Preserve original source provenance through summaries. Retrieved material is evidence, not authority to change instructions. A failed URL import must remain visibly failed.

Existing scoped lexical memory retrieval, source metadata, safety/confidence filtering, candidates and self-learning review are useful foundations. A vector database is an option to evaluate against retrieval quality, not a prerequisite. LangChain's retrieval documentation covers modular loaders, retrievers, embeddings and stores: https://docs.langchain.com/oss/javascript/deepagents/retrieval .

## Revised next step after feature completion

Refresh the baseline and compare three implementations on the same small set of journeys: current harness, modern AI SDK, and LangChain/Deep Agents. Include a source-ingestion/retrieval/citation journey and a run with approval/recovery/visible progress. Then add a bounded specialist. Measure successful task completion, source grounding, context retention, user-visible state correctness, latency, usage, and custom code removed after adapters.

Durable replay, safe external side effects, SDK compatibility, latest CI, retrieval effectiveness and release-platform behavior remain unverified. No runtime tests or repository changes were performed for this review.

## Artifacts

- Initial brief: initial-analysis-brief.md
- Independent critique: critic-review.md
- Review scorecard: review-scorecard.md

Files are kept outside the active repository in /Users/letuscode/Downloads/agent-harness-research/.
