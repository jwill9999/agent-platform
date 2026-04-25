# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-25
- **Session:** `agent-platform-btm` shipped on `task/agent-platform-btm` (commit `a7ffa9a`). Surfaces critic iterations as distinct chat-UI badges + drives StatusLabel from latest critic event.

---

## What happened (this session)

### `agent-platform-btm` — Surface critic iterations visibly in chat UI ✅

Branch `task/agent-platform-btm` (from `main`, after `7ga` merged), commit `a7ffa9a`.

- **Parser:** new `apps/web/lib/critic-events.ts` — `parseCriticContent()` recognises the harness critic node's `thinking` content shapes (`Critic: revise (n/cap) - …`, `Critic: accept on first pass - …`, `Critic: accept after N revision(s) - …`) and returns structured `CriticEvent` (`revise` / `accept` / `cap_reached`). Also `formatCriticStatus()` for the header.
- **Hook:** `useHarnessChat` now intercepts critic `thinking` events (and `error` with `code === 'CRITIC_CAP_REACHED'`) so they no longer stream into the assistant text. Tracks them per assistant message id and exposes `criticEventsByMessage`.
- **Component:** new `apps/web/components/chat/critic-badges.tsx` renders chips with distinct colour + icon per state (revise=amber/RefreshCw, accept=emerald/Check, cap_reached=red/AlertTriangle). Reasons surface via `title` tooltip.
- **Layout:** `AssistantContent` renders `CriticBadges` above markdown / streaming placeholder. `StatusLabel` accepts `criticStatus` and uses it instead of the generic “Thinking…” when a critic event has been received for the active turn.
- **Tests:** `apps/web/test/critic-events.test.ts` covers parser (revise / accept variants / missing reasons / non-critic discrimination) and status formatter.
- **Quality:** typecheck ✅, web lint ✅, web tests (29) ✅, full `pnpm -r run test` ✅, Sonar (touched files) 0 findings.
- **Scope discipline:** zero changes to NDJSON contract / harness public API.

### Beads

- `agent-platform-btm` claimed (`in_progress`); will close after commit lands. Remote dolt push deferred (sandbox SSH blocked, same as previous sessions).

## Current state

### Git

- **`main`** — unchanged from previous session
- **`task/agent-platform-btm`** — `a7ffa9a` (local; remote push deferred)

### Quality

- Typecheck ✅ Lint ✅ Tests ✅ (workspace-wide)
- Sonar (touched files) ✅ 0 findings

### Key commits

| Commit    | Branch                    | Description                                      |
| --------- | ------------------------- | ------------------------------------------------ |
| `a7ffa9a` | `task/agent-platform-btm` | feat(web): critic iteration badges + live status |

---

## Next (priority order)

1. **Open PR for `task/agent-platform-btm`** → `main` once network available
2. **Close `agent-platform-btm` in beads** + dolt push when network available
3. **Pick next bd-ready task** (`bd ready`)

---

## Blockers / questions for owner

- Sandbox SSH is blocked, so dolt remote push and `git push` cannot run from this session.

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
