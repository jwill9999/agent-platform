# Lazy Skill Loading

This document describes the **implementation** of lazy skill loading in the agent harness. For the original design reference (file-based pattern), see [planning/lazy-skill-loading.md](../planning/lazy-skill-loading.md).

---

## Why Lazy Loading?

Without lazy loading, every assigned skill's full body (`goal`, `constraints`, tools list) is injected into the system prompt on every turn — regardless of whether the skill is used. This is wasteful:

```
Before                              After
──────────────────────────          ────────────────────────────
System prompt: ~2,700 tokens        System prompt: ~1,050 tokens
All 5 skill bodies always present   Only stubs injected (~30 tokens each)
No way to refresh mid-session       Skills fetched fresh on demand
```

| Component                           | Before (full bodies) | After (stubs + lazy load)        |
| ----------------------------------- | -------------------- | -------------------------------- |
| 5 skill bodies in system prompt     | ~2,000 tokens        | 0 tokens                         |
| 5 skill stubs in system prompt      | —                    | ~150 tokens                      |
| `sys_get_skill_detail` call         | —                    | ~20 tokens per call              |
| Skill detail in turn history        | —                    | ~400 tokens (loaded skills only) |
| **Turn overhead for 2 skills used** | **~2,000 tokens**    | **~590 tokens**                  |
| **Saving**                          | —                    | **~1,410 tokens (~70%)**         |

The saving compounds across long sessions and agents with large skill libraries.

---

## Design Decisions

### DB-driven, not file-based

The reference design (`docs/planning/lazy-skill-loading.md`) assumes skills are markdown files with frontmatter, parsed at boot. Our implementation stores skills in SQLite via Drizzle ORM. There is no file parsing — the DB is the source of truth.

### Extend existing schema (not replace)

We added two optional fields to the Skill contract:

| Field         | Type      | Purpose                                              |
| ------------- | --------- | ---------------------------------------------------- |
| `description` | `string?` | One-liner for the stub (injected into system prompt) |
| `hint`        | `string?` | When-to-use guidance (helps model decide)            |

The existing `goal` field remains as the full instructions body. When `description` is absent, `goal` is truncated to ~100 characters for backwards compatibility.

### System tool with interceptor (not executor)

`sys_get_skill_detail` is defined in `SYSTEM_TOOLS` (so the LLM can see it) but **not** handled by `createSystemToolExecutor()`. The executor takes no arguments beyond `(toolId, args)` and has no access to graph state.

Instead, the handler is **intercepted** in `createToolDispatchNode()` — the dispatch loop has access to `ToolDispatchContext` (for the `skillResolver` callback) and graph state (for governor tracking via `loadedSkillIds`).

### Clean architecture via callback injection

The harness has no direct dependency on the DB package. Skill resolution is injected as a callback:

```
chatRouter.ts                    toolDispatch.ts
─────────────                    ───────────────
skillResolver: (id) =>  ──────►  ctx.skillResolver(skillId)
  getSkill(db, id)                 → Skill | undefined
```

This keeps the harness pure and testable — tests inject a mock resolver, the API wires the real DB lookup.

---

## Architecture

### Where things live

| Concern            | File                                         | Function / Type                    |
| ------------------ | -------------------------------------------- | ---------------------------------- |
| Skill schema       | `packages/contracts/src/skill.ts`            | `SkillSchema` (Zod)                |
| DB columns         | `packages/db/src/schema.ts`                  | `skills` table                     |
| DB migration       | `packages/db/drizzle/0009_*.sql`             | `ALTER TABLE` for description/hint |
| Stub formatting    | `packages/harness/src/factory.ts`            | `formatSkillSection()`             |
| Tool definition    | `packages/harness/src/systemTools.ts`        | `SYSTEM_TOOLS` array               |
| Handler + governor | `packages/harness/src/nodes/toolDispatch.ts` | `handleGetSkillDetail()`           |
| State tracking     | `packages/harness/src/graphState.ts`         | `loadedSkillIds` (append reducer)  |
| Trace events       | `packages/harness/src/trace.ts`              | `skill_loaded`, `skill_load_loop`  |
| API wiring         | `apps/api/.../v1/chatRouter.ts`              | `skillResolver` on context         |

### Data flow

```
1. Agent boot (factory.ts)
   ┌──────────────────────────────────────────────────────┐
   │ Skills from DB → formatSkillSection()                │
   │   → Emit stubs: "- **id** (name): description"      │
   │   → Append: "Call sys_get_skill_detail before using" │
   │   → Inject into system prompt                        │
   └──────────────────────────────────────────────────────┘

2. LLM decides to use a skill → calls sys_get_skill_detail({ skill_id })

3. Tool dispatch (toolDispatch.ts)
   ┌──────────────────────────────────────────────────────┐
   │ Intercept before normal dispatch:                    │
   │   a. Validate skill_id is a string                   │
   │   b. Check skill is in agent.allowedSkillIds         │
   │   c. Governor: count loads from loadedSkillIds state │
   │      - >= 5: SKILL_LOAD_LOOP error (halt)            │
   │      - >= 3: Trace warning (continue)                │
   │   d. Call ctx.skillResolver(skillId) → Skill         │
   │   e. Return { goal, constraints, tools, outputSchema }│
   │   f. Append skillId to loadedSkillIds state          │
   └──────────────────────────────────────────────────────┘

4. LLM now has full instructions → proceeds with skill's tools
```

### Conversation flow

A typical multi-skill turn:

```
[system]    Agent prompt + skill stubs + sys_get_skill_detail tool

[user]      "Find the memory leak and create a GitHub issue for it"

[assistant] → tool_call: sys_get_skill_detail({ skill_id: "web-research" })
[tool]      { id: "web-research", goal: "...", constraints: [...], tools: [...] }

[assistant] → tool_call: sys_get_skill_detail({ skill_id: "github-cli" })
[tool]      { id: "github-cli", goal: "...", constraints: [...], tools: [...] }

[assistant] → tool_call: web_search({ query: "React useEffect memory leak" })
[tool]      { results: [...] }

[assistant] → tool_call: bash({ command: "gh issue create ..." })
[tool]      { stdout: "https://github.com/org/repo/issues/42" }

[assistant] "Created issue #42 with memory leak analysis."
```

The two `sys_get_skill_detail` calls cost ~40 tokens but save ~1,600 tokens of unused skill bodies.

---

## Governor Logic

The governor prevents reasoning loops where the model repeatedly loads the same skill:

| Load count | Behaviour                                                  |
| ---------- | ---------------------------------------------------------- |
| 1–2        | Normal — trace `skill_loaded` event                        |
| 3–4        | Warning — trace `skill_load_loop`, skill still returned    |
| 5+         | Error — `SKILL_LOAD_LOOP` error returned, skill not loaded |

State is tracked in `loadedSkillIds` (append-only array in `HarnessState`). The governor checks the combined state from previous steps plus the current dispatch batch.

### Trace events

| Event             | Fields                 | When                            |
| ----------------- | ---------------------- | ------------------------------- |
| `skill_loaded`    | `skillId`, `loadCount` | Every successful load           |
| `skill_load_loop` | `skillId`, `loadCount` | Load count >= 3 (warn or error) |

---

## Stub Format

The system prompt section looks like:

```markdown
## Available Skills

Call `sys_get_skill_detail` with the skill ID before using any skill.

- **web-research** (Web Research): Search and summarize web content
  Hint: Use when user asks about current events or external information
- **github-cli** (GitHub CLI): Interact with GitHub repos, PRs, issues
  Hint: PR management, issue tracking, repo operations
```

When `description` is not set, the first ~100 characters of `goal` are used with a trailing ellipsis.

---

## Error Cases

| Scenario               | Error code               | Response                                              |
| ---------------------- | ------------------------ | ----------------------------------------------------- |
| Missing `skill_id`     | `INVALID_INPUT`          | `"skill_id is required."`                             |
| Skill not in allowlist | `SKILL_NOT_ASSIGNED`     | `"Skill X is not assigned to this agent."`            |
| Skill not in DB        | `SKILL_NOT_FOUND`        | `"Skill X not found."`                                |
| No resolver configured | `SKILL_RESOLVER_MISSING` | `"Skill resolver not configured."`                    |
| Load count >= 5        | `SKILL_LOAD_LOOP`        | `"Skill X loaded N times — possible reasoning loop."` |

All errors return valid tool messages (not exceptions), so the LLM can recover gracefully.

---

## Testing

11 unit tests in `packages/harness/test/lazySkillLoading.test.ts`:

- Valid skill resolution → returns full detail
- Skill not in agent's allowed list → `SKILL_NOT_ASSIGNED`
- Skill not found by resolver → `SKILL_NOT_FOUND`
- Missing skill_id input → `INVALID_INPUT`
- State tracking → `loadedSkillIds` appended correctly
- Trace events → `skill_loaded` emitted
- Governor warn threshold (3) → trace warning, still returns skill
- Governor error threshold (5) → `SKILL_LOAD_LOOP` error
- Different skills → no cross-contamination in governor
- No resolver configured → `SKILL_RESOLVER_MISSING`

---

## Related Documents

- [Architecture overview](../architecture.md) — Summary table of lazy loading
- [Message Flow](message-flow.md) — Tool dispatch diagram (includes skill detail intercept)
- [Configuration](../configuration.md) — Skill API with `description` and `hint` fields
- [Planning: Lazy Skill Loading](../planning/lazy-skill-loading.md) — Original design reference (file-based pattern)
