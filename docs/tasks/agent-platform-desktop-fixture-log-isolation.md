# Own every Electron fixture log directory

**Beads:** `agent-platform-desktop-fixture-log-isolation`, P1 bug, in progress.
**Plan:** [Monitoring preparation](../planning/monitoring-stress-readiness.md).
**Branch:** `task/desktop-fixture-log-isolation` from `feature/monitoring-stress-readiness`.

## Requirements and evidence

LOG01/LOG02 address confirmed OBS-OWN01: disposable Git E2E launches overwrote retained owner
backend logs. Runtime directory and HOME overrides do not determine Electron's independent log
directory; the backend opens those selected logs for writing. This is not established as the cause
of the separate monitoring failure. Preserve original evidence under Codex home.

Audit all managed Electron launches and helpers. Initial source inspection found missing explicit
log roots in three Git launches, two Project-access launches, Webview and resource-export fixtures.
Each must use its own runtime log root, overriding an inherited production log setting. Preserve
existing fixture data, ports, assertions, network guards and product defaults.

## Dependencies and implementation

No new upstream dependency. Downstream: the provenance task's connected checks and the existing
owner trial depend on this isolation. Beads remains authoritative for scheduling.

1. Complete independent source-aware review of this scope and verification before implementation.
2. Bind every audited fixture's log directory explicitly to its disposable runtime; add a guard
   that catches an omitted or inherited log root at the actual managed-launch sites/helpers.
3. Exercise production path resolution and backend log opening with disposable fake child processes:
   unrelated sentinel stdout/stderr bytes must survive success, failure, restart and owned cleanup.
4. Retain owned launch/failure log evidence before cleanup. Run affected native Git journeys and an
   adjacent export journey only after non-native isolation controls pass.
5. Update results/session/Beads, use normal hooks and push the intermediate task. The following task
   branches from this accepted tip. Its final segment PR carries both repairs into the feature.

## Tests and Gherkin strategy

See LOG-T01–04 in [verification](../testing/monitoring-stress-readiness.md).

```gherkin
Feature: Disposable Electron tests preserve unrelated logs
  Scenario: A Git fixture runs with owned logs
    Given unrelated sentinel backend logs and an isolated fixture runtime
    When the connected Git workflow opens and settles
    Then the original visible Git assertions pass
    And only the fixture log directory contains its backend output
    And the unrelated sentinel logs remain byte-identical

  Scenario: A failed fixture retains its evidence
    Given isolated fixture logs and unrelated sentinel files
    When the owned backend fails and the fixture cleans up
    Then its safe failure evidence is retained before cleanup
    And the unrelated sentinel files remain unchanged
```

The controlled-child test proves path/log behavior, not Electron UI. Actual affected native journeys
prove their existing UI/API/SQLite/Git boundaries with deterministic external fixtures. No owner
profile, live provider or real remote mutation is used.

## Definition of done and sign-off

All managed launch sites audited, regression guard and sentinel/failure controls pass, affected native
journeys pass without retry, applicable desktop build/type/lint/format/normal hooks pass, source and
evidence independently reviewed, intermediate tip pushed and segment integration gate recorded.
Do not close merely for adding an environment line. No product log policy, deadlines or recovery
behavior change belongs to this task. Results/review/sign-off are pending; no tests claimed here.
