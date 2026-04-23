import type { PluginHooks } from './hooks.js';
import type {
  DodCheckContext,
  ErrorContext,
  PromptBuildContext,
  SessionStartContext,
  TaskEndContext,
  TaskStartContext,
  ToolCallContext,
} from './contexts.js';
import type { DodContract } from '@agent-platform/contracts';

export type PluginDispatcher = {
  readonly chain: readonly PluginHooks[];
  onSessionStart(ctx: SessionStartContext): Promise<void>;
  onTaskStart(ctx: TaskStartContext): Promise<void>;
  onPromptBuild(ctx: PromptBuildContext): Promise<void>;
  onToolCall(ctx: ToolCallContext): Promise<void>;
  onTaskEnd(ctx: TaskEndContext): Promise<void>;
  onDodCheck(ctx: DodCheckContext): Promise<DodContract | undefined>;
  onError(ctx: ErrorContext): Promise<void>;
};

/**
 * Runs hooks in **registration order** (array index ascending). Missing hooks are skipped.
 */
export function createPluginDispatcher(chain: readonly PluginHooks[]): PluginDispatcher {
  return {
    chain,
    async onSessionStart(ctx) {
      for (const p of chain) {
        await p.onSessionStart?.(ctx);
      }
    },
    async onTaskStart(ctx) {
      for (const p of chain) {
        await p.onTaskStart?.(ctx);
      }
    },
    async onPromptBuild(ctx) {
      for (const p of chain) {
        await p.onPromptBuild?.(ctx);
      }
    },
    async onToolCall(ctx) {
      for (const p of chain) {
        await p.onToolCall?.(ctx);
      }
    },
    async onTaskEnd(ctx) {
      for (const p of chain) {
        await p.onTaskEnd?.(ctx);
      }
    },
    async onDodCheck(ctx) {
      let override: DodContract | undefined;
      for (const p of chain) {
        const result = await p.onDodCheck?.(ctx);
        if (result) {
          override = result;
        }
      }
      return override;
    },
    async onError(ctx) {
      for (const p of chain) {
        await p.onError?.(ctx);
      }
    },
  };
}
