---
name: documentation
description: Locate, draft or maintain Agent Platform plans, task specifications, designs, verification material and reviews using the repository documentation map and linked Beads records.
---

# Documentation

Use when preparing planning/implementation handoffs, publishing documentation, or deciding where
project knowledge belongs. This skill supplies locations and consistency checks, not write authority.

1. Read the [documentation guide](../../../docs/README.md) and applicable existing documents. Use its
   folder map and authority rules; do not create a second backlog, relocate historical files or
   duplicate a canonical specification.
2. For task material follow [task rules](../../../docs/tasks/README.md) and the
   [task template](../../../docs/tasks/_template.md). Link the real Beads ID, parent feature, acceptance
   criteria and dependency edges. Use drafts with explicit unresolved IDs until publication resolves them.
3. For a feature, maintain a manifest linking task specs, required designs/ADRs, verification plan,
   review/findings and actual owner authorization; execution contracts only for explicit prototype runs. Distinguish current behavior, proposals,
   planned tests and actual results. Do not manufacture reviews, approvals, tests or content hashes.
4. Follow [feature planning](../feature-planning/SKILL.md) for required planning and test content,
   [plan critique](../plan-critique/SKILL.md) for independent review, and
   [feature implementation](../feature-implementation/SKILL.md) for the approved execution handoff.
   Ask the human about unresolved ambiguity before final agreement; reuse recorded decisions.
5. Preserve role permissions: a read-only planner/critic returns material and intended paths; an
   authorized coordinator saves repository records using permitted native tools. Task approval,
   tool access or skill invocation does not authorize external publication. Require an explicit
   owner request covering the external destination and documents, including when a home-installed
   skill or older plan is used. Only operations owned by an explicitly selected prototype run use
   its journaled broker; that route does not expand publication authority.
6. Maintain repository documentation as the source of truth. Routine changes do not require Notion
   copies or publication payload/readback files. Earlier repository or home-skill mirror requirements
   are historical, not standing authorization; do not reinstall the removed publisher to follow them.
   New reusable skills belong in the owner's Codex home skills directory, not this repository,
   unless the owner explicitly requests a different destination.
7. Validate Markdown, relative links, manifest completeness and Beads links/dependencies. Read back
   external content only when its publication was explicitly requested. Keep requirement/scenario
   identifiers consistent. Report missing artifacts and required verification gaps explicitly instead
   of marking the handoff complete.

For documentation-only changes validate the artifacts; do not invent application test results.
When application work is involved, preserve the defined connected frontend/backend verification and
feature integration gates. Record actual outcomes in the linked result report before sign-off.
