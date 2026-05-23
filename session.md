# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise, and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive: [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-05-23
- **Session:** Hardened Project write tool visibility for onboarding-gated chats.
- **Branch:** `staging`
- **Latest commit before this change:** `8cf8d1b` (`staging fix gate project writes before onboarding`) pushed to `origin/staging`.
- **Current PR:** [#224 staging -> main](https://github.com/jwill9999/agent-platform/pull/224)

## Current State

- `staging` contains the merged webview/runtime work from PR #225.
- A follow-up Promptfoo review commented directly on `visibleToolsForProjectPolicy`, asking for write tools to be hidden until onboarding is approved.
- The prior contract fix already encoded onboarding in `ProjectAccessPolicy`; a local helper hardening now makes that invariant explicit in `chatRouter`.
- The follow-up fix is local and verified; commit and push are next.

## Recent Work

- Updated `apps/api/src/infrastructure/http/v1/chatRouter.ts` so Project chats only expose write tools when `policy.canWrite === true` and no `writeBlockReason` is present. Non-project chats with no Project policy keep existing tool visibility.
- Verified the follow-up locally:
  - `pnpm --filter @agent-platform/api test -- test/sessionChat.integration.test.ts test/projectWorkspaceResolver.test.ts`
  - `pnpm --filter @agent-platform/api typecheck`
  - `pnpm --filter @agent-platform/api lint`
  - `git diff --check`
- Updated `packages/contracts/src/project.ts` so `backend_accessible` Projects can inspect files but cannot write until `onboardingState === 'approved'`.
- Updated API and contract tests to cover blocked pre-approval writes, hidden write tool definitions, onboarding draft creation, and read/write access policy output.
- Rebuilt contracts before API verification so tests used the updated package output.
- Verified locally:
  - `pnpm --filter @agent-platform/contracts test -- test/project.test.ts`
  - `pnpm --filter @agent-platform/api test -- test/sessionChat.integration.test.ts test/projectWorkspaceResolver.test.ts`
  - `pnpm --filter @agent-platform/contracts typecheck`
  - `pnpm --filter @agent-platform/api typecheck`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm format:check`
  - `git diff --check`
  - `pnpm test`
- Added `.sonarcloud.properties` so SonarCloud automatic analysis receives CPD exclusions for intentionally repetitive test and E2E files.
- Fixed the SonarCloud React bug in `WorkspaceDashboard` by storing `previous` execution policy state before optimistic update rollback.
- Fixed CI-only Git fixture failures in `apps/api/test/projectsRouter.test.ts` by setting bare remote `HEAD` to `refs/heads/main` before cloning.

## Next

1. Commit and push the `visibleToolsForProjectPolicy` hardening to `origin/staging`.
2. If `verify` fails again, inspect the new GitHub Actions log before changing code.
3. If SonarCloud still fails duplication, confirm whether `.sonarcloud.properties` was picked up by automatic analysis; if not, move exclusions into the SonarCloud UI or switch PR analysis to scanner-based CI.
4. If all checks pass, keep `session.md` short by updating this file in place and moving any older detail into `session-archive-2026-05.md`.
