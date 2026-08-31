# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise,
and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive:
  [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-08-31
- **Session:** Completed workflow-control tasks `.1`–`.3`; durable broker persistence is ready.
- **Branch:** `task/agent-platform-multi-agent.3`
- **Base:** `feature/multi-agent-orchestration` at merged `staging` tip `6b63ea5`.
- **Head:** `edbf2dc` completes `.3`; task-chain push/close is pending final evidence commit.
- **Pull request:** Planning PR #251 is merged; the cumulative task PR opens only from `.10`.

## What Happened

- Completed `.1`: versioned execution contracts, normative lifecycle/state machine, cancellation,
  recovery, retry, repair, finalization, dependency and task-packet containment.
- Completed `.2`: process-bound authorization, deterministic audited denial, approval revalidation,
  minimal-profile specialist launcher, and a real malicious-specialist Docker isolation proof.
- Completed `.3`: SQLite migrations, CAS/fenced leases, transition/external-effect sagas, retry/wait
  state, findings, content-addressed evidence, restart reconciliation, CLI, and read-only stdio MCP.
- Added a concrete workspace-pinned official Beads/Dolt adapter. Active-run claim, close, and Dolt push
  are journaled and operation-restricted; no direct write subprocess exists in workflow control.
- SonarQube project lookup succeeds, but per-file analysis still times out during server startup. The
  documented fallback gates pass with no errors.

## Verification

- `pnpm exec prettier --check packages/workflow-control docs/workflow-control-persistence.md`
- `pnpm docs:lint`
- `pnpm deps:check-cycles`
- `git diff --check`
- `@agent-platform/workflow-control` lint, build, typecheck, 77 unit tests, and one real Docker
  isolation integration test pass.

## Current State

- Epic `agent-platform-multi-agent` remains open. `.1` and `.2` are closed and pushed; `.3` is ready
  for its evidence commit, push, Beads close, and Dolt sync.
- The current cumulative branch is `task/agent-platform-multi-agent.3`; `.4` becomes ready after `.3`
  closes and must branch from this tip.
- Contracts, isolation, authorization, persistence, artifacts, and Beads/Dolt brokerage are present.
  Git/ref and GitHub brokers begin in `.5` and `.6`; autonomous delivery remains disabled meanwhile.
- Sonar hotspot `AZ4YM2i11EaT2bQAPFS4` is `REVIEWED / FIXED`; zero hotspots remain to review.

## Next

1. Commit/push `.3` evidence, close/sync it in Beads, then create `.4` from the `.3` tip.
2. Implement `.4` planning, independent critic, approval, and version-invalidation gate.
3. Continue the linear `.5`–`.10` chain, running exact-head gates at every task boundary.
4. Open the single cumulative task-tip PR to `feature/multi-agent-orchestration` only after `.10`.
