# Authorized local credential broker addition

The owner explicitly authorized building the missing local broker using the existing Codex account,
with account credentials retained at a trusted gateway and individually revocable worker access.
This supersedes the earlier qualification-only boundary for this R4 component. Supervised development
is used because the managed path is the subject of repair. No pilot, merge or promotion is implied.

## Scope and design

Add broker lease persistence, fixed-endpoint model gateway, trusted control CLI and Docker packaging
under packages/workflow-control. Connect an optional trusted modelGateway URL/model configuration to
the standalone launcher. Existing runtime paths remain default when it is absent; it grants no role
or phase authority. No new dependency is introduced; SQLite, Zod and Node interfaces already exist.

Worker auth contains only an opaque API-key-shaped lease. The gateway loads account authentication
from its private host/container mount and replaces worker authorization/account headers. Only the
existing fixed model routes may reach the real upstream; no CONNECT, WebSocket, arbitrary hostname
or redirect forwarding. The client/model is selected by the operator, not hardcoded in the broker.

The control API has a separate random private key and port. Workers receive neither the key nor the
control/account mounts. Deploy control through host-loopback port publication; isolate workers on
an internal network with only the gateway providing model egress. Docker administrators and the
trusted host are outside the containment claim. Plain HTTP is limited to that private network.

SQLite stores token hashes, identity, generation, expiry and durable tombstones. Active tokens are
HMAC-derived from a process-local random key. Restart creates a new generation and fences all prior
leases; recovery can still revoke/status old known generations. A replacement service invalidates
the old owner's operations. No restart resumes an old active credential automatically.

Revocation persists before acknowledging and destroys the current service's matching upstream and
worker connections. Expiry/owner replacement also terminates streams on a bounded sweep. Already
accepted remote computation cannot be undone; the guarantee is no subsequent admitted request and
no continuing gateway stream, not a refund or cancellation of remote work already accepted.

## Required evidence

- Idempotent issue; immutable execution/generation association; revoke-before-delayed-issue tombstone.
- Expiry without renewal on replay; persistent restart fencing and old-generation recovery.
- Real Codex client success with opaque auth and denial after revoke; account token never in worker.
- Real private-network deployment, production control CLI, broker protocol conformance and restart.
- Header replacement/fixed destination, invalid route/tunnel/redirect denial and active-stream abort.
- Existing launcher/runtime regressions; full package tests, typecheck/lint and independent review.

The conformance probe checks the broker's own admission/revocation path with an expiring synthetic
lease. It does not by itself prove provider transport. Real request evidence supplies that distinct
boundary. Integration into the larger task does not establish implementation import or coordinator
completion: R1–R3 and SP-01–SP-13 remain separate .17 obligations.

## Component outcome

See the [qualification report](../../reviews/local-credential-broker-qualification.md) for the
implementation, deployment assumptions, independent review, real client evidence and remaining scope.
