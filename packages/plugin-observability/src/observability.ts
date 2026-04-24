import type { PluginHooks } from '@agent-platform/plugin-sdk';
import type { ObservabilityEvent } from './events.js';
import type { ObservabilityStore } from './store.js';

export type ObservabilityPluginOptions = Readonly<{
  /** Destination for structured events (e.g. JSON lines, pino child, test capture). */
  log?: (event: ObservabilityEvent) => void;
  /** Optional in-memory store used by runtime observability tools. */
  store?: ObservabilityStore;
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

function emitEvent(
  event: ObservabilityEvent,
  options: Pick<ObservabilityPluginOptions, 'log' | 'store'>,
): void {
  options.store?.record(event);
  options.log?.(event);
}

/**
 * First-party plugin: skills/tools/path/errors as structured events without PII by default.
 */
export function createObservabilityPlugin(options: ObservabilityPluginOptions): PluginHooks {
  const { includeToolArgs = false } = options;

  return {
    onSessionStart(ctx) {
      emitEvent({ kind: 'session_start', sessionId: ctx.sessionId, agentId: ctx.agentId }, options);
    },
    onTaskStart(ctx) {
      emitEvent(
        {
          kind: 'task_start',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          planId: ctx.planId,
          taskId: ctx.taskId,
          toolIds: ctx.toolIds,
        },
        options,
      );
    },
    onPromptBuild(ctx) {
      emitEvent(
        {
          kind: 'prompt_build',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          planId: ctx.plan?.id ?? null,
          messageCount: ctx.messages.length,
        },
        options,
      );
    },
    onToolCall(ctx) {
      if (includeToolArgs) {
        emitEvent(
          {
            kind: 'tool_call',
            sessionId: ctx.sessionId,
            runId: ctx.runId,
            toolId: ctx.toolId,
            args: ctx.args,
          },
          options,
        );
      } else {
        emitEvent(
          {
            kind: 'tool_call',
            sessionId: ctx.sessionId,
            runId: ctx.runId,
            toolId: ctx.toolId,
          },
          options,
        );
      }
    },
    onTaskEnd(ctx) {
      emitEvent(
        {
          kind: 'task_end',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          taskId: ctx.taskId,
          ok: ctx.ok,
          detail: ctx.detail,
        },
        options,
      );
    },
    onDodCheck(ctx) {
      emitEvent(
        {
          kind: 'dod_check',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          passed: ctx.contract.passed,
          criteriaCount: ctx.contract.criteria.length,
          failedCriteriaCount: ctx.contract.failedCriteria.length,
        },
        options,
      );
    },
    onError(ctx) {
      emitEvent(
        {
          kind: 'error',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          phase: ctx.phase,
          message: errorMessage(ctx.error),
        },
        options,
      );
    },
  };
}
