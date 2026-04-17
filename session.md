# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-17
- **Session:** `/api/chat` accepts legacy `{ sessionId, message }` POST bodies (maps to one user message); added `parseChatPostBody` + Vitest coverage.

---

## What happened (this session)

- **Chat BFF:** `POST /api/chat` is built for `@ai-sdk/react` `useChat`, which sends `{ messages, model? }`. Manual tests sending `{ sessionId, message }` no longer fail body validation; `sessionId` is ignored for streaming.
- **Tests:** `apps/web/test/chat-post-body.test.ts` covers standard and legacy shapes.

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

- 237+ tests passing (55 API + 159 harness + 7 web + others)
- Build, typecheck, lint, format all clean
- All CI checks green on PR #52 (verify, docker, e2e, GitGuardian, SonarCloud)

### Git

- `main` — up to date through PR #41
- `feature/frontend-v0` — base branch for frontend epic
- `task/agent-platform-cfg` — segment tip, PR #52 open → `feature/frontend-v0`
- PR #51 closed (superseded by #52)
- **`cursor/fix-api-chat-legacy-body-f896`** — `/api/chat` legacy body support (PR open to `main`)

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

1. **Merge PR #52** — Frontend V0 Integration → `feature/frontend-v0`, then `feature/frontend-v0` → `main`
2. **Review/merge** `cursor/fix-api-chat-legacy-body-f896` PR — legacy `/api/chat` body + docs for correct `useChat` payload
3. **`agent-platform-a9g`** — Chat file/context attachments (P2, frontend)
4. **`agent-platform-d8u`** — Concurrent session safety (P2, harness/reliability)
5. **`agent-platform-psa`** — Context window management (P2, harness/runtime)
6. **Agent/model selector** — User discussed wanting agent picker in chat header (needs task)

---

## Blockers / questions for owner

- PR #52 needs review and merge to `feature/frontend-v0`, then `feature/frontend-v0` → `main`

---

## Key references

- **Code review:** `docs/reviews/2026-04-15-api-harness-review.md`
- **Architecture ADR:** `docs/planning/architecture.md`
- **Task specs:** `docs/tasks/` directory
- **Frontend UI phases:** `docs/planning/frontend-ui-phases.md`

---

## Quick commands

```bash
bd ready --json
gh pr view 52
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
```
