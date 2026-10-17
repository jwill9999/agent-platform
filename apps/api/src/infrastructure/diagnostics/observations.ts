import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { parseToolId } from '@agent-platform/agent-validation';
import {
  ContextDecisionMetadataSchema,
  DiagnosticEventSchema,
  type DiagnosticEvent,
  type DiagnosticStore,
} from '@agent-platform/contracts';
import { createLogger } from '@agent-platform/logger';
import type { HarnessStateType } from '@agent-platform/harness';
import type { RequestHandler } from 'express';
import type { ControlObservation } from '../../application/runControl/service.js';
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
  haltError?: DiagnosticEvent['errorCode'];
  parentOperationId?: string;
  modelMetadata?: Partial<DiagnosticEvent>;
  modelStartedAt?: number;
  terminal?: Pick<DiagnosticEvent, 'outcome' | 'errorCode'>;
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
    if (
      req.method !== 'POST' ||
      !/^\/v1\/(chat(?:\/|$)|sessions\/[^/]+\/(?:resume|runs\/[^/]+\/stop)$)/.test(req.path)
    )
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
      outcome: current.terminal?.outcome ?? completionOutcome(current.waiting, current.halted),
      ...(current.halted && !current.waiting
        ? { errorCode: current.haltError ?? ('internal_error' as const) }
        : {}),
      ...current.terminal,
      durationMs: performance.now() - started,
    });
}

export function failDiagnosticRun(signal: AbortSignal, unknown = false): void {
  const terminal: Pick<DiagnosticEvent, 'outcome' | 'errorCode'> = {
    outcome: runFailureOutcome(signal, unknown),
    errorCode: runFailureCode(signal),
  };
  const current = context.getStore();
  if (current) current.terminal = terminal;
  emit({ phase: 'request', ...terminal });
}

function runFailureOutcome(signal: AbortSignal, unknown: boolean): DiagnosticEvent['outcome'] {
  if (unknown) return 'unknown';
  return signal.aborted ? 'cancelled' : 'failed';
}

function terminalControlOutcome(
  state: ControlObservation['record']['state'],
): DiagnosticEvent['outcome'] | undefined {
  if (state === 'outcome_unknown' || state === 'interrupted') return 'unknown';
  if (state === 'failed') return 'failed';
  if (state === 'cancelled') return 'cancelled';
  return undefined;
}

function controlOutcome(
  state: ControlObservation['record']['state'],
  stage: ControlObservation['stage'],
): DiagnosticEvent['outcome'] {
  const terminal = terminalControlOutcome(state);
  if (terminal) return terminal;
  if (state === 'waiting_for_approval' || stage === 'requested') return 'waiting';
  return stage === 'admitted' ? 'started' : 'succeeded';
}

function controlReasonError(
  reason: unknown,
  fallback: DiagnosticEvent['errorCode'],
): DiagnosticEvent['errorCode'] {
  if (reason === 'user_stop') return 'cancelled';
  if (reason === 'timeout') return 'timeout';
  if (reason === 'client_disconnect') return 'connection_lost';
  return fallback;
}

/** A safe observation of mandatory authority, never the authority itself. */
export function observeDiagnosticRunControl({
  record,
  stage,
  kind,
  durationMs,
  executionId,
}: ControlObservation): void {
  const current = context.getStore();
  if (!current) return;
  current.sessionId = record.sessionId;
  if (executionId) current.runId = executionId;
  const terminal = terminalControlOutcome(record.state);
  if (terminal) {
    current.terminal = {
      outcome: terminal,
      errorCode: controlReasonError(
        record.reason,
        current.haltError ?? current.terminal?.errorCode ?? 'internal_error',
      ),
    };
  }
  emit({
    phase: 'control',
    outcome: controlOutcome(record.state, stage),
    durationMs,
    control: {
      logicalRunId: record.id,
      state: record.state,
      reason: record.reason,
      stage,
      kind,
      version: record.version,
      inFlight: record.inFlight,
    },
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
  options: { deferModelStart?: boolean } = {},
): ObservedNode<A> {
  return async (state, ...args) => {
    const parent = context.getStore();
    if (!parent) return node(state, ...args);
    const current: Context = { ...parent, operationId: randomUUID(), attempt: 1 };
    return context.run(current, async () => {
      const started = performance.now();
      const metadata = nodeMetadata(phase, state);
      current.parentOperationId = parent.operationId;
      current.modelMetadata = metadata;
      if (phase === 'model') {
        if (!options.deferModelStart) observeDiagnosticModelAttempt();
      } else {
        emit({ phase, outcome: 'started', parentOperationId: parent.operationId, ...metadata });
      }
      try {
        const result = await node(state, ...args);
        observeNodeResult(parent, phase, result, metadata, current.modelStartedAt ?? started);
        return result;
      } catch (error) {
        const category = interruptionFromError(error, phase);
        if (category.outcome === 'cancelled') parent.terminal = category;
        if (phase !== 'model' || current.modelStartedAt !== undefined) {
          emit({
            phase,
            ...category,
            durationMs: performance.now() - (current.modelStartedAt ?? started),
          });
        }
        throw error;
      }
    });
  };
}

/** Local admission is distinct from a provider invocation, including on rejected context. */
export function observeDiagnosticContextDecision(input: unknown): void {
  const parsed = ContextDecisionMetadataSchema.safeParse(input);
  if (!parsed.success) return;
  const decision = parsed.data;
  const rejected = decision.reason === 'required_overflow' || decision.reason === 'invalid_history';
  emit({
    phase: 'context',
    outcome: rejected ? 'failed' : 'succeeded',
    attempt: undefined,
    contextDecision: decision,
    errorCode: contextDecisionError(decision.reason),
  });
}

function contextDecisionError(reason: string): DiagnosticEvent['errorCode'] {
  if (reason === 'required_overflow') return 'context_budget_exceeded';
  if (reason === 'invalid_history') return 'context_invalid_history';
  return undefined;
}

/** Real harness calls this immediately before each SDK invocation, after admission succeeds. */
export function observeDiagnosticModelAttempt(): void {
  const current = context.getStore();
  if (!current) return;
  current.modelStartedAt ??= performance.now();
  emit({
    phase: 'model',
    outcome: 'started',
    parentOperationId: current.parentOperationId,
    ...current.modelMetadata,
  });
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
  return controlReasonError(signal.reason, 'cancelled');
}

function interruptionFromError(
  error: unknown,
  phase: 'model' | 'tool',
): Pick<DiagnosticEvent, 'outcome' | 'errorCode'> {
  if (error instanceof Error) {
    if ('code' in error && error.code === 'USER_STOP')
      return { outcome: 'cancelled', errorCode: 'cancelled' };
    if (error.name === 'TimeoutError') return { outcome: 'cancelled', errorCode: 'timeout' };
    if (error.name === 'AbortError') return { outcome: 'cancelled', errorCode: 'connection_lost' };
  }
  return { outcome: 'failed', errorCode: phase === 'model' ? 'provider_error' : 'tool_error' };
}

function nodeMetadata(phase: 'model' | 'tool', state: HarnessStateType): Partial<DiagnosticEvent> {
  if (phase === 'tool') return { toolId: 'other' };
  const provider = DiagnosticEventSchema.shape.provider.safeParse(state.modelConfig?.provider);
  return { provider: provider.success ? provider.data : 'other' };
}

function interruptedTrace(
  traces: NonNullable<NodeResult['trace']>,
): Pick<DiagnosticEvent, 'outcome' | 'errorCode'> | undefined {
  const aborted = traces.find((event) => event.type === 'stream_aborted');
  if (aborted?.type !== 'stream_aborted') return undefined;
  return { outcome: 'cancelled', errorCode: controlReasonError(aborted.reason, 'cancelled') };
}

function nodeFailureMetadata(
  failed: boolean,
  haltError: DiagnosticEvent['errorCode'],
  waiting: boolean,
  phase: 'model' | 'tool',
): Pick<DiagnosticEvent, 'errorCode'> {
  if ((!failed && !haltError) || waiting) return {};
  return { errorCode: haltError ?? (phase === 'model' ? 'provider_error' : 'tool_error') };
}

function observeNodeResult(
  parent: Context,
  phase: 'model' | 'tool',
  result: NodeResult,
  metadata: Partial<DiagnosticEvent>,
  started: number,
): void {
  const traces = result.trace ?? [];
  const interrupted = interruptedTrace(traces);
  if (interrupted) parent.terminal = interrupted;
  if (result.halted) parent.halted = true;
  const haltError = observedContextHalt(result) ?? observedMcpHalt(result);
  if (haltError) parent.haltError = haltError;
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
  if (phase === 'model' && context.getStore()?.modelStartedAt === undefined) return;
  emit({
    phase,
    ...metadata,
    outcome: completionOutcome(waiting, failed || Boolean(haltError)),
    durationMs: performance.now() - started,
    ...nodeFailureMetadata(failed, haltError, waiting, phase),
    ...interrupted,
    ...observedTokenUsage(traces),
  });
}

function observedContextHalt(result: NodeResult): DiagnosticEvent['errorCode'] {
  if (!('contextHalt' in result) || !result.contextHalt || typeof result.contextHalt !== 'object')
    return undefined;
  const code = (result.contextHalt as { code?: unknown }).code;
  if (code === 'CONTEXT_BUDGET_EXCEEDED') return 'context_budget_exceeded';
  if (code === 'CONTEXT_INVALID_HISTORY') return 'context_invalid_history';
  if (code === 'MODEL_OUTPUT_INCOMPLETE') return 'model_output_incomplete';
  return undefined;
}

function observedMcpHalt(result: NodeResult): DiagnosticEvent['errorCode'] {
  if (result.mcpHalt?.code === 'MCP_APPROVAL_STALE') return 'permission_denied';
  if (result.mcpHalt?.code === 'MCP_OUTCOME_UNKNOWN') return 'tool_error';
  return undefined;
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
  if (parseToolId(toolName).kind === 'mcp') return 'mcp';
  if (toolName.startsWith('sys_file_') || toolName === 'sys_read_file') return 'read';
  if (toolName === 'sys_write_file' || toolName === 'sys_apply_patch') return 'write';
  if (['sys_run_command', 'sys_bash', 'sys_run_quality_gate'].includes(toolName)) return 'command';
  if (toolName.includes('search')) return 'search';
  if (toolName === 'http_request') return 'http';
  return 'other';
}
