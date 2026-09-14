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

No new live orchestration incident is asserted by this document. Existing baseline findings and historical operational limitations are in [pilot-zero](../tasks/agent-platform-pilot-zero.md) and the [autonomous delivery pilot](../tasks/agent-platform-multi-agent.10.md). Revalidate them against the running revision before calling them current defects. Supervised planning and a successful staging merge do not prove uninterrupted autonomous delivery.

For formal evaluation and secure evidence requirements, see [workflow evaluation](../workflow-control-evidence-evaluation.md) and [continuation behavior](../workflow-control-continuations.md). This field record complements those controls with real-use feedback; it does not replace them.
