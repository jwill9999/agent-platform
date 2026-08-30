import { z } from 'zod';

export const EXECUTION_CONTRACT_VERSION = 1 as const;

const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const relativePathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith('/') && !path.split('/').includes('..'), {
    message: 'path must be workspace-relative and may not traverse upward',
  });

function isPathWithin(path: string, allowedPath: string): boolean {
  return path === allowedPath || path.startsWith(`${allowedPath}/`);
}

export const workflowRoleSchema = z.enum([
  'feature_planner',
  'plan_critic',
  'workflow_orchestrator',
  'repo_explorer',
  'implementation_worker',
  'code_reviewer',
  'test_runner',
  'qa_evaluator',
  'feature_evaluator',
]);

export const workflowOperationSchema = z.enum([
  'workspace.read',
  'workspace.patch',
  'process.test',
  'artifact.write',
  'workflow.transition',
  'beads.read',
  'beads.mutate',
  'git.read',
  'git.commit',
  'git.push',
  'github.read',
  'github.deliver',
]);

export const evidenceReferenceSchema = z
  .object({
    digest: digestSchema,
    mediaType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    kind: z.enum(['command', 'test', 'artifact', 'review', 'evaluation', 'external']),
  })
  .strict();

export const retryBudgetSchema = z
  .object({
    implementationAttempts: z.number().int().positive(),
    findingAttempts: z.number().int().positive(),
    infrastructureAttempts: z.number().int().positive(),
    waitDeadlineSeconds: z.number().int().positive(),
  })
  .strict();

export const taskContractSchema = z
  .object({
    id: identifierSchema,
    dependsOn: z.array(identifierSchema),
    risk: z.enum(['low', 'standard', 'high']),
    assignedRole: workflowRoleSchema,
    branchParent: z.string().min(1),
    allowedPaths: z.array(relativePathSchema),
    allowedOperations: z.array(workflowOperationSchema),
  })
  .strict()
  .superRefine((task, context) => {
    if (new Set(task.dependsOn).size !== task.dependsOn.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'task dependencies must be unique',
      });
    }
    if (new Set(task.allowedOperations).size !== task.allowedOperations.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'task operations must be unique' });
    }
  });

export const executionContractSchema = z
  .object({
    featureId: identifierSchema,
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digestSchema,
    workspaceId: digestSchema,
    objective: z.string().min(1),
    requirements: z.array(z.string().min(1)),
    nonGoals: z.array(z.string().min(1)),
    acceptanceCriteria: z.array(z.string().min(1)).min(1),
    constraints: z
      .object({
        architecture: z.array(z.string().min(1)),
        security: z.array(z.string().min(1)),
        allowedPaths: z.array(relativePathSchema),
      })
      .strict(),
    authority: z
      .object({
        deliveryTarget: z.string().min(1),
        allowedActions: z.array(workflowOperationSchema),
        github: z
          .object({
            repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/u),
            base: z.string().min(1),
            mergeMethod: z.enum(['merge', 'squash', 'rebase']),
            requiredChecks: z.array(z.string().min(1)),
          })
          .strict(),
      })
      .strict(),
    tasks: z.array(taskContractSchema).min(1),
    qualityGates: z.array(z.string().min(1)),
    retryPolicy: retryBudgetSchema,
    repairTaskPolicy: z
      .object({
        idPattern: z.string().min(1),
        maxChildren: z.number().int().nonnegative(),
        allowedRoles: z.array(workflowRoleSchema),
        allowedPaths: z.array(relativePathSchema),
        authorityMayExpand: z.literal(false),
      })
      .strict(),
    escalationPolicy: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((contract, context) => {
    const taskIds = new Set(contract.tasks.map((task) => task.id));
    const allowedContractPaths = contract.constraints.allowedPaths;
    if (taskIds.size !== contract.tasks.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'task ids must be unique' });
    }
    for (const [index, task] of contract.tasks.entries()) {
      if (task.dependsOn.includes(task.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tasks', index, 'dependsOn'],
          message: 'a task may not depend on itself',
        });
      }
      for (const dependency of task.dependsOn) {
        if (!taskIds.has(dependency)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tasks', index, 'dependsOn'],
            message: `task dependency ${dependency} is not defined by the contract`,
          });
        }
      }
      for (const path of task.allowedPaths) {
        if (!allowedContractPaths.some((allowedPath) => isPathWithin(path, allowedPath))) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tasks', index, 'allowedPaths'],
            message: `task path ${path} expands contract authority`,
          });
        }
      }
      for (const operation of task.allowedOperations) {
        if (!contract.authority.allowedActions.includes(operation)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tasks', index, 'allowedOperations'],
            message: `task operation ${operation} expands contract authority`,
          });
        }
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const tasksById = new Map(contract.tasks.map((task) => [task.id, task]));
    const visit = (taskId: string): boolean => {
      if (visiting.has(taskId)) return true;
      if (visited.has(taskId)) return false;
      visiting.add(taskId);
      for (const dependency of tasksById.get(taskId)?.dependsOn ?? []) {
        if (tasksById.has(dependency) && visit(dependency)) return true;
      }
      visiting.delete(taskId);
      visited.add(taskId);
      return false;
    };
    if (contract.tasks.some((task) => visit(task.id))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'task dependency graph is cyclic' });
    }
  });

export const taskPacketSchema = z
  .object({
    runId: identifierSchema,
    taskId: identifierSchema,
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digestSchema,
    assignedRole: workflowRoleSchema,
    objective: z.string().min(1),
    acceptanceCriteria: z.array(z.string().min(1)).min(1),
    allowedPaths: z.array(relativePathSchema),
    allowedOperations: z.array(workflowOperationSchema),
    retryBudget: retryBudgetSchema,
    evidence: z.array(evidenceReferenceSchema),
  })
  .strict();

export const findingSchema = z
  .object({
    id: identifierSchema,
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    summary: z.string().min(1),
    acceptanceCriterion: z.string().min(1).optional(),
    evidence: z.array(evidenceReferenceSchema).min(1),
    repairHypothesis: z.string().min(1).optional(),
  })
  .strict();

export const agentResultSchema = z
  .object({
    status: z.enum(['passed', 'needs_repair', 'blocked']),
    summary: z.string().min(1),
    changedFiles: z.array(relativePathSchema),
    acceptanceCriteria: z
      .object({ passed: z.array(z.string()), failed: z.array(z.string()) })
      .strict(),
    evidence: z.array(evidenceReferenceSchema),
    findings: z.array(findingSchema),
    remainingRisks: z.array(z.string().min(1)),
    recommendedTransition: z.enum(['continue', 'repair', 'escalate', 'integrate']),
  })
  .strict();

export type ExecutionContract = z.infer<typeof executionContractSchema>;
export type TaskPacket = z.infer<typeof taskPacketSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;
export type WorkflowOperation = z.infer<typeof workflowOperationSchema>;

export function assertTaskPacketWithinContract(contractInput: unknown, packetInput: unknown): void {
  const contract = executionContractSchema.parse(contractInput);
  const packet = taskPacketSchema.parse(packetInput);
  const task = contract.tasks.find((candidate) => candidate.id === packet.taskId);
  if (task === undefined) throw new Error('task packet references an unknown task');
  if (packet.contractVersion !== contract.contractVersion) throw new Error('stale task packet');
  if (packet.policyDigest !== contract.policyDigest) throw new Error('stale task packet policy');
  if (packet.assignedRole !== task.assignedRole)
    throw new Error('task packet changes assigned role');
  if (
    packet.allowedPaths.some((path) => !task.allowedPaths.some((root) => isPathWithin(path, root)))
  ) {
    throw new Error('task packet expands allowed paths');
  }
  if (packet.allowedOperations.some((operation) => !task.allowedOperations.includes(operation))) {
    throw new Error('task packet expands allowed operations');
  }
}
