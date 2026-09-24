# Isolated supervised review entry point

The trusted coordinator can prepare a standalone review without exposing the host repository or
orchestration grants. The implementation is in `packages/workflow-control/src/supervisedReview.ts`.
It stages approved evidence, hashes its contents and uses the existing plan_critic container launcher.
No workflow database, Git, Beads, host Codex configuration or external connector is mounted.
Review events are untrusted output, never executed or interpreted as authorization.

After building workflow-control, the coordinator may invoke:

```sh
node packages/workflow-control/dist/supervisedReviewCli.js /absolute/path/to/trusted-config.json
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
internal Docker network with a CONNECT proxy allowing only OpenAI authentication/model hosts.
The original account cache was not changed. Authentication contents are never committed or included
in review evidence. OpenAI documents copying the cache for headless environments in its
[authentication guidance](https://learn.chatgpt.com/docs/auth).

The reproducible runtime sources are `packages/workflow-control/review-runtime/Dockerfile` and
`packages/workflow-control/src/reviewProxy.ts`. Build the image, resolve its immutable image ID, and
provision a Docker internal network whose only outbound route is the proxy on a separate network.
The proxy has no credential mounts or published host port. Set `proxyUrl` to its internal HTTP origin.
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

**Isolation qualification remains blocked.** Feature-list probes and a model declining to call tools
are insufficient. Before accepting this route as the required restricted critic, capture the actual
session tool inventory and demonstrate host-enforced denial of prohibited tools and delegation.
Do not run the orchestration pilot or mark the skill suite independently accepted on this evidence.

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
