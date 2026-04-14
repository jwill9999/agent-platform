import type { PluginHooks } from '@agent-platform/plugin-sdk';
import type { SessionMemoryStore } from './memory.js';

export type SessionMemoryPluginOptions = Readonly<{
  store: SessionMemoryStore;
  /**
   * When true, {@link SessionMemoryStore.clear} runs at the start of each session hook
   * (same `sessionId` reuse in tests is still one logical session unless the host resets).
   */
  clearOnSessionStart?: boolean;
}>;

/**
 * Session-scoped memory: records each task completion as a JSON line under `task:<taskId>`.
 * Does not store prompts or tool arguments.
 */
export function createSessionMemoryPlugin(options: SessionMemoryPluginOptions): PluginHooks {
  const { store, clearOnSessionStart = false } = options;

  return {
    onSessionStart() {
      if (clearOnSessionStart) {
        store.clear();
      }
    },
    onTaskEnd(ctx) {
      const key = `task:${ctx.taskId}`;
      store.set(
        key,
        JSON.stringify({
          ok: ctx.ok,
          detail: ctx.detail ?? null,
        }),
      );
    },
  };
}
