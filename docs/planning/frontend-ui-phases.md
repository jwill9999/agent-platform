# Frontend UI — phased roadmap

**Status:** Unblocked (2026-04-20). Ready for implementation. The phased approach below still applies as guidance.

**Purpose:** Durable note for humans and agents when returning to this work. **Execution** still lives in **bd**; split or refine **`ntf`** after planning if scope grows.

---

## Agreed sequence (next phases)

1. **Reflection / pause** — No UI implementation sprint until direction is clearer.
2. **Design planning** — Decide how frontend designs will be produced (sources, ownership, design system vs one-off screens, accessibility targets). Align with product intent (e.g. chat vs settings emphasis).
3. **Review phase** — Review **current shipped** UI and behavior against that plan (what matches, what diverges).
4. **User testing** — Run structured tests or sessions; capture feedback.
5. **Backlog from learnings** — Create or update **Beads** issues: bugs, polish, **new features** on top of the MVP. May supersede or decompose **`agent-platform-ntf`** into smaller tickets.

---

## Beads

- **Open backlog item (umbrella):** `agent-platform-ntf` — treat as **post-planning** implementation unless explicitly re-scoped.

---

## Cursor: design-related capabilities and limitations

**What Cursor is**

- A **code editor** (VS Code–based) plus **AI assistance** (Chat, Composer, Agent) that works **on your repository** and tools you connect (terminal, MCP servers, etc.).
- It does **not** ship a dedicated visual design tool (no Figma replacement inside the app).

**What works well**

- **Implementing UI in code** from a written brief, component library, or existing patterns in the repo.
- **Iterating** on layout, copy, and component structure in **`apps/web`** with you in the loop.
- **Figma (or FigJam)** when you enable the **Figma MCP** and share a **file URL**: the agent can request **design context** (including code-oriented snippets and **screenshots** as reference). That supports **design-to-code** alignment, not a guarantee of pixel-perfect match without your review.
- **Accessibility and consistency** checks when you define tokens, patterns, or acceptance criteria.

**Limitations**

- **No automatic “sync”** from Figma to production code; output is **assisted implementation**, always reviewable.
- **No persistent “memory”** across sessions unless you **save** decisions in repo files (e.g. this doc, **`decisions.md`**, **`session.md`**) or issue trackers (**bd**).
- **Visuals** are only as good as **inputs**: Figma links, screenshots, exported assets, or clear written specs. The agent does not browse your private design tools without a link or attachment.
- **Brand and taste** remain **yours**; the AI suggests implementations that you approve.

**Practical tip for this project**

- Prefer **Figma links + notes** for key screens, and keep **one** planning doc or bd issue updated so returning sessions pick up the same direction.

---

## Frontend data principles

### API is the single source of truth

The frontend must **never hardcode** default values, labels, or configuration that the backend owns. All display values should be fetched from the API at runtime.

**Key examples:**

| Data              | API source                               | Frontend rule                                                                                                         |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Agent model       | `GET /v1/agents/:id` → `modelOverride`   | If `null`, fetch platform default from `GET /v1/settings` and display it. Never hardcode a model name.                |
| Context window    | `GET /v1/agents/:id` → `contextWindow`   | If absent, show "Default (8000 tokens, truncate)" — but fetch the actual default from the API, not a hardcoded value. |
| Execution limits  | `GET /v1/agents/:id` → `executionLimits` | Always display what the API returns.                                                                                  |
| Platform settings | `GET /v1/settings`                       | Source for all platform-wide defaults (rate limits, cost budgets, default model).                                     |

**Why:** Backend defaults can change across releases (e.g. token budget, model name, strategy). If the frontend hardcodes these, the UI will show stale values after a backend update — creating user confusion and bugs.

**Pattern:** When a field is optional/null on an agent, the frontend should either:

1. Fetch the platform-level default from `/v1/settings` and display it with a "(default)" label, or
2. Show "Not configured — using platform default" and link to the settings page.
