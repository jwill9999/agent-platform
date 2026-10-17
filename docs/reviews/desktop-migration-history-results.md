# Desktop migration-history regression verification

Task: [agent-platform-desktop-migration-history](../tasks/agent-platform-desktop-migration-history.md).
Date: 17 October 2026. Status: implemented and locally tested; hosted qualification pending.

## Current CI repair checkpoint

CI `38995982248` at `769a5517` passed all25 migration unit cases, the full214-test database
suite and browser journeys (41 passed, one existing context-fixture skip). It failed the rejected
Electron launch twice because no backend log was created, and the fresh-process diagnostics benchmark
failed repetition2 locked p95 overhead37.508ms against the unchanged20ms limit. Sonar passed with
zero open issues. The passing jobs do not qualify either failure or a later changed head.

Installed Playwright1.59.1 adds `--no-sandbox` to Linux Electron fixtures by default; the directly
spawned rejected-startup fixture omitted it. That fixture now matches the existing Linux test launch
policy and retains its bounded, isolated stderr even if startup fails before backend logs exist.
Product launch flags and native macOS sandbox coverage are unchanged. A disposable Linux42.0.1
control aborts before application startup on its SUID sandbox configuration without the flag and
reports its version with the flag; this is supporting evidence, not an exact42.4.1 hosted replay.
Both actual managed Electron migration journeys pass locally again, zero retries,4.5seconds:
`~/.codex/migration-regression-20261017/electron-linux-policy-repair-local.log`.

The unchanged benchmark passed all9 local vectors. Its hosted timing cause remains unproven:
high event-loop delay and a25ms GC observation coexist without timestamp correlation. Additional
observations now retain request start/duration windows, GC start/duration, heap, event-loop utilization
and active-resource types around phases/cleanup. They neither subtract pauses nor change workload,
mode order, sample counts, limits, deadlines or pass rules. Resource types are not proof of worker
exit and can omit unreferenced timers. The instrumented local run also completes all900 measured
requests/990 provider-fixture calls and all original assertions; numerical evidence is
`~/.codex/migration-regression-20261017/local-benchmark-observed.json`.
Thread termination after bounded store close and uncancelled session-lock timers are diagnostic
leads, not established causes. No production lifecycle or lock changes are included in this repair.

Fresh hosted qualification and actual-app preflight remain required; this checkpoint does not declare
the app ready for owner stress testing. No live provider request, owner data change, merge or
external publication occurred.

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

## Initial hosted findings and source repair

PR345 at `92d249b7` reported five Sonar findings: prefer Set membership, three fixture path-traversal
flows from an unused CLI entry point, and Promise-chain style in the inherited native startup check.
The fixture CLI is removed entirely; its only required consumers import the synthetic helper.
Scoped membership now uses `Set.has`, with unchanged migration/schema behavior. No scanner exclusion,
suppression, credential reset or file-content omission was introduced.

A draft top-level readiness await in the native check failed its unchanged 60-second watchdog:
Electron waits for main-module evaluation before readiness. That draft was never pushed. The corrected
event-driven async check handles both already-ready and future-ready cases, keeping the immediate
availability assertion and native encryption roundtrip. Actual macOS rerun passed on Electron42.4.1
without an environment master-key override. See `/tmp/migration-native-storage-event-driven-20261017.log`;
the failed attempt remains `/tmp/migration-native-storage-top-await-20261017.log`. Pinned loader evidence:
[Electron42.4.1 initialization](https://github.com/electron/electron/blob/v42.4.1/lib/browser/init.ts)
and [CLI module loading](https://github.com/electron/electron/blob/v42.4.1/default_app/main.ts).

After these bounded corrections, all25 migration cases and both real Electron startup journeys passed
again without retries (`/tmp/migration-sonar-regressions-20261017.log`,
`/tmp/migration-sonar-electron-20261017.log`). Fresh current-head hosted qualification remains required;
the first head's passing jobs cannot qualify changed source. No owner app/profile operation occurred.

The corrected `77a4cca3` Sonar gate passed, but direct issue inspection found one remaining style
finding on the already-ready async call. That branch now awaits verification only after `app.isReady()`
is true; the not-ready branch still registers its event and finishes module loading immediately.
The exact native macOS command passed again (`/tmp/migration-native-storage-guarded-await-20261017.log`).
Gate success alone is not treated as absence of actionable findings; fresh final-head checks are required.

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
