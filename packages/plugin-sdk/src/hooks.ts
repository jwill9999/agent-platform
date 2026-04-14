import type {
  ErrorContext,
  PromptBuildContext,
  SessionStartContext,
  TaskEndContext,
  TaskStartContext,
  ToolCallContext,
} from './contexts.js';

/**
 * Optional lifecycle hooks for plugins. Implementations are synchronous or async;
 * the host awaits each plugin in order (see {@link createPluginDispatcher}).
 *
 * **Validation boundary:** hooks cannot approve or execute tools. Tool calls are
 * validated by the host before `onToolCall` runs; hooks do not return execution decisions.
 */
export type PluginHooks = {
  onSessionStart?: (ctx: SessionStartContext) => void | Promise<void>;
  onTaskStart?: (ctx: TaskStartContext) => void | Promise<void>;
  onPromptBuild?: (ctx: PromptBuildContext) => void | Promise<void>;
  onToolCall?: (ctx: ToolCallContext) => void | Promise<void>;
  onTaskEnd?: (ctx: TaskEndContext) => void | Promise<void>;
  onError?: (ctx: ErrorContext) => void | Promise<void>;
};
