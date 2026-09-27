# Repository Notion documentation publishing skill

## Summary and requirements

Install the owner's draft as `.agents/skills/agent-platform-documentation/SKILL.md`, with its destination
reference and UI metadata. Link it from the existing documentation skill, skill index, folder guide
and shared instructions. Cover every substantive document changed during an authorized task while
preserving explicit local-only requests, read-only roles and managed-run publishing controls.

Repository files remain canonical; Beads tracks task status. Notion mirrors must contain the complete
substantive text, source path/branch/revision/hash, and separate human notes. Verify existing mirror
identity and divergence before updates, preserve notes and children, reconcile ambiguous writes before
retrying, and read back publication. Missing tools leave a reported pending mirror. No runtime adapter,
background watcher, bulk migration or new worker permission is implemented by this task.

## Implementation and dependency order

Adapt the provided draft and existing personal reference into portable repository resources. Connect
the existing workflow without recursive invocation. Validate skills, Markdown and local references;
publish this task's changed documents through the skill and verify readback. No upstream runtime
dependency applies to the documentation change. Beads owns any later runtime work and sequencing.

## Verification and definition of done

Skill-file validators pass for the new and linked skills. Markdown and local links pass. Inspect
behavior for new mirrors, updates with human notes, ambiguous creates, unavailable tools and managed
runs without publishing authority. Exercise actual Notion create/update/readback on the changed
documents; do not equate static validation with autonomous orchestration proof. Commit and push the
repository changes and retain Notion URLs in Beads. PR276 integration remains an owner decision.

## Sign-off boundary

Owner authorized skill creation and workflow linkage in chat. Work is documentation-only on
`task/development-lifecycle-plan`, targeting `feature/harness-backlog-review`. No merge or runtime
permission change. Publication and validation results are recorded in Beads.
