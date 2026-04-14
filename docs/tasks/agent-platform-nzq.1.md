# Task: Agent schema — add identity fields

**Beads issue:** `agent-platform-4wm`  
**Spec file:** `docs/tasks/agent-platform-nzq.1.md` (this file)  
**Parent epic:** `agent-platform-nzq` — Epic: Agent Schema & Factory

## Task requirements

After this task, agents carry enough identity information to drive a conversational runtime:

- `AgentSchema` in `packages/contracts/src/agent.ts` gains two new fields:
  - `systemPrompt` — **required** `z.string().min(1)`. The base system prompt injected at the start of every LLM call for this agent. Defines role, personality, constraints, and instructions.
  - `description` — **optional** `z.string()`. Human-readable description shown in the UI agent list / management screens.
- DB schema (`packages/db/src/schema.ts`) adds corresponding columns to the `agents` table:
  - `system_prompt` — `text`, NOT NULL.
  - `description` — `text`, nullable.
- Drizzle migration generated via `drizzle-kit generate`.
- Mappers (`packages/db/src/mappers.ts`) updated: `loadAgentById` reads the new columns; `replaceAgent` writes them.
- Seed (`packages/db/src/seed/runSeed.ts`) updated: default agent gets a baseline system prompt (e.g., "You are a helpful assistant. Use available tools to help the user.").
- All existing tests that construct `Agent` objects are updated to include `systemPrompt`.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| _(none — first task in epic)_ | |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-2zy` | [Agent Factory: build runnable agent context](./agent-platform-nzq.2.md) |

### Planning notes

- The `systemPrompt` field is required, so existing agents in any pre-existing database will need the migration to include a DEFAULT or a backfill step. The migration should set a sensible default for existing rows.
- No changes to API routes are needed — the v1Router already uses `AgentSchema` for parse/response, so the new fields flow through automatically.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-4wm`** from **`feature/agent-platform-runtime`**:
   `git fetch origin && git checkout -b feature/agent-platform-runtime main && git push -u origin feature/agent-platform-runtime && git checkout -b task/agent-platform-4wm`.
3. Update `packages/contracts/src/agent.ts`:
   - Add `systemPrompt: z.string().min(1)` and `description: z.string().optional()` to `AgentSchema`.
4. Update `packages/db/src/schema.ts`:
   - Add `systemPrompt: text('system_prompt').notNull()` and `description: text('description')` to the `agents` table.
5. Generate Drizzle migration: `pnpm --filter @agent-platform/db exec drizzle-kit generate`.
   - Review the generated SQL — ensure it includes a DEFAULT clause for `system_prompt` on existing rows.
6. Update `packages/db/src/mappers.ts`:
   - `loadAgentById`: read `systemPrompt` and `description` from the row, include in `AgentSchema.parse()`.
   - `replaceAgent` (in `repositories/registry.ts`): write `systemPrompt` and `description` in the insert/update values.
7. Update `packages/db/src/seed/runSeed.ts`:
   - Add `systemPrompt` to the default agent insert.
8. Update all test files that construct `Agent` objects to include `systemPrompt`:
   - `apps/api/test/harness-path.integration.test.ts`
   - `apps/api/test/plugin-session.integration.test.ts`
   - `apps/api/test/crud.integration.test.ts` (if it constructs agents)
   - Any contract/db test files.
9. Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
10. Push **`task/agent-platform-4wm`** to `origin`.

## Git workflow (mandatory)

**Segment:** Agent Schema & Factory (nzq.1–nzq.3). **Chained branches:** first task from `feature/agent-platform-runtime`; each later task from previous `task/...`. **One PR per segment** from **`task/agent-platform-yvd`** → `feature/agent-platform-runtime`.

| | |
|---|---|
| **Parent for this branch** | **`feature/agent-platform-runtime`** |
| **This task's branch** | **`task/agent-platform-4wm`** |
| **Segment tip (opens PR to `feature/...`)** | **`task/agent-platform-yvd`** |
| **This task is segment tip?** | **No** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-4wm`** from **`feature/agent-platform-runtime`**. |
| **Intermediate tasks** | Push branch; next task checks out from **`task/agent-platform-4wm`**. |
| **Segment tip** | One PR **`task/agent-platform-yvd` → `feature/agent-platform-runtime`**. |

## Tests (required before sign-off)

- **Unit (minimum):** `pnpm test` — all packages. Specifically:
  - Contract schema tests: verify `AgentSchema.parse()` accepts/rejects the new fields correctly.
  - DB mapper tests: verify round-trip (insert agent with systemPrompt → load → fields match).
  - Seed idempotency: `pnpm seed` runs twice without error.
- **Integration:** `apps/api/test/crud.integration.test.ts` — POST/PUT/GET agent with new fields.

## Definition of done

- [ ] `AgentSchema` includes `systemPrompt` (required) and `description` (optional).
- [ ] DB schema has corresponding columns with migration.
- [ ] Mappers read/write the new fields correctly.
- [ ] Seed default agent has a baseline `systemPrompt`.
- [ ] All existing tests updated and passing.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] Branch pushed; next task can branch from **`task/agent-platform-4wm`**.

## Sign-off

- [ ] **Task branch** created from **`feature/agent-platform-runtime`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR to `feature`:** N/A — merge at segment end
- [ ] `bd close agent-platform-4wm --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
