# Task: Model override resolution chain

**Beads issue:** `agent-platform-icb`  
**Spec file:** `docs/tasks/agent-platform-n0l.6.md` (this file)  
**Parent epic:** `agent-platform-n0l` — Epic: Agent Runtime Loop

## Task requirements

After this task, model selection follows a clear precedence chain rather than being hard-coded:

- New `resolveModelConfig` function in `packages/model-router`:
  ```ts
  function resolveModelConfig(options: {
    agent: Agent;
    headerKey?: string;      // per-request override (e.g. x-openai-key header)
    envDefaults?: {           // environment-level defaults
      provider?: string;
      model?: string;
    };
  }): { provider: string; model: string; apiKey: string }
  ```
- Resolution precedence:
  1. **Agent `modelOverride`** — if `agent.modelOverride` is set, use its `provider` and `model`.
  2. **Environment defaults** — `DEFAULT_MODEL_PROVIDER` (default: `'openai'`), `DEFAULT_MODEL` (default: `'gpt-4o'`).
  3. **System fallback** — hard-coded `{ provider: 'openai', model: 'gpt-4o' }`.
- API key resolution uses existing `resolveGatedOpenAiKeyForRequest` logic:
  1. Per-request header key (`x-openai-key`).
  2. Agent-scoped env var (future — not MVP, but interface should allow it).
  3. `AGENT_OPENAI_API_KEY` env var.
  4. Legacy `OPENAI_API_KEY` with gate.
- Wire `resolveModelConfig` into:
  - `buildAgentContext` in the Agent Factory (replaces the inline model resolution).
  - The LLM reasoning node reads `modelConfig` from state (already defined in n0l.1).
- This task can be developed **in parallel** with n0l.3/n0l.4 since it modifies `model-router` independently.

## Dependency order

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-9v1` | [LLM reasoning node](./agent-platform-n0l.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| _(none directly — consumed by chat endpoint via Agent Factory)_ | |

### Planning notes

- This task modifies `packages/model-router` which is a shared package. Ensure no breaking changes to existing exports.
- The per-request header key flow already works; this task adds the agent-level and environment-level resolution layers above it.
- For MVP, only OpenAI is supported as a provider. The `provider` field exists for future multi-provider support but currently only `'openai'` produces a working client.

## Implementation plan

1. Create **`task/agent-platform-icb`** from **`task/agent-platform-9v1`** (or from `feature/agent-platform-runtime` if developed in parallel).
2. Add `resolveModelConfig` to `packages/model-router/src/resolveOpenAiApiKey.ts` (or new file `resolveModelConfig.ts`):
   - Check `agent.modelOverride` → env vars → system fallback for provider/model.
   - Chain into existing key resolution for apiKey.
   - Return `{ provider, model, apiKey }`.
   - Throw typed error if no API key can be resolved (all sources empty).
3. Export from `packages/model-router/src/index.ts`.
4. Update `buildAgentContext` in `packages/harness/src/factory.ts`:
   - Replace inline model resolution with `resolveModelConfig`.
5. Add env var documentation to relevant README or inline comments:
   - `DEFAULT_MODEL_PROVIDER` (default: `openai`)
   - `DEFAULT_MODEL` (default: `gpt-4o`)
6. Unit tests in `packages/model-router/test/resolveModelConfig.test.ts`:
   - Agent with `modelOverride` → uses override.
   - Agent without override, env vars set → uses env.
   - No override, no env → uses system fallback.
   - API key resolution: header → env → missing (error).
7. Run quality gates, push branch.

## Git workflow (mandatory)

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-9v1`** (or `feature/...` if parallel) |
| **This task's branch** | **`task/agent-platform-icb`** |
| **This task is segment tip?** | **Possibly — coordinate with n0l.5 at merge time** |

## Tests (required before sign-off)

- **Unit (minimum):** Resolution precedence chain, API key resolution, error on missing key.

## Definition of done

- [ ] `resolveModelConfig` implements the precedence chain.
- [ ] Agent Factory uses `resolveModelConfig`.
- [ ] Existing key resolution logic preserved (no breaking changes).
- [ ] Unit tests cover all precedence levels.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.

## Sign-off

- [ ] **Task branch** created
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] `bd close agent-platform-icb --reason "…"`

**Reviewer / owner:** _____________________ **Date:** _____________
