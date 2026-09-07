import { realpathSync } from 'node:fs';

import type { DeliveryMutationPort, DeliveryRequest } from './deliveryBrokers.js';
import { registerProductionDeliveryPort } from './deliveryPortCapability.js';
import type {
  FeatureDeliveryMutationPort,
  FeatureDeliveryRequest,
} from './featureDeliveryBroker.js';
import type { ExternalObservation } from './reconciliation.js';

type GitHubRequest = Extract<DeliveryRequest, { kind: `github.${string}` }>;
const productionGitHubPortCapability = Symbol('productionGitHubPortCapability');
const testGitHubPortCapability = Symbol('testGitHubPortCapability');
const authenticatedGitHubPorts = new WeakSet<object>();

export type GitHubCheckConclusion = 'pending' | 'success' | 'failure';

export interface GitHubPullRequestSnapshot {
  number: number;
  repository: string;
  headRef: string;
  headSha: string;
  base: string;
  title: string;
  bodyDigest: string;
  state: 'open' | 'merged' | 'closed';
  protectionDigest: string;
  reviewDecision: 'approved' | 'changes_requested' | 'review_required';
  checks: Readonly<Record<string, GitHubCheckConclusion>>;
  mergeMethod: 'merge' | 'squash' | 'rebase' | null;
  mergeSha: string | null;
  eventIdentity: string;
  latestReviewEventIdentity: string;
  reviewThreads: readonly {
    id: string;
    isResolved: boolean;
    headSha: string;
    reviewEventIdentity: string;
    acceptedDispositionDigest: string | null;
  }[];
  mergeAttestation: {
    headSha: string;
    base: string;
    requiredChecks: string[];
    protectionDigest: string;
    reviewDecision: 'approved';
    mergeMethod: 'merge' | 'squash' | 'rebase';
    mergeSha: string;
    eventIdentity: string;
  } | null;
}

export interface NarrowGitHubDeliveryClient {
  findPullRequest(input: {
    repository: string;
    headRef?: string;
    number?: number;
  }): Promise<GitHubPullRequestSnapshot | null>;
  createPullRequest(request: Extract<GitHubRequest, { kind: 'github.pr' }>): Promise<void>;
  compareAndMergePullRequest(
    request: Extract<GitHubRequest, { kind: 'github.merge' }> & {
      expectedReviewEventIdentity: string;
      verifiedObservationDigest: string;
    },
  ): Promise<void>;
  observeReviewThreads?(input: {
    repository: string;
    pullRequestNumber: number;
    headSha: string;
  }): Promise<readonly import('./governedOperations.js').ReviewThreadSnapshot[]>;
  replyToReviewThread?(input: {
    repository: string;
    pullRequestNumber: number;
    threadId: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ messageId: string }>;
  resolveReviewThread?(input: {
    repository: string;
    pullRequestNumber: number;
    threadId: string;
    expectedHeadSha: string;
    expectedReviewEventIdentity: string;
    idempotencyKey: string;
  }): Promise<{ resolved: true }>;
}

export interface NarrowFeatureGitHubDeliveryClient {
  findPullRequest: NarrowGitHubDeliveryClient['findPullRequest'];
  createPullRequest(
    request: Extract<FeatureDeliveryRequest, { kind: 'feature.github.pr' }>,
  ): Promise<void>;
  mergePullRequest(
    request: Extract<FeatureDeliveryRequest, { kind: 'feature.github.merge' }>,
  ): Promise<void>;
}

function exactChecks(
  snapshot: GitHubPullRequestSnapshot,
  requiredChecks: readonly string[],
): boolean {
  const observed = Object.keys(snapshot.checks).sort((left, right) => left.localeCompare(right));
  const required = [...requiredChecks].sort((left, right) => left.localeCompare(right));
  return (
    observed.length === required.length &&
    observed.every((check, index) => check === required[index])
  );
}

function commonIdentityMatches(
  request: Extract<GitHubRequest, { kind: 'github.checks' | 'github.merge' }>,
  snapshot: GitHubPullRequestSnapshot,
): boolean {
  return (
    snapshot.number === request.pullRequestNumber &&
    snapshot.repository === request.repository &&
    snapshot.headSha === request.headSha &&
    snapshot.base === request.base &&
    snapshot.protectionDigest === request.protectionDigest &&
    exactChecks(snapshot, request.requiredChecks)
  );
}

export class GitHubDeliveryPort implements DeliveryMutationPort {
  readonly #findPullRequest: NarrowGitHubDeliveryClient['findPullRequest'];
  readonly #createPullRequest: NarrowGitHubDeliveryClient['createPullRequest'];
  readonly #compareAndMergePullRequest: NarrowGitHubDeliveryClient['compareAndMergePullRequest'];
  readonly #observeReviewThreads: NarrowGitHubDeliveryClient['observeReviewThreads'];
  readonly #replyToReviewThread: NarrowGitHubDeliveryClient['replyToReviewThread'];
  readonly #resolveReviewThread: NarrowGitHubDeliveryClient['resolveReviewThread'];

  constructor(
    client: NarrowGitHubDeliveryClient,
    readonly repository: string,
    capability: symbol,
  ) {
    if (
      capability !== productionGitHubPortCapability &&
      !(process.env.NODE_ENV === 'test' && capability === testGitHubPortCapability)
    ) {
      throw new Error('GitHub port construction requires the package bootstrap capability');
    }
    this.#findPullRequest = client.findPullRequest.bind(client);
    this.#createPullRequest = client.createPullRequest.bind(client);
    this.#compareAndMergePullRequest = client.compareAndMergePullRequest.bind(client);
    this.#observeReviewThreads = client.observeReviewThreads?.bind(client);
    this.#replyToReviewThread = client.replyToReviewThread?.bind(client);
    this.#resolveReviewThread = client.resolveReviewThread?.bind(client);
    authenticatedGitHubPorts.add(this);
    Object.freeze(this);
  }

  static createForTest(client: NarrowGitHubDeliveryClient, repository: string): GitHubDeliveryPort {
    if (process.env.NODE_ENV !== 'test') throw new Error('test GitHub client is unavailable');
    return new GitHubDeliveryPort(client, repository, testGitHubPortCapability);
  }

  async observeReviewThreads(
    input: Parameters<NonNullable<NarrowGitHubDeliveryClient['observeReviewThreads']>>[0],
  ) {
    if (input.repository !== this.repository) throw new Error('GitHub repository route changed');
    if (this.#observeReviewThreads === undefined)
      throw new Error('hardened GitHub port lacks review-thread observation');
    return this.#observeReviewThreads(input);
  }

  async replyToReviewThread(
    input: Parameters<NonNullable<NarrowGitHubDeliveryClient['replyToReviewThread']>>[0],
  ) {
    if (input.repository !== this.repository) throw new Error('GitHub repository route changed');
    if (this.#replyToReviewThread === undefined)
      throw new Error('hardened GitHub port lacks review-thread reply');
    return this.#replyToReviewThread(input);
  }

  async resolveReviewThread(
    input: Parameters<NonNullable<NarrowGitHubDeliveryClient['resolveReviewThread']>>[0],
  ) {
    if (input.repository !== this.repository) throw new Error('GitHub repository route changed');
    if (this.#resolveReviewThread === undefined)
      throw new Error('hardened GitHub port lacks review-thread resolve');
    return this.#resolveReviewThread(input);
  }

  async observe(request: DeliveryRequest): Promise<ExternalObservation> {
    if (!request.kind.startsWith('github.')) {
      throw new Error('GitHub delivery port received a Git request');
    }
    const githubRequest = request as GitHubRequest;
    if (githubRequest.repository !== this.repository) {
      throw new Error('GitHub delivery request differs from the port repository binding');
    }
    if (githubRequest.kind === 'github.pr') {
      const snapshot = await this.#findPullRequest({
        repository: githubRequest.repository,
        headRef: githubRequest.headRef,
      });
      if (snapshot === null) return { kind: 'unchanged', result: { exists: false } };
      if (
        snapshot.repository === githubRequest.repository &&
        snapshot.headRef === githubRequest.headRef &&
        snapshot.headSha === githubRequest.headSha &&
        snapshot.base === githubRequest.base &&
        snapshot.title === githubRequest.title &&
        snapshot.bodyDigest === githubRequest.bodyDigest &&
        snapshot.state === 'open'
      ) {
        return { kind: 'expected', result: snapshot };
      }
      return { kind: 'conflict', result: snapshot };
    }

    const snapshot = await this.#findPullRequest({
      repository: githubRequest.repository,
      number: githubRequest.pullRequestNumber,
    });
    if (githubRequest.kind === 'github.merge' && snapshot?.state === 'merged') {
      const attestation = snapshot.mergeAttestation;
      if (
        snapshot.number === githubRequest.pullRequestNumber &&
        snapshot.repository === githubRequest.repository &&
        snapshot.headRef === `task/${githubRequest.taskId}` &&
        attestation !== null &&
        attestation.headSha === githubRequest.headSha &&
        attestation.base === githubRequest.base &&
        exactStringSet(attestation.requiredChecks, githubRequest.requiredChecks) &&
        attestation.protectionDigest === githubRequest.protectionDigest &&
        attestation.reviewDecision === githubRequest.reviewDecision &&
        attestation.mergeMethod === githubRequest.mergeMethod
      ) {
        return {
          kind: 'expected',
          result: {
            pullRequestNumber: snapshot.number,
            mergeSha: attestation.mergeSha,
            headSha: attestation.headSha,
            base: attestation.base,
            mergeMethod: attestation.mergeMethod,
            eventIdentity: attestation.eventIdentity,
          },
        };
      }
      return { kind: 'conflict', result: snapshot };
    }
    if (snapshot === null || !commonIdentityMatches(githubRequest, snapshot)) {
      return { kind: 'conflict', result: snapshot ?? { exists: false } };
    }
    if (githubRequest.kind === 'github.checks') {
      return {
        kind: 'expected',
        result: {
          pullRequestNumber: snapshot.number,
          headSha: snapshot.headSha,
          base: snapshot.base,
          protectionDigest: snapshot.protectionDigest,
          checks: snapshot.checks,
          eventIdentity: snapshot.eventIdentity,
        },
      };
    }
    const allChecksPass = githubRequest.requiredChecks.every(
      (check) => snapshot.checks[check] === 'success',
    );
    const reviewThreadsAreCurrent = snapshot.reviewThreads.every(
      (thread) =>
        thread.headSha === githubRequest.headSha &&
        thread.reviewEventIdentity === snapshot.latestReviewEventIdentity,
    );
    if (
      snapshot.state !== 'open' ||
      snapshot.reviewDecision !== githubRequest.reviewDecision ||
      !allChecksPass ||
      !reviewThreadsAreCurrent
    ) {
      return { kind: 'conflict', result: snapshot };
    }
    return {
      kind: 'unchanged',
      result: {
        repository: snapshot.repository,
        pullRequestNumber: snapshot.number,
        headSha: snapshot.headSha,
        base: snapshot.base,
        protectionDigest: snapshot.protectionDigest,
        reviewDecision: snapshot.reviewDecision,
        requiredChecks: [...githubRequest.requiredChecks],
        checks: snapshot.checks,
        reviewEventIdentity: snapshot.latestReviewEventIdentity,
        threads: snapshot.reviewThreads,
      },
    };
  }

  async mutate(
    request: DeliveryRequest,
    verifiedMergePrecondition?: {
      reviewEventIdentity: string;
      verifiedObservationDigest: string;
    },
  ): Promise<unknown> {
    if (!request.kind.startsWith('github.')) {
      throw new Error('GitHub delivery port received a Git request');
    }
    const githubRequest = request as GitHubRequest;
    if (githubRequest.repository !== this.repository) {
      throw new Error('GitHub delivery request differs from the port repository binding');
    }
    if (githubRequest.kind === 'github.pr') {
      await this.#createPullRequest(githubRequest);
      return { created: true };
    }
    if (githubRequest.kind === 'github.checks') {
      throw new Error('check observation is read-only and cannot mutate GitHub');
    }

    // The typed client must perform the same head/base/check/review/protection comparison as one
    // conditional server-side merge. It receives no arbitrary API route, workflow, or admin flag.
    if (verifiedMergePrecondition === undefined) {
      throw new Error('conditional merge lacks a durable verified provider precondition');
    }
    await this.#compareAndMergePullRequest({
      ...githubRequest,
      expectedReviewEventIdentity: verifiedMergePrecondition.reviewEventIdentity,
      verifiedObservationDigest: verifiedMergePrecondition.verifiedObservationDigest,
    });
    return { merged: true };
  }
}

Object.freeze(GitHubDeliveryPort.prototype);

export function assertAuthenticatedGitHubDeliveryPort(port: GitHubDeliveryPort): void {
  if (!authenticatedGitHubPorts.has(port)) throw new Error('unauthenticated GitHub delivery port');
}

// Package-internal bootstrap only. Deliberately omitted from the package index.
export function createProductionGitHubDeliveryPort(
  client: NarrowGitHubDeliveryClient,
  repository: string,
): GitHubDeliveryPort {
  return new GitHubDeliveryPort(client, repository, productionGitHubPortCapability);
}

export class FeatureGitHubDeliveryPort implements FeatureDeliveryMutationPort {
  readonly #findPullRequest: NarrowFeatureGitHubDeliveryClient['findPullRequest'];
  readonly #createPullRequest: NarrowFeatureGitHubDeliveryClient['createPullRequest'];
  readonly #mergePullRequest: NarrowFeatureGitHubDeliveryClient['mergePullRequest'];
  readonly workspaceRoot: string;
  readonly observe: (request: FeatureDeliveryRequest) => Promise<ExternalObservation>;
  readonly mutate: (request: FeatureDeliveryRequest) => Promise<unknown>;

  private constructor(
    client: NarrowFeatureGitHubDeliveryClient,
    readonly repository: string,
    workspaceRoot: string,
  ) {
    this.#findPullRequest = client.findPullRequest.bind(client);
    this.#createPullRequest = client.createPullRequest.bind(client);
    this.#mergePullRequest = client.mergePullRequest.bind(client);
    this.workspaceRoot = realpathSync(workspaceRoot);
    this.observe = this.#observeRequest.bind(this);
    this.mutate = this.#mutateRequest.bind(this);
  }

  static create(input: {
    client: NarrowFeatureGitHubDeliveryClient;
    repository: string;
    workspaceRoot: string;
  }): FeatureGitHubDeliveryPort {
    return registerProductionDeliveryPort(
      new FeatureGitHubDeliveryPort(input.client, input.repository, input.workspaceRoot),
    );
  }

  static createForTest(input: {
    client: NarrowFeatureGitHubDeliveryClient;
    repository: string;
    workspaceRoot: string;
  }): FeatureGitHubDeliveryPort {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test feature GitHub delivery port is unavailable outside tests');
    }
    return new FeatureGitHubDeliveryPort(input.client, input.repository, input.workspaceRoot);
  }

  async #observeRequest(request: FeatureDeliveryRequest): Promise<ExternalObservation> {
    if (request.repository !== this.repository) {
      throw new Error('feature GitHub request differs from the port repository binding');
    }
    if (request.kind === 'feature.github.pr') {
      const snapshot = await this.#findPullRequest({
        repository: request.repository,
        headRef: request.headRef,
      });
      if (snapshot === null) return { kind: 'unchanged', result: { exists: false } };
      if (
        snapshot.repository === request.repository &&
        snapshot.headRef === request.headRef &&
        snapshot.headSha === request.headSha &&
        snapshot.base === request.base &&
        snapshot.title === request.title &&
        snapshot.bodyDigest === request.bodyDigest &&
        snapshot.state === 'open'
      ) {
        return { kind: 'expected', result: snapshot };
      }
      return { kind: 'conflict', result: snapshot };
    }

    const snapshot = await this.#findPullRequest({
      repository: request.repository,
      number: request.pullRequestNumber,
    });
    if (request.kind === 'feature.github.merge' && snapshot?.state === 'merged') {
      const attestation = snapshot.mergeAttestation;
      if (
        snapshot.number === request.pullRequestNumber &&
        snapshot.repository === request.repository &&
        snapshot.headRef === request.headRef &&
        attestation !== null &&
        attestation.headSha === request.headSha &&
        attestation.base === request.base &&
        exactStringSet(attestation.requiredChecks, request.requiredChecks) &&
        attestation.protectionDigest === request.protectionDigest &&
        attestation.reviewDecision === request.reviewDecision &&
        attestation.mergeMethod === request.mergeMethod
      ) {
        return {
          kind: 'expected',
          result: {
            pullRequestNumber: snapshot.number,
            mergeSha: attestation.mergeSha,
            headSha: attestation.headSha,
            base: attestation.base,
            mergeMethod: attestation.mergeMethod,
            eventIdentity: attestation.eventIdentity,
          },
        };
      }
      return { kind: 'conflict', result: snapshot };
    }
    if (
      snapshot === null ||
      snapshot.number !== request.pullRequestNumber ||
      snapshot.repository !== request.repository ||
      snapshot.headRef !== request.headRef ||
      snapshot.headSha !== request.headSha ||
      snapshot.base !== request.base ||
      snapshot.protectionDigest !== request.protectionDigest ||
      !exactStringSet(Object.keys(snapshot.checks), request.requiredChecks)
    ) {
      return { kind: 'conflict', result: snapshot ?? { exists: false } };
    }
    if (request.kind === 'feature.github.checks') {
      return {
        kind: 'expected',
        result: {
          pullRequestNumber: snapshot.number,
          headSha: snapshot.headSha,
          base: snapshot.base,
          protectionDigest: snapshot.protectionDigest,
          checks: snapshot.checks,
          eventIdentity: snapshot.eventIdentity,
        },
      };
    }
    const allChecksPass = request.requiredChecks.every(
      (check) => snapshot.checks[check] === 'success',
    );
    if (
      snapshot.state !== 'open' ||
      snapshot.reviewDecision !== request.reviewDecision ||
      !allChecksPass
    ) {
      return { kind: 'conflict', result: snapshot };
    }
    return { kind: 'unchanged', result: { pullRequestNumber: snapshot.number } };
  }

  async #mutateRequest(request: FeatureDeliveryRequest): Promise<unknown> {
    if (request.repository !== this.repository) {
      throw new Error('feature GitHub request differs from the port repository binding');
    }
    if (request.kind === 'feature.github.pr') {
      await this.#createPullRequest(request);
      return { created: true };
    }
    if (request.kind === 'feature.github.checks') {
      throw new Error('feature checks are read-only and cannot mutate GitHub');
    }
    await this.#mergePullRequest(request);
    return { merged: true };
  }
}

function exactStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  const sortedActual = [...actual].sort((left, right) => left.localeCompare(right));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right));
  return (
    actual.length === expected.length &&
    sortedActual.every((value, index) => value === sortedExpected[index])
  );
}
