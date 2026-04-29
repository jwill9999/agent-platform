# Task: Add deny-by-default approval gate for risky tools

**Beads issue:** `agent-platform-hitl.1`
**Spec file:** `docs/tasks/agent-platform-hitl.1.md` (this file)
**Parent epic:** `agent-platform-hitl` — Human-in-the-loop approval workflow

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-hitl.1.md`

## Task requirements

Add an immediate host-side guard so tools marked `requiresApproval`, `high` risk, or `critical` risk cannot execute silently before full HITL resume support exists.

The current metadata already says `sys_bash` requires approval, but `toolDispatch` still executes it if the tool is allowed and the command passes the bash guard. This task closes that safety gap without waiting for the full approval UX.

## Detailed requirements

- Introduce a shared approval policy helper in the harness, for example `requiresHumanApproval(tool)`.
- Apply the policy before `executeToolWithRetry` in `packages/harness/src/nodes/toolDispatch.ts`.
- Resolve metadata for system tools, DB tools, and MCP-discovered tools. If MCP tools lack explicit metadata, treat them conservatively according to the established MCP risk model.
- For phase 1, return a structured tool error or halted state instead of executing the tool.
- Log denied/pending decisions to the tool audit log for non-zero-risk tools.
- Emit a trace event that distinguishes approval gating from PathJail, bash guard, rate limit, and execution failures.
- Keep zero-risk, low-risk, and medium-risk tools auto-executable unless `requiresApproval` is explicitly true.
- Treat `critical` as never auto-executable.

## Dependency order

### Upstream — must be complete before this task

None.

### Downstream — waiting on this task

| Issue                   | Spec                               |
| ----------------------- | ---------------------------------- |
| `agent-platform-hitl.2` | [Spec](./agent-platform-hitl.2.md) |

### Planning notes

This task intentionally does not create approval request records. It creates the safety boundary that later tasks replace with a durable pending-approval flow.

## Implementation plan

1. Read current tool metadata in `packages/contracts/src/tool.ts`, `packages/harness/src/systemTools.ts`, and DB tool mappers.
2. Add a harness approval policy helper and focused unit tests.
3. Wire the helper into `createToolDispatchNode` before any tool execution or plugin `onToolCall` emission.
4. Add audit and trace coverage for approval-gated calls.
5. Update tests that currently assume high-risk tools execute automatically.

## Tests

- Harness unit test: `sys_bash` does not execute without approval.
- Harness unit test: explicit `requiresApproval: true` gates an otherwise lower-risk tool.
- Harness unit test: zero-risk and ordinary low/medium tools still execute.
- Audit test: gated non-zero-risk tool records a denied or pending entry with redacted args.
- Run `pnpm --filter @agent-platform/harness run test`.
- Run `pnpm lint` and `pnpm typecheck`.

## Definition of done

- [x] Approval-required/high/critical tools are blocked before execution.
- [x] Existing security failures keep their existing error semantics.
- [x] Audit and trace output identify approval gating.
- [x] Tests cover policy helper and dispatch behavior.
- [x] Beads dependencies match this spec.

## Sign-off

- [x] Branch `task/agent-platform-hitl.1` created from `feature/agent-platform-hitl`.
- [x] Tests listed above pass.
- [x] `bd close agent-platform-hitl.1 --reason "..."`
