# Repair4 task-artifact bootstrap approval preparation

This is a proposal supporting [repair4](agent-platform-multi-agent.repair.4.md), not an approval,
runtime initialization, migration, commit or push receipt. It stops at a published implementation
artifact and planned cancellation. The external proposal directory holds the candidate manifest,
draft policy, draft contract, observations and validation results; these files stay outside the
candidate so policy and evidence digests cannot refer to their own containing Git tree.

## Scope and exact authority

Use the canonical workspace `/Users/letuscode/projects/agent-platform`, source checkout
`/Users/letuscode/.codex/worktrees/repair4/agent-platform` and common Git directory
`/Users/letuscode/projects/agent-platform/.git`. Preserve the canonical workspace digest and existing
journal. The one authorized ref is `refs/heads/task/agent-platform-multi-agent.repair.4`, based on
`0526507b3e2a1d644bbca1e4808de7bd410026f8` from `task/agent-platform-multi-agent.repair.3`.
The repository is `jwill9999/agent-platform`; origin fetch and push URLs are both
`https://github.com/jwill9999/agent-platform.git`. Re-observe the remote immediately before approval
and execution. The initial preparation observed this task ref absent, so the proposed remote CAS
precondition is `null`, never an unconditional force push.

Both the contract and its sole task grant exactly `workspace.read`, `artifact.write`,
`workflow.transition`, `beads.read`, `git.read`, `git.commit` and `git.push`. The task executor is
`workflow_orchestrator`. Path authority covers `docs`, `packages/workflow-control`, `Dockerfile`,
`docker-compose.workflow-control.yml` and `session.md`; the policy further binds every changed
path, content digest, deletion and executable mode. No source editing or additional implementation
is included in this publication-only run. Beads mutation, notifications, GitHub delivery, PR creation,
review-thread writes, merges, staging and main promotion are prohibited.

The proposed commit uses the user's global Git identity, Jason Williams
`<jasonwilliams2308@gmail.com>`, rather than the repository-local test identity. The approval packet
must bind the exact author, timestamp and message without changing repository configuration.
Any different author choice changes the packet and requires a new digest and review.

## Production dependencies and evidence

Two reviewed owner-owned executable adapters are required: a read-only official Beads snapshot
adapter and an exact-ref remote observation/CAS push adapter. Their realpaths, SHA-256 hashes,
permissions, interpreter/dependency closure and credential retrieval must be verified. The coordinator
passes only PATH to each subprocess. Existing historical repair3 scripts and test fixtures are not
production adapters for this protocol. Refer to the
[adapter request/response contract](../workflow-control-delivery-brokers.md#task-only-bootstrap).

The Beads adapter must return the complete official `show` object for repair4, including current
parent dependency data, exactly matching the frozen snapshot. Do not silently project, normalize
away, invent or update Beads fields. A changed snapshot requires a new packet.

Actual test and independent code-review artifact bytes must be stored outside the candidate and
bound to their real producer identities, roles and this candidate tree. Before bootstrap, install
their ordinary content-addressed evidence records under the new run, task, canonical workspace,
contract version, final policy digest and initial head. These are approval-bound pre-bootstrap
artifacts, not fabricated specialist executions. Code review does not constitute plan-critic or
human approval. Current Sonar/Problems and any required quality-gate evidence must also be resolved
explicitly; historical hosted results do not certify this candidate.

The policy is incomplete until all adapter and evidence fields are concrete. Null draft fields are
intentional validation failures, never runtime defaults. After resolving them, calculate the policy
digest, populate the v1 contract, validate both actual schemas, derive contract/material digests and
obtain an independent plan-critic review of that exact packet followed by authenticated owner approval.
Adding this preparation document changes the candidate tree; final evidence must include it even
though the reviewed source implementation is unchanged.

## Authorized execution sequence to approve later

1. Re-observe canonical/source/common paths, the full candidate, task ref, remote CAS, complete Beads
   snapshot, journal schema/runs/leases and all pending work. Preserve the immutable old bootstrap
   contract and approval as historical records; never broaden them in place.
2. Obtain explicit authority for the existing journal's migration and old-stub cancellation as well
   as the distinct new task-artifact run. Back up the existing SQLite database consistently and
   validate restore before migration. Rehearse migration with the reviewed build on a copy. The
   inspected live schema was version 10; the current reviewed build records migrations through 15.
3. Migrate only through the reviewed `WorkflowStore` migration path. Under fresh workspace and run
   fences, cancel `bootstrap-agent-platform-multi-agent.repair.4-20260906` through
   `WorkflowCancellationCoordinator` using observed cleanup, retained historical approval evidence
   and a bounded stop deadline. Verify no prepared effects or active work and terminal cancellation;
   fence its resource leases. Do not run historical no-op cleanup scripts or touch Beads.
4. Create the separately named immutable v1 contract/run in `approved`, install the actual
   pre-bootstrap evidence, record the exact independent critic result and authenticated owner
   approval through production APIs. No direct SQL backfill or test-only authorization helper is
   permitted. A run may not be initialized directly in `implementing` or `pipeline`.
5. Run `bootstrap-preflight` with the approved policy and new run. It verifies local candidate,
   approval and adapter identity only; remote/Beads observations and credential conformance remain
   separate checks. A preflight failure authorizes no fallback write.
6. Construct `BootstrapCoordinator` from the reviewed build. `adopt()` observes the task/ref through
   `approved -> scheduling -> implementing`, atomically establishing the initial head ledger. Then
   `commitAndPush()` reconciles prepared effects before further dispatch, commits the exact tree and
   performs the exact-ref CAS push. Preserve the operation journal across interruption and reacquire
   fresh fencing epochs before recovery; never bypass an uncertain effect with a direct Git write.
7. Require a securely recorded and accepted `implementation_artifact_ready` attestation for the
   observed published head/tree, policy/material/contract, unchanged Beads snapshot and evidence.
   Only then call `terminalize(authenticatedRequester)` with `planned_authority_handoff`, verify
   settled work and fenced leases, retain the attestation and leave the Beads task in progress.
8. Stop. The later delivery run requires separate implementation and review of revised-policy
   lineage compatibility and ledger consumption, fresh approval, and its own authority. This packet
   authorizes no delivery dogfooding or protected-branch merge.

## Completion boundary

Preparation is complete when the candidate observation and draft validation report identify every
remaining missing input. Publication approval is actionable only once there are no unresolved policy
fields, exact evidence and critic/owner records are available, migration/cancellation authority is
explicit, and all required gates are evidenced. Provisioning the adapters and credential integration
is remaining deployment work; the four reviewed bootstrap recovery/fencing fixes are implemented.
