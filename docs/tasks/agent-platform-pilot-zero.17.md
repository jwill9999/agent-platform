# Task: Qualify the required standalone pilot execution path

**Beads:** `agent-platform-pilot-zero.17`  
**Parent:** `agent-platform-pilot-zero`

## Requirements and scope

This is a prerequisite proposal from the [readiness assessment](../reviews/orchestration-readiness-refresh-2026-09-26.md).
It gates the first implementation pilot; it does not authorize runtime implementation or a pilot launch.
Use a reviewed bounded execution plan before changing runtime behavior. Preserve the current durable
journals, approval bindings, isolation and broker authority. No A2A, packaging or staging expansion.

## Implementation plan

Establish the exact standalone host, phase sequence and source revision. For each requirement,
first reuse existing conformant interfaces; scope a repair only where evidence proves it necessary:

- R1: authoritative canonical workspace/task/material run discovery, distinguishing absence from
  failed lookup and fencing concurrent creation. Known-ID status alone is insufficient.
- R2: implementation output imported through a supported, journaled path with source, artifact,
  approved-material and task bindings. Removing the current rejection is insufficient.
- R3: required coordinator phases complete through authorized production transitions with durable
  evidence. Do not manufacture generic completion receipts or bypass coordinator-only authority.
- R4: the selected host's actual executable paths, image, model connection and limits are verified.
  Fixture WORKFLOW_GIT_BINARY does not override every production `/usr/bin/git` call. Do not accept
  a system licence on the owner's behalf. Desktop resumption is separate from a standalone pilot.

## Dependencies

Blocks `agent-platform-pilot-zero.13` directly. No dependency on `.12` is added: the assessment can
report these limitations without waiting for repairs. Beads is authoritative for these edges.
Historical notification/continuation work is supporting evidence, not proof these paths are complete.

## Verification and definition of done

Bind every result to the tested source and configuration. Verify no-run/matching-run/failed-lookup
and concurrent start behavior; altered, duplicate and interrupted artifact imports; stale authority,
coordinator failure/restart and dependent-task blocking. Retain both permitted and rejected outcomes.
Prove the actual selected host commands and connected transition path, not just fixture transport.
Independent review must cover the proposed repairs and their evidence. Missing required checks keep
this gate open. Close only after required integration and successful qualification, without claiming
that this prerequisite test itself constitutes the separately approved single-task pilot.

## Planning handoff

Owner authorized preparing the bounded plan on 26 September, after PR274 merged. See
[proposed repair plan](../planning/standalone-pilot/plan.md),
[verification matrix](../testing/standalone-pilot-prerequisites.md), and
[independent review](../reviews/standalone-pilot-plan-review.md).
Planning branch: `task/standalone-pilot-plan`, from `feature/harness-backlog-review` at
`a8586aa425fc4907ef7aa374ff2d283d6eb0a1cd`. Canonical Beads remains the main repository.
The proposed execution contract is not persisted approval or authority to launch a pilot.
