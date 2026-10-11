# Orchestration observations during modernization

This protocol supports later evaluation of the project-delivery orchestration feature already in staging. It does not authorize live orchestration activation, specialist launch, seeded failures or repairs. Modernization planning remains sequential and uses existing research without additional subagents.

## Reuse the existing evidence model

Read [pilot-zero assessment](../../tasks/agent-platform-pilot-zero.md), [autonomous delivery pilot](../../tasks/agent-platform-multi-agent.10.md), [continuations](../../workflow-control-continuations.md) and [evidence evaluation](../../workflow-control-evidence-evaluation.md). Beads and the approved workflow journal retain authority; this document defines observation fields, not a second task tracker. Existing historical findings are leads for revalidation, not newly reproduced defects.

## Record a snag where it is observed

Attach the finding to the active Beads assessment task and link the existing pilot/repair issue when applicable. Use the journaled broker during an active managed run. Do not silently mutate the old orchestration epic or duplicate its repair tasks. A separate repair issue requires scope review before implementation.

Minimum record: observed time; task and phase; source/config/runtime revision; execution mode (supervised, managed runtime, fixture); expected trigger; actual next action; sanitized evidence reference; impact; attempts; time waiting when measurable; human/parent intervention and reason; recovery outcome; disposition (new, linked existing, not reproduced, blocked, resolved with evidence). Preserve identifiers in the evidence record, not user-facing narration. Never store credentials or unrestricted prompts.

Classify snags as dependency/readiness, planner/critic handoff, worker launch/settlement, parent continuation, notification/approval, output import, verification/review, delivery/closeout or tooling integration. A delivered message is not proof the next phase ran. Distinguish deliberate approval waits from missed continuation. Identify when a manual nudge unblocked work, rather than describing the run as uninterrupted.

## Current evidence boundary

This planning session is supervised assistant authoring. No new managed orchestration run or autonomous acceptance test has been launched. Earlier Beads connector/forward-dependency limitations are documented in the backlog review; they are not evidence of a new runtime continuation failure. Current work cannot certify the staging orchestration feature.

## Later evaluation

When a separately approved real workflow uses the feature, evaluate completion rate, successful next-phase transitions, unplanned interventions, retries, recoveries, blocked reasons, latency and token/cost coverage against the frozen criteria. Distinguish successful authorized human approvals from unplanned rescue. Preserve not-exercised cases explicitly.

An end-to-end acceptance run, seeded failure/repair and interruption scenarios remain governed by the existing pilot specification and exact approved contract. Modernization can provide observations, but cannot close the pilot solely because planning or CI succeeded. Summarize accumulated findings for owner review before changing orchestration policy or expanding scope.

## Separate long-term field evaluation

The owner clarified that ongoing real-use feedback is separate from modernization. Use [Project orchestration field evaluation](../../reviews/orchestration-field-evaluation.md) as the general guide for recording incidents, manual interventions and later repair feedback. This modernization-specific protocol is only an application of that process, not the owner of the evaluation programme.
