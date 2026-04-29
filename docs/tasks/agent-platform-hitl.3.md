# Task: Emit approval-required stream events

**Beads issue:** `agent-platform-hitl.3`
**Spec file:** `docs/tasks/agent-platform-hitl.3.md` (this file)
**Parent epic:** `agent-platform-hitl` — Human-in-the-loop approval workflow

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-hitl.3.md`

## Task requirements

Extend contracts, harness output, and chat streaming so pending tool approvals appear as first-class NDJSON events.

## Detailed requirements

- Extend `OutputSchema` with an approval event, for example:

  ```ts
  {
    type: 'approval_required',
    approvalRequestId: string,
    toolName: string,
    riskTier?: RiskTier,
    argsPreview: unknown,
    message?: string
  }
  ```

- When tool dispatch reaches an approval-required call, create an approval request and emit the approval event.
- Stop before executing that tool.
- Decide whether remaining tool calls in the same assistant tool-call batch are skipped, queued, or represented as pending. Document and test the choice.
- Ensure the frontend NDJSON parser does not treat the approval event as final assistant text.
- Add docs for the new stream event.

## Dependency order

### Upstream — must be complete before this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.2` | [Spec](./agent-platform-hitl.2.md) |

### Downstream — waiting on this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.4` | [Spec](./agent-platform-hitl.4.md) |

## Implementation plan

1. Extend contracts and output parsing.
2. Add an approval request creator dependency to the tool dispatch context.
3. Replace phase-1 denial behavior with create-and-emit-pending behavior where durable APIs exist.
4. Return a halted/paused graph state that the chat route can persist and close cleanly.
5. Update web stream parsing to retain approval events for future UI work.
6. Update message-flow and API docs.

## Tests

- Contract test for `approval_required`.
- Harness test that approval-required call emits the event and does not execute.
- API/chat integration test that the event appears in the NDJSON stream.
- Web hook/parser test that the event is not appended to assistant answer text.
- Run relevant package tests plus `pnpm lint` and `pnpm typecheck`.

## Definition of done

- [ ] Approval-required stream event is part of the shared contract.
- [ ] Approval request is persisted before the event is emitted.
- [ ] Tool execution does not happen before approval.
- [ ] Parser/docs understand the new event.
- [ ] Beads dependencies match this spec.

## Sign-off

- [ ] Branch `task/agent-platform-hitl.3` created from `task/agent-platform-hitl.2`.
- [ ] Tests listed above pass.
- [ ] `bd close agent-platform-hitl.3 --reason "..."`
