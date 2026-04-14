# Task: MVP E2E: automated happy path + CI job

**Beads issue:** `agent-platform-o36.1`  
**Spec file:** `docs/tasks/agent-platform-o36.1.md` (this file)  
**Parent epic:** `agent-platform-o36` — Epic: MVP E2E — filesystem MCP + default agent path

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-o36.1.md`

## Task requirements

### From Beads (description)

Playwright or scripted E2E against compose: skill + filesystem MCP + specialist agent + chat turn; assert tool_result; default agent smoke; run in CI with services profile.

### From Beads (acceptance criteria)

E2E green locally and in CI; artifacts on failure; documented env for CI secrets (placeholders).

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-ast.3` | [Frontend: configuration UI (skills, MCP, agents, plugins, models)](./agent-platform-ast.3.md) |
| `agent-platform-dx3.2` | [Planner+Plugins: LLM planner JSON + validation + repair](./agent-platform-dx3.2.md) |
| `agent-platform-dx3.4` | [Planner+Plugins: session memory + plugin resolution (global → user → agent)](./agent-platform-dx3.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-o36.2` | [MVP E2E: operator docs + Docker runbook](./agent-platform-o36.2.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

### Implementation notes (2026-04-14)

- **Compose profile `services`:** `docker compose --profile services up` runs API + web (`Dockerfile.web`, Next `standalone`).
- **E2E seed:** `E2E_SEED=1` runs `runE2eSeed` after base seed — MCP **`e2e-fs`** (stdio filesystem server → `/workspace`), skill **`e2e-skill`**, specialist **`e2e-specialist`** (`packages/db/src/seed/e2eSeed.ts`).
- **Playwright** (`e2e/mvp-e2e.spec.ts`): API health + default agent + E2E registry rows + home chat smoke + **`/e2e/verify`** asserts **`tool_result`** in the DOM (full harness+MCP chat stream is still a future wiring; registry rows document the intended MCP path).
- **CI:** `.github/workflows/ci.yml` job **`e2e`** — compose, E2E seed, `pnpm test:e2e`, Playwright report artifact on failure.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-o36.1`** from **`feature/<feature-name>`** (chained Git):  
   `git fetch origin && git checkout feature/<feature-name> && git pull` then `git checkout -b task/agent-platform-o36.1`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-o36.1` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-o36.1`** to `origin`. **Do not** PR to `feature/<feature-name>` yet. The next task in this segment branches from **`task/agent-platform-o36.1`**.

## Git workflow (mandatory)

**Segment:** MVP E2E (o36.1–o36.2). **Chained branches:** first task in segment from `feature/<feature-name>`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-o36.2`** → `feature/<feature-name>`.

| | |
|---|---|
| **Parent for this branch** | **`feature/<feature-name>`** |
| **This task’s branch** | **`task/agent-platform-o36.1`** |
| **Segment tip (opens PR to `feature/<feature-name>`)** | **`task/agent-platform-o36.2`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-o36.2`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-o36.1`** from **`feature/<feature-name>`**. |
| **Intermediate tasks** | Push **`task/agent-platform-o36.1`**; next task checks out from **`task/agent-platform-o36.1`** (or from remote `origin/task/agent-platform-o36.1`). |
| **Segment tip** | One PR **`task/agent-platform-o36.2` → `feature/<feature-name>`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/<feature-name>`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [x] Beads **description** and **acceptance_criteria** satisfied.
- [x] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [x] All **upstream** Beads issues are **closed** (per Beads).
- [x] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [x] **Branch** **`task/agent-platform-o36.1`** pushed; next task branches from here (**no** PR to `feature/<feature-name>` until **`task/agent-platform-o36.2`**)
- [x] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-o36.1`** and tests are green (PR to `feature` only at segment tip).

- [x] **Task branch** **`task/agent-platform-o36.1`** created from **`feature/<feature-name>`** before implementation
- [x] **Unit tests** executed and passing (minimum gate)
- [x] **Checklists** in this document (Definition of done + Sign-off) are complete
- [x] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-o36.2`**
- [x] `bd close agent-platform-o36.1` — done (see Beads history)
- [x] `decisions.md` updated only if architectural decision changed
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
