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
      outcome: completionOutcome(current.waiting, current.halted),
      ...(current.halted && !current.waiting ? { errorCode: 'internal_error' as const } : {}),
      durationMs: performance.now() - started,
    });
}

export function failDiagnosticRun(signal: AbortSignal): void {
  emit({
    phase: 'request',
    outcome: signal.aborted ? 'cancelled' : 'failed',
    errorCode: runFailureCode(signal),
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
      const metadata = nodeMetadata(phase, state);
      emit({ phase, outcome: 'started', parentOperationId: parent.operationId, ...metadata });
      try {
        const result = await node(state, ...args);
        observeNodeResult(parent, phase, result, metadata, started);
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
  const toolId = toolFamily(toolName);
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

function completionOutcome(waiting: boolean, failed: boolean): DiagnosticEvent['outcome'] {
  if (waiting) return 'waiting';
  return failed ? 'failed' : 'succeeded';
}

function runFailureCode(signal: AbortSignal): DiagnosticEvent['errorCode'] {
  if (!signal.aborted) return 'internal_error';
  return signal.reason === 'timeout' ? 'timeout' : 'cancelled';
}

function nodeMetadata(phase: 'model' | 'tool', state: HarnessStateType): Partial<DiagnosticEvent> {
  if (phase === 'tool') return { toolId: 'other' };
  const provider = DiagnosticEventSchema.shape.provider.safeParse(state.modelConfig?.provider);
  return { provider: provider.success ? provider.data : 'other' };
}

function observeNodeResult(
  parent: Context,
  phase: 'model' | 'tool',
  result: NodeResult,
  metadata: Partial<DiagnosticEvent>,
  started: number,
): void {
  const traces = result.trace ?? [];
  if (result.halted) parent.halted = true;
  const waiting = traces.some((event) => event.type === 'tool_approval_required');
  if (waiting) parent.waiting = true;
  // Tool retries have no plugin retry hook; preserve counters, never error text.
  if (phase === 'tool') observeToolRetries(traces);
  const failed = traces.some(
    (event) =>
      (event.type === 'tool_dispatch' && !event.ok) ||
      event.type === 'tool_timeout' ||
      event.type === 'limit_hit' ||
      event.type === 'deadline_exceeded',
  );
  emit({
    phase,
    ...metadata,
    outcome: completionOutcome(waiting, failed),
    durationMs: performance.now() - started,
    ...(failed && !waiting
      ? { errorCode: phase === 'model' ? ('provider_error' as const) : ('tool_error' as const) }
      : {}),
    ...observedTokenUsage(traces),
  });
}

function observeToolRetries(traces: NonNullable<NodeResult['trace']>): void {
  for (const event of traces) {
    if (event.type === 'tool_retry') diagnosticRetry(event.attempt, 'tool');
  }
}

function observedTokenUsage(traces: NonNullable<NodeResult['trace']>): Partial<DiagnosticEvent> {
  const usage = traces.find((event) => event.type === 'llm_call' && event.tokenUsage);
  if (usage?.type !== 'llm_call' || !usage.tokenUsage) return {};
  return {
    inputTokens: usage.tokenUsage.promptTokens,
    outputTokens: usage.tokenUsage.completionTokens,
  };
}

function toolFamily(toolName: string): DiagnosticEvent['toolId'] {
  if (toolName.startsWith('mcp:')) return 'mcp';
  if (toolName.startsWith('sys_file_') || toolName === 'sys_read_file') return 'read';
  if (toolName === 'sys_write_file' || toolName === 'sys_apply_patch') return 'write';
  if (['sys_run_command', 'sys_bash', 'sys_run_quality_gate'].includes(toolName)) return 'command';
  if (toolName.includes('search')) return 'search';
  if (toolName === 'http_request') return 'http';
  return 'other';
}
