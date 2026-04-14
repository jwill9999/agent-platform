# Task: Agent Factory — build runnable agent context

**Beads issue:** `agent-platform-2zy`  
**Spec file:** `docs/tasks/agent-platform-nzq.2.md` (this file)  
**Parent epic:** `agent-platform-nzq` — Epic: Agent Schema & Factory

## Task requirements

After this task, a single function can take an agent ID and produce a fully assembled runtime context:

- New `AgentContext` type defined in `packages/harness` (or new `packages/agent-factory` package — prefer harness to avoid a new package unless complexity demands it):
  ```ts
  type AgentContext = {
    agent: Agent;                          // loaded from DB
    systemPrompt: string;                  // agent.systemPrompt + skill/tool augmentation
    tools: ContractTool[];                 // registry tools + MCP-discovered tools
    mcpSessions: Map<string, McpSession>;  // serverId → live session
    pluginDispatcher: PluginDispatcher;     // resolved chain for this agent
    modelConfig: { provider: string; model: string; apiKey: string }; // resolved
  };
  ```
- New `buildAgentContext(db, agentId, options?)` function that:
  1. Loads the agent from DB via `loadAgentById`.
  2. Loads allowed skills via `getSkill` for each `allowedSkillIds`.
  3. Loads allowed tools via `getTool` for each `allowedToolIds`.
  4. Loads allowed MCP server configs via `getMcpServer` for each `allowedMcpServerIds`.
  5. Opens MCP sessions (delegated to task nzq.3 — this task uses a placeholder/passthrough if nzq.3 isn't complete, but defines the interface).
  6. Discovers MCP tools via `listContractTools()` on each session, merges with registry tools.
  7. Constructs the augmented system prompt: agent's `systemPrompt` + skill definitions formatted as instructions + available tool descriptions.
  8. Resolves the plugin chain via `resolveEffectivePluginHooks` with global/user/agent layers.
  9. Resolves model config (basic version — agent override or env default; full chain in task n0l.6).
  10. Returns `AgentContext`.
- A `destroyAgentContext(ctx)` function that closes all MCP sessions.
- Error handling: if agent not found, throw typed error. If an MCP server fails to connect, log warning and exclude its tools (do not fail the entire context build).

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-4wm` | [Agent schema: add identity fields](./agent-platform-nzq.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-yvd` | [MCP session lifecycle management](./agent-platform-nzq.3.md) |

### Planning notes

- The factory should NOT import from `apps/api` — it lives in a shared package so both the API and future consumers (CLI, workers) can use it.
- System prompt construction should be deterministic — skill and tool descriptions appended in sorted order by ID.
- The `modelConfig` resolution is basic here (override or env); the full chain is task n0l.6.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-2zy`** from **`task/agent-platform-4wm`**.
3. Define `AgentContext` type in `packages/harness/src/factory.ts` (or `types.ts` if cleaner).
4. Implement `buildAgentContext`:
   - Load agent: `loadAgentById(db, agentId)` — throw `AgentNotFoundError` if undefined.
   - Load skills: map `agent.allowedSkillIds` → `getSkill(db, id)`, filter nulls.
   - Load registry tools: map `agent.allowedToolIds` → `getTool(db, id)`, filter nulls.
   - Load MCP configs: map `agent.allowedMcpServerIds` → `getMcpServer(db, id)`, filter nulls.
   - Open MCP sessions: for each config, `openMcpSession(config)` wrapped in try/catch — on failure, log warning, skip.
   - Discover MCP tools: for each session, `listContractTools()`, concatenate with registry tools.
   - Build system prompt: start with `agent.systemPrompt`, append "\n\n## Available Skills\n" + formatted skill list, append "\n\n## Available Tools\n" + formatted tool list.
   - Resolve plugins: `resolveEffectivePluginHooks({ global: [], user: [], agent })` → `createPluginDispatcher(hooks)`.
   - Resolve model: `agent.modelOverride ?? { provider: 'openai', model: process.env.DEFAULT_MODEL ?? 'gpt-4o' }` + key from `resolveGatedOpenAiKeyForRequest`.
5. Implement `destroyAgentContext`: iterate `mcpSessions.values()`, call `session.close()` on each.
6. Export from `packages/harness/src/index.ts`.
7. Add unit tests in `packages/harness/test/factory.test.ts`:
   - Mock DB calls, verify context assembly.
   - Verify MCP failure is graceful (one fails, others succeed, tools from failed server excluded).
   - Verify system prompt includes skill/tool augmentation.
   - Verify plugin chain resolution.
8. Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
9. Push **`task/agent-platform-2zy`** to `origin`.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-4wm`** |
| **This task's branch** | **`task/agent-platform-2zy`** |
| **Segment tip** | **`task/agent-platform-yvd`** |
| **This task is segment tip?** | **No** |

## Tests (required before sign-off)

- **Unit (minimum):** Factory function tests with mocked DB/MCP — verify all assembly logic.
- **Integration:** Not required for this task (no API boundary crossed; factory is a library function).

## Definition of done

- [ ] `AgentContext` type defined and exported.
- [ ] `buildAgentContext` loads agent, skills, tools, MCP configs, opens sessions, assembles prompt, resolves plugins and model.
- [ ] `destroyAgentContext` closes all MCP sessions.
- [ ] MCP connection failures are graceful (logged, excluded, no crash).
- [ ] System prompt augmentation is deterministic.
- [ ] Unit tests cover: successful assembly, MCP failure resilience, missing agent error.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] Branch pushed; next task can branch from **`task/agent-platform-2zy`**.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-4wm`** before implementation
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-2zy --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
