# Major dependency upgrade impact preview — local MVP

Planning only,19October2026. Beads: `agent-platform-dependency-upgrade-preview`, child of
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
| Upload Artifact | Pinned4.6.2 →7.0.2 proposal | Isolated CI change. Verify exact current target release/SHA and Node24 runner minimum2.327.1. Preserve zipped output, artifact names/retention/privacy and all downloaded digest/member/source/run proofs; do not enable optional unzipped transport incidentally.                                                                                                                                                                                                                                                                    | ½–1 day                        |
| Cache           | Floatingv4 →v6 proposal     | Isolated docs-CI maintenance. Verify exact target/SHA and runner compatibility; preserve keys, miss/partial-hit installation and prove real hit/miss. ESM action internals do not imply application migration.                                                                                                                                                                                                                                                                                                                        | ¼–½ day                        |

Sources: [Electron schedule](https://releases.electronjs.org/schedule),
[44 release](https://www.electronjs.org/blog/electron-44-0),
[Next support](https://nextjs.org/support-policy),
[Next16 migration](https://nextjs.org/docs/app/guides/upgrading/version-16),
[Upload Artifact](https://github.com/actions/upload-artifact),
[Cache](https://github.com/actions/cache), [SDK migration](https://ai-sdk.dev/docs/migration-guides).

## Other current Dependabot proposals

- PR368 updates pnpm/action-setup's pinned v4 source, not pnpm's package-manager major; the proposed
  commit reverts its Node24 action-runtime migration. Diagnose actual failed VM result before approval.
- PR369 setup-node4→7 requires runner/runtime and cache review; no green summary alone qualifies it.
- PR370's28-update group includes Playwright1.59→1.64, React19.2→19.3 and types/supertest6→7. Its
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

## Decision and execution boundary

Finish current owner-app migration/preflight; discuss Electron target/support horizon first, then Next,
then isolated CI actions and other compatible groups. Support urgency warrants timely review, not
bypassing qualification. The macOS13 floor concerns a future supported-platform choice; this local
MVP may choose for the actual development machine without defining distribution policy. Do not
silently commit to supporting or dropping other users/platforms.

Every approved implementation gets its own task/spec/slice with actual baseline, rollback point,
owner authority and tests from the [verification map](../testing/dependency-upgrade-preview.md).
No automatic major change follows this preview. Current PR/package snapshot can change; refresh
before final decisions. Bounded planning stops at the reviewed decision brief, not a prototype build.

## Manifest and destinations

| Artifact         | Location                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Plan             | This document                                                                                      |
| Task             | [agent-platform-dependency-upgrade-preview](../tasks/agent-platform-dependency-upgrade-preview.md) |
| Verification     | [Evidence checks](../testing/dependency-upgrade-preview.md)                                        |
| Critique/results | [Review record](../reviews/dependency-upgrade-preview.md)                                          |

This separate clean worktree starts stagingbe153: feature/dependency-upgrade-preview →
task/dependency-upgrade-preview. It must not mix source into the migration branch. Planning documents
use normal documentation checks/hooks/PRs; preview implementation/merge requires separate authority.
