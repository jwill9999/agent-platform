# Context/token MVP — independent planning critique

**Task:** `agent-platform-context-optimisation`.

**Source reviewed:** staging `d199ad0172dfe016490533444d5b7c46733c8f4d`.

**Reviewer:** distinct `runner_plan_critic` agent, read-only assignment; this is not technical tool isolation.

**Status:** Approved by the independent critic on 13 October 2026; no outstanding findings. Owner review before implementation remains required.

## Initial source-backed findings

| ID   | Severity | Finding                                                                | Proposed correction for recheck                                                                       |
| ---- | -------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| CT01 | High     | Initial windowing misses tool-loop and resume calls.                   | CT-R1 names one reasoning admission boundary and explicitly excludes auxiliary callers.               |
| CT02 | High     | Mandatory context may exceed budget.                                   | CT-R4 defines visible local halt, no retry, persistence of prior effects and no success claim.        |
| CT03 | High     | Message-at-a-time removal can break tool pairs; schema cost is absent. | CT-R2/3 count final mapped schemas, margin/output allowance and atomic groups with overflow fallback. |
| CT04 | High     | Summary continuity must not become permission authority.               | CT-R3 reloads scoped existing memory and uses live approval state; no inferred approval or replay.    |
| CT05 | Medium   | Summarize strategy and retries have ambiguous semantics.               | CT-R1/3 define effective deterministic policy and retry-stable admitted payload.                      |
| CT06 | Medium   | Generic testing misses real payload/effect/privacy evidence.           | CT-T01–13 map connected UI, provider fixture capture, SQLite/audit effects and strict V1 metadata.    |
| CT07 | Low      | Spec P2 conflicts with live P1.                                        | Revised task specifies P1 and records actual source/dependency/delivery mapping.                      |

The initial critic inspected actual source and existing specification; no tests, state mutations or
paid calls were made by that review. The final verdict below approves the corrected plan, not the initial draft. This finding history is
retained so later implementation can trace the required corrections.

## Planning verification record

Runtime scenarios are planned, not run. Docker availability and runner status were inspected by the
coordinator. Local document validation and source-bound publication receipts are retained alongside the final
review in the external planning evidence directory before presentation to the owner. No implementation,
merge, release or paid provider authority is implied by a favourable critique.

## Second critique and correction

CT08 (high): the old initial API cutoff could discard history before the new shared admission point,
so a later validator could not recover complete tool groups. CT-R1 now explicitly replaces that cutoff
and supplies full validated history to the provider projection while retaining persistence offsets.
CT-T05 checks the old multi-tool cutoff regression. The critic found CT01–07 otherwise addressed.

A conservative clarification also protects all active-user-turn tool groups, rather than only the
latest group: previous-run memory cannot be assumed to summarize new effects. Earlier user turns
remain eligible for group windowing. A long active turn may halt explicitly; no new summariser or
continuation/replay machinery is added. CT-T02 checks this boundary. The final focused recheck approved this correction and clarification.

## Final independent verdict

`runner_plan_critic` returned **approved**, with no findings. CT08 is closed: initial lossy truncation
is explicitly replaced, complete initial/resumed inputs reach shared projection, persistence accounting
is preserved, and the old multi-tool cutoff is covered. Protecting all active-turn tool groups avoids
forgetting newly executed effects. Older-turn windowing and existing durable memory remain the bounded
optimisation; required overflow honestly halts.

The final source-aware review bound these substantive document hashes (SHA-256):

| Document         | Reviewed hash                                                      |
| ---------------- | ------------------------------------------------------------------ |
| Plan             | `d87d7f033b614eba36408b2f276a75bcd132db1d56bbf1de2f0b4ec0e1b14ce8` |
| Specification    | `0a87d67ba0537858db6419a3a6c45342393a9c7df59a5a476b78b82130c1ba72` |
| Verification map | `232e791a4c6a9337b1d73c311bf10f3495bc059be64c9c770e770db6308fd8af` |

Only this verdict and the session's review-status handoff were added after that review; the three
reviewed documents are unchanged. This is planning approval, not runtime qualification or owner
implementation/merge approval. Runtime scenarios remain not run. The canonical Beads task stays in
progress for planning and owner review; it is not closed by publication.
