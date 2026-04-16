# Task: Tool execution timeout

**Beads issue:** `agent-platform-2wi`  
**Spec file:** `docs/tasks/agent-platform-2wi.md` (this file)  
**Parent epic:** Reliability & Resilience

## Task requirements

Add per-tool execution timeouts so a single slow or hung tool cannot block an entire agent execution until the global session timeout fires. Each tool call gets an individual timeout that is configurable per-tool and has a system default.

### Current state

- **Global timeout only** — `invokeWithTimeout()` in chatRouter.ts wraps entire graph execution
- Default timeout from `agent.executionLimits.timeoutMs` (typically 120s)
- **No per-tool timeout** — MCP calls and native tools run indefinitely until global timeout
- Tool dispatch in `toolDispatch.ts` executes sequentially via `for...of` loop
- MCP adapter calls `session.callToolAsOutput()` with no timeout parameter
- Tool failures return structured error objects (`MCP_CALL_FAILED`, etc.)

### Target state

- **Per-tool timeout** configurable in tool/MCP server config (e.g. `timeoutMs: 30000`)
- **System default** tool timeout: 30 seconds
- **AbortSignal-based** — pass AbortSignal to MCP calls and native executors
- **Timeout error** returns structured `TOOL_TIMEOUT` error code (not generic MCP_CALL_FAILED)
- **Remaining budget** — tool timeout cannot exceed remaining global timeout
- **Configurable** at 3 levels: system default → agent-level → per-tool override

### Configuration hierarchy

```
System default (30s) → Agent executionLimits.toolTimeoutMs → Per-tool config timeoutMs
```

Most specific wins. Tool timeout is capped at `remaining global timeout`.

## Dependency order

### Upstream — must be complete before this task

None — independent task.

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Add `toolTimeoutMs` to execution limits schema

**File:** `packages/contracts/src/schemas/agent.ts`

Add `toolTimeoutMs` to `ExecutionLimitsSchema`:

```typescript
toolTimeoutMs: z.number().int().positive().default(30000),
```

### Step 2: Create tool timeout wrapper

**File:** `packages/harness/src/toolTimeout.ts` (new)

```typescript
export async function withToolTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  toolName: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ToolTimeoutError(toolName, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Step 3: Apply timeout in tool dispatch

**File:** `packages/harness/src/nodes/toolDispatch.ts`

Wrap each `dispatchSingleTool()` call in `withToolTimeout()`:

```typescript
const effectiveTimeout = Math.min(
  toolConfig?.timeoutMs ?? agentLimits.toolTimeoutMs ?? 30000,
  remainingGlobalTimeout,
);
const { output, ok } = await withToolTimeout(
  () => dispatchSingleTool(call, ctx),
  effectiveTimeout,
  call.name,
);
```

**Note:** This task modifies `toolDispatch.ts`, which is also touched by `agent-platform-4jh` (AbortSignal) and `agent-platform-426` (retry wrapping). If these tasks are implemented in the same segment, the later task must merge with the earlier one's changes. See coordination note in Planning Notes below.

### Step 4: Override MCP request timeout per tool

**File:** `packages/mcp-adapter/src/session.ts`

**⚠️ Design correction:** The MCP SDK `client.callTool()` uses a `timeout` option (milliseconds), NOT an `AbortSignal`. The current implementation passes `getRequestTimeoutMs()` (env-based default of 60s). To support per-tool timeouts:

```typescript
async callToolAsOutput(
  name: string,
  args: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<Output> {
  try {
    const result = await client.callTool(
      { name, arguments: args },
      undefined,
      { timeout: options?.timeoutMs ?? requestMs },
    );
    return callToolResultToOutput(mcp.id, name, result);
  } catch (e) {
    // existing error handling...
  }
}
```

Update the `McpSession` type interface and `dispatchSingleTool()` to pass the per-tool timeout value through to the MCP adapter.

### Step 5: Add `TOOL_TIMEOUT` error code

**File:** `packages/harness/src/nodes/toolDispatch.ts`

```typescript
catch (err) {
  if (err instanceof ToolTimeoutError) {
    return { output: { type: 'error', code: 'TOOL_TIMEOUT', message: `Tool ${call.name} timed out after ${timeout}ms` }, ok: false };
  }
  // existing error handling...
}
```

### Step 6: Add `tool_timeout` trace event

**File:** `packages/harness/src/trace.ts`

Add `tool_timeout` event: `{ toolId, timeoutMs, step }`.

### Step 7: Tests

- Unit: `withToolTimeout()` — succeeds within timeout, throws on timeout
- Unit: Timeout calculation (agent-level, per-tool, remaining budget cap)
- Unit: `TOOL_TIMEOUT` error code returned correctly
- Integration: Simulated slow tool times out independently
- Integration: Fast tools unaffected by timeout wrapper

## Git workflow (mandatory)

| Rule                 | Detail                                                           |
| -------------------- | ---------------------------------------------------------------- |
| **Feature branch**   | `feature/reliability`                                            |
| **Task branch**      | `task/agent-platform-2wi` (branch from previous task in segment) |
| **Segment position** | TBD based on epic ordering                                       |

## Tests (required before sign-off)

- **Unit:** Timeout utility, error classification
- **Integration:** Tool timeout simulation
- **Regression:** Existing tool dispatch tests pass

## Acceptance criteria

1. Per-tool timeout enforced with configurable limits
2. System default of 30s applies when no override set
3. Tool timeout capped at remaining global timeout
4. `TOOL_TIMEOUT` error code returned (not generic error)
5. MCP adapter `callToolAsOutput` accepts optional `timeoutMs` override
6. Trace events emitted on timeout
7. Existing tests pass

### Planning notes

**Shared file coordination:** This task, `agent-platform-4jh` (backpressure), and `agent-platform-426` (retry) all modify `packages/harness/src/nodes/toolDispatch.ts`. When these tasks are in the same segment chain, each subsequent task must integrate with changes from the previous one. Recommended chain order: 4jh (AbortSignal) → 2wi (timeout) → 426 (retry), so each layer wraps the previous.

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass; timeout tests added
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from correct parent
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-2wi --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
