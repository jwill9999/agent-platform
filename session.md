# Session handoff

**Purpose:** short rolling handoff. Keep below 160 lines; replace stale state, retain only recent
iterations, and put detailed requirements in task specs. Older history:
[session-archive-2026-05.md](session-archive-2026-05.md).

## Last updated

- Date: 2026-09-07.
- Active implementation: `agent-platform-multi-agent.repair.4`, in the repair4 worktree.
- Specification and detailed broker handoff:
  [repair4 task](docs/tasks/agent-platform-multi-agent.repair.4.md).
- Runtime operating instructions: [continuations](docs/workflow-control-continuations.md).
- This is a local handoff, not a commit/push receipt, Beads snapshot, or pilot-completion claim.

## Implemented foundation

- `.1`–`.4`: contracts, normative lifecycle, isolation, journal/leases/reconciliation, plan approval.
- `.5`–`.7`: single-writer Beads orchestration, revocable specialist credentials, bounded repair,
  exact-tree Git/CAS delivery brokers, protected GitHub operations and durable waits.
- `.8`–`.10`: secure evidence, exact-head evaluation, bounded repair children, cancellation and
  finalization, separate immutable task-to-feature and feature-to-staging authority.
- Recovery and repair4 preserve superseded runs and heads as historical evidence, not transferable
  delivery approval. Current live GitHub/Beads status was not re-observed in this handoff.

## Latest reviewed slices

- Repair4 adds governed note/review-thread operations, notification/approval state, normative callback
  mappings, durable continuations, and typed lineage persistence.
- Durable phase jobs atomically consume callbacks, bind exact run/material/head/identity, fence
  claim/recovery/completion, and reject substituted producer, role, or head evidence.
- Concrete standalone runtime composes the credential broker, Docker launcher, journal and vault;
  renews leases during execution; and ingests structured results and validated callbacks.
- Explicitly authorized read-only verification/review can reach task acceptance. Acceptance checks
  every approved criterion, findings, risks and status/transition consistency. The actual prompt,
  scheduler packet and input evidence share an execution/head/owner/fence-bound envelope.
- Coordinator reports two independent review passes for phase jobs and two for the final runtime
  candidate. Those reviews are code evidence, not proof of external deployment or a live Codex pilot.

## Bootstrap correction candidate awaiting independent review

- Concrete Git-only `BootstrapCoordinator` now binds a strict stored full policy to exact approval,
  keeps canonical original workspace authority separate from the approved repair4 source, observes
  the existing ref through lawful transitions, atomically establishes its initial head ledger,
  commits/pushes the exact reviewed tree and records secure `implementation_artifact_ready` evidence.
- `bootstrap-preflight` is read-only even on an old journal: no migration, Git object/index writes,
  remote or Beads calls. Mutating APIs require actual exact approval and pinned reviewed adapters.
- Cancellation transactionally fences queued continuation/phase/approval work and rejects new
  claims. Started execution/credentials/prepared effects and inflight transports must be observed
  settled; lost notification acknowledgements use observation-only recovery during cancellation.
- New tests cross real executable subprocesses and temporary worktree/bare-remote Git boundaries.
  Their approvals/adapters are fixtures, not live provider or credential conformance.

## Current local gates

All commands ran for the bootstrap correction in the repair4 worktree on 2026-09-07 and exited 0:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `LANGCHAIN_TRACING_V2=false LANGSMITH_TRACING=false pnpm test` — full recursive run passed;
  workflow-control 424 passed, one opt-in Docker isolation test skipped.
- `pnpm format:check`
- `pnpm docs:lint` — Markdown and local relative-link checks passed.
- `pnpm deps:check-cycles` — no cycles after fixing the new bootstrap journal's type-import cycle;
  77 unresolved imports were skipped by the checker.

Runtime tests cross a real child-process boundary with fixture transports. They are not actual
Docker/Codex conformance. Current hosted checks, Sonar/IDE Problems, and an actual standalone pilot
must be evidenced separately; prior historical results do not certify this candidate.

Bootstrap correction package `build`, `typecheck`, `lint`, and `test` also passed after the dependency
fix; 424 tests passed, one opt-in Docker isolation test skipped. Terminal quality gates pass. Current
Sonar/IDE Problems evidence is unverified: no candidate code was uploaded under the no-network-write
scope, and no IDE Problems reader was available. Do not call the complete delivery gate satisfied.

## Read-only runtime observation

- Bootstrap run `bootstrap-agent-platform-multi-agent.repair.4-20260906`: `approved`, version 0,
  active owner approval. No transitions, delivery operations, scheduler executions or cancellation
  records for that run. Predecessor run is cancelled; observed old leases were expired.
- Live journal remains schema version 10. It was opened only read-only with `query_only = ON`.
- Approved workspace digest refers to the original checkout, not repair4. Task-level operations do
  not grant Git commit/push; only top-level authority/prose mention them. Do not edit that immutable
  contract or treat prose as a bypass. There is no bootstrap approved-head ledger.
- `session.md` is outside the bootstrap contract's `docs` / `packages/workflow-control` allowed paths.
  Do not include this local handoff in a brokered bootstrap commit without explicit path authority.

## Remaining integration and safe next action

1. Resolve contract/workspace/task-level commit/push authority with fresh review and approval. Preserve
   the existing journal and candidate. No direct Git or Beads write is authorized by this handoff.
2. Review the concrete bootstrap composition and prepare the final full policy: exact source/canonical
   realpaths/common Git directory, ref/initial head, full candidate manifest/tree/diff, remote CAS,
   real author, unchanged full Beads snapshot, exact test/review producers and evidence. Supply pinned
   owner-only read/remote adapter executables and narrow credentials. The implementation exists;
   actual immutable approval, runtime provisioning and live migration authorization do not.
   Historical runtime scripts contain repair3-specific CAS/tree code and no-op cleanup callbacks;
   they are not trusted repair4 execution or cleanup adapters and must not be rerun.
3. Resolve revised-contract lineage compatibility: current import demands matching source/target
   policy digest/version, and its separate ledger is not yet consumed by existing delivery gates.
4. For standalone execution, provide the real revocable credential broker, pinned image, constrained
   network, non-root identity and approved phase-role config. Implementation artifact import and
   coordinator receipts remain missing; unsupported phases stop visibly, never report fake success.
5. Only after actual task-only commit/push and exact artifact attestation, terminalize the bootstrap
   with `planned_authority_handoff`, prove cleanup/fencing and unchanged in-progress Beads, then obtain
   fresh approval for the distinct delivery run. Perform exact lineage import before external pilot
   operations. Do not open a PR, notify, mutate Beads/threads or merge under bootstrap authority.
6. Require all seven hosted feature-boundary checks and current exact-head review/owner intent before
   delivery to `feature/multi-agent-orchestration`. Staging needs a separate later contract; never main.
