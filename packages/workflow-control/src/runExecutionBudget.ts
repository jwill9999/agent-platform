import type Database from 'better-sqlite3';
import { isDeepStrictEqual } from 'node:util';
import { deriveContractMaterialDigest } from './planning.js';
import type { ExecutionContract } from './contracts.js';

export interface RunBudgetReservation {
  dispatch_id: string;
  execution_id: string;
  run_id: string;
  task_id: string;
  role: string;
  binding_json: string;
  reserved_at_ms: number;
  work_deadline_ms: number;
  cleanup_deadline_ms: number;
  charged_ms: number;
  settled_at_ms: number | null;
  measured_elapsed_ms: number | null;
}

export interface RunBudgetState {
  run_id: string;
  material_digest: string;
  limits_json: string;
  aggregate_ms: number;
  charged_ms: number;
  last_observed_ms: number;
  status: 'active' | 'blocked' | 'exhausted';
  failure_code: string | null;
}

export interface RunBudgetBinding {
  dispatchId: string;
  executionId: string;
  phaseExecutionId?: string;
  runId: string;
  taskId: string;
  role: string;
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
  phaseLeaseEpoch: number;
}

export function initializeRunExecutionBudget(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS run_execution_budgets (
    run_id TEXT PRIMARY KEY REFERENCES runs(id), material_digest TEXT NOT NULL,
    limits_json TEXT NOT NULL, aggregate_ms INTEGER NOT NULL, charged_ms INTEGER NOT NULL,
    last_observed_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active','blocked','exhausted')), failure_code TEXT
  );
  CREATE TABLE IF NOT EXISTS run_execution_reservations (
    dispatch_id TEXT PRIMARY KEY, execution_id TEXT NOT NULL,
    run_id TEXT NOT NULL REFERENCES run_execution_budgets(run_id), task_id TEXT NOT NULL,
    role TEXT NOT NULL, binding_json TEXT NOT NULL, reserved_at_ms INTEGER NOT NULL,
    work_deadline_ms INTEGER NOT NULL, cleanup_deadline_ms INTEGER NOT NULL,
    charged_ms INTEGER NOT NULL, settled_at_ms INTEGER, measured_elapsed_ms INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS run_execution_reservations_unique_execution
    ON run_execution_reservations(execution_id);`);
}

export function readRunBudget(db: Database.Database, runId: string): RunBudgetState | undefined {
  return db.prepare('SELECT * FROM run_execution_budgets WHERE run_id=?').get(runId) as
    | RunBudgetState
    | undefined;
}

export function readRunReservation(
  db: Database.Database,
  dispatchId: string,
): RunBudgetReservation | undefined {
  return db
    .prepare('SELECT * FROM run_execution_reservations WHERE dispatch_id=?')
    .get(dispatchId) as RunBudgetReservation | undefined;
}

export function fenceRunBudget(
  db: Database.Database,
  runId: string,
  reason: string,
  exhausted = false,
): void {
  db.prepare(
    `UPDATE run_execution_budgets SET status=?,failure_code=COALESCE(failure_code,?)
    WHERE run_id=?`,
  ).run(exhausted ? 'exhausted' : 'blocked', reason, runId);
}

function observeClock(
  db: Database.Database,
  state: RunBudgetState,
  nowMs: number,
): string | undefined {
  if (!Number.isSafeInteger(nowMs) || nowMs < state.last_observed_ms) {
    fenceRunBudget(db, state.run_id, 'run_execution_budget_clock_invalid');
    return 'run_execution_budget_clock_invalid';
  }
  db.prepare('UPDATE run_execution_budgets SET last_observed_ms=? WHERE run_id=?').run(
    nowMs,
    state.run_id,
  );
  return undefined;
}

/** Called only by the trusted store. Return failures from the transaction so fences commit. */
export function reserveRunBudget(
  db: Database.Database,
  contract: ExecutionContract,
  binding: RunBudgetBinding,
  nowMs: number,
  assertAuthority: () => void,
): RunBudgetReservation {
  const limits = contract.executionLimits;
  if (!limits) throw new Error('run_execution_budget_policy_missing');
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || !Number.isSafeInteger(nowMs + 86_400_000))
    throw new Error('run_execution_budget_clock_invalid');
  if (
    Object.values(binding).some(
      (value) =>
        value === '' || (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)),
    )
  )
    throw new Error('run_execution_budget_binding_invalid');
  const outcome = db
    .transaction(() => {
      assertAuthority();
      const material = deriveContractMaterialDigest(contract);
      const limitsJson = JSON.stringify(limits);
      db.prepare(
        `INSERT OR IGNORE INTO run_execution_budgets
      (run_id,material_digest,limits_json,aggregate_ms,charged_ms,last_observed_ms,status)
      VALUES (?,?,?,?,0,?,'active')`,
      ).run(binding.runId, material, limitsJson, limits.aggregateActiveSeconds * 1000, nowMs);
      const state = readRunBudget(db, binding.runId)!;
      if (state.material_digest !== material || state.limits_json !== limitsJson) {
        fenceRunBudget(db, binding.runId, 'run_execution_budget_policy_changed');
        return { error: 'run_execution_budget_policy_changed' };
      }
      const clockError = observeClock(db, state, nowMs);
      if (clockError) return { error: clockError };
      if (state.status !== 'active')
        return { error: state.failure_code ?? 'run_execution_budget_blocked' };
      const previous = readRunReservation(db, binding.dispatchId);
      if (previous) {
        if (!isDeepStrictEqual(JSON.parse(previous.binding_json), binding))
          return { error: 'run_execution_budget_replay_conflict' };
        if (previous.settled_at_ms !== null || nowMs >= previous.work_deadline_ms)
          return { error: 'run_execution_budget_work_expired' };
        return { reservation: previous };
      }
      if (
        db
          .prepare('SELECT 1 FROM run_execution_reservations WHERE execution_id=?')
          .get(binding.executionId)
      )
        return { error: 'run_execution_budget_identity_reused' };
      if (
        db
          .prepare(
            `SELECT 1 FROM run_execution_reservations WHERE run_id=? AND settled_at_ms IS NULL
        AND COALESCE(json_extract(binding_json,'$.phaseExecutionId'),execution_id)=?`,
          )
          .get(binding.runId, binding.phaseExecutionId ?? binding.executionId)
      )
        return { error: 'run_execution_budget_previous_attempt_unsettled' };
      const overdue = db
        .prepare(
          `SELECT cleanup_deadline_ms FROM run_execution_reservations
      WHERE run_id=? AND settled_at_ms IS NULL AND work_deadline_ms<=? LIMIT 1`,
        )
        .get(binding.runId, nowMs) as { cleanup_deadline_ms: number } | undefined;
      if (overdue) {
        if (nowMs >= overdue.cleanup_deadline_ms)
          fenceRunBudget(db, binding.runId, 'run_execution_budget_cleanup_expired');
        return { error: 'run_execution_budget_cleanup_pending' };
      }
      const remaining = state.aggregate_ms - state.charged_ms;
      const cleanup = limits.cleanupSeconds * 1000;
      if (remaining <= cleanup) {
        fenceRunBudget(db, binding.runId, 'run_execution_budget_exhausted', true);
        return { error: 'run_execution_budget_exhausted' };
      }
      const work = Math.min(limits.attemptSeconds * 1000, remaining - cleanup);
      const charged = work + cleanup;
      db.prepare('UPDATE run_execution_budgets SET charged_ms=charged_ms+? WHERE run_id=?').run(
        charged,
        binding.runId,
      );
      db.prepare(
        `INSERT INTO run_execution_reservations
      (dispatch_id,execution_id,run_id,task_id,role,binding_json,reserved_at_ms,
       work_deadline_ms,cleanup_deadline_ms,charged_ms) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        binding.dispatchId,
        binding.executionId,
        binding.runId,
        binding.taskId,
        binding.role,
        JSON.stringify(binding),
        nowMs,
        nowMs + work,
        nowMs + charged,
        charged,
      );
      return { reservation: readRunReservation(db, binding.dispatchId)! };
    })
    .immediate();
  if (outcome.error) throw new Error(outcome.error);
  return outcome.reservation!;
}

export function assertRunBudgetWork(
  db: Database.Database,
  runId: string,
  dispatchId: string,
  nowMs: number,
): RunBudgetReservation {
  const outcome = db
    .transaction(() => {
      const state = readRunBudget(db, runId);
      const reservation = readRunReservation(db, dispatchId);
      if (!state || !reservation || reservation.run_id !== runId)
        return { error: 'run_execution_budget_reservation_missing' };
      const clockError = observeClock(db, state, nowMs);
      if (clockError) return { error: clockError };
      if (state.status !== 'active')
        return { error: state.failure_code ?? 'run_execution_budget_blocked' };
      if (reservation.settled_at_ms !== null || nowMs >= reservation.work_deadline_ms)
        return { error: 'run_execution_budget_work_expired' };
      return { reservation };
    })
    .immediate();
  if (outcome.error) throw new Error(outcome.error);
  return outcome.reservation!;
}

export function settleRunBudget(
  db: Database.Database,
  runId: string,
  dispatchId: string,
  nowMs: number,
  absenceVerified: boolean,
): void {
  const outcome = db
    .transaction(() => {
      const state = readRunBudget(db, runId),
        reservation = readRunReservation(db, dispatchId);
      if (!state || !reservation || reservation.run_id !== runId)
        return 'run_execution_budget_reservation_missing';
      if (reservation.settled_at_ms !== null) return undefined;
      const clockError = observeClock(db, state, nowMs);
      if (clockError) return clockError;
      if (!absenceVerified || nowMs > reservation.cleanup_deadline_ms) {
        fenceRunBudget(db, runId, 'run_execution_budget_cleanup_unconfirmed');
        return 'run_execution_budget_cleanup_unconfirmed';
      }
      db.prepare(
        `UPDATE run_execution_reservations SET settled_at_ms=?,measured_elapsed_ms=? WHERE dispatch_id=?`,
      ).run(nowMs, nowMs - reservation.reserved_at_ms, dispatchId);
      return undefined;
    })
    .immediate();
  if (outcome) throw new Error(outcome);
}
