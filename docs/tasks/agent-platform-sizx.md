# Task: Preserve visible chat replies while session history is restoring

**Beads issue:** `agent-platform-sizx`  
**Spec file:** `docs/tasks/agent-platform-sizx.md`  
**Parent epic:** none; existing standalone bug discovered during context optimisation.

## Task requirements

Implement CR-R1–CR-R5 in the [bounded plan](../planning/chat-reply-reliability.md), only after owner
agreement. Planning is currently authorized; implementation is not. The proposed behavior is a visible
history/approval loading gate, manual restoration retry and session/operation-scoped publications.
Preserve accepted final replies, refusal drafts/attachments, approval semantics and diagnostic privacy.

## Dependency order

No blocking upstream/downstream edges are required. The existing `discovered-from` relationship to
closed [context optimisation](agent-platform-context-optimisation.md) records provenance, not a
parent-child relationship or unfinished prerequisite. Keep Beads authoritative; do not reopen MCP,
context optimisation or paused orchestration. The implementer of this same bug owns CR-T08 final
integration after CR-T01–07, so no cross-task verification can be lost.

## Implementation plan

1. Reproduce the baseline history/send race using controlled delivery of real API responses, before
   applying the fix; retain a failing regression and independently inspect SQLite.
2. Correct saved-session identity at all entry points, including requested-session Project links/reopen.
   Add bounded restoration readiness and session-generation ownership; atomically initialize messages
   and approvals, guard every asynchronous update and stale parent refresh, provide manual retry.
3. Add synchronous single-operation admission and adapt both hook callers/composer so refused sends
   retain drafts/attachments. Keep existing successful send and approval behavior.
4. Execute [CR-T01–08](../testing/chat-reply-reliability.md), review V1 diagnostics at investigation
   and verification checkpoints, repair within scope and obtain independent source review.
5. Update actual results/spec/session/full mirrors and Beads; use normal quality gates and the segment
   workflow below once implementation and appropriate delivery authority have been granted.

## Git workflow (mandatory)

Actual feature `feature/chat-reply-reliability` starts at staging21191673. Actual planning branch
`task/chat-reply-reliability-plan` is the segment's first task tip. Proposed implementation branch
`task/chat-reply-reliability` chains from its pushed tip. Open one cumulative task-tip PR into the
feature after authorized implementation; feature promotion is by protected staging PR under applicable
owner merge authority. No direct main/staging push, force update, paused-code integration or cleanup
of uncertain/in-use refs. Planning publication alone does not grant implementation or merge authority.

## Tests and Gherkin E2E strategy

Use the complete [verification map](../testing/chat-reply-reliability.md), including actual hook
lifecycle, real connected browser and source-tree Electron, real API/SQLite and loopback model double.
Product tests below are planned, not executed. No checkout-free distribution test is added.

```gherkin
Feature: Reliable session restoration and final replies
  Background:
    Given an isolated app installation with saved Project conversations
    And a real API and SQLite with a deterministic local model provider

  Scenario: A saved conversation is still loading
    Given delivery of its history or pending approvals is held
    When I try Send or Enter
    Then no chat request or tool effect occurs
    And an existing draft and attachments are not discarded
    When restoration completes and I submit once
    Then the final reply remains visible and matches the persisted assistant exactly once

  Scenario: Restoration fails and can be retried
    Given history restoration fails or exceeds its deadline
    Then an explicit recoverable error and Retry history action appear
    When I retry successfully
    Then saved history and approvals are restored before sending is enabled
    And retry itself sends no chat or tool request

  Scenario: I switch conversations while prior work finishes
    Given conversation A has a delayed response
    When I open B and the old response finishes
    Then B contains only its own messages and events
    And A's old finally callback cannot unlock B's active request
    When I reopen A after its operation completes
    Then its persisted final reply appears once

  Scenario: Restored tool approval remains safe
    Given a saved conversation has a pending approval
    Then sending stays blocked after restoration
    When I approve once or reject in a separate isolated case
    Then the approved effect occurs once or the rejected effect occurs zero times
    And the resulting reply and approval status remain visible
```

## Definition of done and pre-close sign-off

Task tracking and sign-off remain in Beads, not a second Markdown backlog. This issue stays in progress
while only planning is complete. Before closing the bug, CR-R1–R5 and every required CR-T scenario
must pass on the tested revision, including baseline-fails/fix-passes evidence, exact SQLite/audit
checks and diagnostic privacy/coverage inspection. A skipped or blocked required journey blocks close.

Affected unit tests, build/typecheck/lint/format/cycles, meaningful related regressions and the repository
Sonar/Problems gate must clear. Inspect actual findings as well as check badges; no suppression or
unrelated flaky-test waiver. Independent implementation review and exact-head hosted checks/comments
must clear. The cumulative task→feature merge is the task's integration gate under owner authority;
report staging separately until its actual full security scan, packaged VM and other protections pass.
All changed full Notion mirrors need source-bound readbacks; Beads/source/notes must agree and sync.
Preserve dirty primary/paused/unrelated work and maintain a session handoff. Architecture decisions
stay unchanged unless a separately reviewed material change is needed.

## Post-close verification

Once those actual gates pass, record close reason/operation, re-read status closed, reconcile any real
downstream readiness and confirm Dolt push. No prototype broker transition is applicable. Record
actual review, accepted source and delivery SHA in [results](../reviews/chat-reply-reliability.md);
never count this plan review as source implementation approval or owner acceptance.
