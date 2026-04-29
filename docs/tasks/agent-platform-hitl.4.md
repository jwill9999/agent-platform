# Task: Resume approved tool execution safely

**Beads issue:** `agent-platform-hitl.4`
**Spec file:** `docs/tasks/agent-platform-hitl.4.md` (this file)
**Parent epic:** `agent-platform-hitl` — Human-in-the-loop approval workflow

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-hitl.4.md`

## Task requirements

Implement the durable resume path so an approved pending tool call can continue execution without replaying unsafe state or orphaning tool messages.

## Detailed requirements

- Add an explicit resume API, likely `POST /v1/sessions/:id/resume` or equivalent.
- Persist enough run state to resume a pending tool call. Acceptable approaches:
  - Persist a compact pending tool execution envelope and continue from a dedicated resume path.
  - Or switch LangGraph checkpointing to durable storage and resume the graph from the pause point.
- Ensure approved execution uses the exact reviewed tool name and args, not a fresh LLM-generated call.
- Ensure rejection is visible to the agent as a tool result/error so it can continue with an alternative answer.
- Prevent duplicate execution when the same approval decision is submitted twice.
- Fix or avoid the current orphan tool-message replay limitation. Assistant tool calls must round-trip, or resumed tool execution must not depend on replaying orphan tool rows.
- Keep session locking semantics: only one run/resume path should mutate a session at once.

## Dependency order

### Upstream — must be complete before this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.3` | [Spec](./agent-platform-hitl.3.md) |

### Downstream — waiting on this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.5` | [Spec](./agent-platform-hitl.5.md) |

## Implementation plan

1. Decide the durable resume state model before coding; update this spec if choosing durable LangGraph checkpoints.
2. Add contracts and route for resume.
3. Add repository support for marking approval requests as consumed/executed.
4. Execute approved tool calls through the same security, timeout, retry, audit, and output scanning path as normal dispatch.
5. Feed approved or rejected tool result back into the graph so the assistant can finish.
6. Persist messages in a way that future conversation replay remains valid.
7. Add integration tests for approve, reject, duplicate decision, stale approval, and session lock behavior.

## Tests

- Unit tests for resume state validation.
- Harness/API integration test: pending approval -> approve -> tool executes once -> assistant completes.
- Harness/API integration test: pending approval -> reject -> assistant receives rejection and completes.
- Duplicate approval decision test.
- Conversation replay test after a resumed tool execution.
- Run `pnpm test`, `pnpm lint`, and `pnpm typecheck`.

## Definition of done

- [ ] Approved pending calls resume safely and execute once.
- [ ] Rejected pending calls produce a useful tool result/error.
- [ ] Resume state is durable across the original chat HTTP stream ending.
- [ ] Message persistence is compatible with future turns.
- [ ] Beads dependencies match this spec.

## Sign-off

- [ ] Branch `task/agent-platform-hitl.4` created from `task/agent-platform-hitl.3`.
- [ ] Tests listed above pass.
- [ ] `bd close agent-platform-hitl.4 --reason "..."`
