---
name: feature-implementation
description: Carry an owner-authorized Agent Platform task through native implementation testing repair review and CI to final acceptance.
---

# Feature implementation

Use [documentation](../documentation/SKILL.md) and
[native development](../../../docs/development/codex-development.md).

## Resolve and execute the task

1. Resolve the owner's objective/task against canonical Beads, specs and the agreed requirements,
   definition of done and tests. Read dependencies, source, branches/delivery and owner authorization.
   Preserve dirty/unrelated work. State the selected task and destination; do not invent identity.
2. Complete missing planning and independent source-aware critique using
   [feature planning](../feature-planning/SKILL.md) and [plan critique](../plan-critique/SKILL.md).
   Reuse recorded owner decisions. End-to-end authorization covers reviewed planning-to-implementation
   and routine file/subtask refinements; do not repeat approval solely at a phase transition.
3. Execute with native tools under actual session permissions. No mandatory orchestration assessment,
   run discovery, sandboxed child, gateway/budget/admission qualification, broker-only publication
   or exact-document machine approval applies to ordinary developer work.
4. Implement, run meaningful affected tests, diagnose and repair, retry when evidence supports it,
   and obtain independent source-aware code review. Delegate with clear responsibility when useful;
   reviewers may inspect source using native tools. Preserve others' edits and real failure evidence.
5. Follow existing quality, security and [connected QA](../playwright-quality-gate/SKILL.md) gates.
   Check independent backend state/effects for product journeys and disclose fixtures/limits.
   Apply the diagnostic review checkpoints below to changes that exercise Agent Platform runs.
   Fix actionable findings within authorized scope; re-review changed semantics as needed.
6. Update/read back Beads, session and required repository documentation. Commit/push only scoped work,
   open the appropriate segment-tip PR and inspect all latest exact-head hosted checks/review findings.
   Continue normal repairs through green required tests/pipelines without another routine grant.
7. Return concrete tested revision/diff/checks/limitations for final owner acceptance. Passing CI or
   implementation authorization does not grant merge/deploy/release authority. Ask only when owner
   intent, agreed behavior/delivery, an expressly reserved action or required unavailable input needs
   a decision; report a real external/tool blocker rather than creating a custom prerequisite.

## Diagnostic feedback checkpoints

For features that exercise Agent Platform agent execution, use the existing
[local diagnostic reports](../../../docs/development/diagnostics.md) at two checkpoints:

- **After meaningful end-to-end testing:** review reports from the feature's main success path
  and a relevant failure or waiting path exercised in the actual application.
- **Before declaring the feature complete:** confirm that the reports explain the observed flow
  and that findings have a recorded disposition. Reuse the earlier evidence when the tested source
  and behavior remain applicable; collect fresh evidence after changes that invalidate it.

At each checkpoint:

1. Capture safe reports from the actual Agent Platform runs through the supported export or
   developer CLI. Link the tested revision, scenario, request/run identifiers and evidence location;
   disclose deterministic provider fixtures and other limits. Codex's own development transcript
   is not an Agent Platform diagnostic report.
2. Examine failures, slow steps, retries, waits and missing evidence. Check coverage, truncation,
   freshness and loss indicators before interpreting the timeline; absent events are not proof
   that an action did not occur, and a slow sample alone does not establish a regression.
3. Separate confirmed findings from hypotheses requiring reproduction. State observed facts,
   expected behavior, impact and the next useful check without inventing a cause.
4. Fix actionable issues within the current task's scope and reverify them. For other actionable
   improvements, check for an existing Beads issue, then update it or create a linked finding with
   safe evidence, impact and a suggested next step. Do not silently expand the feature or implement
   an unrelated improvement merely because diagnostics exposed it.
5. Record a short outcome in the task's Beads notes and existing verification/results record,
   including evidence links, findings/dispositions and coverage limits, even when no findings arise.

Keep this review proportional to the change. Documentation-only changes and work that does not
exercise agent execution can record **not applicable** with a brief reason. If diagnostics cannot
be collected, record the reason and the resulting evidence gap; do not claim a clean review or
waive a required acceptance test. Existing completion, privacy and security gates still apply.
This is a development review step, not background monitoring, automatic harness modification or
a prerequisite to build V2–V5 dashboards/exporters. Sharing reports or making paid provider calls
still requires the authorization applicable to that task.

The [orchestration skill](../orchestration/SKILL.md) applies only to an explicitly selected PAUSED
workflow-control prototype, not default native development. Its enforcement remains intact; no
prototype or old automation resumption is implied. Product security and runtime permissions remain
separate from developer authority. Historical approvals/reviews must not be fabricated or relabeled.
