# Reconcile the retained owner's missing Git and Stop schema

**Beads:** `agent-platform-owner-profile-schema-preflight`, P1 OPEN.
**Blocks:** `agent-platform-local-mvp-stress-review`.
**Related:** [secure-storage startup repair](agent-platform-desktop-secure-storage-startup.md).
**Authority:** actual-app preflight and Electron patch are authorized. Original-database repair
requires a specific owner decision on this bounded proposal; it has not been applied.

## Actual failure and evidence

The original Make key authenticated the existing encrypted credential without exposing its value.
The next normal-profile launch reached backend startup, then failed after about15.234 seconds.
The retained backend error is `no such table: git_delivery_operations` in startup recovery.

The existing journal contains a later unrecognized hash
`43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915` at timestamp1785803000000.
Current migrations0019 and0020 have earlier timestamps1777800000000 and1777900000000.
Installed Drizzle0.38.4 checks the latest timestamp, so it skips those missing schema additions.
The origin of the later entry is not established; do not infer who wrote it or erase it.

All four current tables are absent: `git_delivery_operations`, `controlled_runs`, `run_executions`
and `run_attempts`. The existing approval table already has its `run_id` column. Read-only original
integrity is OK and foreign-key violations are zero. Existing Projects16/sessions51/messages478,
agents2/model configurations1/encrypted secrets1 remain present.

A private SQLite backup rehearsal at
`/var/folders/jv/rn38z0113bq0qgw2spbq3_0r0000gn/T/agent-platform-owner-schema-rehearsal-1y1n8jqk`
applied only committed0019/0020 SQL transactionally. It succeeded with integrity OK and unchanged
counts in those six original tables. Directory mode0700/file0600; no private database is committed
or published. This is copy-only evidence, not proof of original-database repair or owner readiness.

## Proposed one-time recovery

1. Confirm the actual app/backend is stopped and retain a fresh private SQLite backup. Read back
   backup integrity and bind original schema, journal, all existing logical rows and exact SQL hashes.
   Never include credentials, row contents or derived credential fingerprints in output.
2. Acquire `BEGIN IMMEDIATE` on the original database. Recheck the exact expected schema/journal and
   logical rows, all four absent tables and existing required approval columns inside the transaction.
   Any drift stops recovery; do not overwrite the original with the repaired rehearsal database.
3. Apply only exact reviewed `packages/db/drizzle/0019_git_delivery_operations.sql` and
   `0020_run_control.sql` statements. No row deletion, historical update, reset, key replacement,
   seed changes, credential migration or modification of unrelated tables is included.
4. Preserve every original journal row, including the later unrecognized entry. Append two truthful
   entries using each exact SQL SHA256 and its existing committed journal timestamp,1777800000000
   and1777900000000. Those timestamps identify the migrations; they do not claim execution time.
   Do not change the later high-water timestamp, invent hashes or reorder/delete existing history.
5. Before commit verify exact expected new table/index definitions, integrity, zero foreign-key
   violations and byte-equivalent logical original rows. The only allowed ledger delta is those two
   entries. Roll back on any mismatch. Verify again after commit and retain the original backup.
6. Launch the normal preserved profile with the absolute authenticated original Make key. Prove
   recording at the unchanged30-second cadence, native export and same-profile clean restart before
   inviting the owner to test. Preserve original Projects/history/credentials and default zero spend.

## Limits and stopping point

This restores two known missing additive migrations once. It does not repair generic migration
ordering or guarantee that future migrations with earlier timestamps will run. Record that remaining
risk in Beads; do not redesign the migrator during this recovery. If schema/history drifts, a check
fails or another missing schema appears, stop with the exact finding and preserve the backup.

Acceptance requires actual authorized recovery, unchanged original data, verified ledger/schema,
integrity and foreign keys, followed by successful actual-app preflight. Current state is OPEN and
BLOCKED awaiting the specific recovery decision. Paused orchestration and Docker gateway are untouched.
