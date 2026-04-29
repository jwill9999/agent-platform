# Task: Persist approval request records and APIs

**Beads issue:** `agent-platform-hitl.2`
**Spec file:** `docs/tasks/agent-platform-hitl.2.md` (this file)
**Parent epic:** `agent-platform-hitl` — Human-in-the-loop approval workflow

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-hitl.2.md`

## Task requirements

Add durable approval request contracts, database storage, repositories, and API endpoints so pending human decisions are first-class platform data.

## Detailed requirements

- Add a contract package schema for approval requests and decision bodies.
- Add a SQLite migration and Drizzle schema for `approval_requests`.
- Store at minimum:
  - `id`
  - `sessionId`
  - `runId`
  - `agentId`
  - `toolName`
  - redacted `argsJson`
  - optional full execution payload if needed by resume task
  - `riskTier`
  - `status`: `pending`, `approved`, `rejected`, `expired`
  - `createdAtMs`, `decidedAtMs`, optional `expiresAtMs`
  - optional `decisionReason`
- Add repositories for create, get, list, approve, reject, expire.
- Add API routes under `/v1/approval-requests`.
- Enforce legal status transitions. Pending can become approved, rejected, or expired; terminal statuses must be idempotent and not flip-flop.
- Redact secret-looking argument keys using the audit-log redaction rules.
- Add query support by `sessionId`, `runId`, `status`, and `riskTier`.

## Dependency order

### Upstream — must be complete before this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.1` | [Spec](./agent-platform-hitl.1.md) |

### Downstream — waiting on this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.3` | [Spec](./agent-platform-hitl.3.md) |

## Implementation plan

1. Add contracts in `packages/contracts/src/approvalRequest.ts` and export them.
2. Add DB migration and schema/repository functions.
3. Add API router and register it in `v1Router`.
4. Reuse or extract the audit redaction helper so approval args display safely.
5. Add unit and integration tests for repository and API behavior.
6. Update API docs.

## Tests

- Contracts round-trip tests for approval request and decision schemas.
- DB tests for create/list/get/approve/reject/expire.
- API integration tests for listing pending approvals and submitting decisions.
- Invalid transition tests.
- Run `pnpm --filter @agent-platform/contracts run test`.
- Run `pnpm --filter @agent-platform/db run test`.
- Run `pnpm --filter @agent-platform/api run test`.
- Run `pnpm lint` and `pnpm typecheck`.

## Definition of done

- [ ] Approval request contract and API routes exist.
- [ ] Approval requests persist in SQLite.
- [ ] Args shown through API are redacted.
- [ ] Terminal decision transitions are idempotent and safe.
- [ ] API docs mention approval request endpoints.
- [ ] Beads dependencies match this spec.

## Sign-off

- [ ] Branch `task/agent-platform-hitl.2` created from `task/agent-platform-hitl.1`.
- [ ] Tests listed above pass.
- [ ] `bd close agent-platform-hitl.2 --reason "..."`
