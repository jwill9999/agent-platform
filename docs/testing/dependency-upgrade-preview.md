# Upgrade preview verification map

[Task](../tasks/agent-platform-dependency-upgrade-preview.md),
[plan](../planning/dependency-upgrade-preview.md), [review](../reviews/dependency-upgrade-preview.md).

| Check | Requirement | Evidence and expected outcome                                                                                                                                                                                                             |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UP-V1 | R1          | Exact staging manifest/lock/action hashes, actual proposal diff/head/base (plan's Action revisions table, verified 26 October). Obsolete AI proposal rejected; no installed-versus-running-app confusion.                                 |
| UP-V2 | R2          | Official release/migration/advisory dates; inferred Next boundary labeled; support deadlines/runner and native ABI prerequisites independently checked.                                                                                   |
| UP-V3 | R3          | Each proposed slice maps changed files, meaningful regressions, rollback checkpoint/trigger/recovery scope (plan's Rollback boundaries), profile backup/recovery and actual delivery gates; no bundled automatic change or waived limits. |
| UP-V4 | R4          | Distinct source-aware critique, actionable corrections resolved, document links/format/Markdown and Beads parent/scheduling/readback/sync. Owner choices precede major implementation.                                                    |

Future approved Electron slice: fresh/retained DB startup, original-key continuity/Keychain, native
module ABI, preload/permissions/terminal/WebContentsView/export/restart, browser and full Electron,
diagnostics success/error/wait/Stop/approval and actual signed packaged VM. Profile migration uses
verified backup/private-copy first; no paid live generation is implied.

Future approved Next slice: explicitly decide retain-Webpack (`--webpack`) versus qualify-Turbopack;
Next16 changes both existing plain `next dev` and `next build` commands to Turbopack by default.
Verify the chosen path, monorepo output tracing, standalone Dockerfile.web assembly and desktop
build:renderer consumer against the actual apps/web scripts and official migration guide.
Then build/types/lint/standalone packaging and real BFF/API/SQLite browser
chat/model/MCP/Git/Stop/context/export journeys, cancellation/error/history recovery, diagnostic
reports and Electron renderer/native regression. Preserve API behavior and no optional architecture
adoption. Future test-runner changes require full ordinary suites plus separate fresh raw benchmark
with unchanged workload/assertions/deadlines; any scope exception needs specific owner authority.

Future setup-node slice (PR369): record the runner version on each runner class (2.327.1+ needed;
self-hosted macOS reported 2.338.1); every job reports Node 24.x; `cache: pnpm` jobs in ci.yml and
check-cycles.yml show unchanged restore/save on a miss and a hit; dependency-security, promptfoo and
docs-ci jobs stay uncached; the two floating uses are pinned to the reviewed v7.1.0 SHA; a revert of
the workflow refs alone restores the previous behaviour.

Future CI actions: exact pinned source/runner runtime, actual cache miss/partial/full hit and package
resolution; real zipped uploads/downloaded artifact digests/CRCs/member/source/run/attempt bindings,
privacy/retention/names; current required/executed checks and reviews. A green setup step alone does
not qualify evidence ingestion. All upgrades require source critique/current-head Sonar/CodeQL and
live protection gates as applicable, no automatic merge or protection bypass.

This preview runs no product tests and claims no runtime qualification. Source/document checks are
proportionate; missing account/runner/host prerequisites must be recorded before implementation.
