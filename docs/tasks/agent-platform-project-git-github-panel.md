# agent-platform-za3 - Add Project Git and GitHub panel shell

## Summary

Add a Project Chat operational side panel that groups local Git state and future GitHub state outside the chat transcript.

## Requirements

- Show a collapsible `Git & GitHub` right-side panel in Project Chat.
- Use only real local Git data for the first implementation.
- Display repository, branch, ahead/behind, working tree counts, and recent commit.
- Show precise empty/unavailable states for PRs and checks until GitHub sensors are connected.
- Avoid showing Git/GitHub data for personal chat.

## Implementation Plan

- Add shared contracts for a Project local Git status summary.
- Add an API endpoint backed by local Git commands.
- Add a Project Chat panel component with `Overview`, `Changes`, `Commits`, `PRs`, and `Checks` tabs.
- Wire the panel to the existing Project Git refresh key so terminal-side changes update the panel.
- Cover local Git status and Electron panel rendering in tests.

## Definition of Done

- Git-backed Projects show accurate local Git status.
- Non-Git Projects show a clear no-Git state.
- PR/check sections explicitly state that GitHub sensors are not connected yet.
