# Task: Streaming backpressure handling

**Beads issue:** `agent-platform-4jh`  
**Spec file:** `docs/tasks/agent-platform-4jh.md` (this file)  
**Parent epic:** Reliability & Resilience

## Task requirements

Add backpressure handling to the NDJSON streaming response so slow clients don't cause unbounded memory growth on the server. Detect client disconnection and abort the execution pipeline gracefully using AbortSignal.

### Current state

- NDJSON streaming via `res.write(JSON.stringify(event) + '\n')` in `emitters/ndjson.ts`
- **No backpressure check** — `res.write()` return value (boolean indicating buffer full) is ignored
- **Partial disconnect detection** — checks `req.aborted` and `res.writableEnded` in the chat loop
- **No `req.on('close')` handler** — relies on flag polling, not event-driven
- **No AbortSignal** passed to `graph.invoke()` — timeout uses `Promise.race()` externally
- Headers set: `Content-Type: application/x-ndjson`, `Cache-Control: no-cache`, `Connection: keep-alive`

### Target state

- **Backpressure awareness**: Check `res.write()` return value; if `false`, wait for `drain` event before next write
- **Client disconnect**: Register `req.on('close')` handler that triggers an `AbortController`
- **AbortSignal propagation**: Pass `AbortSignal` through graph execution to:
  - Cancel pending LLM `streamText()` call
  - Cancel pending MCP tool call
  - Short-circuit the ReAct loop
- **Graceful cleanup**: On abort, persist any messages written so far, emit `stream_aborted` trace event, call `destroyAgentContext()`
- **Buffer size limit**: Optional high-water mark on the write buffer (configurable, default 64KB)

## Dependency order

### Upstream — must be complete before this task

None — independent, but benefits from `agent-platform-7tq` (transactions for partial message persistence on abort).

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Widen OutputEmitter interface to support async emit

**File:** `packages/harness/src/types.ts`

**⚠️ Breaking type change** — the current `OutputEmitter.emit()` returns `void` (sync). Backpressure requires waiting for `drain`, which is async. Update the interface:

```typescript
export interface OutputEmitter {
  emit(event: Output): void | Promise<void>; // widen return type
  end(): void;
}
```

This is backward-compatible: existing sync implementations still satisfy the widened type. All **callers** must now `await` the result. Audit every call site:

- `packages/harness/src/nodes/llmReason.ts` — `streamAndAccumulate()` loop
- `packages/harness/src/nodes/toolDispatch.ts` — tool result emission
- `packages/harness/src/buildGraph.ts` — trace event emissions

### Step 2: Create backpressure-aware NDJSON emitter

**File:** `packages/harness/src/emitters/ndjson.ts`

```typescript
import { once } from 'node:events';

export function createNdjsonEmitter(stream: Writable): OutputEmitter {
  return {
    async emit(event: Output): Promise<void> {
      if (!stream.writable) return;
      const data = JSON.stringify(event) + '\n';
      const canWrite = stream.write(data);
      if (!canWrite && stream.writable) {
        await once(stream, 'drain');
      }
    },
    end(): void {
      if (!stream.writable) return;
      stream.end();
    },
  };
}
```

The `createNoopEmitter()` remains sync (satisfies the widened type).

### Step 3: Add AbortController to chat flow

**File:** `apps/api/src/infrastructure/http/v1/chatRouter.ts`

```typescript
const controller = new AbortController();
const { signal } = controller;

// Abort on client disconnect
req.on('close', () => {
  if (!res.writableFinished) controller.abort();
});

// Abort on timeout (replace invokeWithTimeout with signal-based approach)
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
try {
  const result = await graph.invoke(initialState, {
    configurable: { thread_id: sessionId, signal },
  });
} finally {
  clearTimeout(timeoutId);
}
```

### Step 4: Pass AbortSignal via `configurable` — NOT graph state

**⚠️ Design decision:** `AbortSignal` is **non-serializable** and must NOT be added to `HarnessState`. LangGraph's `Annotation` system may checkpoint/serialize state between nodes. Instead, pass it through the `configurable` parameter, which is designed for runtime context that doesn't participate in state management.

**File:** `packages/harness/src/nodes/llmReason.ts`

Access signal from LangGraph's `RunnableConfig`:

```typescript
export function createLlmReasonNode(ctx: LlmReasonContext) {
  return async (state: HarnessStateType, config?: RunnableConfig) => {
    const signal = config?.configurable?.signal as AbortSignal | undefined;
    // Check abort before LLM call
    if (signal?.aborted) return { halted: true };
    // Pass to Vercel AI SDK
    const result = streamText({ model, messages, tools, maxSteps: 1, abortSignal: signal });
    // ...
  };
}
```

**File:** `packages/harness/src/nodes/toolDispatch.ts`

Same pattern — access signal from config, check before each tool dispatch:

```typescript
const signal = config?.configurable?.signal as AbortSignal | undefined;
for (const call of llmOutput.calls) {
  if (signal?.aborted) break;
  // ... dispatch tool
}
```

### Step 5: Graceful abort cleanup

**File:** `apps/api/src/infrastructure/http/v1/chatRouter.ts`

On abort:

1. Persist messages written so far (in transaction if `agent-platform-7tq` is complete)
2. Emit `stream_aborted` trace event
3. Call `destroyAgentContext()`
4. End response stream

### Step 6: Add `stream_aborted` trace event

**File:** `packages/harness/src/trace.ts`

Add `stream_aborted` event type with `{ reason: 'client_disconnect' | 'timeout' }`.

### Step 7: Tests

- Unit: Backpressure emitter waits for drain when `write()` returns false
- Unit: Backpressure emitter skips write when stream not writable
- Unit: AbortSignal in configurable cancels LLM call
- Unit: AbortSignal skips remaining tool calls
- Integration: Client disconnect aborts execution, messages persisted to abort point
- Integration: Timeout triggers abort and cleanup
- Regression: Normal streaming (fast client) unaffected — no unnecessary drain waits

## Git workflow (mandatory)

| Rule                 | Detail                                                           |
| -------------------- | ---------------------------------------------------------------- |
| **Feature branch**   | `feature/reliability`                                            |
| **Task branch**      | `task/agent-platform-4jh` (branch from previous task in segment) |
| **Segment position** | TBD based on epic ordering                                       |

## Tests (required before sign-off)

- **Unit:** Backpressure emitter, abort propagation
- **Integration:** Client disconnect test, timeout abort test
- **Regression:** Normal streaming still works

## Acceptance criteria

1. `res.write()` return value checked; drain waited on when buffer full
2. Client disconnect triggers AbortSignal via `req.on('close')`
3. AbortSignal propagated to LLM and tool calls via `configurable` (not graph state)
4. Messages persisted up to abort point
5. `OutputEmitter.emit()` widened to `void | Promise<void>` — all callers updated to await
6. Buffered write size stays bounded under slow-client conditions (verified via test with paused readable stream)
7. Existing streaming tests pass

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from correct parent
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-4jh --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
