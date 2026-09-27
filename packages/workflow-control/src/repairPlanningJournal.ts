import { specialistInputEnvelopeSchema } from './specialistInput.js';
import type Database from 'better-sqlite3';
import { digestGovernedValue, type DelegateCallback } from './governedOperations.js';
import type { RepairChildRequest } from './repairChildContract.js';
import type { AgentResult } from './contracts.js';

export const repairPlanningCapability = Symbol('repairPlanningCapability');
export interface RepairPlanningHandoff {
  executionId: string;
  request: RepairChildRequest;
  terminal: AgentResult;
  resultDigest: string;
  activated: boolean;
}
export function initializeRepairPlanning(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS repair_planning_handoffs (
    execution_id TEXT PRIMARY KEY REFERENCES scheduler_executions(id),
    child_id TEXT NOT NULL UNIQUE,request_json TEXT NOT NULL,terminal_json TEXT NOT NULL,
    result_digest TEXT NOT NULL,activated INTEGER NOT NULL DEFAULT 0 CHECK(activated IN (0,1))
  )`);
}
export function readRepairPlanningHandoff(
  database: Database.Database,
  executionId: string,
): RepairPlanningHandoff | undefined {
  const row = database
    .prepare('SELECT * FROM repair_planning_handoffs WHERE execution_id=?')
    .get(executionId) as
    | {
        execution_id: string;
        request_json: string;
        terminal_json: string;
        result_digest: string;
        activated: number;
      }
    | undefined;
  return row
    ? {
        executionId: row.execution_id,
        request: JSON.parse(row.request_json),
        terminal: JSON.parse(row.terminal_json),
        resultDigest: row.result_digest,
        activated: row.activated === 1,
      }
    : undefined;
}
export function prepareRepairPlanningHandoff(
  database: Database.Database,
  input: Omit<RepairPlanningHandoff, 'activated'>,
): void {
  const resultDigest = digestGovernedValue({
    executionDigest: digestGovernedValue(input.executionId),
    terminal: input.terminal,
  });
  if (resultDigest !== input.resultDigest)
    throw new Error('repair planning result digest mismatch');
  database
    .prepare(
      `INSERT OR IGNORE INTO repair_planning_handoffs
    (execution_id,child_id,request_json,terminal_json,result_digest) VALUES(?,?,?,?,?)`,
    )
    .run(
      input.executionId,
      input.request.id,
      JSON.stringify(input.request),
      JSON.stringify(input.terminal),
      input.resultDigest,
    );
  const prior = readRepairPlanningHandoff(database, input.executionId)!;
  if (
    prior.resultDigest !== input.resultDigest ||
    JSON.stringify(prior.request) !== JSON.stringify(input.request) ||
    JSON.stringify(prior.terminal) !== JSON.stringify(input.terminal)
  )
    throw new Error('repair planning handoff is immutable');
}
/** Called only after the production child broker committed and claim/ref read-back succeeded. */
export function activateRepairPlanningHandoff(
  database: Database.Database,
  executionId: string,
): void {
  const handoff = readRepairPlanningHandoff(database, executionId);
  const child = database
    .prepare("SELECT request_json FROM repair_child_intents WHERE id=? AND status='committed'")
    .get(handoff?.request.id) as { request_json: string } | undefined;
  if (!handoff || child?.request_json !== JSON.stringify(handoff.request))
    throw new Error('repair planning child is not committed');
  database
    .prepare('UPDATE repair_planning_handoffs SET activated=1 WHERE execution_id=?')
    .run(executionId);
}
/** Preserve the planner callback's parent identity. Only the successor action targets the child. */
export function repairChildForCallback(
  database: Database.Database,
  callback: DelegateCallback,
): string {
  const handoff = readRepairPlanningHandoff(database, callback.delegationId);
  if (!handoff) {
    const execution = database
      .prepare('SELECT packet_json FROM scheduler_executions WHERE id=?')
      .get(callback.delegationId) as { packet_json: string } | undefined;
    const packet = specialistInputEnvelopeSchema.safeParse(
      execution ? JSON.parse(execution.packet_json) : undefined,
    );
    if (!packet.success || !packet.data.task.repairPlanningContext) return callback.parentTaskId;
  }
  if (
    !handoff?.activated ||
    callback.parentState !== 'repair_planning' ||
    callback.delegateRole !== 'feature_planner' ||
    callback.terminalStatus !== 'continue' ||
    handoff.resultDigest !== callback.resultArtifactDigest ||
    handoff.request.chainTipTaskId !== callback.parentTaskId ||
    handoff.request.runId !== callback.parentRunId ||
    handoff.request.workspaceId !== callback.workspaceId ||
    handoff.request.branchParentSha !== callback.headSha ||
    handoff.request.contractVersion !== callback.contractVersion ||
    handoff.request.policyDigest !== callback.policyDigest
  )
    throw new Error('repair planning callback lacks an activated bound child');
  const child = database
    .prepare("SELECT request_json FROM repair_child_intents WHERE id=? AND status='committed'")
    .get(handoff.request.id) as { request_json: string } | undefined;
  if (child?.request_json !== JSON.stringify(handoff.request))
    throw new Error('repair planning child binding changed');
  return handoff.request.id;
}
