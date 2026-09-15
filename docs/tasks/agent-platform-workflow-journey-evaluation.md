# Evaluate disposable Project Chat approval journeys

Beads: `agent-platform-workflow-journey-evaluation`. Owner authorized implementation of this bounded evaluation on September 15, 2026. Independent of unapproved framework migration. Beads remains task-state authority.

## Requirements and boundaries

Reuse the existing Electron packaged-command journey and deterministic model hook. Exercise real Project Chat navigation, project onboarding, approval/rejection controls, API, harness dispatch and durable audit records. Use an isolated project, database, runtime and ports per scenario; verify a known file before approval and after settlement. Default command runner is an explicit test double at the external VM boundary; it implements only the fixed fixture append operation. This validates application orchestration, not real model choice, provider APIs, VM isolation or generic command execution. No paid calls, production data, model SDK migration or new telemetry platform.

Produce Playwright attachments with backend events, sanitized NDJSON output, durable approval/tool audit facts, file state and an evaluation summary. Preserve evidence on failure before cleanup. Distinguish missing signals from passes. Correlate by the approval's session/run where available; log ordering alone is not complete distributed tracing.

## Gherkin E2E Strategy

```gherkin
Feature: Project Chat file-change approval
  Background:
    Given an isolated desktop Project with a known sample file
    And project instructions have been approved through the UI
    And deterministic model output requests one fixed append command
  Scenario: Approve a file change
    When I request the change
    Then the sample file remains unchanged while approval is pending
    When I approve the action
    Then the UI reports completion
    And the sample file contains exactly one appended line
    And durable approval and tool audit evidence confirm execution
  Scenario: Reject a file change
    When I request the change and reject its approval
    Then the UI reports rejection
    And the sample file is unchanged after the resumed turn finishes
    And durable evidence records rejection without successful tool execution
```

## Implementation plan and dependency order

Extend `apps/desktop/e2e/packaged-vm-command.e2e.ts` and its existing fixture only as needed. Add structured evidence capture and readable summary attachments. No hard prerequisite on the broader modernization review gate: this test/evaluation was separately authorized. Preserve existing VM readiness/failure scenarios. Branch from the pushed assessment tip; review destination is the existing harness feature integration branch. No merge to staging or main is authorized.

## Checks and definition of done

Focused new scenarios pass with real UI, backend audit and file-state assertions; existing adjacent command scenarios pass. Type/lint/format checks cover touched code, including E2E files not included in desktop build configuration. Run repository-required build and quality gates as applicable. Inspect failure artifacts, document genuine product gaps instead of weakening assertions, publish the test/evidence instructions and initial evaluation report, push and open a review PR. Hosted gates and review must pass before task closure; do not claim real VM acceptance from fixture results.

## Evaluation and sign-off

Owner approval covers this disposable evaluation implementation. Runtime/SDK migration, paid model experiments and broader orchestration repairs remain unapproved. Execution evidence and final outcome pending.
