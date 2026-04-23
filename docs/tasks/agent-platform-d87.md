# Epic: Tier 1 — gap remediation (evaluator, contracts, observability, docs CI)

**Beads issue:** `agent-platform-d87`
**Spec file:** `docs/tasks/agent-platform-d87.md` (this file)
**Type:** Epic (priority P1)
**Feature branch:** `feature/agent-platform-d87`

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-d87.md`

## Goal

Close the highest-priority gaps surfaced by the consolidated gap analysis (`docs/planning/gap-analysis.md` + `docs/planning/harness-optimisation.md` + `docs/planning/anthropic-gap-analysis.md`).

The epic delivers four capabilities the platform currently lacks:

1. A **critic / evaluator** stage so the agent can self-correct against the user's ask before returning.
2. An explicit **Definition-of-Done (DoD) contract** phase wired into the harness lifecycle.
3. **Agent-queryable observability tools** so the agent can read its own logs and traces at runtime.
4. **Docs-as-record CI** plus an ADR pattern, plus de-duplication of the three agent-instruction files (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`).

## Children (segment, executed in order)

Each child has its own spec and Beads issue. They form one Git **segment** under `feature/agent-platform-d87`. Branches chain in the order below; only the **last** task opens a PR back to the feature branch.

| #   | Beads id             | Spec                                                           | Title                                                       |
| --- | -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `agent-platform-7ga` | [Evaluator agent + iteration loop](./agent-platform-7ga.md)    | Critic node + evaluator persona                             |
| 2   | `agent-platform-fc8` | [Definition-of-Done contract phase](./agent-platform-fc8.md)   | DoD lifecycle hook + contract artifact                      |
| 3   | `agent-platform-2v6` | [Agent-queryable observability tools](./agent-platform-2v6.md) | `query_logs` / `query_recent_errors` / `inspect_trace`      |
| 4   | `agent-platform-n6t` | [Docs-as-record CI + ADR + de-dup](./agent-platform-n6t.md)    | markdownlint, link-check, ADR template, shared instructions |

`bd dep list agent-platform-d87` should show all four as `blocks: agent-platform-d87`.

## Definition of done (epic)

The epic is complete when **all** of the following are true:

- [ ] All four child issues are **closed** in Beads with their specs satisfied.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` are green on `feature/agent-platform-d87`.
- [ ] `pnpm test:e2e` covers at least one happy-path session that exercises the new evaluator + DoD path.
- [ ] Updated docs:
  - `docs/architecture.md` documents the critic/DoD lifecycle.
  - `docs/architecture/message-flow.md` Mermaid updated.
  - `docs/api-reference.md` lists any new endpoints/tools.
  - `decisions.md` records the architectural choice (one row per child where it changed a locked decision).
- [ ] An ADR (`docs/adr/`) is filed for the evaluator/DoD design and for the docs-as-record decision.
- [ ] No regression in security guards (`packages/harness/src/security/*`); guard tests still green.
- [ ] PR `feature/agent-platform-d87 → main` merged.

## Sign-off

- [ ] All four children closed (`bd close`)
- [ ] Quality gates green
- [ ] Docs + ADRs merged
- [ ] PR `feature/agent-platform-d87 → main` merged (link: ****\_\_****)
- [ ] `bd close agent-platform-d87 --reason "Tier 1 gap remediation complete"`

**Reviewer / owner:** **********\_********** **Date:** ******\_******
