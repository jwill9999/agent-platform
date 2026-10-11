# Agent Platform Notion publication

## Source and destination

- Repository: https://github.com/jwill9999/agent-platform
- Initial documentation reference: `feature/harness-backlog-review` (user supplied 2026-09-27).
- Resolve the current checkout and pushed commit for each publication; the initial reference is historical.
- Workflow: `.agents/skills/documentation/SKILL.md` and `docs/README.md` at the active requested ref.
- Workspace: LetUsCode.
- Hub: https://app.notion.com/p/3e8c07cdcbcf81758a49faf2bf7092e6
- Hub page ID: `3e8c07cd-cbcf-8175-8a49-faf2bf7092e6`.

The hub and its eight children were fetched on 2026-09-27. Fetch them again before publication; a
missing or moved destination is not permission to create a replacement workspace or unrelated hub.
Create document pages as children of the relevant section using an explicit page parent. These
sections are ordinary pages, not database data sources.

## Notion section routing

This maps repository documents to their Notion presentation homes; `docs/README.md` still governs
where repository files belong. Preserve source paths. Choose by document purpose when paths overlap.

| Documentation purpose                                         | Typical source                                                            | Parent page ID                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Product intent, user requirements and scope                   | Product briefs and scope documents                                        | `3e8c07cd-cbcf-8105-aed8-e7c812f3b63e` |
| Architecture, runtime, API, interfaces and detailed design    | `docs/architecture/`, `docs/design/`, architecture/API and runtime guides | `3e8c07cd-cbcf-8181-bc4d-cfeaf08fdfe1` |
| Decisions and ADRs                                            | `docs/adr/`, decision records                                             | `3e8c07cd-cbcf-8149-8e63-d5eac078fe6e` |
| Research, framework comparisons and experiments               | Research/assessment documents selected by purpose                         | `3e8c07cd-cbcf-8185-ac46-c0f9861a78ee` |
| Plans, manifests, task specifications and delivery            | `docs/planning/`, `docs/tasks/`, release notes                            | `3e8c07cd-cbcf-81ca-984d-d1378a9d5d6b` |
| Verification, critiques, findings and execution evidence      | `docs/testing/`, `docs/qa/`, `docs/reviews/`                              | `3e8c07cd-cbcf-81cb-bdef-d1cfa006c64a` |
| Contributor workflows, configuration and operations           | `docs/development/`, deployment/configuration and runbooks                | `3e8c07cd-cbcf-81cd-b1bc-f16f63847416` |
| Documentation indexes, authoring procedures and general notes | `docs/README.md`, documentation workflow notes                            | `3e8c07cd-cbcf-812a-a0cb-cbfcec750495` |

Existing `docs/demo/` and `docs/superpowers/` material retains its source location; route its mirror by
purpose. A document belongs to one section; cross-link it from other sections rather than duplicate it.

## Mirror identity and metadata

Use a readable title such as `Document title — feature/harness-backlog-review`. Record these fields as
visible page content so later agents can find and verify identity without assuming a database schema:

- Repository: `jwill9999/agent-platform`
- Source path: exact repository-relative path
- Source branch: actual branch/ref
- Source revision: actual commit SHA, or explicitly unpublished snapshot with base SHA
- Source link: immutable GitHub blob permalink when remotely available
- Source content SHA-256: computed from the exact source file bytes
- Last mirrored: actual ISO timestamp
- Document status: copied from the source; use unspecified when absent
- Related Beads IDs: only IDs actually referenced by the source

Page body layout:

1. Source metadata
2. `Repository mirror` — complete document content
3. `Notion notes` — human annotations; preserve on subsequent updates

A source byte hash is a version identifier, not proof that Notion's formatting is identical. Compare
normalized content on readback. For divergence checks, retrieve the previous source revision matching
the recorded hash and compare its converted content to the current mirror. If that source snapshot is
unavailable, do not infer that differing Notion content is disposable: inspect and preserve it.

Search by source path and verify repository and branch metadata. A changed filename requires explicit
rename evidence before reusing the old mirror. Promotion to another branch creates or updates that
branch's mirror; do not silently replace a reviewed or approved historical snapshot.

## Links and publication boundaries

GitHub source links use `https://github.com/jwill9999/agent-platform/blob/<commit>/<path>` for files and
`tree/<commit>/<path>` for directories; encode path components correctly. Only construct a commit
permalink after verifying the commit/file exists remotely. A branch link may be included separately
but does not identify immutable evidence.

Do not publish credentials, secret values or private runtime payloads from logs. If an otherwise
requested document contains such material, preserve the canonical source, publish an explicitly
redacted mirror where appropriate, and report the omission. Do not falsely claim byte-identical sync.
Task pages are documentation mirrors, not an independent Notion backlog. Preserve approval evidence,
review findings and failed/not-run test results verbatim in meaning.
