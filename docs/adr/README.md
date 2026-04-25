# Architecture Decision Records (ADRs)

This directory captures the locked architectural decisions for the Agent Platform. ADRs complement `decisions.md` (a concise summary table) by recording the **context**, **decision**, and **consequences** for each significant choice.

## Numbering

ADRs are sequentially numbered, four-digit, kebab-case:

```text
0000-template.md
0001-tier1-gap-remediation.md
0002-<short-title>.md
```

`0000-template.md` is the template — copy it for new ADRs and increment the number.

## Status values

- **Proposed** — under discussion; not yet implemented
- **Accepted** — agreed and in effect
- **Superseded** — replaced by a later ADR (cross-link the successor)
- **Deprecated** — no longer applicable but retained for history
- **Rejected** — considered and not adopted (kept for context)

## Authoring rules

1. Copy `0000-template.md` and rename with the next sequence number.
2. Use the present tense for the **Decision** section ("We adopt …").
3. Cross-link related task specs in `docs/tasks/` and other ADRs.
4. Update `decisions.md` with a one-line entry pointing to the new ADR.
5. ADRs are immutable once **Accepted** — to change a decision, write a new ADR that **supersedes** the old one and update both files.

## Index

| #    | Title                                                                                                 | Status   |
| ---- | ----------------------------------------------------------------------------------------------------- | -------- |
| 0001 | [Tier 1 gap remediation: evaluator, DoD, observability tools, docs CI](0001-tier1-gap-remediation.md) | Accepted |
