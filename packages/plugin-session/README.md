# `@agent-platform/plugin-session`

Session-scoped memory plugin and **plugin resolution** (global → user → agent allow/deny).

## Session reset

`SessionMemoryStore` is an in-memory map. When a session ends or the user starts a new chat session, the host should:

1. Drop the store instance, or
2. Call `store.clear()`, or
3. Use `createSessionMemoryPlugin({ store, clearOnSessionStart: true })` so the next `onSessionStart` clears prior task keys.

Plugins are observers; they cannot bypass validation (see `@agent-platform/plugin-sdk`).

## Resolution order

1. Concatenate `global` registered plugins, then `user` (order preserved within each list).
2. Remove any plugin whose `id` is in `agent.pluginDenylist`.
3. If `agent.pluginAllowlist` is a **non-empty** array, keep only plugins whose `id` is listed.
4. If `pluginAllowlist` is `null` or `undefined`, **allowlist filtering is not applied** (denylist still applies).
5. If `pluginAllowlist` is `[]`, **no** plugins are allowed.
6. Pass the resulting `PluginHooks[]` to `createPluginDispatcher` from `@agent-platform/plugin-sdk`.
