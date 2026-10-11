import type { PluginHooks } from '@agent-platform/plugin-sdk';
import type { ObservabilityEvent } from './events.js';
import type { ObservabilityStore } from './store.js';

export type ObservabilityPluginOptions = Readonly<{
  /** Destination for structured events (e.g. JSON lines, pino child, test capture). */
  log?: (event: ObservabilityEvent) => void;
  /** Optional in-memory store used by runtime observability tools. */
  store?: ObservabilityStore;
  /**
   * @deprecated Arguments are always omitted from diagnostic events.
   */
  includeToolArgs?: boolean;
}>;

function emitEvent(
  event: ObservabilityEvent,
  options: Pick<ObservabilityPluginOptions, 'log' | 'store'>,
): void {
  // Each sink is independent and observational. A broken logger cannot fail execution
  // or prevent the in-memory record, and both receive the same safe event.
  try {
    options.store?.record(event);
  } catch {
    /* telemetry is best effort */
  }
  try {
    options.log?.(event);
  } catch {
    /* telemetry is best effort */
  }
}

/**
 * First-party plugin: skills/tools/path/errors as structured events without PII by default.
 */
export function createObservabilityPlugin(options: ObservabilityPluginOptions): PluginHooks {
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
      emitEvent(
        { kind: 'tool_call', sessionId: ctx.sessionId, runId: ctx.runId, toolId: ctx.toolId },
        options,
      );
    },
    onTaskEnd(ctx) {
      emitEvent(
        {
          kind: 'task_end',
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          taskId: ctx.taskId,
          ok: ctx.ok,
          // Diagnostic metadata must never include arbitrary task details.
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
          message: 'Observed failure; free-form error details omitted.',
        },
        options,
      );
    },
  };
}
