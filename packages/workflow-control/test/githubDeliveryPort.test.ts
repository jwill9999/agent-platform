import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  GitHubDeliveryPort,
  FeatureGitHubDeliveryPort,
  type DeliveryRequest,
  type GitHubPullRequestSnapshot,
  type FeatureDeliveryRequest,
  type NarrowGitHubDeliveryClient,
} from '../src/index.js';

const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;
const protectionDigest = `sha256:${'c'.repeat(64)}`;
const headSha = '2'.repeat(40);

class MemoryGitHubClient implements NarrowGitHubDeliveryClient {
  snapshot: GitHubPullRequestSnapshot | null = null;
  creates = 0;
  merges = 0;

  async findPullRequest(): Promise<GitHubPullRequestSnapshot | null> {
    return this.snapshot;
  }

  async createPullRequest(request: Extract<DeliveryRequest, { kind: 'github.pr' }>): Promise<void> {
    this.creates += 1;
    this.snapshot = snapshot({
      headRef: request.headRef,
      headSha: request.headSha,
      base: request.base,
      title: request.title,
      bodyDigest: request.bodyDigest,
    });
  }

  async mergePullRequest(
    request: Extract<DeliveryRequest, { kind: 'github.merge' }>,
  ): Promise<void> {
    if (this.snapshot === null) throw new Error('PR disappeared');
    if (
      this.snapshot.headSha !== request.headSha ||
      this.snapshot.base !== request.base ||
      this.snapshot.protectionDigest !== request.protectionDigest ||
      this.snapshot.reviewDecision !== 'approved' ||
      request.requiredChecks.some((check) => this.snapshot?.checks[check] !== 'success')
    ) {
      throw new Error('conditional merge precondition changed');
    }
    this.merges += 1;
    this.snapshot = {
      ...this.snapshot,
      state: 'merged',
      mergeMethod: request.mergeMethod,
      mergeSha: '3'.repeat(40),
      eventIdentity: 'event-merged',
      mergeAttestation: {
        headSha: request.headSha,
        base: request.base,
        requiredChecks: [...request.requiredChecks],
        protectionDigest: request.protectionDigest,
        reviewDecision: request.reviewDecision,
        mergeMethod: request.mergeMethod,
        mergeSha: '3'.repeat(40),
        eventIdentity: 'event-merged',
      },
    };
  }
}

function snapshot(override: Partial<GitHubPullRequestSnapshot> = {}): GitHubPullRequestSnapshot {
  return {
    number: 7,
    repository: 'example/repository',
    headRef: 'task/delivery-feature.7',
    headSha,
    base: 'staging',
    title: 'Deliver feature',
    bodyDigest: `sha256:${'d'.repeat(64)}`,
    state: 'open',
    protectionDigest,
    reviewDecision: 'approved',
    checks: { test: 'success', review: 'success' },
    mergeMethod: null,
    mergeSha: null,
    eventIdentity: 'event-open',
    mergeAttestation: null,
    ...override,
  };
}

function binding() {
  return {
    workspaceId,
    runId: 'run-delivery',
    taskId: 'delivery-feature.7',
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator' as const,
    contractVersion: 1 as const,
    policyDigest,
  };
}

function mergeRequest(): Extract<DeliveryRequest, { kind: 'github.merge' }> {
  return {
    ...binding(),
    kind: 'github.merge',
    pullRequestNumber: 7,
    headSha,
    base: 'staging',
    requiredChecks: ['test', 'review'],
    protectionDigest,
    reviewDecision: 'approved',
    mergeMethod: 'squash',
    adminBypass: false,
  };
}

describe('GitHubDeliveryPort', () => {
  it('creates one exact PR and observes an idempotent replay', async () => {
    const client = new MemoryGitHubClient();
    const port = new GitHubDeliveryPort(client, 'example/repository');
    const body = 'Approved delivery evidence';
    const request: DeliveryRequest = {
      ...binding(),
      kind: 'github.pr',
      headRef: 'task/delivery-feature.7',
      headSha,
      base: 'staging',
      title: 'Deliver feature',
      body,
      bodyDigest: `sha256:${createHash('sha256').update(body).digest('hex')}`,
    };

    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'unchanged' });
    await port.mutate(request);
    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'expected' });
    expect(client.creates).toBe(1);
  });

  it('returns exact check observations without exposing a mutation path', async () => {
    const client = new MemoryGitHubClient();
    client.snapshot = snapshot({ checks: { test: 'success', review: 'pending' } });
    const port = new GitHubDeliveryPort(client, 'example/repository');
    const request: DeliveryRequest = {
      ...binding(),
      kind: 'github.checks',
      pullRequestNumber: 7,
      headSha,
      base: 'staging',
      requiredChecks: ['test', 'review'],
      protectionDigest,
      pollAttempt: 0,
    };

    await expect(port.observe(request)).resolves.toMatchObject({
      kind: 'expected',
      result: { checks: { test: 'success', review: 'pending' }, eventIdentity: 'event-open' },
    });
    await expect(port.mutate(request)).rejects.toThrow('read-only');
  });

  it.each([
    ['stale head', { headSha: '9'.repeat(40) }],
    ['changed base', { base: 'main' }],
    ['changed protection', { protectionDigest: `sha256:${'f'.repeat(64)}` }],
    ['missing approval', { reviewDecision: 'review_required' as const }],
    ['failed check', { checks: { test: 'failure' as const, review: 'success' as const } }],
  ])('rejects merge when GitHub reports %s', async (_name, override) => {
    const client = new MemoryGitHubClient();
    client.snapshot = snapshot(override);
    const port = new GitHubDeliveryPort(client, 'example/repository');

    await expect(port.observe(mergeRequest())).resolves.toMatchObject({ kind: 'conflict' });
    expect(client.merges).toBe(0);
  });

  it('conditionally merges and recognizes the exact merged result', async () => {
    const client = new MemoryGitHubClient();
    client.snapshot = snapshot();
    const port = new GitHubDeliveryPort(client, 'example/repository');
    const request = mergeRequest();
    let redirected = false;
    client.findPullRequest = async () => {
      redirected = true;
      return null;
    };
    client.mergePullRequest = async () => {
      redirected = true;
    };

    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'unchanged' });
    await port.mutate(request);
    expect(redirected).toBe(false);
    if (client.snapshot === null) throw new Error('expected merged snapshot');
    const mergedSnapshot = client.snapshot;
    client.snapshot = {
      ...mergedSnapshot,
      protectionDigest: `sha256:${'f'.repeat(64)}`,
      checks: { test: 'failure', review: 'success' },
    };
    await expect(port.observe(request)).resolves.toMatchObject({
      kind: 'expected',
      result: { mergeSha: '3'.repeat(40), mergeMethod: 'squash' },
    });
    expect(client.merges).toBe(1);

    for (const identityChange of [
      { number: 8 },
      { repository: 'attacker/repository' },
      { headRef: 'task/another-task' },
    ]) {
      client.snapshot = { ...mergedSnapshot, ...identityChange };
      await expect(port.observe(request)).resolves.toMatchObject({ kind: 'conflict' });
    }
  });
});

describe('FeatureGitHubDeliveryPort', () => {
  it('conditionally merges only the exact feature head into staging', async () => {
    let featureSnapshot = snapshot({
      number: 12,
      headRef: 'feature/delivery-feature',
      base: 'staging',
    });
    let merges = 0;
    const client = {
      async findPullRequest() {
        return featureSnapshot;
      },
      async createPullRequest() {
        throw new Error('not used');
      },
      async mergePullRequest(
        request: Extract<FeatureDeliveryRequest, { kind: 'feature.github.merge' }>,
      ) {
        merges += 1;
        featureSnapshot = {
          ...featureSnapshot,
          state: 'merged' as const,
          mergeMethod: request.mergeMethod,
          mergeSha: '4'.repeat(40),
          eventIdentity: 'feature-merged',
          mergeAttestation: {
            headSha: request.headSha,
            base: request.base,
            requiredChecks: [...request.requiredChecks],
            protectionDigest: request.protectionDigest,
            reviewDecision: request.reviewDecision,
            mergeMethod: request.mergeMethod,
            mergeSha: '4'.repeat(40),
            eventIdentity: 'feature-merged',
          },
        };
      },
    };
    const port = FeatureGitHubDeliveryPort.createForTest({
      client,
      repository: 'example/repository',
      workspaceRoot: process.cwd(),
    });
    const request: FeatureDeliveryRequest = {
      workspaceId,
      runId: 'run-delivery',
      taskId: 'delivery-feature.7',
      repository: 'example/repository',
      actorRole: 'workflow_orchestrator',
      executionContractVersion: 1,
      policyDigest,
      featureContractVersion: 1,
      featureContractDigest: `sha256:${'6'.repeat(64)}`,
      originMergeOperationId: `sha256:${'7'.repeat(64)}`,
      originMergeAttestationDigest: `sha256:${'8'.repeat(64)}`,
      originPullRequestNumber: 11,
      originTaskHeadSha: '1'.repeat(40),
      kind: 'feature.github.merge',
      pullRequestNumber: 12,
      headRef: 'feature/delivery-feature',
      headSha,
      base: 'staging',
      requiredChecks: ['test', 'review'],
      protectionDigest,
      reviewDecision: 'approved',
      mergeMethod: 'squash',
      adminBypass: false,
    };

    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'unchanged' });
    await port.mutate(request);
    await expect(port.observe(request)).resolves.toMatchObject({
      kind: 'expected',
      result: { mergeSha: '4'.repeat(40), base: 'staging' },
    });
    expect(merges).toBe(1);

    featureSnapshot = { ...featureSnapshot, headSha: '9'.repeat(40), state: 'open' };
    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'conflict' });
  });
});
