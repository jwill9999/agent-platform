import { describe, expect, it } from 'vitest';

import {
  DELEGATE_CALLBACK_TARGETS,
  NORMATIVE_TRANSITIONS,
  approvalNotificationSchema,
  DelegateCallbackCoordinator,
  GovernedOperationBroker,
  assertProductionGovernedPort,
  assertZeroUnresolvedThreads,
  createTrustedGovernedExternalPort,
  createParentWakePortForTest,
  GitHubDeliveryPort,
  OfficialBeadsDoltPort,
  beadsTaskNoteUpdateSchema,
  delegateCallbackSchema,
  delegateCallbackTarget,
  digestGovernedValue,
  githubReviewThreadReplySchema,
  lineageImportSchema,
  validateApprovalNotificationTransition,
  type WorkflowState,
  type GovernedJournalRecord,
} from '../src/index.js';
import {
  createProductionGovernedExternalPort,
  registerProductionGovernedPort,
} from '../src/governedOperations.js';

const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}`;

describe('governed operations', () => {
  it('requires exact Beads replacement content and rejects concurrent substitution', () => {
    const replacementNotes = 'reviewed at exact head';
    const request = {
      kind: 'beads.task_note_update',
      workspaceId: digest('1'),
      runId: 'run',
      taskId: 'task',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest: digest('2'),
      materialDigest: digest('3'),
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 2,
      taskLeaseEpoch: 3,
      expectedPriorNotesDigest: digest('4'),
      expectedNonNotesDigest: digest('8'),
      replacementNotes,
      replacementNotesDigest: digestGovernedValue(replacementNotes),
    } as const;
    expect(beadsTaskNoteUpdateSchema.parse(request)).toEqual(request);
    expect(() =>
      beadsTaskNoteUpdateSchema.parse({ ...request, replacementNotes: 'substituted' }),
    ).toThrow();
  });

  it('enforces reviewer separation and evidence on review replies', () => {
    const body = 'Disposition: repaired; evidence attached.';
    const request = {
      kind: 'github.review_thread_reply',
      workspaceId: digest('1'),
      runId: 'run',
      taskId: 'task',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest: digest('2'),
      materialDigest: digest('3'),
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 2,
      taskLeaseEpoch: 3,
      repository: 'owner/repo',
      pullRequestNumber: 1,
      headSha: 'a'.repeat(40),
      threadId: 'thread',
      reviewEventIdentity: 'review-event',
      disposition: 'repaired',
      evidenceDigests: [digest('5')],
      replyBody: body,
      replyBodyDigest: digestGovernedValue(body),
      reviewerAgentId: 'reviewer',
      implementingAgentId: 'worker',
    } as const;
    expect(githubReviewThreadReplySchema.parse(request)).toEqual(request);
    expect(() =>
      githubReviewThreadReplySchema.parse({ ...request, reviewerAgentId: 'worker' }),
    ).toThrow('reviewer separation');
    expect(() =>
      githubReviewThreadReplySchema.parse({ ...request, evidenceDigests: [] }),
    ).toThrow();
  });

  it('separates provider transport acceptance from authenticated approval and resume', () => {
    const identity = {
      kind: 'notification.approval',
      workspaceId: digest('0'),
      runId: 'run',
      taskId: 'task',
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest: digest('2'),
      materialDigest: digest('3'),
      headSha: 'a'.repeat(40),
      actionScopeDigest: digest('4'),
      recipientIdentity: 'owner',
      destinationDigest: digest('5'),
      allowedResponseDigest: digest('6'),
      expiresAtMs: 1000,
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 2,
      taskLeaseEpoch: 3,
      maxAttempts: 3,
    } as const;
    expect(
      approvalNotificationSchema.parse({ ...identity, eventId: digestGovernedValue(identity) }),
    ).toBeTruthy();
    expect(() =>
      validateApprovalNotificationTransition({ from: 'delivery_pending', to: 'delivered' }),
    ).toThrow('provider acceptance');
    expect(() =>
      validateApprovalNotificationTransition({ from: 'delivered', to: 'approved' }),
    ).toThrow('authenticated');
    expect(() =>
      validateApprovalNotificationTransition({ from: 'resume_pending', to: 'resumed' }),
    ).toThrow('provider acceptance');
    expect(() =>
      validateApprovalNotificationTransition({
        from: 'delivered',
        to: 'approved',
        authenticatedHumanResponse: true,
      }),
    ).not.toThrow();
  });

  it('maps every callback edge to the normative state machine and rejects unmapped callbacks', () => {
    for (const [state, outcomes] of Object.entries(DELEGATE_CALLBACK_TARGETS)) {
      for (const target of Object.values(outcomes)) {
        expect(NORMATIVE_TRANSITIONS[state as WorkflowState]).toContain(target);
      }
    }
    const identity = {
      kind: 'workflow.delegate_callback',
      workspaceId: digest('0'),
      parentRunId: 'run',
      parentTaskId: 'task',
      parentState: 'implementing',
      parentRunVersion: 2,
      delegationId: 'delegation',
      delegateAgentId: 'worker',
      delegateRole: 'implementation_worker',
      attemptNumber: 1,
      contractVersion: 1,
      policyDigest: digest('1'),
      materialDigest: digest('2'),
      workspaceLeaseEpoch: 3,
      parentRunLeaseEpoch: 4,
      taskLeaseEpoch: 5,
      headSha: 'a'.repeat(40),
      inputProducerIdentity: 'orchestrator',
      resultProducerIdentity: 'delegate',
      inputArtifactDigest: digest('6'),
      terminalStatus: 'repair',
      resultArtifactDigest: digest('7'),
    } as const;
    const callback = { ...identity, callbackId: digestGovernedValue(identity) };
    expect(delegateCallbackSchema.parse(callback)).toEqual(callback);
    expect(delegateCallbackTarget(callback)).toBe('task_verification');
    const unmappedIdentity = { ...identity, parentState: 'scheduling' as const };
    expect(() =>
      delegateCallbackTarget({
        ...unmappedIdentity,
        callbackId: digestGovernedValue(unmappedIdentity),
      }),
    ).toThrow('unmapped');
  });

  it('rejects ambiguous lineage and unsafe review merge observations', () => {
    const lineage = {
      kind: 'workflow.lineage_import',
      sourceRunId: 'same',
      targetRunId: 'same',
      sourceTaskId: 'old',
      targetTaskId: 'new',
      sourceState: 'cancelled',
      targetState: 'approved',
      sourceFenced: true,
      sourcePreparedOperationCount: 0,
      ref: 'refs/heads/task/repair.4',
      headSha: 'a'.repeat(40),
      treeSha: 'b'.repeat(40),
      implementationArtifactDigest: digest('1'),
      beadsSnapshotDigest: digest('2'),
      contractDigest: digest('3'),
      policyDigest: digest('4'),
      materialDigest: digest('5'),
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 2,
      taskLeaseEpoch: 3,
    } as const;
    expect(() => lineageImportSchema.parse(lineage)).toThrow('distinct runs');
    const observed = (input: {
      headSha?: string;
      latestReviewEventIdentity?: string;
      requiredChecks?: Record<string, string>;
      threads: Array<{
        id: string;
        isResolved: boolean;
        headSha: string;
        reviewEventIdentity: string;
        replies: never[];
        acceptedDispositionDigest: string | null;
      }>;
    }) => {
      const identity = {
        repository: 'owner/repo',
        pullRequestNumber: 1,
        headSha: input.headSha ?? 'a'.repeat(40),
        latestReviewEventIdentity: input.latestReviewEventIdentity ?? 'event',
        requiredChecks: input.requiredChecks ?? { verify: 'success' },
        threads: input.threads,
        observerIdentity: 'hardened-github-adapter',
        observedAtMs: 1000,
      };
      return { ...identity, observationDigest: digestGovernedValue(identity) };
    };
    const unresolved = {
      id: 't',
      isResolved: false,
      headSha: 'a'.repeat(40),
      reviewEventIdentity: 'event',
      replies: [] as never[],
      acceptedDispositionDigest: digest('9'),
    };
    expect(() =>
      assertZeroUnresolvedThreads({
        expectedHeadSha: 'a'.repeat(40),
        expectedReviewEventIdentity: 'event',
        observation: observed({ threads: [unresolved] }),
      }),
    ).toThrow('unresolved');
    const resolved = {
      id: 't',
      isResolved: true,
      headSha: 'a'.repeat(40),
      reviewEventIdentity: 'event',
      replies: [],
      acceptedDispositionDigest: digest('9'),
    };
    expect(() =>
      assertZeroUnresolvedThreads({
        expectedHeadSha: 'a'.repeat(40),
        expectedReviewEventIdentity: 'event',
        observation: observed({ requiredChecks: { verify: 'failure' }, threads: [resolved] }),
      }),
    ).toThrow('checks');
    expect(() =>
      assertZeroUnresolvedThreads({
        expectedHeadSha: 'b'.repeat(40),
        expectedReviewEventIdentity: 'event',
        observation: observed({ threads: [resolved] }),
      }),
    ).toThrow('stale');
    expect(() =>
      assertZeroUnresolvedThreads({
        expectedHeadSha: 'a'.repeat(40),
        expectedReviewEventIdentity: 'newer-event',
        observation: observed({ threads: [resolved] }),
      }),
    ).toThrow('stale');
    expect(() =>
      assertZeroUnresolvedThreads({
        expectedHeadSha: 'a'.repeat(40),
        expectedReviewEventIdentity: 'event',
        observation: observed({ threads: [{ ...resolved, acceptedDispositionDigest: null }] }),
      }),
    ).toThrow('accepted disposition');
    expect(() =>
      assertZeroUnresolvedThreads({
        expectedHeadSha: 'a'.repeat(40),
        expectedReviewEventIdentity: 'event',
        observation: { ...observed({ threads: [] }), headSha: 'b'.repeat(40) },
      }),
    ).toThrow('attestation');
    expect(() =>
      assertZeroUnresolvedThreads({
        expectedHeadSha: 'a'.repeat(40),
        expectedReviewEventIdentity: 'event',
        observation: observed({ threads: [] }),
      }),
    ).not.toThrow();
  });

  it('rejects unregistered production ports', () => {
    expect(() => assertProductionGovernedPort({})).toThrow('unregistered');
    const port = registerProductionGovernedPort({});
    expect(() => assertProductionGovernedPort(port)).not.toThrow();
  });

  it('constructs governed Beads/GitHub adapters only with exact trusted routes', async () => {
    const beads = {
      async readIssue() {
        return { status: 'open' as const, blockingDependencies: [] };
      },
      async claimIssue() {},
      async closeIssue() {},
      async readDoltSync() {
        return 'synced' as const;
      },
      async pushDolt() {},
      async readIssueWithNotes(_root: string, taskId: string) {
        return {
          id: taskId,
          notes: 'old',
          status: 'open',
          description: 'description',
          acceptanceCriteria: 'criteria',
          owner: null,
          dependencies: [],
          revision: '1',
        };
      },
      async compareAndSwapIssueNotes(input: { taskId: string; replacementNotes: string }) {
        return {
          id: input.taskId,
          notes: input.replacementNotes,
          status: 'open',
          description: 'description',
          acceptanceCriteria: 'criteria',
          owner: null,
          dependencies: [],
          revision: '2',
        };
      },
    };
    const github = {
      async findPullRequest() {
        return null;
      },
      async createPullRequest() {},
      async compareAndMergePullRequest() {},
      async observeReviewThreads() {
        return [];
      },
      async replyToReviewThread() {
        return { messageId: 'message' };
      },
      async resolveReviewThread() {
        return { resolved: true as const };
      },
    };
    const beadsPort = OfficialBeadsDoltPort.createForTest('/workspace', beads);
    const githubPort = GitHubDeliveryPort.createForTest(github, 'owner/repo');
    const port = createTrustedGovernedExternalPort({
      workspaceId: digest('1'),
      beads: beadsPort,
      github: githubPort,
    });
    const request = {
      kind: 'github.review_threads_observe',
      workspaceId: digest('1'),
      runId: 'run',
      taskId: 'task',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest: digest('2'),
      materialDigest: digest('3'),
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 1,
      taskLeaseEpoch: 1,
      repository: 'other/repo',
      pullRequestNumber: 1,
      headSha: 'a'.repeat(40),
      reviewEventIdentity: 'event',
    } as const;
    await expect(port.observe(request)).rejects.toThrow('repository route');
    expect(() =>
      createTrustedGovernedExternalPort({
        workspaceId: digest('1'),
        beads: {} as OfficialBeadsDoltPort,
        github: githubPort,
      }),
    ).toThrow('hardened official port');
    const forgedGitHub = Object.freeze(
      Object.create(GitHubDeliveryPort.prototype) as GitHubDeliveryPort,
    );
    expect(() =>
      createTrustedGovernedExternalPort({
        workspaceId: digest('1'),
        beads: beadsPort,
        github: forgedGitHub,
      }),
    ).toThrow('unauthenticated GitHub delivery port');
  });

  it('adopts a response-lost mutation without duplicating the external effect', async () => {
    const records = new Map<string, GovernedJournalRecord>();
    const journal = {
      guard: (_id: string, _fence: unknown, initiate: () => Promise<unknown>) => initiate(),
      adopt: (id: string) => records.get(id)!,
      prepare(input: Omit<GovernedJournalRecord, 'status' | 'result'>) {
        const old = records.get(input.id);
        if (old) return old;
        const value = { ...input, status: 'prepared' as const, result: null };
        records.set(input.id, value);
        return value;
      },
      get: (id: string) => records.get(id),
      commit(id: string, _status: 'prepared', result: unknown) {
        const value = { ...records.get(id), status: 'committed', result };
        records.set(id, value);
        return value;
      },
      escalate(id: string, _status: 'prepared', result: unknown) {
        const value = { ...records.get(id), status: 'escalated', result };
        records.set(id, value);
        return value;
      },
    };
    let exists = false;
    let mutations = 0;
    const port = registerProductionGovernedPort({
      async observe() {
        return {
          kind: exists ? ('expected' as const) : ('unchanged' as const),
          result: { exists },
        };
      },
      async mutate() {
        mutations += 1;
        exists = true;
        throw new Error('response lost');
      },
    });
    const broker = new GovernedOperationBroker(journal, port);
    const request = {
      kind: 'github.review_threads_observe',
      workspaceId: digest('1'),
      runId: 'run',
      taskId: 'task',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest: digest('2'),
      materialDigest: digest('3'),
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 2,
      taskLeaseEpoch: 3,
      repository: 'owner/repo',
      pullRequestNumber: 1,
      headSha: 'a'.repeat(40),
      reviewEventIdentity: 'event',
    } as const;
    await expect(broker.execute(request)).rejects.toThrow('response lost');
    const id = [...records.keys()][0]!;
    await expect(broker.reconcilePrepared(id)).resolves.toMatchObject({ status: 'committed' });
    expect(mutations).toBe(1);
  });

  it.each(['reply', 'resolve'] as const)(
    'reconciles production GitHub %s response loss without duplicate effects',
    async (operation) => {
      const records = new Map<string, GovernedJournalRecord>();
      const journal = {
        guard: (_id: string, _fence: unknown, initiate: () => Promise<unknown>) => initiate(),
        adopt: (id: string) => records.get(id)!,
        prepare(input: Omit<GovernedJournalRecord, 'status' | 'result'>) {
          const old = records.get(input.id);
          if (old) return old;
          const value = { ...input, status: 'prepared' as const, result: null };
          records.set(input.id, value);
          return value;
        },
        get: (id: string) => records.get(id),
        commit(id: string, _status: 'prepared', result: unknown) {
          const value = { ...records.get(id)!, status: 'committed' as const, result };
          records.set(id, value);
          return value;
        },
        escalate(id: string, _status: 'prepared', result: unknown) {
          const value = { ...records.get(id)!, status: 'escalated' as const, result };
          records.set(id, value);
          return value;
        },
      };
      const body = 'evidence-backed disposition';
      const thread = {
        id: 'thread',
        isResolved: false,
        headSha: 'a'.repeat(40),
        reviewEventIdentity: 'event',
        replies: [] as Array<{ messageId: string; bodyDigest: string }>,
        acceptedDispositionDigest: digest('9'),
      };
      let mutations = 0;
      const client = {
        async readIssue() {
          throw new Error('unused');
        },
        async compareAndSwapNotes() {
          throw new Error('unused');
        },
        async observeThreads() {
          return [thread];
        },
        async replyToThread() {
          mutations += 1;
          thread.replies.push({ messageId: 'message', bodyDigest: digestGovernedValue(body) });
          throw new Error('reply response lost');
        },
        async resolveThread() {
          mutations += 1;
          thread.isResolved = true;
          throw new Error('resolve response lost');
        },
      };
      const common = {
        workspaceId: digest('1'),
        runId: 'run',
        taskId: 'task',
        actorRole: 'workflow_orchestrator',
        contractVersion: 1,
        policyDigest: digest('2'),
        materialDigest: digest('3'),
        ownerId: 'owner',
        workspaceLeaseEpoch: 1,
        runLeaseEpoch: 2,
        taskLeaseEpoch: 3,
        repository: 'owner/repo',
        pullRequestNumber: 1,
        headSha: 'a'.repeat(40),
        threadId: 'thread',
        reviewEventIdentity: 'event',
      } as const;
      const request =
        operation === 'reply'
          ? {
              ...common,
              kind: 'github.review_thread_reply' as const,
              disposition: 'repaired' as const,
              evidenceDigests: [digest('4')],
              replyBody: body,
              replyBodyDigest: digestGovernedValue(body),
              reviewerAgentId: 'reviewer',
              implementingAgentId: 'worker',
            }
          : {
              ...common,
              kind: 'github.review_thread_resolve' as const,
              acceptedDispositionDigest: digest('9'),
              replyMessageId: 'message',
            };
      if (operation === 'resolve')
        thread.replies.push({ messageId: 'message', bodyDigest: digestGovernedValue(body) });
      const broker = new GovernedOperationBroker(
        journal,
        createProductionGovernedExternalPort(client),
      );
      await expect(broker.execute(request)).rejects.toThrow('response lost');
      const id = [...records.keys()][0]!;
      await expect(broker.reconcilePrepared(id)).resolves.toMatchObject({ status: 'committed' });
      expect(mutations).toBe(1);
    },
  );

  it('dispositions duplicate callbacks once and wakes the parent on replay', () => {
    let state: WorkflowState = 'task_review';
    let version = 7;
    let wakes = 0;
    const seen = new Set<string>();
    const coordinator = new DelegateCallbackCoordinator(
      {
        recordAndTransition({ callback, target, expectedParentVersion }) {
          if (seen.has(callback.callbackId))
            return { disposition: 'duplicate' as const, state, version, needsWake: false };
          if (version !== expectedParentVersion) throw new Error('stale parent version');
          seen.add(callback.callbackId);
          state = target;
          version += 1;
          return { disposition: 'committed' as const, state, version, needsWake: true };
        },
        markParentWoken() {},
        listPendingWakeups() {
          return [];
        },
      },
      createParentWakePortForTest({
        observe() {
          return null;
        },
        send() {
          wakes += 1;
          return { generation: 'test', messageId: 'wake', providerAcceptedAtMs: 1 };
        },
      }),
    );
    const identity = {
      kind: 'workflow.delegate_callback',
      workspaceId: digest('0'),
      parentRunId: 'run',
      parentTaskId: 'task',
      parentState: 'task_review',
      parentRunVersion: 7,
      delegationId: 'review',
      delegateAgentId: 'zeno',
      delegateRole: 'code_reviewer',
      attemptNumber: 1,
      contractVersion: 1,
      policyDigest: digest('1'),
      materialDigest: digest('2'),
      workspaceLeaseEpoch: 3,
      parentRunLeaseEpoch: 4,
      taskLeaseEpoch: 5,
      headSha: 'a'.repeat(40),
      inputProducerIdentity: 'orchestrator',
      resultProducerIdentity: 'delegate',
      inputArtifactDigest: digest('6'),
      terminalStatus: 'approval_required',
      resultArtifactDigest: digest('7'),
      approvalIntent: {
        eventId: digest('8'),
        phase: 'task_review',
        resumeTarget: 'task_accepted',
        recipientIdentity: 'owner',
        deadlineMs: 5000,
      },
    } as const;
    const callback = { ...identity, callbackId: digestGovernedValue(identity) };
    expect(coordinator.ingest(callback)).toMatchObject({
      disposition: 'committed',
      state: 'approval_waiting',
    });
    expect(coordinator.ingest(callback)).toMatchObject({
      disposition: 'duplicate',
      state: 'approval_waiting',
    });
    expect(wakes).toBe(1);
  });
});
