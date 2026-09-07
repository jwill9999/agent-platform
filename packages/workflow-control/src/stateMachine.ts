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
  'approval_waiting',
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
  implementing: ['task_verification', 'escalated'],
  task_verification: ['task_review', 'repair', 'escalated'],
  task_review: ['task_accepted', 'repair', 'approval_waiting', 'escalated'],
  repair: ['implementing', 'escalated'],
  task_accepted: ['scheduling', 'integration'],
  integration: ['feature_evaluation'],
  feature_evaluation: ['pipeline', 'repair_planning', 'approval_waiting', 'escalated'],
  repair_planning: ['implementing', 'approval_waiting', 'escalated'],
  pipeline: ['delivery', 'repair_planning', 'waiting', 'approval_waiting', 'escalated'],
  waiting: ['pipeline', 'waiting', 'escalated'],
  approval_waiting: [
    'task_accepted',
    'repair',
    'pipeline',
    'repair_planning',
    'implementing',
    'delivery',
    'finalizing',
    'cancelling',
    'escalated',
    'recovering',
  ],
  delivery: ['finalizing', 'approval_waiting', 'escalated'],
  finalizing: ['finalizing', 'closed', 'approval_waiting', 'escalated'],
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
  'approval_waiting',
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
  'approval_waiting',
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
  approval?: {
    predecessor: WorkflowState;
    resumeTarget?: WorkflowState;
    authenticatedApproval: boolean;
    resumeDeliveryAcknowledged: boolean;
    deadlineElapsed: boolean;
  };
}

function validateTransitionFences(from: WorkflowState, context: TransitionContext): void {
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
}

function validateRecoveryEntry(from: WorkflowState, context: TransitionContext): void {
  if (context.recoveryTarget === undefined) {
    throw new Error('recovery entry requires a durable recovery target');
  }
  if (context.mergeVerified && context.recoveryTarget !== 'finalizing') {
    throw new Error('verified merge recovery may only target finalizing');
  }
  if (!context.mergeVerified && context.recoveryTarget !== from) {
    throw new Error('recovery target must equal the interrupted state');
  }
}

function validateRecoveryExit(to: WorkflowState, context: TransitionContext): void {
  if (to === 'escalated') return;
  if (context.recoveryTarget === undefined || to !== context.recoveryTarget) {
    throw new Error('recovery must return to the recorded recovery target');
  }
  if (!recoverableStates.has(to)) throw new Error('invalid recovery target');
  if (context.mergeVerified && to !== 'finalizing') {
    throw new Error('verified merge recovery may only resume finalization');
  }
}

function validateWaitTransition(to: WorkflowState, wait: TransitionContext['wait']): void {
  if (wait === undefined) throw new Error('waiting transition requires wait state');
  const now = Date.parse(wait.now);
  const nextPoll = Date.parse(wait.nextPollAt);
  const deadline = Date.parse(wait.absoluteWaitDeadline);
  if (![now, nextPoll, deadline].every(Number.isFinite) || nextPoll >= deadline) {
    throw new Error('invalid wait timing');
  }
  if (to === 'pipeline' && !wait.matchingEventReceived && now < nextPoll) {
    throw new Error('wait cannot resume before an event or next poll');
  }
  if (to === 'escalated' && now < deadline) {
    throw new Error('wait deadline has not elapsed');
  }
  if (to === 'waiting' && now >= deadline) {
    throw new Error('wait may not retry after its absolute deadline');
  }
}

function validateApprovalTransition(
  to: WorkflowState,
  approval: TransitionContext['approval'],
): void {
  if (approval === undefined) {
    throw new Error('approval waiting transition requires durable approval context');
  }
  if (to === 'escalated') {
    if (!approval.deadlineElapsed) throw new Error('approval deadline has not elapsed');
    return;
  }
  if (to === 'cancelling' || to === 'recovering') return;
  const allowedResumeTargets: Partial<Record<WorkflowState, readonly WorkflowState[]>> = {
    task_review: ['task_accepted', 'repair'],
    feature_evaluation: ['pipeline', 'repair_planning'],
    repair_planning: ['implementing', 'escalated'],
    pipeline: ['delivery', 'repair_planning'],
    delivery: ['finalizing', 'escalated'],
    finalizing: ['finalizing', 'escalated'],
  };
  if (approval.authenticatedApproval !== true || approval.resumeDeliveryAcknowledged !== true) {
    throw new Error('approval resume requires authenticated approval and acknowledged delivery');
  }
  if (!allowedResumeTargets[approval.predecessor]?.includes(to)) {
    throw new Error('approval resume target is not allowed for its predecessor');
  }
  if (approval.resumeTarget !== to || approval.deadlineElapsed) {
    throw new Error('approval resume target or deadline differs from durable intent');
  }
}

export function validateTransition(
  from: WorkflowState,
  to: WorkflowState,
  context: TransitionContext,
): void {
  validateTransitionFences(from, context);
  if (to === 'cancelling' && cancellableStates.has(from)) return;
  if (to === 'recovering' && recoverableStates.has(from)) {
    validateRecoveryEntry(from, context);
    return;
  }
  if (from === 'recovering') {
    validateRecoveryExit(to, context);
    return;
  }
  if (from === 'waiting') validateWaitTransition(to, context.wait);
  if (from === 'approval_waiting') {
    validateApprovalTransition(to, context.approval);
    return;
  }
  if (from === 'finalizing' && to === 'closed' && !context.finalizationVerified) {
    throw new Error('finalization postconditions are not verified');
  }

  if (!NORMATIVE_TRANSITIONS[from]!.includes(to)) {
    throw new Error(`invalid workflow transition: ${from} -> ${to}`);
  }
}
