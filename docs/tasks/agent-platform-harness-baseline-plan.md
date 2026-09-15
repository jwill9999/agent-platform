# Plan current-harness decision evidence

Beads: `agent-platform-harness-baseline-plan`; parent: `agent-platform-harness-modernization`.

## Requirements

Prepare a decision-focused plan for verifying custom harness behavior before comparing migration routes. Map existing tests and mocks; identify the minimum missing model-to-tool, planning/completion and execution-control journeys. Include tool adequacy/exposure, Ask/Automatic/Block policy precedence, scoped human overrides and replay protection, plus critic/DoD failures and missing UI feedback. Planning only.

## Plan and dependency order

See [proposed baseline plan](../planning/harness-modernization/current-runtime-baseline-plan.md). Start with coverage mapping and provider-fixture feasibility, then propose one sequential implementation slice. No hard dependency on the earlier test task's merge is created by this planning document. Product changes, live paid calls and expanded tests await owner review; original modernization experiment tasks remain queued.

## Proposed Gherkin E2E Strategy

```gherkin
Feature: Current runtime model-to-tool evidence
  Background:
    Given an isolated Project and known sample file
    And the real reasoning node, AI SDK and application backend run
    And a reviewed local provider fixture supplies deterministic responses
  Scenario: Complete an authorized tool round trip
    When I request the file operation and approve any required action
    Then the file changes exactly once
    And the provider receives the correctly identified tool result
    And the UI and durable backend evidence agree on the outcome
  Scenario: Deny the operation
    When I deny the requested action
    Then the file remains unchanged after the turn settles
    And backend evidence records denial without successful execution
```

The provider fixture seam and chosen tool are proposed, not implemented or approved. Detailed integration cases supplement these UI scenarios where appropriate.

## Expanded acceptance families

The [version 3 matrix](../planning/harness-modernization/current-runtime-baseline-plan.md#decision-evidence-matrix-added-after-owner-review) maps T1–T2 tooling, P1–P4 permission controls, and C1–C4 critic/completion to required backend evidence and test layers. The additional X1–X7 inventory covers context, cancellation, retry/limits, plan-driven execution, persistence/resume, provider streams/usage, and affected auxiliary calls. Each row must map exact existing assertions and mocks before missing tests are proposed. These are proposed checks, not implemented tests or verified results.

```gherkin
Feature: Policy and evaluation evidence
  Scenario: Apply a selected execution policy
    Given an isolated project and a known categorized action
    When I select Ask, Automatic or Block through settings
    Then execution and prompts follow the documented effective policy
    And saved settings, audit records and file outcomes agree
    And unrelated permissions remain unchanged
  Scenario: Revise an answer after critic feedback
    Given controlled external model responses and real evaluator nodes
    When the critic requests revision and later accepts
    Then the agent receives the feedback and produces a revised answer
    And the visible verdict agrees with backend evidence
  Scenario: Evaluation cannot establish completion
    When evaluation fails or exhausts its configured limit
    Then the evidence report distinguishes unavailable review from successful review
    And records any misleading runtime or UI outcome as a finding
```

Missing UI feedback is an owner-reported observation awaiting reproduction. Security edge cases belong mainly in backend integration tests. Tool-choice quality requires a separately authorized live-model evaluation; deterministic execution tests do not prove it.

## Verification and definition of done

Source anchors exist, evidence boundaries are explicit, first-journey success/negative outcomes and required backend artifacts are defined, scope/stop conditions are bounded, and the scorecard distinguishes verified behavior, defects, blocked and unexercised paths. Document checks pass and the proposal is pushed for owner review. This plan is not an execution or runtime pass.

## Sign-off

Owner authorized planning on September 15, 2026. Implementation and owner acceptance of the proposed plan remain pending.
