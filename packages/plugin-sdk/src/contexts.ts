import type { Agent, DodContract, Plan } from '@agent-platform/contracts';

/**
 * Session lifecycle — `sessionId` is the persisted/API session identifier.
 */
export type SessionStartContext = Readonly<{
  sessionId: string;
  agentId: string;
  agent: Readonly<Agent>;
}>;

/**
 * A task is about to run. Tool identifiers are **plan-level hints**; the harness
 * still enforces {@link Agent} allowlists before any tool execution.
 */
export type TaskStartContext = Readonly<{
  sessionId: string;
  runId: string;
  planId: string;
  taskId: string;
  /** Tool ids attached to the task in the plan (not yet executed). */
  toolIds: readonly string[];
}>;

/**
 * Prompt / message assembly for the planner or LLM path. Plugins may **observe** or
 * **append suggestions** only through APIs provided by the host (future); this context
 * is read-only to prevent bypassing validation by mutating prompts in an uncontrolled way.
 */
export type PromptBuildContext = Readonly<{
  sessionId: string;
  runId: string;
  plan: Readonly<Plan> | null;
  /** Messages the host will send upstream — treat as read-only. */
  messages: readonly Readonly<{ role: string; content: string }>[];
}>;

/**
 * Emitted when the host is about to invoke a tool **after** allowlist and policy checks.
 * Hooks are **observers**: they MUST NOT be used to substitute tool ids, arguments, or
 * to trigger execution — the host ignores any return value.
 */
export type ToolCallContext = Readonly<{
  sessionId: string;
  runId: string;
  /** Validated tool id (already passed `isToolExecutionAllowed` / harness gates). */
  toolId: string;
  args: Readonly<Record<string, unknown>>;
}>;

export type TaskEndContext = Readonly<{
  sessionId: string;
  runId: string;
  taskId: string;
  ok: boolean;
  detail?: string;
}>;

export type DodCheckContext = Readonly<{
  sessionId: string;
  runId: string;
  contract: Readonly<DodContract>;
}>;

export type ErrorContext = Readonly<{
  sessionId: string;
  runId: string;
  phase: 'session' | 'task' | 'prompt' | 'tool' | 'unknown';
  error: unknown;
  retryAttempt?: number;
  willRetry?: boolean;
  maxRetries?: number;
}>;
