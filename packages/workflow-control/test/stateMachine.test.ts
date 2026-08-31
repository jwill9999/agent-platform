import { describe, expect, it } from 'vitest';

import {
  NORMATIVE_TRANSITIONS,
  validateTransition,
  type TransitionContext,
  type WorkflowState,
} from '../src/index.js';

const currentContext: TransitionContext = {
  currentContractVersion: 1,
  requestedContractVersion: 1,
  currentPolicyDigest: 'sha256:current',
  requestedPolicyDigest: 'sha256:current',
  workspaceLeaseEpoch: 4,
  actorWorkspaceLeaseEpoch: 4,
  taskLeaseEpoch: 9,
  actorTaskLeaseEpoch: 9,
};

describe('validateTransition', () => {
  it.each([
    ['approved', 'scheduling'],
    ['implementing', 'task_verification'],
    ['task_verification', 'repair'],
    ['task_review', 'task_accepted'],
    ['task_accepted', 'integration'],
    ['pipeline', 'waiting'],
    ['delivery', 'finalizing'],
  ] as const)('accepts the normative edge %s -> %s', (from, to) => {
    expect(() => validateTransition(from, to, currentContext)).not.toThrow();
  });

  it('accepts every ordinary edge in the normative table', () => {
    for (const [from, destinations] of Object.entries(NORMATIVE_TRANSITIONS)) {
      for (const to of destinations) {
        const context: TransitionContext = {
          ...currentContext,
          finalizationVerified: from === 'finalizing' && to === 'closed',
          wait:
            from === 'waiting'
              ? {
                  now: to === 'escalated' ? '2026-08-31T11:00:00.000Z' : '2026-08-31T10:05:00.000Z',
                  nextPollAt: '2026-08-31T10:05:00.000Z',
                  absoluteWaitDeadline: '2026-08-31T11:00:00.000Z',
                  matchingEventReceived: false,
                }
              : undefined,
        };
        expect(() => validateTransition(from as WorkflowState, to, context)).not.toThrow();
      }
    }
  });

  it('rejects all ordinary edges absent from the normative table', () => {
    const states = Object.keys(NORMATIVE_TRANSITIONS) as WorkflowState[];
    for (const from of states) {
      for (const to of states) {
        if (
          NORMATIVE_TRANSITIONS[from].includes(to) ||
          to === 'cancelling' ||
          to === 'recovering' ||
          from === 'recovering'
        ) {
          continue;
        }
        expect(() => validateTransition(from, to, currentContext)).toThrow();
      }
    }
  });

  it('rejects an edge absent from the normative table', () => {
    expect(() => validateTransition('implementing', 'delivery', currentContext)).toThrow(
      'invalid workflow transition',
    );
  });

  it('rejects stale contract and policy versions', () => {
    expect(() =>
      validateTransition('approved', 'scheduling', {
        ...currentContext,
        requestedContractVersion: 0,
      }),
    ).toThrow('stale contract version');
    expect(() =>
      validateTransition('approved', 'scheduling', {
        ...currentContext,
        requestedPolicyDigest: 'sha256:stale',
      }),
    ).toThrow('stale policy digest');
  });

  it('returns recovery only to the recorded target', () => {
    const recoveringContext = { ...currentContext, recoveryTarget: 'pipeline' as const };
    expect(() => validateTransition('recovering', 'pipeline', recoveringContext)).not.toThrow();
    expect(() => validateTransition('recovering', 'scheduling', recoveringContext)).toThrow(
      'recorded recovery target',
    );
  });

  it('allows delivery reconciliation before merge and only finalization afterward', () => {
    expect(() =>
      validateTransition('delivery', 'recovering', {
        ...currentContext,
        recoveryTarget: 'delivery',
      }),
    ).not.toThrow();
    expect(() =>
      validateTransition('recovering', 'delivery', {
        ...currentContext,
        recoveryTarget: 'delivery',
        mergeVerified: false,
      }),
    ).not.toThrow();
    expect(() =>
      validateTransition('recovering', 'delivery', {
        ...currentContext,
        recoveryTarget: 'delivery',
        mergeVerified: true,
      }),
    ).toThrow('only resume finalization');
  });

  it('prevents scheduling after a verified merge', () => {
    expect(() =>
      validateTransition('recovering', 'scheduling', {
        ...currentContext,
        recoveryTarget: 'scheduling',
        mergeVerified: true,
      }),
    ).toThrow('verified merge recovery');
  });

  it('fences stale workspace and task owners', () => {
    expect(() =>
      validateTransition('approved', 'scheduling', {
        ...currentContext,
        actorWorkspaceLeaseEpoch: 3,
      }),
    ).toThrow('stale workspace fencing token');
    expect(() =>
      validateTransition('implementing', 'task_verification', {
        ...currentContext,
        taskLeaseEpoch: 8,
        actorTaskLeaseEpoch: 7,
      }),
    ).toThrow('stale task fencing token');
  });

  it('distinguishes next poll from the absolute wait deadline', () => {
    const wait = {
      now: '2026-08-31T10:00:00.000Z',
      nextPollAt: '2026-08-31T10:05:00.000Z',
      absoluteWaitDeadline: '2026-08-31T11:00:00.000Z',
      matchingEventReceived: false,
    };
    expect(() => validateTransition('waiting', 'pipeline', { ...currentContext, wait })).toThrow(
      'before an event or next poll',
    );
    expect(() =>
      validateTransition('waiting', 'pipeline', {
        ...currentContext,
        wait: { ...wait, matchingEventReceived: true },
      }),
    ).not.toThrow();
    expect(() =>
      validateTransition('waiting', 'escalated', {
        ...currentContext,
        wait: { ...wait, now: '2026-08-31T11:00:00.000Z' },
      }),
    ).not.toThrow();
  });

  it('requires every closeout postcondition before closed', () => {
    expect(() => validateTransition('finalizing', 'closed', currentContext)).toThrow(
      'postconditions',
    );
    expect(() =>
      validateTransition('finalizing', 'closed', {
        ...currentContext,
        finalizationVerified: true,
      }),
    ).not.toThrow();
  });
});
