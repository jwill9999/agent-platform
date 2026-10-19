# Task: preserve the legacy profile during the SDK upgrade

Beads: `agent-platform-sdk-legacy-migration` (P1 bug, in_progress).
Parent: [provider interoperability](agent-platform-provider-interoperability.md).

## Requirements and scope

The actual S12 private-copy preflight on staged `be153c50` rejected migration0021 before executing
its SQL. The retained journal has all canonical0000–0020 entries plus an unknown later watermark;
that unknown row already existed before the17October repair. Its complete SQL bytes are proven by SHA256; original commit/execution provenance remains unproven.
Original owner databases, records, encrypted credentials and journal were not modified. The previous
app is restored; the SDK upgrade is not yet installed there.

- MIG-S1: Keep published0021 SQL, SHA256 and timestamp1778000000000 immutable. Preserve every original
  record, encrypted credential and journal row, including the unknown entry. Existing0021 adopters
  follow the unchanged path and never replay its statements.
- MIG-S2: Allow only the exact canonical0021 migration below the unknown watermark, after proving
  every committed0000–0020 hash/time is recorded exactly once and the complete touched pre-schema
  matches a trusted fresh0000–0020 reference. SDK columns/table must be absent; scoped triggers,
  semantic DDL/index/default drift, duplicate or malformed history and other missing predecessors
  deny the bridge. Include the legacy slug-repair tables in the touched pre-schema proof so this
  compatibility path cannot perform an incidental row backfill. Reject migration-journal triggers
  before any compatibility write. Bind the below-water exception to the immutable SDK SQL/hash/time.
- MIG-S3: Any other pending migration below the watermark still fails. Apply canonical0021 SQL and
  its original journal stamp within the existing immediate transaction; retain the exact final-schema
  guard, safe error and rollback/connection-release behavior. Verify the entire original ordered
  journal remains exact with only one canonical0021 row appended before commit. No flag, environment override or API
  may weaken eligibility.
- MIG-S4: Add synthetic owner-shaped upgrade/reopen, preserved encrypted-record/journal assertions
  and negative/rollback controls. Existing assertions, timeouts, runtime deadlines and generic
  unknown-watermark rejection remain intact.
- MIG-S5: Add a real managed Electron startup/restart journey using this synthetic historical shape,
  verify retained visible configuration and independent SQLite state, and preserve original MIG-R06
  denial coverage. No owner data or live provider is used in tests.
- MIG-S6: Qualify the exact source through local affected gates, independent source/evidence review,
  feature checks and protected full analysis/VM/security checks. Then repeat the private-copy owner
  upgrade and actual retained-profile recording/export/restart before declaring S12 complete.

Excluded: retiming/deleting/reclassifying historical rows, manual DDL/journal repair, fresh-database
imports, generic migration-framework changes, credentials replacement, paid inference, main promotion,
paused orchestration, global settings, Docker gateway activation and external documentation publishing.

## Dependency order and destinations

Actual SDK source is already staged through PR363 at `be153c50019b0dd28b6105cf2f48a961ac16ed8f`.
No unclosed upstream task blocks this repair. Canonical Beads explicitly makes the provider parent
depend on this child; there is no child-to-parent dependency cycle. Model diagnostics is closed after
its own protected delivery. Owner stress remains open.

Worktree: `/Users/letuscode/.codex/worktrees/migration-hook-review/agent-platform`, reused clean and
detached from earlier delivered work. Feature `feature/provider-sdk-owner-upgrade`; first segment
`task/provider-sdk-legacy-migration`, both start at actual staged `be153c50`. Task→feature normal PR,
then feature→protected staging with actual owner-authorized guarded merges after all checks/reviews.
Keep the separately built staged SDK runtime checkout and retained old owner checkout intact.

## Implementation and responsibility

DB worker owns migrationHistory, DB regression tests and the synthetic migration-profile helper.
Connected QA owns the Electron migration test. Coordinator owns this spec, the existing feature
plan/test/results links, session, Beads and delivery/runtime preparation. Workers preserve each
other's changes. Independent critic reviews plan and frozen source/evidence; read-only assignment is
procedural, not a claim of technical tool isolation.

Implement only the exact bridge after plan critique. Run affected DB, source/types/lint/format checks
and focused real Electron startup/restart plus existing SDK private-continuation journeys. Keep normal
hooks, single-worker execution and the unchanged fresh900/990 benchmark. Hosted jobs qualify every
new source/head; no old green badge substitutes. Do not rerun unchanged failures without diagnosis.

## Tests and definition of done

Use [SDK-MIG scenarios](../testing/provider-sdk-compatibility.md#legacy-watermark-upgrade-regressions)
and record actual results in the [existing review](../reviews/provider-sdk-compatibility.md).
Plan maps all requirements to tests, source and delivery. Complete only after current-head independent
review, green local/hosted quality/security/connected gates, actual declared staging delivery, exact
merged-tree/history preservation and supported private-copy then owner-profile S12 validation.
Close/read back/sync this child only after that outcome; provider then requires its own full S12
completion. Retain current backup and old runtime while the new upgrade is unqualified.

Authorization: owner requested complete SDK delivery and app preparation; this source-backed bounded
compatibility repair is necessary S12 work. Independent preliminary critique SDK-MIG01/02 found the
missing compatibility path and regression; no policy waiver or new product decision is required.
Refined contract and DB/native source review passed; focused local results are linked below.
Fresh hosted delivery and original-profile S12 remain pending. Expected effort: one bounded repair and test
slice plus normal feature/protected pipeline time; broader migration recovery remains out of scope.

## Gherkin E2E Strategy

```gherkin
Feature: Open a retained profile after the SDK compatibility upgrade
  Background:
    Given a disposable profile uses the real managed desktop and SQLite
    And no live provider request or owner credential is available to the fixture
  Scenario: Eligible retained profile upgrades and restarts
    Given canonical migrations through0020 and a preserved opaque later journal entry
    When I open the application and view its saved model configuration
    Then the workspace and retained configuration are visible
    And independent SQLite inspection preserves every original record and journal row
    And exactly the canonical0021 migration is appended
    When I close and reopen the same disposable application
    Then the retained workspace is usable and no migration is replayed
  Scenario: Inconsistent retained history is denied
    Given a predecessor is missing or the touched schema or migration journal has a trigger
    When I open the application
    Then startup fails safely without a ready workspace
    And owned ports are released and independent database inspection finds no partial mutation
  Scenario: An existing SDK adopter is unchanged
    Given canonical0021 is already recorded with retained configuration and opaque later history
    When I open and restart the application
    Then the retained configuration remains visible
    And independent journal and record inspection proves no SQL or stamp replay
```

SDK-MIG05 maps the eligible native journey to visible role/label assertions, actual API readiness,
independent SQLite original-column and ordered-journal checks, retained trace/log/source receipts and
owned cleanup. Existing real denied startup remains; DB SDK-MIG02/03/04 independently cover adopter,
trigger and history permutations. Native configuration/restart uses real data/backend, not UI mocks.

## Proven historical schema variant

The first exact pre-schema check also found an existing nullable TEXT `workspace_events_json` column
on messages. The complete64-byte SQL `ALTER TABLE` statement adding it was reconstructed and
independently verified against the retained SHA256
`43b2b45107a31db10880e2d0dd0ab95c976befcc4ec95e954cc3c7fefc8ce915`.
Original commit/execution provenance remains unproven. Executing only that proven statement after
canonical0000–0020 in a fresh in-memory reference reproduces all34 actual touched/legacy definitions
exactly, including column order; no owner SQL or record is used as a template.

MIG-S2 additionally permits this one explicit historical schema variant only with the exact legacy
hash/time1785803000000 recorded once, complete canonical predecessors and the exact derived schema.
The legacy statement runs only in trusted references/synthetic fixtures, never on the owner profile.
Production applies only immutable0021. Preserve every opaque legacy-column value. Derive both the
pre-upgrade and post-upgrade reference in canonical-prefix→proven-legacy-statement→unchanged0021
order; use the same strict variant for first bridge and already-upgraded/reopened variant adopters.
Canonical adopters remain unchanged. Never normalize arbitrary DDL or tolerate unknown extra columns.

SDK-MIG01/02/04/05 must cover this owner-shaped variant as well as the canonical case: non-null
opaque values survive upgrade/reopen; wrong/missing/duplicate legacy hash/time, column type/default/
order/extra-definition mutations and journal/scoped triggers deny without effects. The native
sdk-watermark fixture owns this exact historical shape; no real owner rows are copied into CI.

## Current local evidence and maintenance limit

Final81 DB migration controls pass; an earlier full284-case DB run covers identical runtime before
two added test-only controls. Original2 MIG-R06 native cases, the new retained-profile upgrade/restart
and unchanged SDK2 regressions pass retry0. Full73 cases are collected only; hosted execution remains.
See [actual results](../reviews/provider-sdk-compatibility.md#19-october--bounded-migration-repair-local-qualification)
for frozen hashes, retained fixture/test failures and evidence. No original-profile upgrade occurred.
The strict compatibility variant binds exactly22 canonical migrations; future migrations require
explicit reviewed identity/schema coverage. Keep generic future-watermark rejection intact.
