# Orchestration handoff gap assessment — supplied reference

## Provenance and status

Saved at the owner's request on 26 September 2026 from assessment text supplied in this conversation.
The supplied assessment says it compared implementation and tests on `task/approved-document-binding`;
it does not identify an exact commit, test commands, evidence files or measured timings. This note
preserves its substantive claims, examples and proposals in structured form, not as a verbatim transcript.
No independent code/test validation was performed while saving it.

Use as context alongside the [orchestration field evaluation](orchestration-field-evaluation.md)
and [approved-document binding evidence](approved-document-binding-implementation.md).
The latter does not automatically validate every claim below. Confidence ratings are the supplied
assessment's judgments, not this project's acceptance results. Verify against current code and tests
before relying on them. No backlog, priority, implementation, architecture or release decision is changed.

## Question and supplied conclusion

Can Agent A finish, reliably hand off to Agent B, and have Agent B start promptly without a human turn?

The assessment argues that internal delivery correctness and crash recovery are comparatively strong,
and that end-to-end execution availability and host/transport latency deserve more attention than
replacing the messaging substrate. Treat this as a hypothesis to validate, not proof of unattended operation.

## Reported handoff path

```text
Agent A terminal structured result
  -> SchedulerExecution atomic completion
  -> DelegateCallback
  -> ContinuationJob -> Event Outbox
  -> ContinuationWorker
  -> Parent execution, atomic consume
  -> PhaseJob
  -> Agent B
```

## Reported reliability properties

| Property | Mechanism identified in supplied assessment | Supplied judgment |
| --- | --- | --- |
| Durable delivery | SQLite journal | Strong |
| Missing-message recovery | reconcileMissingIntents() | Strong |
| Duplicate delivery | Stable IDs and idempotency | Strong |
| Competing consumers | Leases and epochs | Strong |
| Stale consumers | Fencing tokens | Strong |
| Crash/restart | Persisted continuation jobs | Strong |
| Acknowledgement | accepted → started → consumed | Strong |
| Structured results | Zod contracts | Strong |
| Integrity | SHA-256 bindings | Strong |
| Parent wake-up | Signal and watchdog | Strong locally |
| Immediate local handoff | EventEmitter signal | Claimed fast; no measurements supplied |
| Cross-process wake | Supervisor/polling | Good |
| Remote messaging/network/A2A streaming | Reported absent | Candidate gap if required |
| Backpressure/fairness | Reported basic | Partial |
| Distributed ordering | Not applicable to current local scope | Conditional future gap |

The key reported distinction is receipt versus execution: an `accepted` acknowledgement does not
establish `started` or `consumed`. If a parent acknowledges then crashes, the assessment says the
watchdog can recover without falsely progressing the workflow.

Reported regression scenarios to locate and verify:

- Specialist completion signals wake the parent without waiting for a configured 60-second watchdog.
- A callback receiver crashes, its lease expires, another worker claims and resumes the continuation,
  and the former worker is fenced from consuming it.

These descriptions do not establish that the same path works through a live desktop host.

## Five proposed gap areas

### Parent execution transport

The assessment identifies `AsyncParentExecutionHost.observe()` and `.start()` as the boundary between
reliably recording that another agent should run and actually starting it. It reports a real local
process implementation but `host_resume_unavailable` for Codex Desktop without a conformant adapter.
Verify current adapter availability. An A2A transport for independently addressable services would
not by itself make an existing desktop conversation resumable.

### Local event transport

The supplied assessment describes `continuation_events` as a transactional outbox with a JSONL sink.
For future multi-host execution, it proposes additional SSE, WebSocket or A2A adapters while preserving
the journal. It advises against introducing Kafka, NATS or Redis Streams merely for current single-host
needs. These are proposals, not a verified transport inventory or approved technology selection.

### Parallel progression

It identifies a continuation-claim exclusion involving the same run and an unexpired lease as evidence
of per-run serialization. Verify that interpretation and its scope: serial coordinator consumption
must not be assumed to prohibit all child concurrency. The proposed assessment is explicit fan-out,
fan-in and join behavior, potentially with group identity, dependencies, expected/completed children
and a join policy. No new contract fields or parallelism changes are authorized.

### Messages, events and artifacts

The assessment proposes separating three conceptual records:

| Concept | Illustrative fields |
| --- | --- |
| AgentMessage | Sender, recipient, correlation ID, conversation ID, payload |
| WorkflowEvent | Run/task identity, type, sequence, timestamp |
| Artifact | Digest, producer, media type, location |

It cites specialist_completed, callback_committed, continuation_started, phase_queued, phase_started
and phase_completed as workflow events, and notes that DelegateCallback already carries identity
and correlation information. Evaluate whether clearer boundaries help interoperability without
introducing redundant records.

### Handoff latency and reliability evidence

The proposed timeline is:

| Point | Event |
| --- | --- |
| T1 | Specialist completes |
| T2 | Callback commits |
| T3 | Continuation is claimed |
| T4 | Parent starts |
| T5 | Continuation is consumed |
| T6 | Next phase is queued |
| T7 | Next agent starts |

Proposed measurements: callback T2−T1, wake T4−T2, consume T5−T4, dispatch T7−T5,
and total handoff T7−T1. The assessment names created_at_ms, accepted_at_ms, started_at_ms and
consumed_at_ms as existing timestamps; verify that all required event points are actually recorded.
Define consistent clocks, run correlation and start/completion semantics before comparing timings.

The supplied examples are **illustrative only**: p50 120 ms, p95 420 ms, p99 870 ms,
maximum 1.4 seconds, recovered p95 2.1 seconds. None are measured platform results.
The proposed normal objective is under one second p95 from terminal result to next-agent start;
recovery is suggested within lease TTL plus recovery interval. These are not agreed SLOs and need
realistic host, queue, startup and contention budgets before adoption.

Proposed safety properties: no lost terminal callbacks, no duplicate workflow transitions,
no stale-agent transitions, and correlation across every handoff. A suggested experiment repeats
500–1000 handoffs with crashes, delayed/duplicate callbacks, reordered notifications, lost
acknowledgements, supervisor restarts, database contention and slow agents. This experiment has not
run as part of this reference. Decide test environments, statistical method and CI suitability later.

## Suggested A2A boundary

```text
Workflow control -> delegate/task -> A2A adapter -> independently hosted agent
Remote task status/result -> adapter -> DelegateCallback -> ContinuationJournal
```

The assessment proposes keeping ContinuationJournal, PhaseJobJournal and the state machine
authoritative while adapters support task submission, progress, artifacts and terminal status.
Assess A2A protocol capabilities and versions against primary documentation before designing an
adapter; no external protocol research was performed while saving this supplied text.

## Proposed direction, not accepted sequencing

The supplied assessment recommends a handoff reliability/latency test harness and clearer fan-out/
fan-in semantics, followed by A2A for independently hosted agents, rather than redesigning the durable
core. Its qualitative ranking is strongest for contracts, durability, idempotency and fencing;
weaker for measured latency, joins, remote interoperability and desktop resumption.

Before carrying any of that forward, compare it at high level with existing and planned features,
locate supporting code/tests, and distinguish missing functionality from missing evidence or
out-of-scope distributed requirements. Reconcile with the remaining skill/runtime readiness and
single-task pilot work. Joint review decides accept for investigation, defer or do not carry forward.
Existing Beads priorities remain unchanged. This note is reference context, not a new execution plan.
