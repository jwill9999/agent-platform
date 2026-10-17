# Repair secure-storage startup before the owner trial

**Beads:** `agent-platform-desktop-secure-storage-startup`, P1 IN_PROGRESS.
**Discovered during:** [owner preflight](agent-platform-local-mvp-stress-review.md).
**Source:** protected staging `d55f20ed034ec79ebe60af3a2f734699fe7ba264`.
**Branches:** `feature/desktop-secure-storage-startup` →
`task/desktop-secure-storage-startup-plan` → `task/desktop-secure-storage-startup`;
existing verified staging worktree reused, delivery PR344 targets the feature.
**Authority:** owner requested actual-app recording/export/restart preflight, then explicitly approved
the bounded Electron42.4.1 patch and regression checks. Implementation is authorized; no new merge
grant or credential replacement is implied. The original failed preflight remains recorded below.
Repository files are canonical; no external publication is requested.

## Observed failure and source

The normal `pnpm --filter @agent-platform/desktop run start:renderer` builds all three components,
then exits before opening a window. Startup reports startup-begin at147 ms, cancel/stop-confirmed
at149 ms. `main.ts` awaits `ensureDesktopSecretsMasterKey`; the native protector requires asynchronous
safeStorage availability and fails closed when unavailable. No backend or monitoring store starts.

A read-only native probe with the installed official Electron42.0.1 reports synchronous availability
true, asynchronous availability false, and a **boolean** return instead of the declared Promise.
A bounded diagnostic follow-up observes availability become true111 ms later. No agent inspection of plaintext/application credentials, encryption/decryption call, provider
request, timing workaround or application-data write occurs in those probes. Availability can
initialize the OS Keychain provider; absence of internal provider access is not claimed.
These results match [upstream51759](https://github.com/electron/electron/issues/51759) and the
[42.4.1 fix51924](https://releases.electronjs.org/pr/51924). The pinned
[v42.0.1 source](https://raw.githubusercontent.com/electron/electron/v42.0.1/shell/browser/api/electron_api_safe_storage.cc)
returns the readiness flag synchronously before its callback initializes the encryptor.

The owner profile is the normal OS application-data profile, with16 Projects,51 sessions,
478 messages,2 agents and1 model configuration before and after this failed launch. Existing
protected master-key metadata was absent and one encrypted secret row existed at that failed-launch
checkpoint: provenance/key compatibility was then unverified; do not generate replacement credentials or overwrite that row.
No monitoring database exists yet. Host/app-volume free space is about61 GiB, above20 GiB.

## Bounded proposal and exclusions

Prefer the official same-major Electron42.4.1 patch containing51924, with only the desktop manifest
and lockfile plus a targeted startup regression if necessary. Confirm exact patched binary and
native-module ABI; retain secureStorage encryption, capability isolation and unchanged startup/
shutdown budgets. No latest-major migration, synchronous fallback, fabricated fixture master key,
arbitrary startup sleep, caller retry loop, credential reset, provider call or global change.

The missing existing master-key metadata is a separate constraint: successful startup with a newly
created key would not prove existing secret compatibility. Establish the configured historical key
source without printing/copying secrets; if unavailable, stop and request that specific owner input.
Do not mark the app ready from a test-only key or disposable profile.

The owner identified the historical Make launcher. Its original key file at
`/Users/letuscode/projects/agent-platform/.agent-platform/desktop-runtime/config/secrets-master-key.b64`
exists and authenticated the sole existing encrypted credential using a read-only check; no key or
plaintext value was printed or persisted. Reuse that exact original key via the existing supported
environment setting for the owner journey. Assert the original file already exists and is nonempty;
never run bare `make electron-local` from a new worktree, because its relative default creates a new
key when absent. This is not an OS-protected key migration. Qualify the native API separately without
an environment master-key override, using a 60-second diagnostic-only failure deadline, no retry
or startup delay. Production startup budgets remain unchanged. Independent review required this launch boundary before relaunch.

## Requirements and verification map

| ID  | Required outcome                          | Verification and retained evidence                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S01 | Fail-closed OS-protected startup works    | Real Electron/native Keychain availability and non-sensitive roundtrip, no environment master-key override; existing unit cases for unavailable storage, persisted key and re-encryption remain passing.                                                                                                                                                                                               |
| S02 | Existing owner data and secrets preserved | Read-only before/after row identity/count checks; verify existing credential compatibility without provider dispatch or exposing credentials. Missing historical key remains a blocker, never silently replaced.                                                                                                                                                                                       |
| S03 | Actual recording/export/restart passes    | Reuse the authenticated original Make key and normal owner profile. Use actual app controls to enable seven-day capture, observe at least two durable samples at the real30-second cadence, save the native report and verify coverage/health/privacy. Cleanly quit/relaunch the same profile and independently verify old samples/preference remain, process identity changes and new samples arrive. |
| S04 | Qualified delivery remains bounded        | Review exact dependency/source diff; run relevant desktop unit/type/lint/native and actual UI checks, normal hooks and all declared exact-head feature/protected staging gates if delivering a repair. No bypass or claim that planned checks passed.                                                                                                                                                  |

```gherkin
Feature: Normal desktop preflight with protected local credentials
  Scenario: Record and export after clean startup and restart
    Given the current app uses the owner's preserved normal profile and authenticated original key
    When the app starts and resource recording is enabled
    Then real periodic samples and capture health are visible and durable
    When a safe report is saved and the app is cleanly restarted
    Then the saved preference and earlier records remain and fresh samples use a new process identity

  Scenario: Unavailable storage or missing historical key
    Given secure storage is unavailable or existing credentials cannot be safely recovered
    When preflight attempts normal startup
    Then no plaintext fallback or credential replacement occurs
    And the owner trial remains blocked with a specific recorded reason
```

Relevant verification references remain [Q01/M01–M06](../testing/project-chat-stop-mvp.md) and
[monitoring results](../reviews/local-diagnostics-monitoring-results.md); those earlier passes do not
qualify the changed dependency or actual owner profile. Browser-only testing cannot prove Keychain
or native Save As. Use native app controls for actual preflight, supported read-only inspection for
persistence and safe exports. Preserve the failed original launch and distinguish fixture/real
credential coverage. Broad renderer/Docker/disk-I/O monitoring is outside this repair.

## Dependencies, delivery and stopping point

The owner-trial hard dependency applied while actual startup/preflight was blocked. With that
preflight now passed, retain a related delivery link rather than a runtime blocker; hosted patch
qualification and merge remain required for patch delivery. Discovered-from is informational,
not a hard reverse dependency. Stop/monitoring delivery stays closed and paused orchestration stays
separate. Estimate one bounded patch/regression pass, then re-evaluate if the historical key is
unavailable or dependency behavior differs; do not turn preflight into a storage redesign.

The owner explicitly authorized the bounded patch/regressions after independent plan review.
Merge authority remains separate; do not promote this repair on tests alone. Completion requires S01–S04 and actual required delivery evidence, then Beads
readback/Dolt sync. Owner hands-on stress testing remains a distinct open task.

## Actual results and handoff

- PASS: exact Electron42.4.1 pin/lock and native startup regression; immediate Promise and real
  non-sensitive OS secure-storage roundtrip without a master-key override. Independent source review
  approved after diagnostic-watchdog and native/owner-key wording corrections.
- PASS: desktop229unit tests, build/typecheck/lint, explicit formatting/Markdown and normal hooks;
  push at `f194f571`. Original script lint failures remain retained; no suppressed checks.
- PASS: read-only original Make-key authentication against the existing encrypted credential.
- PASS: separately authorized and reviewed owner-profile schema recovery; see linked recovery record.
- PASS: actual UI seven-day recording, native Save As export, clean quit/relaunch and retained history.
  Export contains five samples across two process identities, actual30.001-second intervals and
  zero pending/dropped/conflicting samples. App-volume minimum60.50GiB exceeds20GiB.
- PASS: original three sample IDs and seven-day preference survive restart; fresh second-process
  periodic observation arrives. All24 original non-ledger table rows remain identical; six original
  counts are16/51/478/2/1/1. No credential replacement or provider request occurred.
- LIMIT: the idle preflight has zero V1 diagnostic events, so combined export coverage is honestly
  incomplete; resource history has zero gaps/no missing-history flag. Initial per-process CPU/event-loop
  baselines are explicitly unavailable. This is not an agent/provider workload or capacity result.
- FOLLOW-UP: global Workspace Files listing shows an unexpected error while monitoring controls
  work. Retain this observation for owner-trial triage; no cause or repair is claimed.
- DELIVERY: local preflight supports the bounded owner trial; patch PR/hosted qualification and any
  merge remain separate. The user trial has not happened and no production readiness is claimed.

The actual native-saved reports are in Downloads. Final report
`agent-platform-monitoring-after-restart-20261017T0157Z.json` is8857bytes,
SHA256 `2f02b1719f78a7e38eb8c4bd51f8dfb4078772d7f0e6ffdf66deabc3dc8118ee`.
Independent terminal critique verified the exported allowlisted metadata, two process histories,
actual intervals, health and coverage limits without inspecting user credentials or databases.
Canonical Beads records later revision/check/PR identities; original failures remain historical evidence.

## Why these blockers escaped and the recurring controls

The owner requested an evidence-backed escape analysis after the actual-app preflight.

| Gap                                   | Existing coverage and why it missed this case                                                                                                                                                                                                                                                                                                                                                                   | Recurring control and current state                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Keychain initialization        | `test/secretStorage.test.ts` uses a mock protector. `e2e/support/contextTokenFixture.ts` seeds a fresh database and supplies a fixture master key; monitoring reuses that fixture. Packaged VM journeys also supply a fixture key. `ensureDesktopSecretsMasterKey` returns the environment key before consulting native availability. Real VM execution therefore did not exercise the missing OS API boundary. | The real native regression has passed locally. PR344 now wires it after Electron installation in the existing macOS staging job, with the environment override removed, no retries/fallback and normal failure propagation. It runs for each staging-targeted PR; feature-targeted qualification skips that job. The new hosted step has not yet qualified and is not yet active in staging. |
| Inconsistent retained-profile history | Main Electron journeys seed current schemas. Existing Git delivery coverage does upgrade a retained v18 schema, preserve records and repeat recovery; Stop tests cover ordinary legacy approvals and additive rollback. None of those cases inserts a later unrecognized migration entry while required earlier tables are absent. Drizzle's timestamp high-water behavior skipped those tables.                | Explicit synthetic inconsistent-history, complete-schema, preservation, reopen, rollback and actual desktop readiness cases are now required by P1 `agent-platform-desktop-migration-history`. They are planned, not implemented or passing. Run them through the default database and Electron CI suites before that task closes.                                                           |

The upstream native bug and missing database tables were runtime causes. The test escape was a
coverage-boundary gap: fixture success was interpreted more broadly than the boundary exercised.
It was not caused by fewer test counts or proven connection slowness. The earlier later-journal
entry's origin remains unknown. Keep this factual distinction; do not invent who introduced it.

The owner-profile preflight occurred only after integration, which left native initialization and
that retained-profile shape unverified until the owner was about to test. For future desktop/runtime
changes, run native OS and synthetic retained-profile checks before staging promotion, then the
actual-app recording/export/restart preflight before each owner test session. Do not run recurring
CI tests against the owner's real profile, credentials or database.

This adds a workflow check and tracking/verification requirements, not a branch-protection change,
new scheduled automation, generic migration repair or renewed merge authority. Independent critique
must review the new workflow and this analysis; hosted execution remains separate evidence.
