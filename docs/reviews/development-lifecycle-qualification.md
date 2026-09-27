# Development lifecycle qualification

Task: `agent-platform-pilot-zero.17`. Planning and supervised implementation scope only;
no managed run, pilot, staging promotion or task-completion claim.

## Planning critique

Four isolated reviews examined source-bound snapshots through the existing qualified reviewer.
[First review](development-lifecycle-evidence/plan-review-1.json) identified interruption persistence,
monitoring, independent cleanup, service ownership, stale-owner fencing, effect reconciliation,
diagnostics and fault-injection gaps. The implementation design specifies those contracts.
[Second review](development-lifecycle-evidence/plan-review-2.json) required transactional callback
guards, retained workspace evidence, deadline/late-attempt fencing and a dedicated probe TTL protocol.
[Third review](development-lifecycle-evidence/plan-review-3.json) required independent recovery
prerequisites, lost-response probe reconciliation and a reachable private-network probe location.
All were incorporated into the design.

[Final recheck](development-lifecycle-evidence/plan-review-4.json) reports no remaining actionable
scope-design findings in those corrections, consistent with the complete design. This is independent
scope review, not persisted managed-run approval or evidence that runtime behavior works. The later
branch/merge bookkeeping update records PR275 integration without changing the reviewed behavior.

## Implementation and verification

Work is published in [PR276](https://github.com/jwill9999/agent-platform/pull/276),
`task/development-lifecycle-plan` into `feature/harness-backlog-review`, following PR275 integration.
The [operator guide](../workflow-control-development.md) describes the foreground command and approved
runtime boundary. No live pilot or staging promotion has run.

Repeated isolated implementation reviews identified defects, and repairs cover admission, cleanup
ownership, crash recovery, account/configuration preservation, exact container identity, late credential
responses, bounded waits and diagnostic redaction. Every review is retained under
[implementation evidence](development-lifecycle-evidence/implementation-review-1.json), numbered
through the subsequent review files. Earlier findings are historical evidence, not independent approval
of later revisions. [Final source recheck](development-lifecycle-evidence/implementation-review-19.json) reports no
remaining actionable implementation blockers. Its low-severity summary mismatch is corrected below;
final-head hosted gates remain a separate required merge check.

### Evidence by requirement

| Scenarios | Executed evidence                                                                                                                                                                | Boundary                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| DL-T1     | Production CLI startup, duplicate-owner/config rejection, explicit recovery and same-identity restart; journal owner fencing                                                     | Real Docker plus real account model discovery; no paid generation         |
| DL-T2     | Missing Docker/image and unsafe topology fault injection; real mismatched-container and command-only rejection; private-input alias preservation; broker protected-control tests | Injected Docker failures are labelled; no unrelated Docker shutdown       |
| DL-T3     | Broker stopped during a real fixture worker; interruption visible within the six-second assertion; admission denied                                                              | Fixture worker executable, real CLI/container/database                    |
| DL-T4     | Independent cancel/revoke failures, durable partial probe cleanup, stale acknowledgements, three-attempt exhaustion, lock and filesystem wait bounds                             | Controlled transport/clock faults plus persisted state assertions         |
| DL-T5     | Exactly one retained marker after cleanup, old-generation token denial, no repeat dispatch; effects remain uncertain                                                             | Marker proves no replay, not a general effect reconciler                  |
| DL-T6     | Coordinator killed during pending cleanup, restart with missing source checkout, stale-owner and competing lease rejection, crash before each cleanup acknowledgement            | Real restart plus deterministic fence/crash injection                     |
| DL-T7     | Bounded shutdown, both listener-bind failures, wrong-container preservation, pre-reservation interruption recovery, commit-before-finalization crash                             | Separate tests distinguish external effects from durable acknowledgements |
| DL-T8     | Stopped → ready → worker effect → broker down → interruption → restored service → contained worker                                                                               | Readiness remains blocked by unresolved effect reconciliation             |

Additional regression tests exercise both completion/interruption transaction orderings, reject a late
callback after interruption, prevent a late credential reply from recreating token bytes, preserve
replaced staging directories, and clean up terminal runs without advancing them. The container launch
sequence creates with network `none`, persists exact acknowledgement, attaches the approved network
under fresh fences, and only then starts. An earlier running-container/pending-ack injection was
removed because it did not represent a reachable launch ordering; the replacement delays the create
transport response and checks that neither network attachment nor start occurs beforehand.

The final full Linux package run at source revision `cb6c547` passed **971 tests**, with **63 optional tests skipped**. Those
optional tests require separately supplied container/client configuration; the connected lifecycle and
role-container gates are executed separately, not counted as unit coverage. The final connected run at `cb6c547` passed **21 scenarios**, including sustained healthy workers before broker
failure and the reviewer/test-runner topology matrix. The separate final role-isolation run passed
**13 real-container checks**. The added delayed-probe case initially failed because its test helper
matched Docker absence text case-sensitively. After that test-only correction it passed separately and in the final 21-scenario run;
the failed run and corrected result are both retained.
Package build and ESLint pass. Hosted browser/desktop/full verification and SonarCloud must be checked
on the final head.

The eleventh implementation review identified role-specific worker inspection, independent topology
freshness and raw background diagnostics. Repairs add exact role mount/security checks, a five-second
whole-check deadline and admission freshness, and fixed diagnostic codes. Regression cases exercise
stale topology despite fresh health and both runtime rejection handlers; real Docker inspection cases
cover added capability, unconfined seccomp, host PID and writable reviewer source. The twelfth review then identified production envelope parsing and a crash between never-issued
credential transitions. Worker policy now uses the validated envelope task, with sustained healthy
worker checks before injected failure. Null-generation revocation resumes safely because generation
binding must precede external issuance; a reopened-journal regression exercises the exact crash state.
The thirteenth review required a synchronous service fence after document verification at actual
Docker dispatch, explicit invalid-configuration diagnostics, and current-image generation evidence.
The dispatch callback now checks service admission after the document/authority checks; regression
cases invalidate readiness during snapshot verification and assert no start. Command-level permission, UID and malformed JSON cases verify exit code 2. The subsequent full regression includes operator/runtime JSON classification, rejected-create
settlement and persisted readiness expiry. The current-image generation check passed, followed by revoked-token
HTTP403; see [its retained evidence](development-lifecycle-evidence/current-image-generation.json)
and [qualification driver](development-lifecycle-evidence/current-image-generation-driver.txt).
The fourteenth review required recording a definitively uninvoked create separately from an uncertain
create, runtime-JSON classification and persisted readiness validity. A rejected dispatch now records
`not_dispatched` only when its Docker callback was never invoked; a crash before that acknowledgement
conservatively retains uncertainty. Status and admission use the persisted readiness deadline, and
a stalled-supervisor test checks expiry before the owner lease expires. The fifteenth review extended rejected-create handling to the preceding synchronous preflight
assertion as well as the dispatch callback. Both rejection locations now have regression cases
requiring zero Docker creates and durable containment settlement. Sonar complexity findings were
addressed by extracting journal migration and guarded create helpers. The sixteenth review identified uncertain probe creates. Probe dispatch, exact acknowledgement and
removal are now durable; an absent inspection cannot settle an initiated create. Cleanup retains
the token mount and pending obligation across owner restart, then removes a late exact container
before qualification can complete. The delayed-create test injects the completion window and reopens
the real journal, using a real Docker container for late settlement; it does not claim a Docker daemon
fault or a full autonomous workflow. The seventeenth review found a schema-upgrade interruption
window. Column addition and legacy backfill now share an immediate transaction; an injected SQL
backfill failure verifies rollback, followed by reopening and conservative pending cleanup.
The eighteenth review identified valid JSON with invalid runtime shape being misclassified as
cleanup failure. The development input now uses the runtime schema without host-owned transport
fields before adapter generation. CLI tests cover null, arrays and missing image as configuration
errors; the run-identity fixture was updated to supply otherwise valid configuration. Review19
accepted the repaired source. Its evidence caveat predates the final 971-test run retained below;
the final 21-scenario connected run also passed, as recorded below. Earlier review/test counts are historical, not competing
claims about the final source.

[Retained local evidence](development-lifecycle-evidence/local-verification.json) distinguishes source
hashes, commands and results. The lifecycle journeys use model discovery and a deterministic worker. A separate small real model
turn now also passed against the exact deployed broker image; prior component evidence remains in
[the broker report](local-credential-broker-qualification.md). Neither is a complete autonomous task cycle.

### Remaining boundary

Containment settlement and task-effect reconciliation are distinct. Interrupted effects default to
`uncertain`; `reconciliation_required` blocks readiness and new dispatch. Recovery does not approve
or import arbitrary effects. An approved reconciliation/retry route remains governed by the broader
pilot prerequisites. No generic filesystem rollback or automatic replay is claimed.

`.17` remains open for R1–R3 and the broader standalone path. `.13` stays blocked until those
prerequisites are complete. No feature merge, staging promotion or orchestration pilot is implied.
