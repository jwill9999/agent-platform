# Plugin Authoring Guide

> **Status:** This is a placeholder. The full plugin authoring guide is tracked as [agent-platform-vla](./tasks/agent-platform-vla.md).

## Overview

Agent Platform uses a plugin system with seven lifecycle hooks. Plugins can observe and augment the agent execution pipeline without modifying core behavior.

## Available Hooks

| Hook             | When             | Use Case                  |
| ---------------- | ---------------- | ------------------------- |
| `onSessionStart` | Session created  | Initialize plugin state   |
| `onTaskStart`    | Task begins      | Set up task context       |
| `onPromptBuild`  | Prompt assembled | Inject system context     |
| `onToolCall`     | Tool invoked     | Log or audit tool usage   |
| `onTaskEnd`      | Task completes   | Clean up, record metrics  |
| `onDodCheck`     | DoD evaluated    | Override or veto success  |
| `onError`        | Error occurs     | Error reporting, alerting |

## Existing Plugins

| Plugin               | Package                         | Purpose                      |
| -------------------- | ------------------------------- | ---------------------------- |
| Session plugin       | `packages/plugin-session`       | Session lifecycle management |
| Observability plugin | `packages/plugin-observability` | Logging and tracing          |

The built-in API runtime wires `plugin-observability` as a global plugin. It records session/task/prompt/tool/error events into an in-memory store, and the native zero-risk tools `query_logs`, `query_recent_errors`, and `inspect_trace` read from that same store for the current session only.

`packages/plugin-observability/src/store.ts` exposes the read API used by those tools:

- `getLogs({ sessionId, level?, since?, limit? })`
- `getErrors({ sessionId, since?, limit? })`
- `getTrace({ sessionId, traceId? })`

All store queries require `sessionId`. The API binds that value from the active session at tool-executor construction time, so plugin-backed observability reads stay scope-jailed even though the tools are exposed to the model.

## Quick Example

```typescript
import type { PluginHooks } from '@agent-platform/plugin-sdk';

const myPlugin: PluginHooks = {
  onSessionStart: async (ctx) => {
    console.log('Session started:', ctx.sessionId);
  },
  onToolCall: async (ctx) => {
    console.log('Tool called:', ctx.toolId);
  },
  onDodCheck: async (ctx) => {
    return {
      ...ctx.contract,
      passed: ctx.contract.failedCriteria.length === 0,
    };
  },
};
```

## Further Reading

- Plugin SDK source: `packages/plugin-sdk/`
- Hook types: `packages/plugin-sdk/src/hooks.ts`
- Context types: `packages/plugin-sdk/src/contexts.ts`
- Full guide: Coming with [agent-platform-vla](./tasks/agent-platform-vla.md)
