# Session handoff

Last updated: September 15, 2026 — expanded current-runtime evidence planning.

## Latest planning handoff

What happened: baseline proposal v2 now defines tooling adequacy, approval policy and override boundaries, critic/completion failure cases and UI feedback evidence. See [baseline plan](docs/planning/harness-modernization/current-runtime-baseline-plan.md). Direct Markdown lint, formatting and repository relative-link checks passed. No new tests or product code were implemented.

Current state: branch `jwill9999/harness-baseline-plan`; Beads `agent-platform-harness-baseline-plan` remains open for owner review. Prior workflow evaluation PR remains unmerged. Historical snapshots below are not current status.

Next: review the matrix and first slice with the owner; after implementation approval, map existing coverage and resolve the provider-fixture seam before building sequential journeys. Migration value also requires a bounded candidate comparison; baseline correctness alone does not prove savings.

## Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

## Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

## Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

## Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

## September 15: continuation diagnostic observation

The owner requested documentation of the assessment continuation stall and the evidence needed for future diagnosis. See [orchestration field evaluation](docs/reviews/orchestration-field-evaluation.md). Root cause remains unknown; active heartbeat configuration does not prove delivery. No assessment managed run was launched. Future repair work remains under the existing pilot assessment; no implementation is authorized by this note. Modernization assessment drafts remain pending independent critic review.

## September 15: modernization assessment ready for owner review

The [source assessment](docs/planning/harness-modernization/sdk-assessment.md) and its [independent critic record](docs/planning/harness-modernization/reviews/sdk-assessment-critic-review.md) are ready for joint review. The owner authorized a one-off supervised critic exception; its initial findings were corrected and focused recheck passed. This is not managed-orchestration acceptance. F0 and the joint review gate remain open; no packages, paid experiments or product implementation are authorized. The assessment self-check can pause at this owner-review boundary.

## Disposable workflow evaluation and testing skill

Owner authorized the bounded Project Chat evaluation and a targeted Playwright quality-gate skill improvement. See [evaluation](docs/reviews/project-chat-journey-evaluation.md) and [task spec](docs/tasks/agent-platform-workflow-journey-evaluation.md). Approved/denied edit scenarios and adjacent command scenarios passed locally with deterministic model/VM fixtures; file and durable backend checks are independent of UI messages. Installed skill and repository copy are synchronized. Beads task remains open for PR/hosted integration review; no staging/main merge or framework migration authorized.

## Current-runtime baseline planning

Owner requested a plan for evidence-driven workflow coverage before migration decisions. See [baseline proposal](docs/planning/harness-modernization/current-runtime-baseline-plan.md), tracked by `agent-platform-harness-baseline-plan`. Planning only; no new journey implementation is authorized. First uncertainty is a provider-boundary fixture route that retains the real reasoning/SDK path without inventing saved baseURL propagation. Prior test/skill changes remain in draft PR265 with nine executed checks passed and no merge.
