# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-25
- **Session:** `agent-platform-n6t` shipped on `task/agent-platform-n6t` (commit `156df57`). Last child of Tier 1 epic `agent-platform-d87` — all four children now closed. PR pending.

---

## What happened (this session)

### `agent-platform-n6t` — Docs-as-record CI + ADR pattern + agent-instructions de-dup ✅

Branch `task/agent-platform-n6t` (from `main`), commit `156df57` pushed to `origin`.

- **Shared instructions:** `docs/agent-instructions-shared.md` is now the single source of truth (commands, architecture, conventions, env vars, beads/git workflow, completion gate, session protocol).
- **De-duplication:** `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` reduced to thin wrappers — **582 → 115 lines (80% reduction)**. Beads-integration blocks preserved.
- **ADR pattern:** `docs/adr/README.md`, `docs/adr/0000-template.md`, `docs/adr/0001-tier1-gap-remediation.md` (records the full Tier 1 epic).
- **Docs CI:** `.github/workflows/docs-ci.yml` runs `markdownlint-cli2` + `lychee` on PRs touching markdown.
- **Local gate:** `pnpm docs:lint` chains markdownlint-cli2 with `scripts/check-doc-links.mjs` (Node-based relative-link validator).
- **Configs:** `.markdownlint-cli2.jsonc` (strict, ignores historical task/review/planning docs), `lychee.toml` (CI link config).
- **decisions.md:** linked ADR-0001 + Tier 1 epic landing entry.
- Quality: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm docs:lint` ✅ (0 errors across 22 docs).

### Tier 1 epic `agent-platform-d87` complete ✅

All four children merged: `7ga` (critic/evaluator) · `fc8` (DoD contract) · `2v6` (observability tools) · `n6t` (docs CI + ADR). Architectural record at `docs/adr/0001-tier1-gap-remediation.md`.

### `agent-platform-2v6` merged to `main` ✅ (earlier in session)

PR #82 (`task/agent-platform-2v6` → `main`) merged at commit `aa935b6`. Landed:

- `query_logs`, `query_recent_errors`, `inspect_trace` native tools in `packages/harness/src/tools/observabilityTools.ts`
- Risk-tier 0, session-jailed via closure-bound `sessionId`
- Schemas added to `packages/contracts`
- Wired into harness `toolDispatch` with audit logging
- `plugin-observability` log/trace store backing the tools
- Tests: harness, plugin-observability, and apps/api integration suites all green

### Review-fix follow-up commit `919ab9b`

Pre-merge cleanup addressed all 7 PR review threads:

- Replaced `window[0]!` non-null assertion in `buildGraph.ts` loop detection with explicit guard
- Tightened OpenAPI / contracts shapes
- Strengthened observability store and DoD checks
- Sonar: 0 findings on touched files; typecheck/lint/tests all passed

### Beads

- `agent-platform-2v6` closed locally (dolt remote push deferred — sandbox SSH blocked)

## Current state

### Git

- **`main`** — `aa935b6` Merge PR #82 (agent-platform-2v6)
- **`task/agent-platform-n6t`** — `156df57` (pushed to origin, PR pending: <https://github.com/jwill9999/agent-platform/pull/new/task/agent-platform-n6t>)
- Stale branch `task/agent-platform-2v6` still exists locally at `919ab9b` (safe to prune)

### Quality

- Typecheck ✅ Lint ✅ Tests ✅ Docs lint ✅
- Sonar (touched files) ✅

### Key commits

| Commit    | Branch                    | Description                                                |
| --------- | ------------------------- | ---------------------------------------------------------- |
| `156df57` | `task/agent-platform-n6t` | feat(docs): docs-as-record CI + ADR pattern + agent-de-dup |
| `aa935b6` | `main`                    | Merge PR #82 — agent-queryable observability tools         |
| `919ab9b` | (PR)                      | fix: address PR review follow-up (Sonar + types + DoD)     |

---

## Next (priority order)

1. **Open PR for `task/agent-platform-n6t`** — target `main` (per recent practice; epic `d87` was run as direct-to-main per child rather than feature-branch chain)
2. **Sync beads** — `bd dolt push` next time network is available; closes `n6t` and `d87` on the remote
3. **Prune merged branches** — `git branch -d task/agent-platform-2v6` after dolt sync; `task/agent-platform-n6t` after its PR merges
4. **Pick next bd-ready task:**
   - `agent-platform-btm` (P2) — Surface critic iterations visibly in chat UI

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
