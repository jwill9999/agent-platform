# Plugin Authoring Guide

> **Status:** This is a placeholder. The full plugin authoring guide is tracked as [agent-platform-vla](./tasks/agent-platform-vla.md).

## Overview

Agent Platform uses a plugin system with six lifecycle hooks. Plugins can observe and augment the agent execution pipeline without modifying core behavior.

## Available Hooks

| Hook             | When             | Use Case                  |
| ---------------- | ---------------- | ------------------------- |
| `onSessionStart` | Session created  | Initialize plugin state   |
| `onTaskStart`    | Task begins      | Set up task context       |
| `onPromptBuild`  | Prompt assembled | Inject system context     |
| `onToolCall`     | Tool invoked     | Log or audit tool usage   |
| `onTaskEnd`      | Task completes   | Clean up, record metrics  |
| `onError`        | Error occurs     | Error reporting, alerting |

## Existing Plugins

| Plugin               | Package                         | Purpose                      |
| -------------------- | ------------------------------- | ---------------------------- |
| Session plugin       | `packages/plugin-session`       | Session lifecycle management |
| Observability plugin | `packages/plugin-observability` | Logging and tracing          |

## Quick Example

```typescript
import type { PluginHooks } from '@agent-platform/plugin-sdk';

const myPlugin: PluginHooks = {
  onSessionStart: async (ctx) => {
    console.log('Session started:', ctx.sessionId);
  },
  onToolCall: async (ctx) => {
    console.log('Tool called:', ctx.toolName);
  },
};
```

## Further Reading

- Plugin SDK source: `packages/plugin-sdk/`
- Hook types: `packages/plugin-sdk/src/hooks.ts`
- Context types: `packages/plugin-sdk/src/contexts.ts`
- Full guide: Coming with [agent-platform-vla](./tasks/agent-platform-vla.md)
