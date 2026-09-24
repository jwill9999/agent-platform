# Task: Bind detailed planning artifacts to execution approval

**Beads:** `agent-platform-pilot-zero.16`

## Requirements

Independent review found that contract material hashes do not include linked specification and test
plan contents. Define a content-addressed handoff manifest, bind it to approval, and verify unchanged
artifacts at publication and implementation handoff. Links alone are insufficient.

## Plan and scope

Assess contracts.ts, planning.ts, evidence storage and handoff validation. Propose a compatible schema
and enforcement design, migration handling and permitted publisher behavior before implementation.
This issue records a discovered blocker; it does not authorize a broad schema/runtime migration.

## Dependencies

Blocks the exact first-pilot plan (pilot-zero.13) from claiming an enforced approved-document handoff.
Related to skill review pilot-zero.9 and qualification pilot-zero.12. Beads edges are authoritative.

## Tests and definition of done

Unchanged document sets preserve approval; changed specs or test plans invalidate it even if paths and
task titles are unchanged. Missing/tampered artifacts block execution. Tests cover publication and
resume. Independent critique and owner approval of material design, implementation checks and required
feature integration must pass before closure.

## Sign-off

Discovered by isolated reviewer; backlog/spec creation only. Runtime implementation remains unapproved.
