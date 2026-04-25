# ADR-0001: Tier 1 gap remediation — evaluator loop, DoD contract, observability tools, docs CI

- **Status:** Accepted
- **Date:** 2026-04-25
- **Deciders:** Jason Williams (owner)
- **Related:**
  - Epic `agent-platform-d87`
  - Tasks `agent-platform-7ga`, `agent-platform-fc8`, `agent-platform-2v6`, `agent-platform-n6t`
  - `docs/planning/gap-analysis.md`, `docs/planning/harness-optimisation.md`, `docs/planning/anthropic-gap-analysis.md`

## Context

The consolidated gap analysis surfaced four Tier 1 weaknesses in the harness and supporting tooling:

1. **No self-correction loop.** The harness streamed the first usable LLM output without an evaluator pass, so quality and faithfulness regressions slipped past the runtime.
2. **Implicit Definition-of-Done.** Successful task completion was inferred from the absence of errors, with no explicit contract artifact in `HarnessStateType`. Plugins could not enforce DoD policies.
3. **Plugin-only observability.** `plugin-observability` collected logs and traces, but the agent itself could not query them at runtime, leaving recovery flows blind to their own telemetry.
4. **Documentation drift.** `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` duplicated ~80 lines of operating rules, with no CI gate for markdown lint, link validation, or architectural decisions.

These gaps blocked higher-tier work (multi-agent orchestration, replayable sessions, and external publishing of the platform handbook).

## Decision

We adopt the four mitigations as a single Tier 1 remediation epic. Each is locked in by a child task with its own spec, branch, and segment PR; this ADR records the architectural decisions taken across all four.

1. **Evaluator agent + critic loop** (`agent-platform-7ga`).
   - Add a `critic` node and an evaluator persona to the harness; loop back to `llmReason` when the critic rejects the candidate output, capped at a hard iteration limit.
   - Wire into LangGraph in `packages/harness/src/buildGraph.ts`.

2. **Definition-of-Done contract phase** (`agent-platform-fc8`).
   - Introduce `DodContractSchema` in `packages/contracts/src/dod.ts`.
   - Add the `onDodCheck` plugin hook with ordered override semantics.
   - Add `dodPropose` and `dodCheck` nodes; route through them before `END`. Failed DoD injects `<dod-failed>` feedback back to `llmReason` and emits `DOD_FAILED` on cap exhaustion.

3. **Agent-queryable observability tools** (`agent-platform-2v6`).
   - Add native tools `query_logs`, `query_recent_errors`, and `inspect_trace` in `packages/harness/src/tools/observabilityTools.ts`.
   - Risk-tier 0, session-jailed via closure-bound `sessionId`, schemas in `packages/contracts`, audit-logged through `toolDispatch`.

4. **Docs-as-record CI + ADR pattern + agent-instructions de-duplication** (`agent-platform-n6t`).
   - Single source of truth at `docs/agent-instructions-shared.md`; `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` become thin wrappers (≥ 80% duplicate-line reduction).
   - ADR template + index live under `docs/adr/`, recording future locked decisions.
   - CI gate via `.github/workflows/docs-ci.yml` running `markdownlint-cli2` and `lychee`.
   - Local script `pnpm docs:lint` mirrors the CI checks.

### Alternatives considered

- **Defer the evaluator loop until multi-agent orchestration lands.** Rejected: the loop is independently valuable for single-agent quality and is a prerequisite for richer orchestration.
- **Externalise observability via OpenTelemetry only.** Rejected for MVP: agent self-recovery requires synchronous, in-process access to recent telemetry; OTEL export remains a future option.
- **Use front-matter transclusion (e.g. `{{include}}`) inside the agent-instruction wrappers.** Rejected: not all agent consumers expand transclusion; a clear cross-link to the shared doc is portable and grep-friendly.

## Consequences

### Positive

- Quality regressions are caught inside the runtime by the critic loop; DoD failures are explicit, structured events.
- Agents can introspect their own session telemetry, enabling self-recovery, smarter retries, and better debugging messages to the user.
- A single edit to `docs/agent-instructions-shared.md` updates every agent surface; CI prevents markdown drift and broken links from re-entering the docs corpus.
- Future architectural choices have a canonical record under `docs/adr/`, separate from per-task spec files.

### Negative / risks

- The critic + DoD phases add iterations (and tokens). Hard caps and cap-exhaustion events bound the cost; observability tools surface the cost when it occurs.
- Markdown CI may flag pre-existing violations in unrelated docs. Scope-limited: `n6t` only fixes files it touches; broader cleanup is tracked separately.
- Session-jailed observability tools rely on closure-bound `sessionId`; future multi-tenant work must preserve that invariant when refactoring tool factories.

### Follow-up actions

- [ ] Surface critic iterations visibly in the chat UI — beads `agent-platform-btm`.
- [ ] Expose DoD failures in the UI when a task is closed unsuccessfully (covered by `btm`).
- [ ] Add a structured `agent.metrics` channel that combines critic + DoD + observability counts (future tier-2 work, not yet filed).

## References

- Task specs:
  - [docs/tasks/agent-platform-d87.md](../tasks/agent-platform-d87.md) (epic)
  - [docs/tasks/agent-platform-7ga.md](../tasks/agent-platform-7ga.md)
  - [docs/tasks/agent-platform-fc8.md](../tasks/agent-platform-fc8.md)
  - [docs/tasks/agent-platform-2v6.md](../tasks/agent-platform-2v6.md)
  - [docs/tasks/agent-platform-n6t.md](../tasks/agent-platform-n6t.md)
- Architecture: [docs/architecture.md](../architecture.md), [docs/architecture/message-flow.md](../architecture/message-flow.md)
- Planning: [docs/planning/gap-analysis.md](../planning/gap-analysis.md), [docs/planning/harness-optimisation.md](../planning/harness-optimisation.md)
