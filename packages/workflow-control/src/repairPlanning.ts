import type { z } from 'zod';
import {
  agentResultSchema,
  repairPlanningContextSchema,
  type AgentResult,
  type ExecutionContract,
} from './contracts.js';
import { deriveEvaluationDigest, type RepairChildRequest } from './featureEvaluation.js';

export type RepairPlanningContext = z.infer<typeof repairPlanningContextSchema>;

/** A successful planner result means a bounded proposal was produced, not that the
 * feature's acceptance criteria passed. Only a later evaluator can establish that. */
export function assertRepairPlanningResult(
  value: unknown,
  context: RepairPlanningContext,
): AgentResult {
  const result = agentResultSchema.parse(value);
  if (
    result.status !== 'passed' ||
    result.recommendedTransition !== 'continue' ||
    result.changedFiles.length ||
    result.remainingRisks.length ||
    result.acceptanceCriteria.passed.length ||
    result.acceptanceCriteria.failed.length ||
    result.findings.length !== 1
  )
    throw new Error(
      'repair planner must return one bounded proposal without claiming feature acceptance',
    );
  const finding = result.findings[0]!;
  const criterion = context.failedCriteria.find(
    (item) => item.criterion === finding.acceptanceCriterion,
  );
  if (!criterion || !finding.repairHypothesis?.trim())
    throw new Error('repair proposal must explain a failed criterion and repair hypothesis');
  const references = new Set(criterion.evidence.map((reference) => JSON.stringify(reference)));
  if (finding.evidence.some((reference) => !references.has(JSON.stringify(reference))))
    throw new Error('repair proposal evidence differs from the failed evaluation');
  return result;
}

/** Scope comes from approved policy and the predecessor, never a model-selected permission. */
export function buildRepairChildRequest(input: {
  contract: ExecutionContract;
  parent: ExecutionContract['tasks'][number];
  runId: string;
  sequence: number;
  context: RepairPlanningContext;
  terminal: AgentResult;
  remainingRetryBudget: RepairChildRequest['remainingRetryBudget'];
}): RepairChildRequest {
  const { contract, parent, context, runId, sequence } = input;
  const result = assertRepairPlanningResult(input.terminal, context);
  if (!contract.repairTaskPolicy.allowedRoles.includes('implementation_worker'))
    throw new Error('repair implementation role is not approved');
  const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
  const allowedPaths = [
    ...new Set(
      parent.allowedPaths.flatMap((parentPath) =>
        contract.repairTaskPolicy.allowedPaths.flatMap((repairPath) => {
          if (within(parentPath, repairPath)) return [parentPath];
          if (within(repairPath, parentPath)) return [repairPath];
          return [];
        }),
      ),
    ),
  ];
  if (!allowedPaths.length) throw new Error('repair scope has no approved source paths');
  const required = [
    'workspace.read',
    'workspace.patch',
    'artifact.write',
    'workflow.delegate_callback',
    'beads.mutate',
    'git.commit',
  ] as const;
  if (required.some((operation) => !parent.allowedOperations.includes(operation)))
    throw new Error('repair predecessor lacks required implementation and handoff authority');
  return {
    workspaceId: contract.workspaceId,
    runId,
    featureId: contract.featureId,
    id: contract.repairTaskPolicy.idPattern.replace('<sequence>', String(sequence)),
    sequence,
    parentEpicId: contract.featureId,
    dependsOn: parent.id,
    chainTipTaskId: parent.id,
    branchParent: `task/${parent.id}`,
    branchParentSha: context.headSha,
    evaluationId: context.evaluationId,
    finding: result.findings[0]!,
    findingDigest: deriveEvaluationDigest(result.findings[0]),
    remainingRetryBudget: input.remainingRetryBudget,
    assignedRole: 'implementation_worker',
    allowedPaths,
    allowedOperations: parent.allowedOperations,
    authorityExpanded: false,
    actorRole: 'workflow_orchestrator',
    contractVersion: contract.contractVersion,
    policyDigest: contract.policyDigest,
  };
}

export function repairChildContext(request: RepairChildRequest) {
  if (!request.finding.acceptanceCriterion || !request.finding.repairHypothesis)
    throw new Error('repair child proposal context missing');
  return {
    childId: request.id,
    parentTaskId: request.chainTipTaskId,
    evaluationId: request.evaluationId,
    failedCriterion: request.finding.acceptanceCriterion,
    summary: request.finding.summary,
    hypothesis: request.finding.repairHypothesis,
  };
}
