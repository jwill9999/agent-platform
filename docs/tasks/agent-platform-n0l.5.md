# Task: Session-aware chat endpoint

**Beads issue:** `agent-platform-5pe`  
**Spec file:** `docs/tasks/agent-platform-n0l.5.md` (this file)  
**Parent epic:** `agent-platform-n0l` — Epic: Agent Runtime Loop

## Task requirements

After this task, the API has an agent-aware chat endpoint that replaces the raw OpenAI pass-through:

- New endpoint: `POST /v1/chat` (or replace existing `/v1/chat/stream`):
  - Request body: `{ sessionId: string; message: string }`.
  - Flow:
    1. Load session from DB → get `agentId`.
    2. Build `AgentContext` via `buildAgentContext(db, agentId)`.
    3. Build conversation messages: system prompt from context + any prior messages (placeholder for task qlp.4) + new user message.
    4. Create `NdjsonOutputEmitter` on the response.
    5. Invoke harness graph in `react` mode with messages, tool definitions, model config, and emitter.
    6. Stream `Output` events to client as NDJSON.
    7. On completion, call `destroyAgentContext` to clean up MCP sessions.
  - Response: streaming NDJSON (`Content-Type: application/x-ndjson`).
  - Error handling: if session not found → 404. If agent not found → 404. If factory fails → 500 with error Output. If graph fails mid-execution → error Output event streamed, then stream closed.
- Deprecate or remove the old `POST /v1/chat/stream` endpoint (the raw OpenAI pass-through).
- The old endpoint's functionality (direct model streaming without agent context) can optionally remain as a separate route if needed, but should not be the primary chat path.
- Move chat logic into `apps/api/src/application/chat/` as a use-case function (`runChat`) to follow the clean architecture pattern — the route handler stays thin.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-16f` | [Structured streaming output](./agent-platform-n0l.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-k7m` | [Plugin dispatch integration](./agent-platform-qlp.1.md) |

### Planning notes

- This is likely the **segment tip** for Epic 2's main chain. Model override (n0l.6) may land in parallel.
- The `runChat` use-case function should accept a `db`, `sessionId`, `message`, and `response` (for streaming). This keeps the Express route handler thin.
- Consider request abort handling: if the client disconnects, the graph should stop (check `req.aborted`).

## Implementation plan

1. Create **`task/agent-platform-5pe`** from **`task/agent-platform-16f`**.
2. Define request schema in contracts or locally:
   ```ts
   const ChatRequestSchema = z.object({ sessionId: z.string().min(1), message: z.string().min(1) });
   ```
3. Create `apps/api/src/application/chat/runChat.ts`:
   - Accept `{ db, sessionId, message, res }`.
   - Load session → load agent via factory → build messages → create emitter → invoke graph → cleanup.
   - Wrap in try/catch: on error, emit error Output event if stream is still open, then end.
4. Create route in `v1Router` (or new chat router):
   - `POST /v1/chat` — parse body, call `runChat`, let it stream.
   - Set response headers before invoking (Content-Type, Cache-Control, Connection).
5. Handle client abort: listen for `req.on('close')` to signal graph cancellation.
6. Remove or deprecate `POST /v1/chat/stream`.
7. Update `apps/web/app/api/chat/route.ts` (Next.js BFF) to call the new endpoint format.
8. Integration tests in `apps/api/test/chat.integration.test.ts`:
   - Seed agent + session → POST /v1/chat → verify NDJSON stream with at least one text event.
   - Verify 404 on invalid session.
   - Verify 404 on session with nonexistent agent.
9. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-16f`** |
| **This task's branch** | **`task/agent-platform-5pe`** |
| **Segment tip** | **TBD — this or `agent-platform-icb` depending on merge order** |
| **This task is segment tip?** | **Likely yes — confirm at implementation time** |

## Tests (required before sign-off)

- **Unit (minimum):** `runChat` use case with mocked DB, factory, and graph.
- **Integration:** HTTP test: seed data → POST /v1/chat → verify NDJSON response stream.
- **E2E (optional):** If compose stack is available, verify web → API → model round trip.

## Definition of done

- [ ] `POST /v1/chat` endpoint accepts `{ sessionId, message }` and streams NDJSON Output events.
- [ ] Chat logic lives in `apps/api/src/application/chat/runChat.ts` (clean architecture).
- [ ] Agent context built and destroyed per request.
- [ ] Old `POST /v1/chat/stream` deprecated or removed.
- [ ] Client abort handled gracefully.
- [ ] Integration test: seed → chat → verify stream.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-16f`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** Open if segment tip (link: _________________)
- [ ] `bd close agent-platform-5pe --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
