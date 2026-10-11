<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Agent platform harness: initial analysis for independent critique

Research brief, not an approved implementation contract. Prepared 2026-09-13.
Repository: /Users/letuscode/projects/agent-platform. Earlier review baseline: 4ae83195f78fbeacc73ff2a700331542ed89520f. Another agent owns the active feature branch. All review work must be read-only in the repository.

## Owner objective and constraints

Assess whether existing libraries can simplify our harness while preserving platform control over agents. Remain TypeScript. Evaluate current functionality, orchestration/subagents, frontend integration and production gaps. Defer implementation until the active feature finishes. Do not assume a hosted multi-user deployment: current documented baseline is single user/local, with hosted requirements conditional.

## Documentation reference set

- https://vercel.com/academy/build-ai-agent-harness
- https://vercel.com/academy/build-ai-agent-harness/task-tool
- https://vercel.com/academy/build-ai-agent-harness/web-surface
- https://vercel.com/academy/build-ai-agent-harness/snapshot-and-restore
- https://docs.langchain.com/oss/javascript/concepts/products
- https://docs.langchain.com/oss/javascript/deepagents/overview
- https://docs.langchain.com/oss/javascript/deepagents/going-to-production
- https://docs.langchain.com/oss/javascript/deepagents/fault-tolerance
- https://docs.langchain.com/oss/javascript/deepagents/async-subagents
- https://docs.langchain.com/oss/javascript/deepagents/frontend/overview
- https://docs.langchain.com/oss/javascript/langgraph/workflows-agents
- https://docs.langchain.com/oss/javascript/langgraph/persistence
- https://docs.langchain.com/oss/javascript/langgraph/interrupts
- https://docs.langchain.com/langsmith/evaluation
- https://medium.com/populix-engineering/building-an-agent-harness-with-langchain-deep-agents-e0402de12a94 (article body unavailable; do not treat as reviewed evidence)

The documentation separates runtime (durability/state/streaming), framework (model/tool abstractions) and harness (context/tools/prompts/delegation). Deep Agents groups capabilities into execution environment, context management, delegation and steering. These are evaluation categories, not a mandate to implement every optional capability. Vercel provides an alternative TypeScript approach using ToolLoopAgent; tutorial code is not proof of production guarantees. Some JavaScript documentation contains Python-oriented examples; exact package support must be verified.

## Current evidence and preliminary findings

1. Stack: pnpm/TypeScript, Next.js/React, Express, Electron, SQLite/Drizzle/Zod. Harness uses LangGraph with custom nodes; model calls use Vercel AI SDK; MCP adapter uses official MCP SDK. Earlier lockfile resolves LangGraph 0.2.74/Core 0.3.80 and manifests request AI SDK 4.x. Modern examples are not drop-in APIs.
2. packages/harness/src/buildGraph.ts builds custom reasoning/tool/plan/critic/sensor/completion paths and creates MemorySaver per graph. No durable graph checkpoint storage demonstrated. Persistent messages and approvals exist separately; do not describe all state as ephemeral.
3. apps/api/src/infrastructure/http/v1/chatRouter.ts handles messages, approvals and resume; execution controller listens for HTTP close. Browser/BFF cancellation propagation was not tested. Claim is connection coupling in code, not proof of behavior on every browser disconnect.
4. packages/harness/src/graphState.ts includes modelConfig; packages/harness/src/types.ts permits apiKey; chatRouter initial state receives resolved model config. Before persistent checkpointing, ensure secrets are not serialized into graph state.
5. apps/web/hooks/use-harness-chat.ts consumes custom NDJSON and tracks ready/streaming plus separate approvals/tool displays; restores messages and pending approvals. No general durable run replay/reattachment was found. Existing frontend can remain; define lifecycle/event contract before deciding whether to adopt frontend SDK.
6. packages/workflow-control implements governed development workflows: Beads authority, leases, roles, specialist launching, recovery, evidence, delivery. specialistLauncher.ts/phaseRuntime.ts launch isolated specialists. No general configured-agent delegation interface was found in harness/API paths. Must distinguish development workflow control from product agent delegation and verify potential integration instead of asserting absence globally.
7. Context: packages/harness/src/contextBuilder.ts windows history with approximate counting; required input can exceed budget. chatRouter also injects working memory and retrieved memories. Assess long-loop context, bounded tool outputs, summarization and instruction retention; don't claim no memory exists.
8. Execution controls already include risk/approval policies, path/shell guards, and disabled/host/Docker/macOS VM command runner modes. Isolation should be validated on actual release target; context isolation alone is not process isolation.
9. Retry, time/token/tool limits exist. llmReason.ts costDelta = tokenDelta / 1000 is an internal unit, not monetary spend. Monetary accounting is required only if product promises money budgets. Validate parent/child aggregate limits and side-effect retry safety.
10. packages/plugin-observability/src/store.ts is bounded in-memory; structured logging, tool records, sensors and workflow journal exist. No explicit OTLP/exporter wiring found in searched source. Durable correlated monitoring and alerts are proposed, but must distinguish missing functionality from missing release evidence.
11. Single-user/no-auth is documented. createApp.ts has no central auth middleware; Compose publishes service ports and uses a development secret-key fallback. Hosted/shared deployment needs identity/authorization; local release needs an appropriate local access boundary. SQLite can be valid for a single-host release; in-process session lock doesn't support replicas.
12. CI already covers unit/type/lint/build, web E2E, Electron E2E and a packaged macOS VM staging gate. Latest results not checked. runtime-config-backup.mjs backs up selected configuration, not proven full app/journal/artifact recovery. Existing pre-production automation task spec exists; task status not verified.

## Provisional recommendations to challenge

- Preserve platform ownership of authorization, lifecycle and delivery; delegate execution mechanics to a framework where it demonstrably reduces code.
- Compare existing harness against modern AI SDK and LangChain/Deep Agents alternatives; earlier LangChain preference is provisional after reading Vercel course.
- Prioritize durable run ownership/checkpoint and side-effect recovery, frontend lifecycle integration, release-target isolation/monitoring, then measured release qualification. Framework modernization may be a dependency, not necessarily a later step.
- Bounded coordinator/specialist topology: explicit child contracts, restricted tools/models, shared total budget, concurrency/depth limits, parent/child cancellation and approval propagation, artifact ownership and result acceptance.
- Candidate acceptance journeys: two specialists with approval and restart; uncertain tool outcome after crash; duplicate resume; browser refresh/reconnect; child cancellation; oversized context; provider outage; full restore. Include successful ordinary work, not only failure tests.

## Limits and critic request

## Owner additions during critique: UI feedback and adding context

The owner explicitly asks to assess better end-user feedback and whether frameworks expose events we currently omit, including adding research/context. Include: article links/files/instructions, context selection and scope, inclusion/omission receipts, source provenance, parent-to-child context sharing, and summarization feedback.

Current evidence: apps/web/hooks/use-context-attachments.ts and lib/file-context.ts support attachments; chat-input.tsx has file picker/drop/remove/clear/warnings; memory and skills dashboards already exist. Do not label all context entry missing. packages/harness/src/trace.ts already defines retries, timeouts, context-window, memory-retrieval and skill events. OutputSchema and UI renderer expose a narrower set; critic/tool status sometimes travels through text/thinking conventions. llmReason.ts consumeFullStream forwards text/reasoning/error rather than all provider stream phases. chatRouter heartbeat is a blank newline, not a work-progress assertion.

Framework candidates: LangGraph state/custom/subgraph streams and supported frontend projections; Deep Agents child events; AI SDK typed UI message/custom data parts. Our AI SDK calls are not automatically LangChain instrumented: an explicit bridge is needed. More runtime events do not create durable replay or meaningful progress by themselves. Public UI events must be curated rather than exposing entire graph state or secrets.

Source additions: https://docs.langchain.com/oss/javascript/langgraph/streaming and https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data .

The owner further clarified the goal as building a knowledge base to improve AI understanding over time. Assess a persistent source-backed knowledge lifecycle, not merely attachment entry: ingestion of articles/files, extraction and versioning, project/agent access, retrieval, citations, updates/deletion, staleness and review of learned candidates. Existing memoryRetrieval.ts already implements scoped lexical scoring with confidence/safety filtering, bounded excerpts and source metadata; memoryCandidates.ts and selfLearning.ts create reviewable candidates. A document knowledge base should build on these controls, distinguish evidence from proposed learning, and measure retrieval/answer improvement. Retrieval augments context; it does not update model weights. Avoid prematurely mandating a vector database. Reference: https://docs.langchain.com/oss/javascript/deepagents/retrieval .

This is a source/document review, not runtime certification or a complete dependency/security audit. No code changed, no performance/evaluation experiments run, no production readiness certified. No deployment scope expansion approved.

Independently challenge the claims above. Identify incorrect assertions, conflated layers, missed existing functionality, missing harness capabilities, priority errors and unjustified framework preferences. For each actionable finding provide severity, source path/line or official URL, correction and practical impact. Classify production items as confirmed gap, partial implementation, evidence gap, or deployment-conditional. Suggest a corrected minimal sequence and say what requires runtime proof. Return concise review suitable for the owner; write a detailed report outside the repository if helpful. This is research critique, not formal criticReviewSchema approval of an execution contract.
