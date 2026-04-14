# Task: Execution limits enforcement (timeout, tokens, cost)

**Beads issue:** `agent-platform-9yb`  
**Spec file:** `docs/tasks/agent-platform-qlp.2.md` (this file)  
**Parent epic:** `agent-platform-qlp` — Epic: Harness Hardening

## Task requirements

After this task, all `ExecutionLimits` fields are enforced at runtime, not just `maxSteps`:

### timeoutMs
- Wrap graph execution in a deadline timer in `runChat`.
- If the deadline fires before the graph completes:
  - Cancel the graph execution (abort the current LLM call if possible via AbortController).
  - Emit `{ type: 'error', code: 'TIMEOUT', message: 'Execution timeout exceeded' }` Output event.
  - Emit `{ type: 'limit_hit', kind: 'timeout' }` trace event.
  - Call `destroyAgentContext` for cleanup.
  - End the response stream.

### maxTokens
- Add `totalTokensUsed: number` to `HarnessState` (default 0).
- After each `llm_reason` call, read token usage from the Vercel AI SDK response (`result.usage.totalTokens` or `promptTokens + completionTokens`).
- Accumulate in state. If `totalTokensUsed >= limits.maxTokens`, set `halted = true`.
- Emit `{ type: 'limit_hit', kind: 'max_tokens' }` trace event.
- Emit error Output event to client.

### maxCostUnits (optional field)
- Add `totalCostUnits: number` to `HarnessState` (default 0).
- If the model provider returns cost information (some providers do via usage metadata), accumulate it.
- If `limits.maxCostUnits` is set and `totalCostUnits >= limits.maxCostUnits`, halt.
- If cost information is not available from the provider, skip enforcement (log a warning on first encounter).

### New trace event kinds
- Extend `TraceEvent` union: `{ type: 'limit_hit'; kind: 'timeout' | 'max_tokens' | 'max_cost' | 'max_steps' }`.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-k7m` | [Plugin dispatch integration](./agent-platform-qlp.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-dtc` | [Planner-graph integration](./agent-platform-qlp.3.md) |

## Implementation plan

1. Create **`task/agent-platform-9yb`** from **`task/agent-platform-k7m`**.
2. Update `packages/harness/src/trace.ts`: add `'timeout' | 'max_tokens' | 'max_cost'` to `limit_hit` kind.
3. Update `packages/harness/src/graphState.ts`: add `totalTokensUsed`, `totalCostUnits` annotations.
4. Update `llm_reason` node:
   - After model call, read `result.usage` and accumulate tokens.
   - Check against `limits.maxTokens`; if exceeded, set `halted = true`, emit trace.
5. Add timeout enforcement in `apps/api/src/application/chat/runChat.ts`:
   - Create `AbortController`.
   - Set `setTimeout` for `limits.timeoutMs`.
   - Pass `AbortSignal` into graph invocation and LLM calls (Vercel AI SDK supports abort signals).
   - On timeout: abort, emit error, cleanup, end stream.
6. Add cost tracking (best-effort): check Vercel AI SDK response for cost metadata, accumulate if present.
7. Unit tests:
   - Timeout: mock a slow LLM call → verify timeout halts execution and emits correct events.
   - Max tokens: mock LLM responses with known token counts → verify halt at limit.
   - Max steps: verify existing behavior still works with new trace event kind.
8. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-k7m`** |
| **This task's branch** | **`task/agent-platform-9yb`** |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** Timeout, token limit, and step limit enforcement with mocked model calls.

## Definition of done

- [ ] `timeoutMs` enforced via AbortController + deadline timer.
- [ ] `maxTokens` accumulated and enforced after each LLM call.
- [ ] `maxCostUnits` tracked when cost info available (graceful skip otherwise).
- [ ] New trace event kinds: `timeout`, `max_tokens`, `max_cost`.
- [ ] Error Output events streamed to client on limit violation.
- [ ] Unit tests pass for each limit type.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-k7m`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-9yb --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
