# Task: MCP session lifecycle management

**Beads issue:** `agent-platform-yvd`  
**Spec file:** `docs/tasks/agent-platform-nzq.3.md` (this file)  
**Parent epic:** `agent-platform-nzq` — Epic: Agent Schema & Factory

## Task requirements

After this task, MCP sessions are managed with proper lifecycle semantics — pooling, error recovery, and cleanup:

- New `McpSessionManager` class or module in `packages/mcp-adapter`:
  - `openSessions(configs: McpServer[]): Promise<Map<string, McpSession>>` — opens sessions in parallel with `Promise.allSettled`, returns successful sessions, logs failures.
  - `getSession(serverId: string): McpSession | undefined` — retrieve a cached session.
  - `closeAll(): Promise<void>` — close all active sessions, swallow errors during cleanup.
  - `isHealthy(serverId: string): boolean` — basic health check (session exists and transport is connected).
  - `reconnect(serverId: string, config: McpServer): Promise<boolean>` — attempt to re-open a failed session.
- Integration with Agent Factory (`buildAgentContext`): replace the inline try/catch MCP session opening with `McpSessionManager.openSessions`.
- `destroyAgentContext` delegates to `manager.closeAll()`.
- Error handling: connection failures during `openSessions` are logged with structured events (serverId, transport type, error message) but do not prevent context build. Tool discovery only runs on healthy sessions.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-2zy` | [Agent Factory: build runnable agent context](./agent-platform-nzq.2.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-9v1` | [LLM reasoning node in harness graph](./agent-platform-n0l.1.md) |

### Planning notes

- This is the **segment tip** for Epic 1 — open PR `task/agent-platform-yvd → feature/agent-platform-runtime` when complete.
- The session manager should be generic enough to be reused if we later support persistent/long-lived agent processes.
- Consider whether sessions should be shared across requests to the same agent (within a process) or isolated per request. For MVP: per-request is simpler and avoids concurrency issues.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-yvd`** from **`task/agent-platform-2zy`**.
3. Create `packages/mcp-adapter/src/manager.ts`:
   - `McpSessionManager` class with `openSessions`, `getSession`, `closeAll`, `isHealthy`, `reconnect`.
   - `openSessions` uses `Promise.allSettled` to open in parallel, collects results, builds Map from fulfilled, logs rejected.
   - `closeAll` iterates all sessions, calls `session.close()` in parallel, catches/ignores errors.
   - `isHealthy` is a simple "session exists in the map" check for MVP (transport-level health can be added later).
   - `reconnect` closes the old session if present, opens a new one with `openMcpSession`.
4. Export from `packages/mcp-adapter/src/index.ts`.
5. Update `buildAgentContext` in `packages/harness/src/factory.ts`:
   - Create `McpSessionManager`, call `openSessions` with MCP configs.
   - Use the manager for tool discovery.
   - Store the manager reference in `AgentContext` (or replace `mcpSessions` with the manager).
6. Update `destroyAgentContext` to call `manager.closeAll()`.
7. Add unit tests in `packages/mcp-adapter/test/manager.test.ts`:
   - Mock `openMcpSession`: verify parallel opening, verify failure handling.
   - Verify `closeAll` calls close on all sessions.
   - Verify `getSession` returns correct session or undefined.
8. Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
9. Push **`task/agent-platform-yvd`** to `origin`.
10. **Segment tip:** Open PR **`task/agent-platform-yvd` → `feature/agent-platform-runtime`**.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-2zy`** |
| **This task's branch** | **`task/agent-platform-yvd`** |
| **Segment tip** | **`task/agent-platform-yvd`** ← **this task** |
| **This task is segment tip?** | **Yes — open PR to `feature/agent-platform-runtime`** |

## Tests (required before sign-off)

- **Unit (minimum):** `McpSessionManager` tests with mocked sessions.
- **Integration:** Verify `buildAgentContext` → `destroyAgentContext` lifecycle with mocked MCP servers.

## Definition of done

- [ ] `McpSessionManager` implemented with `openSessions`, `getSession`, `closeAll`, `isHealthy`, `reconnect`.
- [ ] Agent Factory uses the manager for MCP lifecycle.
- [ ] Parallel session opening with graceful failure handling.
- [ ] Unit tests cover success, partial failure, and full cleanup.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] **PR** opened: **`task/agent-platform-yvd` → `feature/agent-platform-runtime`**.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-2zy`** before implementation
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR merged:** `task/agent-platform-yvd` → `feature/agent-platform-runtime` (link: _________________)
- [ ] `bd close agent-platform-yvd --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
