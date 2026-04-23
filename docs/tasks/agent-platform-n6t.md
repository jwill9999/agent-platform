# Task: Docs-as-record CI + ADR pattern + de-dup AGENTS/CLAUDE/copilot-instructions

**Beads issue:** `agent-platform-n6t`
**Spec file:** `docs/tasks/agent-platform-n6t.md` (this file)
**Parent epic:** `agent-platform-d87` — [Tier 1 gap remediation](./agent-platform-d87.md)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-n6t.md`

## Source gaps

- `docs/planning/gap-analysis.md` codex review items #2, #8, #9 — no docs CI gate, no ADR pattern, ~80 lines duplicated across `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`.

## Task requirements

After this task:

1. Pull requests touching markdown fail CI when markdown lint fails or links are broken.
2. There is an ADR template under `docs/adr/` and at least one ADR (this consolidation) has been recorded.
3. The shared content currently duplicated across the three agent-instruction files lives in **one** canonical doc; each of the three becomes a thin wrapper that **transcludes** the shared content (or, if transclusion isn't supported in the consumer, links to it with a tight summary).

### Concrete deliverables

- `docs/adr/0000-template.md` — ADR template (Context / Decision / Consequences / Status).
- `docs/adr/0001-tier1-gap-remediation.md` — first ADR, recording the evaluator + DoD + observability + docs-CI decisions from this epic.
- `docs/adr/README.md` — index + numbering rules + status states.
- `docs/agent-instructions-shared.md` — single source of truth for: commands, architecture, conventions, env vars, key decisions, shell rules, completion-gate policy.
- `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` — reduced to a tool-specific preamble (≤ ~30 lines each) plus a clearly delimited region that references / includes `docs/agent-instructions-shared.md`.
- CI workflow `.github/workflows/docs-ci.yml`:
  - `markdownlint-cli2` over `**/*.md` (config in `.markdownlint-cli2.jsonc`, exclusions for vendored content).
  - `lychee` link check over `**/*.md` (config in `lychee.toml`, ignore `localhost`, mailto, and known transient hosts).
  - Triggered on `pull_request` for paths `**/*.md`, `docs/**`, `.github/workflows/docs-ci.yml`.
- Pre-commit-friendly local script: `pnpm docs:lint` (added to root `package.json` `scripts`).
- Update `decisions.md` with a row pointing to `docs/adr/0001-...md`.

### Out of scope

- Auto-generation of CHANGELOG / release notes.
- Migrating historical task specs to a new format.
- Translating shared content for non-English locales.

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                                           |
| -------------------- | -------------------------------------------------------------- |
| `agent-platform-2v6` | [Agent-queryable observability tools](./agent-platform-2v6.md) |

### Downstream — waiting on this task

| Issue                | Spec |
| -------------------- | ---- |
| _none — segment tip_ | —    |

## Implementation plan

1. Create branch **`task/agent-platform-n6t`** from **`task/agent-platform-2v6`**.
2. Add `docs/adr/README.md` and `docs/adr/0000-template.md`.
3. Author `docs/adr/0001-tier1-gap-remediation.md` summarising the four decisions made in this epic; cross-link the three feature specs.
4. Diff the three agent-instruction files; extract the duplicated content into `docs/agent-instructions-shared.md`. Aim for ≥ 80% reduction in duplicated lines.
5. Rewrite `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`:
   - Keep only the tool-specific preamble each tool needs (e.g. Copilot's tool-call syntax).
   - Append a `## Shared agent instructions` section that says "see `docs/agent-instructions-shared.md`" and lists the headings it covers.
   - Preserve the existing **SonarQube / Problems Completion Gate** policy in the shared doc, not in the per-tool wrappers.
6. Add `.markdownlint-cli2.jsonc` and `lychee.toml`. Pick a strict-but-pragmatic ruleset (allow long lines in tables; disallow bare URLs).
7. Add `.github/workflows/docs-ci.yml`:
   - Job `lint` → `pnpm dlx markdownlint-cli2 "**/*.md" "#node_modules" "#dist"`.
   - Job `links` → `lychee --config lychee.toml --no-progress "**/*.md"`.
   - Both required-to-pass; cache the lychee link DB for speed.
8. Add `pnpm docs:lint` script wiring both checks for local use.
9. Run both tools locally; fix any pre-existing violations introduced into now-CI-watched files (limit scope: don't refactor unrelated docs).
10. Update `decisions.md` and the project README pointer (if any) to reference `docs/adr/`.
11. Push branch. **Open the segment PR `task/agent-platform-n6t → feature/agent-platform-d87`.**
12. After PR is merged, the epic owner opens **`feature/agent-platform-d87 → main`** to release the segment.

## Git workflow (mandatory)

|                            |                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Parent for this branch** | **`task/agent-platform-2v6`**                                                                         |
| **This task's branch**     | **`task/agent-platform-n6t`**                                                                         |
| **Segment tip?**           | **Yes** — open one PR `task/agent-platform-n6t → feature/agent-platform-d87` to land the whole chain. |

## Tests (required before sign-off)

- **CI dry-run locally:** `pnpm docs:lint` passes on the branch.
- **Workflow:** `.github/workflows/docs-ci.yml` runs green on the PR.
- **Manual verification:** the three agent-instruction files render correctly when their consumer reads them (spot-check `cat AGENTS.md` and confirm the shared region is unambiguous).
- **No code-test regressions:** `pnpm typecheck && pnpm lint && pnpm test` still green (no production code changed, but lint config touches root).

## Definition of done

- [ ] `docs/adr/0000-template.md`, `docs/adr/0001-tier1-gap-remediation.md`, `docs/adr/README.md` exist and are linked from `decisions.md`.
- [ ] `docs/agent-instructions-shared.md` exists; covers commands, architecture, conventions, env vars, decisions, shell rules, completion-gate policy.
- [ ] `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` reduced to thin wrappers (≥ 80% duplicate-line reduction across the three).
- [ ] `.github/workflows/docs-ci.yml`, `.markdownlint-cli2.jsonc`, `lychee.toml` committed.
- [ ] `pnpm docs:lint` script added and passes locally.
- [ ] CI workflow runs green on the PR.
- [ ] `decisions.md` updated with ADR pointer.
- [ ] PR `task/agent-platform-n6t → feature/agent-platform-d87` merged.

## Sign-off

- [ ] **Task branch** created from **`task/agent-platform-2v6`**
- [ ] **`pnpm docs:lint`** executed and passing
- [ ] **Checklists** complete
- [ ] **Segment PR** merged: `task/agent-platform-n6t → feature/agent-platform-d87` (link: ****\_\_****)
- [ ] `bd close agent-platform-n6t --reason "Docs CI + ADR pattern + agent-instructions de-duplicated"`
- [ ] Epic owner opens release PR `feature/agent-platform-d87 → main`

**Reviewer / owner:** **********\_********** **Date:** ******\_******
