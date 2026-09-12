# Pilot zero: orchestration integration assessment

**Beads:** `agent-platform-pilot-zero`  
**Parent:** `agent-platform-multi-agent`  
**Status:** Owner-authorized supervised integration repair; autonomous activation remains unapproved.

**Assessment date:** 2026-09-08

## Objective and authority

Prove a human idea can become a reviewed plan, approved managed execution, and verified delivery.
Record supervised bridging separately from runtime-driven progress. The original assessment-only
scope was extended by the owner to iterative supervised integration repairs, tests, review and
publication. This does not authorize credential issuance, live runtime activation or protected
merges without their required approval. Beads remains the issue and finding lifecycle authority.

The owner explicitly requested documenting findings during planning. This is supervised authoring,
not evidence that the read-only planning skill persisted a draft autonomously. The canonical local
journal was inspected read-only: its four recorded runs were cancelled. No new run was started.

## Requirements and proposed implementation sequence

1. Define a planner-to-authoring handoff and an explicit approved-plan start/resume interface.
   Persist exact contract, policy, evidence, run identity and authenticated approval; reject stale
   material. Repeated start must observe the same run or report a conflict, never duplicate it.
2. Complete trusted implementation output import. Accept only execution-bound, allowlisted changes
   from an isolated worker; reject traversal, symlinks, secret material, changed baseline, and foreign
   execution evidence. Reconcile interrupted import without double application.
3. Compose each declared phase with its authorized executor. Add typed coordinator receipts for
   task acceptance, repair, evaluation, pipeline, delivery and finalization. A queued phase or generic
   transition is not evidence of execution. Preserve the existing brokers and permissions.
4. Connect the existing notification outbox to an explicitly selected human-visible channel.
   Transport acceptance is not human approval. Authentication, delivery confirmation, retries,
   cancellation and failure reporting must remain distinct. Channel choice is unresolved.
5. Exercise the complete path in isolated runs, then approve a separate real-feature pilot.

Use the standalone runner as the proposed first execution boundary. Do not claim desktop chat
resumption; adding that adapter is a separate scope decision. Model credential service, immutable
specialist image, restricted network and real provider clients must pass readiness checks before
live execution. Failed readiness creates an actionable blocker, not a manual bypass.

## Phase triggers and evidence

| Completed condition                                   | Expected next action                          | Required proof                                                           |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Human requirements clarified                          | Planner emits draft and authoring handoff     | Specification, task graph, acceptance criteria and source references     |
| Draft validates                                       | Distinct critic reviews exact material        | Structured digest-bound review and finding dispositions                  |
| Critic passes                                         | Explicit owner approval request               | Visible request naming scope, destination and required response          |
| Authenticated approval recorded                       | Start or resume the approved run              | Same-material approval, readiness checks and durable run identity        |
| Worker settles and credential revocation is confirmed | Import output and enqueue verification        | Exact execution/head evidence, committed callback and phase job          |
| Verification passes                                   | Enqueue independent code review               | Accepted test evidence for the same candidate                            |
| Verification or review finds a defect                 | Bounded repair then re-verification           | Finding, repair attempt and new-head evidence; no inherited green result |
| Task acceptance commits                               | Schedule next ready task or integrate         | Refreshed authoritative Beads dependencies and brokered close            |
| CI and review gates pass                              | Request or exercise bounded delivery approval | Exact PR/head, current checks, resolved dispositions and approval        |
| Staging merge is verified                             | Finalize and sync                             | Merge attestation, task/feature closeout, observed Dolt sync and report  |

A committed callback feeds a durable continuation; the coordinator consumes it into a phase job.
The executor must claim, start and complete that job with authoritative evidence. The watchdog
reconciles missed signals independently of conversation turns. Delivery of a notification alone
does not advance the workflow. Documented defaults are 1-second polling, 30-second overdue reporting,
10 host attempts and a 300-second continuation deadline; readiness must check actual configuration.
These bounds do not imply a five-minute limit for feature implementation or hosted CI.

## Findings register

These are assessment findings under this Beads task, not separate implementation tickets yet.
Source inspection is evidence of code shape, not live conformance.

| ID    | Finding and source                                                                                                                 | Disposition / recovery proposal                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| PZ-01 | Planning is read-only, with no authoring owner: `.agents/skills/feature-planning/SKILL.md`                                         | Define a narrow supervised authoring handoff, then govern activation separately                               |
| PZ-02 | MCP exposes only status/preview; CLI has no general approved-feature start: `packages/workflow-control/src/mcpServer.ts`, `cli.ts` | Add or document a supported trusted composition; never substitute raw DB edits                                |
| PZ-03 | Standalone implementation throws `phase_artifact_import_unavailable`: `packages/workflow-control/src/phaseRuntime.ts`              | Implement trusted output import and regression tests                                                          |
| PZ-04 | Coordinator completion throws `phase coordinator completion authority unavailable`: `packages/workflow-control/src/phaseJobs.ts`   | Define typed receipt adapters for every coordinator phase                                                     |
| PZ-05 | Default notifications are JSONL; native chat delivery is explicitly absent: `docs/workflow-control-continuations.md`               | Select and prove a visible channel before unattended use                                                      |
| PZ-06 | Desktop conformance unconditionally fails: `packages/workflow-control/src/continuationWorker.ts`                                   | Keep desktop claim blocked; evaluate standalone independently                                                 |
| PZ-07 | ADR-0004 disallows built-in critics when global mutation-capable tools are exposed                                                 | Use a conformant isolated critic; this session exposes such tools, so no built-in critic was launched         |
| PZ-08 | Pilot spec references deleted task/feature lineage and assumes epic closeout: `docs/tasks/agent-platform-multi-agent.10.md`        | Replace stale lineage in a newly reviewed contract; do not close the orchestration epic on pilot-zero success |
| PZ-09 | Live credential service, provider composition and isolated execution are not verified by this assessment                           | Inventory capabilities read-only; run explicitly approved conformance before activation                       |

## Reproducibility and test strategy

Record each scenario as passed, failed, not exercised or blocked, with input contract digest,
source revision, runtime/image/config identity, execution IDs, event sequence, evidence digests,
elapsed time, retries and intervention count. Never include credentials. Initial scenario results
are **not exercised**: this assessment has not launched a runtime or run acceptance tests.

- Repeat the ordinary approved-plan flow in two fresh isolated journals/workspaces. Both must
  produce equivalent allowed transitions and final outcomes without user nudges.
- Seed a plan omission and a worker/test failure in fixtures. Verify critique and repair rather
  than publishing a known defect or weakening a gate.
- Drop the completion signal; the independent watchdog must discover it, progress or visibly block
  within the configured deadline. Repeat callback and acknowledgement delivery without duplicate
  effects. Record actual next-phase start, not merely notification receipt.
- Interrupt after output import, callback commit, provider mutation and Beads/Dolt effects.
  Resume under a new lease; observe completed effects before retry and reject stale owners.
- Supply wrong role, run, head, evidence, revoked credential and changed approval material. Each
  must fail closed without an unauthorized mutation.
- Disconnect the visible notification channel, then restore it. Test retry/observation, duplicate
  suppression and authenticated approval; a silent file write cannot satisfy human visibility.
- Exercise task acceptance, final evaluation, pending/failing CI, new review comments, protected
  staging delivery and closeout. Production/main are out of scope.
- Run build, typecheck, lint, formatting, relevant unit/integration and fault-injection tests, Sonar
  or the documented diagnostics fallback, and exact-head hosted checks for implementation changes.
  Application browser/Electron coverage is not replaced by workflow process tests; use a later
  application feature for that coverage. Live host/isolation tests must be distinguished from fixtures.

For each intervention, record: timestamp, prior phase, expected trigger, observed result, actor,
manual action, reason, affected evidence and recovery verification. Zero required manual bridging
is necessary for an autonomous claim; normal approved human decisions are not bridging failures.

## Dependency order and delivery

This assessment is a child of the existing orchestration epic. No implementation children are created
before refinement and approval. Proposed implementation ordering is authoring/activation contract,
implementation import, phase/coordinator composition, visible transport, then integrated conformance.
Transport and provider feasibility must be investigated before committing to implementation scope.
Update Beads dependency edges only when that refined graph is approved.

Documentation uses `task/pilot-zero-assessment` from `feature/pilot-zero-assessment`, based on staging.
Any implementation uses a separately approved branch chain and exact delivery policy. Staging delivery
requires its declared gates and approval; main is excluded. Handoff hygiene is the subsequent real
feature pilot, not part of this assessment's implementation scope.

## Definition of done and sign-off

Assessment completion requires an evidence-backed proposal, scenario matrix, documented dispositions,
a valid execution contract once actual policy/branch/check bindings are resolved, a distinct compliant
critic review and explicit owner approval for implementation. Until then the proposal is not an
executable or approved contract. A syntactically valid placeholder would not satisfy this gate.

Current next gate: resolve isolated critic availability and visible notification channel selection.
No critic pass, runtime conformance, automated progression or feature completion is claimed.
Implementation, live pilot acceptance and orchestration epic closure remain separate gates.

Owner: Jason Williams. Independent reviewer: not yet assigned through a compliant launcher.

## Critic launch feasibility observation

2026-09-08: the owner requested an independent compliant critique and emphasized autonomous technical
decisions and fix-forward within scope, with human involvement only for critical decisions.
Docker reports version 29.5.3. The local image inventory contains application and MCP images, but
no identified specialist execution image. Listed networks are default/application bridge networks;
none has been verified as policy-controlled model egress. No standalone runtime configuration or
credential-broker executable was located in the inspected workflow runtime directory or repository
scripts. This is a bounded discovery result, not proof none exists elsewhere on the machine.

No critic was launched and no agreement/disagreement is claimed. The next technical prerequisite is
to locate or provision the minimal approved isolated review environment and validate its image,
egress and model authentication without exposing primary credentials. Do not install a pretend
credential broker or weaken ADR isolation to make a review appear complete. Once available, the
critic must challenge PZ-01 through PZ-09, identify existing alternative paths, distinguish missing
composition from missing implementation, and recommend the smallest safe recovery scope.

Do not ask the owner to choose routine implementation details. Prefer a standalone pilot and an
observable local interface as a provisional technical recommendation, not a claim of approved new
external messaging or production authority. Review disagreements are reconciled by agents using
evidence; only irreducible authority or product decisions require owner input. Independent review
and required security gates still precede protected delivery, even in a fix-forward workflow.

## Iteration evidence: local prerequisite verification

2026-09-08: the real Docker isolation probe passed (one test). It demonstrated the permitted file
was visible and host control/credential paths were absent in a non-root, network-disabled container.
This is not model execution or restricted online egress conformance.

The first direct launcher/runtime test run passed 27 of 28 tests. Its CLI prerequisite assertion
loaded an old `dist/cli.js` supporting only migrate/status. Running the package build corrected
that local generated-artifact mismatch; the same 28 tests then passed. No source patch or weakened
assertion was needed. Reproduction must use build-before-test, as the documented runtime script does.
The dedicated progression suite passed all 33 tests, including real parent processes, missed wakeup
handling and an accepted host execution that never starts. Typecheck and lint passed.

The remaining launch dependency is a real revocable model credential service. The repository search
finds the command-backed client in `specialistLauncher.ts` and fixture services in tests, not a
production implementation. Deleting an authentication file is not revocation, and copying primary
desktop credentials into a container would violate the declared boundary. A verified external
service or a reviewed implementation of that security boundary is needed. The installed host CLI
reports 0.30.0; it is not evidence of a provisioned, pinned specialist image.

This exposes a bootstrap review dependency: the compliant reviewer needs that environment before it
can independently review its construction. Do not silently relax the isolation rule or describe a
built-in reviewer as equivalent. Resolving this policy/service prerequisite is distinct from fixing
the now-resolved stale local build. No model specialist or autonomous feature run was launched.

## Supervised critique and corrected recovery scope

The owner subsequently directed iterative progress after the proposed supervised bootstrap exception.
A built-in Astra reviewer (`pilot_zero_critic`) was launched with no authorized mutations. This is an
explicit supervised intervention, not ADR-compliant isolated-runtime acceptance or formal contract
approval. Its source review challenged the assessment and produced these dispositions:

- Correct PZ-09: generation-pinned credential revocation is required by the active-run launcher,
  but is not automatically a requirement of every preapproval review. Dedicated model-only
  authentication and isolation remain required. Earlier claims of a universal service prerequisite
  were too broad.
- Correct PZ-02: credentials alone cannot activate a plan critic in the standalone runtime; it has
  no preapproval critic phase. Investigate a capability-stripped planning session or a narrow
  preapproval entry point using existing lower-level container helpers.
- Additional finding: those helpers give planners/critics writable source and workspace-write.
  `agent-platform-pilot-zero.2` restricts both planning roles at the mount and sandbox boundaries.
- Reproducibility repair `agent-platform-pilot-zero.1` makes the ordinary package test build first.
  The critic supports this, but it is not an isolated reviewer provisioning fix.

The reviewer confirmed implementation import and coordinator completion gaps. It recommended not
replacing existing brokers or building the full pipeline merely to obtain the first critique.
Source review of both bounded changes returned no findings; runtime test results are separate.
The new mount assertion initially failed on macOS `/var` versus `/private/var`; expectations now use
the same canonical realpath as production. No production mount behavior was relaxed to pass tests.

Sonar snippet analysis was attempted but server initialization timed out. Typecheck, lint and focused
tests form the declared local fallback; hosted security checks still apply before delivery.
The next review concerns a minimal preapproval entry point with real cleanup and exact-material
binding. It must not claim credential or network conformance based on caller strings alone.

### Completed supervised repair iterations

The independent critic approved the bounded source changes for tasks .1 through .4, not the entire
runner. Task .3 adds exact-file staging with 48 focused tests. Task .4 fixes a real Docker Desktop
nested-auth mount failure with an empty owner-only destination placeholder. The real container
probe initially could not start; after the fix it starts without any real credentials.

The critic found the new write-denial test could pass from ordinary file permissions and its cleanup
was not guaranteed on timeout. Corrections add a harmless writable fixture, worker positive control,
named-container cleanup, and a 30-second test budget covering the 15-second execution plus 10-second
cleanup bounds. A second review pass returned no findings. All four real offline Docker probes and
53 combined material/launcher tests pass; typecheck and lint pass. The full package pre-push suite
for .1/.2 passed 488 tests with one separately exercised opt-in isolation test skipped.

These transitions were coordinated by the parent in this conversation after subagent completion,
not by the package. Record that manual bridging as unproven autonomous coverage. No future model
authentication, image identity, network restrictions or active-run approval was inferred.

### Continued owner-directed iteration after PR259

PR259 merged the four prerequisite tasks into the feature branch with all 11 executed checks green.
The owner directed further iterative supervised fixes, not a pause after integration. Task .5 adds
bounded container lifecycle handling: killing an attached Docker client alone cannot establish that
the specialist stopped. A distinct source reviewer and real offline probes remain required.

Live inventory found no dedicated specialist image or verified restricted-egress network. A
network-disabled probe of the available API image found no `codex` executable. No primary model
authentication was copied or inspected. These observations identify provisioning work, not proof
that credentials alone solve the runtime. The next composition must verify the actual mounted
material, distinguish execution failure from cleanup uncertainty, and never issue formal workflow
receipts from model-echoed identifiers or injected test transports.

The ten-minute Codex heartbeat is a supervised fallback, not the workflow-control watchdog under
test. Agent callbacks, parent processing and human notifications during this repair remain manual
coverage until a real isolated execution demonstrably triggers the package's continuation path.

### Next runtime integration boundaries

The .5 container lifecycle candidate passed supervised source review and offline Docker probes.
Its normal pre-push package gate then exposed a concurrent SQLite completion failure. Subtask
.5.1 reproduces and repairs that transaction boundary before publication. The original error
message alone does not distinguish ordinary writer contention from a stale WAL snapshot.
Neither a passing retry nor a hook bypass is accepted as a fix.

The independent source audit distinguishes two remaining implementation boundaries:

- Implementation import: the retained specialist workspace is not yet a trusted repository change.
  Observe an execution-bound output manifest (including explicit deletions and modes), validate its
  allowed paths and baseline, then import and commit through the existing fenced Git broker. The
  callback must use the resulting authoritative head, not the input head or model-declared files.
- Coordinator completion: current phase receipts describe specialist executions. Add a distinct
  typed receipt, initially for task acceptance, resolved against committed broker records and exact
  job/fence/head identity. Do not fabricate a specialist execution for coordinator work.

Reuse the existing delivery broker, exact-tree Git commit port, task acceptance orchestrator and
continuation journal. Their existence alone does not prove the integrations. Required proof is a
real isolated fixture change, observed import, brokered commit, and automatically started verification
at the new head. Replay at import/commit/callback boundaries must cause one effect and one continuation.
Foreign output, pending credential revocation, stale baseline and unauthorized paths must prevent
import. Drop a completion wakeup and prove a separate watchdog process advances without a chat turn.

Online provisioning must be treated separately from offline lifecycle tests. Official
[non-interactive Codex documentation](https://learn.chatgpt.com/docs/non-interactive-mode) supports
JSONL execution and explicit sandbox settings; it does not attest our image, network or credentials.
The [authentication guidance](https://learn.chatgpt.com/docs/auth) distinguishes dedicated automation
authentication from the primary user's cached login. Do not silently copy that login or switch the
owner to API billing as a repair shortcut.
