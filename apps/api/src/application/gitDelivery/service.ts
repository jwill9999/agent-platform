import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import {
  GitDeliveryActionSchema,
  getProjectAccessPolicy,
  type GitDeliveryAction,
  type GitDeliveryReceipt,
  type GitDeliveryState,
} from '@agent-platform/contracts';
import {
  deleteClosedGitDeliveryOperation,
  findGitDeliveryCall,
  findProject,
  getApprovalRequest,
  getGitDeliveryOperation,
  getSession,
  hasUnacknowledgedGitDelivery,
  insertGitDeliveryOperation,
  isClosedGitDelivery,
  listGitDeliveryOperations,
  loadSettings,
  maintainGitDeliveryOperations,
  transitionGitDeliveryOperation,
  type DrizzleDb,
  type StoredGitDeliveryOperation,
} from '@agent-platform/db';
import {
  inspectRemote,
  recheckRemoteConfiguration,
  pushReviewed,
  remoteTip,
  synchroniseTracking,
  requireGhAuthentication,
  matchingPullRequest,
  createReviewedPullRequest,
} from './remote.js';
import {
  git,
  currentRepositoryIdentity,
  inspectGitDeliveryRepository,
  normaliseGitDeliveryPaths,
  sameReviewedMaterial,
  within,
  type GitDeliveryMaterial,
} from './repository.js';
import {
  GitDeliveryError,
  type GitDeliveryService,
  type GitDeliveryServiceOptions,
} from './types.js';

const activeRepositories = new Set<string>();
const PREPARATION_LIFETIME = 15 * 60 * 1000;
const TOOL_NAMES: Record<GitDeliveryAction['kind'], string> = {
  stage: 'sys_git_stage',
  commit: 'sys_git_commit',
  push: 'sys_git_push',
  pull_request: 'sys_git_create_pull_request',
};
type Context =
  | { source: 'panel'; projectId: string }
  | { source: 'chat'; sessionId: string; agentId: string };
type Binding = { projectId: string; root: string; workspaceRoot: string };
function actionValue(raw: GitDeliveryAction): GitDeliveryAction {
  const parsed = GitDeliveryActionSchema.safeParse(raw);
  if (!parsed.success)
    throw new GitDeliveryError('GIT_DELIVERY_ACTION_INVALID', 'Invalid Git delivery action.', 400);
  const action = parsed.data;
  return action.kind === 'stage' || action.kind === 'commit'
    ? { ...action, paths: normaliseGitDeliveryPaths(action.paths) }
    : action;
}
function keyFor(action: GitDeliveryAction): string {
  return action.kind === 'stage' ? `stage:${action.mode}` : action.kind;
}
function signalFor(timeout: number, signal?: AbortSignal): AbortSignal {
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
    : AbortSignal.timeout(timeout);
}
async function locked<T>(root: string, fn: () => Promise<T>): Promise<T> {
  if (activeRepositories.has(root))
    throw new GitDeliveryError(
      'GIT_DELIVERY_BUSY',
      'Another Git delivery operation is active. Inspect its outcome before trying again.',
    );
  activeRepositories.add(root);
  try {
    return await fn();
  } finally {
    activeRepositories.delete(root);
  }
}
function changed(
  receipt: GitDeliveryReceipt,
  state: GitDeliveryState,
  now: number,
  error?: { code: string; message: string },
): GitDeliveryReceipt {
  const next = { ...receipt, state, updatedAtMs: now };
  if (error) next.error = error;
  else delete next.error;
  return next;
}

export function createGitDeliveryService(
  db: DrizzleDb,
  options: GitDeliveryServiceOptions = {},
): GitDeliveryService {
  const now = options.now ?? Date.now;
  const timeout = Math.min(options.commandTimeoutMs ?? 120000, 120000);
  if (!Number.isInteger(timeout) || timeout <= 0)
    throw new Error('Invalid Git delivery command deadline');
  function maintenance() {
    maintainGitDeliveryOperations(db, now());
  }
  function ownedProject(context: Context) {
    const session = context.source === 'chat' ? getSession(db, context.sessionId) : undefined;
    if (
      context.source === 'chat' &&
      (!session ||
        session.agentId !== context.agentId ||
        session.mode !== 'project' ||
        !session.projectId)
    ) {
      throw new GitDeliveryError(
        'GIT_DELIVERY_PROJECT_REQUIRED',
        'This operation requires the session’s approved Project.',
        403,
      );
    }
    const projectId = context.source === 'panel' ? context.projectId : session!.projectId!;
    const project = findProject(db, projectId);
    if (!project || project.archivedAtMs)
      throw new GitDeliveryError(
        'GIT_DELIVERY_PROJECT_UNAVAILABLE',
        'Project is unavailable.',
        404,
      );
    return project;
  }
  async function binding(context: Context, action?: GitDeliveryAction): Promise<Binding> {
    const project = ownedProject(context);
    const { capabilityState, onboardingState, backendProjectRoot, repositoryRoot } =
      project.metadata;
    const canInspect = capabilityState === 'backend_accessible' || capabilityState === 'readonly';
    if (!canInspect || typeof backendProjectRoot !== 'string' || typeof repositoryRoot !== 'string')
      throw new GitDeliveryError(
        'GIT_DELIVERY_PROJECT_UNAVAILABLE',
        'Project is not available to the backend.',
        403,
      );
    if (action) {
      const policy = getProjectAccessPolicy({
        capabilityState,
        onboardingState: onboardingState === 'approved' ? 'approved' : 'missing',
      });
      if (!policy.canWrite)
        throw new GitDeliveryError(
          'GIT_DELIVERY_WRITE_BLOCKED',
          'This Project is read-only or awaits onboarding approval.',
          403,
        );
      const settings = loadSettings(db).executionPolicy;
      if (
        settings.workspaceWrite === 'block' ||
        settings.gitMutation === 'block' ||
        ((action.kind === 'push' || action.kind === 'pull_request') && settings.network === 'block')
      ) {
        throw new GitDeliveryError(
          'GIT_DELIVERY_POLICY_BLOCKED',
          'Current execution policy blocks this Git operation.',
          403,
        );
      }
    }
    try {
      const [root, workspaceRoot] = await Promise.all([
        realpath(repositoryRoot),
        realpath(backendProjectRoot),
      ]);
      if (!within(workspaceRoot, root))
        throw new GitDeliveryError(
          'GIT_DELIVERY_ROOT_ESCAPE',
          'Repository must remain within its approved Project.',
          403,
        );
      const latestProject = findProject(db, project.id);
      const latestSession =
        context.source === 'chat' ? getSession(db, context.sessionId) : undefined;
      if (
        !latestProject ||
        latestProject.archivedAtMs ||
        JSON.stringify(latestProject.metadata) !== JSON.stringify(project.metadata) ||
        (context.source === 'chat' &&
          (!latestSession ||
            latestSession.projectId !== project.id ||
            latestSession.agentId !== context.agentId ||
            latestSession.mode !== 'project'))
      ) {
        throw new GitDeliveryError(
          'GIT_DELIVERY_STALE',
          'Project binding changed during validation. Prepare a fresh review.',
        );
      }
      if (action) {
        const settings = loadSettings(db).executionPolicy;
        if (
          settings.workspaceWrite === 'block' ||
          settings.gitMutation === 'block' ||
          ((action.kind === 'push' || action.kind === 'pull_request') &&
            settings.network === 'block')
        )
          throw new GitDeliveryError(
            'GIT_DELIVERY_POLICY_BLOCKED',
            'Current execution policy blocks this Git operation.',
            403,
          );
      }
      return { projectId: project.id, root, workspaceRoot };
    } catch (error) {
      if (error instanceof GitDeliveryError) throw error;
      throw new GitDeliveryError(
        'GIT_DELIVERY_ROOT_UNAVAILABLE',
        'Project repository cannot be inspected.',
        409,
      );
    }
  }
  function stored(context: Context, projectId: string, id: string): StoredGitDeliveryOperation {
    maintenance();
    const operation = getGitDeliveryOperation(db, id);
    if (
      !operation ||
      operation.receipt.projectId !== projectId ||
      (context.source === 'chat' &&
        (operation.receipt.sessionId !== context.sessionId ||
          operation.agentId !== context.agentId))
    ) {
      throw new GitDeliveryError(
        'GIT_DELIVERY_OPERATION_NOT_FOUND',
        'Operation is unavailable or no longer retained. Prepare a new review; this ID cannot execute.',
        404,
      );
    }
    return operation;
  }
  function save(
    operation: StoredGitDeliveryOperation,
    receipt: GitDeliveryReceipt,
    material?: GitDeliveryMaterial,
  ): GitDeliveryReceipt {
    if (
      !transitionGitDeliveryOperation(
        db,
        receipt.id,
        operation.receipt.state,
        receipt,
        material ? JSON.stringify(material) : undefined,
      )
    ) {
      throw new GitDeliveryError(
        'GIT_DELIVERY_CHANGED',
        'Operation state changed; inspect it before continuing.',
      );
    }
    return receipt;
  }
  async function prepare(
    context: Context,
    rawAction: GitDeliveryAction,
    toolCallId?: string,
    signal?: AbortSignal,
  ): Promise<GitDeliveryReceipt> {
    const action = actionValue(rawAction);
    const current = await binding(context, action);
    return locked(current.root, async () => {
      maintenance();
      const fresh = await binding(context, action);
      if (JSON.stringify(current) !== JSON.stringify(fresh))
        throw new GitDeliveryError(
          'GIT_DELIVERY_STALE',
          'Project binding changed. Start a fresh review.',
        );
      if (context.source === 'chat') {
        if (!toolCallId || toolCallId.length > 256)
          throw new GitDeliveryError(
            'GIT_DELIVERY_CALL_REQUIRED',
            'A trusted tool call identity is required.',
            400,
          );
        const prior = findGitDeliveryCall(db, context.sessionId, toolCallId);
        if (prior) {
          if (
            prior.agentId !== context.agentId ||
            prior.receipt.projectId !== fresh.projectId ||
            JSON.stringify(prior.receipt.action) !== JSON.stringify(action)
          )
            throw new GitDeliveryError(
              'GIT_DELIVERY_CALL_MISMATCH',
              'This tool call already refers to different reviewed material.',
              403,
            );
          return prior.receipt;
        }
      }
      if (hasUnacknowledgedGitDelivery(db, fresh.root, keyFor(action)))
        throw new GitDeliveryError(
          'GIT_DELIVERY_UNKNOWN_PENDING',
          'An earlier operation has an unknown outcome. Inspect and reconcile it, or explicitly acknowledge the uncertainty before a fresh review.',
        );
      const history = listGitDeliveryOperations(db, fresh.projectId);
      const acknowledgedUnknown = history.some(
        (item) =>
          item.actionKey === keyFor(action) &&
          item.receipt.state === 'unknown' &&
          item.receipt.acknowledgedAtMs !== undefined,
      );
      if (history.length >= 1000)
        throw new GitDeliveryError(
          'GIT_DELIVERY_CAPACITY',
          'Receipt history is full. Inspect active outcomes and explicitly delete closed history before preparing more operations.',
        );
      let material: GitDeliveryMaterial;
      const deadline = signalFor(timeout, signal);
      try {
        material = await inspectGitDeliveryRepository(
          fresh.root,
          fresh.workspaceRoot,
          action,
          deadline,
        );
        if (action.kind === 'push' || action.kind === 'pull_request') {
          await binding(context, action);
          material.remote = await inspectRemote(material, action, deadline);
          if (action.kind === 'pull_request') {
            await requireGhAuthentication(material.root, deadline);
            await matchingPullRequest(material, action, deadline);
          }
        }
      } catch (error) {
        if (error instanceof GitDeliveryError) throw error;
        throw new GitDeliveryError(
          'GIT_DELIVERY_INSPECTION_FAILED',
          'Repository review failed. Check its branch, HEAD and Git availability.',
        );
      }
      const time = now();
      const receipt: GitDeliveryReceipt = {
        id: randomUUID(),
        projectId: fresh.projectId,
        source: context.source,
        ...(context.source === 'chat' ? { sessionId: context.sessionId } : {}),
        action,
        state: 'prepared',
        createdAtMs: time,
        updatedAtMs: time,
        expiresAtMs: time + PREPARATION_LIFETIME,
        review: {
          branch: material.branch,
          head: material.head,
          indexTree: material.indexTree,
          paths: action.kind === 'stage' || action.kind === 'commit' ? action.paths : [],
          ...(material.remote
            ? {
                remoteName: material.remote.name,
                remoteRef: material.remote.ref,
                repositorySlug: material.remote.repositorySlug,
              }
            : {}),
          ...(acknowledgedUnknown
            ? {
                warning:
                  'An earlier equivalent operation has an acknowledged unknown outcome. Inspect actual Git state: confirming this fresh operation may duplicate an earlier effect.',
              }
            : {}),
        },
      };
      insertGitDeliveryOperation(db, {
        receipt,
        repositoryRoot: fresh.root,
        agentId: context.source === 'chat' ? context.agentId : null,
        toolCallId: toolCallId ?? null,
        actionKey: keyFor(action),
        materialJson: JSON.stringify(material),
      });
      return receipt;
    });
  }
  function approval(
    context: Context,
    operation: StoredGitDeliveryOperation,
    approvalRequestId?: string,
    confirmed?: boolean,
  ) {
    if (context.source === 'panel') {
      if (confirmed !== true || operation.receipt.source !== 'panel')
        throw new GitDeliveryError(
          'GIT_DELIVERY_CONFIRMATION_REQUIRED',
          'Confirm the prepared panel operation.',
          403,
        );
      return;
    }
    try {
      const request = getApprovalRequest(db, approvalRequestId ?? '');
      const payload = JSON.parse(request.executionPayloadJson ?? '{}') as {
        toolCallId?: string;
        toolName?: string;
        args?: GitDeliveryAction;
        gitDeliveryBinding?: { operationId?: string };
      };
      if (
        request.status !== 'approved' ||
        request.resumedAtMs === undefined ||
        (request.expiresAtMs !== undefined && request.expiresAtMs <= now()) ||
        request.sessionId !== context.sessionId ||
        request.agentId !== context.agentId ||
        request.toolName !== TOOL_NAMES[operation.receipt.action.kind] ||
        payload.toolName !== request.toolName ||
        payload.toolCallId !== operation.toolCallId ||
        payload.gitDeliveryBinding?.operationId !== operation.receipt.id ||
        JSON.stringify(actionValue(payload.args as GitDeliveryAction)) !==
          JSON.stringify(operation.receipt.action)
      )
        throw new Error('mismatch');
    } catch {
      throw new GitDeliveryError(
        'GIT_DELIVERY_APPROVAL_REQUIRED',
        'An approved, claimed request matching this exact operation is required.',
        403,
      );
    }
  }
  async function execute(
    context: Context,
    id: string,
    execution: { approvalRequestId?: string; confirmed?: boolean; signal?: AbortSignal },
  ): Promise<GitDeliveryReceipt> {
    const initial = await binding(context);
    return locked(initial.root, async () => {
      let operation = stored(context, initial.projectId, id);
      approval(context, operation, execution.approvalRequestId, execution.confirmed);
      if (operation.receipt.state !== 'prepared') return operation.receipt;
      const deadline = signalFor(timeout, execution.signal);
      let material = JSON.parse(operation.materialJson) as GitDeliveryMaterial;
      try {
        const current = await binding(context, operation.receipt.action);
        if (
          current.projectId !== initial.projectId ||
          current.root !== material.root ||
          current.workspaceRoot !== material.workspaceRoot
        )
          throw new GitDeliveryError(
            'GIT_DELIVERY_STALE',
            'Project binding changed. Prepare a fresh review.',
          );
        const observed = await inspectGitDeliveryRepository(
          current.root,
          current.workspaceRoot,
          operation.receipt.action,
          deadline,
        );
        if (
          operation.receipt.action.kind === 'push' ||
          operation.receipt.action.kind === 'pull_request'
        ) {
          await binding(context, operation.receipt.action);
          observed.remote = await inspectRemote(observed, operation.receipt.action, deadline);
        }
        if (!sameReviewedMaterial(material, observed))
          throw new GitDeliveryError(
            'GIT_DELIVERY_STALE',
            'Reviewed repository contents changed. Prepare a fresh review.',
          );
        if (hasUnacknowledgedGitDelivery(db, current.root, operation.actionKey))
          throw new GitDeliveryError(
            'GIT_DELIVERY_UNKNOWN_PENDING',
            'Inspect the earlier unknown outcome before executing a new operation.',
          );
      } catch (error) {
        const denied = error instanceof GitDeliveryError && error.status === 403;
        return save(
          operation,
          changed(operation.receipt, denied ? 'denied' : 'stale', now(), {
            code: denied ? 'GIT_DELIVERY_POLICY_BLOCKED' : 'GIT_DELIVERY_STALE',
            message: denied
              ? 'Current permissions deny the operation.'
              : 'Review is no longer current. Prepare and confirm a new operation.',
          }),
        );
      }
      try {
        save(operation, changed(operation.receipt, 'executing', now()));
      } catch {
        throw new GitDeliveryError(
          'GIT_DELIVERY_BUSY',
          'Another operation already claimed this repository. Inspect its outcome.',
        );
      }
      operation = stored(context, initial.projectId, id);
      let effectMayHaveStarted = false;
      try {
        const action = operation.receipt.action;
        let existingPullRequest: GitDeliveryReceipt['result'];
        if (action.kind === 'push' || action.kind === 'pull_request') {
          await binding(context, action);
          await recheckRemoteConfiguration(material, action, deadline);
          if (action.kind === 'pull_request') {
            await requireGhAuthentication(material.root, deadline);
            existingPullRequest = await matchingPullRequest(material, action, deadline);
            if (
              (await remoteTip(
                material.root,
                material.remote!.endpoint,
                material.remote!.ref,
                deadline,
              )) !== material.head
            )
              throw new GitDeliveryError(
                'GIT_DELIVERY_STALE',
                'Published branch changed before execution.',
              );
          }
        }
        if (
          (await git(material.root, ['rev-parse', 'HEAD'], deadline)).trim() !== material.head ||
          (await currentRepositoryIdentity(material.root)) !== material.repositoryIdentity
        )
          throw new GitDeliveryError('GIT_DELIVERY_STALE', 'Repository changed before execution.');
        const finalBinding = await binding(context, action);
        if (
          finalBinding.projectId !== operation.receipt.projectId ||
          finalBinding.root !== material.root ||
          finalBinding.workspaceRoot !== material.workspaceRoot
        )
          throw new GitDeliveryError(
            'GIT_DELIVERY_STALE',
            'Project binding changed before execution. Prepare a fresh review.',
          );
        if (action.kind === 'stage') {
          effectMayHaveStarted = true;
          await git(
            material.root,
            action.mode === 'stage'
              ? ['add', '-A', '--', ...action.paths]
              : ['restore', '--staged', '--', ...action.paths],
            deadline,
          );
          const actual = await git(material.root, ['ls-files', '--stage', '-z'], deadline);
          const head = (await git(material.root, ['rev-parse', 'HEAD'], deadline)).trim();
          const branch = (
            await git(material.root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], deadline)
          ).trim();
          const unrelated = (entries: string) =>
            entries
              .split('\0')
              .filter(
                (entry) => entry && !action.paths.includes(entry.slice(entry.indexOf('\t') + 1)),
              )
              .join('\0');
          if (
            unrelated(actual) !== unrelated(material.indexEntries) ||
            head !== material.head ||
            branch !== material.branch
          )
            throw new GitDeliveryError(
              'GIT_DELIVERY_EFFECT_MISMATCH',
              'Repository changed during the approved operation. Inspect before continuing.',
            );
          const observed = await inspectGitDeliveryRepository(
            material.root,
            material.workspaceRoot,
            action,
            deadline,
          );
          if (
            observed.selectedFingerprint !== material.selectedFingerprint ||
            observed.repositoryIdentity !== material.repositoryIdentity
          )
            throw new GitDeliveryError(
              'GIT_DELIVERY_EFFECT_MISMATCH',
              'Selected files changed during staging. Inspect before continuing.',
            );
          material = {
            ...material,
            expectedIndexEntries: actual,
            expectedIndexTree: observed.indexTree,
          };
          return save(
            operation,
            {
              ...changed(operation.receipt, 'succeeded', now()),
              result: { indexTree: material.expectedIndexTree },
            },
            material,
          );
        }
        if (action.kind === 'push') {
          effectMayHaveStarted = true;
          await pushReviewed(material, deadline);
          if (
            (await remoteTip(
              material.root,
              material.remote!.endpoint,
              material.remote!.ref,
              deadline,
            )) !== material.head ||
            (await currentRepositoryIdentity(material.root)) !== material.repositoryIdentity
          )
            throw new GitDeliveryError(
              'GIT_DELIVERY_REMOTE_UNVERIFIED',
              'The remote branch result could not be verified.',
            );
          // Persist the proven external effect before optional local bookkeeping.
          const result = { commitSha: material.head, remoteRef: material.remote!.ref };
          const succeeded = save(operation, {
            ...changed(operation.receipt, 'succeeded', now()),
            result,
          });
          try {
            operation = stored(context, initial.projectId, id);
            const warning = await synchroniseTracking(material, action, deadline, async () => {
              if ((await currentRepositoryIdentity(material.root)) !== material.repositoryIdentity)
                throw new Error('repository changed');
              const authority = await binding(context, action);
              if (
                authority.projectId !== operation.receipt.projectId ||
                authority.root !== material.root ||
                authority.workspaceRoot !== material.workspaceRoot
              )
                throw new Error('ownership changed');
            });
            return warning
              ? save(operation, { ...succeeded, result: { ...result, warning } })
              : succeeded;
          } catch {
            // The known external result is already durable. Optional bookkeeping cannot undo it.
            return {
              ...succeeded,
              result: {
                ...result,
                warning:
                  'The remote branch was updated; optional local bookkeeping could not be recorded. Inspect tracking before continuing.',
              },
            };
          }
        }
        if (action.kind === 'pull_request') {
          if (existingPullRequest)
            return save(operation, {
              ...changed(operation.receipt, 'succeeded', now()),
              result: {
                ...existingPullRequest,
                warning:
                  'The exact reviewed pull request already exists; no duplicate was created.',
              },
            });
          effectMayHaveStarted = true;
          const result = await createReviewedPullRequest(material, action, deadline);
          const succeeded = save(operation, {
            ...changed(operation.receipt, 'succeeded', now()),
            result,
          });
          try {
            operation = stored(context, initial.projectId, id);
            if (await matchingPullRequest(material, action, deadline)) return succeeded;
          } catch {
            /* Optional details are independent of the durable creation result. */
          }
          const enriched = {
            ...succeeded,
            result: {
              ...result,
              warning: 'Pull request creation succeeded; optional details could not be refreshed.',
            },
          };
          try {
            return save(operation, enriched);
          } catch {
            return enriched;
          }
        }
        effectMayHaveStarted = true;
        await git(material.root, ['commit', '-m', action.message], deadline);
        const commitSha = (await git(material.root, ['rev-parse', 'HEAD'], deadline)).trim();
        const tree = (
          await git(material.root, ['show', '-s', '--format=%T', commitSha], deadline)
        ).trim();
        const parents = (
          await git(material.root, ['show', '-s', '--format=%P', commitSha], deadline)
        ).trim();
        const branch = (
          await git(material.root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], deadline)
        ).trim();
        if (
          tree !== material.indexTree ||
          parents !== material.head ||
          branch !== material.branch ||
          (await currentRepositoryIdentity(material.root)) !== material.repositoryIdentity
        )
          throw new GitDeliveryError(
            'GIT_DELIVERY_EFFECT_MISMATCH',
            'The created commit differs from the approved index or parent. Inspect before continuing.',
          );
        return save(operation, {
          ...changed(operation.receipt, 'succeeded', now()),
          result: { commitSha },
        });
      } catch (error) {
        if (
          !effectMayHaveStarted &&
          error instanceof GitDeliveryError &&
          (error.code === 'GIT_DELIVERY_STALE' || error.status === 403)
        ) {
          return save(
            operation,
            changed(operation.receipt, error.status === 403 ? 'denied' : 'stale', now(), {
              code: error.code,
              message: error.message,
            }),
          );
        }
        const uncertain = effectMayHaveStarted;
        return save(
          operation,
          changed(operation.receipt, uncertain ? 'unknown' : 'failed', now(), {
            code: uncertain ? 'GIT_DELIVERY_OUTCOME_UNKNOWN' : 'GIT_DELIVERY_FAILED',
            message: uncertain
              ? 'Outcome is unknown. Inspect and reconcile before retrying; no automatic replay is permitted.'
              : 'No repository mutation was started. Prepare a new operation after checking the repository.',
          }),
          material,
        );
      }
    });
  }
  async function get(context: Context, id: string): Promise<GitDeliveryReceipt> {
    return stored(context, ownedProject(context).id, id).receipt;
  }
  async function cancel(context: Context, id: string, reason: 'cancelled' | 'denied') {
    const operation = stored(context, ownedProject(context).id, id);
    if (operation.receipt.state !== 'prepared') return operation.receipt;
    return save(operation, changed(operation.receipt, reason, now()));
  }
  async function reconcile(
    context: Context,
    id: string,
    signal?: AbortSignal,
  ): Promise<GitDeliveryReceipt> {
    const current = await binding(context);
    return locked(current.root, async () => {
      const operation = stored(context, current.projectId, id);
      if (operation.receipt.state !== 'unknown') return operation.receipt;
      const material = JSON.parse(operation.materialJson) as GitDeliveryMaterial;
      if (current.root !== material.root || current.workspaceRoot !== material.workspaceRoot)
        return operation.receipt;
      const deadline = signalFor(timeout, signal);
      if ((await currentRepositoryIdentity(current.root)) !== material.repositoryIdentity)
        return operation.receipt;
      try {
        const action = operation.receipt.action;
        if (action.kind === 'push' || action.kind === 'pull_request') {
          const permitted = await binding(context, action);
          if (
            permitted.root !== material.root ||
            permitted.workspaceRoot !== material.workspaceRoot ||
            !material.remote
          )
            return operation.receipt;
          await recheckRemoteConfiguration(material, action, deadline);
          if (
            (await remoteTip(
              material.root,
              material.remote.endpoint,
              material.remote.ref,
              deadline,
            )) !== material.head
          )
            return operation.receipt;
          const result =
            action.kind === 'push'
              ? {
                  commitSha: material.head,
                  remoteRef: material.remote.ref,
                  warning:
                    'Reconciled from the remote branch; inspect local tracking and any external Git activity.',
                }
              : await matchingPullRequest(material, action, deadline);
          if (
            result &&
            (await currentRepositoryIdentity(current.root)) === material.repositoryIdentity
          )
            return save(operation, { ...changed(operation.receipt, 'succeeded', now()), result });
          return operation.receipt;
        }
        const branch = (
          await git(current.root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], deadline)
        ).trim();
        if (branch !== material.branch) return operation.receipt;
        const head = (await git(current.root, ['rev-parse', 'HEAD'], deadline)).trim();
        if (
          operation.receipt.action.kind === 'stage' &&
          material.expectedIndexEntries !== undefined &&
          head === material.head &&
          (await git(current.root, ['ls-files', '--stage', '-z'], deadline)) ===
            material.expectedIndexEntries
        ) {
          if ((await currentRepositoryIdentity(current.root)) !== material.repositoryIdentity)
            return operation.receipt;
          return save(operation, {
            ...changed(operation.receipt, 'succeeded', now()),
            result: {
              indexTree: material.expectedIndexTree,
              warning: 'Reconciled from the current index; inspect any external Git activity.',
            },
          });
        }
        if (operation.receipt.action.kind === 'commit' && head !== material.head) {
          const tree = (
            await git(current.root, ['show', '-s', '--format=%T', head], deadline)
          ).trim();
          const parents = (
            await git(current.root, ['show', '-s', '--format=%P', head], deadline)
          ).trim();
          const message = (
            await git(current.root, ['show', '-s', '--format=%B', head], deadline)
          ).trim();
          if (
            tree === material.indexTree &&
            parents === material.head &&
            message === operation.receipt.action.message &&
            (await currentRepositoryIdentity(current.root)) === material.repositoryIdentity
          )
            return save(operation, {
              ...changed(operation.receipt, 'succeeded', now()),
              result: {
                commitSha: head,
                warning: 'Reconciled from the current commit; inspect any external Git activity.',
              },
            });
        }
      } catch {
        /* Ambiguous or unavailable evidence must retain unknown. */
      }
      return operation.receipt;
    });
  }
  return {
    chat(context) {
      const actor: Context = { source: 'chat', ...context };
      return {
        prepare: (action, options) => prepare(actor, action, options.toolCallId, options.signal),
        get: (id) => get(actor, id),
        execute: (id, options) => execute(actor, id, options),
        cancel: (id, reason) => cancel(actor, id, reason),
      };
    },
    panel(projectId) {
      const actor: Context = { source: 'panel', projectId };
      return {
        prepare: (action, options) => prepare(actor, action, undefined, options?.signal),
        get: (id) => get(actor, id),
        list: async () => {
          const current = await binding(actor);
          maintenance();
          return listGitDeliveryOperations(db, current.projectId).map((item) => item.receipt);
        },
        stagedPaths: async (options) => {
          const deadline = signalFor(timeout, options?.signal);
          const current = await binding(actor);
          const identity = await currentRepositoryIdentity(current.root);
          if (!identity)
            throw new GitDeliveryError('GIT_DELIVERY_LAYOUT', 'Repository layout is unsupported.');
          const paths = (
            await git(
              current.root,
              [
                'diff',
                '--cached',
                '--name-only',
                '-z',
                '--no-renames',
                '--no-ext-diff',
                '--no-textconv',
              ],
              deadline,
            )
          )
            .split('\0')
            .filter(Boolean)
            .sort();
          const latest = await binding(actor);
          if (
            latest.root !== current.root ||
            latest.workspaceRoot !== current.workspaceRoot ||
            (await currentRepositoryIdentity(current.root)) !== identity
          )
            throw new GitDeliveryError(
              'GIT_DELIVERY_STALE',
              'Repository changed during inspection.',
            );
          if (paths.length > 500 || paths.some((path) => path.length > 4096))
            throw new GitDeliveryError(
              'GIT_DELIVERY_INDEX_LIMIT',
              'The staged selection exceeds this MVP’s review limit. Reduce it with your Git client before continuing.',
            );
          return paths;
        },
        execute: (id, options) => execute(actor, id, options),
        cancel: (id) => cancel(actor, id, 'cancelled'),
        reconcile: (id, options) => reconcile(actor, id, options?.signal),
        acknowledge: async (id, options) => {
          if (options.confirmed !== true)
            throw new GitDeliveryError(
              'GIT_DELIVERY_CONFIRMATION_REQUIRED',
              'Explicit human acknowledgement is required.',
              403,
            );
          const current = await binding(actor);
          const operation = stored(actor, current.projectId, id);
          if (operation.receipt.state !== 'unknown')
            throw new GitDeliveryError(
              'GIT_DELIVERY_NOT_UNKNOWN',
              'Only an unknown outcome can be acknowledged.',
            );
          return save(operation, {
            ...operation.receipt,
            acknowledgedAtMs: now(),
            updatedAtMs: now(),
          });
        },
        deleteClosed: async (id, options) => {
          if (options.confirmed !== true)
            throw new GitDeliveryError(
              'GIT_DELIVERY_CONFIRMATION_REQUIRED',
              'Confirm deletion of closed receipt history.',
              403,
            );
          const current = await binding(actor);
          const operation = stored(actor, current.projectId, id);
          if (!isClosedGitDelivery(operation.receipt) || !deleteClosedGitDeliveryOperation(db, id))
            throw new GitDeliveryError(
              'GIT_DELIVERY_ACTIVE_HISTORY',
              'Active or unacknowledged operations cannot be deleted.',
            );
        },
      };
    },
  };
}
