# Detect desktop migration history and schema divergence

**Beads:** `agent-platform-desktop-migration-history`, P1 IN_PROGRESS.
**Discovered by:** [owner-profile recovery](agent-platform-owner-profile-schema-preflight.md).

The retained owner profile had an unknown later migration timestamp. Drizzle0.38.4 uses the latest
timestamp as a high-water mark and skipped earlier committed0019/0020, leaving four required tables
absent. The separately authorized one-time recovery preserves that later entry and all original data;
it does not fix future timestamp ordering. The later entry's origin remains unknown.

The bounded source-backed implementation plan passed independent critique. Reproduce
the mismatch on a disposable database, compare journal identity with physical schema, and define
supported safe recovery or a clear fail-closed diagnosis. Do not blindly replay unknown SQL,
erase history, reset credentials or alter unrelated user records.

Acceptance must cover repeated database opens, future migrations, copy-based preservation,
transaction rollback and actionable startup errors. Tests must verify real database state, not just
successful process exit. The one-time owner recovery did not qualify generic migration handling.

This follow-up is in implementation under the owner's authorization. The recovered profile can undertake its bounded local
monitoring trial; this is not production/distribution upgrade qualification. Docker gateway and
paused orchestration remain separate.

## Escaped coverage and required recurring regression matrix

Source review confirms that Git delivery already tests an ordinary retained-v18 upgrade and
preservation (`packages/db/test/gitDelivery.test.ts`), and Stop tests additive failure/rollback
(`packages/db/test/runControl.test.ts`). This task addresses the inconsistent-journal case they
lack; do not describe the suite as having no upgrade coverage.

Generate all records and migration journals from synthetic fixtures. Do not copy an owner's profile
or credentials into CI. Start from the committed pre0019 schema and preserve identifiable synthetic
sessions, approvals, messages and encrypted test-secret rows. Insert a synthetic later unknown
journal entry to reproduce the high-water skip. The chosen safe reconciliation/diagnosis behavior
follows the independently reviewed fail-closed contract below; the following tests define its outcomes.

| ID      | Scenario                                                          | Required outcome                                                                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIG-R01 | Ordinary retained pre0019 schema with consistent history          | Existing upgrade behavior still creates Git/Stop tables and preserves prior records; recovery executes no stored work.                                                                                                                                                           |
| MIG-R02 | Later unknown journal entry with the four Git/Stop tables missing | Never silently qualify readiness. Provide a safe, actionable diagnosis before repository recovery uses absent tables, or a separately reviewed supported reconciliation. No history deletion, arbitrary SQL replay or credential reset. This reproduces the escaped case.        |
| MIG-R03 | Current complete schema plus a later unknown journal entry        | Follow the reviewed compatibility policy without duplicate table creation, spurious replay or user-record changes. Treat unknown history explicitly; do not infer that a high timestamp proves schema completeness.                                                              |
| MIG-R04 | Reopen both supported and rejected cases                          | Repeated opens are idempotent; failed diagnosis leaves schema, journal and existing logical records unchanged.                                                                                                                                                                   |
| MIG-R05 | Failure partway through an authorized additive migration          | Roll back schema/data/journal together, preserve approvals and verify integrity/foreign keys independently. Keep existing rollback regressions passing.                                                                                                                          |
| MIG-R06 | Managed Electron startup with synthetic retained data             | Through the real shell/backend, verify readiness/window and preserved sentinel records for the supported case; verify bounded safe failure and useful diagnostics for the rejected case. A wrapper exit0 is insufficient. Native OS-key coverage remains a separate macOS check. |

Required execution: database cases belong in the default `packages/db` test suite, which the existing
`verify` workflow executes on each feature/staging/main-targeted PR. The desktop case belongs in the
normal Electron suite on those PRs. Keep the recurring CI inclusion as a DoD requirement: standalone
manual success or the one-time owner repair does not satisfy it. No nightly job or paid provider
is needed; use deterministic external boundaries and real application/database behavior.

**Current status:** fail-closed handling and the new default-suite regressions are implemented;
local database and connected Electron cases pass. See the [verification record](../reviews/desktop-migration-history-results.md).
Hosted current-head qualification remains pending. Do not close this P1 or claim future upgrade safety
until those cases and delivery gates actually pass. The restored owner's bounded trial is separate.

## Authorized bounded implementation contract

The owner approved implementation and exposed-issue repair with critic review on17 October.
Implementation is on `task/desktop-migration-history`, chained from startup head `aa5848cd`, in a
separate reused worktree; the running owner app's checkout, builds and data remain unchanged.
The final task-tip PR targets existing `feature/desktop-secure-storage-startup`. Actual merges
still require their applicable authority. Do not close P1 before new default-suite CI evidence.

Choose fail-closed diagnosis for inconsistent history, not automatic replay or reset. Load trusted
committed SQL/hash/timestamp metadata using public Drizzle `readMigrationFiles`. A small SQLite
transaction owner must encompass journal preflight, known pending SQL and journal inserts, existing
legacy-slug repair and final schema validation. Do not nest Drizzle's literal BEGIN/COMMIT. Any
failure rolls the entire open-time operation back and closes the failed connection.

Reject unrecorded known migrations whose timestamp would be skipped by the existing high-water
mark, or recorded known hashes with conflicting timestamps. Preserve unknown journal rows.
An unknown later row is compatible only when every known migration is recorded and the scoped
current schema matches the trusted canonical shape. The already repaired owner profile has those
truthful known entries; this implementation does not inspect or mutate it.

Construct the expected Git/Stop schema in an ephemeral empty database from trusted migration SQL.
Compare the four tables and their complete table/index definitions, including column types,
foreign keys, CHECK constraints and partial uniqueness, plus required approval-binding columns/index.
Reject unexpected triggers attached to those four tables or `approval_requests`; otherwise a matching
table/index shape could still run unreviewed side effects. Type/FK/CHECK tamper fixtures restore all
original indexes so rejection proves the changed constraint, rather than a missing-index shortcut.
A fully recorded ledger with tampered physical schema must also fail. This is scoped contract
validation, not a claim to validate every unrelated table or authorize arbitrary schema repair.
Keep error code/message fixed, safe and actionable; omit paths, hashes, SQL and credentials.

MIG-R01–05 use independently generated synthetic retained fixtures through the unchanged upstream
migrator, not the new `openDatabase` path. Add the future-known-migration-below-unknown-high-water
case and complete-ledger/tampered-schema controls. MIG-R06 uses real managed Electron/backend:
supported profile must show a window and readiness with sentinel rows preserved; rejected profile
must retain a safe failure marker, never become ready/window-ready, preserve its database and clean
up owned children. Electron wrapper exit0 alone is not success or failure evidence. Fixture key and
ports/profile isolation are explicit; native OS storage remains the separate macOS gate.

Verification: preserve red tests before production changes, focused then full database suite,
desktop/type/lint/build, connected Electron success and failure, source-aware independent review,
normal hooks and hosted default database/Electron CI on the final head. Startup failure precedes
V1 store creation, so its safe backend log/process evidence is required; no agent/provider requests
are needed and agent-execution report review is not applicable to this startup-only slice.

## Hosted export finding and recurring failure evidence

CI-E01 was found by independent artifact review after all jobs on4124faab passed. The existing
export journey returned503 in205.803ms on its first attempt, then succeeded on retry. Its missing
backend logs prevent a proven cause; the200ms flush deadline is a lead only. Keep this P1 open.

The authorized bounded follow-up preserves production deadlines and original success/privacy/
restart assertions. Safe server-side report-read observations distinguish flush, query and report
failures; telemetry failure must preserve the original safe response. API regression controls cover
pending flush, rejected query, broken health/logger observation and denied access with no store
side effect. The connected Electron/browser journey must assert the one actual report response
before expecting a download, retain fixed failure categories/projected read observations even when
shutdown fails, then remove its disposable resources. No automated export retry qualifies a failed
first attempt. These tests remain in the existing default API and Electron suites, so normal CI
executes them; fresh exact-head artifact review is required before resolving CI-E01.
