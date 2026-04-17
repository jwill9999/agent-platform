# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-17
- **Session:** **Fix AI SDK streaming errors** — Added `onError` callback to `streamText` to surface errors that were silently swallowed, causing empty responses when switching agents — branch `task/explorer-collapse-cta` (tip `f668ae3`).

---

## What happened (this session)

### Fix: AI SDK streaming errors returning empty responses

**Problem:** When switching to a different agent (e.g., "coding" agent), chat requests returned HTTP 200 with empty NDJSON body — no content at all.

**Root cause:** Vercel AI SDK's `streamText` uses `onError` callback instead of throwing. Errors (like invalid API key) caused:

1. `textStream` to complete with 0 chunks
2. Error captured but not re-thrown
3. Graph "succeeded" with empty response

**Fix in `packages/harness/src/nodes/llmReason.ts`:**

- Added `onError` callback to capture streaming errors
- After stream completion, check and re-throw captured errors
- Error now propagates through graph's catch handler → NDJSON error event to client

**Test added:** `re-throws errors from onError callback` in `llmReason.test.ts`

### Previous work on this branch (earlier commits)

- IDE explorer "Collapse all folders" CTA
- Web chat → harness proxy wiring (`/api/chat` → `/v1/chat`)
- Agent selector with session creation per agent change
- Seed naming and agent identity fixes

---

## Current state

### Epics

| Epic                        | ID                   | Status                | PR     |
| --------------------------- | -------------------- | --------------------- | ------ |
| **Agent Schema & Factory**  | `agent-platform-nzq` | **Complete** — merged | —      |
| **Agent Runtime Loop**      | `agent-platform-n0l` | **Complete** — merged | PR #25 |
| **Harness Hardening**       | `agent-platform-qlp` | **Complete** — merged | PR #26 |
| SonarCloud fixes            | —                    | **Complete** — merged | PR #27 |
| SSEClientTransport replace  | `agent-platform-pe4` | **Complete** — merged | PR #28 |
| Structured logger           | `agent-platform-qhe` | **Complete** — merged | PR #29 |
| Correlation IDs             | `agent-platform-hnx` | **Complete** — merged | PR #30 |
| Rate limiting & cost        | `agent-platform-nqn` | **Complete** — merged | PR #31 |
| Runtime config API          | `agent-platform-16p` | **Complete** — merged | PR #32 |
| Provider-agnostic routing   | `agent-platform-bto` | **Complete** — merged | PR #33 |
| **OpenAPI Integration**     | `agent-platform-fx5` | **Complete** — merged | PR #34 |
| **Runtime Hardening**       | —                    | **Complete** — merged | PR #39 |
| **DB Safety**               | —                    | **Complete** — merged | PR #41 |
| **Frontend V0 Integration** | `agent-platform-o63` | **Complete** — PR #52 | PR #52 |

### Quality

- 160 harness tests + 59 API tests passing (219+ total)
- Build, typecheck, lint, format all clean
- All CI checks green on PR #60

### Git

- **`task/explorer-collapse-cta`** — tip `f668ae3` (AI SDK error fix pushed); PR #60 open
- `main` — up to date with `origin/main` at session start

### Ready backlog

| ID                   | Priority | Title                                      | Status |
| -------------------- | -------- | ------------------------------------------ | ------ |
| `agent-platform-a9g` | P2       | Chat file/context attachments              | Open   |
| `agent-platform-d8u` | P2       | Concurrent session safety                  | Open   |
| `agent-platform-psa` | P2       | Context window management                  | Open   |
| `agent-platform-1nx` | P2       | Docs restructure: README as index          | Open   |
| `agent-platform-hkn` | P2       | Observability layer with pluggable metrics | Open   |
| `agent-platform-3kd` | P3       | Plugin sandboxing design spike             | Open   |
| `agent-platform-ged` | P3       | Deep health check                          | Open   |
| `agent-platform-tgp` | P3       | Secret rotation mechanism                  | Open   |

---

## Next (priority order)

1. **Merge PR #60** — `task/explorer-collapse-cta` → `main` (AI SDK error fix)
2. **`agent-platform-a9g`** — Chat file/context attachments (P2, frontend)
3. **`agent-platform-d8u`** — Concurrent session safety (P2, harness/reliability)
4. **`agent-platform-psa`** — Context window management (P2, harness/runtime)

---

## Blockers / questions for owner

- None currently

---

## Key references

- **Code review:** `docs/reviews/2026-04-15-api-harness-review.md`
- **Architecture ADR:** `docs/planning/architecture.md`
- **Task specs:** `docs/tasks/` directory
- **Frontend UI phases:** `docs/planning/frontend-ui-phases.md`

---

## Quick commands

```bash
gh pr view 60
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
```
