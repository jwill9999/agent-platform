# Reference: The Anatomy of an Agent Harness

- Source: [The Anatomy of an Agent Harness](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness)
- Author: Vivek Trivedy, LangChain.
- Published: 10 March 2026. Accessed: 25 September 2026.
- Purpose: owner-requested context for future service/feature gap assessment and orchestration review.
- Status: external perspective, not an approved design or evidence of Agent Platform capabilities.

## Brief summary

The article treats a harness as the surrounding system that makes a model useful: instructions,
tools, execution environments, state and orchestration. It discusses filesystem persistence, code
execution, sandbox boundaries, retrieval, context management, skills, and verification loops.
Long-running work needs durable progress, planning and feedback; model capability alone does not
supply these mechanisms. The author also discusses how models and harnesses evolve together.

## Questions for our assessment

These are our proposed discussion prompts, not conclusions from testing:

- Which capabilities already exist, and which have connected runtime evidence?
- Are routing, permissions, continuation and completion enforced outside model instructions?
- Can agents retrieve task context and verify both UI outcomes and backend effects?
- What evidence justifies reuse, targeted repairs or a broader stack change?

Read alongside the [research index](README.md) and the
[current-runtime baseline proposal](current-runtime-baseline-plan.md). Preserve the agreed
baseline-first approach. Revisit the original article before relying on technical details.

This note saves a link and an original summary; it does not reproduce the full article.

## Supporting links for future investigation

These destinations were extracted from the article on 25 September 2026. Linked sources were initially saved without further review. The Deep Agents overview and
selected supporting pages have since been read as recorded below; other links remain unreviewed. Labels describe investigation topics,
not verified conclusions or recommendations to adopt a product. Tracking parameters are omitted.

| Article link | Potential assessment topic |
| --- | --- |
| [LangChain agents](https://docs.langchain.com/oss/python/langchain/agents) | Model/tool execution loop |
| [Agent Browser](https://github.com/vercel-labs/agent-browser) | Browser interaction and verification |
| [AGENTS.md](http://agents.md/) | Project instruction discovery |
| [IBM continual learning overview](https://www.ibm.com/think/topics/continual-learning) | Terminology: distinguish stored context from model training |
| [Context7](https://context7.com/) | Retrieval of current documentation |
| [Context Rot research](https://research.trychroma.com/context-rot) | Context growth and performance evidence |
| [Ralph Loop](https://ghuntley.com/loop/) | Continuation and stopping rules |
| [Codex prompting guide: apply_patch](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide/#apply_patch) | Model/tool interface assumptions |
| [Terminal Bench 2.0](https://www.tbench.ai/leaderboard/terminal-bench/2.0) | Evaluation methodology and limits of benchmark comparisons |
| [Author's harness experiment post](https://x.com/Vtrivedy10/status/2023805578561060992) | Locate underlying experiment evidence before using its claims |
| [Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview) | Candidate capability comparison; Python examples require TypeScript applicability checks |

## How to use this context

For a future assessment, map each relevant capability to our service or feature, its source code,
existing Beads task, observed behavior and connected test evidence. Distinguish **implemented and
proven**, **implemented but unverified**, **missing**, and **not required**. Then record user impact,
dependencies and a proposed disposition in the existing assessment and Beads records.

Follow the relevant links at assessment time, record the version/date and verify claims against
primary documentation or reproducible evidence. The article is a starting point, not an exhaustive
requirements list. Saving these references does not establish a gap or authorize implementation.

## Deep Agents: prebuilt component assessment context

Reviewed on 25 September 2026: [Python overview](https://docs.langchain.com/oss/python/deepagents/overview),
[TypeScript overview](https://docs.langchain.com/oss/javascript/deepagents/overview), and selected
Python backend, permission and human-approval documentation. This is a documentation assessment,
not package installation, source audit, runtime verification or a migration decision.

### Building blocks described by the overview

Deep Agents packages a harness over LangChain building blocks and LangGraph execution. Its four
main areas are execution, context management, delegation and human steering. The following are
candidate comparison areas, not findings that our platform lacks them.

| Building block | Documented capability | Our assessment question |
| --- | --- | --- |
| Tool execution | Custom tools and MCP integration | Can our dispatcher policies, errors and audit events remain authoritative? |
| Workspace | Virtual filesystem with interchangeable backends | How do project identity, path confinement and exported artifacts map? |
| Execution environment | Optional shell sandbox and interpreter | Which host controls enforce filesystem, network and credential isolation? |
| Context | Skills, memory, summarization, result offloading and caching | Can context retention be measured across long journeys and model changes? |
| Delegation | Subagents with isolated context; optional task planning | How are completion, cancellation, budgets and task dependencies governed? |
| Steering | Interrupt-based human approvals | Can our approval boundaries survive handoffs and recovery? |
| Visibility | Streaming of agent and delegated activity | Can third-party tooling consume correlated, redacted events? |

Sources: the [Python](https://docs.langchain.com/oss/python/deepagents/overview) and
[TypeScript](https://docs.langchain.com/oss/javascript/deepagents/overview) overviews.

### Boundaries to preserve in a reuse assessment

- **Persistence is configurable.** StateBackend keeps files in thread state through checkpoints;
  that is not automatically shared across threads. Backend choice must match the desired lifetime.
  Our evaluation must separately prove process-restart durability, project separation and cleanup.
  [Backend guide](https://docs.langchain.com/oss/python/deepagents/backends).
- **File permissions are not a complete sandbox.** The documented rules use first-match evaluation
  and allow unmatched paths. Arbitrary sandbox commands require separate enforcement; path rules
  alone cannot contain shell access. Test our deny cases through every tool and child-agent route.
  [Permission guide](https://docs.langchain.com/oss/python/deepagents/permissions).
- **Approval requires saved execution state.** Human-in-the-loop documentation requires a
  checkpointer for interrupt/resume. Its in-memory examples are not evidence of durable deployment.
  Test duplicate decisions, restart, stale approvals and uncertain side effects against our existing
  requirements. Tool-call approval is not evidence of exact-document execution authorization.
  [Human-in-the-loop guide](https://docs.langchain.com/oss/python/deepagents/human-in-the-loop).
- **Language/version parity needs proof.** TypeScript has a documented `deepagents` package and
  `createDeepAgent` entry point. However, the TypeScript overview currently includes Python snippets
  in some advanced sections. Verify exported APIs, defaults and capabilities against pinned package
  versions and actual TypeScript tests; do not translate examples and assume support.
  [TypeScript overview](https://docs.langchain.com/oss/javascript/deepagents/overview).
- **Task planning is not our durable task authority.** The Python overview describes planning as
  opt-in from version 0.7. Any candidate task-list facility must integrate with Beads rather than
  introduce competing completion state. Context isolation also does not prove permission isolation.
  [Python overview](https://docs.langchain.com/oss/python/deepagents/overview).

### Further references retained

The pages below were discovered from the overview. Except for the selected guides above, their
full content remains to be reviewed when relevant. Beta status and availability must be refreshed.

| Topic | References |
| --- | --- |
| Setup and extension | [Quickstart](https://docs.langchain.com/oss/python/deepagents/quickstart), [customization](https://docs.langchain.com/oss/python/deepagents/customization), [models](https://docs.langchain.com/oss/python/deepagents/models) |
| Tools and isolation | [Tools](https://docs.langchain.com/oss/python/deepagents/tools), [MCP](https://docs.langchain.com/oss/python/langchain/mcp), [sandboxes](https://docs.langchain.com/oss/python/deepagents/sandboxes), [interpreters](https://docs.langchain.com/oss/python/deepagents/interpreters) |
| Context | [Skills](https://docs.langchain.com/oss/python/deepagents/skills), [memory](https://docs.langchain.com/oss/python/deepagents/memory), [context engineering](https://docs.langchain.com/oss/python/deepagents/context-engineering) |
| Coordination | [Subagents](https://docs.langchain.com/oss/python/deepagents/subagents), [async subagents](https://docs.langchain.com/oss/python/deepagents/async-subagents) |
| Monitoring and UI | [Streaming](https://docs.langchain.com/oss/python/deepagents/streaming), [event streaming](https://docs.langchain.com/oss/python/deepagents/event-streaming), [frontend](https://docs.langchain.com/oss/python/deepagents/frontend/overview), [observability](https://docs.langchain.com/langsmith/observability-quickstart) |
| Extension and deployment | [Middleware](https://docs.langchain.com/oss/python/langchain/middleware/overview), [production](https://docs.langchain.com/oss/python/deepagents/going-to-production) |

### Decision this can support later

Compare three options against the same approved journeys: retain existing code, reuse selected
components, or adopt a broader harness. Record version compatibility, integration effort, behavior
changes, operational dependencies, latency/cost, security boundaries and connected test results.
Keep product runtime capabilities separate from development orchestration requirements.

Our discriminating tests should include permitted and denied tool calls, approval/restart,
cancellation, uncertain-success retries, one-task completion, automatic two-task progression and
monitoring export. These are proposed evaluation criteria, not additional authorized implementation.
Neither library marketing nor passing example code establishes that it can replace our current
brokers, approved-document binding or end-to-end verification obligations.

## Ongoing review principle — owner direction, 25 September 2026

Keep these resources visible during continued service and feature gap assessment. Existing gap
analysis is partial; build on its evidence and Beads records rather than restarting or treating
unverified capabilities as absent. The primary lens is concepts, services, features and user value.
Language and package compatibility are subsequent feasibility checks.

For each material gap, explicitly compare existing implementation improvement, selective prebuilt
library reuse and broader harness adoption. Prefer an adapter behind a service boundary where that
can preserve clean architecture and shorten delivery. Replaceability is a design goal, not a claim
of automatic plug-and-play compatibility: assess state ownership, permissions, cancellation,
recovery, events, errors and operational dependencies as well as interface shape.

Revisit this comparison at each feature-planning/refinement cycle and after each significant pilot
or delivery milestone. Reassess sooner when runtime evidence exposes a gap, a relevant library
capability changes, or bespoke implementation effort increases. This is a recurring review
checkpoint; no calendar interval or automated monitoring has been agreed.

Include discovery, not just reassessment of known gaps: scan relevant release notes and capability
guides for new or evolving functionality, and consider user needs we have not yet identified.
Record promising capabilities even when they have no existing backlog counterpart, explaining the
potential user value and evidence needed. Classify them as investigate, trial, defer or not relevant;
novelty alone is not a reason to adopt them. Create or refine Beads work only when follow-up is warranted.

For each review, record the date, capability, current evidence, relevant source/version, existing
Beads issue where applicable, candidate reuse option, expected benefit, integration risks and decision
or reason for deferral. Distinguish implemented-and-proven, implemented-but-unverified, missing and not-required.
Refresh only the relevant documentation and tests. Keep existing priorities and approval boundaries;
this direction does not authorize migration, installation or new implementation.

Before selecting bespoke work, ask: can an available component close this gap sooner through an
adapter while preserving our guarantees? Validate any candidate against the same connected journeys
as the current service. Beads remains authoritative for follow-up work and scheduling.
