// Disposable external-service substitute. Production coordinator and brokers remain unchanged.
import process from 'node:process';
import { setTimeout as wait } from 'node:timers/promises';
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
export async function serve(config) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const args = JSON.parse(Buffer.concat(chunks).toString());
  if (process.argv[2] !== 'workflow-coordinator-v1') throw new Error('unsupported protocol');
  const method = process.argv[3];
  const state = JSON.parse(readFileSync(config.state, 'utf8'));
  const git = (root, argv) =>
    execFileSync(config.git, ['-C', root, ...argv], { env: {}, encoding: 'utf8' }).trim();
  let result = null;
  switch (method) {
    case 'beads.readIssue':
      result = {
        status: state.closed.includes(args.taskId)
          ? 'closed'
          : (state.children?.[args.taskId]?.status ?? 'in_progress'),
        blockingDependencies: (state.children?.[args.taskId]?.blockingDependencies ?? []).filter(
          (id) => !state.closed.includes(id),
        ),
      };
      break;
    case 'beads.readRepairChild':
      result = state.children?.[args.childId] ?? null;
      break;
    case 'beads.createRepairChild':
      createRepairChild(state, args.request);
      break;
    case 'beads.claimIssue':
      claimIssue(state, args.taskId);
      break;
    case 'beads.closeIssue':
      if (!state.closed.includes(args.taskId)) {
        state.closed.push(args.taskId);
        state.closeMutations = (state.closeMutations ?? 0) + 1;
      }
      break;
    case 'beads.readDoltSync':
      result = state.synced ? 'synced' : 'pending';
      break;
    case 'beads.pushDolt':
      state.synced = true;
      break;
    case 'git.observeRef':
      try {
        result = git(config.remote, ['rev-parse', '--verify', args.ref]);
      } catch {
        result = null;
      }
      break;
    case 'git.pushCas':
      git(args.objectSourceRoot ?? args.workspaceRoot, [
        'push',
        '--quiet',
        `--force-with-lease=${args.ref}:${args.expectedOldSha ?? ''}`,
        config.remote,
        `${args.newSha}:${args.ref}`,
      ]);
      break;
    case 'github.findPullRequest':
      if (state.pr && args.number && config.delayFirstChecksMs && !state.delayedChecks) {
        state.delayedChecks = true;
        await wait(config.delayFirstChecksMs);
      }
      result = state.pr;
      break;
    case 'github.createPullRequest':
      state.pr = {
        ...args,
        number: 1,
        state: 'open',
        protectionDigest: config.protectionDigest,
        reviewDecision: 'approved',
        checks: config.noHostedChecks ? {} : { 'connected-check': 'success' },
        mergeMethod: null,
        mergeSha: null,
        eventIdentity: 'fixture-pr',
        latestReviewEventIdentity: 'fixture-review',
        reviewThreads: [],
        mergeAttestation: null,
      };
      break;
    case 'github.compareAndMergePullRequest':
      if (args.expectedReviewEventIdentity !== state.pr.latestReviewEventIdentity)
        throw new Error('review changed');
      state.pr = {
        ...state.pr,
        state: 'merged',
        mergeMethod: 'squash',
        mergeSha: args.headSha,
        eventIdentity: 'fixture-merge',
        mergeAttestation: {
          headSha: args.headSha,
          base: args.base,
          requiredChecks: args.requiredChecks,
          protectionDigest: args.protectionDigest,
          reviewDecision: 'approved',
          mergeMethod: 'squash',
          mergeSha: args.headSha,
          eventIdentity: 'fixture-merge',
        },
      };
      break;
    default:
      throw new Error(`unsupported fixture service ${method}`);
  }
  if (
    config.loseCloseAcknowledgement &&
    method === 'beads.closeIssue' &&
    !state.lostCloseAcknowledgement
  ) {
    state.lostCloseAcknowledgement = true;
    writeFileSync(config.state, JSON.stringify(state));
    process.exit(70);
  }
  writeFileSync(config.state, JSON.stringify(state));
  process.stdout.write(JSON.stringify(result));
}

function createRepairChild(state, request) {
  state.children ??= {};
  if (state.children[request.id]) return;
  state.children[request.id] = {
    id: request.id,
    issueType: 'task',
    status: 'open',
    specId: `docs/tasks/${request.id}.md`,
    parentEpicId: request.parentEpicId,
    blockingDependencies: [request.dependsOn],
    assignedRole: request.assignedRole,
    allowedPaths: request.allowedPaths,
    allowedOperations: request.allowedOperations,
    findingDigest: request.findingDigest,
    remainingRetryBudget: request.remainingRetryBudget,
  };
}
function claimIssue(state, taskId) {
  if (state.children?.[taskId]?.status !== 'open') return;
  state.children[taskId].status = 'in_progress';
  state.claimMutations = (state.claimMutations ?? 0) + 1;
}
