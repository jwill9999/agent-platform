# Bind execution approval to detailed planning documents

Status: proposed design; independent critique pending. Owner authorized planning and critique only.
This package does not grant execution, merge, staging or pilot authority.

## Objective and identity

An agent must execute the requirements and test plan the owner actually reviewed. Approval of a
contract must not silently authorize different bytes at the same linked document paths.

| Item                      | Value                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Task                      | Bind detailed planning artifacts to execution approval — `agent-platform-pilot-zero.16`               |
| Parent                    | `agent-platform-pilot-zero`                                                                           |
| Planning branch           | `task/approved-document-binding-plan`                                                                 |
| Parent/integration branch | `feature/harness-backlog-review`                                                                      |
| Source baseline           | `5e5f7f2bf66ca07410a5c83689230b0c3e25f609` (PR271 merged)                                             |
| Worktree                  | `/Users/letuscode/projects/agent-platform-workflow-evaluation`                                        |
| Implementation branch     | Proposed `task/approved-document-binding`, created from the approved planning tip; does not exist yet |
| Delivery                  | Pushed task branch and review PR to the feature branch; human decides merge                           |

## Current evidence

`planning.ts:deriveContractMaterialDigest` hashes parsed contract fields. `contracts.ts` has no typed
linked-document manifest. `storage.ts:createPlanApproval` checks the stored contract and critic but
never reads the contents of linked specs or tests. `revalidatePlanApproval` compares contract material
only. Approval is also consumed by `bootstrapJournal.ts`, `phaseJobs.ts` and durable approval waits
and inherited/repair paths in `storage.ts`; changing only the approval creation function is insufficient.

`preapprovalMaterial.ts` already stages explicitly named regular files, hashes bytes and checks source
and staged contents, with 1,024-file/16-MiB limits and a trusted quiescent-host assumption.
`artifacts.ts:ContentAddressedArtifactStore` verifies object bytes on retrieval. Reuse those primitives;
a generic evidence reference or in-memory verification flag is not durable execution authority.
The standalone restricted critic is qualified separately; it does not prove managed execution.

## Requirements

- DB-1: Define a versioned, typed document manifest containing canonical repository-relative path,
  document kind, owning task IDs, exact byte length and SHA-256 digest. Pin the publication source
  revision and workspace/repository identity. Deterministic ordering and serialization are specified.
  Each contract task has at least one specification and verification-plan mapping; shared plans may
  name multiple tasks. Include every normative design/reference needed to interpret the task. Missing
  coverage, unknown task IDs, duplicate or case-colliding paths and unsupported versions fail closed.
- DB-2: Preserve exact bytes (including whitespace/newlines); do not normalize prose or follow arbitrary
  Markdown links at runtime. A coordinator publishes an explicit complete set, checked by critic and
  owner. Missing, unreadable, oversized, symlinked, traversal or tampered inputs block publication.
  Reuse the preapproval limits and credential/control-path exclusions. No remote URL fetching.
- DB-3: Bind the manifest into the canonical contract material digest. Critic review and owner approval
  therefore identify the same document set. A changed byte, path, kind, task mapping or set membership
  requires a revised immutable contract, fresh critique and explicit approval. Never rewrite old
  approvals, silently rehash documents into them, or treat restored bytes as reactivating an invalidated
  approval. The owner is not prompted again for unchanged verified material.
- DB-4: Check publication, approval creation, task packet production, enqueue/claim/start, resume and
  every authority-bearing mutation/import/delivery boundary. All paths share one verification policy;
  a caller-supplied `verified: true` or optional no-op callback is unacceptable. On detected mismatch,
  persist invalidation plus safe reason/evidence and deny the pending effect. An inability to read
  bytes also denies execution; storage errors must not roll back the denial into an apparent success.
- DB-5: Give each worker/reviewer the verified immutable document snapshot matching its task packet,
  never current mutable paths as its normative input. Bind packet, snapshot, contract, run/task and
  approval identities. Check the authoritative document source at each new execution boundary and
  check snapshot bytes before use. A change detected while work is running stops further authorized
  effects and rejects stale result adoption; do not claim rollback of effects already completed.
- DB-6: After process restart or queue redelivery, reconstruct verification from durable contract,
  manifest and artifact bytes, not a previous process's flag or temporary directory. Retried publication
  is idempotent for the same set; partially published bytes cannot yield an active approval. All
  approval consumers, including bootstrap and generated repair/inherited approvals, apply the guard.
- DB-7: Preserve historical v1 records and their existing digests for inspection. Legacy contracts
  without a manifest cannot acquire new execution authority or resume mutation work after rollout.
  An operator prepares a new linked immutable run/contract and obtains critique/approval; no automatic
  grandfathering or in-place rewrite. Cancellation, status, diagnostic and cleanup operations remain
  possible. Existing role, lease, policy and delivery checks still apply.
- DB-8: Retain requirement-to-test evidence and human-readable failure codes without logging document
  bodies, credentials or sensitive absolute paths. Unexecuted or failed required scenarios block task
  completion. The task owns the final integrated verification across publication through restart.

## Proposed design and compatibility decision

Add an optional `planningDocuments` field to the v1 contract parser for historical read compatibility.
When absent, parsing/material hashing stays byte-for-byte compatible with current behavior; when
present, its strict version-1 object contains sourceRevision and sorted document entries. Do not insert
an empty default. Runtime authorization makes a nonempty verified manifest mandatory. Old binaries
already reject unknown contract fields because schemas are strict: deployment must upgrade all
coordinators/consumers before admitting new-format runs, and downgrade requires stopping those runs.
The additive verification-attempt migration described below is required; it preserves historical
contracts and approvals rather than rewriting their contents.

Prefer embedding the manifest entries in the contract; store each document's bytes in the existing
content-addressed artifact store. The contract digest binds the manifest, and artifact reads validate
its byte length/hash. Register publication receipts durably only after all bytes verify. Object writes
before a failed transaction may leave unreferenced objects, but never an approval. Reuse existing
journaled artifact publication; cleanup must not delete referenced objects. No new external storage.

Persist a fenced verification-attempt record **before** reading bytes or allowing a guarded action.
It identifies approval generation, run/task, intended boundary, expected manifest, owner/lease and a
unique attempt ID. Failure to persist this intent means no verification/effect is attempted. After
reading, atomically settle success against the same active approval/lease or persist invalidation and
settle failure. An exception, crash or failure to save invalidation leaves the attempt unresolved.
On startup/recovery an unresolved attempt from a dead/fenced owner quarantines the approval before
any new capability, effect or result adoption, even if original document bytes have been restored.
A concurrent live attempt remains pending, never presumed successful. A verified result is not a
reusable permission token: every new boundary performs its own check under existing run/lease fencing.

Recovery must not clear an unresolved attempt merely because bytes now match. Conservatively invalidate
the affected approval through an explicit recovery operation once storage is healthy, retain the
attempt as evidence, and require a fresh critique/owner approval via a new immutable contract/run.
An ordinary clean restart with no unresolved attempt and unchanged bytes needs no new owner prompt.
If durable state cannot be read or written, remain stopped. Test concurrent verification, lease loss,
crash and the combined mismatch/write-failure/restored-bytes restart. An additive migration for this
attempt ledger is now required; historical records remain unchanged, and migration/reopen/rollback
behavior must be tested. Do not use a best-effort log or a separate uncoordinated marker as authority.

The source revision is provenance, not a demand that every later code commit equal the initial SHA.
The coordinator resolves the currently accepted task workspace/head through trusted existing runtime
bindings and checks normative paths there; document bytes must still match while code may evolve.
The actual worker consumes a private read-only snapshot, so a later source edit cannot replace bytes
already supplied. This prevents substitution at the supported boundaries, not hostile host/root
filesystem races. Preserve the existing trusted, quiescent publisher assumption.

Exclude the contract itself, generated manifest, critic results, approval receipts, session handoff
and test-result reports from the normative set to avoid self-referential hashes and routine evidence
updates invalidating requirements. A normative spec must not be edited for progress/sign-off while
its approval is active; write those outcomes to review evidence and Beads. Changing requirements in a
normative spec intentionally needs reapproval. References conveying requirements must themselves be
explicitly included; links are not transitive proof of coverage.

Publication interface: a trusted coordinator supplies canonical source root, source revision, explicit
paths/kinds/task IDs and artifact/journal adapters. It returns a manifest and durable publication
receipt, never an approval. Add a supported validation/handoff operation that accepts contract/run/task
identity and resolves its source and artifacts internally. Concrete names/signatures are implementation
details; no current CLI or MCP capability is claimed. Expose a machine-callable coordinator API and
an operator validation command with structured pass/block reasons, then document both. Neither accepts
model-selected arbitrary host roots or generates owner identity/approval on its own.

## Enforcement map and implementation boundary

Implementation begins by inventorying all approval reads/writes, direct SQL consumers, capability
issuance, packet builders, bootstrap effects, child/repair inheritance and resume paths. Retain that
map in the result report and parameterize negative tests over every entry. An unmapped path blocks
completion; it cannot be deferred under a passing helper test.

Expected changes are confined to `packages/workflow-control/src/`, its `test/`, and the docs/skills
named in the execution contract. Within source, primary modules are contracts, planning, storage,
artifacts/preapprovalMaterial, phaseJobs/phaseRuntime, orchestrator, bootstrap/bootstrapJournal,
trustedGovernedComposition, specialistInput/launcher, governedOperations/persistence, delivery and
repair brokers, CLI/index. A small new planningDocuments module is expected. This is a cross-cutting
approval enforcement slice; no unrelated refactoring or workflow-stage implementation is included.
If source mapping reveals a required dependency outside those boundaries, record it and revise this
plan before implementation. UI, application permissions, model selection, network policy, dependencies,
and the unimplemented managed-pilot stages are excluded.

Sequence under the existing task: schema/publication and unit tests; persistence/invalidation and
compatibility tests; packet/launch/broker/resume wiring; composed verification; documentation and
independent code review. No separate child tasks or parallel workers are proposed for this coupled
change. The `.13` pilot remains blocked on `.16`; `.12` skills qualification is related, not assumed
complete because this design is reviewed.

## Verification, limits and approval decisions

See the [verification plan](../../testing/approved-document-binding.md). Tests use temporary real Git
repositories, SQLite and artifact directories; Linux Docker supplies native dependencies. The cached
reviewer image is available for independent critique. No API/web service, paid provider or hosted
external writes are needed for binding tests. Fault adapters intercept outward delivery and count
attempts while exercising real internal persistence. Optional real Docker handoff proves mounted bytes.
No managed live-model completion claim is made by that controlled end-to-end test.

Require full package build/typecheck/lint/tests, document checks, independent review and hosted checks.
Bound implementation attempts to two and infrastructure retries to two before recording/escalating an
unresolved problem. No automatic scope expansion, dependency upgrade, model purchase or paid experiment.
Use existing account only for authorized independent review. Do not execute a pilot under this plan.

Owner review should confirm the outcome and these proposed choices: exact-byte matching; unchanged
material runs without repeat prompts; legacy records remain readable but require a new reviewed
contract to execute; delivery ends at a feature-branch PR. These are proposed decisions, not recorded
owner approval. No unresolved product question requires interrupting the current drafting stage.

## Document manifest and handoff

| Material                          | Location                                                                   |
| --------------------------------- | -------------------------------------------------------------------------- |
| Task specification                | [pilot-zero.16](../../tasks/agent-platform-pilot-zero.16.md)               |
| Verification plan                 | [scenarios](../../testing/approved-document-binding.md)                    |
| Draft v1 execution contract       | [contract](execution-contract.v1.json)                                     |
| Content-addressed review inputs   | [manifest](evidence-manifest.json)                                         |
| Independent findings/dispositions | [review](../../reviews/approved-document-binding-plan.md)                  |
| Architecture boundary             | [ADR0004](../../adr/0004-codex-development-orchestration-control-plane.md) |
| Current approval mechanism        | [guide](../../workflow-control-planning.md)                                |

The current v1 draft includes explicit documentary hashes in requirement strings plus the evidence
manifest for review reproducibility. That is not the proposed typed runtime enforcement. No persisted
run or owner approval is created to plan this repair, and it cannot bootstrap its own authorization.
After owner approval, implementation uses the documented supervised route until runtime qualification;
a later pilot must regenerate its own exact manifest/contract and obtain its own execution approval.

The coordinator publishes read-only planning output, validates it, obtains distinct critique and
records dispositions. Material corrections require a new review. Final handoff identifies approved
contract digest and document hashes; missing approval leaves implementation unstarted.
