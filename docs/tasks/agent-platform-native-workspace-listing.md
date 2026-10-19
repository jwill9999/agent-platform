# Native Workspace listing repair

Beads: `agent-platform-native-workspace-listing` (P1 bug, in_progress).
Owner authorized repair, regression tests, critic review and actual app preflight on19October2026.

## Requirements and scope

- NW1: With no workspace override, the managed desktop backend supplies `WORKSPACE_ROOT` as
  `workspace` under its existing data directory. API listing and harness file tools share that root;
  no UI-only workaround, `/workspace` creation, host mount or permission expansion is allowed.
- NW2: Preserve existing explicit `WORKSPACE_ROOT` and container-path fallback configuration,
  Docker defaults, Project scope, PathJail, execution policies, credentials, records and monitoring.
- NW3: A listing initialization/read failure returns a safe retryable error and emits an allowlisted
  phase/category record with existing request correlation. Never log raw errors, paths or file contents;
  observation failure must not change the HTTP result. Input validation and download denials stay intact. Unavailable area `readdir` and non-ENOENT `stat` failures reject the whole listing as read-phase503; a file disappearing with ENOENT during traversal is benign and skipped. Denied symlink/outside entries remain omitted.
- NW4: Regress the actual default managed native launch, connected browser and native UI, filesystem
  effects and restart persistence. Retain old warning evidence and explain why injected temp roots
  in prior API/VM tests missed the default native configuration.

Out of scope: provider calls, new model/SDK changes, broad workspace redesign, paused orchestration,
main promotion, global services, Docker gateway activation and external publication.

## Source, dependencies and destinations

Baseline protected staging `a17bc1db05deb47f4b5adbeab30d732801ab4283`. Reuse the clean detached
migration-hook-review checkout, not the running owner app checkout. Feature `feature/native-workspace-listing`,
first/final segment `task/native-workspace-listing`. No unclosed upstream blocks implementation;
owner stress review remains open and depends on this repair's actual preflight. The old warning is
linked from the existing desktop startup record; this task owns its scoped implementation.

Manifest: this spec, [verification](../testing/native-workspace-listing.md),
[results](../reviews/native-workspace-listing.md), existing [native workflow](../development/codex-development.md).
Coordinator owns source/tests/docs/Beads; independent critic inspects plan, exact source and evidence.
Read-only assignments are procedural, not technical tool isolation. No parallel source editors.

## Implementation and verification

1. Critique the bounded default-root/environment and safe failure-observation changes against source.
2. Add failing managed-default env/native regressions, implement minimal backend root configuration,
   add scoped safe failure logging and negative/API tests. Retain explicit override behavior.
3. Test real isolated Electron plus separate browser against its actual BFF/API, seed only disposable
   output bytes, verify download bytes and denied outside/symlink effects independently; normal restart
   preserves files. No model call is required. Preserve trace/log/compact safe receipts before cleanup.
4. Run affected desktop/API unit suites, build/types/lint/format/Markdown and existing diagnostic-export
   and migration/native regressions; normal hooks retain ordinary suite and fresh benchmark limits.
   Open task→feature PR and qualify all executed/required hosted checks/comments/security findings.
5. After source qualification rebuild and normally restart the actual owner app with verified backup,
   original profile/key, no credential edits. Workspace must list without the warning; monitoring native
   export and clean restart retain samples/preferences. Source-bound readback and critic review required.

Merge authority is separate: this request authorizes implementation/app preparation and a reviewable
PR, not automatic merge of this new feature. No task closure before its declared hosted/integration
and preflight gates. Record exact source and passed/failed/blocked/unrun results, never infer completion.

## Gherkin E2E strategy

```gherkin
Feature: Native workspace files without container prerequisites
  Background:
    Given a managed desktop app with isolated profile and no workspace override
  Scenario: Empty workspace, generated output and restart
    When I open Workspace settings
    Then I see "No workspace files yet" without an unavailable warning
    When a disposable generated report is created in the app-owned workspace
    And I refresh and download that report
    Then native and browser views show the report with exact downloaded bytes
    And the report remains after a normal app restart
  Scenario: Outside files remain inaccessible
    Given an outside canary and a workspace symlink to it
    When I list or request an outside or traversal download
    Then no outside content is listed or returned
    And outside bytes remain unchanged
  Scenario: Listing fails safely without breaking adjacent settings
    Given a disposable workspace root that is a regular file
    When I open Workspace settings and refresh
    Then I see a safe unavailable message and execution policies remain available
    And logs identify a bounded phase and error category without paths or raw errors
```

## Definition of done

All NW requirements map to actual verified evidence; critic findings resolved; native/browser/negative
journeys pass without waived assertions or increased deadlines; local and hosted quality/security pass;
source committed/pushed and actual owner preflight passes. Task→feature integration requires separate
actual merge authority. Owner live-model trial and bounded stress outcome remain explicitly unperformed.
