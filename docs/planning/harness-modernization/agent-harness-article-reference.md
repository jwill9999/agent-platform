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

These destinations were extracted from the article on 25 September 2026. Linked sources have not
been independently reviewed in this reference-saving exercise. Labels describe investigation topics,
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
