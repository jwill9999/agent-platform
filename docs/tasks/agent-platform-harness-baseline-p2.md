# Verify Ask Automatic and Block policy behavior

Beads: `agent-platform-harness-baseline-p2`. Parent: `agent-platform-harness-modernization`.

## Requirements

Matrix P2: Do Automatic and Block behave as the selected category promises?

Parameterized UI journey plus policy integration matrix

Save settings through the UI, read persisted policy, execute the same categorized action, check prompt count and durable effects. Derive expectations from policy precedence first: Automatic must not be assumed to override tool risk or explicit approval requirements. Record contradictory or unnecessary prompts as findings.

Source: [baseline matrix](../planning/harness-modernization/current-runtime-baseline-plan.md). This spec is a bounded backlog item, not a validated managed execution contract.

## Implementation plan and dependency order

Depends on `agent-platform-harness-baseline-map`. Suggested execution position: 6 of 18; order is a scheduling preference, not a claim that all areas technically depend on each other. Shared prerequisite completion does not grant implementation authorization. Review the chosen slice and any production seam first.

Inspect current source and tests before changing anything. Reuse existing helpers and evidence rather than duplicating them. Add the smallest missing test at the lowest useful layer. Preserve the real custom code under assessment and substitute only declared external boundaries. Use isolated data; no external paid calls. Apply the agreed defect repair rule: preserve a failing regression test, make a small directly related fix restoring established behavior, and rerun relevant gates within the approved task. Broader changes require a linked repair task and owner review.

## Tests and verification

Record exact commands and named assertions during coverage mapping. Integration permutations complement representative Electron Playwright journeys. For user-facing coverage, refine the applicable Gherkin scenarios from the [planning spec](agent-platform-harness-baseline-plan.md) before implementation; declare real versus fixture boundaries and independent backend postconditions. A page rendering pass is not backend execution evidence.

## Definition of done

Existing assertions and mock boundaries mapped; missing coverage added only within reviewed scope; reproducible command, source revision, sanitized evidence and limitations recorded. Runtime outcome is separate from task completion. Relevant quality gates pass for changed tests. Reproduced defects either repaired and verified within the agreed boundary or linked to scoped follow-up work; no unsupported pass or silent skip.

## Resume checkpoint and budget discipline

At every pause, update this Beads issue with: coverage mapped; tests reused/added; last command and result; artifact and revision; unresolved finding; next executable step; remaining scope/estimate. Record token usage only if available, never invent a per-task number. Work one task at a time and stop at the agreed slice boundary. No calendar deadline or continuous background run is implied.

Open means not started, in progress means actively claimed, and closed means the stated evidence deliverable is complete. A reproduced defect can be a completed assessment with a linked repair task; it is not a runtime pass. Blocked or missing evidence stays explicit. An unaffected conditional area can be scoped out only with recorded rationale and owner review.

## Authorization

Owner authorized creation of this backlog. Test implementation and product fixes remain subject to slice review. No original modernization gate is closed by this task creation.

## Agreed defect repair boundary

See the [owner-agreed repair rule](../planning/harness-modernization/current-runtime-baseline-plan.md#defect-repair-rule-agreed-with-the-owner). During an approved testing task, a small fix restoring established intended behavior can accompany the test without a separate approval request. Preserve failure evidence and the regression test, record cause and minimal fix, and rerun relevant checks. Architecture, dependency, public-contract, permission-policy or broader behavior changes require a linked repair task and owner review. Unclear expected behavior is a decision to surface, not implied repair authority. Planning and coverage-mapping tasks remain read-only; backlog execution is not authorized by this rule.

## Gherkin E2E Strategy — September 23 authorized tests

The owner approved execution of remaining baseline tests only. No application or policy changes.
Use isolated Electron app data, a real managed backend/SQLite and the existing external HTTP provider
and fixed-command runner fixtures. Change Workspace writes through the real settings UI, reload it
and independently read persisted settings before the same Project shell append request in each case.

```gherkin
Feature: Workspace write policy precedence
  Scenario Outline: Save a policy and request the same shell write
    Given I select <policy> for Workspace writes in Settings
    And the saved policy survives a reload and matches the backend record
    When I ask to append one line to a disposable Project file
    Then <approval> approval prompts appear
    And before any approval the file remains unchanged
    When the turn finishes after any required approval
    Then there are <effects> appended lines and successful execution records

    Examples:
      | policy | approval | effects |
      | Ask approval | 1 | 1 |
      | Auto-run | 1 | 1 |
      | Block | 0 | 0 |
```

Expected Auto-run prompting follows the existing explicit high-risk shell-redirection approval rule;
this test does not assert that all tools or policy categories behave the same way. Block must settle
with visible denial, no approval record and no file effect. Retain UI trace, selected/persisted policy,
provider call count, session identity, durable approvals/audits and file before/after on pass or failure.
Broader policy categories and direct file-tool behavior remain separate coverage. This spec refinement
changes a document bound by the proposed MVP contract; refresh that proposal's digest/critique before
any later full-tranche implementation approval. It does not activate that proposal.

### File-listing failure regression

```gherkin
Scenario: A file-listing error must not misrepresent saved permission settings
  Given the isolated workspace file listing fails because its root is unavailable
  And I save Block for Workspace writes through Settings
  When I reload Settings
  Then Workspace writes still shows Block, matching the persisted backend record
```

Use a regular disposable file as the workspace root parent to cause a real filesystem error; do not
mock the settings or file-listing API. Preserve the failing expectation as a tracked product finding.
