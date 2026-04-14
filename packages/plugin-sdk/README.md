# `@agent-platform/plugin-sdk`

Hook contracts for first-party and third-party plugins. The host (API + harness) calls
`createPluginDispatcher` with an ordered list of `PluginHooks` implementations.

## Integration

1. Build a `PluginHooks` object (or several) with the methods you need.
2. **Order matters:** global defaults first, then user-level, then per-agent overrides
   (exact merge policy lives in `agent-platform-dx3.4`).
3. Pass the merged array to `createPluginDispatcher(chain)`.
4. Call the dispatcher methods at the appropriate lifecycle points in the host (session
   start, task start, after validation immediately before tool execution, etc.).

## Validation boundary

Plugins **cannot bypass** `Agent` tool/skill allowlists or MCP policy:

- `onToolCall` runs only **after** the host has validated the tool id (e.g.
  `isToolExecutionAllowed`).
- Hooks are **void** — they do not return alternate tool ids, arguments, or execution
  decisions.
- `PromptBuildContext.messages` is read-only; plugins must not mutate the host’s
  validation pipeline through prompt surgery.

Document any future “suggestion” APIs that append content through an explicit host
callback so validation remains centralized.
