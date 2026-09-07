# Workflow-control repair loops

Task repair is coordinated by `DurableRepairCoordinator`. The orchestrator remains the only workflow
writer; specialists produce typed findings and evidence but cannot charge budgets, select their own
repair authority, accept results, or create escalations.

Every dispatch, acceptance, and cancellation mutation validates the current workspace, run, and task
lease owner and epochs inside its SQLite transaction. The workspace must be the workspace owned by the
run's immutable contract. A higher-epoch recovery owner may continue durable work; the fenced prior
owner cannot mutate it. Repair writes also require an internal coordinator capability that is not
exported by the package. Acceptance rechecks all leases with a fresh trusted clock after Git
verification and immediately before its durable update. Production always uses module-owned
`Date.now`; injected test clocks must remain finite and monotonic.

## Role routing

The failure source fixes both the authoritative producer and the repair owner.

| Failure source          | Authoritative producer | Repair owner            |
| ----------------------- | ---------------------- | ----------------------- |
| Compile, test           | `test_runner`          | `implementation_worker` |
| Review, security, Sonar | `code_reviewer`        | `implementation_worker` |
| QA                      | `qa_evaluator`         | `implementation_worker` |
| Feature evaluation      | `feature_evaluator`    | `implementation_worker` |
| Test definition         | `code_reviewer`        | `test_runner`           |
| Environment             | `test_runner`          | `workflow_orchestrator` |

Acceptance evidence must return to the finding's authoritative producer. For example, test evidence
cannot resolve a security finding without a new code-reviewer verification.

## Evidence and retry rules

- Finding, change, and acceptance evidence must match the exact workspace, run, task, contract
  version, policy digest, media metadata, and required producer role.
- Failure evidence must identify one canonical full Git commit. The trusted local Git verifier proves
  that every repaired head is a strict descendant, rejects ancestor and unrelated-branch results, and
  confirms acceptance evidence against the repository's exact current `HEAD`.
- Production construction canonicalizes the repository root, checks its SHA-256 workspace identity
  against the execution contract, and always installs the concrete verifier. The injectable verifier
  factory is test-only. Git commands have five-second timeouts, bounded output buffers, a sanitized
  environment that cannot inherit Git repository redirects, and a verified canonical top-level.
- A hypothesis retry uses one canonical hypothesis in both the packet and attempt journal. It must
  differ from the failed task attempt or preceding repair.
- Implementation, environment, and test-condition changes require owner-produced evidence newer than
  the failure baseline and every preceding evidence-based repair for that finding. Historic evidence
  cannot be alternated or rebound to bypass identical-retry detection. Every item must bind to the
  same nonempty repaired head.
- The persisted packet contains the exact finding evidence and remaining task and finding budgets.
- Finding identity is content-digest-bound across dispatches and escalation.

## Budgets and escalation

The initial implementation is task attempt 1. Each repair atomically charges the task counter and the
finding counter; their approved maxima come from the immutable execution contract. Existing counters
whose recorded maxima differ from the contract fail closed.

When either counter is exhausted, the coordinator writes one escalation keyed by run and exhausted
scope. Replays return that record without producing another escalation. A task-wide escalation is
shared by later findings on the same task, while reuse of an existing finding ID with changed content
is rejected.

## Acceptance and recovery

An accepted repair must be passed, prove the affected approved acceptance criterion, stay within the
task's allowed paths, contain no failed criteria, findings, or remaining risks, and recommend only
continued verification or integration. Its evidence must come from the source-authoritative verifier.
All verifier evidence must be produced after dispatch and bind to one nonempty repaired head. That
head matches evidence-based changes; a hypothesis repair must be a strict Git descendant of the
failure head. Acceptance derives the changed paths from a NUL-delimited Git name-status diff, includes
both endpoints of every rename or copy, requires the trusted path set to exactly match the reported
set, and checks every trusted path against the task authority. It then verifies a clean exact `HEAD`,
rereads it after the cleanliness check, and runs the check inside the fenced transaction that commits
the accepted result.

Dispatch, acceptance, cancellation, and escalation are durable SQLite records. Cancellation updates
only a dispatched repair, so an accepted result remains immutable through late cancellation and
process restart. Recovery reads the same accepted record rather than rerunning or discarding it.
