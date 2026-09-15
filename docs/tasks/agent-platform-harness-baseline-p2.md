# Verify Ask Automatic and Block policy behavior

Beads: `agent-platform-harness-baseline-p2`. Parent: `agent-platform-harness-modernization`.

## Requirements

Matrix P2: Do Automatic and Block behave as the selected category promises?

Parameterized UI journey plus policy integration matrix

Save settings through the UI, read persisted policy, execute the same categorized action, check prompt count and durable effects. Derive expectations from policy precedence first: Automatic must not be assumed to override tool risk or explicit approval requirements. Record contradictory or unnecessary prompts as findings.

Source: [baseline matrix](../planning/harness-modernization/current-runtime-baseline-plan.md). This spec is a bounded backlog item, not a validated managed execution contract.

## Implementation plan and dependency order

Depends on `agent-platform-harness-baseline-map`. Suggested execution position: 6 of 18; order is a scheduling preference, not a claim that all areas technically depend on each other. Shared prerequisite completion does not grant implementation authorization. Review the chosen slice and any production seam first.

Inspect current source and tests before changing anything. Reuse existing helpers and evidence rather than duplicating them. Add the smallest missing test at the lowest useful layer. Preserve the real custom code under assessment and substitute only declared external boundaries. Use isolated data; no external paid calls. Link a reproduced product defect to separate scoped work instead of quietly broadening the task.

## Tests and verification

Record exact commands and named assertions during coverage mapping. Integration permutations complement representative Electron Playwright journeys. For user-facing coverage, refine the applicable Gherkin scenarios from the [planning spec](agent-platform-harness-baseline-plan.md) before implementation; declare real versus fixture boundaries and independent backend postconditions. A page rendering pass is not backend execution evidence.

## Definition of done

Existing assertions and mock boundaries mapped; missing coverage added only within reviewed scope; reproducible command, source revision, sanitized evidence and limitations recorded. Runtime outcome is separate from task completion. Relevant quality gates pass for changed tests. Reproduced defects linked to scoped follow-up work; no unsupported pass or silent skip.

## Resume checkpoint and budget discipline

At every pause, update this Beads issue with: coverage mapped; tests reused/added; last command and result; artifact and revision; unresolved finding; next executable step; remaining scope/estimate. Record token usage only if available, never invent a per-task number. Work one task at a time and stop at the agreed slice boundary. No calendar deadline or continuous background run is implied.

Open means not started, in progress means actively claimed, and closed means the stated evidence deliverable is complete. A reproduced defect can be a completed assessment with a linked repair task; it is not a runtime pass. Blocked or missing evidence stays explicit. An unaffected conditional area can be scoped out only with recorded rationale and owner review.

## Authorization

Owner authorized creation of this backlog. Test implementation and product fixes remain subject to slice review. No original modernization gate is closed by this task creation.
