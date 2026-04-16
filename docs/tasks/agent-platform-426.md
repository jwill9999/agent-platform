# Task: Agent execution error recovery

**Beads issue:** `agent-platform-426`  
**Spec file:** `docs/tasks/agent-platform-426.md` (this file)  
**Parent epic:** Reliability & Resilience

## Task requirements

Add structured error recovery to the agent execution pipeline so transient failures (LLM API errors, MCP timeouts, network blips) are retried with exponential backoff, while permanent failures (auth errors, invalid config) fail fast. Plugin hooks should fire on retries for observability.

### Current state

- **No retry logic** anywhere in the execution pipeline
- LLM call failures in `llmReason.ts` surface immediately as stream errors
- MCP tool failures in `toolDispatch.ts` return `{ ok: false }` error objects — no retry
- Global timeout via `invokeWithTimeout()` in chatRouter.ts using `Promise.race()`
- `onError` plugin hook fires but provides no retry mechanism
- Tool dispatch returns structured error codes: `TOOL_NOT_ALLOWED`, `MCP_SESSION_NOT_FOUND`, `MCP_CALL_FAILED`, `TOOL_NOT_FOUND`

### Target state

- **LLM calls** retry up to 3 times on transient errors (429, 500, 502, 503, ECONNRESET)
- **MCP tool calls** retry up to 2 times on transient errors
- **Exponential backoff** with jitter between retries
- **Permanent errors** (401, 403, 404, validation) fail immediately
- **Retry budget** tracked in `HarnessState` — total retries across all operations capped
- **Plugin hooks** — `onError` context includes `{ retryAttempt, willRetry, maxRetries }`
- **Trace events** — `llm_retry` and `tool_retry` event types added

## Dependency order

### Upstream — must be complete before this task

None — independent of other tasks (but logically benefits from `agent-platform-7tq` for transactional recovery).

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Create retry utility

**File:** `packages/harness/src/retry.ts` (new)

```typescript
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number; // e.g. 1000
  maxDelayMs: number; // e.g. 30000
  jitterFactor: number; // e.g. 0.25
  isRetryable: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void,
): Promise<T>;
```

- Exponential backoff: `delay = min(baseDelayMs * 2^attempt, maxDelayMs) * (1 ± jitter)`
- Respects `isRetryable` — non-retryable errors throw immediately
- Calls `onRetry` callback for observability before each retry wait

### Step 2: Add retryable error classification

**File:** `packages/harness/src/retry.ts`

```typescript
export function isRetryableLlmError(error: unknown): boolean {
  // 429 (rate limit), 500, 502, 503, ECONNRESET, ETIMEDOUT
}

export function isRetryableToolError(error: unknown): boolean {
  // MCP_CALL_FAILED (network), not TOOL_NOT_ALLOWED or TOOL_NOT_FOUND
}
```

### Step 3: Wrap LLM call in retry

**File:** `packages/harness/src/nodes/llmReason.ts`

Wrap the `streamText()` call (line ~248) in `withRetry()`:

- Max 3 attempts for LLM calls
- Base delay 1000ms
- On retry: emit `llm_retry` trace event + fire `onError` hook with retry context
- If final attempt fails: surface as stream error (existing behaviour)

### Step 4: Wrap tool dispatch in retry

**File:** `packages/harness/src/nodes/toolDispatch.ts`

Wrap `dispatchSingleTool()` (line ~116 loop) in `withRetry()`:

- Max 2 attempts for tool calls
- Base delay 500ms
- Only retry `MCP_CALL_FAILED` errors
- `TOOL_NOT_ALLOWED` and `TOOL_NOT_FOUND` never retried

### Step 5: Add retry budget to HarnessState

**File:** `packages/harness/src/graphState.ts`

Add `totalRetries: number` field (append reducer). Cap total retries per execution run (e.g. 10). When budget exhausted, stop retrying.

### Step 6: Extend trace event types

**File:** `packages/harness/src/trace.ts`

Add:

- `llm_retry` — `{ attempt, error, delayMs }`
- `tool_retry` — `{ toolId, attempt, error, delayMs }`

### Step 7: Extend onError hook context

**File:** `packages/plugin-sdk/src/contexts.ts`

Add to `ErrorContext`:

```typescript
retryAttempt?: number;
willRetry?: boolean;
maxRetries?: number;
```

### Step 8: Tests

- Unit: `withRetry()` — retries on retryable error, fails fast on permanent
- Unit: exponential backoff timing validation
- Unit: retry budget enforcement
- Unit: `isRetryableLlmError` classification
- Integration: LLM node retries on simulated 429, succeeds on retry
- Integration: tool dispatch retries on MCP failure, succeeds on retry

## Git workflow (mandatory)

| Rule                 | Detail                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Feature branch**   | `feature/reliability`                                                                      |
| **Task branch**      | `task/agent-platform-426` (branch from `task/agent-platform-7tq` or `feature/reliability`) |
| **Segment position** | Second task in segment                                                                     |

## Tests (required before sign-off)

- **Unit:** Retry utility, error classification, budget enforcement
- **Integration:** LLM retry simulation, tool retry simulation
- **Regression:** Existing tests pass (no behavioural change for non-error paths)

## Acceptance criteria

1. LLM calls retry up to 3 times on transient errors
2. Tool calls retry up to 2 times on MCP failures
3. Permanent errors fail immediately (no retry)
4. Retry budget limits total retries per execution
5. Trace events and plugin hooks fire on each retry
6. Exponential backoff with jitter between attempts
7. Existing tests pass

### Planning notes

**Shared file coordination:** This task wraps `dispatchSingleTool()` in `toolDispatch.ts` with retry logic. Two other tasks also modify this function:

- `agent-platform-4jh` — adds AbortSignal checking before dispatch
- `agent-platform-2wi` — adds per-tool timeout wrapping

**Recommended chain order:** 4jh (signal) → 2wi (timeout) → 426 (retry). The retry wrapper should be the outermost layer: `withRetry(() => withToolTimeout(() => dispatchSingleTool(...)))`. If implemented in a different order, each task must integrate with prior changes.

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass; retry tests added
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from correct parent
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-426 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
