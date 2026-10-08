# Align Notion documentation with the repository

## Summary

Deferred backlog capture, requested by the owner on 27 September 2026. Revisit and
agree detailed scope before implementation. This is separate from PR277 and does
not block its integration into `feature/harness-backlog-review`.

## Evidence and requirements

The read-only audit at source `ecc51d2` found 13 document pages beneath the configured
Notion hub, representing 12 unique source paths. Six of 545 Markdown files under
`docs/` were represented; this inventory includes historical material and templates.
The current publishing skill mirrors changed documents, with no initial backfill.
Broad Notion categories combine repository folders. The index still describes PR276
as unmerged; R1 source snapshots retain pre-CI status despite subsequent passing checks.
Repository and user-installed publishing skill copies differ.

Assess and propose:

- Repository-aligned navigation, retaining useful thematic indexes and human notes.
- A publication inventory mapping source paths, page IDs, branches, revisions,
  content hashes, freshness and explicit exclusions.
- A clear current-document entry, with proposals and historical snapshots separated.
- Prioritized backfill of active orchestration plans, specs, architecture, test plans
  and result reports; classify historical material before any bulk import.
- Publication completeness, link and freshness checks, including merge reconciliation.
- One authoritative skill and delegation from the installed copy to avoid drift.

Repository files remain canonical; Beads remains task authority. Raw logs and machine
artifacts may be linked from reports rather than copied wholesale. This capture does
not approve migrations, bulk publishing, deletions or automatic background sync.

## Proposed approach and dependencies

Refresh the live hub and repository inventory, present a bounded alignment plan,
then implement the agreed structure and skill changes. Preserve source identity and
human annotations. No blocking dependency is added to PR277 or current runtime work.
Related prior task: `agent-platform-notion-doc-skill`; do not reopen the delivered
initial skill merely to track this broader follow-up.

## Verification and definition of done

- The agreed mapping is documented and used consistently by the publishing skill.
- Every document in the agreed publication set has a verified mirror or an explicit,
  justified exclusion or blocker; missing documents are not reported as synchronized.
- Readers can identify current versus proposed/historical material without guessing
  branch names; the index links to the current accepted checkpoint.
- Readback verifies complete content, source revision, destination and preserved notes.
- An update and merge reconciliation exercise demonstrates stale/missing detection.
- Repository links and Markdown validation pass; results and remaining historical
  backfill are recorded. No application test or orchestration acceptance is implied.
