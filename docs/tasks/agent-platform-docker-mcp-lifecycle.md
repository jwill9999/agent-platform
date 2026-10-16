# Investigate duplicate MCP containers and Docker stalls

**Beads:** `agent-platform-docker-mcp-lifecycle`, P1 IN_PROGRESS.
**Discovered from:** `agent-platform-harness-r3.cancel`; this is an evidence link, not a new hard dependency.
**Status:** Partial owner-authorized developer-tool containment/registration repairs applied and one saved-profile Sonar client verified. Original lifecycle/resource cause remains unresolved; this task is not closed.

## Observed problem

During Stop qualification, Docker management and API probes intermittently stalled. Retained Linux
kernel logs show global out-of-memory kills of Java processes between 00:52 and 01:00 UTC on
16 October 2026. Exact container IDs in those historical records could not be resolved after their
removal; they must not all be attributed to a particular image without evidence.

After the supported normal restart, the later inventory contained 73 running containers, including
13 `mcp/sonarqube`, 13 `mcp/fetch` and 11 Terraform MCP instances. The independently timed stats
sample returned 90 rows and 303.4% aggregate container CPU. Docker reported five CPUs and
6,210,437,120 bytes of available VM memory. The inventory and stats are changing snapshots, not a
stable cardinality or a direct measure of host CPU saturation. Multiple instances alone do not prove
a leak: their gateway, client and session ownership still need verification.

The bounded follow-up found one configured MCP gateway registration and nine Codex-child Docker
container-run clients, rather than nine gateway commands. In two later snapshots 34 seconds apart,
28 Sonar MCP and nine Terraform MCP containers remained running. The returned lifecycle evidence
also includes normal teardown of other MCP instances; it does not prove that every duplicate is
leaking. Container labels lack the client/session ownership needed to distinguish legitimate
concurrent instances from abandoned ones. The 153 returned events cover only 02:22:52–02:23:36 UTC,
not the entire requested observation window. This rules out duplicate gateway declarations as the
observed configuration explanation while leaving the precise lifecycle cause unresolved.

The first recovery addressed a real management hang. A subsequent supported normal stop deliberately
created a finite native-test window; it was not another observed Docker crash. Normal start and
desktop, engine and inventory probes later succeeded. Owned data directories and file sizes were
retained. During that original investigation/recovery window, no force, reset, prune, volume removal or global
setting change was performed. Later explicitly authorized developer-tool configuration changes are
recorded separately below; the original no-change statement is not a claim about all subsequent work.

The application diagnostic queue failure reproduced while Docker was stopped. It is a separate
bounded Stop repair, not evidence that Docker caused every failed test or that a slow connection
explains missing diagnostic events.

## Authorized partial remediation and current verification

The owner authorized two containment switches: disable the Codex MCP gateway and disable the
Terraform plugin. After the owner reloaded, the scoped observation found zero old launcher clients,
one Sonar container and zero Terraform containers. The user then removed the Terraform plugin
externally; absence is treated as removed/disabled, not a reason to recreate it. MCP_DOCKER remains
explicitly false. These actions contain observed pressure; they do not prove the original cause.

The owner also authorized four developer-tool registration repairs: correct the malformed standalone
Playwright argument shape and disable that standalone while keeping its plugin enabled; disable the
stale standalone computer-use registration; disable Claude's bundled GitHub server while retaining
the curated GitHub plugin. These are developer-tool registrations, not application permission,
security policy or product runtime changes. No broader migration is implied.

The user's screenshot identified the existing Sonar Docker Toolkit saved profile, not a new Codex
plugin. An official Sonar 2.6 plugin was briefly added during investigation, then only that addition
was fully removed. Semantic configuration returned to the authorized four-field repair baseline;
the existing profile's 10 entries remained unchanged. No Docker Hub logout or account change was
performed. The gateway was not reenabled.

After the owned browser project was down with actual [] container cleanup and retained data proof,
the old gateway-labeled Sonar container 90c97003 was attributed to stdio with no live host client,
ports or mounts and gracefully stopped. No broad container kill, reset, prune or volume removal
occurred. Earlier duplicate counts alone remain insufficient to label every instance a leak.

A wrong environment-name guard first blocked saved-profile verification before server launch; that
failed prelaunch attempt remains recorded. Correct existing MCP credential names then allowed one
direct pinned saved-profile Sonar client to make three actual quality-gate reads returning OK through
one owned container, followed by normal close with none remaining. Independent review approved
`sonar-profile-single-client-verification-v2.json`. This verifies the exercised one-client lifecycle,
not an automated global singleton, intended simultaneous-client cardinality, permanent stability,
new pull-request-head analysis or the original Docker/latency/OOM cause. Current-head quality gates
remain separate.

Evidence includes `docker-mcp-loop-containment-applied.json`,
`docker-mcp-loop-after-owner-reload.json`, `sonar-old-gateway-orphan-stop.json`,
`sonar-profile-prelaunch-credential-guard.json`,
`sonar-profile-single-client-verification-v2.json` and
`sonar-profile-single-client-independent-review.json` under the existing local evidence root.
The current recommendation is to prefer Codex built-ins and selected direct plugins while keeping
the gateway disabled. A broader tool migration is only a recommendation for owner review, not an
authorized or delivered migration. Attribution/expected-cardinality work below remains unresolved;
keep this operational task IN_PROGRESS. It is an evidence link, not a new hard Stop dependency.

## Bounded investigation and requirements

1. Establish actual gateway/client/session ownership and expected instance counts using safe process,
   container-label, image and creation metadata. Do not read or publish credentials or environment
   contents. Keep unknown ownership explicit.
2. Correlate creation/removal, memory/OOM and management latency over a bounded representative window.
   Distinguish intentional session instances from abandoned or repeatedly retried starts. Record
   timestamps, sample scope and gaps; correlation alone is not a proven sole cause.
3. Prepare the smallest correction supported by that evidence. Identify whether it belongs to a
   client/gateway lifecycle, repository configuration or host settings. Obtain applicable authority
   before global changes or interruption of unrelated services.
4. Preserve data, volumes, unrelated active clients, PR283 and all paused orchestration. Do not use
   blanket container stops, cache/data resets, higher memory limits or recurring restarts as an
   assumed cure. No recurring automation is authorized here.

## Verification and definition of done

Read-only evidence is not a delivered fix. Before closure, independently review the attributed cause
and scoped correction, verify stable expected instance counts and responsive management during
representative tool use, and check retained data and unrelated service preservation. Record failures
and competing explanations. Apply normal source, quality, documentation mirror/readback and Beads
sync requirements to any later authorized implementation.

Evidence remains local under
`/Users/letuscode/.codex/project-chat-stop-implementation-20261016`:
`docker-recent-oom-log-evidence.json`, `native-start-docker-source-observation.json`,
`docker-current-restart-question-observation.json`, `docker-native-window-restoration.json` and
`docker-mcp-readonly-lifecycle-investigation.json`.
Those observations do not establish production capacity or a permanent environmental repair.
