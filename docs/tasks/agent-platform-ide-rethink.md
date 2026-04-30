# agent-platform-ide-rethink - Reassess code viewing/editing experience

## Summary

Reassess whether the platform should maintain a bespoke browser-based IDE/file tree, embed an existing editor experience, or lean on agent-visible repository tools plus external developer tooling.

## Context

Manual testing on `task/agent-platform-code-tools.5` showed the current browser File System Access API folder-open/restore flow is brittle and can block unrelated chat/manual validation. The folder-tree UX should be paused until the product direction is clearer.

## Requirements

- Evaluate options for code visibility and manual review:
  - keep and harden the current browser IDE,
  - integrate a proven editor/file-browser component,
  - use repository map/search/read tools plus external IDE workflows,
  - defer full IDE behavior until the agent coding tool pack is more mature.
- Document browser permission, security, and persistence tradeoffs.
- Recommend one path with implementation scope and risks.
- Do not block chat, model config, or coding tool execution on this UX.

## Definition of Done

- A short decision note or ADR recommends the code viewing/editing direction.
- Follow-up implementation tasks are created only for the selected path.
- Existing chat and coding tool flows remain unaffected.
