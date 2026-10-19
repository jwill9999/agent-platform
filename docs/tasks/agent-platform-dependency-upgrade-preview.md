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
without external copies. Branches: feature/dependency-upgrade-preview → task/dependency-upgrade-preview,
from exact stagingbe153, separate from migration source. No package installs/lock changes/test probes.

## Verification and completion

Read-only source/advisory reconciliation plus Markdown/format/relative-link/manifest checks apply.
Product runtime/browser/Electron tests are planned per future slice, not fabricated preview results.
Complete the planning phase only with reviewed brief, correct Beads links, documented owner choices,
scoped documents pushed and the declared document-delivery state accurately recorded. No planning
result grants implementation/merge or closes the parent's residual vulnerability debt. Keep failed
or unverified facts explicit and retain dirty/in-use/paused work.
