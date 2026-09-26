# Project orchestration: field evaluation

## Purpose

Accumulate observations over normal authorized use of the project orchestration system, independently of the SDK modernization epic. Expect that real use may reveal stalls, missed handoffs or recovery problems. Capture what happened so the owner can later commission focused fixes with evidence. This document does not start a run or authorize repairs, and is not a second task tracker: actionable findings and their lifecycle belong in Beads.

## How to use this record

When a snag occurs, add a sanitized observation to the relevant Beads task or existing pilot assessment and link supporting logs/run evidence. Keep observations even if a manual nudge gets work moving. Periodically summarize related observations here for owner review; create or link repair issues through the normal governed workflow when fixes are authorized. During managed execution, Beads mutations go through its journaled broker.

Do not require a full investigation before recording an incident. User-observed symptoms are useful, but label them reported until corroborated. Distinguish intentional approval waits, model/tool latency, client disconnects and genuine lack of progression. Do not invent a universal timeout: record expected timing and actual timing if known.

## Observation format

| Field        | Record                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Context      | Date, project/task, phase, run reference and software/configuration revision when available     |
| Expected     | What should have happened next and what trigger should have caused it                           |
| Observed     | What actually happened; last visible activity; duration or unknown                              |
| Impact       | Work delayed, repeated, lost, unexpectedly executed or merely unclear to the user               |
| Intervention | Who noticed; prompts, restarts or manual steps needed; distinguish planned approval from rescue |
| Outcome      | Recovered, still blocked, abandoned or unknown; whether work/effects were duplicated            |
| Evidence     | Sanitized logs, timeline, screenshot or reproducible steps; mark reported versus verified       |
| Frequency    | First occurrence or linked recurrence; count only observed instances                            |
| Tracking     | Beads finding/repair reference and current disposition                                          |

## Periodic feedback for a repair agent

Group repeated symptoms; rank by impact and observed frequency. For each proposed repair provide expected/actual behavior, reproduction if known, evidence, affected version, workaround, confidence in suspected cause and a measurable acceptance test. Keep diagnosis tentative when evidence is weak. Preserve observations of successful workflows as a denominator when measuring reliability: a list of failures alone cannot establish a failure rate.

Owner feedback can then say: we used the system on these workflows, these completed without rescue, these required intervention, and these unresolved problems should be fixed. After repair, repeat the relevant scenario and link the outcome rather than erase the original incident. Scope and authority for repairs remain a separate decision.

## Evidence collected so far

The observation below concerns supervised parent/host continuation; it does not demonstrate a live managed-orchestration defect. Existing baseline findings and historical operational limitations are in [pilot-zero](../tasks/agent-platform-pilot-zero.md) and the [autonomous delivery pilot](../tasks/agent-platform-multi-agent.10.md). Revalidate them against the running revision before calling them current defects. Supervised planning and a successful staging merge do not prove uninterrupted autonomous delivery.

For formal evaluation and secure evidence requirements, see [workflow evaluation](../workflow-control-evidence-evaluation.md) and [continuation behavior](../workflow-control-continuations.md). This field record complements those controls with real-use feedback; it does not replace them.

### September 15, 2026: assessment required a user nudge

- **Context and expected behavior:** The owner authorized the source-only SDK assessment followed by critic review. The parent stated a self-check was active and that it would return with the reviewed report. Work should have continued, or a concrete launch blocker should have been reported.
- **Observed:** The owner asked, “have you stalled”. Assessment and critic review were incomplete. Inspection confirmed the host automation `harness-planning-progress-check` was configured `ACTIVE`, every 15 minutes, targeting this conversation. This proves configuration, not trigger delivery. A read-only canonical workflow journal check showed four cancelled historical runs and no active managed run; no assessment specialist had been launched.
- **Impact and intervention:** The owner prompted for progress and diagnosis. Source assessment drafting subsequently resumed under supervised parent execution; critic review was not established as complete. Exact delay, missed-trigger count and duplicate-work count are unknown.
- **Evidence:** The harness backlog review conversation, inspected host automation configuration and canonical workflow journal support these observations. No scheduler execution history or correlated host turn lifecycle log has been captured. The local configuration and journal are mutable; no immutable incident bundle was captured. This entry is not a reproducible failure trace.
- **Diagnosis:** Unconfirmed. Distinguish an undelivered trigger, insufficient restored context, a resumed turn ending prematurely, and an unresolved managed-launch boundary. The conversational explanation that the agent “forgot” is not a technical root-cause finding. The known specialist-result/coordinator callback issue was not reproduced because no assessment specialist was launched.
- **Tracking:** Linked from `agent-platform-pilot-zero` for future orchestration diagnosis. Documentation only; no repair, runtime acceptance or modernization scope expansion is authorized by this record.

## Diagnostic requirement for future continuation investigations

When an owner asks why work did not continue, a debugging agent should be able to reconstruct the last successful transition and the first missing or failed transition from durable evidence. Reuse the existing workflow journal and structured logging where possible. Local structured logs are the initial proof-of-concept option, subject to inspecting existing facilities; a paid tracing subscription is not a prerequisite.

| Transition                      | Minimum evidence                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Continuation expected           | Pending task and phase, coordinator, next action, required approval if any, saved-state references and expected trigger or deadline                          |
| Trigger scheduled and delivered | Schedule revision, due time, dispatch attempt, actual receipt or explicit failure; distinguish dispatch from receipt                                         |
| Execution resumed               | Host turn/run start, triggering event, loaded state revision and artifact references, next action or explicit blocker                                        |
| Specialist handoff              | Dispatch, specialist start, result persisted, coordinator receipt and coordinator advancement as separate events                                             |
| Execution stopped               | Observed terminal event and reported reason: completion, approval wait, error, cancellation or turn end with pending work; preserve unknown when unavailable |
| Recovery attempted              | Watchdog check, overdue transition, retry or manual nudge, attempt count and result linked to the original continuation                                      |

Correlate events using task, run, turn, parent/child, trigger and attempt identifiers where exposed. Include timestamps, sequence or journal position, component and software/configuration revision. Record state and artifact references rather than credentials, raw prompts or full model context. Define bounded retention and a sanitized diagnostic export. The expected-transition record must survive the turn that created it.

The project journal covers project-controlled execution. Codex scheduling and host turn delivery belong to the host application: project events cannot prove those occurred. Collect supported host diagnostics where available and report unavailable evidence as **unknown**, not a successful delivery or a confirmed missed trigger. Do not fabricate host events from elapsed time. A watchdog must record its own checks and failures; it cannot prove its own health while unable to run.

For a future authorized repair, evaluate controlled cases covering an undelivered trigger, a received trigger with no turn start, a resumed turn with missing state, a completed specialist with no coordinator advancement, and a turn ending with unfinished authorized work. Include an intentional approval wait as a non-failure case. Evidence should identify the boundary, show manual interventions, and demonstrate bounded recovery without duplicate execution or bypassed approval. These are proposed acceptance scenarios, not tests already run or new implementation tasks.

### September 23, 2026: permission repair bypassed the orchestration readiness decision

- **Context:** The owner authorized continued baseline tests and then explicitly approved extending
  Workspace writes to direct file mutations. The repair and verification were delivered through a
  supervised primary-agent workflow in [the direct-file permission repair](https://github.com/jwill9999/agent-platform/pull/271).
  Reviewed source: `3d7c44b`; [permission evidence](current-runtime-permission-category-baseline.md).
- **Expected:** At the transition from approved task scope to execution, assess whether the existing
  orchestration system can run that scope. Either establish a managed run or surface its concrete
  readiness/authorization blockers and identify any supervised fallback. The owner expected real-use
  blockers to feed this review.
- **Observed and confidence:** No explicit orchestration readiness decision or managed launch was
  recorded for this repair. The primary agent implemented, verified and published it manually.
  This establishes a missed workflow-selection checkpoint, not a reproduced scheduler, callback or
  continuation failure. Passing product tests and CI are not managed-orchestration acceptance.
- **Why it was not used:** The immediate observed reason is that the primary continued on the manual
  path without surfacing the selection decision. A runtime launch was not attempted, so no specific
  runtime prerequisite can be claimed as the actual cause. The exact readiness of the intended
  launch environment still needs assessment; older pilot limitations are leads, not fresh failures.
- **Approval boundary:** The pause for owner approval was deliberate because permission semantics
  changed. It was not evidence of a missed continuation. The later proposal for standing repair
  authorization was not approved and cannot explain the earlier manual execution. Existing approval
  rules remain unchanged.
- **Impact and intervention:** The product repair is verified, but this work produced no proof of
  managed specialist handoff, approval notification or automatic continuation after approval. The
  owner raised the missing orchestration use and requested this review entry. Duration and delay
  attributable to the missing checkpoint are unknown.
- **Outcome and tracking:** Observation recorded against the existing `agent-platform-pilot-zero`
  assessment; parent remains in progress. No new runtime defect, acceptance result or orchestration
  repair is asserted. Additional owner questions can extend this entry and its linked Beads record.

#### Proposed trigger for orchestration assessment

At the start of an owner-authorized task, and when its scope changes materially, the primary agent
should perform an explicit orchestration readiness assessment before choosing execution mode.
This is a proposed workflow checkpoint for review, not a new authorization rule or automatic launch.

The assessment should establish:

1. Whether the exact task scope has a reviewed execution contract and recorded approval bound to its
   current material, including permitted roles, files, operations and delivery destination.
2. Whether the configured runtime can execute the required phases, with verified isolation,
   credentials, result import, coordination and approval/continuation support for that run.
3. The decision: managed execution with a durable run reference, or the specific blocker and an
   explicitly identified supervised fallback within existing authority. If fallback authority is
   unclear, surface that decision before mutating work begins; do not silently broaden approval.

Task approval is the trigger to assess readiness; it is not itself the technical launch event.
Managed execution requires the persisted approval and runnable state plus an explicit coordinator/
launcher start. A ready Beads task, merged planning document, conversational approval or green CI
alone does not demonstrate that those steps occurred.

#### Proposed orchestration skill and discoverable entrypoint

The owner requested that the review include a dedicated orchestration skill. In the inspected
checkout, planning and critique skills are discoverable, but there is no dedicated skill explaining
when and how to start managed execution. The workflow-control package has runtime entrypoints;
its existing MCP server exposes only read-only status and prepared-transition inspection, not a
workflow launch operation. No workflow-control execution tool is exposed in this session. These are
availability observations, not proof that a configured runtime can execute the next task.

The proposed skill should describe task eligibility, readiness checks, the supported start/resume
entrypoint, approval boundaries, progress evidence and explicit blocker/fallback reporting. It should
reference canonical contracts and policy rather than duplicate them. Discovery of a skill improves
agent awareness but does not prove invocation, automatic routing, connectivity or runtime readiness.
Code must continue enforcing authorization; a skill cannot grant capabilities or bypass approval.
The review should identify both the agent-facing procedure and the technical integration needed to
make orchestration the default for eligible work, with visible exceptions.

Prefer explicit routing rules for clear cases. Task classification or confidence estimates may help
with ambiguous cases, but must not override eligibility, readiness or approval requirements. No
probability threshold has been chosen or validated. The task categories and any scoring evaluation
remain review questions rather than adopted operating policy.

#### Separate starting a new workflow from resuming one

Deciding whether a task belongs in orchestration must not depend on an existing run record. A task
that has never entered orchestration may have no relevant persisted state. The proposed procedure is:

1. Assess task eligibility and existing authority using the request, project rules and reviewed
   scope. Do not treat an absent run as an instruction to use direct execution.
2. Through a supported read-only interface, look for a relevant run bound to the same workspace and
   task scope. Distinguish a confirmed absence from an unavailable or failed status lookup; unknown
   status must not cause a duplicate run.
3. If a relevant run exists, inspect its phase, approval/material binding, expected next transition,
   blockers and terminal/interrupted state before deciding whether it can resume. A stored record is
   not proof that its worker or coordinator is alive: check runtime health and ownership separately.
   A completed or incompatible historical run must not be blindly resumed.
4. If no relevant run exists, assess the prerequisites and approved material needed to create one,
   then use the supported creation/launch path only within existing authority. Missing approval or
   runtime support produces an explicit blocker; it is not permission for silent manual fallback.
5. Record the selected start/resume path and its outcome. Where supervised fallback is permitted,
   state that mode and the reason explicitly and preserve the observation for this review.

A status lookup supports recovery and duplicate prevention; it is not the activation trigger.
“No relevant run” means assess starting one, not orchestration is unnecessary. New-run creation,
existing-run recovery and runtime health need distinct evidence. This proposed procedure does not
claim those paths have been exercised or activate them now.

#### Future consideration: model selection by role and task complexity

The owner requested recording this for possible future work, not implementing model routing now.
The existing approved policy in [the orchestration epic](../tasks/agent-platform-multi-agent.md)
is to inherit the parent model initially and benchmark before role-specific overrides. Repository
agent definitions omit model and reasoning-effort overrides. The isolated specialist launcher writes
its own minimal configuration and invokes execution without explicit model selection; that source
observation does not establish which effective model runs or prove inheritance from the parent.

A future evaluation could compare cheaper, smaller models for bounded routine tasks with stronger
reasoning models for complex planning, diagnosis or review. Selection could consider both role and
task difficulty; it should not assume that every task assigned to a given role has equal complexity.
Any escalation after failed verification should be bounded and remain within approved authority and
spend limits. No particular model, provider, price, scoring threshold or fallback is selected here.

Before adopting such routing, establish the effective model/provider and reasoning configuration at
launch, record what was actually used, and benchmark representative tasks against a common baseline.
Compare verified quality, completion, latency, retries/escalations and total cost per accepted result,
including failed attempts. Evaluate any proposal against the owner's agreed budget and require review
before changing defaults or running paid experiments. Model strength or confidence never changes
permissions, approval requirements or acceptance gates.

Disposition: future review consideration only. No model assignment, dependency, provider integration,
benchmark run or budget change is authorized by this note.

#### Questions retained for the orchestration review

- How should a discoverable skill and supported entrypoint expose eligibility, readiness and
  separate start/resume paths without conflating absent state with unavailable infrastructure?
- Which existing entrypoint should own this checkpoint, and how is its decision recorded so it
  cannot be silently skipped on a resumed session?
- Which launch prerequisites are actually satisfied in the current environment, and which are
  missing, unsupported or simply not yet exercised?
- What user-visible event distinguishes waiting for legitimate approval from failed notification,
  failed receipt or failure to continue after approval?
- Can the next bounded, approved baseline task provide real orchestration evidence without changing
  permission rules or claiming unattended capabilities that have not been demonstrated?

The next step is readiness investigation and owner review of these findings. This entry does not
activate orchestration, authorize specialist launches, approve standing repairs, or promote code.

#### Testing-gap reminder: upfront approval in real managed use

Added September 24 at the owner's request. We have not yet demonstrated that an approved scope
completes through a real managed workflow without unnecessary repeat approvals. During the next
separately authorized real-use evaluation, check that approval remains correctly bound across
specialist handoffs, interruption and recovery, and that renewed approval is requested only when
required by changed/revoked authority or a genuine exception. Record prompts, their reasons, manual
interventions and whether execution continued correctly. Distinguish legitimate approval waits from
notification or continuation failures. Surface any problems in this review and the existing Beads
assessment; use the evidence to decide whether specific rework is needed. This is an untested area,
not a confirmed defect, redesign decision or authorization to launch a run or change permissions.

#### Proposed single-task and two-task assessments

The owner requested a staged real-use assessment: first complete one bounded task and review its
outcome; if successful, approve a second pilot containing two dependent tasks and verify automatic
progression between them. The [assessment protocol](orchestration-staged-assessment.md) records
readiness, pass/fail criteria, evidence and intervention reporting. Both remain unexecuted. A blocked
readiness check or failed pilot is useful evidence and must be surfaced; manual completion is not a
managed pass. The two-task pilot is conditional on successful reviewed single-task evidence.

#### Planning-skill evaluation reminder

At the owner's request, assess the existing feature-planning skill while preparing the pilot. Record
any missing requirements, ambiguous guidance, validation or critic-handoff gaps, and missing steps
between the planning output and a runnable approved workflow. Capture expected versus observed
behaviour, evidence, impact and any manual supplementation or intervention. Distinguish a skill gap
from unavailable runtime infrastructure or an intentional approval boundary. Surface findings here
and in the existing Beads assessment rather than silently filling gaps and treating the skill as
complete. This reminder does not assert a defect or authorize changes to the skill; propose specific
rework only when supported by the assessment.

## Skill preparation evidence — 24 September 2026

The owner authorized creating the missing skills and reviewing the handoff before joint review.
See the [skill readiness assessment](orchestration-skill-readiness.md) for the created files, existing
skill gaps, source-level runtime limitations and outstanding independent behavioral review.
This preparation used the explicitly authorized direct path; it is not a managed pilot result.

## Document-approval planning assessment — 24 September 2026

After PR271 merged, task `agent-platform-pilot-zero.16` received planning/critique authorization.
The planning skill's explicit document and test requirements produced the
[binding proposal](../planning/approved-document-binding/plan.md), task spec and connected verification
plan. Current runtime does not bind linked document bytes; this remains a blocker, not fixed by hashes
written in prose. Existing primitives support staging and content-addressed reads, but approval,
resume and inherited paths require a shared enforcement design. Independent isolated critique also
identified a failed-invalidation/restart gap; the proposed durable attempt/recovery protocol and
compound tests address it at design level. [Review record](approved-document-binding-plan.md) retains
findings and exact snapshot evidence. No managed pilot, implementation or new execution approval.

## Supplied handoff assessment reference — 26 September 2026

[Orchestration handoff gap reference](orchestration-handoff-gap-reference.md) preserves an
owner-supplied assessment of delivery, host execution, parallel progression, latency and possible
A2A adapters. Its code/test claims await independent verification; timings are illustrative and
proposals are not accepted scope. Use it during the high-level existing-versus-planned comparison.

## Future reuse options — draft reference

[Owner-supplied reusability analysis](orchestration-reusability-draft-reference.md) preserves discussion
of packaging, configuration, onboarding and adapter boundaries for consideration after a stable
implementation. It is not accepted scope and does not change the current assessment sequence.
