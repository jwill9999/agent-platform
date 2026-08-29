# Task: Add Project activity side panel

**Beads issue:** `agent-platform-project-experience.8`  
**Spec file:** `docs/tasks/agent-platform-project-experience.8.md`  
**Parent epic:** `agent-platform-project-experience` — Project experience and navigation

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.8.md`

## Summary

Add a right-side Project activity/evidence panel that shows what changed, what was generated, what
checks are running or complete, and what needs review. It should reuse the clickable artifact,
file-review, preview, and diff cards from task `.7`, and act as the persistent evidence surface
beside Project Chat without expanding the built-in IDE.

## Requirements

- The panel is available from Project Chat and follows the active Project/session.
- The panel can show profile-aware activity where available:
  - changed files,
  - generated files,
  - preview cards for generated HTML/app, Markdown/document, PDF, screenshots, or other artifacts,
  - local test/check status,
  - CI status when branch feedback is available,
  - review comments and tool findings when available,
  - approval or next-action states.
- Changed/generated file and diff entries are clickable and open the shared in-app viewer while
  preserving Project, branch, session, and conversation context.
- Coding Projects should get the richest first implementation. Docs/content, research, automation,
  mixed, and unknown Projects should have explicit fallback or empty states until those profiles
  produce normalized activity.
- The panel uses user-facing labels and compact typography consistent with the existing interface.
- Raw implementation details such as `/workspace`, backend roots, host absolute paths, hashes,
  provider debug diagnostics, and internal state enums are hidden from normal copy.
- Empty, loading, unavailable, and disconnected states are explicit and safe.
- The data boundary is swappable: the panel should consume normalized activity/evidence data rather
  than hard-coding one provider.

## Dependency Order

| Task                                  | Relationship                         |
| ------------------------------------- | ------------------------------------ |
| `agent-platform-project-experience.3` | upstream dependency of this task     |
| `agent-platform-project-experience.6` | downstream task blocked by this task |

Keep Beads dependencies aligned with this table.

## Parallel Worktree Notes

This task can run in parallel with generated preview rendering if it owns panel composition, layout,
and activity summaries. It should consume preview card components from
`agent-platform-project-experience.7` once available rather than duplicating rendering logic.

## Implementation Plan

1. Review current right-side assistant/workbench panels, Git/GitHub panel, branch summary, artifact
   previews, approval surfaces, and check/status surfaces.
2. Define a normalized Project activity data shape for changed files, generated files, previews,
   file reviews, diffs, checks, CI, review comments, findings, approvals, and next actions.
3. Implement panel composition and compact states for empty/loading/unavailable/disconnected data.
4. Wire available existing data sources first, especially coding Project Git/check/generated-output
   evidence, with placeholders only where future provider work is explicitly tracked.
5. Add tests for status grouping, copy, unavailable states, and implementation-detail hiding.
6. Add Electron/Playwright coverage for visible panel states in Project Chat.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`.
- Focused renderer tests for panel grouping, labels, empty/loading/unavailable states, and hidden
  implementation details.
- Electron/Playwright: open a Project, trigger or seed changed/generated file activity, verify the
  right-side panel shows the expected user-facing activity.
- Verify the panel remains usable when CI/review/provider data is unavailable.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Gherkin E2E Strategy

```gherkin
Feature: Review Project activity and evidence beside Project Chat

  Background:
    Given the app is running with isolated test data
    And an active coding Project session has normalized activity evidence

  Scenario: Review rich coding evidence
    When the user opens the Project activity panel
    Then changed and generated files, checks, and available review states are grouped clearly
    And choosing a file or diff opens it in the shared viewer without losing Project context

  Scenario: Handle unavailable providers safely
    Given CI or review-provider data is unavailable
    When the user opens the activity panel
    Then an explicit user-facing unavailable state is shown
    And no backend root, host path, internal enum, or provider diagnostic is exposed

  Scenario: Isolate evidence across Project sessions
    Given the current Project has visible activity
    When the user switches to another Project session with no activity
    Then the previous Project's evidence is absent
    And the new session shows its own empty state
```

## Definition Of Done

- [ ] Project Chat has a right-side Project activity/evidence panel.
- [ ] Panel shows changed/generated files and preview entries when available.
- [ ] Changed/generated files and diffs are clickable and open the shared in-app viewer.
- [ ] Panel shows local checks, CI, review comments, findings, and approval states when available.
- [ ] Panel handles empty/loading/unavailable/disconnected states without leaking implementation
      details.
- [ ] Panel consumes a normalized/swappable activity boundary rather than hard-coding one provider.
- [ ] Coding Project evidence is implemented first, with clear fallback states for other profiles.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
- [ ] Playwright and production-rendered Electron coverage prove panel grouping, shared preview
      opening, context preservation, provider fallbacks, and Project/session isolation.
- [ ] Playwright tests cover the Gherkin scenarios through accessible panel and resource controls.
