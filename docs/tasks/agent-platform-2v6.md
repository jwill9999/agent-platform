# Task: Agent-queryable observability tools

**Beads issue:** `agent-platform-2v6`
**Spec file:** `docs/tasks/agent-platform-2v6.md` (this file)
**Parent epic:** `agent-platform-d87` — [Tier 1 gap remediation](./agent-platform-d87.md)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-2v6.md`

## Source gaps

- `docs/planning/gap-analysis.md` codex review item #6 — `plugin-observability` collects logs/traces but the agent has no way to read them at runtime, so it cannot diagnose its own failures.

## Task requirements

After this task, the agent has three native built-in tools, registered like the other risk-tiered tools in `packages/harness/src/tools/`, that surface its own session telemetry:

- `query_logs(level?, since?, limit?)` → recent log records for the **current session** only.
- `query_recent_errors(limit?)` → last N error events (and DoD failures) for the **current session**.
- `inspect_trace(traceId?)` → full ordered span/event list for a trace; defaults to the current trace.

All three are **read-only**, **scope-jailed to the current session/trace** (no cross-session leakage), and exposed via `GET /v1/tools`.

### Concrete deliverables

- New module `packages/plugin-observability/src/store.ts`:
  - Public read API: `getLogs(filter)`, `getErrors(filter)`, `getTrace(filter)`.
  - Filter type enforces `sessionId` (always required by callers); store rejects queries without one.
- Tools registered in `packages/harness/src/tools/observabilityTools.ts`:
  - Risk tier: **zero-risk** (read-only, no side effects, no network/disk writes).
  - Tool schemas defined via existing `toolHelpers` pattern; parameters use Zod / JSON Schema per `packages/contracts/src/tool.ts`.
  - `sessionId` is **never** an LLM parameter — it's bound at registration time from `HarnessContext.sessionId`.
- Wired into the system tools registry so they show up in:
  - `GET /v1/tools` (via `apps/api/src/infrastructure/http/v1/toolsRouter.ts`).
  - The harness `toolDispatch` registry.
- Output truncation: each tool result capped (e.g. 16 KiB JSON / 50 records) to avoid context blowups; truncation flagged in the response payload.
- Audit: each invocation logged via existing `toolAuditLog`.
- Plugin-observability consumes the new `dod_check` events from `agent-platform-fc8` so `query_recent_errors` returns DoD failures.

### Out of scope

- Cross-session forensics for the human operator (separate UI/CLI work).
- Persisting observability data to disk (still in-memory per session).
- Pagination beyond simple `limit` + `since` cursoring.

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                          |
| -------------------- | --------------------------------------------- |
| `agent-platform-fc8` | [DoD contract phase](./agent-platform-fc8.md) |

### Downstream — waiting on this task

| Issue                | Spec                                                        |
| -------------------- | ----------------------------------------------------------- |
| `agent-platform-n6t` | [Docs-as-record CI + ADR + de-dup](./agent-platform-n6t.md) |

## Implementation plan

1. Create branch **`task/agent-platform-2v6`** from **`task/agent-platform-fc8`**.
2. Refactor `packages/plugin-observability/src/observability.ts` to expose a typed store accessor (`createObservabilityStore`) returning `{ getLogs, getErrors, getTrace }`. All accessors require `sessionId`.
3. Add `dod_check` event handling so DoD failures are first-class observability records.
4. Create `packages/harness/src/tools/observabilityTools.ts`:
   - `defineQueryLogsTool(store, ctx)`, `defineQueryRecentErrorsTool(store, ctx)`, `defineInspectTraceTool(store, ctx)` — each binds `sessionId` from the closure and returns a `ToolDefinition` per `packages/contracts/src/tool.ts`.
   - Apply truncation helper; include `{ truncated: boolean, total: number }` in result envelope.
5. Register the tools alongside other built-ins (extend `packages/harness/src/systemTools.ts` or the equivalent registry). Mark risk tier `zero` so they bypass HITL.
6. Verify `GET /v1/tools` lists the new tools (no router change should be required — the registry is the source of truth).
7. Wire tool invocation through existing `toolDispatch` so audit log + plugin hooks fire as usual.
8. Tests:
   - `packages/plugin-observability/test/store.test.ts` — getLogs/getErrors/getTrace; reject missing `sessionId`; truncation reporting.
   - `packages/harness/test/observabilityTools.test.ts` — tool definitions; session-scope enforcement; truncation envelope.
   - `apps/api/test/toolsRouter.integration.test.ts` (or equivalent) — verifies `GET /v1/tools` includes the three new tools.
   - `apps/api/test/chat.integration.test.ts` extended — assistant can call `query_recent_errors` after a forced tool failure and the response shape matches schema.
9. Update `docs/api-reference.md` (tool list), `docs/architecture.md` (observability section), and `docs/plugin-guide.md`.
10. Run quality gates; push branch; hand off to `agent-platform-n6t`.

## Git workflow (mandatory)

|                            |                               |
| -------------------------- | ----------------------------- |
| **Parent for this branch** | **`task/agent-platform-fc8`** |
| **This task's branch**     | **`task/agent-platform-2v6`** |
| **Segment tip?**           | **No**                        |

## Tests (required before sign-off)

- **Unit:** observability store query API, tool definitions, truncation.
- **Integration:** `GET /v1/tools` lists new tools; agent can invoke them through chat path; results scoped to current session.
- **Security:** assert tools refuse to return data for other sessions/traces (negative test).
- **Quality gates:** `pnpm typecheck && pnpm lint && pnpm test`.

## Definition of done

- [ ] Three tools (`query_logs`, `query_recent_errors`, `inspect_trace`) registered as zero-risk built-ins.
- [ ] `sessionId` bound at registration; agent cannot pass it; cross-session reads rejected.
- [ ] `GET /v1/tools` lists the new tools.
- [ ] Plugin-observability exposes a typed store API consumed by the tools.
- [ ] DoD failures appear in `query_recent_errors`.
- [ ] Result envelopes include `{ truncated, total }` and respect size cap.
- [ ] Audit log records each invocation.
- [ ] All tests above written and passing.
- [ ] Docs updated (api-reference + architecture + plugin-guide).
- [ ] Quality gates green.
- [ ] Branch pushed.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-fc8`**
- [ ] **Unit + integration + security tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-2v6 --reason "Agent-queryable observability tools registered and session-jailed"`

**Reviewer / owner:** ****\*\*****\_****\*\***** **Date:** **\*\***\_**\*\***
