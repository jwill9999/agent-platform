# Task: Frontend: Next.js app + useChat + API wiring

**Beads issue:** `agent-platform-ast.1`  
**Spec file:** `docs/tasks/agent-platform-ast.1.md` (this file)  
**Parent epic:** `agent-platform-ast` — Epic: Frontend — Next.js chat + config UI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-ast.1.md`

## Task requirements

### From Beads (description)

apps/web: Next.js App Router; Vercel AI SDK useChat pointing to backend stream; env for API base URL; minimal layout; no business logic in client beyond forms.

### From Beads (acceptance criteria)

Manual or E2E smoke: message sends and streams; types imported from contracts where possible.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-2tw.4` | [Harness: chat streaming + model router (OpenAI first)](./agent-platform-2tw.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-ast.2` | [Frontend: Output renderers (text, code, tool_result, error, thinking)](./agent-platform-ast.2.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-ast.1` shows expected upstream issues **closed** before PR.
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
- [ ] `bd close agent-platform-ast.1 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
