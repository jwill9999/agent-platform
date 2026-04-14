# Task: Conversation history / message store

**Beads issue:** `agent-platform-xk3`  
**Spec file:** `docs/tasks/agent-platform-qlp.4.md` (this file)  
**Parent epic:** `agent-platform-qlp` — Epic: Harness Hardening

## Task requirements

After this task, multi-turn conversations are persisted and threaded correctly:

### Contract
- New `MessageSchema` in `packages/contracts/src/message.ts`:
  ```ts
  const MessageSchema = z.object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    toolCallId: z.string().optional(),    // for role=tool responses
    toolCalls: z.string().optional(),     // JSON-serialized tool calls for role=assistant
    createdAtMs: z.number().int().nonnegative(),
  });
  ```

### Database
- New `messages` table in `packages/db/src/schema.ts`:
  - `id` (text PK)
  - `session_id` (text FK → sessions, cascade delete)
  - `role` (text NOT NULL)
  - `content` (text NOT NULL)
  - `tool_call_id` (text, nullable)
  - `tool_calls_json` (text, nullable)
  - `created_at_ms` (integer NOT NULL)
- Generate Drizzle migration.

### Repository
- `appendMessage(db, message): void` — insert a single message.
- `listMessagesBySession(db, sessionId): Message[]` — ordered by `createdAtMs` ascending.
- `deleteMessagesBySession(db, sessionId): void` — for session reset/cleanup.

### Chat endpoint integration
- Update `runChat` in `apps/api/src/application/chat/runChat.ts`:
  1. Before graph invocation: load prior messages via `listMessagesBySession`.
  2. Append the new user message to DB.
  3. Pass full message history (system prompt + loaded messages + new user message) to the graph.
  4. After graph completion: append the assistant's response message(s) to DB, including any tool call/result messages generated during the ReAct loop.
- The graph already carries `messages` in state — the DB is the persistence layer behind it.

### Multi-turn verification
- A follow-up message in the same session should see all prior messages in the LLM context.
- The system prompt is NOT stored as a message row — it's constructed fresh from agent config each time (so changes to the agent's system prompt take effect immediately).

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-dtc` | [Planner-graph integration](./agent-platform-qlp.3.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| _(none — final task in Epic 3)_ | |

### Planning notes

- This is the **segment tip** for Epic 3 — open PR `task/agent-platform-xk3 → feature/agent-platform-runtime`.
- Message storage can grow large for long sessions. For MVP, no truncation or summarization — just load all messages. Context window management (trimming, summarizing old messages) is a future concern.
- Tool call messages during a ReAct loop: each assistant message with tool calls and each tool result message should be stored separately so the conversation can be replayed accurately.

## Implementation plan

1. Create **`task/agent-platform-xk3`** from **`task/agent-platform-dtc`**.
2. Create `packages/contracts/src/message.ts`:
   - Define `MessageSchema` and `Message` type.
   - Export from `packages/contracts/src/index.ts`.
3. Update `packages/db/src/schema.ts`:
   - Add `messages` table.
4. Generate Drizzle migration.
5. Add mapper functions in `packages/db/src/mappers.ts` (or new file `messageMappers.ts`):
   - `messageToRow` / `messageRowToContract`.
6. Add repository functions in `packages/db/src/repositories/registry.ts` (or new `messages.ts`):
   - `appendMessage`, `listMessagesBySession`, `deleteMessagesBySession`.
7. Update `runChat`:
   - Load history: `listMessagesBySession(db, sessionId)`.
   - Append user message before graph invocation.
   - After graph completes: iterate graph state's `messages` (excluding system prompt and pre-loaded history), append new messages to DB.
8. Unit tests:
   - Message CRUD: insert → list → verify order → delete → verify empty.
   - Contract schema: parse valid/invalid messages.
9. Integration tests:
   - Multi-turn: POST /v1/chat (message 1) → verify response → POST /v1/chat (message 2) → verify second response references first turn context.
   - Verify messages persisted: GET /v1/sessions/:id should... (or add a GET /v1/sessions/:id/messages endpoint).
10. Run quality gates, push branch.
11. **Segment tip:** Open PR **`task/agent-platform-xk3` → `feature/agent-platform-runtime`**.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-dtc`** |
| **This task's branch** | **`task/agent-platform-xk3`** |
| **Segment tip** | **`task/agent-platform-xk3`** ← **this task** |
| **This task is segment tip?** | **Yes — open PR to `feature/agent-platform-runtime`** |

## Tests (required before sign-off)

- **Unit (minimum):** Message CRUD, schema validation.
- **Integration:** Multi-turn conversation persistence and retrieval.

## Definition of done

- [ ] `MessageSchema` defined in contracts.
- [ ] `messages` table in DB with migration.
- [ ] `appendMessage`, `listMessagesBySession`, `deleteMessagesBySession` repository functions.
- [ ] `runChat` loads history before execution, persists new messages after.
- [ ] Multi-turn: second message in same session sees first message's context.
- [ ] System prompt NOT stored as message (constructed fresh).
- [ ] Unit and integration tests pass.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] **PR** opened: **`task/agent-platform-xk3` → `feature/agent-platform-runtime`**.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-dtc`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR merged:** `task/agent-platform-xk3` → `feature/agent-platform-runtime` (link: _________________)
- [ ] `bd close agent-platform-xk3 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
