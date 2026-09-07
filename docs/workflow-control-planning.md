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
