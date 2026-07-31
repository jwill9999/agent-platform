# Task: Clean Project labels and location context

**Beads issue:** `agent-platform-project-experience.5`  
**Spec file:** `docs/tasks/agent-platform-project-experience.5.md`

## Summary

Audit remaining Project/Chat labels after Electron stabilisation and remove implementation-oriented
copy from primary UI. Add quiet breadcrumbs or equivalent location context only where current
navigation is still ambiguous.

## Re-baseline Audit (2026-07-17)

The task remains relevant, but most of its original surface area was completed by Project
Experience `.2` through `.4`:

- Workspaces and sidebar copy now separates Chat from Coding Projects without backend terminology.
- Recent Projects use folder names by default and show a shortened path only to disambiguate
  duplicate folder names.
- Project Chat is the default Project surface and already has regression coverage for `/workspace`
  and backend-root leakage.
- Project Chat includes Project name, profile/capability summary, branch selection, terminal access,
  and local IDE handoff.

The remaining verified gaps are:

- the Project header shows an always-visible folder path and a decorative `Project / Chat` label
  beside a separate Workspaces action instead of one quiet navigable location affordance;
- command-runner mode/status and raw readiness messages can surface runtime terminology;
- the terminal dock renders its absolute initial `cwd`, exposing the host Project root.

This task is narrowed to those gaps. Settings diagnostics and internal implementation identifiers
remain out of scope unless they leak into a primary Project or Chat surface.

## Requirements

- Hide `/workspace`, backend accessibility, backend root, and repository root from normal UI.
- Show Project name, relevant folder/relative path, profile/status, onboarding state, and branch only
  where useful.
- Add quiet breadcrumbs or equivalent navigation for Workspaces, Personal Chat, Project Chat, and
  any secondary surface only where they solve a real ambiguity.
- Breadcrumbs/location affordances should not create oversized headings or scattered CTAs.
- Sidebar and breadcrumbs should use existing font scale, with most navigation rows around 14px.

## Implementation Plan

1. Replace the Project header's decorative location label and duplicate action with a compact,
   navigable Workspaces / Project / Chat breadcrumb.
2. Keep the active Project name and useful profile/capability context, but remove its always-visible
   folder path.
3. Translate command-runner readiness into user-facing command availability without raw runtime
   modes, reasons, or messages.
4. Replace the terminal dock's absolute initial `cwd` with `Project root`.
5. Extend unit and Playwright/Electron coverage for labels, navigation, and path leakage.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.4` | `agent-platform-project-experience.6` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Component tests for breadcrumb labels and Project status copy.
- Playwright: verify Project and secondary surfaces do not expose `/workspace` or backend
  accessibility in primary UI and verify breadcrumbs navigate back as expected.
- Electron visual regression baselines for the Project controls and terminal controls, using
  deterministic content, animations and caret rendering disabled, and a 1% maximum pixel-difference
  ratio for cross-platform font rendering.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

### Playwright Scenario

```gherkin
Feature: Project location context without runtime path leakage

  Scenario: Navigate from Project Chat without exposing host paths
    Given a desktop Project is open in Project Chat
    Then the Project header shows a Workspaces / Project / Chat breadcrumb
    And the header shows the Project name without its host folder path
    When the Project terminal is opened
    Then the terminal location is shown as Project root
    And the application chrome does not show /workspace, the backend root, or the host Project root
    And the Project and terminal controls match their approved visual baselines
    When the user selects Workspaces in the breadcrumb
    Then the workspace chooser is visible
```

## Definition Of Done

- [ ] Primary UI no longer exposes `/workspace` or backend accessibility.
- [ ] Project and secondary-surface labels show user-relevant Project/folder context.
- [ ] Breadcrumbs or equivalent quiet location context exists where current navigation is ambiguous.
- [ ] Font sizing matches existing compact navigation scale.
- [ ] Project and terminal control visual-regression baselines pass in Electron E2E.
