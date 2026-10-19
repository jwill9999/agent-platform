# Task: maintained provider SDK compatibility and choice

Beads: `agent-platform-provider-interoperability` (P1 feature, in_progress).
Spec: docs/tasks/agent-platform-provider-interoperability.md.

## Requirements and implementation

Implement SDK-R1–3/R5/R7 from the [plan](../planning/provider-sdk-compatibility.md): maintained
coordinated SDK, five native model families plus OpenRouter, shared saved configuration, encrypted
private continuation and preserved Stop/context/security. SDK-P01 is addressed by the independently
reviewed private-storage plan; final source and connected verification remain required.
Model IDs configurable, no automatic fallback/framework replacement/paid calls/paused edits.

## Dependency order and Git

Security activation is closed; actual baseece contains its source. No external unfinished prerequisite.
[Model diagnostics](agent-platform-model-connection-diagnostics.md) is related in the same segment,
not a blocking cycle. Shared adapter contracts first, then harness/persistence/probes and final gate.
Feature `feature/provider-sdk-refresh`; task `task/provider-sdk-refresh-plan` from actualstagingece.
One task→feature segment-tip PR, protected promotion only with actual authority; never main.

## Tests and definition of done

[S01–S12](../testing/provider-sdk-compatibility.md) with real SDK/provider fixtures and connected
browser/Electron/backend effects; deterministic/live/owner-app evidence distinct. Independent plan
critique, frozen source/results critique, no unresolved current-head quality/security/review blocker;
required declared integration merged with authority, source/history/docs/Beads readback and terminal
Dolt sync. SDK-R1–7 must be satisfied. No mocks/unit-only closure or false live stress-ready claim.

Sign-off: owner authorized18October; plan independently approved, implementation and qualification
in progress. Partial results are in the linked review; final source/connected/hosted sign-off and
declared integration remain outstanding.

## Gherkin E2E Strategy

```gherkin
Feature: Configurable models with honest connection evidence
  Background:
    Given the connected app uses a disposable profile and real backend database
    And external model services are researched deterministic HTTP fixtures
  Scenario: Save and select an alternative provider
    When I save a provider and model with its own credential
    And select it for a Project chat
    Then its SDK request reaches the selected provider fixture
    And I see its reply persisted after reopening the session
  Scenario: Rejected connection is visible and recorded
    When I test a model whose provider rejects an unsupported parameter
    Then I see an accessible failed connection with safe guidance
    And the durable diagnostic report records a failed probe without secrets
    And no retry or false successful result occurs
  Scenario: Valid approval and completed history preserve private continuation
    Given a model requests an approval-required tool
    When I approve it before restarting the disposable backend
    Then the tool executes once through existing permissions
    And the model receives valid continuation and returns its final reply
    When I restart the backend and send a new request
    Then completed history retains valid private continuation
    And denying another action produces no tool effect
    And public messages and diagnostic exports contain no private provider marker
  Scenario: A process restart fences an old pending approval
    Given a model requests an approval-required tool
    When the disposable backend restarts before approval
    Then the old approval is rejected as interrupted
    And no new provider request or tool or file effect occurs
```

Playwright must exercise visible actions through the real UI and independently verify backend
fixture requests, persisted records and denied/cancelled absence of effects. S08/S09 own browser and
Electron runs; preserve failure traces before repair. No task close while required journeys fail.

## S12 owner-profile upgrade follow-up

SDK source was delivered to staging through PR363 atbe153c50. The actual owner preflight found a
legacy journal watermark incompatibility on a private copy; original data/history/key were preserved
and the prior app restored. [SDK legacy migration repair](agent-platform-sdk-legacy-migration.md)
now blocks this parent's S12 completion in canonical Beads. No source delivery or fixture result
substitutes for the actual preserved-profile recording/export/restart and owner live-model readiness.

Refined repair contract and DB/native source passed independent review. Local81 migration controls,
retained original2 native cases, the new upgrade/restart and unchanged SDK2 pass retry0. Full73 cases
are collected only; new hosted feature/protected qualification and actual original-profile S12 remain
open. The restored owner app still uses its previous SDK; no live model/stress success is claimed.
The repair spec/results retain failures, exact source bindings and the22-migration maintenance limit.
