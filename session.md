# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-23
- **Session:** `agent-platform-7ga` merged to `main`; implemented `agent-platform-fc8` on `task/agent-platform-fc8` with the new DoD contract phase, hook, tests, and docs.

---

## What happened (this session)

### `agent-platform-7ga` landed on `main` ✅

The critic / evaluator loop is merged and released. That unblocked the next Tier 1 remediation task in the chain.

### `agent-platform-fc8` implemented on `task/agent-platform-fc8` ✅

Added an explicit Definition-of-Done phase to the harness runtime:

- New `DodContractSchema` in `packages/contracts/src/dod.ts`
- New `onDodCheck` plugin hook with ordered override semantics in `packages/plugin-sdk`
- New `dodPropose` and `dodCheck` nodes in `packages/harness/src/nodes/`
- Graph routing now enforces `dodCheck` before `END`
- Failed DoD injects `<dod-failed>` feedback back into `llmReason`; cap exhaustion emits `DOD_FAILED`
- `plugin-observability` now records `dod_check` events
- Docs updated: architecture, message-flow, plugin guide

Validation run this session:

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test` ✅ (run unsandboxed because `apps/api` binds a local port)

Branch pushed: `task/agent-platform-fc8` @ `9500350`.

## Current state

### Git

- **`main`** — includes `agent-platform-7ga` (critic / evaluator loop)
- **`task/agent-platform-fc8`** — current branch, pushed to `origin/task/agent-platform-fc8`, latest commit `9500350`
- **Next chained task after fc8:** `agent-platform-2v6` (agent-queryable observability tools)

### Quality

- Typecheck ✅ Lint ✅ Tests ✅
- Harness now at **433 passing tests** including DoD propose/check coverage
- API tests pass unsandboxed; sandboxed runs still hit the expected `listen EPERM 0.0.0.0` restriction

### Key commits

| Commit    | Branch                    | Description                                  |
| --------- | ------------------------- | -------------------------------------------- |
| `9500350` | `task/agent-platform-fc8` | feat: add Definition-of-Done contract phase  |
| `d4dfd1b` | `main`                    | latest main after `agent-platform-7ga` merge |

---

## Next (priority order)

1. **Close + sync `agent-platform-fc8`** if not already done after this handoff commit
2. **Start `agent-platform-2v6`** from `task/agent-platform-fc8`
3. Expose the new `dod_check` observability data through the runtime tools (`query_logs`, `query_recent_errors`, `inspect_trace`)
4. After `2v6`, continue to `agent-platform-n6t` (docs CI + ADR + instruction de-dup)

---

## Blockers / questions for owner

- No functional blocker in code. The only caveat is environmental: full API tests require unsandboxed execution because they bind a local port.

---

## Key references

| Document                                  | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `docs/architecture.md`                    | System design, package roles, data flow    |
| `docs/architecture/message-flow.md`       | Mermaid diagrams: chat → LLM → tools       |
| `docs/api-reference.md`                   | REST endpoints, error shapes, schemas      |
| `docs/configuration.md`                   | Env vars, model routing, limits, MCP setup |
| `docs/planning/lazy-skill-loading.md`     | Lazy skill pattern (planning reference)    |
| `docs/architecture/lazy-skill-loading.md` | Lazy skill loading implementation guide    |
| `docs/planning/security.md`               | Threat model (8 categories)                |
| `docs/tasks/agent-platform-fc8.md`        | DoD contract task spec                     |
| `docs/tasks/agent-platform-2v6.md`        | Next task in the chain                     |
| `docs/planning/frontend-ui-phases.md`     | Frontend UI phased plan (unblocked)        |
| `docs/tasks/`                             | Task spec files                            |

---

## Quick commands

```bash
make up          # Docker build + start + seed
make restart     # Rebuild + restart (keeps DB)
make reset       # Wipe DB + rebuild + reseed
pnpm test        # Vitest unit tests
pnpm typecheck   # TypeScript across all packages
pnpm lint        # ESLint (max-warnings 0)
```
