# Task: Add DB transaction support with atomic rollback

**Beads issue:** `agent-platform-7tq`  
**Spec file:** `docs/tasks/agent-platform-7tq.md` (this file)  
**Parent epic:** Reliability & Resilience

## Task requirements

Wrap all multi-step database mutations in transactions so that partial failures roll back cleanly. The Drizzle ORM `db.transaction()` API is already used in two places (`replaceAgent`, `updateSettings`); this task extends coverage to all remaining multi-step operations.

### Current state

| Function                      | File                                                | Multi-step?              | Transacted? |
| ----------------------------- | --------------------------------------------------- | ------------------------ | ----------- |
| `replaceAgent()`              | `packages/db/src/repositories/registry.ts`          | ✅ 7+ ops                | ✅ Yes      |
| `updateSettings()`            | `packages/db/src/repositories/settings.ts`          | ✅ Loop                  | ✅ Yes      |
| `persistNewMessages()`        | `apps/api/src/infrastructure/http/v1/chatRouter.ts` | ✅ Loop of appendMessage | ❌ No       |
| `buildConversationMessages()` | `apps/api/src/infrastructure/http/v1/chatRouter.ts` | ✅ Read + write          | ❌ No       |
| `replaceSession()`            | `packages/db/src/repositories/registry.ts`          | ⚠️ Read-then-upsert      | ❌ No       |
| `runSeed()`                   | `packages/db/src/seed/runSeed.ts`                   | ✅ 3 inserts             | ❌ No       |

### Gaps to fix

1. **`persistNewMessages()`** — loops over `appendMessage()` calls. If it fails on message 5/10, messages 1–4 are orphaned. Wrap in transaction.
2. **`buildConversationMessages()`** — reads history then appends user message. Should be atomic to prevent interleave with concurrent requests.
3. **`replaceSession()`** — read-then-upsert pattern; potential race condition under concurrent access.
4. **`runSeed()`** — 3 independent inserts (skill, agent, agent-skill link). Should be atomic.
5. **`withTransaction()` utility** — create a reusable helper in `packages/db` for wrapping arbitrary operations.

## Dependency order

### Upstream — must be complete before this task

None — this is a foundational task.

### Downstream — waiting on this task

| Issue                | Spec                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `agent-platform-5pa` | [System-generated UUIDs with auto-slug](./agent-platform-5pa.md) |

## Implementation plan

### Step 1: Create `withTransaction()` utility in packages/db

**File:** `packages/db/src/transaction.ts` (new)

```typescript
export function withTransaction<T>(db: DrizzleDb, fn: (tx: DrizzleDb) => T): T {
  return db.transaction(fn);
}
```

Simple wrapper — adds a consistent entry point and allows future instrumentation (logging, metrics on rollbacks). Export from `packages/db/src/index.ts`.

### Step 2: Wrap `persistNewMessages()` in a transaction

**File:** `apps/api/src/infrastructure/http/v1/chatRouter.ts`

Move the `appendMessage()` loop inside `db.transaction()` so all messages are persisted atomically or none are.

### Step 3: Wrap `buildConversationMessages()` in a transaction

**File:** `apps/api/src/infrastructure/http/v1/chatRouter.ts`

The read (`listMessagesBySession`) + write (`appendMessage`) should be atomic. Wrap in transaction.

### Step 4: Wrap `replaceSession()` in a transaction

**File:** `packages/db/src/repositories/registry.ts`

The select-then-upsert pattern should be inside a transaction to prevent race conditions.

### Step 5: Wrap `runSeed()` in a transaction

**File:** `packages/db/src/seed/runSeed.ts`

Wrap all 3 inserts (skill, agent, agent-skill link) in a single transaction.

### Step 6: Add tests for rollback behaviour

**File:** `packages/db/test/transaction.test.ts` (new)

- Test: transaction commits when all operations succeed
- Test: transaction rolls back when any operation throws
- Test: partial inserts don't persist after rollback
- Test: `persistNewMessages` is atomic (simulate failure mid-loop)

### Step 7: Audit remaining write paths

Do a final grep for any `db.insert`, `db.update`, `db.delete` outside transactions that should be wrapped. Document findings.

## Git workflow (mandatory)

| Rule                 | Detail                                                        |
| -------------------- | ------------------------------------------------------------- |
| **Feature branch**   | `feature/reliability`                                         |
| **Task branch**      | `task/agent-platform-7tq` (branch from `feature/reliability`) |
| **Segment position** | First task in segment                                         |

## Tests (required before sign-off)

- **Unit:** Transaction commit/rollback tests in `packages/db/test/transaction.test.ts`
- **Integration:** Existing API tests (34 tests) continue to pass
- **Regression:** Chat message persistence test in `test/sessionChat.integration.test.ts` still works

## Acceptance criteria

1. All multi-step DB mutations are wrapped in transactions
2. A failure mid-operation rolls back all changes (no partial writes)
3. `withTransaction()` utility is exported from packages/db
4. Existing tests continue to pass (no behavioral changes for success paths)
5. New tests verify rollback on failure

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass; rollback tests added
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed during implementation

## Sign-off

- [ ] **Task branch** created from `feature/reliability`
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-7tq --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
