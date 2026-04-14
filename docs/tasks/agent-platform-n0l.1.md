# Task: LLM reasoning node in harness graph

**Beads issue:** `agent-platform-9v1`  
**Spec file:** `docs/tasks/agent-platform-n0l.1.md` (this file)  
**Parent epic:** `agent-platform-n0l` — Epic: Agent Runtime Loop

## Task requirements

After this task, the harness graph contains a node that invokes the LLM and produces structured output (text response or tool-call intents):

- New `HarnessState` fields:
  - `messages: ChatMessage[]` — conversation history (system + user + assistant + tool messages).
  - `toolDefinitions: ToolDefinition[]` — available tools in OpenAI function-calling format (name, description, parameters JSON schema).
  - `llmOutput: LlmOutput | null` — result of the most recent LLM call.
  - `modelConfig: { provider: string; model: string; apiKey: string }` — resolved model.
- `LlmOutput` type (discriminated union):
  - `{ kind: 'text'; content: string }` — model responded with text, no tool calls.
  - `{ kind: 'tool_calls'; calls: { id: string; name: string; args: Record<string, unknown> }[] }` — model wants to call one or more tools.
- New `llm_reason` graph node:
  - Reads `messages`, `toolDefinitions`, `modelConfig` from state.
  - Calls the model via `model-router` with tool definitions passed as `tools` parameter.
  - Parses the response: if the model returned tool calls, produce `{ kind: 'tool_calls', ... }`. If text, produce `{ kind: 'text', ... }`.
  - Appends the assistant message to `messages` in state.
  - Emits trace event: `{ type: 'llm_call', step, tokenUsage? }`.
- The node does NOT execute tools — it only produces intent. Tool execution is task n0l.2.
- `ToolDefinition` type: `{ name: string; description: string; parameters: Record<string, unknown> }`. A utility function converts `ContractTool[]` (from AgentContext) to `ToolDefinition[]`, extracting `inputSchema` from MCP tool config.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-yvd` | [MCP session lifecycle management](./agent-platform-nzq.3.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-6d5` | [Tool dispatch node](./agent-platform-n0l.2.md) |
| `agent-platform-icb` | [Model override resolution chain](./agent-platform-n0l.6.md) |

### Planning notes

- This task starts a **new segment** within Epic 2. Branch from updated `feature/agent-platform-runtime` (after Epic 1 segment PR is merged).
- The Vercel AI SDK `generateText` returns `toolCalls` when tools are provided. Use this rather than raw OpenAI API format.
- For MVP, only OpenAI-compatible tool calling is needed. The `ToolDefinition` format should match OpenAI function-calling schema.

## Implementation plan

1. Create **`task/agent-platform-9v1`** from **`feature/agent-platform-runtime`** (new segment after Epic 1 merges).
2. Define types in `packages/harness/src/types.ts`:
   - `ChatMessage`, `ToolDefinition`, `LlmOutput`, `LlmTextOutput`, `LlmToolCallsOutput`.
3. Update `packages/harness/src/graphState.ts`:
   - Add `messages`, `toolDefinitions`, `llmOutput`, `modelConfig` annotations to `HarnessState`.
4. Create `packages/harness/src/nodes/llmReason.ts`:
   - Import `generateText` from `ai` and `createOpenAI` from `@ai-sdk/openai`.
   - Build the `llm_reason` node function: reads state → calls model → parses response → returns state updates.
   - Handle edge case: model returns neither text nor tool calls (treat as empty text response).
5. Create `packages/harness/src/toolDefinitions.ts`:
   - `contractToolsToDefinitions(tools: ContractTool[]): ToolDefinition[]` — maps contract tools to OpenAI function-calling format. For MCP tools, extract `inputSchema` from `tool.config.inputSchema`. For registry tools without schema, produce an empty parameters object.
6. Add trace event type: `{ type: 'llm_call'; step: number; tokenUsage?: { promptTokens: number; completionTokens: number } }`.
7. Unit tests:
   - Mock `generateText` → verify state updates for text response.
   - Mock `generateText` → verify state updates for tool-call response.
   - Test `contractToolsToDefinitions` mapping.
8. Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
9. Push **`task/agent-platform-9v1`**.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`feature/agent-platform-runtime`** (new segment) |
| **This task's branch** | **`task/agent-platform-9v1`** |
| **Segment tip** | **`task/agent-platform-5pe`** (or `agent-platform-icb` if parallel) |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** LLM node with mocked model calls. Tool definition mapping.
- **Integration:** Not required (no API boundary).

## Definition of done

- [ ] `HarnessState` extended with messages, toolDefinitions, llmOutput, modelConfig.
- [ ] `llm_reason` node invokes model and produces `LlmOutput`.
- [ ] `contractToolsToDefinitions` converts contract tools to function-calling format.
- [ ] Node appends assistant message to conversation history.
- [ ] Trace event emitted on each LLM call.
- [ ] Unit tests pass.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created from **`feature/agent-platform-runtime`**
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-9v1 --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
