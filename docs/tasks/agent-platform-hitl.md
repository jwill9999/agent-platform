# Epic: Human-in-the-loop approval workflow

**Beads issue:** `agent-platform-hitl`
**Spec file:** `docs/tasks/agent-platform-hitl.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-hitl.md`

## Epic requirements

Implement durable human-in-the-loop (HITL) approval for risk-tiered tool execution.

The current platform already has useful foundations: tool risk tiers, `requiresApproval` metadata, system tool audit logs, session/message persistence, and an NDJSON chat stream. The missing product behavior is the approval workflow itself: high-risk or explicitly approval-required tools must not execute silently; the user must be able to inspect, approve, or reject a pending tool call; and approved execution must resume without losing or corrupting run state.

## Scope

This epic covers:

- Immediate deny-by-default safety for risky tools while durable resume support is being built.
- Approval request contracts, database persistence, repositories, and API endpoints.
- First-class approval-required stream events.
- Safe resume semantics for approved or rejected tool calls.
- Frontend approval UX and end-to-end coverage.

This epic does not require multi-user authorization. The platform is still single-user MVP, but the design should not make future per-user approval ownership difficult.

## Architecture principles

- Do not implement HITL as an in-memory `await` inside a single chat HTTP request.
- Approval state must be durable enough to survive browser refreshes and completed/closed HTTP streams.
- The host owns approval decisions. Plugin hooks may observe tool calls but must not approve, reject, or execute them.
- Tool arguments shown to the user must be redacted using the same secret-redaction rules as audit logging.
- Critical-risk tools should remain non-executable unless a later architectural decision explicitly changes that policy.

## Child tasks

| Issue                   | Title                                             | Spec                               |
| ----------------------- | ------------------------------------------------- | ---------------------------------- |
| `agent-platform-hitl.1` | Add deny-by-default approval gate for risky tools | [Spec](./agent-platform-hitl.1.md) |
| `agent-platform-hitl.2` | Persist approval request records and APIs         | [Spec](./agent-platform-hitl.2.md) |
| `agent-platform-hitl.3` | Emit approval-required stream events              | [Spec](./agent-platform-hitl.3.md) |
| `agent-platform-hitl.4` | Resume approved tool execution safely             | [Spec](./agent-platform-hitl.4.md) |
| `agent-platform-hitl.5` | Build frontend approval UX and e2e coverage       | [Spec](./agent-platform-hitl.5.md) |

## Dependency order

Execution order is enforced in Beads:

```text
agent-platform-hitl.1
  -> agent-platform-hitl.2
  -> agent-platform-hitl.3
  -> agent-platform-hitl.4
  -> agent-platform-hitl.5
```

If implementation discovers that frontend work can safely start earlier behind mocked APIs, update this spec and Beads dependencies together.

## Feature branch

Use `feature/agent-platform-hitl` for the integration branch. Each task should use `task/<issue-id>` branches chained in Beads dependency order unless a later spec update deliberately splits the epic into multiple segments.

## Definition of done

- [ ] All child tasks are closed in Beads.
- [ ] High-risk and `requiresApproval` tools cannot execute silently.
- [ ] Approval requests are persisted, queryable, and auditable.
- [ ] Users can approve or reject pending tool calls in the chat UI.
- [ ] Approved or rejected decisions resume the agent flow safely.
- [ ] Relevant contracts, API docs, architecture docs, and tests are updated.
- [ ] CI and e2e are green on the feature branch before merge to `main`.
