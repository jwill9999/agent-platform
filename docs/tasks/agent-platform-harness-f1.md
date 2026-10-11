# Candidate provider/package compatibility

Beads issue: `agent-platform-harness-f1`. Status and scheduling authority: Beads.

Parent: `agent-platform-harness-modernization`. Proposal label: F1.

## Requirements

Validate F0 candidate sets through bounded package/offline and separately authorized live checks; Node/ESM/Electron native constraints; configured OpenAI/Anthropic/Ollama URLs, streaming, tools, errors, permissions and approvals. Record unavailable evidence as blocked, not pass.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: `agent-platform-harness-review-gate`, `agent-platform-harness-f0`.

Downstream new records: `agent-platform-harness-f2`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Validate official-source evidence, candidate version assumptions, dependency graph and decision record; distinguish offline checks from separately authorized provider experiments. No runtime pass may be inferred from documents.

## Definition of done

Validate F0 candidate sets through bounded package/offline and separately authorized live checks; Node/ESM/Electron native constraints; configured OpenAI/Anthropic/Ollama URLs, streaming, tools, errors, permissions and approvals. Record unavailable evidence as blocked, not pass. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 2–4 provisional person-days.

## Focused compatibility contract — planning revision

After F0 and explicit experiment authorization, validate only the selected candidate cohorts in isolated scratch fixtures, preserving product manifests/lockfile. Document exact packages, runtime and reproducible commands. Trial installations are part of later authorized assessment execution, not current planning. Live providers require dedicated available credentials and an owner-agreed spend cap; otherwise report that row blocked. Do not ask for secret values in chat.

| Check                  | Required observation                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package/runtime        | Dependency resolution, TypeScript compile, ESM imports and native/Electron packaging compatibility; distinguish Node success from Electron evidence |
| Provider configuration | User-selected model, credentials and custom base URLs preserved for OpenAI, Anthropic and Ollama; explicit migration for protocol changes           |
| Streaming              | Ordered text/tool events, stream completion, interruption and provider errors reach the existing boundary without fabricated success                |
| Tool protocol          | Arguments/results keep their call identity; invalid arguments and errors are handled; no duplicate tool dispatch                                    |
| Permissions/approvals  | Existing application authorization still mediates calls; denied/unapproved tools do not execute; framework defaults cannot bypass guards            |
| Usage/telemetry fit    | Identify native compatible instrumentation, default payload capture controls, usage fields and missing values; no full dashboard implementation     |

Each check has pass/fail/blocked/not exercised plus source or execution evidence. A deterministic stub proves adapter behavior, not provider compatibility. One controlled live case per available provider is sufficient initially; repeat only for a concrete failure or uncertainty. Record native packaging limitations and downgrade recommendation confidence rather than waive parity. Deliver a matrix and bounded residual risks for F2.

## Orchestration observation during assessment

Use the [orchestration observation protocol](../planning/harness-modernization/orchestration-observation.md). Record snags as Beads findings with evidence and observed execution mode; supervised assistant work is not an autonomous pilot. New repairs require separately scoped authorization.
