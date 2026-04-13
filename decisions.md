# Agent Platform — decision log

Single source of truth for **architectural and product decisions** agreed with the project owner.  
**Task execution** is tracked in **bd (beads)**; this file does not replace issue tracking.

---

## Session continuity

- **`session.md`** — short narrative of last session, current focus, and next steps (update at end of each agent session when work stops).
- **`AGENTS.md`** — project rules for agents (includes bd workflow).
- **`docs/tasks/README.md`** — task workflow: **each Beads task** links to **`docs/tasks/<issue-id>.md`** (requirements, implementation plan, dependency tables, definition of done, sign-off). **Beads `blocks` edges** are the schedule of record; specs document the same order and capture planning-only dependencies.

---

## Thinking stream (MVP recommendation)

**What it is:** A separate channel in the chat stream for **model reasoning** (sometimes exposed by providers as “reasoning tokens”, “thinking”, or extended chain-of-thought). The UI can show it collapsed, behind a toggle, or in a secondary panel so it does not clutter the main answer.

**MVP approach:**

1. Define a stream event type (e.g. `thinking`) in shared contracts alongside `text`, `code`, `tool_result`, `error`.
2. **When the provider supports** exposing reasoning/thinking, map it into that channel.
3. **When it does not**, omit the channel (no fake thinking).
4. Add a **user preference** (e.g. show/hide thinking) in settings when the UI lands.

This keeps one protocol for all providers without hardcoding a single OpenAI model name.

---

## Plugin resolution (MVP)

Effective configuration is resolved in order:

1. **Global plugin catalog** — core plugins (e.g. memory, observability) registered as available.
2. **User-level defaults** — which implementation is active when not overridden.
3. **Per-agent policy** — allowlist/denylist (or explicit plugin list) on a persisted agent so specialists can differ.

Plugins **cannot** bypass harness validation or tool allowlists.

---

## Locked decisions (authoritative)

| Area | Decision |
|------|----------|
| **Users / auth** | Single user, local-only; no multi-tenant product requirement. |
| **Deployment** | **Docker** (Dockerfile + **Docker Compose** preferred for MVP). App runs locally; optional extra services (e.g. Postgres) added as separate compose services later. |
| **Database (MVP)** | **SQLite** on a **Docker volume**. Optional later: **Postgres** (or other) as an expansion path—may be presented as “plug-in” or compose profile when you implement it. |
| **Secrets** | Support **storing secrets** (LLM API keys, MCP server keys, etc.) with **encryption at rest**; never log secret material. |
| **Model router** | **OpenAI first** in the UI and router implementation; design the interface so **provider + model id + API key** can be supplied for the **default** agent and for specialists. **No hardcoded single model id**—user-configurable model string for MVP. Later: additional providers behind the same abstraction. |
| **Filesystem / MCP** | **Core default agent** must be able to use the **filesystem** via **MCP**. Running in Docker, the **container filesystem** is the boundary—no access to the host OS except what is explicitly **mounted** into the container (document mounts in compose). |
| **MCP** | Standard MCP; users supply **API keys when a server requires them**. |
| **Tests** | Before a task is considered done: **unit tests** and **E2E tests** as **required** for that task’s scope (no blanket boilerplate—each bd issue should state what tests apply). **Minimum before sign-off:** unit tests run and pass for the code touched by the task. |
| **Git / branches** | **Naming:** integration branches are **`feature/<feature-name>`** (the feature’s name after `feature/`). Task branches are **`task/<task-name>`** (the task’s name after `task/`). **No direct commits to `main`.** Create the **task** branch **before** starting work; open a **PR** from **`task/<task-name>` → `feature/<feature-name>`**; merge there, then delete the task branch. When **all** tasks for that feature are merged on **`feature/<feature-name>`**, open **one** PR **`feature/<feature-name>` → `main`**. *Example (Agent Platform MVP):* `feature/agent-platform-mvp` and `task/agent-platform-mov.1`. Documentation-only changes follow the same rule. |
| **Token budget** | Use tokens minimally; if the budget is exhausted, the owner decides whether to increase it. |

**Bootstrap (once):** create and push **`feature/<feature-name>`** from `main` without changing `main` (substitute the real feature name, e.g. `git checkout -b feature/agent-platform-mvp && git push -u origin feature/agent-platform-mvp`). All **task** branches are cut from the **latest** matching **`feature/<feature-name>`**.

---

## Definition of Done (default for bd issues)

Unless an issue states otherwise, **done** means:

1. **Acceptance criteria** in the issue are met.
2. **This task’s spec checklist** in `docs/tasks/<issue-id>.md` is **fully checked** (including Git workflow and tests).
3. **Tests:** **Unit tests** run and pass at minimum; **E2E** (or integration) tests when the change crosses API, DB, or Docker boundaries.
4. **Quality:** typecheck passes; linters clean for touched files.
5. **Git:** work merged via **PR** from **`task/<task-name>` → `feature/<feature-name>`** (not direct to `main`). Task branch created before implementation started.
6. **Documentation:** `decisions.md` updated if a **new** architectural decision was made; `session.md` updated at session end.
7. **Tracking:** issue **closed** in bd with a short reason **after** PR merge and checklist completion; discovered follow-ups filed as new issues.

---

## References

- `agent_architecture_detailed_adr.md`
- `agent_architecture_full_with_frontend.md`
- `agent_platform_mvp_be346e14.plan.md`
