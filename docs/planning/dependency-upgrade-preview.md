# Major dependency upgrade impact preview — local MVP

Planning only,19October2026; refreshed 26 October 2026 after PR373 review (action revisions,
PR369 slice and rollback boundaries). Beads: `agent-platform-dependency-upgrade-preview`, child of
[dependency security](../tasks/agent-platform-dependency-security.md). Owner requested a preview
before choosing major updates; this does not authorize implementation or dependency merges.

## Baseline and objective

Protected staging `be153c50019b0dd28b6105cf2f48a961ac16ed8f` is canonical. Current owner app may be
older while SDK profile migration (`agent-platform-sdk-legacy-migration`) is qualified;
that ongoing work retains first delivery priority. This preview can be prepared in parallel and
informs the next owner discussion, rather than inserting a new dependency into that repair.
The migration spec is currently on its separate task branch, not yet in this preview's staging base.

- UP-R1: compare resolved staging versions and pinned action revisions with actual proposals;
  separate obsolete/minimum-fix recommendations from candidate supported targets.
- UP-R2: use official support/security/migration sources to rank risk, scope and effort. Label
  inference and uncertainty; a major label alone is neither proof of danger nor a reason to merge.
- UP-R3: propose independent reversible slices, source boundaries, useful regressions and recovery
  checkpoints preserving existing profile/key/model settings, Stop, approvals, tool fences and
  diagnostic recording/export/restart. No bundle of unrelated runtime/frontend/test majors.
- UP-R4: distinct critic reviews the preview; present alternatives and material decisions to owner
  before any major upgrade. Beads owns scheduling; source-linked records remain canonical.

Excluded: dependency installation, package/lock edits, app/Docker restarts, credential/global changes,
automatic merges, main promotion, paid models, Notion publication, paused orchestration/PR283 edits,
new distribution architecture or a new model protocol/framework. Existing security advisory debt stays
in the parent; this review creates no duplicate vulnerability tickets.

## Preliminary impact matrix

Targets are researched proposals, not accepted versions. Refresh immediately before implementation.
Estimates are engineering ranges, excluding hosted queues/review and unexpected regressions.

| Slice           | Actual staging → candidate  | Recommendation and source impact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Initial estimate               |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Electron        | 42.11.15 →44.9.0            | First runtime support review:42 EOL20October per vendor schedule. Compare43 as a shorter supported alternative (EOL5January2027). Review cumulative breaking changes, native modules, preload/IPC, terminal, WebContentsView permissions, Keychain and packaging/signing.44 requires macOS13+.                                                                                                                                                                                                                                        | 1–3 days                       |
| Next            | 15.5.28 →16.4.2             | Separate frontend migration. Policy says two years from21October2024 for15;21October2026 is an inferred approaching boundary, while current table still lists15 MaintenanceLTS. Reconfirm with vendor. Remove obsolete eslint.ignoreDuringBuilds config; explicitly choose retaining Webpack (--webpack) or qualifying default Turbopack for existing plain dev/build commands. Audit async request/route APIs, monorepo tracing/standalone Docker and desktop renderer packaging; defer optional Cache Components/Compiler adoption. | 1–3 days                       |
| AI SDK          | 7.0.143 already staged      | Old4.3.19→5.0.52 minimum-fix proposal is obsolete for staging. Never downgrade/re-run old migration. Keep the delivered maintained provider cohort and current profile repair separate.                                                                                                                                                                                                                                                                                                                                               | No old-proposal implementation |
| Setup Node      | Pinned4.4.0 →7.1.0 (PR369)  | Isolated CI change across 12 uses in five workflows; see [PR369 slice](#pr369-setup-node-slice). Node 24 action runtime needs runner 2.327.1+; v6 limits automatic caching to npm; v7 is ESM and stops exporting a dummy `NODE_AUTH_TOKEN`.                                                                                                                                                                                                                                                                                           | ½–1 day                        |
| Upload Artifact | Pinned4.6.2 →7.0.2 proposal | Isolated CI change. Verify exact current target release/SHA and Node24 runner minimum2.327.1. Preserve zipped output, artifact names/retention/privacy and all downloaded digest/member/source/run proofs; do not enable optional unzipped transport incidentally.                                                                                                                                                                                                                                                                    | ½–1 day                        |
| Cache           | Floatingv4 →v6 proposal     | Isolated docs-CI maintenance. Verify exact target/SHA and runner compatibility; preserve keys, miss/partial-hit installation and prove real hit/miss. ESM action internals do not imply application migration.                                                                                                                                                                                                                                                                                                                        | ¼–½ day                        |

Electron42's published EOL (20October) and the inferred Next15 boundary (21October) have now
passed. Both need vendor reconfirmation before the owner decision; this refresh did not re-verify them.

Sources: [Electron schedule](https://releases.electronjs.org/schedule),
[44 release](https://www.electronjs.org/blog/electron-44-0),
[Next support](https://nextjs.org/support-policy),
[Next16 migration](https://nextjs.org/docs/app/guides/upgrading/version-16),
[Upload Artifact](https://github.com/actions/upload-artifact),
[Cache](https://github.com/actions/cache), [SDK migration](https://ai-sdk.dev/docs/migration-guides),
[Setup Node releases](https://github.com/actions/setup-node/releases).

## Action revisions

Verified 26 October 2026 against staging `d59e392ce58ac51b4580d2fdef72f258268f2469` with
`git ls-remote` on each action repository. Floating tags can move; pin the reviewed SHA when
implementing.

| Action                    | Current staging ref (uses)                                                     | Proposal (head; base)                                         | Proposed target                                                                 |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `actions/setup-node`      | `49933ea5288caeca8642d1e84afbd3f7d6820020` = v4.4.0 (10); floating `@v4` (2)   | PR369 open (`348de82a`; staging `d59e392c`)                   | `949feb2413d6458794dcd2491c4babbbce0c15c1` = v7.1.0; 2 uses left floating `@v7` |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` = v4.6.2 (15)                       | PR354 closed unmerged 18 Oct (`aca8c330`; staging `ece78d8a`) | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` = v7.0.2                             |
| `actions/cache`           | floating `@v4` (1, docs-ci) = `0057852bfaa89a56745cba8c7296529d2fc39830` today | PR353 closed unmerged 18 Oct (`7bfe08cc`; staging `ece78d8a`) | floating `@v6` = `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (v6.1.0) today      |
| `pnpm/action-setup`       | `f40ffcd9367d9f12939873eb1018b921a783ffaa` (7)                                 | PR368 open                                                    | `b906affcce14559ad1aafd4ab0e942779e9f58b1`                                      |

PR353 and PR354 are closed, so the Upload Artifact and Cache rows assess those recorded heads only.
A fresh proposal must be re-identified against this table before implementation.

## Other current Dependabot proposals

- PR368 updates pnpm/action-setup's pinned v4 source, not pnpm's package-manager major; the proposed
  commit reverts its Node24 action-runtime migration. Diagnose actual failed VM result before approval.
- PR369 setup-node4→7: see [PR369 slice](#pr369-setup-node-slice); no green summary alone qualifies it.
- PR370 (closed 26 October, superseded by the 29-update group PR382)'s28-update group includes Playwright1.59→1.64, React19.2→19.3 and types/supertest6→7. Its
  compatible label does not prove all changes safe. Dependency Review reported inventory mismatch,
  not a confirmed high-severity advisory finding. Diagnose and consider smaller groups (2–4 days).
- PR371 Vitest4.1.12→5.0.5 needs a separate test-infrastructure plan (1–2 days), preserving all
  assertions/deadlines and ordinary/fresh-benchmark separation. Review mock clearing/hoisting/APIs.
- PR372 SQLite types7.6.13→9.6.0 leaves actual better-sqlite3 runtime13.0.3 unchanged (½–1 day).
  Qualify types, DB/API/migrations and applicable native checks.

PR371/372 touch paused-package manifests. Existing permission for earlier exact test-only repairs
is not blanket permission for these proposals. Exclude or obtain a narrow owner disposition before
any such change; do not resume runtime/PR283. Actual PR statuses are dated observations, not future
qualification. All remain proposals, staging-targeted, no automerge.

## PR369 setup-node slice

Proposal: PR369 head `348de82a`, rebased on staging `d59e392c`; changes all 12 `setup-node` uses.

| Workflow                  | Uses | Node | Cache input | Runner                           |
| ------------------------- | ---- | ---- | ----------- | -------------------------------- |
| `ci.yml`                  | 5    | 24   | `pnpm`      | ubuntu-latest; self-hosted macOS |
| `dependency-security.yml` | 3    | 24   | none        | ubuntu-latest                    |
| `promptfoo-code-scan.yml` | 2    | 24   | none        | ubuntu-latest                    |
| `check-cycles.yml`        | 1    | 24   | `pnpm`      | ubuntu-latest (floating `@v4`)   |
| `docs-ci.yml`             | 1    | 24   | none        | ubuntu-latest (floating `@v4`)   |

Impact by release: v5 runs on the Node 24 action runtime (runner 2.327.1+; the self-hosted macOS
runner reports 2.338.1) and adds automatic caching when `packageManager` is set; v6 limits that
automatic caching to npm, so this pnpm repository (`pnpm@9.15.4`) should gain no implicit cache;
v7 moves to ESM and stops exporting a dummy `NODE_AUTH_TOKEN`, which no workflow here relies on (no
`registry-url` or publish step). Pin the two floating uses to the v7.1.0 SHA rather than `@v7`.

Effort ½–1 day. Checks: every job reports Node 24.x, including the self-hosted macOS job; jobs
with `cache: pnpm` show the same restore/save behaviour on a miss and a hit; jobs without a cache
input stay uncached; required checks pass at the exact head. Rollback is in
[rollback boundaries](#rollback-boundaries).

## Rollback boundaries

Each slice lands as its own PR into staging, so the rollback checkpoint is the staging commit before
that merge, and recovery is a revert PR of that slice alone.

| Slice                                                              | Extra checkpoint before merge                                                                 | Rollback trigger                                                                         | Recovery scope                                                                                                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron                                                           | Verified private copy of the owner profile, DB and Keychain-protected key before first launch | Startup, key continuity, native ABI, packaged VM or diagnostics regression               | Revert slice; rebuild native modules; restore the profile copy if the new runtime wrote to it. Older-runtime reading of newer data is unverified, so test it before relying on rollback |
| Next                                                               | None beyond staging commit                                                                    | Build, standalone Docker, renderer packaging or BFF/browser journey regression           | Revert slice; rebuild web and standalone image; no data migration                                                                                                                       |
| CI actions (setup-node, upload-artifact, cache, pnpm/action-setup) | Record one passing run's artifact digests and cache keys                                      | Runner incompatibility, changed artifact digests/names/retention, cache behaviour change | Revert the workflow ref change only; confirm evidence downloads still verify                                                                                                            |
| Vitest                                                             | Ordinary suite and fresh benchmark results on the old version                                 | Changed assertions, deadlines or benchmark separation                                    | Revert slice; test infrastructure only                                                                                                                                                  |
| SQLite types                                                       | None beyond staging commit                                                                    | Type errors or DB/API/migration test failures                                            | Revert slice; types only, runtime unchanged                                                                                                                                             |
| Compatible group (PR382)                                           | Split into smaller groups first                                                               | Any failing required check in a sub-group                                                | Revert that sub-group only                                                                                                                                                              |

If the preview cannot establish a boundary (for example older-runtime reads after an Electron
upgrade), that check becomes a prerequisite of the owner decision for that slice.

## Decision and execution boundary

Finish current owner-app migration/preflight; discuss Electron target/support horizon first, then Next,
then isolated CI actions and other compatible groups. Support urgency warrants timely review, not
bypassing qualification. The macOS13 floor concerns a future supported-platform choice; this local
MVP may choose for the actual development machine without defining distribution policy. Do not
silently commit to supporting or dropping other users/platforms.

Every approved implementation gets its own task/spec/slice with actual baseline, the rollback
boundary above, owner authority and tests from the [verification map](../testing/dependency-upgrade-preview.md).
No automatic major change follows this preview. Current PR/package snapshot can change; refresh
before final decisions. Bounded planning stops at the reviewed decision brief, not a prototype build.

## Manifest and destinations

| Artifact         | Location                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Plan             | This document                                                                                      |
| Task             | [agent-platform-dependency-upgrade-preview](../tasks/agent-platform-dependency-upgrade-preview.md) |
| Verification     | [Evidence checks](../testing/dependency-upgrade-preview.md)                                        |
| Session handoff  | `session.md`, preserving the complete prior staging handoff                                        |
| Critique/results | [Review record](../reviews/dependency-upgrade-preview.md)                                          |

Started from stagingbe153 on 19 October; rebased on 26 October onto staging `d59e392c`, and PR373
now targets staging directly under the current task → staging delivery route. The unused
feature/dependency-upgrade-preview branch can be retired after merge. It must not mix source into the
migration branch. Planning documents use normal documentation checks/hooks/PRs; preview
implementation/merge requires separate authority.
