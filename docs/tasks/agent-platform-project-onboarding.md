# Epic: Project onboarding and `AGENTS.md` lifecycle

**Beads issue:** `agent-platform-project-onboarding`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-onboarding.md`

## Objective

Complete the Project onboarding experience so a newly opened Project with a coding-capable profile
can be assessed, understood, documented in `AGENTS.md`, approved, and then used safely by the coding
agent without requiring manual tester judgment outside the product.

Epic 1 (`agent-platform-project-workspaces`) provides the Project runtime foundation and safety gate.
This epic makes the onboarding experience complete end to end.

## Product Decisions

- Project is a generic folder/work context, not necessarily a code repository. This epic implements
  the `AGENTS.md` lifecycle for Projects where coding or file-changing work is enabled.
- The coding agent is a Project profile/tooling choice, not the definition of a Project.
- Onboarding UI must avoid implementation labels such as `/workspace`, `backend accessible`, backend
  root, or repository root in normal user-facing copy. Show Project name, folder/relevant relative
  path, onboarding state, and branch/status only where useful.
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
- A follow-up epic, `agent-platform-project-experience`, will implement the broader Project
  navigation model: chat-first Project entry, recent/reopen Projects, left explorer organization,
  optional IDE handoff, breadcrumbs, and generic Project profiles beyond coding.

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

- Broad Project navigation redesign, recent/reopen Project explorer UI, breadcrumbs, and
  project-chat-first routing. These belong to `agent-platform-project-experience`.
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
4. Build and run local quality gates before pushing: formatting, linting, unit tests, and any
   relevant integration/E2E tests from the task's strategy. If the task changes onboarding UI or
   agent-facing behavior, include Playwright-driven verification that acts through the interface and
   checks the expected result.
5. Do not push or open the task PR while required local gates are failing.
6. Push the task branch after local gates are green.
7. Open a pull request from `task/<issue-id>` to the Epic 2 feature branch.
8. Monitor GitHub checks, logs, artifacts, and review feedback until the pull request is green.
9. If checks fail or review finds issues, inspect the CI logs/artifacts with GitHub tooling, fix the
   issue on the same task branch, rerun relevant local gates, push again, and continue monitoring.
10. Merge the task PR only after local gates, remote checks, reviews, and task Definition of Done are
    satisfied.
11. Close the Beads task, update `session.md` when useful, and move to the next task from the updated
    feature branch.

This epic intentionally uses **one PR per ticket** so each onboarding behavior is independently
reviewable and testable. This overrides the repository's default chained-segment PR workflow for this
epic.

## Testing Strategy Requirements

Each child task must keep a concrete testing strategy in its **Tests And Verification** section. The
strategy must identify:

- mandatory local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`, unless the
  task spec explains why a narrower gate is sufficient.
- local unit/contract/component tests to add or update.
- integration tests needed for assessment, persistence, runtime, or approval boundaries.
- Playwright coverage for user-visible onboarding behavior. The strategy must define the UI actions
  Playwright performs and the visible/filesystem outputs it asserts.
- filesystem assertions for `AGENTS.md` draft/finalization/update behavior.
- CI/GitHub checks, logs, and artifacts that must be monitored on the task pull request.
- deterministic fixture projects needed by the task.

Never mark a task done, close its Bead, or merge its task PR while local gates, Playwright checks,
GitHub Actions checks, or review-required feedback remain unresolved. A task is done only when the
implementation is complete, local testing strategy passes, required UI/Playwright verification
passes, and CI/CD pipelines are green.

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
- [ ] User-facing onboarding labels describe the Project and instruction state without exposing
      `/workspace`, backend accessibility, backend root, or repository root as primary copy.
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
- [ ] Every Epic 2 task is closed only after implementation is complete, local gates pass,
      Playwright/UI verification passes where required, and GitHub Actions checks are green.
