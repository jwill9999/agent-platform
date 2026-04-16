# Task: Concurrent session safety

**Beads issue:** `agent-platform-d8u`  
**Spec file:** `docs/tasks/agent-platform-d8u.md` (this file)  
**Parent epic:** Reliability & Resilience

## Task requirements

Prevent concurrent chat requests on the same session from corrupting message history or producing interleaved/duplicated responses. Implement an in-process session lock so only one execution runs per session at a time.

### Current state

- **No mutex or locking** on session-level operations
- SQLite serialises writes at DB level (single-writer model), but:
  - Two concurrent chat requests on the same sessionId can interleave message reads/writes
  - `buildConversationMessages()` reads history then appends — race window between read and write
  - `persistNewMessages()` loops over new messages — could persist duplicates if two requests overlap
- Session CRUD routes have no concurrency guard
- `HarnessState.messages` is per-invocation — but DB state is shared

### Target state

- **In-process session lock**: Only one `POST /v1/chat` executes per sessionId at a time
- **Queuing**: Second request on same session waits (with configurable timeout) or returns 409 Conflict
- **Lock implementation**: `Map<sessionId, Promise>` in the chat router (not distributed — single-process MVP)
- **Lock timeout**: Configurable; default matches global execution timeout
- **Clean release**: Lock released in `finally` block — no leak on errors
- **Future-proofing**: Interface designed for easy swap to Redis/distributed lock later

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| `agent-platform-7tq` | [DB transaction support](./agent-platform-7tq.md) — **related** (not blocking) |

The session lock is in-memory (Map-based) and does not require DB transactions. However, having transactions in place means the operations _inside_ the lock can be safely atomic. This is a soft/related dependency, not a hard blocker.

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Create session lock utility

**File:** `apps/api/src/infrastructure/sessionLock.ts` (new)

```typescript
export interface SessionLock {
  acquire(sessionId: string, timeoutMs?: number): Promise<() => void>;
}

export function createInProcessSessionLock(): SessionLock {
  const locks = new Map<string, Promise<void>>();

  return {
    async acquire(sessionId: string, timeoutMs = 120000): Promise<() => void> {
      // Chain: wait for existing lock, then create new one
      const existing = locks.get(sessionId) ?? Promise.resolve();
      let release: () => void;
      const newLock = new Promise<void>((resolve) => {
        release = resolve;
      });
      locks.set(sessionId, newLock);

      // Wait with timeout
      await Promise.race([
        existing,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new HttpError(409, 'SESSION_BUSY', 'Session is busy')),
            timeoutMs,
          ),
        ),
      ]);

      return () => {
        release!();
        if (locks.get(sessionId) === newLock) locks.delete(sessionId);
      };
    },
  };
}
```

### Step 2: Integrate lock into chat router

**File:** `apps/api/src/infrastructure/http/v1/chatRouter.ts`

```typescript
const sessionLock = createInProcessSessionLock();

// In POST /v1/chat handler:
const release = await sessionLock.acquire(sessionId, agentCtx.agent.executionLimits.timeoutMs);
try {
  // ... existing execution flow
} finally {
  release();
}
```

### Step 3: Add 409 Conflict response to OpenAPI spec

**File:** `apps/api/openapi.yaml`

Add `409` response to POST /v1/chat:

```yaml
409:
  description: Session is currently processing another request
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/ErrorResponse'
```

### Step 4: Add lock metrics (optional)

Track:

- Active locks count
- Lock wait times
- Lock timeout occurrences (409 responses)

These feed into the observability layer (`agent-platform-hkn`).

### Step 5: Document distributed lock interface

Add comment/type for future distributed lock:

```typescript
// Future: swap createInProcessSessionLock() with createRedisSessionLock() for multi-process
```

### Step 6: Tests

- Unit: Lock serialises concurrent acquires
- Unit: Lock releases on error (finally block)
- Unit: Lock timeout returns 409
- Unit: Different sessionIds run concurrently (no false blocking)
- Integration: Two concurrent chat requests on same session — second waits, both complete
- Integration: Lock released after execution error

## Git workflow (mandatory)

| Rule                 | Detail                                                           |
| -------------------- | ---------------------------------------------------------------- |
| **Feature branch**   | `feature/reliability`                                            |
| **Task branch**      | `task/agent-platform-d8u` (branch from previous task in segment) |
| **Segment position** | TBD based on epic ordering                                       |

## Tests (required before sign-off)

- **Unit:** Session lock acquire/release/timeout
- **Integration:** Concurrent request serialisation
- **Regression:** Existing chat tests pass (single request path unchanged)

## Acceptance criteria

1. Only one chat execution per sessionId at a time
2. Second concurrent request waits or returns 409
3. Lock always released (even on errors)
4. Different sessions run concurrently (no global lock)
5. Lock timeout configurable
6. Interface supports future distributed lock swap
7. Existing tests pass

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
- [ ] `bd close agent-platform-d8u --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
