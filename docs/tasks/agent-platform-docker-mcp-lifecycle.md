# Investigate duplicate MCP containers and Docker stalls

**Beads:** `agent-platform-docker-mcp-lifecycle`, P1 OPEN.
**Discovered from:** `agent-platform-harness-r3.cancel`; this is an evidence link, not a new hard dependency.
**Status:** Operational finding under read-only investigation; no configuration or lifecycle repair delivered.

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
retained. No force, reset, prune, volume removal or global setting change was performed.

The application diagnostic queue failure reproduced while Docker was stopped. It is a separate
bounded Stop repair, not evidence that Docker caused every failed test or that a slow connection
explains missing diagnostic events.

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
