# Map existing baseline coverage and resolve provider fixture feasibility

Beads: `agent-platform-harness-baseline-map`. Parent: `agent-platform-harness-modernization`.

## Requirements

Inspect exact existing tests/assertions and internal mocks for all T1-T2, P1-P4, C1-C4 and X1-X7 rows. Resolve a local provider HTTP fixture seam preserving real provider factory, AI SDK and reasoning node. Deliver coverage classification, runnable command references, evidence capture design and a bounded first-slice estimate. No test implementation, package changes or paid calls in this task.

Source: [baseline matrix](../planning/harness-modernization/current-runtime-baseline-plan.md). This spec is a bounded backlog item, not a validated managed execution contract.

## Implementation plan and dependency order

Depends on `agent-platform-harness-baseline-plan`. Suggested execution position: 1 of 18; order is a scheduling preference, not a claim that all areas technically depend on each other. Shared prerequisite completion does not grant implementation authorization. Review the chosen slice and any production seam first.

Inspect current source and tests before changing anything. Reuse existing helpers and evidence rather than duplicating them. Add the smallest missing test at the lowest useful layer. Preserve the real custom code under assessment and substitute only declared external boundaries. Use isolated data; no external paid calls. Link a reproduced product defect to separate scoped work instead of quietly broadening the task.

## Tests and verification

Record exact commands and named assertions during coverage mapping. Integration permutations complement representative Electron Playwright journeys. For user-facing coverage, refine the applicable Gherkin scenarios from the [planning spec](agent-platform-harness-baseline-plan.md) before implementation; declare real versus fixture boundaries and independent backend postconditions. A page rendering pass is not backend execution evidence.

## Definition of done

All 17 matrix rows classified sufficient, partial or absent with exact evidence references or explicit unknowns; fixture feasibility and any required production seam documented; first implementation slice cost and scope ready for owner review.

## Resume checkpoint and budget discipline

At every pause, update this Beads issue with: coverage mapped; tests reused/added; last command and result; artifact and revision; unresolved finding; next executable step; remaining scope/estimate. Record token usage only if available, never invent a per-task number. Work one task at a time and stop at the agreed slice boundary. No calendar deadline or continuous background run is implied.

Open means not started, in progress means actively claimed, and closed means the stated evidence deliverable is complete. A reproduced defect can be a completed assessment with a linked repair task; it is not a runtime pass. Blocked or missing evidence stays explicit. An unaffected conditional area can be scoped out only with recorded rationale and owner review.

## Authorization

Owner authorized creation of this backlog. Test implementation and product fixes remain subject to slice review. No original modernization gate is closed by this task creation.
