# agent-platform-7vf — Add Playwright journey coverage for Git workflow

## Problem

This workflow is important enough that unit tests alone are not sufficient. We need visual and practical coverage that follows a user through the states.

## Requirements

- Add Playwright/Electron coverage for the guided Git workflow.
- Cover loading state, local changes, staged changes, commit completion, publish/push, PR state, checks state, and back navigation.
- Capture screenshots where useful for review.
- Verify the terminal and chat remain usable when the panel is open.
- Verify GitHub/Web Explorer fallback links are visible when applicable.

## Acceptance

- The Git workflow can be exercised end to end in automated UI tests.
- Screenshots make visual regressions easier to spot.
- Manual testing notes are documented for states that are hard to automate.
