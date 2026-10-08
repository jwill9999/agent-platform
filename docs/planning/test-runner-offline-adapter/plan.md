# Governed offline application verification adapter

Status: proposed executable repair material; owner-authorized prerequisite scope, critique pending.
Owner: primary coordinator; authorization 8 October, complete pilot prerequisites for 9 October.
Task: `agent-platform-test-runner-loopback`; parent `agent-platform-pilot-zero`.
[Canonical specification](../../tasks/agent-platform-test-runner-loopback.md).
Branch: `task/test-runner-offline-adapter`, from pushed `task/pilot-active-budget`
at `ee3a160f9f3152ba16ed0ebbe376dc940c86dacf`; destination `feature/harness-backlog-review`.
Worktree: existing harness-readiness/agent-platform. Canonical Beads stays in the primary repository.
This task owns the final cumulative segment PR and feature integration, including the budget repair
and prior PR283 readiness evidence. No main/staging promotion or live pilot.

## Decision and feasibility

Use a deterministic, governed offline application verification adapter for an explicitly selected
`test_runner` task-verification phase. Codex command networking remains false for every existing
role. Do not repeat the three unchanged failed proxy probes or enable broad networking/local binding.
The owner explicitly authorized this alternative. Canonical CLI discovery returned absent, no active
matching run, expired workspace lease. Continue supervised prerequisite engineering; qualification
uses disposable journals and fixture approvals, not invented production approval or an autonomous pilot.

Production source currently routes every phase specialist through DockerIsolatedSpecialistLauncher,
which checks a durable scheduler packet, stages bounded source/approved documents, issues a revocable
credential, creates a network-none container, attaches the operator egress network, runs codex exec,
confirms exit/absence and revokes. PhaseRuntime already binds source, lease epochs, input/output and
absolute budget deadlines. Preserve those controls. Adapter selection is exact approved material,
not an arbitrary worker command, CLI flag, environment variable, model suggestion or fallback after
failure. Missing image/dependencies/unsupported selection fails closed. Ordinary specialists retain
codex exec, existing role policy and existing networking.

A direct offline candidate image `sha256:90dd34f0f6c35fd108d0beec015802a392124d74b106009777bcdef5a1c1ede9`
passed full build, 79 backend tool-dispatch tests and one connected Electron approve/provider-http
journey without retries/skips. It contains pinned Node24, pnpm9.15.4, Electron42.0.1 and relocated
locked dependencies. That is feasibility evidence, not adapter qualification. Current source must be
restaged/rehashed; old 829/832-file snapshots do not qualify new code. Lock/manifests must match the
image dependency payload exactly; no installs/downloads in the offline run. Provider HTTP is a
local fixture; no paid upstream model. Desktop and backend state/tool effects are independently
asserted by the retained packaged-vm-command.e2e.ts control.

## Requirements L1–L4 and implementation

L1: Add an optional strict task verification-adapter descriptor, copied into a test-verification
packet only. Bind literal adapter version/suite and immutable image/entrypoint digests to contract
material. Adding/changing this capability is an authority expansion for an existing contract;
removal narrows it. Only task_verification assigned to test_runner with process.test, workspace.read
and artifact.write can select it. Reject a descriptor on another phase/role, substituted suite/image,
changed digest, packet/contract mismatch or missing planning binding. Final pilot material must
explicitly choose this adapter; existing contracts remain unchanged.

The adapter is a trusted fixed Node entrypoint, generated/staged read-only by the supervisor from
repository implementation. It takes the durable bound input, not arbitrary commands/paths. The sole
suite runs relocated dependency validation, full build, harness toolDispatch.test.ts, scoped desktop
lint/typechecks and the exact one-test packaged Electron approve/provider-http journey, retries zero.
All commands, test selection and expected counts are fixed versioned implementation; no runtime shell
interpolation of agent input. A failed command, zero/skipped/flaky UI test, changed manifests or missing
artifact returns failure, never a passing AgentResult. Redirect subprocess output to bounded logs;
only one typed adapter receipt is accepted. Do not disguise adapter output as a Codex agent_message.

L2: Build the adapter container with network none throughout, root/source/input/entrypoint read-only,
all capabilities dropped, no-new-privileges, existing seccomp, pids/memory/CPU ceilings and no Docker
socket. Local servers exist solely in this disposable container's isolated network namespace. No
host networking, port publication, bridge/egress attachment, inherited environment, primary config,
authentication mount, model gateway, private socket or credential files. Scratch and declared
evidence are the only writable mounts. Source copied into scratch is for builds/tests; original
approved source stays read-only and host-side hashes are checked after settlement. Unsafe dependency
symlinks fail before tests. HOME/config/cache/tmp are private scratch locations; /tmp stays noexec.

Reuse the existing broker's issuance/revocation lifecycle initially, but its credential is never
mounted/exposed to the adapter; operator broker conformance and unused lease cleanup remain required.
The adapter bypasses only model invocation and egress attachment, not resource admission, credential
cleanup, journaled create/start/settlement or source/document verification. No command process can
reach the protected model gateway because it is absent from the offline namespace and no network
route/auth is supplied. Qualify actual raw/proxy socket denial against a separate protected gateway
sentinel and unapproved private/external destinations; verify sentinel received no requests. Existing
Codex commands keep their network denial, rather than inheriting the adapter's loopback capability.

L3: Work/cleanup deadlines and aggregate reservations from the budget repair apply unchanged before
any staging/credential/container effect. Admission rechecks before create/start and result acceptance;
unknown clock/journal/lease, cancellation, exhaustion or uncertain absence blocks progression. Adapter
execution uses its exact contract-bound image; journal validates container identity/image consistently
across restart/cleanup. Do not fall back to another image or reconnect egress. Preserve other roles
and legacy contracts. Broaden no filesystem or model/tool permission on ordinary specialists.

L4: Persist a distinct typed adapter receipt including adapter/suite/image/entrypoint identity,
execution/input/material/source/manifest bindings, exact command results and timing, evidence hashes,
backend/UI counts, failure/cleanup outcome. Validate against trusted expected input after exit and
before result acceptance; reject unexpected/oversized/noncanonical output, wrong execution/head,
symlinked evidence or substituted source. Raw stdout or self-reported success alone cannot pass.
Criterion classification must be an explicit approved descriptor mapping from each exact contract
acceptance criterion to a fixed suite command ID (build, backend_tool_dispatch or electron_approval).
Reject missing, duplicate, added or unmapped criteria and packet substitution. No default mapping,
no inference from prose and no blanket copying of packet criteria into passed results. The receipt
attests fixed command outcomes; the trusted result carries only their exact declared mapping. Final
pilot review must independently confirm the mapped tests actually establish each criterion; this
adapter cannot establish arbitrary semantic requirements or real upstream-model conformance. A
criterion requiring evidence absent from the fixed suite remains unsupported and blocks approval
or requires a separately reviewed adapter version, never a label-only coverage substitution.

Retain real logs in content-addressed evidence, not only paths into deleted staging. Host verifies
source equality, known container absence and broker revocation independently. No fabricated Codex
agent result or production approval. Deterministic verification is labelled explicitly in results.

## Scope, architecture and manifest

Allowed source in packages/workflow-control/src: contracts, lifecycle, phaseRuntime, specialistLauncher,
specialistTerminalResult, offlineTestAdapter, storage, specialistInput, index. Tests: contracts,
lifecycle, phaseRuntime, specialistLauncher, specialistTerminalResult, offlineTestAdapter and
specialistContainerLifecycle.integration within packages/workflow-control/test. Existing application
UI/backend code, dependencies and lockfiles are excluded. The retained Electron test is executed,
not rewritten. Docker fixture scripts/new assertions in the named integration file are allowed.

The [ADR update](../../adr/0004-codex-development-orchestration-control-plane.md) distinguishes the
narrow deterministic verification adapter from a model specialist; the Codex-only specialist rule
remains in force for model agents. Bind the updated ADR along with specification, this plan and
[verification plan](../../testing/test-runner-offline-adapter.md) through supported document objects.
Contract: execution-contract.v1.json beside this plan. Results/reviews:
docs/reviews/test-runner-offline-adapter.md and docs/reviews/evidence/test-runner-offline-adapter.
Allowed documentation also includes session.md and the canonical task. The coordinator publishes
complete branch-specific Notion mirrors, preserves human notes and verifies full content/metadata.

## Verification, delivery and stop rules

Execute L-T01–04 from the verification plan. Run focused package build/typecheck/lint/tests, relevant
real-container controls and final full regression. SonarQube/Problems or disclosed terminal fallback,
formatting, Markdown/links, independent pre-code critique and post-code review are mandatory. Required
failed/skipped/unexecuted controls block sign-off. No unit-only or manual direct-shell substitution.
Distinct critic uses supplied revision-bound evidence without tools under ADR's supervised exception;
inherited tools are not technically disabled. No paid calls, real pilot or persisted approval invented.

Two fixes per reproduced finding, two infrastructure attempts, five-minute waits and bounded test
work/cleanup allocations. Retain failures; no unchanged repeated probes. Timeout/unknown absence
requires owned containment and blocks further dispatch. Source/material drift requires rebind/review.
Only final segment tip opens PR to feature/harness-backlog-review. Require exact-head hosted verify,
desktop-e2e/e2e/docker/cycles/docs/security/Sonar gates and clear independent review before feature
merge; staging-only Mac skip does not establish pilot acceptance. Close adapter/budget tasks only
after declared feature integration. Then .17/.12/.13 still require configured admission/scheduling,
authenticated gateway/coordinator evidence and exact final pilot material/owner launch approval.
