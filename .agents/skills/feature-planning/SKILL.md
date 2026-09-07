---
name: feature-planning
description: Draft or revise a repository feature execution contract from owner intent, Beads tasks, and code evidence before implementation approval.
---

# Feature planning

Build a proposed execution contract; do not approve it or mutate repository/external state.

1. Read `AGENTS.md`, the parent Beads issue and child specs, applicable ADRs, and the smallest useful
   set of repository files. Beads access is read-only during planning.
2. Resolve objective, requirements, non-goals, acceptance criteria, task dependencies, allowed paths,
   role assignments, operations, delivery destination, checks, retry limits, and escalation policy.
3. Ask the owner only when evidence cannot resolve a choice that materially changes scope, authority,
   destination, or policy. Present the choice and its impact compactly.
4. Produce execution-contract version `1` matching
   `packages/workflow-control/src/contracts.ts`. Do not invent evidence, repository names, branches,
   checks, or permissions.
5. Validate the draft with workflow control. A schema error or authority expansion returns the draft
   for correction; it is not an approval.
6. Hand the validated draft and cited evidence to a distinct `plan_critic`. After every finding has a
   recorded disposition and the critic approves the revised contract, request explicit human
   approval.

Any later material contract or policy change invalidates approval and repeats critique and human
approval. Prompts and this skill guide planning only; they do not grant runtime authority.
