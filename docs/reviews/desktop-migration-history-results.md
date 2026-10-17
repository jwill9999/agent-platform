# Desktop migration-history regression verification

Task: [agent-platform-desktop-migration-history](../tasks/agent-platform-desktop-migration-history.md).
Date: 17 October 2026. Status: implemented and locally tested; hosted qualification pending.

## Why the issue escaped

Existing tests already covered ordinary retained-v18 upgrades and additive SQL rollback. Electron
journeys normally seeded a fresh current database. Neither combined a later unknown journal entry
with missing earlier Git/Stop schema. Synthetic fixtures now reproduce that exact high-water skip
without copying an owner database, credentials or key. Native OS secure-storage coverage is a
separate macOS staging gate carried from the startup patch.

## Bounded behavior

The public Drizzle migration-file reader supplies committed SQL, hashes and timestamps. One
immediate SQLite transaction checks recorded history, applies only eligible known SQL and truthful
journal entries, runs the existing savepoint-safe legacy repair, and verifies the scoped schema.
Failure rolls all those effects back; `openDatabase` closes the failed handle. No unknown SQL replay,
history deletion, automatic reconciliation, owner-profile operation or credential reset is included.

Reject missing known migrations at/below the existing high-water mark, conflicting/malformed known
history, and Git/Stop table/index/constraint drift. Compare exact trimmed canonical SQL, preserving
literal semantics. Required approval-binding columns/index are checked, and unexpected triggers on
the four critical tables or approvals are rejected. This does not validate every unrelated table.
Unknown rows remain compatible only with complete known history and the scoped canonical schema.
Equivalent manually rewritten DDL can fail this intentionally strict policy; recovery needs review.

The fixed `DATABASE_MIGRATION_HISTORY_MISMATCH` message advises backup and supported recovery.
Raw migration metadata/SQL exceptions are discarded rather than attached to startup logs.

## Actual local evidence

| Check                                 | Actual result                                                                                                                                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red baseline before production change | 15 failed, 2 passed; old code accepted skipped history and tampered schema, or leaked a raw SQL collision. `/tmp/agent-platform-migration-red-final-20261017.log` retained.                                                                                     |
| Database regressions and full suite   | 214 passed across 34 files, including 25 new migration cases. `/tmp/migration-db-qualified-20261017.log`.                                                                                                                                                       |
| Desktop unit suite                    | 229 passed across 29 files. `/tmp/migration-desktop-unit-20261017.log`.                                                                                                                                                                                         |
| Real Electron retained upgrade        | Real managed backend/renderer reaches readiness and a visible workspace window; independent SQLite inspection verifies original sentinel rows, two truthful journal additions, the four new tables, integrity and foreign keys.                                 |
| Real Electron rejected history        | Fixed backend error, no backend/window readiness, confirmed shutdown and released ports, unchanged full synthetic database snapshot; V1 diagnostic store correctly absent because startup failed before creation. Wrapper exit0 alone is never used as success. |

Electron uses private temporary runtime/profile/home/log directories, independently generated retained
fixtures, four reserved ports and a fixed non-sensitive fixture-only master key. No configured model or provider
request is needed. It cannot prove native OS key availability or compatibility with arbitrary profiles.
The supported trace and safe failure JSON are retained under `apps/desktop/test-results/`; the final
connected command/log is `/tmp/migration-electron-tcp-qualified-20261017.log`. Cleanup confirms TCP
refusal, not HTTP timeout; failure retains the fixture. The rejected process owns its detached group,
with bounded termination even if its parent exited first. The owner app remained running separately.

Initial full-suite/typecheck attempts in the clean reused checkout failed on absent built contracts;
building declared workspace prerequisites resolved that setup failure. An initial Electron invocation
failed Playwright fixture-signature parsing before launch; the corrected test uses required object
destructuring. A metadata-error control initially hit an immutable ESM spy export; its wrapper now
mocks only the one loader failure, while normal SQL and fixture creation remain real. Original logs
are retained; these are not passing acceptance evidence.

## Recurring CI and review gate

`packages/db/test/migrationHistory.test.ts` is part of the default database suite in CI `verify`.
`apps/desktop/e2e/migration-startup.e2e.ts` is part of the default managed Electron suite in
`desktop-e2e`. Both execute on ordinary feature, staging and main-targeted PRs; no new scheduled
job, provider spend, assertion relaxation or scan exclusion is required. Workflow comments identify
MIG-R01–05 and MIG-R06 at their existing execution steps.

Independent plan critique approved the bounded contract; implementation review identified and
prompted corrections to trigger checks, isolated constraint fixtures, nested transaction handling,
metadata sanitization and safe owned-process cleanup. Final independent source/evidence review
approved with no remaining findings, verifying the actual logs, safe failure JSON, trace CRC/local
network requests and historical session preservation. Hosted exact-head DB/Electron checks remain
pending. The P1 task remains in progress until actual qualification.
Feature macOS skips are not native staging evidence; local tests are not hosted qualification.

Agent-execution diagnostic review is not applicable: these are startup-only cases without an agent
request. Rejected-startup evidence is the safe backend/process failure record, not a fabricated V1
report. No UI layout changed. Paused orchestration and the disabled Docker gateway remain separate.
