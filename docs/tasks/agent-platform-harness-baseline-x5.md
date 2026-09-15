# Verify persisted approval resume and interrupted state

Beads: `agent-platform-harness-baseline-x5`. Parent: `agent-platform-harness-modernization`.

## Requirements

Matrix X5: Does persisted state support correct approval resume and truthful interrupted-run recovery?

[Approval routes](../../apps/api/test/approvalRequestsRouter.test.ts), [session lock](../../apps/api/test/sessionLock.test.ts), [session chat](../../apps/api/test/sessionChat.integration.test.ts)

Integration plus existing approval UI journey: preserve request, arguments, session and permissions across supported resume; test duplicate/concurrent resume. Inspect durable records and effects after reconnect/reload. Process restart is a separate capability check: record unsupported recovery explicitly; no new unattended orchestration promise or implementation. Reuse P3 evidence.

Source: [baseline matrix](../planning/harness-modernization/current-runtime-baseline-plan.md). This spec is a bounded backlog item, not a validated managed execution contract.

## Implementation plan and dependency order

Depends on `agent-platform-harness-baseline-map`. Suggested execution position: 9 of 18; order is a scheduling preference, not a claim that all areas technically depend on each other. Shared prerequisite completion does not grant implementation authorization. Review the chosen slice and any production seam first.

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
