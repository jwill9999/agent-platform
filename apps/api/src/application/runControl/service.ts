import { randomUUID } from 'node:crypto';
import { GitDeliveryReceiptSchema } from '@agent-platform/contracts';
import type {
  RunControlRecord,
  RunControlReason,
  RunControlState,
  SessionRecord,
} from '@agent-platform/contracts';
import {
  attachRunExecution,
  beginRunAttempt,
  createControlledRun,
  finishControlledRun,
  getControlledRun,
  getRunForExecution,
  getSessionActiveRun,
  getSessionLatestRun,
  markPreviousProcessRunsUnknown,
  requestRunStop,
  RunControlError,
  settleRunAttempt,
  type DrizzleDb,
} from '@agent-platform/db';
import { RunStoppedError, type RunExecutionControl } from '@agent-platform/harness';

type Kind = Parameters<RunExecutionControl['invoke']>[0];
export type ControlObservation = {
  record: RunControlRecord;
  stage: 'requested' | 'acknowledged' | 'admitted' | 'settled' | 'state';
  durationMs?: number;
  kind?: Kind;
  executionId?: string;
};
type Observe = (observation: ControlObservation) => void;
const processInstanceId = randomUUID();
const services = new WeakMap<DrizzleDb, RunControlService>();
const unknownCodes = new Set([
  'MCP_OUTCOME_UNKNOWN',
  'GIT_DELIVERY_OUTCOME_UNKNOWN',
  'GIT_DELIVERY_OUTCOME_UNAVAILABLE',
  'COMMAND_OUTCOME_UNKNOWN',
  'TOOL_TIMEOUT',
  'COMMAND_TIMEOUT',
  'HTTP_OUTCOME_UNKNOWN',
  'DOWNLOAD_OUTCOME_UNKNOWN',
]);
function outputResult(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'output' in value ? value.output : value;
}
function uncertainResult(input: unknown): boolean {
  const value = outputResult(input);
  if (typeof value !== 'object' || value === null) return false;
  if (
    'type' in value &&
    value.type === 'tool_result' &&
    'data' in value &&
    typeof value.data === 'object' &&
    value.data !== null &&
    'gitDeliveryReceipt' in value.data
  ) {
    const receipt = GitDeliveryReceiptSchema.safeParse(value.data.gitDeliveryReceipt);
    // A malformed or unfinished receipt cannot attest that a submitted mutation settled.
    return !receipt.success || ['unknown', 'executing'].includes(receipt.data.state);
  }
  return (
    ('status' in value && value.status === 'outcome_unknown') ||
    ('code' in value && typeof value.code === 'string' && unknownCodes.has(value.code))
  );
}
function failedResult(input: unknown): boolean {
  const value = outputResult(input);
  if (typeof value !== 'object' || value === null) return false;
  return (
    ('type' in value && value.type === 'error') ||
    ('status' in value && (value.status === 'failed' || value.status === 'denied'))
  );
}
function interrupted(error: unknown): boolean {
  return (
    error instanceof RunStoppedError ||
    (error instanceof Error &&
      (error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        ('code' in error && error.code === 'REQUEST_CANCELLED')))
  );
}

function invokeAction<T>(action: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(action());
  } catch (error) {
    return Promise.reject(error);
  }
}

/** The original action promise remains tracked even when an HTTP/timeout wrapper stops waiting. */
export class ControlledExecution implements RunExecutionControl {
  readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private closed = false;
  constructor(
    private readonly owner: RunControlService,
    readonly runId: string,
    readonly sessionId: string,
    readonly executionId: string,
  ) {}
  assertActive(): void {
    if (this.signal.aborted) {
      if (this.signal.reason === 'user_stop') throw new RunStoppedError();
      throw new DOMException('Execution interrupted.', 'AbortError');
    }
    const record = this.owner.read(this.sessionId, this.runId);
    if (record?.state !== 'running') {
      if (record?.reason === 'user_stop') throw new RunStoppedError();
      throw new RunControlError('run_not_running');
    }
  }
  invoke<T>(kind: Kind, action: () => Promise<T>): Promise<T> {
    this.assertActive();
    const id = randomUUID();
    const started = performance.now();
    beginRunAttempt(this.owner.db, {
      id,
      runId: this.runId,
      executionId: this.executionId,
      kind,
      nowMs: Date.now(),
    });
    // No await or diagnostic callback between the committed fence and the actual invocation.
    // The helper calls the action synchronously and converts only synchronous throws
    // to rejections; the original promise remains tracked through actual settlement.
    const result = invokeAction(action);
    this.owner.trackAdmission();
    this.owner.observeCurrent(this, 'admitted', kind);
    return Promise.resolve(result).then(
      (value) => {
        const effect = kind === 'tool' || kind === 'sensor';
        let outcome: 'unknown' | 'failed' | 'succeeded' = 'succeeded';
        if (uncertainResult(value) || (effect && this.signal.aborted && failedResult(value)))
          outcome = 'unknown';
        else if (failedResult(value)) outcome = 'failed';
        this.settle(id, kind, started, outcome, outcome === 'failed');
        return value;
      },
      (error: unknown) => {
        const ambiguous = this.signal.aborted && (kind === 'tool' || kind === 'sensor');
        this.settle(id, kind, started, ambiguous ? 'unknown' : 'failed', !interrupted(error));
        throw error;
      },
    );
  }
  private settle(
    id: string,
    kind: Kind,
    started: number,
    outcome: 'succeeded' | 'failed' | 'unknown',
    genuineFailure = false,
  ): void {
    const record = settleRunAttempt(this.owner.db, {
      id,
      runId: this.runId,
      outcome,
      nowMs: Date.now(),
    });
    // A transport callback can settle while its effect remains unknown. Those admitted
    // effects remain unresolved, just as they do in the durable control ledger.
    if (outcome !== 'unknown') this.owner.trackSettlement();
    this.owner.observe({
      record,
      stage: 'settled',
      kind,
      durationMs: performance.now() - started,
      executionId: this.executionId,
    });
    if (outcome === 'unknown')
      this.owner.finish(
        this,
        'outcome_unknown',
        record.stopAcknowledgedAtMs === undefined ? 'execution_failed' : 'user_stop',
      );
    else if (record.inFlight === 0 && record.stopAcknowledgedAtMs !== undefined)
      this.owner.finish(
        this,
        genuineFailure ? 'failed' : 'completed',
        genuineFailure ? 'execution_failed' : 'user_stop',
      );
  }
  /** Response lifetime is independent of effect settlement; handlers still observe rejection. */
  waitFor<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        this.signal.removeEventListener('abort', abort);
        reject(
          this.signal.reason === 'user_stop'
            ? new RunStoppedError()
            : new DOMException('Execution interrupted.', 'AbortError'),
        );
      };
      promise.then(
        (value) => {
          this.signal.removeEventListener('abort', abort);
          resolve(value);
        },
        (error: unknown) => {
          this.signal.removeEventListener('abort', abort);
          reject(error);
        },
      );
      if (this.signal.aborted) abort();
      else this.signal.addEventListener('abort', abort, { once: true });
    });
  }
  finish(state: RunControlState, reason: RunControlReason = 'none'): RunControlRecord {
    this.closed = true;
    return this.owner.finish(this, state, reason);
  }
  get ended(): boolean {
    return this.closed;
  }
}

export class RunControlService {
  private unresolvedAdmissions = 0;
  private readonly executions = new Map<string, Set<ControlledExecution>>();
  private readonly latestExecutions = new Map<string, string>();
  /** Process-owned counters only; unresolved effects from prior processes remain historical evidence. */
  monitoringMetrics(): { activeRuns: number; admittedUnresolvedAttempts: number } {
    let activeRuns = 0;
    for (const owners of this.executions.values()) {
      if ([...owners].some((owner) => !owner.ended)) activeRuns++;
    }
    return { activeRuns, admittedUnresolvedAttempts: this.unresolvedAdmissions };
  }
  trackAdmission(): void {
    this.unresolvedAdmissions++;
  }
  trackSettlement(): void {
    this.unresolvedAdmissions--;
  }
  constructor(
    readonly db: DrizzleDb,
    private readonly observer: Observe = () => {},
  ) {
    markPreviousProcessRunsUnknown(db, processInstanceId, Date.now());
  }
  observe(value: ControlObservation): void {
    try {
      this.observer(value);
    } catch {
      /* Optional observations cannot affect authority. */
    }
  }
  observeCurrent(
    execution: ControlledExecution,
    stage: ControlObservation['stage'],
    kind?: Kind,
  ): void {
    try {
      this.observe({
        record: this.require(execution.sessionId, execution.runId),
        stage,
        kind,
        executionId: execution.executionId,
      });
    } catch {
      /* An optional observation cannot orphan the already invoked promise. */
    }
  }
  read(sessionId: string, runId: string): RunControlRecord | undefined {
    return getControlledRun(this.db, sessionId, runId);
  }
  require(sessionId: string, runId: string): RunControlRecord {
    const value = this.read(sessionId, runId);
    if (!value) throw new RunControlError('run_not_found');
    return value;
  }
  current(sessionId: string): RunControlRecord | undefined {
    return getSessionActiveRun(this.db, sessionId) ?? getSessionLatestRun(this.db, sessionId);
  }
  open(
    session: SessionRecord,
    executionId: string,
    sourceExecutionId?: string,
  ): ControlledExecution {
    let record: RunControlRecord;
    if (sourceExecutionId) {
      const source = getRunForExecution(this.db, sourceExecutionId);
      if (!source || source.sessionId !== session.id) throw new RunControlError('run_not_found');
      record = attachRunExecution(this.db, {
        runId: source.id,
        sessionId: session.id,
        executionId,
        nowMs: Date.now(),
      });
    } else {
      record = createControlledRun(this.db, {
        id: randomUUID(),
        sessionId: session.id,
        projectId: session.projectId ?? undefined,
        processInstanceId,
        executionId,
        nowMs: Date.now(),
      });
    }
    const execution = new ControlledExecution(this, record.id, session.id, executionId);
    const owners = this.executions.get(record.id) ?? new Set<ControlledExecution>();
    owners.add(execution);
    this.executions.set(record.id, owners);
    this.latestExecutions.set(record.id, executionId);
    this.observe({ record, stage: 'state', executionId });
    return execution;
  }
  pause(executionId: string): RunControlRecord {
    const current = getRunForExecution(this.db, executionId);
    if (!current || this.latestExecutions.get(current.id) !== executionId)
      throw new RunControlError('run_not_running');
    const record = finishControlledRun(this.db, {
      runId: current.id,
      sessionId: current.sessionId,
      state: 'waiting_for_approval',
      nowMs: Date.now(),
    });
    this.observe({ record, stage: 'state', executionId });
    return record;
  }
  stop(sessionId: string, runId: string): RunControlRecord {
    const started = performance.now();
    const before = this.require(sessionId, runId);
    const record = requestRunStop(this.db, { sessionId, runId, nowMs: Date.now() });
    if (record.stopAcknowledgedAtMs === undefined) return record;
    this.observe({ record, stage: 'requested' });
    for (const execution of this.executions.get(runId) ?? [])
      execution.controller.abort('user_stop');
    this.observe({ record, stage: 'acknowledged', durationMs: performance.now() - started });
    if (
      record.inFlight === 0 &&
      (before.state === 'waiting_for_approval' || record.state === 'stop_requested')
    ) {
      const settled = finishControlledRun(this.db, {
        sessionId,
        runId,
        state: 'completed',
        reason: 'user_stop',
        nowMs: Date.now(),
      });
      this.observe({
        record: settled,
        stage: 'state',
        executionId: this.latestExecutions.get(runId),
      });
      return settled;
    }
    return this.require(sessionId, runId);
  }
  finish(
    execution: ControlledExecution,
    state: RunControlState,
    reason: RunControlReason,
  ): RunControlRecord {
    // A previous HTTP owner must not overwrite its already accepted approval continuation.
    const latest = this.latestExecutions.get(execution.runId);
    const superseded = latest !== undefined && latest !== execution.executionId;
    const record = superseded
      ? this.require(execution.sessionId, execution.runId)
      : finishControlledRun(this.db, {
          runId: execution.runId,
          sessionId: execution.sessionId,
          state,
          reason,
          nowMs: Date.now(),
        });
    this.observe({ record, stage: 'state', executionId: execution.executionId });
    if (execution.ended) {
      const owners = this.executions.get(execution.runId);
      owners?.delete(execution);
      if (owners?.size === 0) {
        this.executions.delete(execution.runId);
        this.latestExecutions.delete(execution.runId);
      }
    }
    return record;
  }
}

export function getRunControlService(db: DrizzleDb, observe?: Observe): RunControlService {
  let service = services.get(db);
  if (!service) {
    service = new RunControlService(db, observe);
    services.set(db, service);
  }
  return service;
}
