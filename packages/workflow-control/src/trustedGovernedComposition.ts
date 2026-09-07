import { assertAuthenticatedGitHubDeliveryPort, GitHubDeliveryPort } from './githubDeliveryPort.js';
import {
  createProductionGovernedExternalPort,
  type GovernedMutationPort,
  type NarrowBeadsNotesClient,
  type NarrowGitHubReviewClient,
  type NarrowGovernedExternalClient,
} from './governedOperations.js';
import { OfficialBeadsDoltPort } from './reconciliation.js';

/** Trusted composition root for the frozen official-Beads and hardened-GitHub governed adapter. */
export function createTrustedGovernedExternalPort(input: {
  workspaceId: string;
  beads: OfficialBeadsDoltPort;
  github: GitHubDeliveryPort;
}): GovernedMutationPort {
  assertAuthenticatedGitHubDeliveryPort(input.github);
  if (
    !(input.beads instanceof OfficialBeadsDoltPort) ||
    Object.getPrototypeOf(input.beads) !== OfficialBeadsDoltPort.prototype ||
    !(input.github instanceof GitHubDeliveryPort) ||
    Object.getPrototypeOf(input.github) !== GitHubDeliveryPort.prototype ||
    !Object.isFrozen(input.beads) ||
    !Object.isFrozen(input.github)
  ) {
    throw new Error('trusted composition requires hardened official port instances');
  }
  if (input.workspaceId.trim() === '' || input.beads.workspaceRoot.trim() === '') {
    throw new Error('trusted Beads route binding is required');
  }
  const client: NarrowGovernedExternalClient = Object.freeze({
    readIssue: async (
      workspaceId: Parameters<NarrowBeadsNotesClient['readIssue']>[0],
      taskId: Parameters<NarrowBeadsNotesClient['readIssue']>[1],
    ) => {
      if (workspaceId !== input.workspaceId) throw new Error('Beads workspace route changed');
      return input.beads.readIssueWithNotes(taskId);
    },
    compareAndSwapNotes: async (
      request: Parameters<NarrowBeadsNotesClient['compareAndSwapNotes']>[0],
    ) => {
      if (request.workspaceId !== input.workspaceId)
        throw new Error('Beads workspace route changed');
      return input.beads.compareAndSwapIssueNotes({
        ...request,
      });
    },
    observeThreads: async (request: Parameters<NarrowGitHubReviewClient['observeThreads']>[0]) => {
      if (request.repository !== input.github.repository)
        throw new Error('GitHub repository route changed');
      return input.github.observeReviewThreads(request);
    },
    replyToThread: async (request: Parameters<NarrowGitHubReviewClient['replyToThread']>[0]) => {
      if (request.repository !== input.github.repository)
        throw new Error('GitHub repository route changed');
      return input.github.replyToReviewThread(request);
    },
    resolveThread: async (request: Parameters<NarrowGitHubReviewClient['resolveThread']>[0]) => {
      if (request.repository !== input.github.repository)
        throw new Error('GitHub repository route changed');
      return input.github.resolveReviewThread(request);
    },
  });
  return createProductionGovernedExternalPort(client);
}
