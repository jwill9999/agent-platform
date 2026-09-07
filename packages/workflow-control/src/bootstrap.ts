import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { z } from 'zod';

import {
  assertBootstrapCandidate,
  bootstrapDigest,
  bootstrapJson,
  bootstrapPolicySchema,
  type BootstrapPolicy,
} from './bootstrapPolicy.js';
import { BootstrapJournal } from './bootstrapJournal.js';
import { WorkflowStore } from './storage.js';
import { DurableDeliveryBroker, type DeliveryFence } from './deliveryBrokers.js';
import { createProductionBootstrapGitPort } from './gitDeliveryPort.js';
import { ProcessCapabilityBroker } from './authorization.js';
import { SecureEvidenceVault } from './secureEvidence.js';
import {
  createProductionCancellationCleanupPort,
  WorkflowCancellationCoordinator,
} from './cancellation.js';
import { evidenceReferenceSchema, type EvidenceReference } from './contracts.js';
import { deriveContractMaterialDigest as deriveMaterial } from './planning.js';
import { assertBootstrapExecutablePin } from './bootstrapAdapterRuntime.js';

interface BootstrapClients {
  readBeads(): unknown;
  observeRemote(): string | null;
  pushRemote(
    input: { expectedOldSha: string | null; newSha: string },
    beforeDispatch?: () => void,
  ): void;
}
export type BootstrapFault =
  | 'after_task_observation'
  | 'after_candidate_adoption'
  | 'after_commit'
  | 'after_push'
  | 'after_attestation';

function assertBinary(binary: string, digest: string): void {
  const stat = statSync(binary);
  if (
    realpathSync(binary) !== binary ||
    !stat.isFile() ||
    !(stat.mode & 0o111) ||
    stat.mode & 0o022 ||
    (process.getuid !== undefined && stat.uid !== process.getuid()) ||
    `sha256:${createHash('sha256').update(readFileSync(binary)).digest('hex')}` !== digest
  )
    throw new Error('bootstrap adapter executable identity or permissions changed');
}
function command(
  binary: string,
  digest: string,
  request: unknown,
  policy: BootstrapPolicy,
  beforeDispatch?: () => void,
): unknown {
  assertBinary(binary, digest);
  for (const pin of policy.adapters.dependencies ?? []) assertBootstrapExecutablePin(pin);
  beforeDispatch?.();
  const raw = execFileSync(binary, [], {
    input: bootstrapJson(request),
    encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin' },
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(raw) as unknown;
}
function productionClients(policy: BootstrapPolicy): BootstrapClients {
  const binding = {
    workspaceRoot: policy.canonicalRoot,
    repository: policy.repository,
    remoteName: policy.remoteName,
    remoteUrl: policy.remoteUrl,
    ref: policy.ref,
  };
  return {
    readBeads: () =>
      command(
        policy.adapters.beadsReadBinary,
        policy.adapters.beadsReadBinaryDigest,
        {
          kind: 'beads.read',
          workspaceRoot: policy.canonicalRoot,
          taskId: policy.taskId,
        },
        policy,
      ),
    observeRemote: () =>
      z
        .object({
          sha: z
            .string()
            .regex(/^[a-f0-9]{40}$/u)
            .nullable(),
        })
        .strict()
        .parse(
          command(
            policy.adapters.remoteBinary,
            policy.adapters.remoteBinaryDigest,
            {
              kind: 'git.observe_ref',
              ...binding,
            },
            policy,
          ),
        ).sha,
    pushRemote: ({ expectedOldSha, newSha }, beforeDispatch) => {
      const response = z
        .object({ sha: z.string().regex(/^[a-f0-9]{40}$/u) })
        .strict()
        .parse(
          command(
            policy.adapters.remoteBinary,
            policy.adapters.remoteBinaryDigest,
            {
              kind: 'git.push',
              ...binding,
              expectedOldSha,
              newSha,
            },
            policy,
            beforeDispatch,
          ),
        );
      if (response.sha !== newSha) throw new Error('bootstrap remote push receipt differs');
    },
  };
}

/** No store construction: this command cannot migrate the journal or write Git objects/indexes. */
export function bootstrapPreflight(database: string, runId: string, policyInput: unknown) {
  const policy = bootstrapPolicySchema.parse(policyInput);
  const journal = new BootstrapJournal(database, true);
  try {
    journal.assertApproved(runId, policy);
    const candidate = assertBootstrapCandidate(policy);
    for (const [binary, digest] of [
      [policy.adapters.remoteBinary, policy.adapters.remoteBinaryDigest],
      [policy.adapters.beadsReadBinary, policy.adapters.beadsReadBinaryDigest],
    ])
      assertBinary(binary!, digest!);
    for (const pin of policy.adapters.dependencies ?? []) assertBootstrapExecutablePin(pin);
    return {
      ready: true,
      candidate,
      policyDigest: bootstrapDigest(policy),
      remoteObservation: 'not_performed',
      beadsObservation: 'not_performed',
      mutations: false,
    };
  } finally {
    journal.close();
  }
}

/** Empty-work cleanup is an observation, not a promise to terminate arbitrary external work. */
export function createObservedBootstrapCleanupPort(journal: BootstrapJournal) {
  return createProductionCancellationCleanupPort({
    async stopOwnedWork({ runId }) {
      const incomplete = journal.pendingWork(runId);
      return { stopped: incomplete.length === 0, incomplete };
    },
    async cleanupPreparedEffects({ runId }) {
      return { incomplete: journal.pendingWork(runId) };
    },
  });
}

export class BootstrapCoordinator {
  readonly #journal: BootstrapJournal;
  readonly #store: WorkflowStore;
  readonly #policy: BootstrapPolicy;
  readonly #clients: BootstrapClients;
  readonly #owner = `bootstrap:${randomUUID()}`;
  readonly #fault: (boundary: BootstrapFault) => void;
  private constructor(
    readonly database: string,
    readonly runId: string,
    policy: BootstrapPolicy,
    clients: BootstrapClients,
    fault: (boundary: BootstrapFault) => void,
  ) {
    this.#policy = bootstrapPolicySchema.parse(JSON.parse(bootstrapJson(policy)));
    this.#clients = Object.freeze({
      readBeads: clients.readBeads.bind(clients),
      observeRemote: clients.observeRemote.bind(clients),
      pushRemote: clients.pushRemote.bind(clients),
    });
    this.#store = new WorkflowStore(database);
    this.#journal = new BootstrapJournal(database);
    this.#fault = fault;
    try {
      this.#journal.assertApproved(runId, this.#policy);
    } catch (error) {
      this.close();
      throw error;
    }
  }
  static create(database: string, runId: string, policyInput: unknown): BootstrapCoordinator {
    const policy = bootstrapPolicySchema.parse(policyInput);
    // Validate without migration before creating any writer connection.
    const check = new BootstrapJournal(database, true);
    try {
      check.assertApproved(runId, policy);
    } finally {
      check.close();
    }
    assertBinary(policy.adapters.remoteBinary, policy.adapters.remoteBinaryDigest);
    assertBinary(policy.adapters.beadsReadBinary, policy.adapters.beadsReadBinaryDigest);
    for (const pin of policy.adapters.dependencies ?? []) assertBootstrapExecutablePin(pin);
    return new BootstrapCoordinator(
      database,
      runId,
      policy,
      productionClients(policy),
      () => undefined,
    );
  }
  static createForTest(
    database: string,
    runId: string,
    policy: BootstrapPolicy,
    clients: BootstrapClients,
    fault: (boundary: BootstrapFault) => void = () => undefined,
  ): BootstrapCoordinator {
    if (process.env.NODE_ENV !== 'test') throw new Error('test bootstrap clients unavailable');
    return new BootstrapCoordinator(database, runId, policy, clients, fault);
  }
  close(): void {
    this.#journal.close();
    this.#store.close();
  }
  #fence(): DeliveryFence {
    const contract = this.#journal.contract(this.runId);
    return {
      ownerId: this.#owner,
      workspaceLeaseEpoch: this.#store.acquireLease(
        'workspace',
        contract.workspaceId,
        this.#owner,
        60_000,
      ).epoch,
      runLeaseEpoch: this.#store.acquireLease('run', this.runId, this.#owner, 60_000).epoch,
      taskLeaseEpoch: this.#store.acquireLease('task', this.#policy.taskId, this.#owner, 60_000)
        .epoch,
    };
  }
  #beads(): void {
    if (bootstrapJson(this.#clients.readBeads()) !== bootstrapJson(this.#policy.beadsSnapshot))
      throw new Error('bootstrap Beads snapshot changed');
  }
  #authority(fence: DeliveryFence): void {
    this.#beads();
    this.#journal.assertStored(this.runId, this.#policy);
    this.#journal.assertFence(this.runId, this.#policy, fence, Date.now());
    if (this.#store.getRun(this.runId)?.state !== 'implementing')
      throw new Error('bootstrap run is not implementing');
  }
  adopt(): void {
    const policy = this.#policy;
    const fence = this.#fence();
    if (this.#store.getRun(this.runId)?.state === 'implementing') {
      this.#authority(fence);
      return;
    }
    this.#beads();
    if (this.#clients.observeRemote() !== policy.expectedRemoteSha)
      throw new Error('bootstrap remote precondition changed');
    const candidate = assertBootstrapCandidate(policy);
    const observation = {
      ...candidate,
      beadsSnapshotDigest: bootstrapDigest(policy.beadsSnapshot),
      policyDigest: bootstrapDigest(policy),
      sourceRoot: policy.sourceRoot,
      canonicalRoot: policy.canonicalRoot,
      gitCommonDirectory: policy.gitCommonDirectory,
    };
    for (let stage = 0; stage < 2; stage += 1) {
      this.#journal.advance(this.runId, policy, observation, fence, Date.now(), () => {
        this.#beads();
        assertBootstrapCandidate(policy);
        if (this.#clients.observeRemote() !== policy.expectedRemoteSha)
          throw new Error('bootstrap remote precondition changed');
      });
      this.#fault(stage === 0 ? 'after_task_observation' : 'after_candidate_adoption');
    }
  }
  async commitAndPush(): Promise<EvidenceReference> {
    this.adopt();
    const policy = this.#policy;
    const fence = this.#fence();
    const contract = this.#journal.contract(this.runId);
    const withMutation = <T>(operation: () => T) =>
      this.#journal.withMutation(this.runId, policy, fence, operation);
    const port = createProductionBootstrapGitPort({
      policy,
      assertAuthority: () => this.#authority(fence),
      withMutation,
      remote: {
        observeRef: async () => this.#clients.observeRemote(),
        pushCas: async ({ expectedOldSha, newSha }) =>
          withMutation(() => {
            this.#authority(fence);
            assertBootstrapCandidate(policy, newSha);
            this.#journal.assertFence(this.runId, policy, fence, Date.now());
            this.#clients.pushRemote({ expectedOldSha, newSha }, () =>
              this.#journal.assertFence(this.runId, policy, fence, Date.now()),
            );
          }),
      },
    });
    const broker = DurableDeliveryBroker.create({
      store: this.#store,
      contract,
      port,
      workspaceRoot: policy.canonicalRoot,
      policy: {
        authorName: policy.author.name,
        authorEmail: policy.author.email,
        approvedParentShas: { [policy.taskId]: policy.initialHeadSha },
        approvedProtectionDigest: bootstrapDigest(policy),
      },
    });
    const recovered = await broker.reconcilePrepared({ runId: this.runId, fence });
    if (
      recovered.errors.length > 0 ||
      recovered.operations.some((operation) => operation.status !== 'committed')
    )
      throw new Error('bootstrap prepared delivery recovery failed');
    const binding = {
      workspaceId: contract.workspaceId,
      runId: this.runId,
      taskId: policy.taskId,
      repository: policy.repository,
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest: contract.policyDigest,
      ref: policy.ref,
    };
    const commit = await broker.execute(
      {
        ...binding,
        kind: 'git.commit',
        parentSha: policy.initialHeadSha,
        treeSha: policy.treeSha,
        diffDigest: policy.diffDigest,
        changedFiles: policy.manifest.map((item) => item.path),
        message: policy.author.message,
        authorName: policy.author.name,
        authorEmail: policy.author.email,
        authoredAtUnix: policy.author.authoredAtUnix,
      },
      fence,
    );
    if (commit.status !== 'committed') throw new Error('bootstrap commit is not committed');
    const head = z
      .object({ sha: z.string().regex(/^[a-f0-9]{40}$/u) })
      .passthrough()
      .parse(commit.result).sha;
    this.#fault('after_commit');
    const pushed = await broker.execute(
      { ...binding, kind: 'git.push', expectedRemoteSha: policy.expectedRemoteSha, newSha: head },
      fence,
    );
    if (pushed.status !== 'committed' || this.#clients.observeRemote() !== head)
      throw new Error('bootstrap push is not observed committed');
    this.#fault('after_push');
    this.#authority(fence);
    assertBootstrapCandidate(policy, head);
    const attestation = {
      kind: 'implementation_artifact_ready' as const,
      runId: this.runId,
      taskId: policy.taskId,
      contractDigest: bootstrapDigest(contract),
      policyDigest: contract.policyDigest,
      materialDigest: deriveMaterial(contract),
      ref: policy.ref,
      headSha: head,
      treeSha: policy.treeSha,
      beadsSnapshotDigest: bootstrapDigest(policy.beadsSnapshot),
      evidence: policy.evidence,
    };
    const capabilities = new ProcessCapabilityBroker(() => undefined);
    const identity = {
      pid: process.pid,
      startTimeMs: Math.floor(Date.now() - process.uptime() * 1000),
      executableDigest: `sha256:${createHash('sha256').update(readFileSync(process.execPath)).digest('hex')}`,
    };
    const handle = capabilities.issue({
      workspaceId: contract.workspaceId,
      runId: this.runId,
      role: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest: contract.policyDigest,
      operations: ['workspace.read', 'artifact.write'],
      allowedPaths: policy.allowedPaths,
      expiresAtMs: Date.now() + 60_000,
      process: identity,
    });
    try {
      const capability = { token: handle.token, observedProcess: identity };
      const vault = new SecureEvidenceVault({
        store: this.#store,
        contract,
        capabilityBroker: capabilities,
      });
      const recorded = await vault.recordBootstrapAttestation({ attestation, capability });
      if (recorded.record.acceptedAtMs === null)
        vault.accept({
          digest: recorded.reference.digest,
          runId: this.runId,
          taskId: policy.taskId,
          capability,
        });
      this.#journal.attest(this.runId, policy, fence, head, attestation, recorded.reference.digest);
      this.#fault('after_attestation');
      return recorded.reference;
    } finally {
      capabilities.revoke(handle.token);
    }
  }
  async terminalize(requestedBy: string) {
    const policy = this.#policy;
    const row = this.#journal.assertStored(this.runId, policy);
    if (row.status !== 'attested' || row.attestation_digest === null)
      throw new Error('bootstrap artifact attestation required');
    const evidence = this.#store.getSecureEvidence(
      row.attestation_digest,
      this.runId,
      policy.taskId,
    );
    if (!evidence) throw new Error('bootstrap attestation evidence missing');
    const fence = this.#fence();
    this.#beads();
    assertBootstrapCandidate(policy, row.head_sha!);
    if (this.#clients.observeRemote() !== row.head_sha)
      throw new Error('bootstrap published ref changed');
    const coordinator = new WorkflowCancellationCoordinator({
      store: this.#store,
      contract: this.#journal.contract(this.runId),
      port: createObservedBootstrapCleanupPort(this.#journal),
    });
    const existing = this.#store.getWorkflowCancellation(this.runId);
    if (existing !== undefined && existing.requestedBy !== requestedBy)
      throw new Error('bootstrap cancellation requester changed');
    const result =
      existing === undefined
        ? await coordinator.cancel({
            id: `bootstrap-handoff:${this.runId}`,
            runId: this.runId,
            requestedBy,
            reason: 'planned_authority_handoff',
            stopDeadlineMs: Date.now() + 30_000,
            retainedEvidence: [
              evidenceReferenceSchema.parse({
                digest: evidence.digest,
                mediaType: evidence.mediaType,
                sizeBytes: evidence.sizeBytes,
                kind: evidence.kind,
              }),
            ],
            ownerId: fence.ownerId,
            workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
            runLeaseEpoch: fence.runLeaseEpoch,
          })
        : await coordinator.resume({
            runId: this.runId,
            ownerId: fence.ownerId,
            workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
            runLeaseEpoch: fence.runLeaseEpoch,
          });
    if (result.status === 'cancelled')
      this.#journal.database
        .transaction(() => {
          for (const [type, id, epoch] of [
            [
              'workspace',
              this.#journal.contract(this.runId).workspaceId,
              fence.workspaceLeaseEpoch,
            ],
            ['run', this.runId, fence.runLeaseEpoch],
            ['task', policy.taskId, fence.taskLeaseEpoch],
          ] as const)
            this.#journal.database
              .prepare(
                'UPDATE leases SET expires_at_ms=?,epoch=epoch+1 WHERE resource_type=? AND resource_id=? AND owner_id=? AND epoch=?',
              )
              .run(Date.now(), type, id, fence.ownerId, epoch);
        })
        .immediate();
    return result;
  }
}
