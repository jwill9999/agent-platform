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
