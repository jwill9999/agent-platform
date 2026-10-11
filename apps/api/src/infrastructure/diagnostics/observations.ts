import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import {
  DiagnosticEventSchema,
  type DiagnosticEvent,
  type DiagnosticStore,
} from '@agent-platform/contracts';
import { createLogger } from '@agent-platform/logger';
import type { HarnessStateType } from '@agent-platform/harness';
import type { RequestHandler } from 'express';
import { hasDiagnosticAccess, type DiagnosticAccess } from './localAccess.js';

const log = createLogger('api:diagnostics');
type Context = {
  store: DiagnosticStore;
  requestId: string;
  bffRequestId?: string;
  sessionId?: string;
  runId?: string;
  operationId?: string;
  attempt?: number;
  waiting: boolean;
  halted: boolean;
};
const context = new AsyncLocalStorage<Context>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The same strict projection reaches both sinks; never propagate collector failures to execution. */
function emit(fields: Partial<DiagnosticEvent>): void {
  const current = context.getStore();
  if (!current) return;
  try {
    const event = DiagnosticEventSchema.safeParse({
      schemaVersion: 1,
      eventId: randomUUID(),
      processInstanceId: current.store.health().processInstanceId,
      requestId: current.requestId,
      bffRequestId: current.bffRequestId,
      sessionId: current.sessionId,
      runId: current.runId,
      operationId: current.operationId,
      attempt: current.attempt,
      observedAtMs: Date.now(),
      ...fields,
    });
    if (!event.success) return;
    current.store.record(event.data);
    log.info('diagnostic.event', { event: event.data });
  } catch {
    /* Diagnostic failure never changes execution outcomes. */
  }
}

export function diagnosticIngress(
  store: DiagnosticStore,
  access: DiagnosticAccess,
): RequestHandler {
  return (req, res, next) => {
    // Avoid recursive diagnostic reads and unrelated platform instrumentation in this MVP.
    if (req.method !== 'POST' || !/^\/v1\/(chat(?:\/|$)|sessions\/[^/]+\/resume$)/.test(req.path))
      return next();
    const requestId: unknown = res.locals.requestId;
    if (typeof requestId !== 'string' || !uuid.test(requestId)) return next();
    const forwarded = req.header('x-bff-request-id');
    const current: Context = {
      store,
      requestId,
      waiting: false,
      halted: false,
      bffRequestId:
        forwarded && uuid.test(forwarded) && hasDiagnosticAccess(req, access)
          ? forwarded
          : undefined,
    };
    context.run(current, () => {
      const started = performance.now();
      emit({ phase: 'ingress', outcome: 'started' });
      let finished = false;
      res.once('finish', () =>
        context.run(current, () => {
          finished = true;
          const failed = res.statusCode >= 400;
          emit({
            phase: 'ingress',
            operationId: undefined,
            outcome: failed ? 'failed' : 'succeeded',
            durationMs: performance.now() - started,
            ...(failed
              ? { errorCode: res.statusCode >= 500 ? 'internal_error' : 'invalid_request' }
              : {}),
          });
        }),
      );
      res.once('close', () => {
        if (!finished)
          context.run(current, () =>
            emit({
              phase: 'connection',
              operationId: undefined,
              outcome: 'disconnected',
              errorCode: 'connection_lost',
            }),
          );
      });
      next();
    });
  };
}

export function beginDiagnosticRun(sessionId: string, runId: string): () => void {
  const current = context.getStore();
  if (!current) return () => {};
  current.sessionId = sessionId;
  current.runId = runId;
  current.operationId = randomUUID();
  const started = performance.now();
  emit({ phase: 'request', outcome: 'started' });
  return () =>
    emit({
      phase: 'request',
      outcome: current.waiting ? 'waiting' : current.halted ? 'failed' : 'succeeded',
      ...(current.halted && !current.waiting ? { errorCode: 'internal_error' as const } : {}),
      durationMs: performance.now() - started,
    });
}

export function failDiagnosticRun(signal: AbortSignal): void {
  emit({
    phase: 'request',
    outcome: signal.aborted ? 'cancelled' : 'failed',
    errorCode: signal.aborted
      ? signal.reason === 'timeout'
        ? 'timeout'
        : 'cancelled'
      : 'internal_error',
  });
}

/** Existing retry hook reports failures even if the node eventually throws (no lost retry trace). */
export function diagnosticRetry(attempt: number, phase: 'model' | 'tool'): void {
  const current = context.getStore();
  if (!current || !Number.isSafeInteger(attempt) || attempt < 1) return;
  emit({ phase, outcome: 'retrying', attempt });
  current.attempt = attempt + 1;
}

type NodeResult = Partial<HarnessStateType>;
type ObservedNode<A extends unknown[]> = (
  state: HarnessStateType,
  ...args: A
) => Promise<NodeResult>;
export function observeDiagnosticNode<A extends unknown[]>(
  phase: 'model' | 'tool',
  node: ObservedNode<A>,
): ObservedNode<A> {
  return async (state, ...args) => {
    const parent = context.getStore();
    if (!parent) return node(state, ...args);
    const current: Context = { ...parent, operationId: randomUUID(), attempt: 1 };
    return context.run(current, async () => {
      const started = performance.now();
      const provider = DiagnosticEventSchema.shape.provider.safeParse(state.modelConfig?.provider);
      const metadata =
        phase === 'model'
          ? { provider: provider.success ? provider.data : ('other' as const) }
          : { toolId: 'other' as const };
      emit({ phase, outcome: 'started', parentOperationId: parent.operationId, ...metadata });
      try {
        const result = await node(state, ...args);
        const traces = result.trace ?? [];
        if (result.halted) parent.halted = true;
        const waiting = traces.some((event) => event.type === 'tool_approval_required');
        if (waiting) {
          parent.waiting = true;
        }
        // Tool retries have no plugin retry hook; preserve only safe counters, never error text.
        if (phase === 'tool')
          for (const event of traces) {
            if (event.type === 'tool_retry') diagnosticRetry(event.attempt, 'tool');
          }
        const failed = traces.some(
          (event) =>
            (event.type === 'tool_dispatch' && !event.ok) ||
            event.type === 'tool_timeout' ||
            event.type === 'limit_hit' ||
            event.type === 'deadline_exceeded',
        );
        const usage = traces.find((event) => event.type === 'llm_call' && event.tokenUsage);
        emit({
          phase,
          ...metadata,
          outcome: waiting ? 'waiting' : failed ? 'failed' : 'succeeded',
          durationMs: performance.now() - started,
          ...(failed && !waiting
            ? {
                errorCode:
                  phase === 'model' ? ('provider_error' as const) : ('tool_error' as const),
              }
            : {}),
          ...(usage?.type === 'llm_call' && usage.tokenUsage
            ? {
                inputTokens: usage.tokenUsage.promptTokens,
                outputTokens: usage.tokenUsage.completionTokens,
              }
            : {}),
        });
        return result;
      } catch (error) {
        emit({
          phase,
          outcome: 'failed',
          durationMs: performance.now() - started,
          errorCode: phase === 'model' ? 'provider_error' : 'tool_error',
        });
        throw error;
      }
    });
  };
}

/** Safe projection of committed audit metadata; raw args/results never cross this boundary. */
export function observeDiagnosticTool(
  toolExecutionId: string,
  toolName: string,
  status: string,
): (status: string, durationMs: number) => void {
  const parent = context.getStore();
  if (!parent || !uuid.test(toolExecutionId)) return () => {};
  const toolId: DiagnosticEvent['toolId'] = toolName.startsWith('mcp:')
    ? 'mcp'
    : toolName.startsWith('sys_file_') || toolName === 'sys_read_file'
      ? 'read'
      : toolName === 'sys_write_file' || toolName === 'sys_apply_patch'
        ? 'write'
        : toolName === 'sys_run_command' ||
            toolName === 'sys_bash' ||
            toolName === 'sys_run_quality_gate'
          ? 'command'
          : toolName.includes('search')
            ? 'search'
            : toolName === 'http_request'
              ? 'http'
              : 'other';
  const current: Context = { ...parent, operationId: randomUUID(), attempt: 1 };
  const started = performance.now();
  const metadata = {
    phase: 'tool' as const,
    toolId,
    toolExecutionId,
    parentOperationId: parent.operationId,
  };
  context.run(current, () =>
    emit({
      ...metadata,
      outcome: status === 'denied' ? 'failed' : 'started',
      ...(status === 'denied' ? { errorCode: 'permission_denied' as const } : {}),
    }),
  );
  return (outcome) =>
    context.run(current, () =>
      emit({
        ...metadata,
        durationMs: performance.now() - started,
        outcome: outcome === 'success' ? 'succeeded' : 'failed',
        ...(outcome === 'success'
          ? {}
          : {
              errorCode:
                outcome === 'denied' ? ('permission_denied' as const) : ('tool_error' as const),
            }),
      }),
    );
}

export function observeDiagnosticApproval(
  approvalRequestId: string,
  outcome: 'waiting' | 'started' | 'failed',
  linkedRunId?: string,
): void {
  if (!uuid.test(approvalRequestId)) return;
  emit({
    phase: 'approval',
    approvalRequestId,
    ...(linkedRunId && uuid.test(linkedRunId) ? { linkedRunId } : {}),
    outcome,
    ...(outcome === 'failed' ? { errorCode: 'permission_denied' as const } : {}),
  });
}
