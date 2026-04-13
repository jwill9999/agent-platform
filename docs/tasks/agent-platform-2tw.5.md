# Task: Harness: integration test — agent + MCP tool path

**Beads issue:** `agent-platform-2tw.5`  
**Spec file:** `docs/tasks/agent-platform-2tw.5.md` (this file)  
**Parent epic:** `agent-platform-2tw` — Epic: Harness — MCP, validation, LangGraph, streaming

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-2tw.5.md`

## Task requirements

### From Beads (description)

End-to-end in test or compose: register MCP tool, allowlisted agent, single chat turn invokes tool; verify validation rejects disallowed tool.

### From Beads (acceptance criteria)

Automated test green in CI; documented setup for local MCP.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-2tw.4` | [Harness: chat streaming + model router (OpenAI first)](./agent-platform-2tw.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| — | *No `blocks` dependencies (parent epic only)* |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-2tw.5` shows expected upstream issues **closed** before PR.
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
- [ ] `bd close agent-platform-2tw.5 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
