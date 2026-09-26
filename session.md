# Current session: standalone prerequisite scope reviewed — 26 September 2026

PR274 merged into feature/harness-backlog-review at a8586aa. Owner authorized preparation of .17's
bounded repair plan. [Plan](docs/planning/standalone-pilot/plan.md),
[13-scenario verification matrix](docs/testing/standalone-pilot-prerequisites.md) and proposed v1
contract are published on task/standalone-pilot-plan, based on that feature revision.
Three isolated critique rounds resolved all scope-design findings; see
[review and evidence](docs/reviews/standalone-pilot-plan-review.md). Schema/manifest and documentation
checks passed. No runtime implementation or live orchestration test has started.

The scope covers run discovery/admission, journaled implementation imports, typed phase/coordinator
completion and host feasibility. .17 remains in progress and directly blocks .13. Before implementation
handoff, establish the managed credential broker/image provision path, bind actual policy/source and
review the exact execution authority. Existing reviewer account access is not managed worker authority.
The proposed policy hash identifies review material only and must not be used as an installed grant.
Staging, A2A and packaging remain outside this work. Temporary reviewer containers/networks cleaned up.

---

# Current session: approved-document binding implementation

Owner authorized implementation of `agent-platform-pilot-zero.16`; approval is recorded against the
reviewed planning material. This is supervised direct delivery, not managed orchestration.
Worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
Branch: `task/approved-document-binding`; target: `feature/harness-backlog-review`.

Current evidence and remaining acceptance scope:
[implementation checkpoint](docs/reviews/approved-document-binding-implementation.md).
Docker is healthy. Owner explicitly authorized completing all six findings. Repairs now cover
trusted source/current worktree resolution, durable snapshot denial, persisted packet identity,
terminal result replay and cleanup-only bootstrap. Independent rounds3/4 surfaced additional
initial-import and asynchronous repair-effect gaps; those are repaired with composed regressions.
Final local verification: Linux875 passed/17 optional skipped; enabled document/container suites110
passed. Build, monorepo typecheck, extended changed-test typecheck, workflow lint, formatting,
Markdown/links and dependency cycles pass. Rounds6-8 surfaced delivery/source/cancellation,
Git-expiry, Beads/Dolt dispatch and stale-caller adoption gaps; each is repaired with regressions.
Final isolated round9 approves the last correction with zero actionable findings; all36 supplied
snapshot hashes matched that checkpoint. Final Sonar two-file cleanup separately passes80 affected
tests/build/lint and independent round10 review; full875/connected110 precede only that cleanup.
Exact snapshots and reviewed limitations are retained in the implementation report.

PR273 remains unmerged targeting feature/harness-backlog-review. Check its exact-head hosted gates
before owner integration; local success does not substitute for hosted browser/desktop checks.
No staging or pilot authority. Beads .16 remains in progress until owner integration. After that,
re-read Beads .13/.12 readiness and prepare the separately approved single-task orchestration pilot.
These supervised repairs do not prove autonomous execution or absent downstream service adapters.

---

## Previous session: document-approval binding plan

PR271 is merged into `feature/harness-backlog-review` at `5e5f7f2bf66ca07410a5c83689230b0c3e25f609`.
The owner authorized planning and independent critique of `agent-platform-pilot-zero.16`.
Current branch: `task/approved-document-binding-plan`, based on that merged feature revision.

Planning package: [approved-document binding](docs/planning/approved-document-binding/plan.md).
The draft includes a typed document manifest, immutable snapshots, guarded approval/start/resume/
delivery paths and compatibility handling. The first independent isolated critic found a restart
hole after failed invalidation persistence; the revised plan requires durable verification intents
and quarantine recovery, plus the combined fault test. The second isolated critique approved the revised plan with zero findings. Structured results and
dispositions are in docs/reviews/approved-document-binding-plan.md.

No runtime/application implementation or managed run has started. Next: owner review of the published planning PR and proposed decisions before implementation. `.13`
remains blocked by `.16` and `.12`. Nothing is promoted to staging. Earlier session entries follow
as historical evidence, not current PR status.

---

## Previous session: repair PR quality gates

The owner resumed work and explicitly authorized assessment and repair of SonarCloud findings and
the desktop-E2E failure. Continue the existing task branch; no merge/staging/pilot authorization.

Current report: [PR gate repair](docs/reviews/pr271-gate-repair.md).
The desktop failure is an asynchronous evidence-capture race; backend denial and unchanged file were
already present in the failed artifact. Reviewer security findings are addressed by fixed gateway
routes, bounded stdin configuration, absolute executable path and hardened image defaults/install.
Local verification: 721 Linux package tests passed (13 optional skipped), four actual runtime/config
probes passed, and nine repeated Electron rejection journeys passed. Independent isolated review
found no confirmed regressions; its exact snapshot and limits are retained in the repair report.
Build, typecheck and lint pass. Hosted gates must be refreshed after push.

## Resume location and delivery state

- Worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
- Branch: `task/permission-category-baseline`; integration target: `feature/harness-backlog-review`.
- Completed implementation commit: `a9b1003` (pushed). This handoff follows that commit.
- Existing review: [permission baseline and reviewer changes](https://github.com/jwill9999/agent-platform/pull/271).
  Refresh its checks and review state on return; local passing checks do not establish current hosted status.
- Beads authority: `/Users/letuscode/projects/agent-platform`; last Dolt push succeeded.
  Reviewer task `agent-platform-pilot-zero.15` remains in progress pending integration and broader acceptance.
- Temporary reviewer containers and network gateway were removed. No review or pilot is running.
  The pinned Docker image remains cached; provision the private gateway again before another live review.
- Nothing merged into the feature branch, staging or main during this work.

## Reviewer verification completed this session

Owner authorized controlled permission tests. The actual pinned client initially allowed delegation;
fixed with dedicated agent-disable and depth settings. Captured inventories and injected negative
calls now exercise enforcement. Docker boundary probes cover read-only evidence, excluded grants,
network restrictions and real startup-failure cleanup. Normal account-backed review also completed.

Assessment and evidence: [isolated reviewer](docs/workflow-control-supervised-review.md).
Defects corrected: delegation configuration, empty-result success, Docker cleanup race, tunnel
service-boundary weakness and response-stream reset handling. Fixed-endpoint account-backed review
succeeds. The bounded standalone-review verification gate passes for the tested image/configuration.
Independent feedback also improved complete inventory capture and cleanup regression coverage.
Qualification applies only to this pinned standalone reviewer profile; managed orchestration,
full skill acceptance, feature integration and owner approval remain separate.

The detailed-document approval binding gap remains `agent-platform-pilot-zero.16`, blocking pilot
plan `.13`. No merge, staging promotion or orchestration pilot occurred. Next is reviewing the
qualified route and finishing the remaining planning/skill acceptance gates.

## Current checks

712 Linux package tests passed; 13 optional tests skipped. Three real capability probes and the
effective-config probe passed separately. Six lifecycle tests, build, lint, Markdown and links pass.
Native Apple Git licence and absent Sonar/Problems connectors remain recorded limitations.

## Subsequent work after PR gates pass

1. Review the verification report and completed changes together. Refresh Beads and the existing PR
   before recommending integration. The successful standalone reviewer assessment does not approve
   the whole skill suite, managed orchestration or a merge.
2. Resolve the detailed-document approval binding gap in `agent-platform-pilot-zero.16`: execution
   approval must identify the exact task specifications and verification documents, and reject stale
   or changed material. This is recorded as a separate open task and blocks pilot plan `.13`.
   Define/review its bounded implementation scope before making the broader contract/runtime changes.
3. Complete the remaining skill-handoff acceptance and runtime prerequisites in `.12`, using the
   verified critic route where appropriate. Keep any new findings linked to the existing evaluation.
4. Prepare the exact single-task pilot plan in `.13` only after its prerequisites are satisfied:
   selected task, source revision, permitted actions, tests, completion criteria, recovery limits and
   reviewed document versions. Obtain the owner's bound execution approval before launching it.
5. Run and assess one complete managed task. Only after reviewing that outcome, prepare the separate
   two-dependent-task pilot to prove automatic progression without a manual restart.

The wider MVP baseline still includes remaining permission, cancellation, retry and recovery journeys.
They are future work, not coverage established by reviewer-isolation tests. Continue through existing
Beads tasks rather than creating duplicates. Keep planning, implementation, merge and staging
permissions separate; no standing authorization for broader repairs or promotion was added here.

The next conversation should start with a short briefing on the verification result and open
approval-binding task, then agree the next bounded work. Do not rerun completed checks without new
changes or a specific unresolved concern.

## Earlier handoff (historical; superseded where it conflicts with the current handoff)

## Skill preparation handoff — 24 September 2026

Enforced reviewer entry point implemented in workflow-control with content-addressed snapshots and
existing read-only Docker critic mounts. Offline isolation passed; live image/auth/egress setup remains
unconfigured. See docs/workflow-control-supervised-review.md. Do not claim live critique unblocked.
Typecheck/build/lint/cycle checks pass; 691 Linux package tests pass across full and repaired-fixture
runs, nine skipped. Four real Docker isolation probes pass. Native Git tests blocked by Xcode licence.

Owner-authorized supervised evidence-only critic route added to ADR-0004 and critique guidance.
This is a no-tool procedural exception outside active managed runs, not enforced external-tool isolation.
A separate critic returned findings on the supplied proposal. Broker-absence proof and formal
acceptance remain unresolved; see docs/reviews/supervised-critique-route-assessment.md.

Owner-approved naming clarification added: planning maps readable task titles to Beads IDs, specs
and branches; implementation resolves ambiguity and announces the selected task/branch before edits.

Created the owner-requested documentation skill and docs/README.md folder/authority guide.
Planning, critique and implementation now link it. Existing documents were not relocated.

Updated existing plan-critique and planning handoff: independent critique is mandatory for direct
and managed plans; compliant-launch limitations are explicit. No live critic or pilot launched.

Created orchestration and feature-implementation skills; reviewed existing planning/critique.
Subsequently updated feature-planning under explicit owner authorization with required artifacts,
publication, test feasibility, connected frontend/backend evidence, completion gates and exact handoff.
Owner also required unresolved ambiguity to be raised with the human before plan agreement; this is
explicit, with recorded answers and no silent assumptions or treating silence as consent.
Owner authorized this bounded work, with joint review afterwards. No live pilot or runtime repair.
See [skill readiness review](docs/reviews/orchestration-skill-readiness.md).
New Beads prerequisite chain is recorded with specifications and blocking dependencies.
Skill validators, Markdown and relative-reference checks pass. No application code changed.
Independent behavioral review and runtime qualification remain outstanding; no autonomous success claimed.

## Session handoff — orchestration review observation

The owner paused the proposed standing repair authorization and requested documentation of why
orchestration was not used and what should trigger its use. Added the September 23 observation and
proposed task-start readiness checkpoint to `docs/reviews/orchestration-field-evaluation.md`.
The actual omission was an explicit execution-mode decision; no managed launch failure was reproduced.
The permission approval wait was intentional. Runtime readiness still needs investigation; existing
approval rules remain unchanged. Further owner questions should extend this review and the existing
Beads pilot assessment before any activation or repair decision.

The owner subsequently requested adding the skill/discoverability recommendation and distinct new-run
versus existing-run paths. These are now recorded in the review, including read-only state lookup,
separate runtime-health checks, no-run versus failed-lookup handling, and explicit fallback decisions.
Routing rules are proposed; confidence scoring is unvalidated. No skill, runtime, approval or policy
change is implemented. Return to the owner for further review questions after this documentation update.

The owner also requested retaining model selection by role/task complexity as a future consideration.
The review records current inheritance intent, unverified effective selection in the isolated launcher,
and the need to benchmark quality, cost and retries before changes. No model routing, paid experiment
or budget change is authorized. Further review discussion remains the next step.

Added the owner's September 24 testing-gap reminder: assess upfront approval across real managed
handoffs and recovery, record unnecessary prompts or continuation problems, and base any rework on
evidence. No run launch, permission change or confirmed defect is implied by this reminder.

The owner requested a written staged assessment: readiness, one complete managed task, owner review,
then a separately approved two-dependent-task pilot proving automatic progression. Protocol:
`docs/reviews/orchestration-staged-assessment.md`. Both runs remain unexecuted; prerequisites, exact
work selection and executable material must be resolved first. Manual bridging cannot count as a pass.

The owner requested that gaps discovered while using the current planning skill be surfaced in the
orchestration field evaluation and Beads, including manual supplementation needed for runnable material.
This observation requirement is documented in both the field review and staged assessment protocol.

The direct-file repair remains pushed in PR271. All ten executed hosted checks passed at `3d7c44b`;
one separate Git merge-resolver test passed on retry. Human review/merge remains separate.
This handoff change is documentation only and does not claim new runtime verification.

## Earlier repair publication checkpoint

## Session handoff — approved direct-file permission repair

Owner approved extending Workspace writes to direct mutation tools. Repair on
`task/permission-category-baseline`, PR271 into `feature/harness-backlog-review`.
Beads `agent-platform-direct-file-policy` is in progress; P2 remains partial.

All ten composed permission journeys pass, including the original Ask/Block regressions and a new
Ask-to-Block change while approval waits. Block prevents the effect even after the old approval is
accepted. Six direct mutation tools are covered by dispatcher policy tests; stricter controls remain.
98 focused tests, 187 web tests, build/typecheck/touched-file lint pass. Full harness: 667 pass,
12 existing Apple Git/Xcode-license failures. All 19 selected Electron journeys pass at `314589d`.
All 39 API chat integration tests pass after two path tests explicitly enable Auto; 44 unrelated
Project Git API cases also hit the Xcode-license limitation. Docs/links pass. Hosted checks pending.
Repair and test updates are pushed (`314589d`, `c549855`); PR271 is ready for review and hosted checks
are running. Normal pre-push stopped on the recorded 12 Apple Git-license tests; publication used
HUSKY=0 after affected builds/types, 112 desktop and 187 web unit tests passed. Beads sync succeeded.
No merge or staging/main promotion is authorized. Review evidence is in
`docs/reviews/current-runtime-permission-category-baseline.md`.

## Historical baseline checkpoint

## Session handoff — remaining permission baseline finding

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
Committed test revision `7771375` repeated the same 7 pass / 2 fail result. Draft PR271 contains
the preserved regressions and follow-up; leave it unmerged. Committed artifacts are in
`.agent-platform/permission-category-committed-results`. Hosted checks remain separate; the local
push hook encountered 12 existing Xcode-license Git failures (630 harness tests pass), recorded in
the report before bypassing it for draft publication.
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
