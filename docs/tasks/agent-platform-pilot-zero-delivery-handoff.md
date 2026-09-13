# Pilot-zero documentation and staging delivery

## Requirements

Reconcile session and task evidence with merged PR259–262 without application changes or claiming
autonomous acceptance. Publish documentation through feature, then deliver to staging after required
checks and reviews pass. Keep main unchanged and preserve unrelated work and recovery history.

## Implementation plan

Replace obsolete handoff assertions with a verified snapshot. Record final settlement evidence and
distinguish closed children from outstanding integration. Publish task-to-feature, then
feature-to-staging PRs. Safely align local staging afterward and record final delivery in Beads.

## Dependency order

PR259–262 and children .1–.7 are already integrated and closed. This standalone delivery follows
that segment; it does not close the parent pilot or authorize new runtime implementation.

## Tests and verification

Run formatting, Markdown lint, documentation link and whitespace checks. No source or UI changes
require new unit or browser tests. Existing hosted gates still apply, including staging-specific
security and packaged macOS checks. Verify PR heads, review clearance and local/remote alignment.

## Definition of done

Accurate documentation is committed and pushed; both delivery PRs satisfy their gates and merge;
local staging matches remote without losing unrelated work; final Beads evidence is synced.
Parent orchestration acceptance remains explicitly incomplete.

## Sign-off

Owner approved conditional documentation and staging delivery on 2026-09-13. Final hosted and merge
evidence belongs in this Beads task. No production promotion is authorized.
