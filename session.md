# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-25
- **Session:** `agent-platform-btm` shipped + PR #84 opened. PR review comment addressed in commit `0abddbe` (centralised critic label formatting). Push deferred — sandbox SSH blocked.

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

---

## UI/UX Ticket Specifications (manual beads reference)

### 1. Display a thinking block with model logic before streaming the answer

**Requirements:**

- When a user sends a message, a "thinking" block should appear in the chat UI before the agent's answer begins streaming.
- The "thinking" block must clearly indicate the agent/model is processing, using a visual distinct from the final answer.
- The block should disappear as soon as the agent's answer starts streaming.
- The implementation must not block or delay the streaming of the actual answer.
- The design should be consistent with the rest of the chat UI (bright, clean, minimalistic).
  **Definition of Done:**
- Thinking block appears before agent response and disappears on stream start.
- Playwright test covers this interaction.
- SonarQube/Problems show no new issues in touched files.

### 2. Refactor sidebar: only show Chat/IDE, move other items to Settings, remove Sessions/Tools

**Requirements:**

- The main sidebar should only display navigation for Chat and IDE.
- All other navigation items (e.g., Settings, Sessions, Tools) must be moved to a Settings menu or equivalent secondary location.
- The sidebar must be visually simplified for clarity and space efficiency.
- Remove any Sessions or Tools entries from the sidebar.
- Sidebar must remain responsive and accessible.
  **Definition of Done:**
- Sidebar shows only Chat/IDE; all other items are accessible via Settings.
- Playwright test verifies sidebar/menu structure.
- SonarQube/Problems show no new issues in touched files.

### 3. Remove sessions sidebar, move sessions under menu as collapsible agent dropdowns

**Requirements:**

- The dedicated sessions sidebar must be removed from the UI.
- Sessions should be accessible via a collapsible dropdown menu under the agent or main menu.
- The dropdown must clearly list available sessions and allow switching between them.
- The UI must remain clean and uncluttered.
- All session management actions (e.g., create, switch, delete) must remain accessible.
  **Definition of Done:**
- Sessions sidebar is removed; sessions are accessible via menu dropdown.
- Playwright test covers session dropdown and switching.
- SonarQube/Problems show no new issues in touched files.

### 4. Update chat UI: show only feedback block for agent responses, remove agent bubble, keep user bubble

**Requirements:**

- For agent responses, display only the feedback block (e.g., critic review, thumbs up/down, etc.).
- Remove the visual agent bubble/avatar for agent responses.
- User messages must retain their bubble/avatar.
- The feedback block must be visually distinct and easy to interact with.
- The UI must remain bright, clean, and minimalistic.
  **Definition of Done:**
- Agent bubble is removed; feedback block is shown for agent responses; user bubble is unchanged.
- Playwright test covers feedback block and bubble visibility.
- SonarQube/Problems show no new issues in touched files.

### 6. Provide real-time model thinking and events to frontend

**Goal:**
Enable the backend to emit detailed "thinking" and event streams (e.g., reasoning steps, tool calls, intermediate plans) so the frontend can display what the model is thinking about in real time, not just a placeholder.

**Requirements:**

- Backend must emit NDJSON "thinking" events with meaningful content during the agent's reasoning phase (not just a generic placeholder).
- Events may include:
  - Model reasoning steps (e.g., chain-of-thought, plan, scratchpad)
  - Tool call traces (e.g., which tools are being considered or invoked)
  - Critic/thinking events (e.g., revise/accept/cap_reached)
  - Any other intermediate state that helps the user understand the agent's process
- Events must be streamed before the final answer so the frontend can render them in the thinking block.
- Ensure no sensitive or internal-only data is leaked in these events.
- Update documentation to describe the event types and their structure.

**Definition of Done:**

- Frontend thinking block displays real-time model reasoning and events (not just a placeholder) when available.
- Playwright test verifies that reasoning/events are surfaced in the UI.
- SonarQube/Problems show no new issues in touched files.
- Documentation updated to cover new event types and usage.

**Requirements:**

- The chat input bar must include controls for agent/model selection and file attachment.
- Controls must be integrated into the input bar, not as separate floating elements.
- The design must remain bright, clean, and minimalistic.
- File attachment must support common file types and show attached files clearly.
- Agent/model selection must be intuitive and accessible.
  **Definition of Done:**
- Input bar integrates agent/model selection and file attachment; design is bright/clean/simplistic.
- Playwright test covers input bar controls and interactions.
- SonarQube/Problems show no new issues in touched files.
