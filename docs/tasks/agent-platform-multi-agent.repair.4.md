# Task: Add governed review-thread resolution

**Proposed Beads issue:** `agent-platform-multi-agent.repair.4`

**Parent task:** `agent-platform-multi-agent.10` — Run autonomous feature-delivery pilot

## Summary

Add narrowly typed, journaled Beads-note and GitHub review-thread operations, then use them to finish
the delivery pilot without unresolved review comments or arbitrary external write access.

## Requirements

- Supersede the unmerged recovery PR and its exact-head intent without rewriting historical evidence.
- Before bootstrap, terminalize the old run through its existing cancellation coordinator under its
  current fences, verify that it has no prepared effects, preserve its intent as unusable cancelled-run
  evidence, and release or fence its leases. Only afterward may the human owner close the old unmerged
  PR. Re-fetch and verify the PR is closed before, with no active run, creating this task manually in
  Beads and initializing the new approved run.
- Extend the exclusive production Beads broker with an exact-task, compare-and-swap note-update
  operation bound to expected prior-notes and exact replacement-notes digests. Preserve status,
  description, acceptance criteria, ownership, dependencies, and every other field; no direct Beads
  writer may be introduced.
- Extend the production GitHub broker with typed review-thread observation, evidence-backed reply,
  and individual thread-resolution operations; arbitrary API routes and review dismissal remain
  prohibited.
- Add a provider-neutral `notification.approval` operation to the workflow operation schema and a
  registered production port restricted to the workflow orchestrator. Bind a deterministic event ID
  to run, task, phase, contract, policy, material, head, action-scope, authenticated recipient,
  destination digest, allowed-response digest, and expiry. Journal observe-before-send, idempotency,
  fencing, bounded retries, restart reconciliation, provider generation/message ID, and accepted-at.
- Model approval notification as compare-and-swap states `prepared`, `delivery_pending`, `delivered`,
  `delivery_failed`, `approved`, `resume_pending`, and `resumed`. Provider acceptance proves transport
  acceptance only, not human receipt or reading; approval is a separate authenticated human response.
  No post-gate mutation may occur until resume-confirmation transport delivery is acknowledged.
- Treat the present owner approval as an explicit bootstrap through the existing visible authenticated
  human channel. This contract authorizes implementation and tests, but not external notification use.
  After implementation and independent review, approve a revised exact execution contract containing
  the new operation before notification dogfooding, Beads/GitHub dogfood mutation, or delivery.
- Fix delegated-agent continuation. Every terminal callback must be durably recorded, wake the parent,
  and use a typed `workflow.delegate_callback` operation restricted to the orchestrator. Bind its
  deterministic identity to exact parent run/task/state/version, delegation, delegate identity/role,
  attempt, contract/policy/material, workspace, parent-run and applicable task fences, input artifact, terminal status, and result
  artifact. Atomically record disposition and CAS the parent only to a normative transition target;
  human decisions enter `approval_waiting`, blocked results enter `escalated`, and close still requires
  verified finalization. Duplicate, stale, lost, interrupted, or restart-spanning callbacks reconcile
  idempotently; unhandled callbacks fail closed and may never leave the parent silently idle.
- Define the complete callback phase/result table: implementation continues to task verification; an
  implementation repair finding also goes to task verification so evidence is verified before a later
  repair transition. Verification continues to review; review continues to accepted; feature evaluation continues to
  pipeline; repair planning continues to implementation; pipeline continues to delivery; delivery
  continues to finalizing. Each phase's repair result uses its existing repair target, blocked always
  enters escalated, and finalizing completion self-transitions for the finalization coordinator, which
  alone may verify and close.
- Explicitly add blocked-result escalation edges from implementing, task verification, task review,
  feature evaluation, pipeline, delivery, and finalizing; repair planning already permits escalation.
  Prohibit delegate launch from phases absent from the table and reject unmapped phase/result pairs
  before callback acceptance.
- Add normative `approval_waiting` state. Only task review, feature evaluation, repair planning,
  pipeline, delivery, and finalizing may enter it. The durable predecessor selects an allowlisted
  resume target; resume requires authenticated approval and acknowledged resume-notification delivery.
  It also supports cancellation, deadline escalation, and restart recovery back to the same recorded
  approval wait.
- Use two immutable runs. The bootstrap run may commit and push only
  `task/agent-platform-multi-agent.repair.4`, then records an `implementation_artifact_ready`
  attestation binding contract, task, ref, exact head/tree, tests, and unchanged in-progress Beads
  snapshot. It opens no PR and performs no notification, Beads, review-thread, or merge dogfooding.
  It terminalizes via the cancellation coordinator with `planned_authority_handoff`, proves no prepared
  effects, and releases or fences every lease while leaving Beads in progress without mutation.
- A distinct revised delivery run receives fresh critic and owner approval and fresh fences. Its typed
  `workflow.lineage_import` verifies the predecessor is terminal and fenced and that ref, head, tree,
  attestation, and Beads snapshot match exactly, then atomically establishes a new run-scoped
  approved-head ledger and operation journal and transitions the revised run from `approved` to
  `pipeline`. Direct creation in `pipeline` and fabricated intermediate events are prohibited. Only
  afterward may it open a PR or exercise notification, note, thread, or
  merge authority. Ref rewriting, ambiguous adoption, and concurrent writers are prohibited.
- Persist a structured disposition for every thread: actionable, already addressed, false positive,
  informational, or human decision required. A worker cannot approve resolution of its own finding.
- Route actionable comments through bounded repair and rerun exact-head verification. High-risk false
  positives require an independent critic or human decision.
- Fail the merge gate unless the exact head is unchanged, all required checks pass, every disposition
  is accepted, GitHub reports zero unresolved threads, and no newer review event exists.
- Use the new operations to update the recovery Beads note and resolve all review threads on the
  replacement integration PR before squash merge to `feature/multi-agent-orchestration`.
- After the replacement head exists, require a fresh independently reviewed and owner-declared
  staging intent bound to the new run, task, head, current protection/check set, squash, and no bypass.
- Stop this repair at `feature/multi-agent-orchestration`; protected staging requires a later,
  separately reviewed FeatureDeliveryContract. Prohibit administrative bypass and `main` promotion.

## Implementation plan

1. Add strict request, snapshot, disposition, and evidence schemas for Beads notes and GitHub threads.
2. Extend the registered production adapters and durable journals with observe-before-mutate,
   compare-and-swap, fencing, idempotent replay, conflict escalation, and restart reconciliation.
3. Add reviewer separation and final no-unresolved-thread checks to the merge readiness gate.
4. Add the typed notification operation, registered provider-neutral production port, deterministic
   bindings, CAS state machine, transport acknowledgement, authenticated response, visible failure
   escalation, and post-approval resume acknowledgement gate.
5. Add negative authorization, silent-wait, notification-loss, stale-event, comment-race,
   response-loss, and crash-boundary tests.
6. Add durable terminal-delegate callback ingestion, parent wakeup, deterministic disposition, visible
   status, parent-run fencing, complete phase/result mapping, normative approval-waiting transitions,
   idempotent replay, and restart reconciliation.
7. Add and test exact two-run lineage handoff. Build, test, commit, and push the bootstrap implementation
   head; record its exact attestation; terminalize and fence the bootstrap run with no prepared effects.
8. Obtain independent review and owner approval of a distinct revised execution contract explicitly
   granting lineage-import and notification authority. Import the exact implementation head into the
   new run-scoped ledger and journal, derive a new exact-head staging intent, and only then run the
   replacement PR through local and hosted gates.
9. Dogfood the new broker to update the Beads note, reply to and resolve every thread, re-observe zero
   unresolved threads, and perform the approved feature merge.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.repair.3` exact unmerged head and its recorded evidence.
- **Downstream:** post-merge feature-to-staging contract review and approval.
- **Branch parent:** `task/agent-platform-multi-agent.repair.3` at its exact published head.

## Tests and verification

- Workflow-control unit and fault-injection tests for every new operation and recovery boundary.
- Negative tests for arbitrary GraphQL/API routes, cross-repository/PR/thread substitution, stale
  heads, stale note digests, collateral task-field mutation, unaccepted dispositions, worker
  self-resolution, review dismissal, and admin bypass.
- Two-store restart and response-loss replay tests prove exactly-once external effects.
- Approval-gate tests prove exact identity binding, typed role authority, CAS transitions, transport
  acceptance semantics, separate authenticated human response, expiry, retry/restart recovery, and
  that delivery failure remains visibly action-required while every post-gate mutation stays blocked
  until resume-confirmation transport delivery is acknowledged.
- Delegation tests prove terminal critic results wake the parent and exactly once produce a visible
  continuation, repair, approval request, blocker, or completion across duplicate callbacks, callback
  races, parent interruption, and process restart—without a user prompt.
- State-machine tests exhaust every callback phase/result target and approval-waiting predecessor,
  resume allowlist, cancellation, deadline, and recovery path; stale workspace, run, or task fences
  fail closed, and only the finalization coordinator may close.
- A generated callback matrix proves every listed edge is normative, implementation repair passes
  through verification, each new blocked edge enters escalation, and all unlisted launches and results
  are rejected before callback acceptance.
- Two-run tests reject non-terminal or unfenced predecessors, prepared predecessor effects, stale or
  rewritten task refs, head/tree/attestation/Beads mismatches, reused run identity, stale approval,
  duplicate writers, and import without a new run-scoped ledger and journal.
- Import tests require one atomic `approved` to `pipeline` transition with ledger and journal creation,
  and reject direct pipeline initialization, partial commit, and fabricated lifecycle evidence.
- Full build, typecheck, lint, format, workflow-control tests, docs checks, dependency-cycle checks,
  Sonar/Problems gate, and hosted feature-boundary checks.
- Final GitHub observation proves zero unresolved threads at the exact merge head.

## Implementation and handoff checkpoint — 2026-09-07

This checkpoint records implementation evidence, not completion of the delivery pilot or an amendment
to the immutable approved runtime contract. The coordinator reports both independent reviews passing
for the durable phase-job and standalone-runtime slices.

- Typed callbacks atomically enqueue bound phase jobs; execution/recovery leases, producer/role/head
  evidence checks, restart reconciliation, and visible blockers are implemented.
- `phase-runtime` and `standalone-conformance` are concrete CLI entrypoints. The runtime composes the
  credential broker, isolated Docker launcher, journal, evidence vault, and callback disposition.
  Explicitly authorized read-only task verification and review can advance to task acceptance.
  Acceptance requires every approved criterion and no unresolved findings or risks; input evidence
  binds the actual execution, owner, callback, head, run version, and fencing generation.
- Implementation artifact import and coordinator terminal receipts remain unavailable; implementation,
  pipeline/delivery/finalization work must not be reported as autonomous execution. Production needs a
  revocable credential-broker executable, immutable specialist image, constrained egress network,
  non-root identity, approved source checkout, and explicit task phase-role grants. None were deployed.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, `pnpm docs:lint`, and
  `pnpm deps:check-cycles` passed at the repair4 working candidate. Workflow-control: 393 passed,
  one opt-in Docker isolation test skipped. Runtime tests include real child processes with fixture
  transport; they do not prove actual Docker/Codex conformance. Cycle detection reported no cycles but
  skipped 76 unresolved imports. The full test run emitted tracing-export HTTP 403 warnings while
  exiting successfully. Hosted exact-head checks, actual standalone conformance, and final live pilot
  evidence remain separate gates; this checkpoint does not certify Sonar/IDE Problems results.

### Read-only bootstrap observation

At this checkpoint, journal `28d0df6dc7d1762064d7c275c3b1411f1dbc97ec01bd91beeb11c287afbca3b8`
under the local workflow-control runtime root has schema version 10. Run
`bootstrap-agent-platform-multi-agent.repair.4-20260906` is `approved`, version 0, with an active
material-bound owner approval and no transition, delivery-operation, scheduler-execution, or
cancellation rows. Its predecessor is cancelled. Only expired workspace/predecessor leases were
present. No live database migration, Git write, Beads mutation, notification, or delivery was performed
for this checkpoint. Re-observe before using these facts.

### Bootstrap correction candidate and next authority packet

Correction verification: root build/typecheck/lint/test/format/docs checks passed, with test tracing
disabled. Package build/typecheck/lint/test passed again after removing a type-import layering cycle:
424 tests passed and one opt-in Docker isolation test skipped. The dependency gate now passes with
no cycles and 77 unresolved-import skips. New tests cover 25 bootstrap cases, three cancellation
transport cases and three added phase-cancellation cases. Current Sonar/IDE Problems, authenticated
live approval and external conformance remain unverified; these terminal gates are not full delivery.

`BootstrapCoordinator.create(database, runId, policy)` now composes a Git-only authenticated delivery
port, exact candidate observer, durable existing-ref adoption, commit/push broker, secure typed
`implementation_artifact_ready` recorder and observed-empty-work cancellation. No GitHub placeholder
client or fabricated Beads claim/ref creation is used. The concrete adapter protocol and execution
sequence are documented in [delivery brokers](../workflow-control-delivery-brokers.md#task-only-bootstrap).

The new `bootstrap-preflight` CLI validates the exact approved packet and computes the candidate tree
without constructing a mutable store, migrating the journal, writing Git objects/indexes, calling
Beads or contacting the remote. It is a preflight, not proof that remote credentials work. The library
provides the mutating sequence; there is intentionally no auto-approve or live-migration CLI.

Final approval must bind a distinct immutable v1 contract and full `bootstrap_task_artifact` policy:

1. Keep the canonical original checkout/workspace digest and journal. Explicitly bind the repair4
   source realpath, both exact Git common directories, task ref and initial head. Shared common Git
   storage alone never authorizes an arbitrary source checkout. Do not modify the old approved run.
2. Bind every changed path, content digest/deletion, file mode, computed tree and NUL-delimited
   no-renames diff digest. Task and top-level grants must include workspace read, artifact write,
   workflow transition, Beads read, Git read/commit/push. Grant no Beads mutation, GitHub delivery or
   approval notification authority. Include the actual required `docs`, `packages/workflow-control`,
   `Dockerfile`, `docker-compose.workflow-control.yml` and `session.md` path scope in the reviewed packet.
3. Bind exact repository, remote name/URL/current SHA-or-absence CAS, real author/email/time/message,
   unchanged full in-progress Beads snapshot, and owner-only read/remote executable realpaths and hashes.
   These reviewed executables and narrowly scoped credentials are runtime inputs, not supplied here.
4. Record actual content-addressed test and independent review artifacts, including their producer,
   role and candidate tree; bind these exact references in the full policy. These are explicitly
   approved pre-bootstrap artifacts, not invented completed specialist executions. Require the latest
   independent critic approval and a real authenticated owner approval over the exact material/policy.
   Conversation authorization to implement does not repair the old journal's missing task-level grants.
5. Once that packet is reviewed/approved and migration is authorized, use the coordinator to observe
   and adopt the preexisting ref through `approved -> scheduling -> implementing`. Both transitions
   carry real observations; the second atomically records the typed receipt and initial head ledger.
   Commit/push revalidate the full stored policy and fresh resource fences. Recovery observes an
   uncertain effect before adopting it; changed source, policy, Beads or remote observations fail closed.
6. Require the secure attestation for the exact published head before terminalizing with reason
   `planned_authority_handoff`. Cleanup observes actual scheduler/credential/prepared/phase/outbox work;
   it refuses to assert unknown execution stopped. Cancellation transactionally fences queued work
   and approval contexts, blocks new claims, and requires pending transport effects to settle.
   Keep Beads unchanged and retain the attestation. Do not reuse historical no-op cleanup scripts.

This correction does not implement the downstream revised-policy lineage import or connect its
separate ledger to delivery consumers. Those remain a separately reviewed next slice, as do actual
credential provisioning, isolated Codex conformance and the external pilot. No live journal migration,
approval, commit/push, cancellation, Beads change or deployment was performed for this candidate.

Safe next action: independently review the bootstrap correction, then construct the exact final
approval packet from the frozen candidate and real runtime observations. Do not execute the live
mutating sequence merely from this checklist.

## Definition of Done

- [ ] Only registered, frozen, typed production brokers can update Beads notes or resolve threads.
- [ ] Every thread has an accepted, evidence-backed disposition and durable reply/resolution record.
- [ ] The merge broker rejects unresolved, newly added, stale-head, or unreviewed threads.
- [ ] No human approval gate can wait silently: approval-required delivery is acknowledged or the run
      visibly fails closed, and successful approval produces an immediate resume confirmation.
- [ ] No completed delegate can leave its parent silently idle; its result is durably ingested and
      deterministically advances or visibly stops the workflow without user prompting.
- [ ] Bootstrap stops at an attested exact implementation ref with no external dogfood mutation; the
      distinct freshly approved delivery run imports it through typed lineage verification under new
      fences, approved-head ledger, and operation journal.
- [ ] The replacement PR passes all gates and squash-merges without bypass to the feature branch.
- [ ] A fresh critic-approved and owner-declared staging intent is bound to the replacement exact head
      before its feature merge; no approval from the superseded head transfers.
- [ ] The committed merge attestation becomes the sole origin for separately approved staging delivery.
- [ ] No staging-to-main or production promotion occurs.

## Sign-off

**Owner:** Authenticated human approver

**Executor:** Isolated implementation worker

**Reviewer:** Independent code/security reviewer and plan critic
