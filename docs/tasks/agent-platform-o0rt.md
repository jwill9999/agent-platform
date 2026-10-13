# Refresh post-V1 handoff and recommend the next priority

**Beads issue:** `agent-platform-o0rt`  
**Status:** Documentation delivery in progress; no product implementation selected.

## Requirements

Update `session.md` against merged PR303/307 and live Beads, preserve the previous handoff body,
state remaining release/QA work and paused-work boundaries, and recommend the highest-value next
bounded task for owner discussion. Keep task state in Beads; do not create another backlog or
change existing priorities/dependencies as part of this review.

## Dependency order

No new blocking edges. Prerequisite delivery evidence is closed V1 and diagnostic-review-checkpoints,
verified in Beads and staging. This standalone documentation ticket has no parent epic.

## Implementation and delivery

Use `feature/post-v1-handoff` from staging `d199ad01`, then `task/post-v1-handoff`.
Publish the current handoff and this specification through one task-to-feature PR. Preserve all
paused/dirty/unrelated work. Product-task selection and staging promotion are not implied by this
recommendation. A future selected task needs its current source, acceptance and dependencies reviewed.

## Tests and verification

- Read live PR merge status, Beads statuses/dependencies and relevant current context-building source.
- Verify the entire original `session.md` body remains byte-identical as historical material.
- Validate changed Markdown, formatting, relative references and diff whitespace.
- Publish both complete source-bound Notion mirrors and verify their bodies and metadata.
- Run normal Git hooks and inspect exact-head hosted documentation/quality checks and review comments.
- No runtime code changes: new application tests and V1 diagnostic collection are not applicable.

## Definition of done

The current handoff accurately distinguishes delivered, open and recommended work; history and paused
work are preserved; local checks, scoped commit/push and full mirrors/readbacks pass. As a segment-tip
task, Beads closure additionally requires successful hosted gates and actual feature PR integration.
Do not report the handoff as merged into staging merely because its source has been pushed.
