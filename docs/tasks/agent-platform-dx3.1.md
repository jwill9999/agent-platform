# Task: Planner+Plugins: plugin-sdk package + hook contracts

**Beads issue:** `agent-platform-dx3.1`  
**Spec file:** `docs/tasks/agent-platform-dx3.1.md` (this file)  
**Parent epic:** `agent-platform-dx3` — Epic: Planner + plugin SDK + memory/observability

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-dx3.1.md`

## Task requirements

### From Beads (description)

packages/plugin-sdk: PluginHooks (onSessionStart, onTaskStart, onPromptBuild, onToolCall, onTaskEnd, onError); typed contexts; guarantee hooks cannot bypass validation (document + tests).

### From Beads (acceptance criteria)

Unit tests for hook dispatch order; types exported; README integration notes.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-2tw.3` | [Harness: LangGraph minimal graph + trace events](./agent-platform-2tw.3.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-dx3.2` | [Planner+Plugins: LLM planner JSON + validation + repair](./agent-platform-dx3.2.md) |
| `agent-platform-dx3.3` | [Planner+Plugins: observability plugin](./agent-platform-dx3.3.md) |
| `agent-platform-dx3.4` | [Planner+Plugins: session memory + plugin resolution (global → user → agent)](./agent-platform-dx3.4.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-dx3.1` shows expected upstream issues **closed** before PR.
4. Open PR; request review against **Definition of done**.

## Tests (required before sign-off)

- **Unit:** Cover new logic introduced by this task (per Beads acceptance).
- **Integration / E2E:** Required when this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] All **upstream** issues in Beads are **closed**.
- [ ] Tests in this spec are **green** locally and in CI when applicable.
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

- [ ] **Definition of done** complete
- [ ] `bd close agent-platform-dx3.1 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
