# Task: Critique multi-agent orchestration design

**Beads issue:** `agent-platform-multi-agent-review`  
**Spec file:** `docs/tasks/agent-platform-multi-agent-review.md` (this file)  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Run an independent maker-checker review of the approved multi-agent orchestration design before any
implementation child-task graph is created. The reviewer is read-only: it may inspect repository
documents and code but must not edit files, mutate Beads, or change external systems.

## Requirements

- Review `docs/tasks/agent-platform-multi-agent.md` against the existing architecture, shared agent
  instructions, locked decisions, and relevant implementation surfaces.
- Test the design for correctness, security, least privilege, durable recovery, bounded concurrency,
  Beads/Git ownership, delivery safety, observability, and verifiable acceptance criteria.
- Report only actionable findings, ordered by severity, with precise file/section evidence.
- Identify missing decisions, contradictions, untestable requirements, unsafe assumptions, and
  sequencing problems.
- Record a clear verdict: approved, approved with amendments, or blocked.
- Resolve every finding by amending the design or recording an explicit rejection rationale.
- Do not create implementation child issues until the review is resolved and approved.

## Dependency order

### Upstream — must be complete before this task

None. The epic refinement policy gate is already approved.

### Downstream — waiting on this task

The multi-agent implementation child-task graph. Its issues and focused specifications are created
only after this review closes successfully.

### Planning notes

This review task is a child of `agent-platform-multi-agent`. It is not part of the implementation
branch chain and introduces no production code.

## Implementation plan

1. Give an independent critic read-only access to the epic and relevant repository context.
2. Collect severity-ranked findings and an explicit review verdict.
3. Verify each finding against repository evidence.
4. Amend the epic and shared planning documents for accepted findings.
5. Record rejected findings with rationale.
6. Re-run documentation validation and close the review gate.
7. Create the implementation child issues and dependency graph only after successful sign-off.

## Tests and verification

- Confirm the critic did not mutate repository files, Beads, GitHub, or other external state.
- Confirm every finding cites a concrete document, section, or implementation surface.
- Confirm every finding has a recorded resolution.
- Run `pnpm docs:lint` after documentation amendments.
- Run `pnpm exec prettier --check` for every changed Markdown file.
- Run `git diff --check`.
- Confirm Beads shows this task as a child of `agent-platform-multi-agent`.
- Confirm no implementation child issues existed before review approval.

## First-pass review — 2026-08-30

**Reviewer:** Independent Codex `code_reviewer` subagent  
**Verdict:** `BLOCKED`  
**Mutation audit:** Reviewer reported no file, Beads, GitHub, Sonar, or other external-state changes.

| Severity | Finding                                                | Resolution                                                                                                                     |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Critical | Per-role least privilege was not enforceable           | Added operation-level capability matrix, minimal profiles, narrow brokers, deny-by-default built-ins, and resume revalidation. |
| Critical | Workflow-control runtime/trust boundary was undefined  | Accepted ADR-0004: repository-local Codex control plane in `packages/workflow-control`, outside `apps/api`.                    |
| High     | Deferred Beads closes could deadlock dependencies      | Close each child after its acceptance and required segment integration gate; final closeout closes only the epic.              |
| High     | Cross-store transitions lacked crash consistency       | Added fenced leases, CAS versions, persisted sagas, idempotency keys, authoritative reconciliation, and fault injection.       |
| High     | Parallel task graph contradicted linear Git policy     | Initial pilot now serializes every write task and permits concurrent read-only work only.                                      |
| High     | Raw `gh` authority was too broad                       | Narrow typed GitHub delivery broker is now a pilot prerequisite; arbitrary API/workflow/admin operations denied.               |
| Medium   | State machine omitted cancellation/recovery invariants | Added normative transition table, fencing, deadlines, retry accounting, cancellation, waiting, and recovery.                   |
| Medium   | Evidence policy lacked integrity and access controls   | Added hashes, bounded content-addressed storage, redaction, secret scanning, retention, role reads, and negative tests.        |
| Medium   | Task templates bypassed protected `staging`            | Corrected `docs/tasks/README.md` and `_template.md` to require feature → staging → human-approved main.                        |
| Low      | Sonar hotspot status was stale                         | Recorded hotspot `AZ4YM2i11EaT2bQAPFS4` as `REVIEWED / FIXED` with zero remaining to review.                                   |

All first-pass findings are accepted. The second pass must verify that the amendments are concrete,
internally consistent, and sufficient to unblock implementation planning.

## Second-pass review — 2026-08-31

**Reviewer:** Same independent Codex `code_reviewer` subagent  
**Verdict:** `BLOCKED`  
**Mutation audit:** Reviewer again reported no file, Beads, GitHub, Sonar, or other external-state
changes.

| Severity | Remaining finding                                                                                   | Resolution                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Specialist isolation and broker identity were asserted, and direct Beads access bypassed journaling | Defined external `codex exec` container/VM launch boundary, process-bound broker capabilities, malicious-specialist proof, and one journaled Beads write client. |
| High     | Intermediate-task closure still contradicted default DoD                                            | Updated `decisions.md`, task README, and template to distinguish exact-head intermediate closure from segment-tip PR closure.                                    |
| High     | No authorized commit and push path                                                                  | Added a narrow Git/ref broker for approved branch creation, exact-tree commits, and compare-and-swap pushes.                                                     |
| High     | Workflow became terminal before epic/Dolt closeout                                                  | Added non-terminal `finalizing`; `closed` now requires verified merge, epic close, Dolt sync, and final evidence.                                                |
| High     | Feature/CI repairs lacked task, branch, and Beads semantics                                         | Added contract-bounded append-only repair children, derived ids, linear branches, graph rules, budgets, and approval fallback.                                   |
| Medium   | Poll wakes and absolute wait expiry contradicted each other                                         | Split `next_poll_at` from `absolute_wait_deadline`; polls recheck and absolute expiry escalates exactly once.                                                    |

The second-pass findings are accepted. A final verification pass must confirm these amendments before
the review task can close or implementation children can be created.

## Third-pass review — 2026-08-31

**Reviewer:** Same independent Codex `code_reviewer` subagent  
**Verdict:** `BLOCKED`  
**Mutation audit:** Reviewer again reported no repository or external-state mutations.

| Severity | Remaining finding                               | Resolution                                                                                                                                             |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Critical | Built-in advisory agents shared broker identity | Once broker authority exists, every specialist uses the external isolated launcher; built-ins are pre-capability planning-only with no mutation tools. |
| High     | Shared instructions bypassed the Beads broker   | Added active-run broker exceptions to shared instructions, task README/template, and the global Beads skill.                                           |
| High     | Finalization recovery routed back to scheduling | Persist exact `recovery_target`; post-merge recovery returns only to `finalizing` or `escalated`.                                                      |
| Medium   | Template required closure before closure        | Split pre-close sign-off from the close transition and post-close authoritative verification.                                                          |

All third-pass findings are accepted. One final read-only verification must confirm there are no
remaining blocking contradictions before child creation.

## Final verification — 2026-08-31

**Reviewer:** Same independent Codex `code_reviewer` subagent  
**Verdict:** `APPROVED WITH AMENDMENTS`  
**Mutation audit:** Reviewer reported no repository or external-state mutations.

The reviewer found one localized high-severity mismatch: the tool-access table still described direct
orchestrator GitHub/Beads writes after the normative design moved all mutations behind brokers. The
table and policy rows now separate read-only GitHub/Beads adapters from broker-owned Git/ref, GitHub,
Beads MCP, and Dolt-sync mutations. Concurrency now explicitly counts externally isolated specialist
processes.

No architectural blockers remain. Implementation child tasks may be created after documentation
validation passes and this review task is closed.

## Definition of done

- [x] Independent read-only review completed.
- [x] Severity-ranked findings and verdict recorded.
- [x] Every finding resolved or rejected with rationale.
- [x] Approved amendments applied to the epic and supporting planning documents.
- [x] Documentation validation passes.
- [x] Review outcome is recorded in Beads and the session handoff.
- [x] Review task is closed before implementation child issues are created.

## Sign-off

- [x] Reviewer identity and review date recorded.
- [x] Reviewer made no repository or external-state mutations.
- [x] Parent epic and dependency order agree with Beads.
- [x] `bd dolt push` succeeds after closeout.

**Reviewer / owner:** Independent plan critic / primary orchestrator  
**Date:** 2026-08-30
