# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise,
and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive:
  [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads
  tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-06-18
- **Session:** Integrated Madge circular dependency detection (pnpm script, Husky pre-push, GitHub Actions CI); enhanced API review specialist agent.
- **Branch:** `jwill9999/project-experience-capability-metadata`
- **Base:** current branch tracks `origin/jwill9999/project-experience-capability-metadata` (3 commits, all pushed)

## Current State

**Madge Circular Dependency Integration:**

- ✅ Madge v8.0.0 installed as devDependency (resolved v7.3.1 unavailability)
- ✅ pnpm scripts: `deps:check-cycles`, `deps:visualize` with tsconfig path alias resolution
- ✅ Makefile target: `make deps:check-cycles`
- ✅ Husky pre-push hook: runs madge check early with fail-fast behavior
- ✅ GitHub Actions workflow: `.github/workflows/check-cycles.yml` (PR trigger)
- ✅ Verification: **0 circular dependencies found** (1140 files scanned, 72 skipped warnings = acceptable unresolved imports)

**Agent Review Specialist Enhancement:**

- ✅ 15 scope areas with locked decision references (API surface, execution modes, security guards, harness runtime, data layer, plugin system, observability, streaming, MCP adapter, model router, contracts, planner, agent validation, skill loading, frontend integration)
- ✅ Non-scope clarity (frontend, native Electron, CI/CD unless test-related, docs-only)
- ✅ DoD checklist now requires: `pnpm deps:check-cycles` passing

**Changes Committed & Pushed:**

- `.github/agents/api-review-specialist.agent.md`: Enhanced scope table, locked decisions, execution modes, security guards, Beads integration
- `.github/workflows/check-cycles.yml`: New GitHub Actions PR workflow
- `.husky/pre-push`: Integrated madge circular dependency check
- `Makefile`: Added deps:check-cycles target
- `package.json`: Added madge devDependency, pnpm scripts
- Unrelated local change present and intentionally left untouched:
  `.github/agents/api-review-specialist.agent.md`.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. **Monitor PR #236** (`Define workspace capability metadata`): Verify circular dep checks pass in CI.
2. **Optional:** Install Graphviz locally if dependency graph visualization is useful (`brew install graphviz`, then `pnpm deps:visualize` to generate `deps-graph.svg`).
3. **Optional:** Add `--exclude` rules to madge to suppress known unresolved import warnings (non-blocking, nice-to-have).
4. **Follow-up Epic:** Consider expanding API review agent integration into pre-commit lint checks or IDE extensions.
