import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  taskContractSchema,
  workflowRoleSchema,
  workflowOperationSchema,
  type ExecutionContract,
} from './contracts.js';

export interface EffectiveTaskAuthority {
  task: ExecutionContract['tasks'][number];
  ancestorTaskId: string;
}
const childAuthority = z.object({
  id: z.string(),
  runId: z.string(),
  workspaceId: z.string(),
  contractVersion: z.number(),
  policyDigest: z.string(),
  sequence: z.number().int().positive(),
  chainTipTaskId: z.string(),
  dependsOn: z.string(),
  branchParent: z.string(),
  assignedRole: workflowRoleSchema,
  allowedPaths: z.array(z.string()),
  allowedOperations: z.array(workflowOperationSchema),
  authorityExpanded: z.literal(false),
});
const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/** Resolve only immutable contract tasks or committed, bounded repair descendants.
 * A caller-supplied task ID or a Beads record alone never creates runtime authority.
 */
export function resolveEffectiveTask(
  database: Database.Database,
  contract: ExecutionContract,
  runId: string,
  taskId: string,
  visited = new Set<string>(),
): EffectiveTaskAuthority | undefined {
  const declared = contract.tasks.find((task) => task.id === taskId);
  if (declared) return { task: declared, ancestorTaskId: declared.id };
  if (visited.has(taskId) || visited.size >= contract.repairTaskPolicy.maxChildren)
    throw new Error('repair task ancestry exceeds approved bound');
  visited.add(taskId);
  const row = database
    .prepare(
      `SELECT request_json,chain_tip_task_id FROM repair_child_intents
    WHERE run_id=? AND id=? AND status='committed'`,
    )
    .get(runId, taskId) as { request_json: string; chain_tip_task_id: string } | undefined;
  if (!row) return undefined;
  const child = childAuthority.parse(JSON.parse(row.request_json));
  assertChildBinding(child, row.chain_tip_task_id, contract, runId, taskId);
  const parent = resolveEffectiveTask(database, contract, runId, child.chainTipTaskId, visited);
  if (!parent) throw new Error('repair task approved ancestor missing');
  assertChildPermissions(child, contract);
  return {
    ancestorTaskId: parent.ancestorTaskId,
    task: taskContractSchema.parse({
      ...parent.task,
      id: child.id,
      dependsOn: [child.dependsOn],
      branchParent: child.branchParent,
      assignedRole: child.assignedRole,
      allowedPaths: child.allowedPaths,
      allowedOperations: child.allowedOperations,
    }),
  };
}

function assertChildBinding(
  child: z.infer<typeof childAuthority>,
  storedParent: string,
  contract: ExecutionContract,
  runId: string,
  taskId: string,
): void {
  const expectedParent =
    child.sequence === 1
      ? contract.tasks.at(-1)?.id
      : contract.repairTaskPolicy.idPattern.replace('<sequence>', String(child.sequence - 1));
  if (
    child.chainTipTaskId !== expectedParent ||
    child.id !== taskId ||
    child.runId !== runId ||
    child.workspaceId !== contract.workspaceId ||
    child.contractVersion !== contract.contractVersion ||
    child.policyDigest !== contract.policyDigest ||
    child.sequence > contract.repairTaskPolicy.maxChildren ||
    child.id !==
      contract.repairTaskPolicy.idPattern.replace('<sequence>', String(child.sequence)) ||
    child.chainTipTaskId !== storedParent ||
    child.dependsOn !== child.chainTipTaskId ||
    child.branchParent !== `task/${child.chainTipTaskId}`
  )
    throw new Error('repair task immutable binding rejected');
}

// Repair authority is the frozen feature contract plus its explicit repair policy.
// A QA-only predecessor may legitimately lead to an approved implementation child;
// authorityExpanded=false forbids expansion beyond that envelope, not a change of role.
function assertChildPermissions(
  child: z.infer<typeof childAuthority>,
  contract: ExecutionContract,
): void {
  if (
    !contract.repairTaskPolicy.allowedRoles.includes(child.assignedRole) ||
    child.allowedPaths.some(
      (path) =>
        !contract.constraints.allowedPaths.some((root) => within(path, root)) ||
        !contract.repairTaskPolicy.allowedPaths.some((root) => within(path, root)),
    ) ||
    child.allowedOperations.some(
      (operation) => !contract.authority.allowedActions.includes(operation),
    )
  )
    throw new Error('repair task expands inherited authority');
}
