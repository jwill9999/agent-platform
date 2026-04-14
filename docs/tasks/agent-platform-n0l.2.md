# Task: Tool dispatch node in harness graph

**Beads issue:** `agent-platform-6d5`  
**Spec file:** `docs/tasks/agent-platform-n0l.2.md` (this file)  
**Parent epic:** `agent-platform-n0l` — Epic: Agent Runtime Loop

## Task requirements

After this task, the harness graph can execute tool calls produced by the LLM reasoning node:

- New `tool_dispatch` graph node in `packages/harness`:
  - Reads `llmOutput` from state (expects `kind: 'tool_calls'`).
  - For each tool call in `llmOutput.calls`:
    1. Parse the tool ID via `parseToolId` from `agent-validation`.
    2. Validate against agent allowlists via `isToolExecutionAllowed`.
    3. If **MCP tool** (`kind: 'mcp'`): look up the MCP session from `AgentContext.mcpSessions`, call `session.callToolAsOutput(mcpToolName, args)`.
    4. If **registry/native tool** (`kind: 'plain'`): call through a `NativeToolExecutor` interface (pluggable — for MVP, a Map of tool ID → handler function, initially empty; native tools can be added later).
    5. If tool not allowed or not found: return `Output` error without crashing the graph.
  - Appends tool result messages to `messages` in state (format: `{ role: 'tool', toolCallId, content: JSON.stringify(result) }`).
  - Emits trace events: `{ type: 'tool_dispatch'; toolId; step; ok }` per tool call.
- `NativeToolExecutor` interface: `(toolId: string, args: Record<string, unknown>) => Promise<Output>`. Stored in AgentContext or passed as graph option. Allows non-MCP tools to be registered.
- Error handling: individual tool failures do not halt the graph — the error `Output` is fed back to the LLM so it can reason about the failure.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-9v1` | [LLM reasoning node](./agent-platform-n0l.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-40r` | [ReAct loop wiring](./agent-platform-n0l.3.md) |

## Implementation plan

1. Create **`task/agent-platform-6d5`** from **`task/agent-platform-9v1`**.
2. Define `NativeToolExecutor` type in `packages/harness/src/types.ts`.
3. Create `packages/harness/src/nodes/toolDispatch.ts`:
   - Function receives `HarnessStateType` and `AgentContext` (or relevant subset).
   - Iterate `llmOutput.calls`, dispatch each, collect `Output` results.
   - Build tool result messages, append to `messages`.
   - Clear `llmOutput` (set to null) so the next LLM call sees the tool results in messages.
4. Handle multiple tool calls: process sequentially for MVP (parallel tool execution is a future enhancement per `maxParallelTasks`).
5. Add trace events for each dispatch.
6. Unit tests in `packages/harness/test/toolDispatch.test.ts`:
   - Mock MCP session: verify tool call routed correctly, result appended to messages.
   - Verify disallowed tool produces error Output, not crash.
   - Verify unknown tool produces error Output.
   - Verify trace events emitted.
7. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-9v1`** |
| **This task's branch** | **`task/agent-platform-6d5`** |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** Tool dispatch with mocked MCP sessions and allowlists.

## Definition of done

- [ ] `tool_dispatch` node processes LLM tool-call intents.
- [ ] MCP tools routed through session's `callToolAsOutput`.
- [ ] `NativeToolExecutor` interface defined for non-MCP tools.
- [ ] Disallowed/missing tools produce error Output (no crash).
- [ ] Tool results appended to conversation messages.
- [ ] Trace events emitted per dispatch.
- [ ] Unit tests pass.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-9v1`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-6d5 --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
