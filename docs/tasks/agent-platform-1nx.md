# Task: Documentation restructure — README as index

**Beads issue:** `agent-platform-1nx`  
**Spec file:** `docs/tasks/agent-platform-1nx.md` (this file)  
**Parent epic:** Documentation

## Task requirements

Restructure the project documentation so `README.md` is an index linking to focused pages under `docs/`. Create dedicated documentation pages for architecture, API, database, development setup, deployment, and configuration. Ensure each doc page is self-contained and maintainable.

### Current state

- `README.md` has basic commands and some architecture info
- Various `.md` files in root: `AGENTS.md`, `CONTRIBUTING.md`, `decisions.md`
- `docs/` directory exists but mostly contains task specs
- Architecture decisions spread across `decisions.md`, ADR files, and session notes

### Target state

- `README.md` is a concise landing page with table of contents linking to docs
- `docs/architecture.md` — system architecture, data flow, package roles
- `docs/api-reference.md` — REST API endpoints, error shapes (supplements OpenAPI spec)
- `docs/database.md` — schema overview, migration guide, secret storage
- `docs/development.md` — local setup, build, test, lint commands
- `docs/deployment.md` — Docker, environment variables, production guidance
- `docs/configuration.md` — model routing, MCP servers, agent setup
- `docs/plugin-guide.md` — stub (detailed content is `agent-platform-vla`)
- Existing files (`AGENTS.md`, `CONTRIBUTING.md`, `decisions.md`) remain in root

## Dependency order

### Upstream — must be complete before this task

None — this is an independent documentation task.

### Downstream — waiting on this task

| Issue                | Spec                                              |
| -------------------- | ------------------------------------------------- |
| `agent-platform-vla` | [Plugin authoring guide](./agent-platform-vla.md) |

The plugin authoring guide builds on the docs structure.

## Implementation plan

### Step 1: Create docs/architecture.md

Extract architecture content from `README.md`, `AGENTS.md`, and ADR files into a focused page:

- System overview diagram (ASCII)
- Package dependency graph
- Data flow (chat → BFF → API → harness → LLM)
- Clean architecture layers in API

### Step 2: Create docs/api-reference.md

- Link to Swagger UI (`/api-docs`)
- List all `/v1/*` endpoints with brief descriptions
- Error response shape documentation
- Rate limiting info (if implemented)

### Step 3: Create docs/database.md

- Schema overview (tables, relationships)
- Migration guide (how to add new migrations)
- Secret storage (AES-256-GCM, key_version)
- SQLite considerations and Postgres expansion path

### Step 4: Create docs/development.md

Move development commands from README:

- Prerequisites (Node.js, pnpm, Docker)
- Install, build, test, lint commands
- Running locally (API + Web)
- Seed data
- Debugging tips

### Step 5: Create docs/deployment.md

- Docker setup (docker-compose.yml explanation)
- Environment variables reference
- Volume mounts
- Production checklist

### Step 6: Create docs/configuration.md

- Model routing setup (provider + model + API key)
- MCP server configuration
- Agent configuration
- Skill/tool management

### Step 7: Refactor README.md

Replace detailed content with:

- Project overview (2-3 sentences)
- Quick start (5-line version)
- Table of contents linking to each docs page
- Badge links (CI, quality gate)

### Step 8: Create docs/plugin-guide.md (stub)

Placeholder page with "Coming soon" and link to `agent-platform-vla` task. This gives the URL a home before the full guide is written.

## Git workflow (mandatory)

| Rule                 | Detail                                                          |
| -------------------- | --------------------------------------------------------------- |
| **Feature branch**   | `feature/documentation`                                         |
| **Task branch**      | `task/agent-platform-1nx` (branch from `feature/documentation`) |
| **Segment position** | First task in segment                                           |

## Tests (required before sign-off)

- **Unit:** None required (docs-only change)
- **Validation:** All internal links resolve, no broken references
- **Build:** `pnpm build` still passes (no code changes)

## Acceptance criteria

1. README.md is a concise index page
2. At least 6 focused docs pages created under `docs/`
3. All internal links between docs resolve correctly
4. No content lost — existing info moved, not deleted
5. Existing files (`AGENTS.md`, `CONTRIBUTING.md`, `decisions.md`) unchanged

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] No broken links in documentation
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from `feature/documentation`
- [ ] **Link validation** passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-1nx --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
