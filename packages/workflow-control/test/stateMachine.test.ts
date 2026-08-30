import { describe, expect, it } from 'vitest';

import { validateTransition, type TransitionContext } from '../src/index.js';

const currentContext: TransitionContext = {
  currentContractVersion: 1,
  requestedContractVersion: 1,
  currentPolicyDigest: 'sha256:current',
  requestedPolicyDigest: 'sha256:current',
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
    ['finalizing', 'closed'],
  ] as const)('accepts the normative edge %s -> %s', (from, to) => {
    expect(() => validateTransition(from, to, currentContext)).not.toThrow();
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

  it('prevents scheduling after a verified merge', () => {
    expect(() =>
      validateTransition('recovering', 'scheduling', {
        ...currentContext,
        recoveryTarget: 'scheduling',
        mergeVerified: true,
      }),
    ).toThrow('verified merge recovery');
  });
});
