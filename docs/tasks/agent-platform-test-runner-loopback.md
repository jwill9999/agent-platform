# Task: Qualify local application tests under the managed test-runner policy

**Beads issue:** `agent-platform-test-runner-loopback`  
**Spec file:** `docs/tasks/agent-platform-test-runner-loopback.md`  
**Parent epic:** `agent-platform-pilot-zero` — Pilot-zero orchestration assessment

## Task requirements

Status: owner-authorized prerequisite repair as of 8 October 2026; technical design and implementation
qualification remain incomplete. The owner authorized completing all issues preventing the pilot,
targeting 9 October. This supersedes the earlier unanswered scope questions. Keep independent
critique and executable material validation; pilot launch still needs its exact final approval.
The direct offline image passed the required Electron journey, but the actual Codex test-runner tool
route failed with listen EPERM on 127.0.0.1. Its generated policy disables command networking.

L1: Establish an enforceable route for application fixtures to bind/connect locally during approved
process.test actions. L2: Preserve denied external access, model-gateway access from commands, Docker
socket, source writes and private config/auth access. L3: Preserve other roles' existing capabilities
and execution limits. L4: Prove the required application journey through the governed role or an
explicitly reviewed governed test-execution adapter, with exact source/result/fencing provenance.

## Dependency order

No new upstream blocking task is required for drafting. Reuse .17's image/source evidence.
Downstream: agent-platform-pilot-zero.17 and the exact pilot plan agent-platform-pilot-zero.13.
Publish both blocking edges in Beads; do not close this task on a proposed design or direct-shell pass.

## Implementation plan and technical qualification

The owner delegated prerequisite repair choices. Prefer restricted loopback; use the governed
offline adapter if the pinned client cannot enforce the required boundary:

1. A narrowly scoped test-runner network policy using the pinned client's supported permission/proxy
   interfaces, exact local destinations and explicit protected model-gateway denial. Do not infer
   that enabling networking or an allowlist alone enforces the boundary. New permissions require
   the owner-authorized prerequisite scope, a complete contract and independent critique.
2. Keep worker command networking denied and qualify a governed offline test-execution adapter that
   runs the already passing controls and returns bound typed evidence. This requires a separately
   reviewed runtime scope; a manual external test launch does not satisfy managed execution.

Current OpenAI [permission documentation](https://learn.chatgpt.com/docs/permissions) describes active
proxy requirements and incompatibility between profiles and legacy sandbox settings. The repository
uses legacy sandbox*mode/network_access=false and launcher --sandbox. Documentation is design input,
not proof that the pinned client or a particular profile supports the required local-server boundary.
No unreviewed all-host allowlist, network_access=true-only shortcut or dangerously*\* setting.

Before implementation: produce the feature/document manifest, version1 executable contract through
the existing workflow-control schema/document-binding interfaces, verification plan, independent
critique, retaining the recorded owner authorization. Unsupported port/namespace or gateway isolation remains blocking.
No persisted approval/run may be fabricated to exercise the proposed policy.

## Git workflow and proposed ownership

Planning is published on task/harness-readiness-reconciliation into feature/harness-backlog-review
through PR283. Base integration f8112b14; never main. Runtime repair branches must chain from the
reviewed delivered task tip under repository rules. Proposed inspection paths are specialistRoleProfile,
specialistLauncher, modelGatewayConfig and their real-container tests in packages/workflow-control.
The final allowed implementation paths depend on the chosen route and must be explicit in its contract.

## Tests and verification

L-T01: bind/connect to exact permitted application fixture addresses and complete the one-test
approve/provider-http Electron journey under actual governed tools, including independent file,
approval and audit assertions; no retries/skips or substituted direct-shell result.
L-T02: deny protected model gateway and unapproved local/private/external destinations, including raw
socket and proxy-bypass attempts. Retain source/config/auth/root/Docker-socket denials and unchanged
original snapshot hashes. L-T03: schema/config rejection, unsupported-client refusal, cancellation,
timeout cleanup and typed result/source fencing. L-T04: other-role regression and replay/restart of
any new adapter. All scenarios use disposable fixtures, no paid model calls or primary credentials.

Require build, type checks, lint, focused unit/integration tests, exact connected journey, independent
review and hosted checks. Application/UI changes are excluded unless separately scoped; required UI
journey remains applicable even when the repair is infrastructure-only.

## Definition of done and sign-off

The chosen route is explicitly approved, implemented within the reviewed contract, independently
reviewed, verified through permitted/denied real-client boundaries and delivered to the feature.
Publish actual passed/failed/skipped/blocked results and exact source/image/policy hashes. .17/.13
remain open until their additional admission, coordinator, gateway, limits and approval gates pass.
This task does not authorize a live pilot, paid service, staging or production promotion.

## Bounded proxy feasibility evidence — 8 October

Three separately reviewed disposable probes used Codex 0.156.1 and immutable candidate image
90dd34f0, Docker network none, empty fixture auth, unchanged filesystem/resource/seccomp controls,
one fixed command and five-minute host/four-minute fixture bounds. No paid call or production policy
change occurred. Each source postcheck verified 832 unchanged files; owned container absence and
evidence preservation passed. The independent critic reviewed supplied revision-bound material
without tools under the supervised procedural exception; inherited tools were not technically disabled.

1. Managed proxy enabled with legacy network access false: local bind failed EPERM. Tagged client
   configuration only activates the configured proxy when the network permission bit is enabled.
2. Disposable network bit enabled plus wildcard deny: strict configuration rejected the global deny
   wildcard before tools ran. This was a failed proposal, not a qualified policy.
3. Empty domain table, active proxy and local binding false: tool creation was rejected because
   127.0.0.1 is a blocked local/private address. This establishes proxy policy activation, not a passing
   loopback route. Do not repeat the unchanged configuration or enable broad local access.

Exact scripts/configuration/transcripts and cleanup records are retained in the operator evidence
root runner-qualification-20261008 under role-loopback-feasibility-1, -2 and -3. These probes do not
establish gateway denial, external/private containment, UNIX socket compatibility or Electron success.
The next contract must resolve those requirements or select the governed offline adapter. Admission,
coordinator bindings, authenticated gateway access and the aggregate cap remain separately gated.
