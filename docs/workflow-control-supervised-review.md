# Isolated supervised review entry point

> Current status, 26 September 2026: document binding `.16` was integrated through PR273;
> see the [repair evidence](reviews/approved-document-binding-implementation.md).
> References below to that task being unimplemented/open describe earlier review snapshots.
> Standalone reviewer qualification is distinct from managed execution readiness; use the
> [current readiness assessment](reviews/orchestration-readiness-refresh-2026-09-26.md).

The trusted coordinator can prepare a standalone review without exposing the host repository or
orchestration grants. The implementation is in `packages/workflow-control/src/supervisedReview.ts`.
It stages approved evidence, hashes its contents and uses the existing plan_critic container launcher.
No workflow database, Git, Beads, host Codex configuration or external connector is mounted.
Review events are untrusted output, never executed or interpreted as authorization.

After building workflow-control, the coordinator may invoke:

```sh
node packages/workflow-control/dist/supervisedReviewCli.js < /absolute/path/to/trusted-config.json
```

The coordinator-owned config supplies sourceRoot, evidencePaths, immutable image digest,
modelAuthFile (dedicated model-only credential), egressNetwork (already provisioned model-only egress),
question, timeoutMs and maxOutputBytes. Do not place credential contents in config or committed files.
The CLI validates bounds; snapshot preparation rejects repository-control/configuration paths.
The caller must approve evidence contents and provision/verify network policy and credential scope;
a network's name or a regular auth file does not establish those properties.

Evidence is mounted read-only; Codex receives a fresh read-only configuration without MCP servers.
The host provides only the private snapshot, generated runtime directory, model authentication and
prompt. Container completion/timeout triggers named-container removal; if stopping fails, the
coordinator receives an error and private staging is retained for controlled cleanup. Do not claim
successful review after that failure. Abrupt host termination still requires manual orphan cleanup.

## Account-backed live validation on 24 September

The owner authorized the existing Codex account. Two independent reviews completed using a private
copy of its file-based authentication cache, a pinned Codex container, read-only evidence and an
internal Docker network. The initial CONNECT proxy was subsequently replaced with the fixed model
application gateway described below.
The original account cache was not changed. Authentication contents are never committed or included
in review evidence. OpenAI documents copying the cache for headless environments in its
[authentication guidance](https://learn.chatgpt.com/docs/auth).

The reproducible runtime sources are `packages/workflow-control/review-runtime/Dockerfile` and
`packages/workflow-control/src/reviewProxy.ts`. Build the image, resolve its immutable image ID, and
provision a Docker internal network whose only outbound route is the gateway on a separate network.
The gateway has no credential mounts or published host port. Set `proxyUrl` to its internal HTTP origin.
The coordinator must verify this topology; passing an arbitrary network name does not enforce it.
The image includes system certificates and pins the Codex package version. No model override was
introduced. The first setup attempt failed because certificates were absent and account app discovery
was enabled; these were corrected before the successful reviews.

See the [first review evidence](reviews/evidence/supervised-review-first.json) and
[second review evidence](reviews/evidence/supervised-review-second.json). Both are bound to the supplied
snapshot digest; neither constitutes owner approval or formal contract acceptance. No tool calls
were recorded. The second reviewer reported additional tool categories despite disabled feature
flags. This is a self-report, not a captured host tool inventory: it establishes that qualification
must remain unresolved, not proof that those tools executed or could reach the host.

## Runtime capability assessment

The owner authorized controlled negative tests using disposable evidence and dummy credentials.
The pinned client was run inside the generated reviewer container against an offline Responses
fixture. This captured tool definitions sent by the real client and injected prohibited calls rather
than relying on the model to attempt them. All inventories across requests, including top-level tools,
are checked against an explicit allowlist and retained in the
[capability evidence](reviews/evidence/supervised-review-capabilities.json), with source and image hashes.

The test exposed a genuine defect: `features.multi_agent=false` alone did not disable delegation.
`agents.enabled=false`, `agents.max_depth=0` and `features.multi_agent_v2=false` now remove delegation
from the advertised inventory and reject an injected spawn call. Shell calls are unsupported.
The client still advertises the composition wrapper, but its disabled code-mode host rejects execution,
including a nested patch attempt. User-input interfaces remain visible; they grant no mutation rights.
This is enforced rejection, not a claim that the client advertises zero tools.

Real Docker probes additionally demonstrate read-only evidence, absence of an excluded dummy broker
grant and Docker socket, blocked direct outbound connection, rejected CONNECT tunnels (including model-host authorities),
and an unauthenticated request reaching the fixed model endpoint with a 401 response. They use no real credentials. The separate
account-backed live review demonstrates the happy path, without an endpoint override.

Startup failure is rejected and removes its actual container and staged authentication copy. Testing
found two further defects: empty output could appear successful, and automatic Docker removal raced
explicit cleanup. Reviews now require a completed turn and nonempty review message, while explicit
container removal owns settlement. Uncertain creation or removal still fails closed with recovery
metadata instead of deleting credentials while a process may retain access.

These probes qualify the tested configuration and image for bounded standalone evidence review;
they are not proof of all possible sandbox attacks, future model/client configurations, or managed
orchestration. The offline transport fixture is distinct from the real account-backed model service.
Rerun qualification after runtime/configuration changes. Owner approval, full skill acceptance and
orchestration-pilot authorization remain separate.

The [third independent review](reviews/evidence/supervised-review-third.json) requested complete
inventory capture, a valid-success cleanup-failure fixture, and retained execution artifacts. Those
corrections are included in the capability tests and evidence. Its earlier snapshot is preserved;
it is not represented as a review of later edits.

The live reviews identified and prompted corrections for symlink aliases, unacknowledged container
creation, recovery metadata and conflicting Playwright segment rules. Container creation must now
be acknowledged before start. Uncertain creation retains private staging and reports execution ID,
container name, staging path and settlement status for controlled reconciliation. Removal failure
also retains staging and rejects success. Abrupt host termination still requires orphan cleanup.
Lifecycle tests cover start failure, uncertain creation, malformed output and removal failure.
The lifecycle tests were not included in the second snapshot, so its missing-test finding is retained
as a historical evidence gap rather than deleted.

The separate [detailed-document approval binding gap](tasks/agent-platform-pilot-zero.16.md) remains
unimplemented and blocks the pilot plan. A review snapshot hash does not bind linked document
contents into the workflow's execution-approval enforcement.

## Validation boundaries

Read-only container filesystem probes and effective feature configuration checks are separate from
live tool-capability qualification. Package build, typecheck, lint and regression results are recorded
in the session handoff. Native full-suite verification is affected by Apple's unaccepted Git licence;
Linux verification uses the same source and test fixtures. SonarQube and IDE Problems connectors are
unavailable, so terminal verification is the available fallback. Hosted gates remain separate.

Current-source Linux package verification: **702 passed, 10 optional tests skipped**. Build and lint
pass; 15 focused reviewer tests pass. Four real Docker filesystem isolation probes and one effective
configuration probe passed separately. These results do not resolve the tool-capability gate.

## Current verification results

After the capability fixes: Linux package suite **712 passed, 13 optional tests skipped**. The three
new real runtime/container capability probes passed separately with the pinned image enabled; the
effective-config probe also passed separately. All six lifecycle regression tests pass. Package
build, lint, Markdown and local-link checks pass. The native Apple Git licence limitation remains;
Linux supplies full-suite verification and no system licence was accepted on the owner's behalf.

## Final network review correction

The [fourth review](reviews/evidence/supervised-review-fourth.json) correctly rejected CONNECT-authority
filtering as proof of model-only egress: traffic within a TLS tunnel could select a different service.
The replacement gateway rejects every CONNECT and protocol-upgrade request. It accepts only
`POST /responses` and `GET /models`, constructs its own fixed HTTPS upstream on
`chatgpt.com/backend-api/codex`, verifies that host's TLS certificate, ignores client Host headers,
and rejects upstream redirects. There is no arbitrary tunnel or caller-selected hostname/SNI.
The dedicated Codex provider points to this private gateway and uses the owner's existing account.
It does not proxy token refresh; an expired credential fails until the coordinator refreshes its
authorized cache. Credentials are never logged. HTTP within the private Docker network is not a
claim of protection against a hostile Docker administrator.

The revised negative probes reject all tunnels, traversal/absolute URLs, unapproved routes and
upgrades. A request with an unapproved Host header still reaches only the fixed model endpoint.
The artifact now hashes the actual executed compiled gateway and the launcher source, alongside
reviewer source, fixture and test. The package build ran before these probes; reproducible sources
are the repository TypeScript package and its checked-in build configuration. This supersedes the
earlier CONNECT setup; it must not be reused for qualification.

## Gateway live review and disposition

[The live gateway review](reviews/evidence/supervised-review-gateway.json) completed using the existing
Codex account, with a completed turn, review text and no recorded tool calls. It supplied only gateway
and reviewer source, so two findings lacked launcher context: `buildDockerSpecialistLaunch` freezes
its arguments, environment and enclosing object, and supplies the same empty environment for every
Docker operation. Thus the proposed mutable-launch and daemon-mismatch scenarios are not possible
through this preparation path. Cleanup now references the trusted environment explicitly for
consistency. These findings are dispositioned with repository evidence, not silently discarded.

The valid response-stream finding is fixed: upstream response errors destroy the downstream stream,
and downstream errors settle the upstream request. A reset regression proves a truncated response
does not terminate the gateway or get reported as a complete stream. The retained review predates
that final correction; its snapshot is not relabelled as the final source.

Final verification: the rebuilt final source passed **712 Linux tests**, with 13 optional tests skipped.
All four enabled configuration/capability checks passed separately against the pinned image; lint,
build, Markdown and link checks passed. The capability artifact was regenerated after the stream fix
and hashes the executed compiled gateway. The bounded standalone-review verification gate passes.
The owner still retains approval and integration decisions; `.16` and managed-pilot work remain open.
