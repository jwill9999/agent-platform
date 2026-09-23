---
name: feature-implementation
description: Begin or continue Agent Platform feature or task implementation from an approved plan, checking scope and choosing orchestration or an explicitly permitted direct path before changes.
---

# Feature implementation

This is the handoff from planning to execution. Use before implementing a feature, repair, or planned
test slice; explanations and ordinary read-only inspection do not require an execution workflow.

1. Read [shared instructions](../../../docs/agent-instructions-shared.md), the relevant Beads task/spec,
   and the approved plan. Resolve objective, acceptance criteria, non-goals, dependencies, source and
   branch, allowed files/actions, roles, tests, retry/budget limits and delivery boundary. Inspect the
   working tree and preserve unrelated changes. Do not infer implementation approval from planning
   approval or a merged document.
2. Verify required critique and the owner's actual scoped authorization against current material.
   Reuse valid existing authorization; do not ask again merely because another phase starts. If
   material is missing, use [feature planning](../feature-planning/SKILL.md) and
   [plan critique](../plan-critique/SKILL.md) to resolve it. A read-only planning skill does not itself
   authorize edits, launch, publication or promotion.
3. Make the execution mode visible before mutations. For code changes, multi-step work, independent
   review or recovery, assess orchestration first. Load and follow
   [orchestration](../orchestration/SKILL.md). Do not use the absence of a run as a reason to skip it.
   A direct path is permitted only when the existing scoped authorization and repository policy
   allow it, with no active managed run owning the work. Record that mode and its reason; do not
   count direct execution as orchestration evidence. Do not silently switch when managed execution
   is required but unavailable.
4. Resolve technical facts from source and task evidence. Ask the owner only for an unresolved choice
   that changes scope, authority, intended behavior or destination. Report a missing skill/tool or
   runtime blocker specifically. Do not invent a confidence percentage, approval, launch interface
   or independent review to force progression.
5. Execute within the selected authorized path. Workers inherit its boundaries and do not choose
   their own bypass. Apply meaningful checks for the changed behavior, preserve failed evidence,
   and distinguish frontend/backend outcomes from mocks. Use the existing
   [quality gate](../playwright-quality-gate/SKILL.md) for browser journeys. If a repair expands the
   approved behavior or authority, surface that change before doing dependent work.
6. Deliver evidence and required task/session updates through the applicable broker or direct
   workflow. Honor the exact integration destination; feature approval does not imply staging or
   production. State remaining checks, review and merge obligations honestly.

Record missing planning inputs, routing ambiguity, repeated approval friction and manual interventions
in the [orchestration evaluation](../../../docs/reviews/orchestration-field-evaluation.md).
Skills guide decisions; runtime controls enforce permissions. Creating these skills does not start a
pilot or establish that their handoff works unattended.
