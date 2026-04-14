# Task: Structured streaming output

**Beads issue:** `agent-platform-16f`  
**Spec file:** `docs/tasks/agent-platform-n0l.4.md` (this file)  
**Parent epic:** `agent-platform-n0l` — Epic: Agent Runtime Loop

## Task requirements

After this task, the harness graph emits typed, streaming events to the client during execution rather than buffering to completion:

- New `OutputEmitter` interface in `packages/harness`:
  ```ts
  type OutputEmitter = {
    emit(event: Output): void;   // non-blocking; writes to stream
    end(): void;                 // signals stream completion
  };
  ```
- `Output` events use the existing `OutputSchema` from `packages/contracts/src/output.ts` (text, code, tool_result, thinking, error).
- Wire `OutputEmitter` into graph nodes:
  - **`llm_reason`**: as text streams from the model (`streamText` instead of `generateText`), emit `{ type: 'text', content: chunk }` for each chunk. If the model provides thinking/reasoning tokens, emit `{ type: 'thinking', content }`.
  - **`tool_dispatch`**: after each tool execution, emit `{ type: 'tool_result', toolId, data }` or `{ type: 'error', message, code }`.
  - **Graph lifecycle**: emit `{ type: 'error', ... }` on unhandled failures.
- HTTP transport: `NdjsonOutputEmitter` — writes each `Output` event as a JSON line (`\n`-delimited) to an Express `Response` object. Content-Type: `application/x-ndjson`.
- The emitter is passed into the graph as a build option or injected via state.
- Switch the LLM node from `generateText` to `streamText` for real-time streaming. Accumulate the full response for message history while simultaneously streaming chunks.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-40r` | [ReAct loop wiring](./agent-platform-n0l.3.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-5pe` | [Session-aware chat endpoint](./agent-platform-n0l.5.md) |

## Implementation plan

1. Create **`task/agent-platform-16f`** from **`task/agent-platform-40r`**.
2. Define `OutputEmitter` type in `packages/harness/src/types.ts`.
3. Create `packages/harness/src/emitters/ndjson.ts`:
   - `createNdjsonEmitter(res: ServerResponse): OutputEmitter` — writes `JSON.stringify(event) + '\n'` on `emit`, calls `res.end()` on `end()`.
4. Update `llm_reason` node:
   - Switch from `generateText` to `streamText` from Vercel AI SDK.
   - Iterate `result.textStream`, emit text chunks via emitter.
   - Accumulate full text for the assistant message in state.
   - If `result.toolCalls` present after stream completes, produce `LlmOutput` with tool calls (do not emit text chunks for tool-call-only responses — the tool results will be emitted by dispatch).
5. Update `tool_dispatch` node:
   - After each tool execution, emit the `Output` (tool_result or error) via emitter.
6. Pass `OutputEmitter` into `buildHarnessGraph` via options or as a state field.
7. Unit tests:
   - Mock emitter: verify text chunks emitted during LLM streaming.
   - Verify tool_result emitted after dispatch.
   - Verify error emitted on failure.
   - Test `NdjsonOutputEmitter` produces valid NDJSON format.
8. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-40r`** |
| **This task's branch** | **`task/agent-platform-16f`** |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** Emitter interface, NDJSON format, integration with graph nodes.

## Definition of done

- [ ] `OutputEmitter` interface defined and implemented as `NdjsonOutputEmitter`.
- [ ] LLM node streams text chunks in real-time via emitter.
- [ ] Tool dispatch emits tool_result/error via emitter.
- [ ] NDJSON format: one JSON object per line, parseable by client.
- [ ] Full response accumulated in state for message history.
- [ ] Unit tests pass.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-40r`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-16f --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
