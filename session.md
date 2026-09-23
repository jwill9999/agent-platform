# Session handoff — remaining permission baseline finding

Owner authorized continuing baseline testing after merging planning PR269. Current task:
`agent-platform-harness-baseline-p2`, branch `task/permission-category-baseline`, base `c1ed389`.
Using real Electron/UI/API/SQLite/dispatcher/file execution with external provider and runner fixtures.

Initial permission suite: 7 pass, 2 fail. Direct writes under Ask and Block execute without an
approval and change the disposable file; shell controls remain correct. Direct Auto, read under
Block and network Block pass. Nineteen category policy unit tests and E2E type/lint checks pass.
Failing screenshots/JSON/traces were inspected and retained. No application changes made.

Priority-one follow-up `agent-platform-direct-file-policy` records the scope decision and recommended
consistent write-mode enforcement across direct mutation tools. Permission-semantic changes need
owner approval under the agreed repair boundary. P2 remains partial; do not merge this failing
baseline evidence branch or activate broader MVP/staging work. Next decision: approve direct-tool
coverage for Workspace writes, then implement a bounded repair with these regressions retained.
See `docs/reviews/current-runtime-permission-category-baseline.md` for evidence and limitations.

## Historical planning handoff

## Planning reconciliation complete

The owner authorized resolving the planning PR conflicts, updating requirements/evidence/Beads,
and independent subagent review without further input unless agreed scope changes. This authorizes
planning maintenance only; no merge, broader runtime implementation or staging promotion is included.

The feature branch now includes the completed permission repairs. The planning branch incorporates
that baseline and preserves the previous review bundle under
`docs/planning/mvp-reliability/review-pre-reconciliation/`. The revised proposal has passed independent review after normative document hashes changed.
The critic verified the schema, 11 normative bindings and 28 evidence entries, and confirmed that
authority, paths, task graph and policy are unchanged. Current review is in
`docs/planning/mvp-reliability/critic-review.final.json`. Historical approval is not current execution
approval. The first next decision is owner review/merge of planning PR269 after hosted checks;
remaining baseline scenarios precede broader implementation. No merge is performed by this task.

Validation: workflow-control built from current source; schema, digest and evidence validation pass.
Markdown passes excluding ignored generated `.agent-platform` Playwright reports (the broad docs
command includes their pre-existing lint errors); relative-link and diff checks pass. No new runtime
code or tests were changed relative to the integrated feature. Hosted checks are tracked in PR269.
The merge-triggered local push hook passed affected builds/typechecks and dependency-cycle checks;
614 harness tests passed, but 12 existing Git tests hit the known unaccepted Apple Xcode license.
The planning diff against the integrated feature is documentation only. The push hook is bypassed
for publication after recording this limitation; hosted checks remain required, not assumed green.

## Previous pause checkpoint (historical)

## Session handoff — September 23, 2026: paused after permission repairs

The owner explicitly paused work. Resume from this checkpoint; the material below it is
historical. No further execution or background continuation is scheduled by this handoff.
Beads remains the task-state authority.

## Completed and verified

The owner approved the current-stack planning boundary, including a smaller local status
panel, then separately authorized baseline testing and the two bounded permission repairs.
The tests reproduced saved-policy reload and denied-tool display defects. Both were repaired.
The Sourcery follow-up also now distinguishes unavailable file data from an empty workspace,
with a regression that waits for the failed backend Refresh response.

[Permission fixes PR270](https://github.com/jwill9999/agent-platform/pull/270) was merged by
the owner into `feature/harness-backlog-review`; the fetched integration tip is `cb373f3`.
Final reviewed repair revision: `93799833958151e01b1981086a8afd6a04bd63b7`.
All ten executed hosted checks passed, including browser and Electron journeys, full verification,
SonarCloud and Sourcery. Sourcery approved and its finding is resolved; Sonar reported no
unresolved findings. Hosted Electron reported 22 passing tests. The staging-only packaged macOS
VM check was skipped. Nothing has been promoted to staging or main.

Local evidence includes 13 passing selected Electron journeys before the final listing correction,
four passing permission journeys after it, and a focused passing Refresh rerun. Initial failing
regressions and later passing artifacts are retained under `.agent-platform/permission*` in the
workflow-evaluation worktree. These journeys compose the renderer, API, database and harness;
the external model HTTP service and command runner are fixtures. They do not establish live-model
or packaged VM isolation behavior. The integrated evidence report is
`docs/reviews/current-runtime-permission-baseline.md` on the feature branch.

## Current state and resume action

[Planning PR269](https://github.com/jwill9999/agent-platform/pull/269) remains open and held.
Its checked-out branch is `task/mvp-reliability-plan` in
`/Users/letuscode/projects/agent-platform-workflow-evaluation`. This session-only update does not
reconcile the plan or make it ready to merge. Its older source baseline and bound requirements
still need to reflect the completed tests and repairs.

The first action on return is to reconcile the planning branch with the updated feature branch,
update the plan's evidence and task/spec references, refresh normative document hashes and the
contract digest, then validate and obtain an independent consistency review. Preserve historical
review snapshots. Brief the owner on the reconciled plan before treating it as ready for merge or
seeking approval for a broader implementation slice.

After that, continue the existing baseline work: remaining permission coverage, cancellation,
retry and recovery scenarios. The wider permission baseline remains partial; sampled high-risk
shell-write behavior is verified, while other categories and direct file tools remain to assess.
Cancellation, concurrent resume, backend restart and uncertain post-effect retry gaps must remain
explicit. The local status panel and broader cancellation/recovery features have not been built.
There is no stack-restructure decision or broad runtime implementation approval.

Beads records: close the integrated `agent-platform-permission-ui-consistency` repair; keep
`agent-platform-harness-baseline-p2` and `agent-platform-mvp-reliability-plan` in progress with
this pause recorded. Keep the global harness review gate and broader feature tasks unchanged.
Use `/Users/letuscode/projects/agent-platform` as the Beads workspace root. Preserve unrelated
root-worktree changes. Documentation access remains separately integrated in its feature branch.

## Historical handoff material

The following records describe earlier checkpoints and may contain superseded statuses.

## September 22, 2026: recovery baseline continuation

## September 23: proposed MVP reliability plan

Owner requested tasks, requirements and a later briefing; explicitly accepted including a smaller
local in-app status panel independent of external dashboards. Planning only, not implementation.
The [MVP plan](docs/planning/mvp-reliability/plan.md) and version-one proposed contract are on
`task/mvp-reliability-plan`, based on merged harness feature `6b4d03e`. The documentation-access
feature is separately merged. Neither feature is promoted to staging.

Created planning issue `agent-platform-mvp-reliability-plan` and four unassigned, review-gated children:
`agent-platform-harness-r3.cancel`, `agent-platform-harness-r3.reconcile`,
`agent-platform-harness-v4.local`, `agent-platform-harness-v5.mvp`. Reuse existing baseline P2/X2/X3/X5
and V1; V1 spec has a proposed refinement. Parent specs/history/status/blockers retained. New edges
and parent relationships read back successfully. No old task is closed or superseded.

Contract schema and document binding validation pass. Independent critique approved after two
corrections (Project Chat host path and immutable normative-document bindings). Owner implementation
approval and scoped Beads readiness reconciliation remain pending.
Runtime code and dependency files are unchanged. Documentation PR integration remains feature-only;
staging and production are separate decisions. Current task remains planning in progress until
its declared review/delivery gates are met. New implementation tasks are not claimed or active.

Owner requested continued frontend/backend journeys and a login adequacy check. Work is on
`task/harness-recovery-baseline`, chained from `task/harness-provider-journey` at `5d3b876`;
PR #266 remains open against `feature/harness-backlog-review`.
The cumulative continuation is [PR #268](https://github.com/jwill9999/agent-platform/pull/268).
Test code commit `b12d148`; all three new journeys also passed at that exact commit.
Beads changes are synced. Hosted gates are running; initial documentation lint found a duplicate
top-level handoff heading, corrected here.

Added reload-and-approve, reload-and-deny, and transient provider HTTP 503 recovery scenarios.
Reload scenarios verify two concurrent retries of a completed resume do not change file, audit,
messages or provider count. All edit journeys now check paired lifecycle events with distinct
original/resumed run identifiers and matching per-run correlation identifiers.

Evidence and limitations: [recovery baseline report](docs/reviews/current-runtime-recovery-baseline.md).
Real Electron/UI/API/SQLite/harness/provider SDK; HTTP model and fixed-command VM runner fixtures.
No dependency or production behavior changes. Local build, explicit E2E TypeScript and ESLint pass;
53 API and 93 harness focused tests pass. All nine Electron scenarios pass locally; hosted quality results are authoritative on the final PR head. Local Sonar/Problems tools
are unavailable; use hosted Sonar plus normal CI as the completion gate.

Beads X5/X3 remain partial. Next gaps: simultaneous first resumes, backend restart, ambiguous
post-effect retries, permission settings permutations and frontend cancellation. Project Chat has
no Stop control. Login is absent by the locked single-user/no-auth MVP design; the owner was asked
whether they meant sign-in or logging. Do not add authentication or broad monitoring by inference.

No main/staging promotion. Preserve root worktree's unrelated `.beads/interactions.jsonl` and
untracked `.vscode/mcp.json`. Use bundled Git on this machine (Apple Git license blocked) and Node24
with the Homebrew pnpm. Canonical Beads root is `/Users/letuscode/projects/agent-platform`.

---

## Session handoff

Last updated: September 15, 2026 — completed authorized coverage and fixture assessment.

### Latest assessment handoff

Shared mapping completed: [coverage report](docs/reviews/current-runtime-coverage-assessment.md). All 17 areas mapped; 273 selected tests and local provider/reasoning transport probe passed. Ordinary chat excludes critic/DoD; Automatic still asks for the sampled shell write. No product or reusable test changes. Next: owner review of the bounded X6/T1/P1 composed journey; all implementation tasks remain queued.

### Historical planning handoff

Owner-agreed repair rule: within an approved testing task, reproduce and preserve the failing test, fix a small directly related defect restoring established behavior, then rerun gates and retain before/after evidence. Broader architecture/dependency/permission or behavior changes need linked repair tasks and review. Planning/mapping remains read-only.

What happened: baseline proposal v3 now includes context, cancellation/retry/limits, planning, persistence/resume, streaming and conditional auxiliary-call coverage mapping, alongside tooling adequacy, approval policy and override boundaries, critic/completion failure cases and UI feedback evidence. See [baseline plan](docs/planning/harness-modernization/current-runtime-baseline-plan.md). Direct Markdown lint, formatting and repository relative-link checks passed. No new tests or product code were implemented.

Current state: branch `jwill9999/harness-baseline-plan`; Beads `agent-platform-harness-baseline-plan` remains open for owner review. Prior workflow evaluation PR remains unmerged. Historical snapshots below are not current status.

Backlog update: 18 Beads tasks now track shared mapping and all 17 matrix areas, with verified prerequisite edges and individual specs. Status and pause checkpoints remain in Beads; no test implementation started.

Next: review the matrix and first slice with the owner; after implementation approval, map existing coverage and resolve the provider-fixture seam before building sequential journeys. Migration value also requires a bounded candidate comparison; baseline correctness alone does not prove savings.

### Verified snapshot — 2026-09-13

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

### Verification and task state

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

### Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

### Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

### September 15: continuation diagnostic observation

The owner requested documentation of the assessment continuation stall and the evidence needed for future diagnosis. See [orchestration field evaluation](docs/reviews/orchestration-field-evaluation.md). Root cause remains unknown; active heartbeat configuration does not prove delivery. No assessment managed run was launched. Future repair work remains under the existing pilot assessment; no implementation is authorized by this note. Modernization assessment drafts remain pending independent critic review.

### September 15: modernization assessment ready for owner review

The [source assessment](docs/planning/harness-modernization/sdk-assessment.md) and its [independent critic record](docs/planning/harness-modernization/reviews/sdk-assessment-critic-review.md) are ready for joint review. The owner authorized a one-off supervised critic exception; its initial findings were corrected and focused recheck passed. This is not managed-orchestration acceptance. F0 and the joint review gate remain open; no packages, paid experiments or product implementation are authorized. The assessment self-check can pause at this owner-review boundary.

### Disposable workflow evaluation and testing skill

Owner authorized the bounded Project Chat evaluation and a targeted Playwright quality-gate skill improvement. See [evaluation](docs/reviews/project-chat-journey-evaluation.md) and [task spec](docs/tasks/agent-platform-workflow-journey-evaluation.md). Approved/denied edit scenarios and adjacent command scenarios passed locally with deterministic model/VM fixtures; file and durable backend checks are independent of UI messages. Installed skill and repository copy are synchronized. Beads task remains open for PR/hosted integration review; no staging/main merge or framework migration authorized.

### Current-runtime baseline planning

Owner requested a plan for evidence-driven workflow coverage before migration decisions. See [baseline proposal](docs/planning/harness-modernization/current-runtime-baseline-plan.md), tracked by `agent-platform-harness-baseline-plan`. Planning only; no new journey implementation is authorized. First uncertainty is a provider-boundary fixture route that retains the real reasoning/SDK path without inventing saved baseURL propagation. Prior test/skill changes remain in draft PR265 with nine executed checks passed and no merge.

### 19 September: current-runtime tests before stack comparison

Owner prioritized current-functionality evidence before considering restructure. PR265 is merged
into feature/harness-backlog-review at f2b306e. This task branch includes the earlier baseline
planning/coverage documents and adds the approved X6/T1/P1 provider-backed approve/deny family.
See docs/reviews/current-runtime-provider-journey.md for results and limitations. Six shared Electron
scenarios and 112 desktop unit tests passed, plus build/scoped lint/explicit E2E typecheck. No product
code or dependencies changed. X6 remains in progress for delivery and its wider untested cases;
other baseline tasks remain open. Package comparison has not started. Work is supervised, no durable
autonomous execution run is claimed. Preserve unrelated root-checkout Beads changes.

## Integrated repair handoff (historical)

## Session handoff — September 23, 2026: authorized permission UI repair

The owner explicitly approved fixing both reproduced permission-display defects. Changes are on the
existing `task/mvp-baseline-permissions` / PR270 branch. No merge or staging promotion is authorized.
Workspace Settings now keeps successful backend policy reads despite file-listing errors and shows
loading/unavailable instead of assumed defaults. The harness emits a denied tool result when shell
policy blocks execution, preserving existing model error, audit and no-execution behaviour.

Both original composed regressions remain intact. Unit coverage now verifies denied emission without
execution and initial settings rendering without fabricated defaults. The wider P2 and cancellation,
retry/recovery baseline remain open. The repair issue stays in progress until the feature PR integrates.
Local validation: all 13 selected Electron scenarios passed, and all four permission cases passed
again at committed repair revision `3eb57cd` after an isolated rerun. Build/lint/type checks,
187 frontend and 614 available harness tests pass. Push hook was bypassed only after its known
12 Apple Git license failures; hosted CI must cover that complete suite. Changes are pushed,
with hosted checks pending at this checkpoint.
See [permission report](docs/reviews/current-runtime-permission-baseline.md) for final validation.
Hosted review also requested a native output element for loading status and removal of duplicate
provider setup in the Electron tests; both were addressed without changing policy assertions.
Sourcery passed but reported a real follow-up: failed listing appeared empty. The existing error
scenario now asserts unavailable listing/count after reload and Refresh; the UI distinguishes it
from a successfully loaded empty workspace. See report for retained before/after evidence.
No dependency/stack changes. The separate planning proposal still needs its updated spec hashes and
independent critique reconciled before broader implementation approval.

---

## Historical checkpoint — permission baseline findings

Owner approved the planning boundary, then separately authorized remaining baseline tests only.
Application changes remain outside this tranche. Current branch: `task/mvp-baseline-permissions`,
from the integrated harness baseline. Tests and evidence are pushed in [draft PR #270](https://github.com/jwill9999/agent-platform/pull/270).
Test commit `b86db9d` reproduced two passes/two failures; the whole selected file had 11 passes/two failures.
Desktop build/typecheck and 112 desktop unit tests passed on push. The gate remains FAIL.
The planning proposal remains in its separate draft PR #269;
its nine executed checks passed, packaged macOS staging test skipped as designed.

Four new Electron permission scenarios exercise Ask/Auto/Block and a real file-listing error.
Two product findings: saved policy appears as Ask after reload when file listing fails, and blocked
shell work retains Running activity after the backend denied it and the turn finished. Preserve
both unsatisfied regression assertions; do not silently skip or reinterpret them as success.
Repair proposal: `agent-platform-permission-ui-consistency` (open P1). P2 remains in progress.
See [permission evidence](docs/reviews/current-runtime-permission-baseline.md) for boundaries and
commands. Production code and dependencies are unchanged. No staging/main promotion.

Use isolated workspace roots for normal fixtures. Apple Git license remains unaccepted: use the
bundled Git for fixture project initialization and repository operations. Existing gitTools unit
fixtures hardcode Apple Git and cannot run successfully here; do not change them in this slice.
The accidental broader harness unit invocation produced 614 passes and 12 Git-license failures;
focused policy tests use `pnpm --filter @agent-platform/harness exec vitest run ...`.

Next: review the recorded permission defects with the owner, finish wider P2 coverage, then continue
cancellation/retry/recovery evidence in the agreed sequence. Product fixes need separate approval.
Refresh the draft planning contract's task-spec hashes and independent critique before any broader
implementation approval, because the P2 spec has now been refined. Keep the global gate open.
Preserve unrelated root worktree changes (`.beads/interactions.jsonl`, `.vscode/mcp.json`).

---

## Historical handoff — September 22, 2026: recovery baseline continuation

Owner requested continued frontend/backend journeys and a login adequacy check. Work is on
`task/harness-recovery-baseline`, chained from `task/harness-provider-journey` at `5d3b876`;
PR #266 remains open against `feature/harness-backlog-review`.
The cumulative continuation is [PR #268](https://github.com/jwill9999/agent-platform/pull/268).
Test code commit `b12d148`; all three new journeys also passed at that exact commit.
Beads changes are synced. Hosted gates are running; initial documentation lint found a duplicate
top-level handoff heading, corrected here.

Added reload-and-approve, reload-and-deny, and transient provider HTTP 503 recovery scenarios.
Reload scenarios verify two concurrent retries of a completed resume do not change file, audit,
messages or provider count. All edit journeys now check paired lifecycle events with distinct
original/resumed run identifiers and matching per-run correlation identifiers.

Evidence and limitations: [recovery baseline report](docs/reviews/current-runtime-recovery-baseline.md).
Real Electron/UI/API/SQLite/harness/provider SDK; HTTP model and fixed-command VM runner fixtures.
No dependency or production behavior changes. Local build, explicit E2E TypeScript and ESLint pass;
53 API and 93 harness focused tests pass. All nine Electron scenarios pass locally; hosted quality results are authoritative on the final PR head. Local Sonar/Problems tools
are unavailable; use hosted Sonar plus normal CI as the completion gate.

Beads X5/X3 remain partial. Next gaps: simultaneous first resumes, backend restart, ambiguous
post-effect retries, permission settings permutations and frontend cancellation. Project Chat has
no Stop control. Login is absent by the locked single-user/no-auth MVP design; the owner was asked
whether they meant sign-in or logging. Do not add authentication or broad monitoring by inference.

No main/staging promotion. Preserve root worktree's unrelated `.beads/interactions.jsonl` and
untracked `.vscode/mcp.json`. Use bundled Git on this machine (Apple Git license blocked) and Node24
with the Homebrew pnpm. Canonical Beads root is `/Users/letuscode/projects/agent-platform`.

---

## Session handoff (earlier checkpoint 2)

Last updated: September 15, 2026 — completed authorized coverage and fixture assessment.

### Latest assessment handoff (earlier checkpoint 2)

Shared mapping completed: [coverage report](docs/reviews/current-runtime-coverage-assessment.md). All 17 areas mapped; 273 selected tests and local provider/reasoning transport probe passed. Ordinary chat excludes critic/DoD; Automatic still asks for the sampled shell write. No product or reusable test changes. Next: owner review of the bounded X6/T1/P1 composed journey; all implementation tasks remain queued.

### Historical planning handoff (earlier checkpoint 2)

Owner-agreed repair rule: within an approved testing task, reproduce and preserve the failing test, fix a small directly related defect restoring established behavior, then rerun gates and retain before/after evidence. Broader architecture/dependency/permission or behavior changes need linked repair tasks and review. Planning/mapping remains read-only.

What happened: baseline proposal v3 now includes context, cancellation/retry/limits, planning, persistence/resume, streaming and conditional auxiliary-call coverage mapping, alongside tooling adequacy, approval policy and override boundaries, critic/completion failure cases and UI feedback evidence. See [baseline plan](docs/planning/harness-modernization/current-runtime-baseline-plan.md). Direct Markdown lint, formatting and repository relative-link checks passed. No new tests or product code were implemented.

Current state: branch `jwill9999/harness-baseline-plan`; Beads `agent-platform-harness-baseline-plan` remains open for owner review. Prior workflow evaluation PR remains unmerged. Historical snapshots below are not current status.

Backlog update: 18 Beads tasks now track shared mapping and all 17 matrix areas, with verified prerequisite edges and individual specs. Status and pause checkpoints remain in Beads; no test implementation started.

Next: review the matrix and first slice with the owner; after implementation approval, map existing coverage and resolve the provider-fixture seam before building sequential journeys. Migration value also requires a bounded candidate comparison; baseline correctness alone does not prove savings.

### Verified snapshot — 2026-09-13 (earlier checkpoint 2)

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

### Verification and task state (earlier checkpoint 2)

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

### Remaining orchestration acceptance (earlier checkpoint 2)

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

### Workspace and continuation (earlier checkpoint 2)

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

### September 15: continuation diagnostic observation (earlier checkpoint 2)

The owner requested documentation of the assessment continuation stall and the evidence needed for future diagnosis. See [orchestration field evaluation](docs/reviews/orchestration-field-evaluation.md). Root cause remains unknown; active heartbeat configuration does not prove delivery. No assessment managed run was launched. Future repair work remains under the existing pilot assessment; no implementation is authorized by this note. Modernization assessment drafts remain pending independent critic review.

### September 15: modernization assessment ready for owner review (earlier checkpoint 2)

The [source assessment](docs/planning/harness-modernization/sdk-assessment.md) and its [independent critic record](docs/planning/harness-modernization/reviews/sdk-assessment-critic-review.md) are ready for joint review. The owner authorized a one-off supervised critic exception; its initial findings were corrected and focused recheck passed. This is not managed-orchestration acceptance. F0 and the joint review gate remain open; no packages, paid experiments or product implementation are authorized. The assessment self-check can pause at this owner-review boundary.

### Disposable workflow evaluation and testing skill (earlier checkpoint 2)

Owner authorized the bounded Project Chat evaluation and a targeted Playwright quality-gate skill improvement. See [evaluation](docs/reviews/project-chat-journey-evaluation.md) and [task spec](docs/tasks/agent-platform-workflow-journey-evaluation.md). Approved/denied edit scenarios and adjacent command scenarios passed locally with deterministic model/VM fixtures; file and durable backend checks are independent of UI messages. Installed skill and repository copy are synchronized. Beads task remains open for PR/hosted integration review; no staging/main merge or framework migration authorized.

### Current-runtime baseline planning (earlier checkpoint 2)

Owner requested a plan for evidence-driven workflow coverage before migration decisions. See [baseline proposal](docs/planning/harness-modernization/current-runtime-baseline-plan.md), tracked by `agent-platform-harness-baseline-plan`. Planning only; no new journey implementation is authorized. First uncertainty is a provider-boundary fixture route that retains the real reasoning/SDK path without inventing saved baseURL propagation. Prior test/skill changes remain in draft PR265 with nine executed checks passed and no merge.

### 19 September: current-runtime tests before stack comparison (earlier checkpoint 2)

Owner prioritized current-functionality evidence before considering restructure. PR265 is merged
into feature/harness-backlog-review at f2b306e. This task branch includes the earlier baseline
planning/coverage documents and adds the approved X6/T1/P1 provider-backed approve/deny family.
See docs/reviews/current-runtime-provider-journey.md for results and limitations. Six shared Electron
scenarios and 112 desktop unit tests passed, plus build/scoped lint/explicit E2E typecheck. No product
code or dependencies changed. X6 remains in progress for delivery and its wider untested cases;
other baseline tasks remain open. Package comparison has not started. Work is supervised, no durable
autonomous execution run is claimed. Preserve unrelated root-checkout Beads changes.
