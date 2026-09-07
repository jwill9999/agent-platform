import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';

import { z } from 'zod';

import {
  DEFAULT_ROLE_OPERATION_POLICY,
  ProcessCapabilityBroker,
  type ProcessIdentity,
} from './authorization.js';
import {
  assertAgentResultAccepted,
  assertTaskPacketWithinContract,
  type AgentResult,
  type ExecutionContract,
  type TaskPacket,
} from './contracts.js';
import { digestGovernedValue, type DelegateCallback } from './governedOperations.js';
import { PhaseJobJournal, type PhaseJob, type ExecutePhaseAction } from './phaseJobs.js';
import { SecureEvidenceVault, type EvidenceCapability } from './secureEvidence.js';
import {
  DockerIsolatedSpecialistLauncher,
  RevocableSpecialistCredentialBroker,
  type DockerSpecialistReservation,
} from './specialistLauncher.js';
import { specialistTerminalResult } from './specialistTerminalResult.js';
import { specialistInputEnvelopeSchema } from './specialistInput.js';
import { WorkflowStore } from './storage.js';

const execute = promisify(execFile);
const absolute = z.string().min(1).refine(isAbsolute, 'runtime path must be absolute');
export const phaseRuntimeConfigSchema = z
  .object({
    runId: z.string().min(1),
    sourceRoot: absolute,
    credentialBrokerBinary: absolute,
    image: z
      .string()
      .regex(/^[^\s]+@sha256:[a-f0-9]{64}$/u, 'immutable specialist image digest required'),
    egressNetwork: z
      .string()
      .min(1)
      .refine(
        (value) => !['host', 'bridge', 'default', 'none'].includes(value),
        'dedicated model egress network required',
      ),
    containerUser: z.string().regex(/^[1-9]\d*:\d+$/u),
    leaseTtlMs: z.number().int().min(300).default(30_000),
    pollIntervalMs: z.number().int().positive().default(1000),
  })
  .strict();
export type PhaseRuntimeConfig = z.infer<typeof phaseRuntimeConfigSchema>;

export function readPhaseRuntimeConfig(input: unknown): PhaseRuntimeConfig {
  if (typeof input !== 'object' || input === null)
    throw new Error('standalone_runtime_config_missing');
  const fields = input as Record<string, unknown>;
  if (!fields.credentialBrokerBinary) throw new Error('standalone_credential_broker_missing');
  if (!fields.image) throw new Error('standalone_specialist_image_missing');
  return phaseRuntimeConfigSchema.parse(input);
}

interface ResourceFences {
  workspace: number;
  run: number;
  task: number;
}

function phaseTerminalStatus(
  terminal: AgentResult,
  packet: TaskPacket,
  phase: ExecutePhaseAction['phase'],
): DelegateCallback['terminalStatus'] {
  if (
    terminal.status === 'blocked' ||
    terminal.recommendedTransition === 'escalate' ||
    terminal.changedFiles.length > 0 ||
    terminal.remainingRisks.length > 0
  ) {
    return 'blocked';
  }
  try {
    assertAgentResultAccepted(
      terminal,
      packet.acceptanceCriteria,
      phase === 'task_review' ? 'integrate' : 'continue',
    );
    return 'continue';
  } catch {
    return 'repair';
  }
}

/** Long-lived trusted supervisor. Only its fresh isolated launcher can execute specialists.
 * Phase roles must be explicitly approved in task.phaseRoles; no default authority is added.
 */
export class StandalonePhaseRuntime {
  readonly #store: WorkflowStore;
  readonly #journal: PhaseJobJournal;
  readonly #launcher: DockerIsolatedSpecialistLauncher;
  readonly #config: PhaseRuntimeConfig;
  readonly #contract: ExecutionContract;
  readonly #capabilities = new ProcessCapabilityBroker(() => undefined);
  readonly #vault: SecureEvidenceVault;
  readonly #owner: string;
  readonly #process: ProcessIdentity;
  readonly #verifySource: (action: ExecutePhaseAction, paths: string[]) => Promise<void>;
  #active: Promise<boolean> | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;
  #closing: Promise<void> | undefined;
  #reservation: DockerSpecialistReservation | undefined;

  private constructor(input: {
    store: WorkflowStore;
    journal: PhaseJobJournal;
    launcher: DockerIsolatedSpecialistLauncher;
    config: PhaseRuntimeConfig;
    owner: string;
    process: ProcessIdentity;
    verifySource: (action: ExecutePhaseAction, paths: string[]) => Promise<void>;
  }) {
    if (!(input.launcher instanceof DockerIsolatedSpecialistLauncher))
      throw new Error('isolated specialist launcher required');
    this.#store = input.store;
    this.#journal = input.journal;
    this.#launcher = input.launcher;
    this.#config = input.config;
    this.#owner = input.owner;
    this.#process = input.process;
    this.#verifySource = input.verifySource;
    this.#contract = input.store.getExecutionContract(input.config.runId);
    this.#vault = new SecureEvidenceVault({
      store: input.store,
      contract: this.#contract,
      capabilityBroker: this.#capabilities,
    });
  }

  static async create(database: string, configInput: unknown): Promise<StandalonePhaseRuntime> {
    const config = readPhaseRuntimeConfig(configInput);
    if (!(await stat(config.credentialBrokerBinary).catch(() => undefined))?.isFile())
      throw new Error('standalone_credential_broker_unavailable');
    const sourceRoot = await realpath(config.sourceRoot);
    const store = new WorkflowStore(database);
    const journal = new PhaseJobJournal(database);
    try {
      const broker = RevocableSpecialistCredentialBroker.create({
        binary: config.credentialBrokerBinary,
        store,
      });
      await broker.assertConformant();
      for (const args of [
        ['image', 'inspect', config.image],
        ['network', 'inspect', config.egressNetwork],
      ]) {
        await execute('/usr/local/bin/docker', args, {
          env: {},
          timeout: 10_000,
          maxBuffer: 1024 * 1024,
        }).catch(() => {
          throw new Error(`standalone_${args[0]}_unavailable`);
        });
      }
      const processIdentity = {
        pid: process.pid,
        startTimeMs: Math.floor(Date.now() - process.uptime() * 1000),
        executableDigest: `sha256:${createHash('sha256')
          .update(await readFile(process.execPath))
          .digest('hex')}`,
      };
      return new StandalonePhaseRuntime({
        store,
        journal,
        config,
        owner: `phase-runtime:${randomUUID()}`,
        process: processIdentity,
        launcher: DockerIsolatedSpecialistLauncher.create({
          sourceRoot,
          image: config.image,
          credentialBroker: broker,
          egressNetwork: config.egressNetwork,
          containerUser: config.containerUser,
        }),
        verifySource: async (action, paths) => {
          const head = await execute('/usr/bin/git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], {
            env: {},
            timeout: 10_000,
          });
          const dirty = await execute(
            '/usr/bin/git',
            ['-C', sourceRoot, 'status', '--porcelain', '--untracked-files=all', '--', ...paths],
            { env: {}, timeout: 10_000 },
          );
          if (head.stdout.trim() !== action.headSha || dirty.stdout.trim() !== '')
            throw new Error('phase_source_head_or_tree_stale');
        },
      });
    } catch (error) {
      journal.close();
      store.close();
      throw error;
    }
  }

  static createForTest(input: {
    store: WorkflowStore;
    journal: PhaseJobJournal;
    launcher: DockerIsolatedSpecialistLauncher;
    config: PhaseRuntimeConfig;
    owner: string;
    process: ProcessIdentity;
    verifySource: (action: ExecutePhaseAction, paths: string[]) => Promise<void>;
  }): StandalonePhaseRuntime {
    if (process.env.NODE_ENV !== 'test') throw new Error('test phase runtime unavailable');
    return new StandalonePhaseRuntime(input);
  }

  start(): void {
    if (this.#closing !== undefined) throw new Error('phase runtime is closing');
    if (this.#timer !== undefined) return;
    this.#timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) =>
        process.stderr.write(`phase runtime: ${String(error)}\n`),
      );
    }, this.#config.pollIntervalMs);
    void this.runOnce().catch((error: unknown) =>
      process.stderr.write(`phase runtime: ${String(error)}\n`),
    );
  }
  async close(): Promise<void> {
    if (this.#closing !== undefined) return this.#closing;
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    this.#closing = (async () => {
      try {
        let cancellationError: unknown;
        if (this.#reservation !== undefined) {
          try {
            await this.#launcher.cancel(this.#reservation);
            await this.#launcher.revokeCredential(this.#reservation.id);
          } catch (error) {
            cancellationError = error;
          }
        }
        await this.#active;
        if (cancellationError !== undefined) throw cancellationError;
      } finally {
        this.#journal.close();
        this.#store.close();
      }
    })();
    return this.#closing;
  }
  runOnce(): Promise<boolean> {
    if (this.#closing !== undefined) return Promise.reject(new Error('phase runtime is closing'));
    if (this.#active !== undefined) return this.#active;
    this.#active = this.#runOnce().finally(() => {
      this.#active = undefined;
    });
    return this.#active;
  }

  #fences(action: ExecutePhaseAction): ResourceFences {
    this.#store.assertRunUsesContract(action.runId, this.#contract);
    const ttl = this.#config.leaseTtlMs;
    return {
      workspace: this.#store.acquireLease('workspace', action.workspaceId, this.#owner, ttl).epoch,
      run: this.#store.acquireLease('run', action.runId, this.#owner, ttl).epoch,
      task: this.#store.acquireLease('task', action.taskId, this.#owner, ttl).epoch,
    };
  }

  #packet(action: ExecutePhaseAction): TaskPacket {
    if (action.phase === 'implementing') throw new Error('phase_artifact_import_unavailable');
    if (action.phase !== 'task_verification' && action.phase !== 'task_review')
      throw new Error('phase_executor_unavailable');
    const task = this.#contract.tasks.find((item) => item.id === action.taskId);
    const role = task?.phaseRoles?.[action.phase];
    if (task === undefined || role === undefined)
      throw new Error('phase_role_authority_unavailable');
    if (!task.allowedOperations.includes('artifact.write'))
      throw new Error('phase_evidence_authority_unavailable');
    const packet: TaskPacket = {
      runId: action.runId,
      taskId: action.taskId,
      contractVersion: action.contractVersion,
      policyDigest: action.policyDigest,
      assignedRole: role,
      objective: this.#contract.objective,
      acceptanceCriteria: this.#contract.acceptanceCriteria,
      allowedPaths: task.allowedPaths,
      allowedOperations: task.allowedOperations.filter((operation) =>
        DEFAULT_ROLE_OPERATION_POLICY[role].includes(operation),
      ),
      retryBudget: this.#contract.retryPolicy,
      evidence: [],
    };
    if (
      !packet.allowedOperations.includes('workspace.read') ||
      (role === 'test_runner' && !packet.allowedOperations.includes('process.test'))
    )
      throw new Error('phase_operation_authority_unavailable');
    assertTaskPacketWithinContract(this.#contract, packet, action.phase);
    return packet;
  }

  async #runOnce(): Promise<boolean> {
    const recovery = this.#journal.claimRecovery(
      this.#owner,
      this.#config.leaseTtlMs,
      Date.now(),
      this.#config.runId,
    );
    if (recovery !== undefined) {
      await this.#recover(recovery);
      return false;
    }
    const claim = this.#journal.claim(
      this.#owner,
      this.#config.leaseTtlMs,
      Date.now(),
      this.#config.runId,
    );
    if (claim === undefined) return false;
    const action = this.#journal.action(claim);
    let fences: ResourceFences;
    try {
      fences = this.#fences(action);
    } catch (error) {
      this.#journal.releaseClaim(claim, Date.now());
      throw error;
    }
    let packet: TaskPacket;
    try {
      packet = this.#packet(action);
      await this.#verifySource(action, packet.allowedPaths);
    } catch (error) {
      this.#journal.block(claim, String(error), Date.now());
      return false;
    }
    if (this.#closing !== undefined) {
      this.#journal.releaseClaim(claim, Date.now());
      return false;
    }
    const job = this.#journal.start(claim, Date.now());
    let heartbeatError: unknown;
    let cancellation: Promise<void> | undefined;
    const heartbeat = setInterval(
      () => {
        try {
          for (const [resource, id, epoch] of [
            ['workspace', action.workspaceId, fences.workspace],
            ['run', action.runId, fences.run],
            ['task', action.taskId, fences.task],
          ] as const)
            this.#store.assertResourceLease(resource, id, this.#owner, epoch, Date.now());
          this.#journal.renew(job, this.#config.leaseTtlMs, Date.now());
          this.#fences(action);
        } catch (error) {
          heartbeatError = error;
          cancellation ??= (async () => {
            await this.#launcher.cancel(reservation);
            if (this.#store.getSchedulerExecution(reservation.id) !== undefined)
              await this.#launcher.revokeCredential(reservation.id);
          })().catch((cancellationError: unknown) => {
            heartbeatError = cancellationError;
          });
        }
      },
      Math.floor(this.#config.leaseTtlMs / 3),
    );
    const deadlineMs = Date.now() + this.#contract.retryPolicy.waitDeadlineSeconds * 1000;
    const reservation = { id: job.execution_id!, role: packet.assignedRole, deadlineMs };
    const inputEnvelope = specialistInputEnvelopeSchema.parse({
      kind: 'specialist_input',
      binding: {
        executionDigest: digestGovernedValue(reservation.id),
        ownerDigest: digestGovernedValue(this.#owner),
        callbackId: action.callbackId,
        headSha: action.headSha,
        runVersion: action.runVersion,
        phaseLeaseEpoch: job.lease_epoch,
        workspaceLeaseEpoch: fences.workspace,
        runLeaseEpoch: fences.run,
        taskLeaseEpoch: fences.task,
      },
      task: packet,
    });
    let token: string | undefined;
    try {
      const capability = this.#capabilities.issue({
        workspaceId: action.workspaceId,
        runId: action.runId,
        role: 'workflow_orchestrator',
        contractVersion: action.contractVersion,
        policyDigest: action.policyDigest,
        operations: ['workspace.read', 'artifact.write'],
        allowedPaths: packet.allowedPaths,
        expiresAtMs: deadlineMs,
        process: this.#process,
      });
      token = capability.token;
      const evidenceCapability: EvidenceCapability = { token, observedProcess: this.#process };
      this.#store.createSchedulerExecution({
        id: reservation.id,
        workspaceId: action.workspaceId,
        runId: action.runId,
        taskId: action.taskId,
        role: packet.assignedRole,
        mode: 'read_only',
        deadlineMs,
        ownerId: this.#owner,
        workspaceLeaseEpoch: fences.workspace,
        runLeaseEpoch: fences.run,
        taskLeaseEpoch: fences.task,
        processIdentity: this.#launcher.processIdentity(reservation),
        credentialLeaseId: this.#launcher.credentialLeaseId(reservation),
        packet: inputEnvelope,
      });
      this.#reservation = reservation;
      const inputEvidence = await this.#vault.record({
        content: Buffer.from(JSON.stringify(inputEnvelope)),
        mediaType: 'application/json',
        kind: 'artifact',
        producer: this.#owner,
        producerRole: 'workflow_orchestrator',
        workspaceId: action.workspaceId,
        runId: action.runId,
        taskId: action.taskId,
        contractVersion: action.contractVersion,
        policyDigest: action.policyDigest,
        headSha: action.headSha,
        capability: evidenceCapability,
      });
      if (inputEvidence.reference.digest !== digestGovernedValue(inputEnvelope))
        throw new Error('phase_packet_evidence_redacted');
      const raw = await this.#launcher.launchBound(inputEnvelope, reservation);
      await cancellation;
      if (heartbeatError !== undefined) throw heartbeatError;
      const terminal = specialistTerminalResult(raw);
      if (terminal === undefined) throw new Error('invalid_specialist_terminal_result');
      await this.#verifySource(action, packet.allowedPaths);
      // Keep the structured answer only, with trusted execution identity to avoid cross-role digest aliasing.
      const result = {
        executionDigest: digestGovernedValue(reservation.id),
        events: [
          {
            type: 'item.completed',
            item: { type: 'agent_message', text: JSON.stringify(terminal) },
          },
        ],
      };
      const resultEvidence = await this.#vault.recordSpecialistResult({
        executionId: reservation.id,
        content: Buffer.from(JSON.stringify(result)),
        headSha: action.headSha,
        capability: evidenceCapability,
      });
      if (resultEvidence.reference.digest !== digestGovernedValue(result))
        throw new Error('phase_result_evidence_redacted');
      const terminalStatus = phaseTerminalStatus(terminal, packet, action.phase);
      const identity = {
        kind: 'workflow.delegate_callback' as const,
        workspaceId: action.workspaceId,
        parentRunId: action.runId,
        parentTaskId: action.taskId,
        parentState: action.phase,
        parentRunVersion: action.runVersion,
        delegationId: reservation.id,
        delegateAgentId: this.#launcher.processIdentity(reservation),
        delegateRole: packet.assignedRole,
        attemptNumber: 1,
        contractVersion: action.contractVersion,
        policyDigest: action.policyDigest,
        materialDigest: action.materialDigest,
        workspaceLeaseEpoch: fences.workspace,
        parentRunLeaseEpoch: fences.run,
        taskLeaseEpoch: fences.task,
        headSha: action.headSha,
        inputProducerIdentity: this.#owner,
        resultProducerIdentity: this.#launcher.processIdentity(reservation),
        inputArtifactDigest: inputEvidence.reference.digest,
        terminalStatus,
        resultArtifactDigest: resultEvidence.reference.digest,
      };
      const callback: DelegateCallback = { ...identity, callbackId: digestGovernedValue(identity) };
      this.#store.finishSchedulerExecution({
        id: reservation.id,
        status: 'completed',
        ownerId: this.#owner,
        workspaceLeaseEpoch: fences.workspace,
        runLeaseEpoch: fences.run,
        taskLeaseEpoch: fences.task,
        result,
        callback,
      });
      this.#journal.complete(
        job,
        { executionId: reservation.id, evidenceDigest: resultEvidence.reference.digest },
        Date.now(),
      );
      return true;
    } catch (error) {
      await this.#failExecution(job, reservation, fences, error);
      return false;
    } finally {
      clearInterval(heartbeat);
      await cancellation;
      this.#reservation = undefined;
      if (token !== undefined) this.#capabilities.revoke(token);
    }
  }

  async #failExecution(
    job: PhaseJob,
    reservation: DockerSpecialistReservation,
    fences: ResourceFences,
    error: unknown,
  ): Promise<void> {
    await this.#launcher.cancel(reservation);
    if (this.#store.getSchedulerExecution(reservation.id) !== undefined)
      await this.#launcher.revokeCredential(reservation.id);
    if (!(await this.#launcher.waitForSettlement(reservation)))
      throw new Error('phase_specialist_settlement_unconfirmed');
    const execution = this.#store.getSchedulerExecution(reservation.id);
    if (execution?.status === 'active')
      this.#store.finishSchedulerExecution({
        id: reservation.id,
        status: 'escalated',
        ownerId: this.#owner,
        workspaceLeaseEpoch: fences.workspace,
        runLeaseEpoch: fences.run,
        taskLeaseEpoch: fences.task,
        result: { reason: String(error) },
      });
    this.#journal.block(job, String(error), Date.now());
  }

  async #recover(job: PhaseJob): Promise<void> {
    const action = this.#journal.action(job);
    const fences = this.#fences(action);
    let heartbeatError: unknown;
    const heartbeat = setInterval(
      () => {
        try {
          this.#journal.renew(job, this.#config.leaseTtlMs, Date.now());
          this.#fences(action);
        } catch (error) {
          heartbeatError = error;
        }
      },
      Math.floor(this.#config.leaseTtlMs / 3),
    );
    try {
      const execution = this.#store.getSchedulerExecution(job.execution_id!);
      if (execution?.status === 'completed') {
        this.#journal.complete(
          job,
          { executionId: execution.id, evidenceDigest: digestGovernedValue(execution.result) },
          Date.now(),
        );
        return;
      }
      if (execution !== undefined) {
        const adopted = this.#store.adoptSchedulerExecution({
          id: execution.id,
          ownerId: this.#owner,
          workspaceLeaseEpoch: fences.workspace,
          runLeaseTtlMs: this.#config.leaseTtlMs,
          taskLeaseTtlMs: this.#config.leaseTtlMs,
          nowMs: Date.now(),
        });
        await this.#launcher.cancelProcessIdentity(execution.processIdentity);
        await this.#launcher.revokeCredential(execution.id);
        if (
          !(await this.#launcher.waitForSettlement({
            id: execution.id,
            role: execution.role,
            deadlineMs: execution.deadlineMs,
          }))
        )
          throw new Error('phase_specialist_settlement_unconfirmed');
        if (heartbeatError !== undefined) throw heartbeatError;
        if (adopted !== undefined)
          this.#store.finishSchedulerExecution({
            id: execution.id,
            status: 'escalated',
            ownerId: this.#owner,
            workspaceLeaseEpoch: adopted.workspaceLeaseEpoch,
            runLeaseEpoch: adopted.runLeaseEpoch,
            taskLeaseEpoch: adopted.taskLeaseEpoch,
            result: { reason: 'phase_restart_requires_new_authorized_attempt' },
          });
      }
      this.#journal.block(job, 'phase_restart_requires_new_authorized_attempt', Date.now());
    } finally {
      clearInterval(heartbeat);
    }
  }
}
