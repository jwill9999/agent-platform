# Task: Enable supervised evidence-only independent critique

**Beads:** `agent-platform-pilot-zero.15`

## Requirements

Owner authorized a separate reviewer to read planning/skills/implementation evidence and return gap
analysis without mutations. Outside active managed runs, document a bounded no-tool supervised route.
Do not claim that instruction restrictions disable inherited tools or replace autonomous isolation.

## Scope and implementation

Update ADR-0004, security guidance, critique skill and review/session evidence. Verify canonical run
state read-only, supply bounded evidence to a distinct critic, record findings and limitations, and
correct review findings. No launcher/runtime changes, paid external calls, pilot launch or promotion.

## Dependencies

Related to pilot-zero.9/.12 and the existing critic skill. No active-run dependency may be bypassed;
this exception applies only after confirming no managed run or live broker authority owns the work.
The pilot remains dependent on its formal schema/approval/runtime prerequisites.

## Verification and definition of done

Markdown, skill and link checks pass. A distinct evidence-only critic returns a review; retain its
scope, identity, material description and findings without calling it a formal contract approval.
Record observed tool use or audit limitations. Keep supervised acceptance separate from technical
isolation. Required review/integration evidence must precede final closure.

## Git and sign-off

Existing task/permission-category-baseline segment targets feature/harness-backlog-review. Owner
approved bounded implementation; no merge or staging/main promotion. Publish review evidence and
sync Beads. Formal workflow approval is not supplied by this task.

## Subsequent owner authorization: enforced reviewer entry point

Owner explicitly authorized filling the technical gap. Scope now includes supervisedReview.ts,
supervisedReviewCli.ts, index exports and focused tests in workflow-control, plus corresponding
guidance. The entry point prepares content-addressed private evidence, uses the existing isolated
plan_critic container path, returns findings only and stops/removes its named container on completion
or failure. This does not change active-run authorization or issue production credentials.

Live model review still needs an immutable Codex image, dedicated model authentication and provisioned
model-only egress. Configuration names alone do not prove network restriction. Missing prerequisites
prevent claiming that formal review is operational. Existing primary credentials are not copied as a
shortcut. The owner must not be told this is complete until the live path is qualified.
