import type { PluginHooks } from '@agent-platform/plugin-sdk';
import type { ObservabilityEvent } from './events.js';

export type ObservabilityPluginOptions = Readonly<{
  /** Destination for structured events (e.g. JSON lines, pino child, test capture). */
  log: (event: ObservabilityEvent) => void;
  /**
   * When false (default), tool arguments are **not** included in `tool_call` events
   * (may contain paths, secrets, or user data).
   */
  includeToolArgs?: boolean;
}>;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * First-party plugin: skills/tools/path/errors as structured events without PII by default.
 */
export function createObservabilityPlugin(options: ObservabilityPluginOptions): PluginHooks {
  const { log, includeToolArgs = false } = options;

  return {
    onSessionStart(ctx) {
      log({ kind: 'session_start', sessionId: ctx.sessionId, agentId: ctx.agentId });
    },
    onTaskStart(ctx) {
      log({
        kind: 'task_start',
        sessionId: ctx.sessionId,
        runId: ctx.runId,
        planId: ctx.planId,
        taskId: ctx.taskId,
        toolIds: ctx.toolIds,
      });
    },
    onPromptBuild(ctx) {
      log({
        kind: 'prompt_build',
        sessionId: ctx.sessionId,
        runId: ctx.runId,
        planId: ctx.plan?.id ?? null,
        messageCount: ctx.messages.length,
      });
    },
    onToolCall(ctx) {
      if (includeToolArgs) {
        log({
          kind: 'tool_call',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          toolId: ctx.toolId,
          args: ctx.args,
        });
      } else {
        log({
          kind: 'tool_call',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          toolId: ctx.toolId,
        });
      }
    },
    onTaskEnd(ctx) {
      log({
        kind: 'task_end',
        sessionId: ctx.sessionId,
        runId: ctx.runId,
        taskId: ctx.taskId,
        ok: ctx.ok,
        detail: ctx.detail,
      });
    },
    onDodCheck(ctx) {
      log({
        kind: 'dod_check',
        sessionId: ctx.sessionId,
        runId: ctx.runId,
        passed: ctx.contract.passed,
        criteriaCount: ctx.contract.criteria.length,
        failedCriteriaCount: ctx.contract.failedCriteria.length,
      });
    },
    onError(ctx) {
      log({
        kind: 'error',
        sessionId: ctx.sessionId,
        runId: ctx.runId,
        phase: ctx.phase,
        message: errorMessage(ctx.error),
      });
    },
  };
}
