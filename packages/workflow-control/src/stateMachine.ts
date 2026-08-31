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

export const NORMATIVE_TRANSITIONS: Readonly<Record<WorkflowState, readonly WorkflowState[]>> = {
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
  waiting: ['pipeline', 'waiting', 'escalated'],
  delivery: ['finalizing'],
  finalizing: ['finalizing', 'closed'],
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
  'delivery',
  'finalizing',
]);

const taskFencedStates = new Set<WorkflowState>([
  'implementing',
  'task_verification',
  'task_review',
  'repair',
  'task_accepted',
]);

export interface TransitionContext {
  recoveryTarget?: WorkflowState;
  mergeVerified?: boolean;
  currentContractVersion: number;
  requestedContractVersion: number;
  currentPolicyDigest: string;
  requestedPolicyDigest: string;
  workspaceLeaseEpoch: number;
  actorWorkspaceLeaseEpoch: number;
  taskLeaseEpoch?: number;
  actorTaskLeaseEpoch?: number;
  closeoutLeaseEpoch?: number;
  finalizationVerified?: boolean;
  wait?: {
    now: string;
    nextPollAt: string;
    absoluteWaitDeadline: string;
    matchingEventReceived: boolean;
  };
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
  if (context.actorWorkspaceLeaseEpoch !== context.workspaceLeaseEpoch) {
    throw new Error('stale workspace fencing token');
  }
  if (!Number.isInteger(context.workspaceLeaseEpoch) || context.workspaceLeaseEpoch < 1) {
    throw new Error('invalid workspace fencing token');
  }
  if (
    taskFencedStates.has(from) &&
    (context.taskLeaseEpoch === undefined || context.actorTaskLeaseEpoch === undefined)
  ) {
    throw new Error('task transition requires a fencing token');
  }
  if (context.taskLeaseEpoch !== context.actorTaskLeaseEpoch) {
    throw new Error('stale task fencing token');
  }

  if (to === 'cancelling' && cancellableStates.has(from)) return;
  if (to === 'recovering' && recoverableStates.has(from)) {
    if (context.recoveryTarget === undefined) {
      throw new Error('recovery entry requires a durable recovery target');
    }
    if (context.mergeVerified && context.recoveryTarget !== 'finalizing') {
      throw new Error('verified merge recovery may only target finalizing');
    }
    if (!context.mergeVerified && context.recoveryTarget !== from) {
      throw new Error('recovery target must equal the interrupted state');
    }
    return;
  }

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

  if (from === 'waiting') {
    if (context.wait === undefined) throw new Error('waiting transition requires wait state');
    const now = Date.parse(context.wait.now);
    const nextPoll = Date.parse(context.wait.nextPollAt);
    const deadline = Date.parse(context.wait.absoluteWaitDeadline);
    if (![now, nextPoll, deadline].every(Number.isFinite) || nextPoll >= deadline) {
      throw new Error('invalid wait timing');
    }
    if (to === 'pipeline' && !context.wait.matchingEventReceived && now < nextPoll) {
      throw new Error('wait cannot resume before an event or next poll');
    }
    if (to === 'escalated' && now < deadline) {
      throw new Error('wait deadline has not elapsed');
    }
    if (to === 'waiting' && now >= deadline) {
      throw new Error('wait may not retry after its absolute deadline');
    }
  }

  if (from === 'finalizing' && to === 'closed' && !context.finalizationVerified) {
    throw new Error('finalization postconditions are not verified');
  }

  if (!NORMATIVE_TRANSITIONS[from]!.includes(to)) {
    throw new Error(`invalid workflow transition: ${from} -> ${to}`);
  }
}
