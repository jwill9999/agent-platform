# Modernization options and support assessment

Beads issue: `agent-platform-harness-f0`. Status and scheduling authority: Beads.

Parent: `agent-platform-harness-modernization`. Proposal label: F0.

## Requirements

Inventory installed SDK/provider/graph/UI/instrumentation dependencies; assess recent stable supported candidates, peer/engine requirements and migration guides. Compare existing-runtime upgrade against framework adoption, marking retained/replaced packages and potentially wasted prior upgrades. Deliver candidate sets, effort/risk ranges and experiment order; no claim of validated compatibility.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: `agent-platform-harness-review-gate`.

Downstream new records: `agent-platform-harness-v3`, `agent-platform-harness-f1`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Validate official-source evidence, candidate version assumptions, dependency graph and decision record; distinguish offline checks from separately authorized provider experiments. No runtime pass may be inferred from documents.

## Definition of done

Inventory installed SDK/provider/graph/UI/instrumentation dependencies; assess recent stable supported candidates, peer/engine requirements and migration guides. Compare existing-runtime upgrade against framework adoption, marking retained/replaced packages and potentially wasted prior upgrades. Deliver candidate sets, effort/risk ranges and experiment order; no claim of validated compatibility. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 1–2 provisional person-days.

## Focused assessment contract — planning revision

Produce a dated inventory from package manifests AND lockfile for AI SDK, providers, LangChain/Graph, Zod, telemetry, Node and Electron/native dependencies. For each record installed version, candidate version, engine/peer range, official migration source, retained/replaced role and known uncertainty. A release being recent is not evidence it is mutually compatible or supported; record the published support evidence or mark unknown.

Compare exactly two primary routes: upgrade the existing AI SDK-based runtime; adopt supported LangChain providers/loop and retire replaced SDK responsibilities. Treat coexistence as a bounded transitional variant, with removal criteria. Use the current implementation as behavioral baseline, not the mandatory target. Include Ollama native versus OpenAI-compatible URL semantics. Do not build an SDK-to-framework bridge merely to avoid evaluating migration.

Deliver the candidate matrix, preserved-behavior checklist, potential duplicated upgrade work, proposed experiment order and revised effort range. Research is read-only against product source; output only specs/decision evidence. No package installation, model call, framework migration or full telemetry design occurs in this task without separately extended authority. Stop after two viable candidates or evidence that one is infeasible; do not broaden to unrelated frameworks. Record unresolved parity checks for F1 rather than claiming validation.

Evidence sources: packages/model-router/src/providers.ts, packages/harness/package.json, pnpm-lock.yaml, packages/harness/src/nodes/llmReason.ts and toolDispatch.ts, apps/desktop/package.json; use official TypeScript migration/support documentation. The inventory must refresh the actual accepted baseline rather than copy historical version numbers from research.

## Orchestration observation during assessment

Use the [orchestration observation protocol](../planning/harness-modernization/orchestration-observation.md). Record snags as Beads findings with evidence and observed execution mode; supervised assistant work is not an autonomous pilot. New repairs require separately scoped authorization.
