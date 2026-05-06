# Epic: Project onboarding and `AGENTS.md` lifecycle

**Beads issue:** `agent-platform-project-onboarding`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-onboarding.md`

## Objective

Complete the Project onboarding experience so a newly opened code Project can be assessed,
understood, documented in `AGENTS.md`, approved, and then used safely by the coding agent without
requiring manual tester judgment outside the product.

Epic 1 (`agent-platform-project-workspaces`) provides the Project runtime foundation and safety gate.
This epic makes the onboarding experience complete end to end.

## Product Decisions

- The agent takes initiative during Project onboarding.
- On first Project load, the agent reads existing `AGENTS.md` and performs read-only working-tree
  traversal.
- The assessment is LLM-led rather than a rigid checklist, but it must return structured evidence:
  summary, files inspected, inferred structure, gaps, questions, and recommended updates.
- If `AGENTS.md` is sufficient and consistent, onboarding can auto-approve with visible reasoning.
- If `AGENTS.md` is missing, vague, stale, or contradicted by the tree, onboarding becomes
  collaborative.
- Collaborative onboarding follows a Q&A loop: the agent asks focused questions, the user responds,
  and the agent revises the proposed instructions until both sides agree.
- Initial `AGENTS.md` approval is required before code writes.
- Later factual `AGENTS.md` updates are batched at task/session closeout by default, reviewable by
  the user, and not blocking unless a stricter approval mode is enabled later.
- Playwright should act as a human tester by opening Projects, reading prompts, approving/rejecting
  onboarding actions, and validating UI and filesystem outcomes.

## Epic 2 Scope

In scope:

- LLM-led Project assessment and gap analysis.
- Onboarding state transitions from missing/needs-review/in-progress to approved.
- Collaborative Q&A flow for missing or insufficient `AGENTS.md`.
- Drafting and revising human-readable root `AGENTS.md`.
- Review/approval UI for initial onboarding.
- Auto-approval path for sufficient existing `AGENTS.md`.
- Closeout update candidates for durable facts learned during work.
- User-triggered refresh/rescan of Project instructions.
- Playwright E2E that verifies the full onboarding lifecycle through the UI.

Out of scope:

- Multi-agent reviewer orchestration for onboarding output.
- Scheduled autonomous instruction drift jobs.
- Hosted remote checkout management.
- Cross-project knowledge-base synchronization.

## Ticket Delivery Skill

Implementation work for this epic should use the same ticket-delivery skill as Epic 1:

1. Claim the Beads task and create `task/<issue-id>` from the current `feature/agent-platform-project-onboarding`
   branch, or from the active feature branch chosen when Epic 2 starts.
2. Re-read the task spec and write down the task-specific testing strategy before changing code.
3. Implement the task with focused tests first where practical.
4. Run the local quality gates named in the task's testing strategy.
5. Push the task branch.
6. Open a pull request from `task/<issue-id>` to the Epic 2 feature branch.
7. Monitor GitHub checks and review feedback until the pull request is green.
8. If checks fail or review finds issues, fix them on the same task branch, rerun relevant local
   gates, push again, and continue monitoring.
9. Merge the task PR only after local gates, remote checks, and task Definition of Done are satisfied.
10. Close the Beads task, update `session.md` when useful, and move to the next task from the updated
    feature branch.

This epic intentionally uses **one PR per ticket** so each onboarding behavior is independently
reviewable and testable. This overrides the repository's default chained-segment PR workflow for this
epic.

## Testing Strategy Requirements

Each child task must keep a concrete testing strategy in its **Tests And Verification** section. The
strategy must identify:

- local unit/contract/component tests to add or update.
- integration tests needed for assessment, persistence, runtime, or approval boundaries.
- Playwright coverage for user-visible onboarding behavior.
- filesystem assertions for `AGENTS.md` draft/finalization/update behavior.
- CI/GitHub checks that must be monitored on the task pull request.
- deterministic fixture projects needed by the task.

## Proposed Task Chain

| Task                                  | Purpose                                                      |
| ------------------------------------- | ------------------------------------------------------------ |
| `agent-platform-project-onboarding.1` | Define onboarding assessment contracts and state transitions |
| `agent-platform-project-onboarding.2` | Implement read-only project assessment and gap analysis      |
| `agent-platform-project-onboarding.3` | Add collaborative onboarding dialogue and draft revisions    |
| `agent-platform-project-onboarding.4` | Add `AGENTS.md` review, approval, and auto-approval flows    |
| `agent-platform-project-onboarding.5` | Add closeout update candidates and refresh/rescan action     |
| `agent-platform-project-onboarding.6` | Verify full onboarding lifecycle with Playwright E2E         |

## Epic Definition Of Done

- [ ] Each child task has a Beads issue, spec file, dependency edge, and Definition of Done.
- [ ] First Project load performs read-only assessment of the working tree and existing
      `AGENTS.md`.
- [ ] Assessment returns structured visible evidence, gaps, questions, and recommendations.
- [ ] Existing sufficient `AGENTS.md` can auto-approve onboarding with visible reasoning.
- [ ] Missing or insufficient `AGENTS.md` starts collaborative onboarding dialogue.
- [ ] The agent can draft and revise a human-readable `AGENTS.md`.
- [ ] User approval of initial onboarding is required before code writes.
- [ ] Approved onboarding unlocks normal Project code-agent behavior from Epic 1.
- [ ] Later durable instruction updates are batched at closeout and surfaced as reviewable changes.
- [ ] A refresh/rescan action can reassess Project instructions when the repo evolves.
- [ ] Playwright E2E covers sufficient existing instructions, missing instructions, insufficient
      instructions, collaborative Q&A, approval, rejected/revised drafts, approved code write, closeout
      update candidates, and refresh/rescan.
- [ ] The combined Epics 1 and 2 feature is ready for an end-to-end Playwright run without relying on
      manual human validation.
