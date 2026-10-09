# Development service supervisor

> **Scope: PAUSED explicit workflow-control prototype.** This guide describes prototype enforcement,
> APIs and historical qualification only. Ordinary Codex developer tasks use
> [native development](development/codex-development.md); discovery, isolation, gateway, budgets,
> admission, brokers and persisted exact-material approval are not their prerequisites.
> Do not start/resume the prototype or pilot from this guide. Existing runtime controls remain intact.

The development supervisor owns its configured broker containers and networks. It does not create an
approved workflow, implement a feature, grant MCP access, or promote a branch. Keep it running in the
foreground while using its services. Docker Desktop alone is not a readiness check.

## Configuration and commands

Build `@agent-platform/workflow-control` first. Supply an absolute path to a private, owner-readable
JSON file (mode `0600`). Its fields are:

| Field            | Meaning                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `stateDirectory` | Absolute private directory on a Docker-shared filesystem; identity, broker state and recovery records persist here            |
| `accountFile`    | Absolute private Codex account file, mounted only into the trusted broker                                                     |
| `brokerImage`    | Locally available immutable image ID or repository digest                                                                     |
| `workerImage`    | Locally available immutable specialist image ID or repository digest                                                          |
| `containerUser`  | Non-root host owner UID and GID, formatted `UID:GID`                                                                          |
| `controlPort`    | Available host loopback port, 1024–65535                                                                                      |
| `clientVersion`  | Installed worker client version for authenticated model discovery                                                             |
| `workflow`       | Optional `{ "database": "/absolute/workflow.sqlite", "runtimeConfig": "/absolute/runtime.json" }` for an already approved run |

Use the same configuration for all commands:

```sh
node packages/workflow-control/dist/cli.js development-host /absolute/development.json
node packages/workflow-control/dist/cli.js development-status /absolute/development.json
node packages/workflow-control/dist/cli.js development-stop /absolute/development.json
node packages/workflow-control/dist/cli.js development-recover /absolute/development.json
```

`development-host` and recovery of a stopped owner run in the foreground. `development-recover` on a
live owner requests reconciliation; it does not wait for or promise readiness. Observe status afterward.
A second live owner is rejected. Restart preserves the service identity and revoked credentials. Ownership binds the process start
identity as well as its PID, so a recycled PID cannot impersonate the prior owner.
Do not remove the state directory to get around an ownership, configuration or cleanup error.

The runtime file supplies the existing phase-runtime configuration, except `credentialBrokerBinary`
and `egressNetwork`: the supervisor generates those transport settings. Its image and container user
must match the host configuration. Its `modelGateway.url` is `http://development-gateway:18102` and its
model is explicitly chosen by the operator. The supported document-source Git override is
`WORKFLOW_GIT_BINARY`; where used, give the runtime's `gitBinary` the same trusted absolute executable.
Host environment variables are not forwarded to workers. Runtime-file contents are part of the service
fingerprint; changed run/configuration contents cannot silently adopt an existing service.

The runtime can reconcile existing interruptions before services qualify, but dispatch remains blocked
until service checks and execution cleanup permit admission. A successful service check is not evidence
that the remaining implementation importer or coordinator stages are available.

## Readiness and recovery

Readiness validates pinned images, service identity, mounts, network membership, authenticated control,
short-lived probe issuance, model discovery, revocation and denied reuse. Model discovery does not
request a paid generation. It establishes connectivity/account access for that request only.

JSONL status transitions report a service identity, timestamp, stable reason code and recovery action.
`development-status` also returns persisted execution interruptions and cancellation, revocation and
settlement obligations and a separate effect assessment. `cleanup_pending`, `cleanup_exhausted`
and `reconciliation_required` are not successful readiness. Containment does not clear task-effect
uncertainty: interrupted effects remain `uncertain`, the phase remains blocked, and no automatic retry
or import occurs. This slice supplies no blanket operation to approve unknown effects.
Resolve the reported cause before requesting recovery. Recovery never reruns an interrupted action;
retained source and evidence must be reconciled before any separately authorized attempt.

The internal worker network has no external route. Only the broker also joins the outbound network;
its control listener is published on loopback. Workers receive opaque leases, not account credentials.
No host MCP connections or configuration are inherited. Role isolation remains independently enforced. Network membership requires an acknowledged container
identity for the bound run, and inspection checks the role-specific source/scratch/evidence mounts,
capabilities, security profile and namespaces. Workers start with no network; acknowledgement precedes
attachment to the approved network and process start.

Topology has its own five-second freshness limit and whole-check deadline. A healthy broker heartbeat
cannot refresh stale topology authority. A synchronous fence rechecks service admission after document
verification inside the Docker dispatch callback; `topology_stale` blocks admission and reports the gap. The validity deadline is persisted so the
separate status command also stops reporting ready if the supervisor stalls.

Use a stable Docker-shared directory (for example, a private directory beneath the owner's home).
A failed mount or probe must remain a failed readiness result; do not bypass it. Account, operator configuration, workflow-runtime files and the workflow database must live outside
the generated state directory. Generated files reject symlink/hardlink destinations and use atomic replacement.
The broker state is retained on stop for reconciliation. Interrupted staging retains an empty
`codex-auth.json` guard to prevent delayed exclusive credential writes from recreating token bytes;
that zero-byte guard is not a credential. Source/evidence remain for review. Cleanup never prunes unrelated Docker resources.

## Qualification boundary

See the [requirements](planning/standalone-pilot/development-lifecycle-addendum.md),
[scenario matrix](testing/development-lifecycle.md), and
[qualification report](reviews/development-lifecycle-qualification.md) for current evidence and gaps.

Probe creation is journaled before dispatch. A timeout followed by an absent container remains
`cleanup_pending`, including after supervisor restart. A late container is checked against its
recorded intent and approved topology, removed by exact ID, and reobserved before cleanup settles.
If the create outcome never becomes known, recovery stays blocked; absence alone is not proof of
cancellation. The token directory is retained until container cleanup is confirmed.
