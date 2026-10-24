# Task: Point reusable-skill guidance at the shared ~/.agents/skills location

**Beads issue:** `agent-platform-user-skills-location`  
**Spec file:** `docs/tasks/agent-platform-user-skills-location.md` (this file)  
**Parent epic:** none — standalone developer-guidance task

The Beads issue **description** begins with: `Spec: docs/tasks/agent-platform-user-skills-location.md`

## Task requirements

`.agents/skills/README.md` and `docs/agent-instructions-shared.md` tell agents to create new
reusable skills in `$CODEX_HOME/skills` (default `~/.codex/skills`). The current
[Codex skills guide](https://learn.chatgpt.com/docs/build-skills) lists `$HOME/.agents/skills` as
the user skill location, and the owner's shared, version-controlled skills live there. Update both
lines to `~/.agents/skills`. Dated evidence, audits and planning records that name
`~/.codex/skills` describe their own point in time and stay unchanged.

## Dependency order

### Upstream — must be complete before this task

None.

### Downstream — waiting on this task

None.

### Planning notes

No Beads dependency edges are needed.

## Implementation plan

1. Replace the destination wording in the two live guidance lines; keep project-specific skills in
   `.agents/skills/` as before.
2. Deliver in the current bounded batch, `task/husky-secret-scan` → protected `staging` (PR381),
   since both changes concern the owner's shared `~/.agents` tooling.

## Tests (required before sign-off)

- **Search:** `git grep` finds no live guidance naming `~/.codex/skills` or `$CODEX_HOME/skills` as
  the skill destination.
- **Format and links:** lint-staged formatting passes on commit; the new link resolves.
- **Unit / build / Playwright:** not applicable; documentation only, and pre-push reports no
  affected packages.
- **Hosted:** the PR's required GitHub Actions checks and SonarQube quality gate.

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] Search and formatting checks above pass.
- [ ] Batch PR into `staging` has all required exact-head checks passing and comments resolved.
- [ ] PR merged with owner destination authority.

## Pre-close sign-off

- [x] Work committed on the batch task branch cut from actual `staging`
- [x] Search and formatting checks executed and passing
- [ ] PR merged into `staging` (link: <https://github.com/jwill9999/agent-platform/pull/381>)
- [x] `decisions.md` unchanged — no architectural decision changed
- [x] `session.md` updated for handoff

## Post-close verification

- [ ] Close reason recorded in Beads
- [ ] Beads issue re-read as `closed`

**Reviewer / owner:** _pending_ **Date:** _pending_
