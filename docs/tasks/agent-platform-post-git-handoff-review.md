# Refresh post-Git handoff and recommend the next local MVP priority

**Beads issue:** `agent-platform-post-git-handoff-review`

## Summary and authority

Owner requested on 15 October 2026 that `session.md` reflect completed Git delivery, then asked for
a live Beads review and a recommendation that adds the most value to the local MVP. This is a
housekeeping and recommendation task. It does not approve next-feature planning implementation,
protected staging promotion, distribution, paid calls or paused orchestration resumption.

## Requirements

- Record actual PR330 staging commit/tree, qualified checks/reviews/diagnostics, delivered-branch
  cleanup, recovery tags, task closure/sync and limitations from verified receipts.
- Preserve the complete previous session body unchanged and keep main, PR283, paused branches and
  all unrelated dirty work intact. New temporary documentation branches remain explicitly distinct.
- Read live Beads statuses/dependencies and relevant staging code before recommending the next task.
  Distinguish a stale record from a new defect and a recommendation from an approved work schedule.
- Keep a working single-user local MVP as the priority; distribution architecture is phase two.
- Publish both complete changed documents with revision/hash/destination readbacks and preserve human
  Notion notes and historical branch mirrors. Do not replace Beads with a second Markdown backlog.

## Implementation plan and dependency order

Completed upstream: `agent-platform-git-delivery-verification`, protected PR330 at `cf5f0452`.
No new downstream feature is claimed or scheduled. Existing Stop/recovery dependency edges stay intact.

Use feature/local-mvp-handoff-review from qualified staging, then task/post-git-handoff-review.
Only this specification and session.md change. Commit/push scoped docs with normal hooks and open the
segment-tip PR into the feature. A later protected staging promotion needs its applicable owner grant
and actual new-head checks/reviews; this task does not inherit PR330's completed merge authorization.

The current recommendation is acknowledged Stop for Project Chat, followed by keyless Ollama
selection and focused read-only PR review. The session records source evidence and scope limits.
Before implementing the recommendation, use the planning skill to refresh its existing task/contract
and obtain independent critique and owner agreement. Do not begin it as a side effect of this review.

## Tests and verification

Documentation-only: validate direct Markdown lint, formatting, relative links, exact previous-session
suffix, actual PR330/source/cleanup receipts, and full normalized Notion body/metadata readbacks.
No new application tests are required or claimed. Preserve prior actual product test results as
historical evidence; no CI status or critic approval is manufactured for this documentation change.
Read back Beads updates and await successful Dolt push before claiming synchronization.

## Definition of done and sign-off

Local documentation work is complete after scoped commit/push, validation, complete mirrors and
recommendation evidence. Segment integration remains pending until its PR is merged under an
applicable owner grant with all actual hosted checks/reviews clear. Do not close a segment-tip task
before that integration gate. Keep any outstanding publication or integration state explicit.
Owner has authorized the documentation/recommendation work; next-feature implementation is pending.
