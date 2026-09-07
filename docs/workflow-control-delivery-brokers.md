# Workflow-control delivery brokers

## Governed review and coordination operations

Delivery governance also exposes narrow operation families for an exact-task Beads note
compare-and-swap, GitHub review-thread observation/reply/resolution, approval notification, delegate
callback, and exact lineage import. Requests are content-addressed and bound to the exact workspace,
run, task, policy, material, external identity, and fencing epochs. Production adapters must be
registered; arbitrary GitHub routes, review dismissal, administrative bypass, and direct Beads
writes are not representable.

Provider acceptance of an approval notification is transport evidence only. Execution cannot resume
until an authenticated response and the resume-confirmation delivery are recorded. Terminal
subagent callbacks have deterministic identities: disposition and parent transition are atomic, and
the parent is then woken. Reconciliation adopts already-observed effects instead of repeating them.

SQLite migration 11 adds durable approval notifications, delegate callback dispositions, lineage
imports, and run-scoped imported-head attestations. A callback transaction checks fresh workspace,
run, and task leases before atomically inserting its disposition and compare-and-swap advancing the
parent. Lineage import accepts only a cancelled, fenced predecessor with no prepared delivery effects;
it atomically records the immutable import and approved head while advancing a distinct run from
`approved` to `pipeline`. Production run creation cannot start directly in `pipeline`.

The workflow-control delivery boundary is the only approved path for an active autonomous run to
create task refs, commit exact trees, push task heads, create pull requests, observe required checks,
or merge into the contract's protected delivery branch. The broker binds every request to the exact
workspace, run, task, repository, contract version, policy digest, orchestrator role, and current
lease fence before it reaches a narrow provider port.

## Durable operation protocol

Each request has a deterministic SHA-256 identity and is written to `delivery_operations` before an
external call. The broker observes external state, revalidates run state, leases, and approved Git
lineage immediately before mutation, then records the exact observed result. A crash leaves a
prepared row that a higher run-fence owner must explicitly adopt and reconcile. Exact committed
replays return the stored result; conflicts and malformed provider evidence become durable
escalations instead of retries with ambiguous authority.

The approved-head ledger is separate from provider state. Ref creation establishes the immutable
base and current head, a commit advances the current head and invalidates any earlier publication,
and a successful CAS push marks that exact current head as published. GitHub operations are allowed
only when the requested head is both current and published.

## Git boundary

`LocalGitDeliveryPort` accepts only typed task-ref creation, exact-tree commits, and fast-forward CAS
pushes. It resolves the canonical repository, uses a fixed Git binary and sanitized environment, and
disables inherited configuration, hooks, signing, credential helpers, replace objects, grafts,
filters, attributes, and other execution-capable repository settings. Commit preparation uses a
temporary index and verifies the resulting tree, complete NUL-delimited rename/copy paths, allowed
paths, and diff digest before `commit-tree` and compare-and-swap ref update.

Pushes cannot invoke an arbitrary remote command or expose credentials. They verify the local ref
and fast-forward ancestry, then delegate the exact expected and new SHA to a narrow broker-owned
remote-ref client.

## GitHub boundary

`GitHubDeliveryPort` exposes only exact pull-request creation, check observation, and conditional
merge through `NarrowGitHubDeliveryClient`. It rejects changed repository, PR number, task head,
base, protection snapshot, required-check set, review decision, merge method, or admin bypass. It
does not expose arbitrary REST routes, workflow dispatch/rerun, force-push, or protection mutation.

Completed-merge recovery uses immutable merge attestation tied to the exact repository, pull request,
task ref, head, base, checks, protection digest, approval, method, merge SHA, and event identity. This
allows an idempotent recovery after GitHub's live checks or protection view has subsequently changed
without accepting a different pull request.

Before a task merge, migration 12 records a provider-attested pull-request snapshot on the prepared
operation and advances its merge-observation lifecycle from `prepared_unobserved` to
`prepared_verified` with a compare-and-swap. The snapshot binds the exact head, base, protection,
required check results, latest review event, every review thread, and its accepted disposition. The
broker immediately re-observes the provider and requires an identical snapshot before mutation;
restarts may recover a completed merge only when that verified precondition was already durable.
The hardened client receives that observation digest and latest review-event identity through a
typed `compareAndMergePullRequest` operation and must enforce both in the same provider-side
conditional merge. A client that cannot provide that atomic comparison is not a valid production
delivery client and must fail closed; a second read alone is not described as atomic protection.

## Pipeline waits

Pending checks create durable waits bound to workspace, run, task, check identity, provider event,
poll attempt, next poll, and immutable absolute deadline. A current lease owner may resume processing
after takeover without inheriting the terminal check operation's historical fence. Replaying an
exact persisted observation returns the same decision. Passing or failing observations atomically
complete the wait; deadline escalation is exactly once and atomically removes it from the due queue.

## Composition rule

Production construction must use `DurableDeliveryBroker.create`, which verifies the canonical
workspace against the execution contract. Test-only ports require `createForTest` and are rejected
outside the test runtime. Production composition must supply only reviewed narrow Git and GitHub
clients; agents and specialist containers receive no direct write credential path around them.

## Governed orchestration operations

Approval notifications persist their event, predecessor, resume target, deadline, authenticated
responder evidence, bounded delivery attempts, and provider acceptance. `delivery_pending` and
`resume_pending` are recoverable after restart; lease substitution, deadline expiry, or transport
exhaustion fails closed.

Resume transport acceptance remains `resume_pending`; only the committed parent transition marks
the notification and wait resumed. Transition preparation and commit independently derive approval,
deadline, predecessor, and the exact target from persisted records. Migration 15 preserves separate
event and run-version generations so sequential approval cycles cannot reuse an earlier receipt.
Governed mutations recheck current leases and run state in a SQLite writer transaction at request
dispatch, including after additional provider reads. Recovery explicitly adopts prepared work under
a newer fence while retaining its immutable request identity.

Delegate callbacks are accepted only for the immutable completed scheduler execution named by the
callback. The execution role, process identity, packet and result digests, approved material, secure
evidence producers, task authority, head, attempt, run version, and all current lease fences must
match in the same transaction. Parent wakeups use deterministic identities and persist provider
acceptance so response loss cannot cause duplicate continuation.

The approved-to-pipeline handoff cannot be initialized directly. The lineage coordinator first uses
its registered read-only observer to re-read the exact Git ref and tree, implementation evidence and
material attestation, and official Beads snapshot. Production construction is package-internal and
accepts only capability-authenticated concrete Git/evidence observers and an official Beads/Dolt
port; the public package exposes only a test-runtime factory. It rejects any caller/observation
substitution, then atomically records the two-run lineage, approved-head ledger, and state transition.

Review replies persist the independent reviewer, evidence set, accepted-disposition digest, provider
message, head, and review event. Resolution must name that exact digest and message. Merge readiness
requires a content-addressed current PR-level observation—even when the PR has zero threads—and
rejects changed heads, newer review events, failed checks, missing dispositions, or unresolved
threads. Production Beads-note and GitHub-thread operations are constructed only through
`createTrustedGovernedExternalPort`, which freezes the official clients and enforces exact workspace
and repository routes.

## Task-only bootstrap

`BootstrapCoordinator.create(database, runId, policy)` is the concrete Git-only production composition
for an already reviewed task candidate. It does not create approval or grant authority. A distinct
immutable contract must already have a current exact owner approval and independent critic approval.
The canonical workspace remains the original checkout; the separately approved `sourceRoot` supplies
the index/candidate. Both exact realpaths, common Git directory, task ref, initial head, full changed
manifest, candidate tree, remote CAS precondition, author, Beads snapshot and evidence are bound by
the stored `bootstrapPolicySchema` payload and its canonical SHA-256 policy digest.

Preflight is explicitly read-only, including against an older journal:

```sh
node packages/workflow-control/dist/cli.js bootstrap-preflight DATABASE RUN_ID POLICY_JSON
```

This validates the current exact approval, local candidate and executable identities. It returns
`mutations: false` and `remoteObservation`/`beadsObservation: not_performed`; it does not migrate,
write Git objects/indexes, execute adapters or claim credential conformance. Candidate calculation
supports regular files/deletions and executable modes; symlinks, gitlinks and unsupported Git
configuration fail closed. The source checkout must contain exactly the reviewed whole candidate,
not unrelated edits to be selectively excluded.

Production adapters are owner-owned, executable, non-group/world-writable files with exact realpath
and SHA-256 digests in the approved policy. They receive one JSON request on stdin and emit one JSON
response on stdout. Calls have a ten-second bound and a sanitized environment containing only PATH.
The adapter must own narrowly scoped credential retrieval; credentials are not passed in policy or
inherited from the coordinator environment. Pinning a script does not pin its interpreter or imported
dependencies: deployment must also protect and review that executable's complete runtime dependency
closure. Only the following command shapes are used:

- Beads read: `{kind: "beads.read", workspaceRoot, taskId}` returns the complete official task snapshot.
  No mutation route is composed; every observation must equal the approved in-progress snapshot.
- Remote observation: `{kind: "git.observe_ref", workspaceRoot, repository, remoteName, remoteUrl, ref}`
  returns `{sha: SHA_OR_NULL}` for that exact ref.
- Remote push: the same binding plus `{kind: "git.push", expectedOldSha, newSha}` returns `{sha: newSha}`.
  The reviewed adapter must enforce provider-side exact-ref CAS and return only after confirmed
  acceptance. Recovery re-observes the ref before any retry. No GitHub client is instantiated.

After authorized migration and approval installation, a trusted coordinator can call `adopt()`,
`await commitAndPush()`, and `await terminalize(authenticatedRequester)`, then `close()` in `finally`.
`commitAndPush()` also calls `adopt()` idempotently. Adoption records real preexisting-ref/task
observations through `approved -> scheduling -> implementing`; it never fabricates Beads claims or
`git.create_ref`. The second transition atomically records `git.preexisting_ref_observed` and the
initial approved-head ledger. Full stored policy and resource fences are checked at preparation,
immediately around Git mutation, and at durable commit. Restart requires lease takeover and exact
observation of any prepared effect, not a new operation identity.

The full policy explicitly names pre-bootstrap test/review artifacts, their recorded producer/role,
and the candidate tree reviewed. Those approval-bound artifacts are not described as secure accepted
phase execution results. After exact commit/push reconciliation, the coordinator records and accepts
a secure typed `implementation_artifact_ready` attestation binding contract/material/policy, run,
task, published head/tree, unchanged Beads snapshot and approved evidence. Direct secret scanning
remains active; the typed schema/ref/tree identifiers are not mistaken for high-entropy secrets.

Terminalization requires that attestation and fresh local/remote/Beads observations. Its cleanup port
checks actual journals and refuses started phase jobs, live credentials, prepared effects or pending
transports; it cannot stop arbitrary external work. The final cancellation transaction fences queued
continuations/phases and approval waits, records fenced-work counts, and prevents new claims. A
notification already in flight must settle; response-loss recovery during cancellation is observation
only and cannot send a new message. Successful cancellation retains the attestation and fences the
coordinator's resource leases. No Beads state change is made.

`bootstrap.test.ts` uses real temporary repositories, a local bare remote, and real pinned executable
subprocesses; its approvals and adapter are fixtures. It covers five restart boundaries, transactional
adoption rollback, authority substitution and task-only attestation/cancellation. This is not live
GitHub/Beads credential conformance or authorization to run the flow. Revised-policy lineage import,
delivery-consumer ledger integration, credential provisioning and the external pilot remain separate.
