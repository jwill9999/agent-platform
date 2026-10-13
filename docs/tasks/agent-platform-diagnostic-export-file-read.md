# Task: Wait for complete diagnostic JSON in the packaged VM test fixture

**Beads issue:** `agent-platform-diagnostic-export-file-read`  
**Spec file:** `docs/tasks/agent-platform-diagnostic-export-file-read.md`  
**Parent epic:** none; discovered during [disappearing replies](agent-platform-sizx.md).

## Requirements and evidence

This follow-up is now selected as a bounded CI repair for the owner-authorized disappearing-reply
staging promotion. PR315 at `f5fdb464` repeated the incomplete JSON read in the provider-HTTP reject
journey: desktop job `115490472672` reported 54 passes and one flaky case. The green badge does not
qualify the agreed clean desktop gate. Independent critique CR-Q06 requires a bounded complete-read
correction at both waiting and finished export reads. PR314's initial
`5f09ac45` desktop run38413511300 first failed the existing provider-HTTP transient-retry journey
with `Unexpected end of JSON input`, then passed its normal retry. The read at
`apps/desktop/e2e/packaged-vm-command.e2e.ts` waits for `waiting-diagnostics.json` to exist before
immediately parsing it. Existence does not establish complete asynchronous writing. That mechanism
is plausible, but the original incident's exact cause is not established.

Retained evidence: `/Users/letuscode/.codex/chat-reply-implementation-20261013/pr314-5f09-failed.log`.
Preserve the original failure and successful retry. Do not infer a provider-retry behavior failure,
change production export policy, remove diagnostic assertions or raise timeouts from this sample.

## Dependency and implementation plan

Beads records a `discovered-from` link to `agent-platform-sizx`, not a blocking dependency or new
parent. Staging delivery is held pending this concrete test repair; no new dependency cycle is added.
The native exporter already awaits its asynchronous write; production behavior stays unchanged.
Review the actual writer and reader, reproduce
created-but-incomplete JSON deterministically, then choose a bounded completion or parse-ready
handshake. Missing and permanently invalid data must still fail; a successful read must retain the
existing scope, waiting-event and privacy assertions. Keep this a fixture-reliability change unless
new evidence justifies a separately reviewed product defect.

## Git workflow

The existing `feature/chat-reply-reliability` integration branch contains the reviewed reply repair.
`task/chat-reply-export-read` starts at its actual `f5fdb464` tip. Deliver this bounded correction through
a task-to-feature PR, then requalify protected staging PR315 on its resulting head. The owner has
authorized routine CI repairs and both conditional merges; every actual current-head check and review
remains required. Keep main and paused orchestration separate.

## Gherkin E2E strategy

```gherkin
Feature: Inspect complete local diagnostic reports during Project approval
  Background:
    Given an isolated packaged desktop fixture with a deterministic HTTP model provider
    And the actual API, SQLite and native diagnostic export path are running
  Scenario: Inspect a report while approval is waiting
    When the user exports the pending approval report
    Then the fixture reads complete JSON within the existing deadline
    And the report identifies the actual session and waiting approval
  Scenario: Approve or reject and inspect the completed report
    When the user approves or rejects the pending action
    And exports the completed report
    Then the report agrees with the durable approval and actual file effect
    And report privacy and coverage assertions pass
  Scenario: Preserve reload and transient provider recovery
    When the pending approval is reloaded or the provider recovers from a scripted transient error
    Then the original approval, replay protection and export checks pass without test retries
```

The existing save-dialog path override selects fixture-owned destinations; report collection and
parsing do not replace the real native export, provider SDK, database or UI actions. Deterministic
reader controls separately require missing/malformed files to fail within the unchanged deadline.

## Tests and definition of done

A controlled test must expose the previous incomplete-read behavior, then prove bounded successful
completion and failure on missing/permanently malformed JSON. Run affected build/typecheck/lint/format
and meaningful fixture tests. Exercise the actual Electron export-while-awaiting-approval journey,
including the existing provider HTTP transient-retry case, with unchanged timeout, report schema,
scope, privacy, waiting-state and effect assertions. Retain real report and backend evidence.

Independent source review, actual hosted checks and Sonar/Problems findings must clear. Publish and
read back the complete specification/results/session mirrors; synchronize Beads. Closure requires
verified implementation and authorized feature integration, not this recorded hypothesis or a single
successful retry. Record actual evidence and source/delivery revisions, then read back closed status
and confirm Dolt synchronization. Current status is in progress. Actual results and independent review are recorded in
[the reply verification record](../reviews/chat-reply-reliability.md); planned checks are not passes.
