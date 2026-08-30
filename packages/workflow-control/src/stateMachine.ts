import { z } from 'zod';

export const workflowStateSchema = z.enum([
  'approved',
  'scheduling',
  'implementing',
  'task_verification',
  'task_review',
  'repair',
  'task_accepted',
  'integration',
  'feature_evaluation',
  'repair_planning',
  'pipeline',
  'waiting',
  'delivery',
  'finalizing',
  'cancelling',
  'cancelled',
  'recovering',
  'escalated',
  'closed',
]);

export type WorkflowState = z.infer<typeof workflowStateSchema>;

const ordinaryEdges: Readonly<Record<WorkflowState, readonly WorkflowState[]>> = {
  approved: ['scheduling'],
  scheduling: ['implementing'],
  implementing: ['task_verification'],
  task_verification: ['task_review', 'repair'],
  task_review: ['task_accepted', 'repair'],
  repair: ['implementing', 'escalated'],
  task_accepted: ['scheduling', 'integration'],
  integration: ['feature_evaluation'],
  feature_evaluation: ['pipeline', 'repair_planning'],
  repair_planning: ['implementing', 'escalated'],
  pipeline: ['delivery', 'repair_planning', 'waiting'],
  waiting: ['pipeline', 'escalated'],
  delivery: ['finalizing'],
  finalizing: ['closed'],
  cancelling: ['cancelled', 'escalated'],
  cancelled: [],
  recovering: [],
  escalated: ['scheduling'],
  closed: [],
};

const cancellableStates = new Set<WorkflowState>([
  'approved',
  'scheduling',
  'implementing',
  'task_verification',
  'task_review',
  'repair',
  'task_accepted',
  'integration',
  'feature_evaluation',
  'repair_planning',
  'pipeline',
  'waiting',
  'delivery',
  'finalizing',
  'recovering',
  'escalated',
]);

const recoverableStates = new Set<WorkflowState>([
  'scheduling',
  'implementing',
  'repair',
  'pipeline',
  'waiting',
  'finalizing',
]);

export interface TransitionContext {
  recoveryTarget?: WorkflowState;
  mergeVerified?: boolean;
  currentContractVersion: number;
  requestedContractVersion: number;
  currentPolicyDigest: string;
  requestedPolicyDigest: string;
}

export function validateTransition(
  from: WorkflowState,
  to: WorkflowState,
  context: TransitionContext,
): void {
  if (context.requestedContractVersion !== context.currentContractVersion) {
    throw new Error('stale contract version');
  }
  if (context.requestedPolicyDigest !== context.currentPolicyDigest) {
    throw new Error('stale policy digest');
  }

  if (to === 'cancelling' && cancellableStates.has(from)) return;
  if (to === 'recovering' && recoverableStates.has(from)) return;

  if (from === 'recovering') {
    if (to === 'escalated') return;
    if (context.recoveryTarget === undefined || to !== context.recoveryTarget) {
      throw new Error('recovery must return to the recorded recovery target');
    }
    if (!recoverableStates.has(to)) throw new Error('invalid recovery target');
    if (context.mergeVerified && to !== 'finalizing') {
      throw new Error('verified merge recovery may only resume finalization');
    }
    return;
  }

  if (!ordinaryEdges[from]!.includes(to)) {
    throw new Error(`invalid workflow transition: ${from} -> ${to}`);
  }
}
