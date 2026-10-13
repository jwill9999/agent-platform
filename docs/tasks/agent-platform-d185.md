# Task: Keep GitHub read requests from blocking the local API

**Beads issue:** `agent-platform-d185`  
**Spec file:** `docs/tasks/agent-platform-d185.md`  
**Parent epic:** none; discovered from the closed context/token optimisation task.  
**Status:** proposed v2; planning only, awaiting owner implementation approval.

## Task requirements

Implement GR-R1–GR-R7 in the [bounded plan](../planning/github-read-responsiveness.md): asynchronous
checks/PR-list reads, total deadline/output/concurrency bounds, cleanup, stable identity, compatible
failures and post-create enrichment, with responsive chat and diagnostics under overlap.
The plan is authoritative for numerical bounds and exclusions; no unrelated Git rewrite.

## Dependency order

No blocking upstream or downstream edges exist. The `discovered-from` context task is closed and
is provenance, not a scheduling gate. PR319 is independent handoff documentation. Keep this one
existing bug as owner of all slices and final integrated verification; no extra epic or subtasks.
If a true new blocker appears, link it in Beads and this specification before changing the sequence.

## Implementation plan and Git workflow

After owner approval, chain `task/github-read-responsiveness` from pushed
`task/github-read-responsiveness-plan`, then `task/github-read-verification`. Their integration
branch is `feature/github-read-responsiveness`, based on staging1e4bd7af. Refresh refs and rehearse
changed bases before implementation/integration; preserve both documentation histories if PR319
lands separately. No merge or deletion is authorized by this plan.

Follow the three slices and bounded source areas in the plan. Preserve write helpers; update every
read caller including post-create enrichment. Use normal hooks and independent review. The final
tip owns the task-to-feature PR, required exact-head hosted checks, and all final evidence.

## Tests and verification

[GR-T01–GR-T10](../testing/github-read-responsiveness.md) map every requirement to inputs, expected
behavior, environments and evidence. Required connected browser and Electron journeys use real
API/SQLite/BFF and external-boundary doubles, not mocked application endpoints. Test all lifecycle
failure paths below API level and native export through the actual desktop action. Docker export is expected to be denied; successful browser V1 export is
mandatory in the existing managed-loopback Chromium fixture, not the Docker topology.

### Gherkin E2E Strategy

```gherkin
Feature: Work continues while GitHub reads are slow
  Background:
    Given an isolated running app with a real owned Git repository and synthetic GitHub origin
    And a deterministic provider and a controllable external GitHub CLI fixture

  Scenario: Chat and diagnostics remain usable during a slow read
    Given checks and pull requests have reached a held child-ready marker
    When I send a Project message that performs an allowed synthetic tool action
    Then the reply and tool effect complete before either held read is released
    And I can export a safe report with the correlated durable events
    And releasing the reads displays checks for the correct repository and branch

  Scenario: An unavailable read does not poison later work
    Given a GitHub read times out or is actually aborted
    When I retry by refreshing after the fixture is healthy
    Then the existing unavailable state clears with correct new results
    And chat and diagnostics remain usable with no leaked child process

  Scenario: Cancelled or denied agent work remains safe under concurrent reads
    Given slow GitHub reads and a tool approval request
    When I deny or cancel the agent action
    Then no prohibited file effect is present after the run settles
    And the diagnostic report records the correct terminal state
```

## Definition of done and pre-close sign-off

- GR-R1–R7 and all required GR-T scenarios pass on the declared source revision; first failures and
  boundaries are retained in the review/results record, not overwritten by a retry.
- Relevant unit/integration/browser/Electron and existing diagnostics performance checks pass;
  build, typecheck, lint, formatting, docs/links, cycles and normal hooks pass.
- Independent source/evidence review has no actionable findings. Sonar/Problems gate passes using
  the documented fallback if unavailable; current hosted Sonar/CodeQL and review threads clear.
- Beads criteria/spec/results align, full changed Notion mirrors read back, source committed/pushed.
- Owner acceptance and authorized segment-tip PR integration into feature are recorded before task
  closure. Protected staging additionally requires actual full scan and packaged VM gates under
  separately granted merge authority. No production/main/distribution completion inferred.
- At closure read back Beads as closed and verify Dolt push; preserve dirty/paused work and refs.

Planning sign-off is recorded in the [review](../reviews/github-read-responsiveness.md). All product
verification and implementation sign-off are **not run / not granted** at this planning checkpoint.
