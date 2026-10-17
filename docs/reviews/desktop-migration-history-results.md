# Desktop migration-history regression verification

Task: [agent-platform-desktop-migration-history](../tasks/agent-platform-desktop-migration-history.md).
Date: 17 October 2026. Status: hosted jobs passed at4124faab; CI-E01 artifact finding remains open.

## CI-E01: failed export observation

Actual CI38998546853 attempt1 is terminal SUCCESS on4124faab. All25 migration regressions
passed inside214 database tests; both MIG-R06 Electron cases passed without retries. The full
Electron report is69 expected passes plus one flaky case, not a clean70-pass result. Independent
review verified the source/run/archive bindings and found CI-E01 in the existing export journey.
The first browser report POST returned503 after205.803ms, then download waiting reached120040ms;
retry1 passed8836ms. Its preserved trace is
`~/.codex/migration-regression-20261017/ci-electron-report-4124faab.zip`, member
`data/7b11adac423cbbff2e7f9f5ef3202df4ddef6350.zip`.

The failed fixture deleted its backend logs. Its205.803ms response is close to the API's200ms
flush-read deadline, but no retained flush/query state establishes the exact cause. The BFF maps
several upstream/report failures to503, so neither a network-speed cause nor a flush cause is proven.
This gap is explicitly retained instead of accepting the retry as qualification.

The follow-up adds best-effort structured failure observations with fixed flush/query/report phase,
monotonic elapsed time and schema-validated health counters/categories. It never logs raw errors,
SQL, scope, paths or capabilities. Logging/health failures preserve the original safe HTTP status.
The production200ms flush and5000ms BFF deadlines remain unchanged. Five new API cases cover
pending flush, query rejection, health failure, logger failure and invalid-health privacy; denied
requests also assert no flush/query/read-failure log. All19 focused API cases pass in8.32seconds,
recorded in `~/.codex/migration-regression-20261017/ci-e01-final-api-regressions.log`.

The connected fixture now observes one actual report response before awaiting a download, records
only allowlisted BFF error categories, and retains projected read-failure evidence before removing
its isolated profile/log directory. Download listeners are removed on failure; both owned fixture
shutdowns settle before evidence attachment, and shutdown failures still fail the test. No export
retry or relaxed assertion is added. Initial connected draft passed once in9.6seconds; a later
critic correction requires the final-source rerun. Fresh hosted evidence remains pending; this is
an evidence repair, not a claim that the original transient failure's cause is fixed.

Independent review approved the bounded observation plan. Source review CI-E02 required evidence
preservation despite shutdown failure; CI-E03 required the fixed BFF category in addition to status.
Both are implemented; final review and actual-source results govern qualification.

Final corrected-source local Electron report `ci-e01-qualified-electron.json` has3 expected passes,
0 unexpected/flaky/skipped, with retries disabled. The real browser/BFF/API/SQLite export succeeds;
its evidence receipt is a persisted file as well as a Playwright attachment, so both list and hosted
HTML reporters retain it. Both MIG-R06 startup journeys pass again. Native and browser reports each
contain13 events with ready/verified/durable coverage,0 pending/dropped/conflicts, and no prompt
canaries; the restarted report preserves the original13 events. The actual backend-down report has
0 events and explicitly unverified/non-durable coverage. All providers are deterministic fixtures;
this proves no live OpenAI compatibility or owner stress workload. Typecheck, scoped lint, formatting
and direct Markdown API checks pass. Final source-aware review and new hosted qualification follow;
this local pass does not establish the historical transient cause.

## Earlier CI repair checkpoint

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

The normal push hook then failed healthy2 overhead21.106ms while running the benchmark inside the
reused API test fork. It now matches CI's existing separation: non-API package tests finish, the
ordinary API suite runs with only this benchmark excluded, then the complete benchmark must pass in
a new Vitest process. Build/typecheck/cycles remain required; either suite or benchmark failure stops
the push. API selection uses exact package identity. Ten shell-boundary controls pass, including mixed
selection, near-name rejection and failure propagation; they run in CI. The four existing real Git
environment-isolation controls pass without changing paused prototype source. The first new control
incorrectly expected cycle failures to retain exit23; it now expects the existing normalized exit1.

## Updated actual-app preflight

Using the updated runtime source from `99fb4aa0`, the real retained profile reached a window in2.419s
and1.967s on clean relaunch with its original Make key. Native Save As exported a local report before
and after restart. The original process reports `stop-confirmed` and its backend/renderer ports are
released. All29 original application tables remain logically byte-equivalent at this checkpoint;
all112 settled pre-restart monitoring samples and enabled seven-day preference survive. Later owner
changes are not overwritten or treated as preservation failures.

Report `~/Downloads/agent-platform-migration-preflight-20261017-after-restart.json` is8909bytes,
SHA256 `d0552a6b7d9a9b035548b55c3d1348ed310a5b6feaeb2f46e2754a417983e7f4`, with5 samples across
two process identities, zero resource gaps/loss/conflicts and no unclean previous shutdown. That
export includes the restarted process's initial sample; independent read-only storage inspection
also confirms subsequent periodic samples. Existing samples retain30-second cadence. The idle
window has0 V1 events and an earlier window edge, so combined coverage correctly remains incomplete.
Private backup and source/build bindings are retained outside the repository, not uploaded to CI.
Free app-volume space exceeds20GiB. No provider call was initiated by this preflight.

After the Codex restart, the app's backend and renderer still listen normally. Its Models screen
shows a failed connection status; that live-provider readiness has not been established. Existing
global Workspace Files also still shows an error, as recorded by the previous preflight. These
limits must be disclosed before inviting model-driven stress testing; do not infer their causes
or change the owner's model configuration. New provider interoperability work is a separate P1.

Fresh hosted qualification and live-provider readiness remain required; this checkpoint does not
declare the app ready for model-driven owner stress testing. The authorized preflight added monitoring
samples while preserving existing application records. No provider request was initiated by this
work, and no merge or external publication occurred.

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
