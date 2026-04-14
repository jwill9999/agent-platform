# Frontend UI — paused roadmap (planning before `agent-platform-ntf`)

**Status:** Paused for reflection and **planning** before implementing Beads **`agent-platform-ntf`** (_Frontend: design polish (visual/UI follow-up)_).

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
