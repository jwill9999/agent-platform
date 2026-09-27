import type Database from 'better-sqlite3';
import { z } from 'zod';
import { digestGovernedValue } from './governedOperations.js';
/** Minimal proof context; receipt verification does not depend on the phase queue implementation. */
export interface CoordinatorProofContext {
  workspaceId: string;
  runId: string;
  taskId: string;
  phase: string;
  runVersion: number;
  headSha: string;
  contractVersion: number;
  policyDigest: string;
}

const id = z.string().min(1).max(500);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
/** IDs refer to existing authoritative broker records, never caller assertions of success. */
export const coordinatorProofSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('task_acceptance'),
      closeTransitionId: id,
      integrationTransitionId: id,
    })
    .strict(),
  z.object({ kind: z.literal('repair'), dispatchId: id, transitionId: id }).strict(),
  z.object({ kind: z.literal('pipeline'), checksOperationId: id, transitionId: id }).strict(),
  z.object({ kind: z.literal('delivery'), mergeOperationId: id }).strict(),
  z.object({ kind: z.literal('finalization'), reportDigest: digest }).strict(),
]);
export type CoordinatorProof = z.infer<typeof coordinatorProofSchema>;
export interface CoordinatorOutcome {
  state:
    | 'feature_evaluation'
    | 'implementing'
    | 'delivery'
    | 'repair_planning'
    | 'finalizing'
    | 'closed';
  version: number;
  headSha: string;
}
interface Transition {
  run_id: string;
  from_state: string;
  to_state: string;
  operation: string;
  expected_run_version: number;
  status: string;
  contract_version: number;
  policy_digest: string;
  external_arguments_json: string;
  result_json: string | null;
}
function transition(
  db: Database.Database,
  action: CoordinatorProofContext,
  key: string,
  from: string,
  to: string,
  operation: string,
  version: number,
): Transition {
  const row = db.prepare('SELECT * FROM transitions WHERE id=?').get(key) as Transition | undefined;
  const args = row
    ? (JSON.parse(row.external_arguments_json) as Record<string, unknown>)
    : undefined;
  if (
    row?.run_id !== action.runId ||
    row.from_state !== from ||
    row.to_state !== to ||
    row.operation !== operation ||
    row.status !== 'committed' ||
    row.expected_run_version !== version ||
    row.contract_version !== action.contractVersion ||
    row.policy_digest !== action.policyDigest ||
    args?.taskId !== action.taskId
  )
    throw new Error('coordinator transition proof rejected');
  return row;
}
function operation(
  db: Database.Database,
  action: CoordinatorProofContext,
  key: string,
  kind: string,
) {
  const row = db.prepare('SELECT * FROM delivery_operations WHERE id=?').get(key) as
    | {
        workspace_id: string;
        run_id: string;
        task_id: string;
        kind: string;
        status: string;
        request_json: string;
        result_json: string;
      }
    | undefined;
  if (
    row?.workspace_id !== action.workspaceId ||
    row.run_id !== action.runId ||
    row.task_id !== action.taskId ||
    row.kind !== kind ||
    row.status !== 'committed'
  )
    throw new Error('coordinator operation proof rejected');
  const request = JSON.parse(row.request_json) as Record<string, unknown>;
  const result = JSON.parse(row.result_json) as Record<string, unknown>;
  if (
    request.contractVersion !== action.contractVersion ||
    request.policyDigest !== action.policyDigest ||
    request.headSha !== action.headSha ||
    result.headSha !== action.headSha
  )
    throw new Error('coordinator operation head or material rejected');
  return { request, result };
}

/** Must run in the phase completion transaction. This observes effects; it performs none. */
export function verifyCoordinatorProof(
  db: Database.Database,
  action: CoordinatorProofContext,
  raw: unknown,
): CoordinatorOutcome {
  const proof = coordinatorProofSchema.parse(raw);
  let outcome: CoordinatorOutcome;
  switch (proof.kind) {
    case 'task_acceptance':
      outcome = verifyTaskAcceptance(db, action, proof);
      break;
    case 'repair':
      outcome = verifyRepair(db, action, proof);
      break;
    case 'pipeline':
      outcome = verifyPipeline(db, action, proof);
      break;
    case 'delivery':
      outcome = verifyDelivery(db, action, proof);
      break;
    case 'finalization':
      outcome = verifyFinalization(db, action, proof);
      break;
  }
  const run = db.prepare('SELECT state,version FROM runs WHERE id=?').get(action.runId) as {
    state: string;
    version: number;
  };
  if (run.state !== outcome.state || run.version !== outcome.version)
    throw new Error('coordinator outcome no longer current');
  return outcome;
}

function verifyTaskAcceptance(
  db: Database.Database,
  action: CoordinatorProofContext,
  proof: Extract<CoordinatorProof, { kind: 'task_acceptance' }>,
): CoordinatorOutcome {
  if (action.phase !== 'task_accepted') throw new Error('coordinator phase mismatch');
  transition(
    db,
    action,
    proof.closeTransitionId,
    'task_accepted',
    'integration',
    'beads.task_close',
    action.runVersion,
  );
  const integrated = transition(
    db,
    action,
    proof.integrationTransitionId,
    'integration',
    'feature_evaluation',
    'internal.integration_verified',
    action.runVersion + 2,
  );
  const result = JSON.parse(integrated.result_json ?? 'null') as {
    headSha?: string;
    evidenceDigests?: string[];
  } | null;
  if (result?.headSha !== action.headSha || !result.evidenceDigests?.length)
    throw new Error('coordinator integration head or evidence missing');
  for (const item of result.evidenceDigests) {
    if (
      !db
        .prepare(
          `SELECT 1 FROM evidence_bindings WHERE digest=? AND run_id=? AND task_id=? AND head_sha=?
          AND workspace_id=? AND contract_version=? AND policy_digest=?
          AND producer='local-exact-head-integration-gate' AND kind='test'`,
        )
        .get(
          item,
          action.runId,
          action.taskId,
          action.headSha,
          action.workspaceId,
          action.contractVersion,
          action.policyDigest,
        )
    )
      throw new Error('coordinator integration evidence missing');
  }
  return {
    state: 'feature_evaluation',
    version: action.runVersion + 4,
    headSha: action.headSha,
  };
}

function verifyRepair(
  db: Database.Database,
  action: CoordinatorProofContext,
  proof: Extract<CoordinatorProof, { kind: 'repair' }>,
): CoordinatorOutcome {
  if (action.phase !== 'repair') throw new Error('coordinator phase mismatch');
  const dispatch = db
    .prepare(
      `SELECT * FROM repair_dispatches WHERE id=? AND run_id=? AND task_id=?
        AND status='dispatched' AND failure_head_sha=?`,
    )
    .get(proof.dispatchId, action.runId, action.taskId, action.headSha);
  if (!dispatch) throw new Error('coordinator repair budget reservation missing');
  const moved = transition(
    db,
    action,
    proof.transitionId,
    'repair',
    'implementing',
    'internal.repair_dispatched',
    action.runVersion,
  );
  if (
    (JSON.parse(moved.external_arguments_json) as { dispatchId?: string }).dispatchId !==
    proof.dispatchId
  )
    throw new Error('coordinator repair dispatch binding rejected');
  return { state: 'implementing', version: action.runVersion + 2, headSha: action.headSha };
}

function verifyPipeline(
  db: Database.Database,
  action: CoordinatorProofContext,
  proof: Extract<CoordinatorProof, { kind: 'pipeline' }>,
): CoordinatorOutcome {
  if (action.phase !== 'pipeline') throw new Error('coordinator phase mismatch');
  const observed = operation(db, action, proof.checksOperationId, 'github.checks');
  const checks = observed.result.checks as Record<string, unknown> | undefined;
  const required = observed.request.requiredChecks as string[];
  if (!checks || !Array.isArray(required) || required.some((check) => checks[check] !== 'success'))
    throw new Error('coordinator pipeline checks not passed');
  const qualified = db
    .prepare(
      `SELECT 1 FROM passed_pipeline_observations
    WHERE operation_id=? AND observed_at_ms < deadline_ms`,
    )
    .get(proof.checksOperationId);
  if (!qualified) throw new Error('coordinator pipeline observation is unqualified');
  const moved = transition(
    db,
    action,
    proof.transitionId,
    'pipeline',
    'delivery',
    'internal.pipeline_verified',
    action.runVersion,
  );
  if (
    (JSON.parse(moved.external_arguments_json) as { checksOperationId?: string })
      .checksOperationId !== proof.checksOperationId
  )
    throw new Error('coordinator checks binding rejected');
  return { state: 'delivery', version: action.runVersion + 2, headSha: action.headSha };
}

function verifyDelivery(
  db: Database.Database,
  action: CoordinatorProofContext,
  proof: Extract<CoordinatorProof, { kind: 'delivery' }>,
): CoordinatorOutcome {
  if (action.phase !== 'delivery') throw new Error('coordinator phase mismatch');
  operation(db, action, proof.mergeOperationId, 'github.merge');
  return { state: 'finalizing', version: action.runVersion + 1, headSha: action.headSha };
}

function verifyFinalization(
  db: Database.Database,
  action: CoordinatorProofContext,
  proof: Extract<CoordinatorProof, { kind: 'finalization' }>,
): CoordinatorOutcome {
  if (action.phase !== 'finalizing') throw new Error('coordinator phase mismatch');
  const closed = db
    .prepare(
      `SELECT report_json FROM feature_finalizations WHERE run_id=? AND status='closed'
        AND report_digest=? AND closed_at_ms IS NOT NULL`,
    )
    .get(action.runId, proof.reportDigest) as { report_json: string } | undefined;
  if (!closed || digestGovernedValue(JSON.parse(closed.report_json)) !== proof.reportDigest)
    throw new Error('coordinator verified finalization missing');
  const report = z
    .object({
      runId: z.string(),
      featureId: z.string(),
      repository: z.string(),
      childTaskIds: z.array(z.string()).min(1),
    })
    .parse(JSON.parse(closed.report_json));
  const contractRow = db
    .prepare(
      `SELECT c.feature_id,c.workspace_id,c.contract_version,c.policy_digest,c.body_json
    FROM runs r JOIN contracts c ON c.id=r.contract_id WHERE r.id=?`,
    )
    .get(action.runId) as {
    feature_id: string;
    workspace_id: string;
    contract_version: number;
    policy_digest: string;
    body_json: string;
  };
  const contract = JSON.parse(contractRow.body_json) as {
    authority: { github: { repository: string } };
  };
  if (
    report.runId !== action.runId ||
    report.featureId !== contractRow.feature_id ||
    report.repository !== contract.authority.github.repository ||
    !report.childTaskIds?.includes(action.taskId) ||
    contractRow.workspace_id !== action.workspaceId ||
    contractRow.contract_version !== action.contractVersion ||
    contractRow.policy_digest !== action.policyDigest
  )
    throw new Error('coordinator finalization report binding rejected');
  const run = db.prepare('SELECT state,version FROM runs WHERE id=?').get(action.runId) as {
    state: string;
    version: number;
  };
  return { state: 'closed', version: run.version, headSha: action.headSha };
}
