# Task: preview major dependency upgrades

Beads: `agent-platform-dependency-upgrade-preview` (P1, planning only).
Parent: [dependency security](agent-platform-dependency-security.md).
[Plan](../planning/dependency-upgrade-preview.md), [verification](../testing/dependency-upgrade-preview.md),
[review](../reviews/dependency-upgrade-preview.md).

## Requirements

UP-R1–4 in the plan: reconcile exact delivered/proposed versions; official support and compatibility
risk; separable effort/source/test/rollback slices; independent critique and owner decision brief.
Owner authorized the preview on19October, not major implementations or dependency merges.

## Dependency order

No hard prerequisite blocks parallel read-only planning. The in-progress SDK historical-profile
repair remains the current application delivery. Finish its qualified owner-app preparation before
switching runtime implementation priorities. Parent security retains all known advisory ownership.
No new dependency edge delays the migration repair or resumes deferred framework/orchestration work.

## Bounded work

Inspect protected staging and actual PRs, verify primary sources, map affected code/data/runner paths,
rank support/security urgency and alternatives, estimate effort with uncertainty, define useful
regressions and obtain distinct critique. Publish repository documents and canonical Beads readback
without external copies. Branch: task/dependency-upgrade-preview, started from exact stagingbe153 and
rebased on 26 October onto staging `d59e392c`; PR373 targets staging directly. Separate from migration
source. No package installs/lock changes/test probes.

## Verification and completion

Read-only source/advisory reconciliation plus Markdown/format/relative-link/manifest checks apply.
Product runtime/browser/Electron tests are planned per future slice, not fabricated preview results.
Complete the planning phase only with reviewed brief, correct Beads links, documented owner choices,
scoped documents pushed and the declared document-delivery state accurately recorded. No planning
result grants implementation/merge or closes the parent's residual vulnerability debt. Keep failed
or unverified facts explicit and retain dirty/in-use/paused work.

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied (UP-R1–4).
- [ ] Every **pre-close** checkbox below is complete before the Beads close transition.
- [x] No **upstream** Beads issue blocks this planning task.
- [ ] Markdown, formatting and relative-link checks pass on the five documents.
- [ ] Unit/integration/E2E tests: **N/A** — planning only; no product code, package or lock change.
- [ ] **Git:** PR373 into protected staging has passing exact-head checks and resolved review threads,
      and is merged with owner destination authority.
- [ ] This spec updated if scope or dependencies change.

## Pre-close sign-off

- [x] Task branch created from the correct parent (stagingbe153) before the planning work; rebased
      onto staging `d59e392c` on 26 October
- [ ] Product tests: **N/A** — planning only; document checks above are the gate
- [ ] Definition of done and pre-close checklists are complete
- [ ] PR merged **task/dependency-upgrade-preview → protected staging** (link:
      <https://github.com/jwill9999/agent-platform/pull/373>)
- [x] `decisions.md` unchanged — no architectural decision changed
- [x] `session.md` updated for handoff

## Post-close verification

- [ ] Close reason recorded in Beads
- [ ] Beads issue re-read as `closed`; parent `agent-platform-dependency-security` readiness reconciled

**Reviewer / owner:** _pending_ **Date:** _pending_
