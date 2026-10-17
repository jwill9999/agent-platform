# Detect desktop migration history and schema divergence

**Beads:** `agent-platform-desktop-migration-history`, P1 OPEN.
**Discovered by:** [owner-profile recovery](agent-platform-owner-profile-schema-preflight.md).

The retained owner profile had an unknown later migration timestamp. Drizzle0.38.4 uses the latest
timestamp as a high-water mark and skipped earlier committed0019/0020, leaving four required tables
absent. The separately authorized one-time recovery preserves that later entry and all original data;
it does not fix future timestamp ordering. The later entry's origin remains unknown.

Before implementation, prepare a bounded source-backed plan and independent critique. Reproduce
the mismatch on a disposable database, compare journal identity with physical schema, and define
supported safe recovery or a clear fail-closed diagnosis. Do not blindly replay unknown SQL,
erase history, reset credentials or alter unrelated user records.

Acceptance must cover repeated database opens, future migrations, copy-based preservation,
transaction rollback and actionable startup errors. Tests must verify real database state, not just
successful process exit. No generic repair has been implemented or qualified by the one-time case.

This follow-up is OPEN for backlog review. The recovered profile can undertake its bounded local
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
still needs the bounded source-backed implementation plan; the following tests define its outcomes.

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

**Current status:** matrix specified and linked in Beads; new regression cases and generic handling
remain unimplemented. Do not close this P1 or claim future upgrade safety until those cases and
current-head delivery gates actually pass. The restored owner's bounded trial is a separate activity.
