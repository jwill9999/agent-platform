# Workflow-control planning and approval

Feature planning is a maker-checker workflow. A read-only feature planner drafts execution-contract
version `1` from repository and Beads evidence. A distinct read-only critic returns a machine-valid
review with one of four verdicts: approved, correction required, rejected, or human decision required.

Prompts, agent profiles, and skills improve planning behavior but do not authorize operations. The
workflow-control schemas, persisted contract, policy digest, and process-bound broker capability are
the enforcement boundary.

Every critic finding includes severity, affected requirement, evidence, and whether a focused human
decision is required. Findings are immutable and each must receive one persisted disposition:
`corrected` or `dismissed_by_human`. A later approved review does not erase an undisposed earlier
finding.

Explicit human approval is persisted only when:

- the latest critic review is approved;
- planner and critic identities differ;
- all findings have dispositions;
- the reviewed contract version and policy digest match the immutable run contract.

The approval binds the human identity, contract version, policy digest, and a canonical material
digest covering the full contract. Any scope, requirement, task, allowed path/operation, authority,
repository, base, merge method, delivery destination, quality-gate, retry, or policy change invalidates
the approval. The workflow returns to critique and explicit approval before execution can resume.

## Detailed-document binding API (draft implementation)

The implementation is under evaluation; the task remains open until its connected coverage and
independent review findings are resolved. Do not use this API as evidence that the managed pilot is
ready. See [current implementation evidence](reviews/approved-document-binding-implementation.md).

A trusted publication coordinator calls `publishPlanningDocumentObjects` with an explicit canonical
source root, workspace identity, repository, source revision, document paths, kinds and task IDs,
and the content-addressed artifact store. The returned manifest is included in `planningDocuments`
before the immutable execution contract is created. Each task must map to a specification and a
verification document. Object publication alone grants no execution authority.

After contract/run creation, `WorkflowStore.recordPlanningDocumentPublication` verifies and records
the source receipt. The distinct critic and owner approval APIs still apply. Runtime consumers call
`verifyPlanningDocuments`, which resolves the persisted source/manifest, records a durable attempt,
checks exact bytes and fails closed. The operator command is:

```text
workflow-control validate-documents <existing-database> <run-id> <task-id>
```

It returns structured `passed` and either `binding` or a safe `reason`; the process exits nonzero
when blocked. It accepts no caller-selected document root and creates no approval. It is not a pure
read: it records verification attempts and invalidates approvals after a mismatch. A returned binding
is diagnostic evidence, not a reusable authorization token for later operations.

The worker packet names `/run/approved-documents`; document bytes live below its `documents/` folder,
with the packet/run/task/approval binding in `binding.json`. The launcher checks that actual tree
before starting the container and supplies a read-only mount. Unchanged material survives restart
without another owner prompt. Changed material requires a new immutable contract and fresh review.

Explicit unresolved-attempt recovery requires a current run lease. It cannot recover an unexpired
attempt unless its recorded run lease has been superseded. Unfenced approval/operator attempts have
a bounded lifetime and cannot settle after it expires. Recovery invalidates authority; restoring the
old bytes never reactivates it. The caller must still use existing role and ownership controls.

Known limitations: publication provenance/current accepted task workspace resolution and bootstrap
terminalization after lost approval are still under review. The manifest's source revision does not
by itself prove a repository observation. The documented API does not remove those acceptance gaps.
