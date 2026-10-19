# Task: honest model connection results and durable evidence

Beads: `agent-platform-model-connection-diagnostics` (P1 bug, in_progress).
Spec: docs/tasks/agent-platform-model-connection-diagnostics.md.

## Requirements and implementation

Implement SDK-R4/R6 from the [plan](../planning/provider-sdk-compatibility.md). Retained HTTP400
unsupported_parameter max_tokens is failed generation, never success. Safe fixed error categories,
accessible visible error and durable metadata/correlation include settings probes. No raw provider
body/key/prompt/private data, credential replacement or additional paid calls. Valid-key authentication
is not generation compatibility. Explain failure cause separately from the historical detection gap.

## Dependency order and Git

Related [provider task](agent-platform-provider-interoperability.md), no cycle. Shared adapters first;
probe/diagnostics and final integrated qualification follow. Same task/provider-sdk-refresh-plan to
feature/provider-sdk-refresh cumulative segment-tip PR. No close before actual declared integration.

## Tests and definition of done

[S04/S05/S08/S10/S11](../testing/provider-sdk-compatibility.md) pass, including SDK rejected-parameter
response/malformed success/visible failure/durable export/restart/privacy. No keyword success or probe
retries. Independent critique and all current-head gates/comments clear; declared segment merge with
authority, Beads readback/Dolt sync. Sign-off: plan approved; implementation and qualification in
progress. Partial results are in the linked review; final connected/hosted sign-off and declared
integration remain outstanding.

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
