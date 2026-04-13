# Task: MVP E2E: operator docs + Docker runbook

**Beads issue:** `agent-platform-o36.2`  
**Spec file:** `docs/tasks/agent-platform-o36.2.md` (this file)  
**Parent epic:** `agent-platform-o36` — Epic: MVP E2E — filesystem MCP + default agent path

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-o36.2.md`

## Task requirements

### From Beads (description)

README: clone, env, compose up, seed, open web, first chat; security notes for container boundary and mounts; troubleshooting.

### From Beads (acceptance criteria)

New developer can follow doc without tribal knowledge; decisions.md link for ADR.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-o36.1` | [MVP E2E: automated happy path + CI job](./agent-platform-o36.1.md) |

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
3. Ensure `bd dep list agent-platform-o36.2` shows expected upstream issues **closed** before PR.
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
- [ ] `bd close agent-platform-o36.2 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
