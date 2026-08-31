# Workflow-control delivery brokers

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
