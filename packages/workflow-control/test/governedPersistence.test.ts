import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import {
  ApprovalNotificationCoordinator,
  DelegateCallbackCoordinator,
  WorkflowStore,
  createWorkflowStoreApprovalNotificationJournal,
  createWorkflowStoreDelegateCallbackStore,
  createWorkflowStoreGovernedJournal,
  createProductionApprovalNotificationPort,
  createParentWakePortForTest,
  createTrustedLineageObservationPortForTest,
  digestGovernedValue,
  GovernedOperationBroker,
  importWorkflowLineage,
  type ExecutionContract,
  deriveTransitionIdempotencyKey,
  type PrepareTransitionInput,
} from '../src/index.js';
import {
  createProductionGovernedExternalPort,
  governedExternalRequestSchema,
} from '../src/governedOperations.js';
import {
  OfficialLineageEvidenceObservationPort,
  OfficialLineageGitObservationPort,
} from '../src/governedPersistence.js';

const roots: string[] = [];
const hash = (character: string) => `sha256:${character.repeat(64)}`;
const workspaceId = hash('a');
const policyDigest = hash('b');
const contract: ExecutionContract = {
  featureId: 'governed-persistence',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'persist governed coordination',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['durable'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'feature/test',
    allowedActions: [
      'workflow.delegate_callback',
      'workflow.lineage_import',
      'notification.approval',
      'beads.mutate',
      'github.read',
      'github.deliver',
    ],
    github: {
      repository: 'owner/repo',
      base: 'feature/test',
      mergeMethod: 'squash',
      requiredChecks: [],
    },
  },
  tasks: [
    {
      id: 'task.1',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'workflow_orchestrator',
      branchParent: 'feature/test',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: [
        'workflow.delegate_callback',
        'workflow.lineage_import',
        'notification.approval',
        'beads.mutate',
        'github.read',
        'github.deliver',
      ],
    },
  ],
  qualityGates: [],
  retryPolicy: {
    implementationAttempts: 1,
    findingAttempts: 1,
    infrastructureAttempts: 1,
    waitDeadlineSeconds: 60,
  },
  repairTaskPolicy: {
    idPattern: 'task.fix.<sequence>',
    maxChildren: 0,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'governed-persistence-'));
  roots.push(root);
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  const contractId = store.createContract(contract, 1000);
  return { store, database, contractId };
}

describe('governed SQLite persistence', () => {
  it('migrates legacy single approval contexts without treating delivery acceptance as parent progress', async () => {
    const { store, contractId, database } = await setup();
    store.createRun(contractId, 'approval_waiting', 'legacy');
    store.close();
    const db = new Database(database);
    db.exec(`DROP TABLE approval_wait_contexts;
      CREATE TABLE approval_wait_contexts (
        run_id TEXT PRIMARY KEY REFERENCES runs(id), task_id TEXT NOT NULL,
        predecessor_state TEXT NOT NULL, resume_target_state TEXT NOT NULL,
        event_id TEXT NOT NULL UNIQUE, recipient_identity TEXT NOT NULL, phase TEXT NOT NULL,
        deadline_ms INTEGER NOT NULL, status TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL);
      INSERT INTO approval_wait_contexts VALUES ('legacy', 'task.1', 'delivery', 'finalizing', 'legacy-event', 'owner', 'delivery', 5000, 'resumed', 1000, 1000);`);
    db.close();
    const migrated = new WorkflowStore(database);
    expect(migrated.getApprovalWaitContext('legacy')).toMatchObject({
      eventId: 'legacy-event',
      status: 'waiting',
    });
    migrated.close();
    const reopened = new WorkflowStore(database);
    expect(reopened.getApprovalWaitContext('legacy')).toMatchObject({
      eventId: 'legacy-event',
      status: 'waiting',
    });
    reopened.close();
  });
  it('rejects forged approval booleans without persisted wait and notification records', async () => {
    const { store, contractId } = await setup();
    store.createRun(contractId, 'approval_waiting', 'forged');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const leaseEpoch = store.acquireLease('run', 'forged', ownerId, 1000, 1000).epoch;
    expect(() =>
      store.prepareTransition({
        id: 'forged',
        runId: 'forged',
        from: 'approval_waiting',
        to: 'finalizing',
        operation: 'workflow.resume',
        expectedRunVersion: 0,
        idempotencyKey: deriveTransitionIdempotencyKey({
          runId: 'forged',
          transitionId: 'forged',
          operation: 'workflow.resume',
          expectedVersion: 0,
        }),
        actorRole: 'workflow_orchestrator',
        contractVersion: 1,
        policyDigest,
        leaseOwnerId: ownerId,
        leaseEpoch,
        transitionContext: {
          workspaceLeaseEpoch,
          ...{
            approval: {
              predecessor: 'delivery',
              resumeTarget: 'finalizing',
              authenticatedApproval: true,
              resumeDeliveryAcknowledged: true,
              deadlineElapsed: false,
            },
          },
        },
        expectedExternalState: {},
        externalArguments: {},
        nowMs: 1000,
      }),
    ).toThrow('durable approval context');
    expect(store.getRun('forged')).toMatchObject({ state: 'approval_waiting', version: 0 });
    store.close();
  });

  it.each([1, 2])(
    'fences takeover during notes read %s and lets the new owner adopt prepared work',
    async (takeoverRead) => {
      const { store, contractId, database } = await setup();
      store.createRunForTest(contractId, 'pipeline', 'race');
      let now = 1000;
      const fence = {
        ownerId: 'old',
        workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, 'old', 100, now).epoch,
        runLeaseEpoch: store.acquireLease('run', 'race', 'old', 100, now).epoch,
        taskLeaseEpoch: store.acquireLease('task', 'task.1', 'old', 100, now).epoch,
      };
      const nonNotes = {
        id: 'task.1',
        status: 'in_progress',
        description: 'same',
        acceptanceCriteria: 'same',
        owner: 'owner',
        dependencies: [],
      };
      let notes = 'old';
      let reads = 0;
      let mutations = 0;
      let adoptedFence = fence;
      const other = new WorkflowStore(database);
      const client = {
        async readIssue() {
          if (++reads === takeoverRead) {
            now = 1101;
            adoptedFence = {
              ownerId: 'new',
              workspaceLeaseEpoch: other.acquireLease('workspace', workspaceId, 'new', 1000, now)
                .epoch,
              runLeaseEpoch: other.acquireLease('run', 'race', 'new', 1000, now).epoch,
              taskLeaseEpoch: other.acquireLease('task', 'task.1', 'new', 1000, now).epoch,
            };
          }
          return { ...nonNotes, notes, revision: '1' };
        },
        async compareAndSwapNotes() {
          mutations += 1;
          notes = 'new';
          return { ...nonNotes, notes, revision: '2' };
        },
        async observeThreads() {
          return [];
        },
        async replyToThread() {
          throw new Error('unused');
        },
        async resolveThread() {
          throw new Error('unused');
        },
      };
      const request = {
        kind: 'beads.task_note_update' as const,
        workspaceId,
        runId: 'race',
        taskId: 'task.1',
        actorRole: 'workflow_orchestrator' as const,
        contractVersion: 1 as const,
        policyDigest,
        materialDigest: hash('c'),
        ...fence,
        expectedPriorNotesDigest: digestGovernedValue('old'),
        expectedNonNotesDigest: digestGovernedValue(nonNotes),
        replacementNotes: 'new',
        replacementNotesDigest: digestGovernedValue('new'),
      };
      const broker = new GovernedOperationBroker(
        createWorkflowStoreGovernedJournal(store, () => now),
        createProductionGovernedExternalPort(client),
      );
      await expect(broker.execute(request)).rejects.toThrow('fencing');
      expect(mutations).toBe(0);
      const id = digestGovernedValue([
        'governed-operation',
        digestGovernedValue(governedExternalRequestSchema.parse(request)),
      ]);
      await expect(broker.reconcilePrepared(id, adoptedFence)).resolves.toMatchObject({
        status: 'committed',
      });
      expect(mutations).toBe(1);
      await expect(broker.execute(request)).resolves.toMatchObject({ status: 'committed' });
      expect(mutations).toBe(1);
      other.close();
      store.close();
    },
  );
  it('rejects forged production lineage observer construction', () => {
    expect(
      () =>
        new OfficialLineageGitObservationPort(
          async () => ({ headSha: 'a'.repeat(40), treeSha: 'b'.repeat(40) }),
          Symbol('attacker'),
        ),
    ).toThrow('package bootstrap capability');
    expect(
      () =>
        new OfficialLineageEvidenceObservationPort(
          async () => ({ implementationArtifactDigest: hash('c'), materialDigest: hash('d') }),
          Symbol('attacker'),
        ),
    ).toThrow('package bootstrap capability');
  });

  it('applies the governed persistence migration idempotently', async () => {
    const { store, database } = await setup();
    store.close();
    const legacy = new Database(database);
    legacy.exec(`
      ALTER TABLE delivery_operations DROP COLUMN merge_observation_status;
      ALTER TABLE delivery_operations DROP COLUMN verified_observation_digest;
      ALTER TABLE delivery_operations DROP COLUMN verified_observation_json;
      DELETE FROM schema_migrations WHERE version = 12;
    `);
    legacy.close();
    const reopened = new WorkflowStore(database);
    reopened.close();
    const sqlite = new Database(database, { readonly: true });
    const migration = sqlite
      .prepare('SELECT version FROM schema_migrations WHERE version = 12')
      .get();
    const deliveryColumns = sqlite
      .prepare('PRAGMA table_info(delivery_operations)')
      .all() as Array<{
      name: string;
    }>;
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('approval_notifications', 'delegate_callbacks', 'workflow_lineage_imports', 'lineage_approved_heads') ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    expect(migration).toBeTruthy();
    expect(deliveryColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'verified_observation_json',
        'verified_observation_digest',
        'merge_observation_status',
      ]),
    );
    expect(tables.map((row) => row.name)).toEqual([
      'approval_notifications',
      'delegate_callbacks',
      'lineage_approved_heads',
      'workflow_lineage_imports',
    ]);
    sqlite.close();
  });

  it('persists approval CAS state across restart and rejects stale CAS', async () => {
    const { store, database, contractId } = await setup();
    store.createRun(contractId, 'approval_waiting', 'run-approval');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'run-approval', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    const identity = {
      kind: 'notification.approval',
      workspaceId,
      runId: 'run-approval',
      taskId: 'task.1',
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      headSha: 'd'.repeat(40),
      actionScopeDigest: hash('e'),
      recipientIdentity: 'owner',
      destinationDigest: hash('f'),
      allowedResponseDigest: hash('1'),
      expiresAtMs: 5000,
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      maxAttempts: 3,
    } as const;
    const event = { ...identity, eventId: digestGovernedValue(identity) };
    store.seedApprovalWaitIntentForTest(event, 1000);
    const journal = createWorkflowStoreApprovalNotificationJournal(store, () => 1000);
    expect(journal.prepare(event).state).toBe('prepared');
    expect(
      journal.compareAndSwap({ eventId: event.eventId, from: 'prepared', to: 'delivery_pending' })
        .state,
    ).toBe('delivery_pending');
    expect(() =>
      journal.compareAndSwap({ eventId: event.eventId, from: 'prepared', to: 'delivery_pending' }),
    ).toThrow('compare-and-swap');
    store.close();
    const reopened = new WorkflowStore(database);
    expect(createWorkflowStoreApprovalNotificationJournal(reopened).prepare(event).state).toBe(
      'delivery_pending',
    );
    reopened.close();
  });

  it('requires separate authenticated approval and acknowledged resume transport', async () => {
    const { store, contractId, database } = await setup();
    store.createRun(contractId, 'approval_waiting', 'run-notification');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'run-notification', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    const identity = {
      kind: 'notification.approval',
      workspaceId,
      runId: 'run-notification',
      taskId: 'task.1',
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      headSha: 'd'.repeat(40),
      actionScopeDigest: hash('e'),
      recipientIdentity: 'owner',
      destinationDigest: hash('f'),
      allowedResponseDigest: hash('1'),
      expiresAtMs: 5000,
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      maxAttempts: 3,
    } as const;
    const event = { ...identity, eventId: digestGovernedValue(identity) };
    store.seedApprovalWaitIntentForTest(event, 1000);
    const accepted = new Map<
      string,
      { generation: string; messageId: string; providerAcceptedAtMs: number }
    >();
    const port = createProductionApprovalNotificationPort({
      async observe(eventId, purpose) {
        return (
          accepted.get(`${eventId}:${purpose}`) ?? {
            generation: purpose,
            messageId: null,
            providerAcceptedAtMs: null,
          }
        );
      },
      async send({ event: sent, purpose }) {
        const result = {
          generation: purpose,
          messageId: `${purpose}-message`,
          providerAcceptedAtMs: 1000,
        };
        accepted.set(`${sent.eventId}:${purpose}`, result);
        return result;
      },
    });
    const coordinator = new ApprovalNotificationCoordinator(
      createWorkflowStoreApprovalNotificationJournal(store, () => 1000),
      port,
      () => 1000,
    );
    await expect(coordinator.deliver(event)).resolves.toMatchObject({
      state: 'delivered',
      messageId: 'approval-message',
    });
    const approval = {
      responderIdentity: 'owner',
      responseEvidenceDigest: hash('2'),
      acceptedAtMs: 1000,
    };
    expect(() =>
      coordinator.approve(event.eventId, { ...approval, authenticatedResponseDigest: hash('0') }),
    ).toThrow('does not match');
    expect(() =>
      coordinator.approve(event.eventId, {
        ...approval,
        responderIdentity: 'different-owner',
        authenticatedResponseDigest: event.allowedResponseDigest,
      }),
    ).toThrow('identity and evidence');
    expect(
      coordinator.approve(event.eventId, {
        ...approval,
        authenticatedResponseDigest: event.allowedResponseDigest,
      }).state,
    ).toBe('approved');
    await expect(coordinator.resume(event.eventId)).resolves.toMatchObject({
      state: 'resume_pending',
      messageId: 'resume-message',
    });
    expect(store.getApprovalWaitContext(event.runId)?.status).toBe('waiting');
    const transition: PrepareTransitionInput = {
      id: 'approval-resume',
      runId: event.runId,
      from: 'approval_waiting',
      to: 'finalizing',
      operation: 'workflow.resume',
      expectedRunVersion: 0,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: event.runId,
        transitionId: 'approval-resume',
        operation: 'workflow.resume',
        expectedVersion: 0,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      leaseOwnerId: ownerId,
      leaseEpoch: runLeaseEpoch,
      transitionContext: { workspaceLeaseEpoch, taskLeaseEpoch },
      expectedExternalState: {},
      externalArguments: { taskId: 'task.1' },
      nowMs: 1000,
    };
    expect(() => store.prepareTransition({ ...transition, to: 'delivery' })).toThrow('target');
    store.prepareTransition(transition);
    const tamper = new Database(database);
    tamper
      .prepare(
        'UPDATE approval_notifications SET response_evidence_digest = NULL WHERE event_id = ?',
      )
      .run(event.eventId);
    expect(() => store.commitTransition(transition.id, ownerId, runLeaseEpoch, {}, 1000)).toThrow(
      'authenticated approval',
    );
    expect(store.getTransition(transition.id)?.status).toBe('prepared');
    tamper
      .prepare('UPDATE approval_notifications SET response_evidence_digest = ? WHERE event_id = ?')
      .run(approval.responseEvidenceDigest, event.eventId);
    tamper.close();
    store.acquireLease('workspace', workspaceId, ownerId, 10_000, 1000);
    store.acquireLease('run', event.runId, ownerId, 10_000, 1000);
    store.acquireLease('task', event.taskId, ownerId, 10_000, 1000);
    expect(() => store.commitTransition(transition.id, ownerId, runLeaseEpoch, {}, 5000)).toThrow(
      'deadline',
    );
    store.commitTransition(transition.id, ownerId, runLeaseEpoch, {}, 1000);
    expect(store.getApprovalNotification(event.eventId)?.state).toBe('resumed');
    expect(store.getApprovalWaitContext(event.runId)?.status).toBe('resumed');
    // A second entry into approval_waiting has a distinct durable generation and cannot replay the old receipt.
    const enter: PrepareTransitionInput = {
      ...transition,
      id: 'approval-again',
      from: 'finalizing',
      to: 'approval_waiting',
      expectedRunVersion: 2,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: event.runId,
        transitionId: 'approval-again',
        operation: 'workflow.resume',
        expectedVersion: 2,
      }),
    };
    store.prepareTransition(enter);
    store.commitTransition(enter.id, ownerId, runLeaseEpoch, {}, 1000);
    const nextIdentity = {
      ...identity,
      phase: 'finalizing',
      predecessor: 'finalizing' as const,
      actionScopeDigest: hash('9'),
    };
    const next = { ...nextIdentity, eventId: digestGovernedValue(nextIdentity) };
    store.seedApprovalWaitIntentForTest(next, 1000);
    const nextTransition = {
      ...transition,
      id: 'approval-resume-2',
      expectedRunVersion: 4,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: event.runId,
        transitionId: 'approval-resume-2',
        operation: 'workflow.resume',
        expectedVersion: 4,
      }),
    };
    expect(() => store.prepareTransition(nextTransition)).toThrow('authenticated approval');
    await coordinator.deliver(next);
    coordinator.approve(next.eventId, {
      ...approval,
      authenticatedResponseDigest: next.allowedResponseDigest,
    });
    await coordinator.resume(next.eventId);
    store.prepareTransition(nextTransition);
    store.commitTransition(nextTransition.id, ownerId, runLeaseEpoch, {}, 1000);
    expect(store.getRun(event.runId)).toMatchObject({ state: 'finalizing', version: 6 });
    expect(store.getApprovalWaitContext(event.runId)?.eventId).toBe(next.eventId);
    expect(accepted.size).toBe(4);
    store.close();
  });

  it('reconciles resume provider acceptance after response loss and process restart', async () => {
    const { store, database, contractId } = await setup();
    store.createRun(contractId, 'approval_waiting', 'run-resume-loss');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'run-resume-loss', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    const identity = {
      kind: 'notification.approval',
      workspaceId,
      runId: 'run-resume-loss',
      taskId: 'task.1',
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      headSha: 'd'.repeat(40),
      actionScopeDigest: hash('e'),
      recipientIdentity: 'owner',
      destinationDigest: hash('f'),
      allowedResponseDigest: hash('1'),
      expiresAtMs: 5000,
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      maxAttempts: 3,
    } as const;
    const event = { ...identity, eventId: digestGovernedValue(identity) };
    store.seedApprovalWaitIntentForTest(event, 1000);
    const accepted = new Map<
      string,
      { generation: string; messageId: string; providerAcceptedAtMs: number }
    >();
    let loseResumeResponse = true;
    const port = createProductionApprovalNotificationPort({
      async observe(eventId, purpose) {
        return (
          accepted.get(`${eventId}:${purpose}`) ?? {
            generation: purpose,
            messageId: null,
            providerAcceptedAtMs: null,
          }
        );
      },
      async send({ event: sent, purpose }) {
        const result = {
          generation: purpose,
          messageId: `${purpose}-message`,
          providerAcceptedAtMs: 1000,
        };
        accepted.set(`${sent.eventId}:${purpose}`, result);
        if (purpose === 'resume' && loseResumeResponse) {
          loseResumeResponse = false;
          throw new Error('response lost');
        }
        return result;
      },
    });
    const first = new ApprovalNotificationCoordinator(
      createWorkflowStoreApprovalNotificationJournal(store, () => 1000),
      port,
      () => 1000,
    );
    await first.deliver(event);
    first.approve(event.eventId, {
      authenticatedResponseDigest: event.allowedResponseDigest,
      responderIdentity: 'owner',
      responseEvidenceDigest: hash('2'),
      acceptedAtMs: 1000,
    });
    await expect(first.resume(event.eventId)).resolves.toMatchObject({ state: 'delivery_failed' });
    await expect(first.deliver(event)).rejects.toThrow(
      'resume delivery failure cannot re-enter approval delivery',
    );
    expect(store.getApprovalWaitContext(event.runId)).toMatchObject({
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      eventId: event.eventId,
      deadlineMs: 5000,
      status: 'waiting',
    });
    store.close();
    const reopened = new WorkflowStore(database);
    const recovered = new ApprovalNotificationCoordinator(
      createWorkflowStoreApprovalNotificationJournal(reopened, () => 1000),
      port,
      () => 1000,
    );
    expect(reopened.getApprovalWaitContext(event.runId)).toMatchObject({ status: 'waiting' });
    await expect(recovered.resume(event.eventId)).resolves.toMatchObject({
      state: 'resume_pending',
      messageId: 'resume-message',
    });
    expect(reopened.getApprovalWaitContext(event.runId)).toMatchObject({ status: 'waiting' });
    reopened.close();
  });

  it('never crosses approval and resume delivery-failure retry purposes', async () => {
    const { store, contractId } = await setup();
    const runId = 'run-cross-purpose';
    const ownerId = 'owner';
    store.createRun(contractId, 'approval_waiting', runId);
    const identity = {
      kind: 'notification.approval',
      workspaceId,
      runId,
      taskId: 'task.1',
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      headSha: 'd'.repeat(40),
      actionScopeDigest: hash('e'),
      recipientIdentity: ownerId,
      destinationDigest: hash('f'),
      allowedResponseDigest: hash('1'),
      expiresAtMs: 5000,
      ownerId,
      workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, ownerId, 1000, 1000).epoch,
      runLeaseEpoch: store.acquireLease('run', runId, ownerId, 1000, 1000).epoch,
      taskLeaseEpoch: store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch,
      maxAttempts: 3,
    } as const;
    const event = { ...identity, eventId: digestGovernedValue(identity) };
    store.seedApprovalWaitIntentForTest(event, 1000);
    let failApproval = true;
    const coordinator = new ApprovalNotificationCoordinator(
      createWorkflowStoreApprovalNotificationJournal(store, () => 1000),
      createProductionApprovalNotificationPort({
        async observe(_eventId, purpose) {
          return { generation: purpose, messageId: null, providerAcceptedAtMs: null };
        },
        async send({ purpose }) {
          if (purpose === 'approval' && failApproval) {
            failApproval = false;
            throw new Error('approval delivery failed');
          }
          return {
            generation: purpose,
            messageId: `${purpose}-message`,
            providerAcceptedAtMs: 1000,
          };
        },
      }),
      () => 1000,
    );
    await expect(coordinator.deliver(event)).resolves.toMatchObject({
      state: 'delivery_failed',
      failurePurpose: 'approval',
    });
    await expect(coordinator.resume(event.eventId)).rejects.toThrow(
      'approved notification is required',
    );
    await expect(coordinator.deliver(event)).resolves.toMatchObject({
      state: 'delivered',
      failurePurpose: null,
    });
    store.close();
  });

  it.each(['workspace', 'run', 'task'] as const)(
    'rejects stale %s fences on every notification CAS',
    async (resource) => {
      const { store, contractId } = await setup();
      const runId = `run-stale-${resource}`;
      store.createRun(contractId, 'approval_waiting', runId);
      const ownerId = 'owner';
      const workspaceLeaseEpoch = store.acquireLease(
        'workspace',
        workspaceId,
        ownerId,
        resource === 'workspace' ? 1000 : 10_000,
        1000,
      ).epoch;
      const runLeaseEpoch = store.acquireLease(
        'run',
        runId,
        ownerId,
        resource === 'run' ? 1000 : 10_000,
        1000,
      ).epoch;
      const taskLeaseEpoch = store.acquireLease(
        'task',
        'task.1',
        ownerId,
        resource === 'task' ? 1000 : 10_000,
        1000,
      ).epoch;
      const identity = {
        kind: 'notification.approval',
        workspaceId,
        runId,
        taskId: 'task.1',
        phase: 'delivery',
        predecessor: 'delivery',
        resumeTarget: 'finalizing',
        contractVersion: 1,
        policyDigest,
        materialDigest: hash('c'),
        headSha: 'd'.repeat(40),
        actionScopeDigest: hash('e'),
        recipientIdentity: 'owner',
        destinationDigest: hash('f'),
        allowedResponseDigest: hash('1'),
        expiresAtMs: 5000,
        ownerId,
        workspaceLeaseEpoch,
        runLeaseEpoch,
        taskLeaseEpoch,
        maxAttempts: 3,
      } as const;
      const event = { ...identity, eventId: digestGovernedValue(identity) };
      store.seedApprovalWaitIntentForTest(event, 1000);
      let nowMs = 1000;
      const journal = createWorkflowStoreApprovalNotificationJournal(store, () => nowMs);
      journal.prepare(event);
      const resourceId =
        resource === 'workspace' ? workspaceId : resource === 'run' ? runId : 'task.1';
      nowMs = 2001;
      store.acquireLease(resource, resourceId, 'replacement-owner', 1000, nowMs);
      expect(() =>
        journal.compareAndSwap({
          eventId: event.eventId,
          from: 'prepared',
          to: 'delivery_pending',
        }),
      ).toThrow(`${resource} fencing`);
      store.close();
    },
  );

  it('rejects notification preparation outside approval_waiting', async () => {
    const { store, contractId } = await setup();
    store.createRun(contractId, 'delivery', 'wrong-state');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'wrong-state', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    const identity = {
      kind: 'notification.approval',
      workspaceId,
      runId: 'wrong-state',
      taskId: 'task.1',
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      headSha: 'd'.repeat(40),
      actionScopeDigest: hash('e'),
      recipientIdentity: 'owner',
      destinationDigest: hash('f'),
      allowedResponseDigest: hash('1'),
      expiresAtMs: 5000,
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      maxAttempts: 3,
    } as const;
    const event = { ...identity, eventId: digestGovernedValue(identity) };
    store.seedApprovalWaitIntentForTest(event, 1000);
    expect(() =>
      createWorkflowStoreApprovalNotificationJournal(store, () => 1000).prepare(event),
    ).toThrow('waiting-state');
    store.close();
  });

  it('reconciles a callback wakeup lost across restart and rejects stale fences', async () => {
    const { store, database, contractId } = await setup();
    store.createRun(contractId, 'task_review', 'run-callback');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const parentRunLeaseEpoch = store.acquireLease(
      'run',
      'run-callback',
      ownerId,
      1000,
      1000,
    ).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    const headSha = 'c'.repeat(40);
    const artifacts = store.seedDelegateCallbackAuthorizationForTest({
      workspaceId,
      runId: 'run-callback',
      taskId: 'task.1',
      delegationId: 'critic',
      delegateAgentId: 'zeno',
      delegateRole: 'code_reviewer',
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch: parentRunLeaseEpoch,
      taskLeaseEpoch,
      materialDigest: hash('c'),
      headSha,
      inputProducerIdentity: 'orchestrator',
      input: { packet: 'review' },
      result: {
        status: 'passed',
        summary: 'review requires owner approval',
        changedFiles: [],
        acceptanceCriteria: { passed: [], failed: [] },
        evidence: [],
        findings: [],
        remainingRisks: [],
        recommendedTransition: 'continue',
      },
      nowMs: 1000,
    });
    let wakes = 0;
    const wakeAcceptances = new Map<
      string,
      { generation: string; messageId: string; providerAcceptedAtMs: number }
    >();
    const coordinator = new DelegateCallbackCoordinator(
      createWorkflowStoreDelegateCallbackStore({
        store,
        ownerId,
        clock: () => 1000,
      }),
      createParentWakePortForTest({
        observe(_runId, wakeupId) {
          return wakeAcceptances.get(wakeupId) ?? null;
        },
        send(_runId, wakeupId) {
          wakeAcceptances.set(wakeupId, {
            generation: 'test',
            messageId: 'wake',
            providerAcceptedAtMs: 1000,
          });
          throw new Error('parent process interrupted');
        },
      }),
    );
    const identity = {
      kind: 'workflow.delegate_callback',
      workspaceId,
      parentRunId: 'run-callback',
      parentTaskId: 'task.1',
      parentState: 'task_review',
      parentRunVersion: 0,
      delegationId: 'critic',
      delegateAgentId: 'zeno',
      delegateRole: 'code_reviewer',
      attemptNumber: 1,
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      workspaceLeaseEpoch,
      parentRunLeaseEpoch,
      taskLeaseEpoch,
      headSha,
      inputProducerIdentity: 'orchestrator',
      resultProducerIdentity: 'zeno',
      inputArtifactDigest: artifacts.inputArtifactDigest,
      terminalStatus: 'approval_required',
      resultArtifactDigest: artifacts.resultArtifactDigest,
      approvalIntent: {
        eventId: hash('8'),
        phase: 'task_review',
        resumeTarget: 'task_accepted',
        recipientIdentity: 'owner',
        deadlineMs: 5000,
      },
    } as const;
    const callback = { ...identity, callbackId: digestGovernedValue(identity) };
    const wrongAttempt = { ...identity, attemptNumber: 2 };
    expect(() =>
      coordinator.ingest({ ...wrongAttempt, callbackId: digestGovernedValue(wrongAttempt) }),
    ).toThrow('scheduler authorization');
    const wrongRole = { ...identity, delegateRole: 'implementation_worker' };
    expect(() =>
      coordinator.ingest({ ...wrongRole, callbackId: digestGovernedValue(wrongRole) }),
    ).toThrow('scheduler authorization');
    const wrongMaterial = { ...identity, materialDigest: hash('9') };
    expect(() =>
      coordinator.ingest({ ...wrongMaterial, callbackId: digestGovernedValue(wrongMaterial) }),
    ).toThrow('active material approval');
    const wrongProducer = { ...identity, resultProducerIdentity: 'substituted-agent' };
    expect(() =>
      coordinator.ingest({ ...wrongProducer, callbackId: digestGovernedValue(wrongProducer) }),
    ).toThrow('evidence binding');
    expect(() => coordinator.ingest(callback)).toThrow('parent process interrupted');
    expect(store.getRun('run-callback')).toMatchObject({ state: 'approval_waiting', version: 1 });
    store.close();
    const reopened = new WorkflowStore(database);
    const recovered = new DelegateCallbackCoordinator(
      createWorkflowStoreDelegateCallbackStore({
        store: reopened,
        ownerId,
        clock: () => 1000,
      }),
      createParentWakePortForTest({
        observe(_runId, wakeupId) {
          const acceptance = wakeAcceptances.get(wakeupId) ?? null;
          if (acceptance !== null) wakes += 1;
          return acceptance;
        },
        send() {
          throw new Error('duplicate wake send');
        },
      }),
    );
    expect(recovered.reconcilePendingWakeups()).toEqual([callback.callbackId]);
    expect(recovered.ingest(callback).disposition).toBe('duplicate');
    // Acceptance alone cannot suppress retries before durable parent consumption.
    expect(wakes).toBe(2);
    const staleIdentity = {
      ...identity,
      workspaceLeaseEpoch: workspaceLeaseEpoch + 1,
    };
    expect(() =>
      recovered.ingest({ ...staleIdentity, callbackId: digestGovernedValue(staleIdentity) }),
    ).toThrow('scheduler authorization');
    const staleRunIdentity = {
      ...identity,
      parentRunLeaseEpoch: parentRunLeaseEpoch + 1,
    };
    expect(() =>
      recovered.ingest({
        ...staleRunIdentity,
        callbackId: digestGovernedValue(staleRunIdentity),
      }),
    ).toThrow('scheduler authorization');
    const staleTaskIdentity = {
      ...identity,
      taskLeaseEpoch: taskLeaseEpoch + 1,
    };
    expect(() =>
      recovered.ingest({
        ...staleTaskIdentity,
        callbackId: digestGovernedValue(staleTaskIdentity),
      }),
    ).toThrow('scheduler authorization');
    reopened.close();
  });

  it('atomically imports exact lineage and idempotently survives restart', async () => {
    const { store, database, contractId } = await setup();
    store.createRun(contractId, 'cancelled', 'source-run');
    store.createRun(contractId, 'approved', 'target-run');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'target-run', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    const request = {
      kind: 'workflow.lineage_import',
      sourceRunId: 'source-run',
      targetRunId: 'target-run',
      sourceTaskId: 'task.1',
      targetTaskId: 'task.1',
      sourceState: 'cancelled',
      targetState: 'approved',
      sourceFenced: true,
      sourcePreparedOperationCount: 0,
      ref: 'refs/heads/task/task.1',
      headSha: 'a'.repeat(40),
      treeSha: 'b'.repeat(40),
      implementationArtifactDigest: hash('c'),
      beadsSnapshotDigest: hash('d'),
      contractDigest: digestGovernedValue(contract),
      policyDigest,
      materialDigest: hash('f'),
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
    } as const;
    store.seedLineageApprovalForTest({
      runId: 'target-run',
      materialDigest: request.materialDigest,
      nowMs: 1000,
    });
    const observationPort = createTrustedLineageObservationPortForTest({
      git: {
        async observeRef() {
          return { headSha: request.headSha, treeSha: request.treeSha };
        },
      },
      evidence: {
        async observeImplementation() {
          return {
            implementationArtifactDigest: request.implementationArtifactDigest,
            materialDigest: request.materialDigest,
          };
        },
      },
      beads: {
        async observeTask() {
          return { snapshotDigest: request.beadsSnapshotDigest };
        },
      },
    });
    const substitutedPort = createTrustedLineageObservationPortForTest({
      git: {
        async observeRef() {
          return { headSha: '9'.repeat(40), treeSha: request.treeSha };
        },
      },
      evidence: {
        async observeImplementation() {
          return {
            implementationArtifactDigest: request.implementationArtifactDigest,
            materialDigest: request.materialDigest,
          };
        },
      },
      beads: {
        async observeTask() {
          return { snapshotDigest: request.beadsSnapshotDigest };
        },
      },
    });
    await expect(
      importWorkflowLineage({
        store,
        request,
        observationPort: substitutedPort,
        ownerId,
        operationId: 'substituted-import',
        nowMs: 1000,
      }),
    ).rejects.toThrow('trusted observation differs');
    await expect(
      importWorkflowLineage({
        store,
        request: { ...request, contractDigest: hash('0') },
        observationPort,
        ownerId,
        operationId: 'bad-import',
        nowMs: 1000,
      }),
    ).rejects.toThrow('contract or task binding');
    expect(store.getRun('target-run')).toMatchObject({ state: 'approved', version: 0 });
    await expect(
      importWorkflowLineage({
        store,
        request,
        observationPort,
        ownerId,
        operationId: 'faulted-import',
        nowMs: 1000,
        testFault: (boundary) => {
          if (boundary === 'after_ledger') throw new Error('injected lineage interruption');
        },
      }),
    ).rejects.toThrow('injected lineage interruption');
    expect(store.getRun('target-run')).toMatchObject({ state: 'approved', version: 0 });
    await expect(
      importWorkflowLineage({
        store,
        request,
        observationPort,
        ownerId,
        operationId: 'import-1',
        nowMs: 1000,
      }),
    ).resolves.toMatchObject({ state: 'pipeline', version: 1 });
    store.close();
    const reopened = new WorkflowStore(database);
    await expect(
      importWorkflowLineage({
        store: reopened,
        request,
        observationPort,
        ownerId,
        operationId: 'import-1',
        nowMs: 1000,
      }),
    ).resolves.toMatchObject({ state: 'pipeline', version: 1 });
    reopened.close();
  });

  it('uses the existing SQLite delivery journal for exact Beads note CAS and restart replay', async () => {
    const { store, database, contractId } = await setup();
    expect(() => store.createRun(contractId, 'pipeline', 'forbidden-pipeline')).toThrow(
      'exact lineage import',
    );
    store.createRunForTest(contractId, 'pipeline', 'run-notes');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'run-notes', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    let notes = 'old';
    let revision = '1';
    let mutations = 0;
    const snapshot = () => ({
      id: 'task.1',
      notes,
      status: 'in_progress',
      description: 'unchanged',
      acceptanceCriteria: 'unchanged',
      owner: 'owner',
      dependencies: [] as string[],
      revision,
    });
    const client = {
      async readIssue() {
        return snapshot();
      },
      async compareAndSwapNotes(input: {
        expectedRevision: string;
        expectedPriorNotesDigest: string;
        replacementNotes: string;
      }) {
        if (
          input.expectedRevision !== revision ||
          input.expectedPriorNotesDigest !== digestGovernedValue(notes)
        )
          throw new Error('notes CAS failed');
        mutations += 1;
        notes = input.replacementNotes;
        revision = '2';
        return snapshot();
      },
      async observeThreads() {
        return [];
      },
      async replyToThread() {
        return { messageId: 'unused' };
      },
      async resolveThread() {
        return { resolved: true as const };
      },
    };
    const replacementNotes = 'new';
    const request = {
      kind: 'beads.task_note_update',
      workspaceId,
      runId: 'run-notes',
      taskId: 'task.1',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      expectedPriorNotesDigest: digestGovernedValue(notes),
      expectedNonNotesDigest: digestGovernedValue({
        id: 'task.1',
        status: 'in_progress',
        description: 'unchanged',
        acceptanceCriteria: 'unchanged',
        owner: 'owner',
        dependencies: [],
      }),
      replacementNotes,
      replacementNotesDigest: digestGovernedValue(replacementNotes),
    } as const;
    const broker = new GovernedOperationBroker(
      createWorkflowStoreGovernedJournal(store, () => 1000),
      createProductionGovernedExternalPort(client),
    );
    await expect(broker.execute(request)).resolves.toMatchObject({ status: 'committed' });
    store.close();
    const reopened = new WorkflowStore(database);
    const replay = new GovernedOperationBroker(
      createWorkflowStoreGovernedJournal(reopened, () => 1000),
      createProductionGovernedExternalPort(client),
    );
    await expect(replay.execute(request)).resolves.toMatchObject({ status: 'committed' });
    expect(mutations).toBe(1);
    reopened.close();
  });

  it('persists independently evidenced review dispositions and binds resolution to their digest', async () => {
    const { store, contractId } = await setup();
    store.createRunForTest(contractId, 'pipeline', 'run-review');
    const ownerId = 'owner';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'run-review', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', 'task.1', ownerId, 1000, 1000).epoch;
    const headSha = 'a'.repeat(40);
    const artifacts = store.seedDelegateCallbackAuthorizationForTest({
      workspaceId,
      runId: 'run-review',
      taskId: 'task.1',
      delegationId: 'review-fixture',
      delegateAgentId: 'zeno',
      delegateRole: 'code_reviewer',
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      materialDigest: hash('c'),
      headSha,
      inputProducerIdentity: 'orchestrator',
      input: { review: 'input' },
      result: { review: 'evidence' },
      nowMs: 1000,
    });
    const replyBody = 'Disposition: repaired with verified evidence.';
    const reply = {
      kind: 'github.review_thread_reply',
      workspaceId,
      runId: 'run-review',
      taskId: 'task.1',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      repository: 'owner/repo',
      pullRequestNumber: 1,
      headSha,
      threadId: 'thread-1',
      reviewEventIdentity: 'event-1',
      disposition: 'repaired',
      evidenceDigests: [artifacts.resultArtifactDigest],
      replyBody,
      replyBodyDigest: digestGovernedValue(replyBody),
      reviewerAgentId: 'zeno',
      implementingAgentId: 'worker',
    } as const;
    const dispositionIdentity = {
      disposition: reply.disposition,
      reviewerAgentId: reply.reviewerAgentId,
      evidenceDigests: reply.evidenceDigests,
      headSha,
      reviewEventIdentity: reply.reviewEventIdentity,
    };
    const acceptedDispositionDigest = digestGovernedValue(dispositionIdentity);
    let replied = false;
    let resolved = false;
    const client = {
      async readIssue() {
        throw new Error('unused');
      },
      async compareAndSwapNotes() {
        throw new Error('unused');
      },
      async observeThreads() {
        return [
          {
            id: 'thread-1',
            isResolved: resolved,
            headSha,
            reviewEventIdentity: 'event-1',
            replies: replied
              ? [{ messageId: 'reply-1', bodyDigest: digestGovernedValue(replyBody) }]
              : [],
            acceptedDispositionDigest: replied ? acceptedDispositionDigest : null,
          },
        ];
      },
      async replyToThread() {
        replied = true;
        return { messageId: 'reply-1' };
      },
      async resolveThread() {
        resolved = true;
        return { resolved: true as const };
      },
    };
    const broker = new GovernedOperationBroker(
      createWorkflowStoreGovernedJournal(store, () => 1000),
      createProductionGovernedExternalPort(client),
    );
    await expect(broker.execute(reply)).resolves.toMatchObject({ status: 'committed' });
    const resolve = {
      kind: 'github.review_thread_resolve',
      workspaceId,
      runId: 'run-review',
      taskId: 'task.1',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      materialDigest: hash('c'),
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      repository: 'owner/repo',
      pullRequestNumber: 1,
      headSha,
      threadId: 'thread-1',
      reviewEventIdentity: 'event-1',
      acceptedDispositionDigest,
      replyMessageId: 'reply-1',
    } as const;
    await expect(
      broker.execute({ ...resolve, acceptedDispositionDigest: hash('0') }),
    ).resolves.toMatchObject({ status: 'escalated' });
    await expect(broker.execute(resolve)).resolves.toMatchObject({ status: 'committed' });
    store.close();
  });
});
