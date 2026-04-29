# Task: Build frontend approval UX and e2e coverage

**Beads issue:** `agent-platform-hitl.5`
**Spec file:** `docs/tasks/agent-platform-hitl.5.md` (this file)
**Parent epic:** `agent-platform-hitl` — Human-in-the-loop approval workflow

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-hitl.5.md`

## Task requirements

Render pending approval cards in chat, let the user approve or reject tool execution, and validate the full workflow in Playwright.

## Detailed requirements

- Add UI state for approval-required stream events.
- Render an approval card near the relevant assistant turn.
- Show tool name, risk tier, redacted args preview, and clear approve/reject controls.
- Keep the interface compact and work-focused; avoid modal-only approval if inline context is clearer.
- Disable duplicate clicks while a decision request is in flight.
- Show terminal states: approved, rejected, expired, executed, or failed.
- On approve or reject, call the decision API and resume endpoint as required by task `.4`.
- Keep user-visible assistant text separate from approval metadata.
- Add e2e coverage using deterministic seeded data and a safe high-risk test tool path.

## Dependency order

### Upstream — must be complete before this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.4` | [Spec](./agent-platform-hitl.4.md) |

### Downstream — waiting on this task

None.

## Implementation plan

1. Extend web stream event types and `useHarnessChat` state.
2. Add an approval card component under `apps/web/components/chat`.
3. Wire approve/reject API calls and resume behavior.
4. Add loading, error, and terminal states.
5. Add unit tests for event parsing/state updates.
6. Add Playwright e2e for pending approval, approve, reject, and no pre-approval execution.
7. Update docs/screenshots only if the user-facing behavior needs explanation.

## Tests

- Web hook/parser test for approval-required events.
- Component test or focused unit test for approval card state.
- Playwright e2e:
  - high-risk tool emits approval request without executing,
  - approve executes and resumes,
  - reject prevents execution and resumes with rejection,
  - refresh/reload can still show pending approval.
- Full `pnpm run test:e2e` against Docker compose.
- Run `pnpm lint` and `pnpm typecheck`.

## Definition of done

- [ ] Users can approve/reject pending tool calls from chat.
- [ ] Approval metadata is readable, redacted, and accessible.
- [ ] Duplicate and stale decisions are handled gracefully in UI.
- [ ] E2E verifies the complete HITL workflow.
- [ ] Feature branch CI is green.
- [ ] Epic `agent-platform-hitl` can be closed after this task.

## Sign-off

- [ ] Branch `task/agent-platform-hitl.5` created from `task/agent-platform-hitl.4`.
- [ ] Tests listed above pass.
- [ ] PR merged from `task/agent-platform-hitl.5` to `feature/agent-platform-hitl`.
- [ ] `bd close agent-platform-hitl.5 --reason "..."`
