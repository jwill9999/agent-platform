# Standalone execution prerequisites — proposed repair plan

Status: proposed implementation scope; planning authorized, runtime repair and pilot not launched.
Beads owner: `agent-platform-pilot-zero.17`. Source: feature merge
`a8586aa425fc4907ef7aa374ff2d283d6eb0a1cd` (PR274).

## Outcome and boundaries

Provide a supported standalone route for a single implementation task to return verifiable changes,
progress through independent verification/review and required coordinators, and finish without a
human restarting each phase. Retain durable journals, exact-document approval and broker authority.
The later `.13` contract selects the real permission scenario and authorizes its live pilot.

This repair's delivery is a reviewable PR to `feature/harness-backlog-review`. No merge, staging,
production, A2A transport, fan-out/fan-in, SDK migration, application UI or permission-policy changes.
Do not replace the existing scheduler or journals. Desktop conversation resumption remains separate.

## Task and document manifest

| Item | Location / identity |
| --- | --- |
| Task | `agent-platform-pilot-zero.17` |
| Specification | [Task specification](../../tasks/agent-platform-pilot-zero.17.md) |
| Verification | [Scenario matrix](../../testing/standalone-pilot-prerequisites.md) |
| Evidence | [Planning review](../../reviews/standalone-pilot-plan-review.md) |
| Proposed contract | execution-contract.v1.json in this folder |
| Policy proposal | [Proposed scope policy](planning-policy.md) |
| Canonical Beads workspace | /Users/letuscode/projects/agent-platform |
| Planning worktree | /Users/letuscode/projects/agent-platform-workflow-evaluation |
| Task branch | task/standalone-pilot-plan |
| Parent and destination | feature/harness-backlog-review at the source revision above |

One existing task owns all four requirements and final integrated verification. The ordered work
below is a design sequence within that task, not a parallel Markdown backlog. Do not close `.17`
after planning; it directly blocks `.13` until implemented, qualified and integrated.

## R1 — authoritative discovery and guarded start

Current MCP tools require known run IDs. Add a trusted read-only inventory keyed by canonical
workspace and task identity, returning all relevant nonterminal runs, their material identities,
leases and ownership. A different material digest is a conflict, not absence. Terminal runs are
reported separately; their old grants never authorize a new run. An unreadable/missing expected
journal returns unknown, without creating a database or returning an empty success.

Use the existing journal and workspace fences for the subsequent start decision. Inventory is not a
lock: start must repeat conflict/authority checks inside an atomic admission boundary. Concurrent
requests must not create two owners. Expose discovery through the operator CLI and MCP read-only
surface, without adding an unrestricted MCP launch tool. Support known-run inspection unchanged.

## R2 — governed implementation artifact return

`phaseRuntime.ts` rejects implementing packets. First specify a bounded output envelope containing
base revision, task/run/delegation/attempt identity, approved-material identity, changed paths, content
digests and terminal result. Reuse the artifact store/recorder; do not treat model text or a path as
proof of returned bytes. For this slice, cap returned file content at 16 MiB total, 1 MiB per file and 256 changed files.
Support only UTF-8 regular-file additions/modifications/deletions, with exact prior-content digest
for replacements/deletions. Reject binaries, renames, mode changes, symlinks, traversal, special files
and out-of-scope paths. These conservative limits are proposed scope, not current capabilities.

The trusted importer validates immutable artifacts and the approved base before applying changes
inside the authorized task workspace. Workers cannot select another repository, supply credentials,
or write directly to the canonical checkout. Bind import intent to source/artifact/task/fences,
record prepared/applied/verified outcomes, observe before replay, and reject concurrent drift.
After a crash, determine actual state and reconcile the same intent; never blindly apply twice.
Uncertain partial application blocks progression and retains recovery evidence.

Adapt the current terminal-result rule deliberately: changedFiles is expected for implementing but
remains disallowed for verification/review roles. A valid implementation result advances only after
verified import and committed callback. A result receipt alone does not prove import or acceptance.

## R3 — explicit production phase dispatch and completion

The selected route is implementing → task_verification → task_review → task_accepted → integration →
feature_evaluation → pipeline → delivery → finalizing, subject to the existing state machine.
Repair outcomes use existing repair_planning/repair transitions with bounded attempts; cancellation,
blocked results and expired authority stop dependent work. Do not invent new state transitions to
force this schematic sequence; prove the concrete existing transition targets in integration tests.

`PHASE_JOB_DISPATCH` names specialist and coordinator roles, but the standalone packet currently
admits only verification/review. Add explicit approved-role support for the required specialist
phases, including feature evaluation and repair planning where exercised. Extend the strict contract
phaseRoles schema with explicit feature_evaluator and feature_planner entries; validate them in packet
construction, contract containment and role-operation policy. Keep old contracts readable and fail
closed when a newly needed role is missing; never infer role authority from a dispatch name. Bind each to task/contract
roles; absence of authority blocks instead of defaulting to a stronger role.

Wire required coordinators through their existing production implementations. Define distinct typed
receipts per coordinator that bind run/task/phase, execution ID, approved material, authoritative
result head, committed operation IDs and lease epochs. Verify those receipts at phase-job completion;
a generic digest, arbitrary transition or caller-supplied owner is insufficient. Completion records
local bookkeeping only; the responsible coordinator owns its actual workflow transition.

Trace the real task_accepted → integration → feature_evaluation transition through existing storage
and exact-head integration gates; do not skip integration because it is not a phase-job enum member.
Test verifier/reviewer repair via repair → implementing separately from feature-evaluation repair via
repair_planning → implementing. Both must return through verification/review and enforce attempt limits.

The integrated qualification must cover task acceptance and repair, pipeline, delivery and finalization
using disposable repositories/services. Real external PR/merge/Beads writes remain separately scoped;
fixture delivery is explicitly labelled and cannot satisfy the later live pilot's delivery evidence.

## R4 — host configuration and readiness

Use Docker-isolated specialists with the existing credential broker and immutable images. Propose
standalone supervision on the current macOS host with a trusted absolute Git executable override;
verify that exact executable at every production source-check path. Preserve executable pinning and
fail closed on relative paths, missing binaries or changed identity. Do not accept Xcode licences.
Linux fixture success is supplementary, not proof that macOS production commands work.

Readiness reports must name actual source, image, runtime, journal identity and model/broker status,
without secrets. No model purchase or benchmark is authorized. Reuse the separately authorized
existing-account isolated critic only for reviewing planning artifacts. A live execution credential
and spend policy must be established before the later pilot; reviewer access is not that authority.

### Host provision responsibility and feasibility gate

The implementation coordinator owns provisioning and recording SP-10. The current absolute Git
fallback is `/Users/letuscode/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git`;
its identity/version must be checked again at execution. The previously qualified reviewer image is
`sha256:e71bd7931f0cbfb4f5887ce5109f0b25095f3e8329b1656bf7ebed73efeb877f`, but reviewer qualification
is not evidence of a managed implementation image or conformant credential broker. A configured
production broker binary, its protocol/capability tests, immutable managed image and journal identity
remain unverified. Before implementation handoff, the coordinator must establish these from installed
interfaces/configuration or publish the exact missing provisioning work. Do not ask the owner to
approve a runnable claim while these are unknown. No secrets need be exposed for this assessment.

## Verification, roles and delivery

Implement in order R4/R1, R2, R3, then integrated verification. The worker makes bounded changes;
a distinct test runner verifies; an independent code reviewer assesses security/recovery and evidence.
The authorized supervising coordinator creates the reviewable PR through its existing scoped
GitHub access; the proposed worker contract has no GitHub mutation/merge authority.
Run build/typecheck/lint, affected tests, full workflow-control suite, real Docker checks and exact-head
hosted required checks. Sonar/Problems rules apply to future code changes. See the scenario matrix
for required assertions; failures or unexecuted required scenarios block qualification.

Suggested limits: two implementation/repair attempts per finding and two infrastructure retries,
then return a concrete blocker; no automatic scope expansion. No paid runtime calls in repair tests.
Latency is measured and reported across callback/import/dispatch boundaries, with no invented SLO.
The final test must enter through production StandalonePhaseRuntime.create and operator startup/config
validation. createForTest and substituted dispatch/import/coordinator implementations are prohibited
for connected qualification. Fixture contracts must explicitly grant required callback/coordinator
authority, independently of this supervised repair proposal.
The final test must prove event-driven progression without a human turn; fixture timing does not
establish real model-service latency.

## Contract status and outstanding execution binding

The accompanying v1 contract is a schema-validated proposal. Its policy digest refers to the exact
proposed scope-policy document, not an installed broker policy or approval. The manifest hashes real
draft document bytes. Before execution, resolve the actual operator policy, effective role capabilities,
source head and required hosted checks, bind published documents, revalidate the contract and obtain
its required approval. Neither schema validity nor this planning authorization creates that record.
This boundary prevents a plan from being presented as runnable while the prerequisite system is broken.
