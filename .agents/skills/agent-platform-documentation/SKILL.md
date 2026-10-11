---
name: agent-platform-documentation
description: Create or update documentation for jwill9999/agent-platform using its repository documentation skill, and mirror every document produced by that workflow into the Agent Platform Notion hub. Use alongside the repository documentation skill for plans, task specs, designs, ADRs, guides, QA material and reviews, including work in Agent Platform worktrees.
---

# Agent Platform documentation

Complete each documentation request in both the canonical repository files and the
[Agent Platform Notion hub](https://app.notion.com/p/3e8c07cdcbcf81758a49faf2bf7092e6).
The user requested this publication convention for Agent Platform. Within an authorized documentation
task, adding or updating its Notion mirror does not need another confirmation. Respect explicit
local-only requests, read-only roles, managed-run publication boundaries and tool permissions.
This convention applies only to `https://github.com/jwill9999/agent-platform` and its worktrees.

## Follow the repository workflow

1. Read the target checkout's `AGENTS.md`, `.agents/skills/documentation/SKILL.md` and `docs/README.md`.
   Reuse these instructions when already loaded; the documentation skill delegates publication here,
   so do not recursively restart either workflow.
   Follow their linked rules when applicable. This skill supplements them; it does not replace their
   folder map, independent review, current native-development policy or task schema.
2. Use the user's active branch. The initial reference supplied on 2026-09-27 was
   `feature/harness-backlog-review`; do not switch branches or assume it stays current.
   If the checkout lacks the documentation skill or guide, fetch them from the requested ref through
   GitHub and record the ref used. Do not silently use an older local workflow.
3. Author and validate the requested files in their canonical locations. Preserve requirement IDs,
   evidence boundaries, source links and draft/reviewed/approved labels. Repository files remain
   canonical; Beads remains authoritative for task state and dependencies.
4. Include every substantive document created or updated by this documentation task in the Notion
   publication set, even if stored outside `docs/`. Do not bulk-import unrelated existing docs merely
   because this skill ran. Read-only planners/critics provide intended paths and Notion destinations
   to the authorized publisher. Native developer work publishes directly within owner authorization. Only publication operations
   deliberately owned by an explicit prototype run use its broker; missing prototype publication
   support remains that run's gap, not a default developer gate.

## Publish to Notion

Read [references/notion-publication.md](references/notion-publication.md) for verified destination
IDs, routing and source metadata. Discover the currently available Notion tools, read their schemas,
fetch the hub and target section, and read Notion's enhanced Markdown specification before writing.
Use the connected workspace; do not guess tool names or rely on cached access assumptions.
Required capabilities are destination discovery/read, create or targeted update, and readback. A
listed connection does not prove these operations are available. When content search is unavailable,
inspect the selected hub section and its children to establish mirror identity before creating pages.
Do not copy host Notion credentials or MCP configuration into isolated workers.

- Mirror the full substantive document, not just an abstract or GitHub link. Adapt Markdown tables,
  links and diagrams to Notion without dropping requirements, caveats or evidence. For large files,
  split into clearly ordered child pages and verify every part. For non-renderable supporting artifacts,
  include a source link and description in the owning document; upload only within the authorized scope.
- Identify a mirror by repository + repository-relative path + source branch. Search only within this
  hub, then fetch and check the metadata before updating. Use branch-specific mirrors so a proposal
  cannot overwrite a different branch's accepted documentation. Multiple matches require resolving
  identity before writing; never choose solely by similar title.
- Put the mirrored content in an explicitly labeled `Repository mirror` section and keep human notes
  in a separate `Notion notes` section. On updates, replace only the managed content and source metadata.
  Preserve human notes, comments, child pages and unrelated blocks. If the managed content differs from
  the last recorded source hash, inspect the divergence and preserve unique Notion edits; ask only when
  there is a real unresolved conflict. Do not mark a divergent mirror as synchronized.
- Keep filenames and repository paths in code formatting unless they have a verified source link;
  Notion can otherwise turn names such as AGENTS.md into unintended web links.
- Convert relative source and asset links to valid GitHub URLs at the recorded revision. Prefer a
  pushed immutable commit permalink. If content is uncommitted or not remotely available, label it a
  draft/unpublished snapshot, include the actual base ref and content hash, and never imply a remote
  permalink contains that draft. Refresh metadata after the source is committed and pushed.
- Retry an ambiguous create only after searching/readback establishes whether it succeeded. This
  avoids duplicate pages after timeouts. Do not delete or move historical pages as part of syncing.
- Read back every created/updated page and compare the body and metadata to the intended publication.
  Verify destination, completeness, source revision, status, links and preservation of existing notes.
  Only then report it as mirrored. Use bounded retries for transient failures, reconciling an uncertain
  write first. If tools are unavailable or access fails, retain the repository work
  and explicitly list each pending document and reason. Never claim Notion publication succeeded.

## Close out

Follow the repository's applicable documentation validation and publication checks. Report repository
paths and revisions, corresponding Notion links, and any pending or failed mirrors. Documentation
completion requires both outputs; distinguish completed repository work from blocked Notion work.
Mirroring does not approve a plan, authorize implementation, close Beads tasks, or establish that
planned tests passed. Do not trigger deployment or bulk historical migration from this skill.

This is an agent instruction workflow, not a filesystem watcher or background synchronization service.
