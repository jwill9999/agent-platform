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
