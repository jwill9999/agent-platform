# Verify retries execution limits and duplicate-effect handling

Beads: `agent-platform-harness-baseline-x3`. Parent: `agent-platform-harness-modernization`.

## Requirements

Matrix X3: Do retries and execution limits prevent duplicate effects or unbounded work?

[Retry](../../packages/harness/test/retry.test.ts), [deadline](../../packages/harness/test/deadline.test.ts), [tool dispatch](../../packages/harness/test/toolDispatch.test.ts)

Integration injects a transient failure before an effect and an ambiguous result after an effect. Record attempt count, operation identity, execution count and final outcome. Verify configured step/tool/deadline limits; flag uncertain side effects rather than blindly retrying. Do not assume current exactly-once guarantees.

Source: [baseline matrix](../planning/harness-modernization/current-runtime-baseline-plan.md). This spec is a bounded backlog item, not a validated managed execution contract.

## Implementation plan and dependency order

Depends on `agent-platform-harness-baseline-map`. Suggested execution position: 17 of 18; order is a scheduling preference, not a claim that all areas technically depend on each other. Shared prerequisite completion does not grant implementation authorization. Review the chosen slice and any production seam first.

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
