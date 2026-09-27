import {
  StandaloneCoordinators,
  standaloneCoordinatorConfigSchema,
} from './standaloneCoordinators.js';
import { repairDispatchPacketSchema } from './repairLoops.js';
import { ContractEvaluator } from './featureEvaluation.js';
import { TrustedSourceGit } from './sourceGit.js';
import { withinCleanupDeadline } from './executionInterruptions.js';
import { modelGatewayConfigSchema } from './modelGatewayConfig.js';
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
import {
  PhaseJobJournal,
  PHASE_JOB_DISPATCH,
  type PhaseJob,
  type ExecutePhaseAction,
} from './phaseJobs.js';
import { SecureEvidenceVault, type EvidenceCapability } from './secureEvidence.js';
import {
  DockerIsolatedSpecialistLauncher,
  RevocableSpecialistCredentialBroker,
  type DockerSpecialistReservation,
} from './specialistLauncher.js';
import { specialistTerminalResult } from './specialistTerminalResult.js';
import { implementationOutputSchema } from './implementationOutput.js';
import { assertBootstrapExecutablePin } from './bootstrapAdapterRuntime.js';
import { specialistInputEnvelopeSchema } from './specialistInput.js';
import { WorkflowStore } from './storage.js';

const execute = promisify(execFile);
const absolute = z.string().min(1).refine(isAbsolute, 'runtime path must be absolute');
export const phaseRuntimeConfigSchema = z
  .object({
    runId: z.string().min(1),
    sourceRoot: absolute,
    gitBinary: absolute.default('/usr/bin/git'),
    gitBinaryDigest: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/u)
      .optional(),
    credentialBrokerBinary: absolute,
    modelGateway: modelGatewayConfigSchema.optional(),
    coordinators: standaloneCoordinatorConfigSchema.optional(),
    image: z
      .string()
      .regex(/^(?:[^\s]+@)?sha256:[a-f0-9]{64}$/u, 'immutable specialist image digest required'),
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
    (phase !== 'implementing' && terminal.changedFiles.length > 0) ||
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
    if (
      (phase === 'task_verification' || phase === 'task_review') &&
      !terminal.findings[0]?.repairHypothesis?.trim()
    )
      return 'blocked';
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
  readonly #admission: () => Promise<void>;
  readonly #assertAdmission: () => void;
  #active: Promise<boolean> | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;
  #closing: Promise<void> | undefined;
  #reservation: DockerSpecialistReservation | undefined;
  #fatalAdmission = false;
  readonly #onFatal?: () => void;
  readonly #cleanupOnly: boolean;
  readonly #coordinators?: StandaloneCoordinators;
  readonly #cleanup = new Map<string, Promise<void>>();

  private constructor(input: {
    store: WorkflowStore;
    journal: PhaseJobJournal;
    launcher: DockerIsolatedSpecialistLauncher;
    config: PhaseRuntimeConfig;
    owner: string;
    process: ProcessIdentity;
    verifySource: (action: ExecutePhaseAction, paths: string[]) => Promise<void>;
    admission?: () => Promise<void>;
    assertAdmission?: () => void;
    onFatal?: () => void;
    cleanupOnly?: boolean;
    database?: string;
  }) {
    if (!(input.launcher instanceof DockerIsolatedSpecialistLauncher))
      throw new Error('isolated specialist launcher required');
    this.#store = input.store;
    this.#journal = input.journal;
    this.#launcher = input.launcher;
    this.#config = input.config;
    this.#owner = input.owner;
    this.#onFatal = input.onFatal;
    this.#cleanupOnly = input.cleanupOnly ?? false;
    this.#process = input.process;
    this.#verifySource = input.verifySource;
    this.#admission = input.admission ?? (async () => undefined);
    this.#assertAdmission = input.assertAdmission ?? (() => undefined);
    this.#contract = input.store.getExecutionContract(input.config.runId);
    if (input.config.coordinators && !this.#cleanupOnly) {
      if (!input.database || !input.config.gitBinaryDigest)
        throw new Error('coordinator_production_binding_missing');
      this.#coordinators = new StandaloneCoordinators({
        database: input.database,
        store: input.store,
        contract: this.#contract,
        config: input.config.coordinators,
        sourceRoot: input.config.sourceRoot,
        gitPin: { path: input.config.gitBinary, digest: input.config.gitBinaryDigest },
        launcher: input.launcher,
        owner: input.owner,
      });
    }
    this.#vault = new SecureEvidenceVault({
      store: input.store,
      contract: this.#contract,
      capabilityBroker: this.#capabilities,
      // JSON escaping can expand the bounded 16 MiB UTF-8 file payload sixfold.
      maxBytes: 110 * 1024 * 1024,
      maxRunBytes: 220 * 1024 * 1024,
    });
  }

  static async create(
    database: string,
    configInput: unknown,
    admission?: () => Promise<void>,
    cleanupOnly = false,
    onFatal?: () => void,
    assertAdmission?: () => void,
  ): Promise<StandalonePhaseRuntime> {
    const config = readPhaseRuntimeConfig(configInput);
    const gitPin = cleanupOnly
      ? undefined
      : {
          path: await realpath(config.gitBinary),
          digest:
            config.gitBinaryDigest ??
            `sha256:${createHash('sha256')
              .update(await readFile(config.gitBinary))
              .digest('hex')}`,
        };
    if (gitPin) assertBootstrapExecutablePin(gitPin);
    if (!(await stat(config.credentialBrokerBinary).catch(() => undefined))?.isFile())
      throw new Error('standalone_credential_broker_unavailable');
    const sourceRoot = cleanupOnly ? config.sourceRoot : await realpath(config.sourceRoot);
    const store = new WorkflowStore(database);
    const journal = new PhaseJobJournal(database);
    try {
      const broker = RevocableSpecialistCredentialBroker.create({
        binary: config.credentialBrokerBinary,
        store,
      });

      if (!cleanupOnly) {
        await broker.assertConformant();
        for (const args of [
          ['image', 'inspect', config.image],
          ['network', 'inspect', config.egressNetwork],
        ])
          await execute('/usr/local/bin/docker', args, {
            env: {},
            timeout: 10000,
            maxBuffer: 1024 * 1024,
          });
      }
      const processIdentity = {
        pid: process.pid,
        startTimeMs: Math.floor(Date.now() - process.uptime() * 1000),
        executableDigest: `sha256:${createHash('sha256')
          .update(await readFile(process.execPath))
          .digest('hex')}`,
      };
      const owner = `phase-runtime:${randomUUID()}`;
      return new StandalonePhaseRuntime({
        database,
        store,
        journal,
        config: {
          ...config,
          sourceRoot,
          gitBinary: gitPin?.path ?? config.gitBinary,
          gitBinaryDigest: gitPin?.digest,
        },
        owner,
        process: processIdentity,
        admission,
        onFatal,
        assertAdmission,
        launcher: DockerIsolatedSpecialistLauncher.create({
          store,
          ownerId: owner,
          sourceRoot,
          executionSourceRoot: (runId) => store.getImplementationWorkspace(runId, sourceRoot),
          image: config.image,
          credentialBroker: broker,
          egressNetwork: config.egressNetwork,
          containerUser: config.containerUser,
          modelGateway: config.modelGateway,
        }),
        cleanupOnly,
        verifySource: async (action, paths) => {
          if (!gitPin) throw new Error('cleanup_only_runtime');
          const repository = new TrustedSourceGit(
            store.getImplementationWorkspace(config.runId, sourceRoot),
            gitPin.path,
            gitPin.digest,
          );
          repository.assertClean(paths);
          if (repository.run(['rev-parse', 'HEAD']).toString().trim() !== action.headSha)
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
    admission?: () => Promise<void>;
    assertAdmission?: () => void;
    onFatal?: () => void;
    cleanupOnly?: boolean;
    database?: string;
  }): StandalonePhaseRuntime {
    if (process.env.NODE_ENV !== 'test') throw new Error('test phase runtime unavailable');
    return new StandalonePhaseRuntime(input);
  }

  cleanupStatus():
    | 'settled'
    | 'pending'
    | 'exhausted'
    | 'reconciliation_required'
    | 'journal_unavailable' {
    if (this.#fatalAdmission) return 'journal_unavailable';
    const rows = this.#journal.interruptions().list(this.#config.runId);
    if (rows.some((row) => row.state === 'exhausted')) return 'exhausted';
    if (rows.some((row) => row.state === 'pending')) return 'pending';
    if (
      this.#journal
        .list()
        .some(
          (job) =>
            job.run_id === this.#config.runId &&
            job.status === 'started' &&
            job.lease_owner !== this.#owner,
        )
    )
      return 'pending';
    if (rows.some((row) => row.effects === 'uncertain')) return 'reconciliation_required';
    return 'settled';
  }

  requestCleanupRecovery(): number {
    return this.#journal.interruptions().requestRecovery(this.#config.runId);
  }

  async #recordInterruption(
    job: PhaseJob,
    reservation: DockerSpecialistReservation,
    reason: string,
  ): Promise<boolean> {
    try {
      if (this.#journal.get(job.id)?.status === 'blocked') return false;
      if (
        this.#journal
          .interruptions()
          .list(job.run_id)
          .some((row) => row.execution_id === reservation.id)
      )
        return true;
      return this.#journal.interrupt(job, reason, Date.now());
    } catch (error) {
      this.#fatalAdmission = true;
      try {
        this.#onFatal?.();
      } catch {
        /* Admission remains blocked even if reporting is unavailable. */
      }
      // Emergency containment is intentionally independent of durable retry accounting:
      // persistence is unavailable, so do not claim a recorded/settled outcome.
      await Promise.allSettled([
        this.#launcher.stopContainer(reservation),
        this.#launcher.revokeCredential(reservation.id),
      ]);
      throw error;
    }
  }
  async interruptActive(reason: string): Promise<void> {
    const reservation = this.#reservation;
    if (!reservation) return;
    const job = this.#journal
      .list()
      .find((item) => item.execution_id === reservation.id && item.status === 'started');
    if (!job) return;
    if (!(await this.#recordInterruption(job, reservation, reason))) return;
    const execution = this.#store.getSchedulerExecution(reservation.id)!;
    await this.#failExecution(
      job,
      reservation,
      {
        workspace: execution.workspaceLeaseEpoch,
        run: execution.runLeaseEpoch,
        task: execution.taskLeaseEpoch,
      },
      new Error(reason),
    );
  }

  start(): void {
    if (this.#closing !== undefined) throw new Error('phase runtime is closing');
    if (this.#timer !== undefined) return;
    this.#timer = setInterval(() => {
      void this.runOnce().catch(() =>
        process.stderr.write('phase runtime: background_tick_failed\n'),
      );
    }, this.#config.pollIntervalMs);
    void this.runOnce().catch(() =>
      process.stderr.write('phase runtime: background_start_failed\n'),
    );
  }
  async close(): Promise<void> {
    if (this.#closing !== undefined) return this.#closing;
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    this.#coordinators?.abort();
    this.#closing = (async () => {
      try {
        let cancellationError: unknown;
        if (this.#reservation !== undefined) {
          try {
            await this.interruptActive('service_stopped');
          } catch (error) {
            cancellationError = error;
          }
        }
        if (this.#reservation) this.#launcher.abortTransport(this.#reservation.id);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            this.#active,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('cleanup_pending')), 5000);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
        if (cancellationError !== undefined) throw cancellationError;
      } finally {
        this.#coordinators?.close();
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
    if (
      action.phase !== 'implementing' &&
      action.phase !== 'task_verification' &&
      action.phase !== 'task_review' &&
      action.phase !== 'feature_evaluation'
    )
      throw new Error('phase_executor_unavailable');
    const task = this.#contract.tasks.find((item) => item.id === action.taskId);
    const role =
      action.phase === 'implementing' ? task?.assignedRole : task?.phaseRoles?.[action.phase];
    if (task === undefined || role === undefined)
      throw new Error('phase_role_authority_unavailable');
    if (!task.allowedOperations.includes('artifact.write'))
      throw new Error('phase_evidence_authority_unavailable');
    const documentBinding = this.#store.verifyPlanningDocuments({
      runId: action.runId,
      taskId: action.taskId,
      boundary: 'phase.packet',
      expectedSourceRoot: this.#config.sourceRoot,
      ownerId: this.#owner,
    });
    const packet: TaskPacket = {
      documentBinding,
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
    this.#addRepairContext(action, packet);
    if (
      !packet.allowedOperations.includes('workspace.read') ||
      (role === 'test_runner' && !packet.allowedOperations.includes('process.test'))
    )
      throw new Error('phase_operation_authority_unavailable');
    if (
      action.phase === 'implementing' &&
      (role !== 'implementation_worker' || !packet.allowedOperations.includes('workspace.patch'))
    )
      throw new Error('phase_patch_authority_unavailable');
    assertTaskPacketWithinContract(
      this.#contract,
      packet,
      action.phase === 'implementing' ? undefined : action.phase,
    );
    return packet;
  }

  #addRepairContext(action: ExecutePhaseAction, packet: TaskPacket): void {
    if (action.phase === 'implementing') {
      const active = this.#store.listActiveRepairDispatches(action.runId, action.taskId);
      if (active.length > 1) throw new Error('ambiguous_active_repair');
      if (active[0]) {
        const repair = repairDispatchPacketSchema.parse(active[0].packet);
        if (repair.failureHeadSha !== action.headSha)
          throw new Error('repair_context_head_mismatch');
        packet.repairContext = {
          dispatchId: repair.dispatchId,
          failureHeadSha: repair.failureHeadSha,
          summary: repair.summary,
          hypothesis: repair.hypothesis,
        };
        packet.evidence = repair.evidence;
      }
    }
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
    if (this.#fatalAdmission) throw new Error('journal_unavailable');
    await this.#admission();
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
    if (PHASE_JOB_DISPATCH[action.phase].endsWith('_coordinator'))
      return this.#startCoordinator(claim, action, fences);
    return this.#runSpecialist(claim, action, fences);
  }

  async #startCoordinator(
    claim: PhaseJob,
    action: ExecutePhaseAction,
    fences: ResourceFences,
  ): Promise<boolean> {
    if (!this.#coordinators) {
      this.#journal.block(claim, 'phase_coordinator_configuration_missing', Date.now());
      return false;
    }
    try {
      await this.#verifySource(action, []);
      const job = this.#journal.start(claim, Date.now());
      return await this.#runCoordinator(job, action, fences);
    } catch {
      const current = this.#journal.get(claim.id)!;
      if (current.status === 'started')
        this.#journal.deferCoordinator(
          current,
          this.#contract.retryPolicy.infrastructureAttempts,
          Date.now(),
        );
      else this.#journal.block(current, 'phase_coordinator_admission_failed', Date.now());
      return false;
    }
  }

  #reserveAttempt(job: PhaseJob, action: ExecutePhaseAction): boolean {
    if (action.phase !== 'implementing') return true;
    try {
      this.#journal.reserveImplementationAttempt(job, Date.now());
      return true;
    } catch {
      this.#journal.block(job, 'phase_implementation_attempt_rejected', Date.now());
      return false;
    }
  }

  async #runSpecialist(
    claim: PhaseJob,
    action: ExecutePhaseAction,
    fences: ResourceFences,
  ): Promise<boolean> {
    let packet: TaskPacket;
    try {
      packet = this.#packet(action);
      await this.#verifySource(action, packet.allowedPaths);
    } catch {
      this.#journal.block(claim, 'phase_source_or_packet_invalid', Date.now());
      return false;
    }
    if (this.#closing !== undefined) {
      this.#journal.releaseClaim(claim, Date.now());
      return false;
    }
    const job = this.#journal.start(claim, Date.now());
    if (!this.#reserveAttempt(job, action)) return false;
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
          cancellation ??= this.interruptActive('execution_authority_lost').catch(
            (error: unknown) => {
              heartbeatError = error;
            },
          );
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
        callbackId: action.callbackId ?? action.coordinatorReceiptId!,
        headSha: action.headSha,
        runVersion: action.runVersion,
        phaseLeaseEpoch: job.lease_epoch,
        workspaceLeaseEpoch: fences.workspace,
        runLeaseEpoch: fences.run,
        taskLeaseEpoch: fences.task,
      },
      task: packet,
    });
    let healthCheck: Promise<void> | undefined;
    const healthTimer = setInterval(() => {
      if (healthCheck || heartbeatError !== undefined) return;
      healthCheck = this.#launcher
        .assertCredentialHealthy(reservation.id)
        .catch(async (error: unknown) => {
          heartbeatError = error;
          cancellation ??= this.interruptActive(
            error instanceof Error && error.message === 'broker_generation_changed'
              ? 'broker_generation_changed'
              : 'control_unavailable',
          );
          await cancellation;
        })
        .catch((error: unknown) => {
          heartbeatError = error;
        })
        .finally(() => {
          healthCheck = undefined;
        });
    }, 2000);
    let token: string | undefined;
    try {
      this.#store.verifyPlanningDocuments({
        runId: action.runId,
        taskId: action.taskId,
        boundary: 'phase.capability',
        ownerId: this.#owner,
        runLeaseEpoch: fences.run,
      });
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
        mode: action.phase === 'implementing' ? 'mutating' : 'read_only',
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
      const inputEvidence = await this.#vault.recordSpecialistInput({
        executionId: reservation.id,
        capability: evidenceCapability,
      });
      if (inputEvidence.reference.digest !== digestGovernedValue(inputEnvelope))
        throw new Error('phase_packet_evidence_redacted');
      const raw = await this.#launcher.launchBound(inputEnvelope, reservation, {
        assertAdmission: () => {
          if (this.#fatalAdmission) throw new Error('journal_unavailable');
          this.#assertAdmission();
        },
        admission: async () => {
          if (this.#fatalAdmission) throw new Error('journal_unavailable');
          await this.#admission();
          await this.#launcher.assertCredentialHealthy(reservation.id);
        },
        interrupted: async () => {
          await this.#recordInterruption(job, reservation, 'phase_execution_interrupted');
        },
      });
      await cancellation;
      if (heartbeatError !== undefined) throw heartbeatError;
      const terminal = specialistTerminalResult(raw);
      if (terminal === undefined) throw new Error('invalid_specialist_terminal_result');
      await this.#verifySource(action, packet.allowedPaths);
      let resultHead = action.headSha;
      if (action.phase === 'implementing') {
        const output = implementationOutputSchema.parse(
          typeof raw === 'object' && raw !== null && 'implementationOutput' in raw
            ? raw.implementationOutput
            : undefined,
        );
        const artifactBytes = Buffer.from(JSON.stringify(output));
        const artifact = await this.#vault.recordSpecialistResult({
          executionId: reservation.id,
          content: artifactBytes,
          headSha: action.headSha,
          capability: evidenceCapability,
        });
        if (artifact.reference.digest !== digestGovernedValue(output))
          throw new Error('phase_implementation_evidence_redacted');
        const persisted = await this.#vault.read({
          digest: artifact.reference.digest,
          runId: action.runId,
          taskId: action.taskId,
          capability: evidenceCapability,
        });
        const imported = this.#store.importImplementation({
          authority: {
            id: reservation.id,
            ownerId: this.#owner,
            workspaceLeaseEpoch: fences.workspace,
            runLeaseEpoch: fences.run,
            taskLeaseEpoch: fences.task,
          },
          sourceRoot: this.#config.sourceRoot,
          gitBinary: this.#config.gitBinary,
          gitBinaryDigest: this.#config.gitBinaryDigest,
          artifact: persisted,
          artifactDigest: artifact.reference.digest,
          renewLeaseTtlMs: Math.min(this.#config.leaseTtlMs, 60000),
        });
        resultHead = imported.resultHead;
        await this.#verifySource({ ...action, headSha: resultHead }, packet.allowedPaths);
      }
      await this.#completeSpecialist({
        job: job,
        action: action,
        packet: packet,
        fences: fences,
        executionId: reservation.id,
        terminal: terminal,
        resultHead: resultHead,
        inputDigest: inputEvidence.reference.digest,
        evidenceCapability: evidenceCapability,
        inputProducer: this.#owner,
      });
      return true;
    } catch (error) {
      await this.#failExecution(job, reservation, fences, error);
      return false;
    } finally {
      clearInterval(heartbeat);
      clearInterval(healthTimer);
      await healthCheck;
      await cancellation;
      this.#reservation = undefined;
      if (token !== undefined) this.#capabilities.revoke(token);
    }
  }

  async #runCoordinator(
    job: PhaseJob,
    action: ExecutePhaseAction,
    fences: ResourceFences,
  ): Promise<boolean> {
    if (this.#cleanupOnly || this.#fatalAdmission || !this.#coordinators)
      throw new Error('coordinator_admission_unavailable');
    await this.#admission();
    const assertDispatchAuthority = () => {
      this.#assertAdmission();
      if (this.#closing || this.#fatalAdmission)
        throw new Error('coordinator_admission_unavailable');
      for (const [kind, id, epoch] of [
        ['workspace', action.workspaceId, fences.workspace],
        ['run', action.runId, fences.run],
        ['task', action.taskId, fences.task],
      ] as const)
        this.#store.assertResourceLease(kind, id, this.#owner, epoch, Date.now());
      const current = this.#journal.get(job.id);
      if (
        current?.status !== 'started' ||
        current.lease_owner !== this.#owner ||
        current.lease_epoch !== job.lease_epoch ||
        current.lease_until_ms <= Date.now()
      )
        throw new Error('coordinator_phase_lease_stale');
    };
    const assertAuthority = () => {
      assertDispatchAuthority();
      this.#store.verifyPlanningDocuments({
        runId: action.runId,
        taskId: action.taskId,
        boundary: 'phase.coordinator',
        ownerId: this.#owner,
        runLeaseEpoch: fences.run,
        expectedSourceRoot: this.#config.sourceRoot,
      });
      this.#assertAdmission();
    };
    const heartbeat = setInterval(
      () => {
        try {
          assertAuthority();
          this.#journal.renew(job, this.#config.leaseTtlMs, Date.now());
          this.#fences(action);
        } catch {
          // Cancel this attempt; a freshly admitted recovery can reconcile the same intent.
          this.#coordinators?.cancelExecution();
        }
      },
      Math.floor(this.#config.leaseTtlMs / 3),
    );
    try {
      const proof = await this.#coordinators.execute(
        job,
        action,
        {
          ownerId: this.#owner,
          workspaceLeaseEpoch: fences.workspace,
          runLeaseEpoch: fences.run,
          taskLeaseEpoch: fences.task,
        },
        assertAuthority,
        assertDispatchAuthority,
      );
      this.#journal.completeCoordinator(job, proof, fences, Date.now());
      return true;
    } finally {
      clearInterval(heartbeat);
    }
  }

  async #completeSpecialist(input: {
    job: PhaseJob;
    action: ExecutePhaseAction;
    packet: TaskPacket;
    fences: ResourceFences;
    executionId: string;
    terminal: AgentResult;
    resultHead: string;
    inputDigest: string;
    evidenceCapability: EvidenceCapability;
    inputProducer: string;
  }): Promise<boolean> {
    const {
      job,
      action,
      packet,
      fences,
      executionId,
      terminal,
      resultHead,
      inputDigest,
      evidenceCapability,
      inputProducer,
    } = input;
    // Keep the structured answer only, with trusted execution identity to avoid cross-role digest aliasing.
    const result = { executionDigest: digestGovernedValue(executionId), terminal };
    const resultEvidence = await this.#vault.recordSpecialistResult({
      executionId: executionId,
      content: Buffer.from(JSON.stringify(result)),
      headSha: resultHead,
      capability: evidenceCapability,
    });
    if (resultEvidence.reference.digest !== digestGovernedValue(result))
      throw new Error('phase_result_evidence_redacted');
    const terminalStatus = phaseTerminalStatus(terminal, packet, action.phase);
    if (
      (action.phase === 'task_verification' || action.phase === 'task_review') &&
      terminalStatus === 'continue'
    ) {
      if (
        this.#store.listActiveRepairDispatches(action.runId, action.taskId).length &&
        !this.#coordinators
      )
        throw new Error('repair_acceptance_coordinator_unavailable');
      this.#coordinators?.acceptRepairResult(
        action,
        {
          ownerId: this.#owner,
          workspaceLeaseEpoch: fences.workspace,
          runLeaseEpoch: fences.run,
          taskLeaseEpoch: fences.task,
        },
        terminal,
        resultEvidence.reference,
      );
    }
    if (action.phase === 'feature_evaluation' && terminalStatus !== 'blocked') {
      new ContractEvaluator({ store: this.#store, contract: this.#contract }).evaluate({
        workspaceId: action.workspaceId,
        runId: action.runId,
        taskId: action.taskId,
        headSha: resultHead,
        contractVersion: action.contractVersion,
        policyDigest: action.policyDigest,
        evaluatorRole: packet.assignedRole,
        summary: terminal.summary,
        criteria: packet.acceptanceCriteria.map((criterion) => ({
          criterion,
          status:
            terminalStatus === 'continue' && terminal.acceptanceCriteria.passed.includes(criterion)
              ? 'passed'
              : 'failed',
          summary: terminal.summary,
          evidence: [resultEvidence.reference],
        })),
      });
    }
    const identity = {
      kind: 'workflow.delegate_callback' as const,
      workspaceId: action.workspaceId,
      parentRunId: action.runId,
      parentTaskId: action.taskId,
      parentState: action.phase,
      parentRunVersion: action.runVersion,
      delegationId: executionId,
      delegateAgentId: this.#store.getSchedulerExecution(executionId)!.processIdentity,
      delegateRole: packet.assignedRole,
      attemptNumber: this.#store.getSchedulerExecution(executionId)!.attemptNumber,
      contractVersion: action.contractVersion,
      policyDigest: action.policyDigest,
      materialDigest: action.materialDigest,
      workspaceLeaseEpoch: fences.workspace,
      parentRunLeaseEpoch: fences.run,
      taskLeaseEpoch: fences.task,
      headSha: resultHead,
      inputProducerIdentity: inputProducer,
      resultProducerIdentity: this.#store.getSchedulerExecution(executionId)!.processIdentity,
      inputArtifactDigest: inputDigest,
      terminalStatus,
      resultArtifactDigest: resultEvidence.reference.digest,
    };
    const callback: DelegateCallback = { ...identity, callbackId: digestGovernedValue(identity) };
    this.#store.finishSchedulerExecution({
      id: executionId,
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
      { executionId: executionId, evidenceDigest: resultEvidence.reference.digest },
      Date.now(),
    );
    return true;
  }

  async #failExecution(
    job: PhaseJob,
    reservation: DockerSpecialistReservation,
    _fences: ResourceFences,
    error: unknown,
  ): Promise<void> {
    const existing = this.#cleanup.get(reservation.id);
    if (existing) return existing;
    const operation = this.#cleanupExecution(job, reservation, error);
    this.#cleanup.set(reservation.id, operation);
    try {
      await operation;
    } finally {
      this.#cleanup.delete(reservation.id);
    }
  }
  async #cleanupExecution(
    job: PhaseJob,
    reservation: DockerSpecialistReservation,
    error: unknown,
  ): Promise<void> {
    const current = this.#journal.get(job.id);
    if (
      current?.status === 'blocked' ||
      current?.lease_epoch !== job.lease_epoch ||
      current.lease_until_ms <= Date.now()
    )
      return;
    const reason =
      error instanceof Error && error.message === 'broker_generation_changed'
        ? 'broker_generation_changed'
        : 'phase_execution_interrupted';
    if (!(await this.#recordInterruption(job, reservation, reason))) return;
    const cleanup = this.#journal.interruptions();
    const settled = cleanup
      .list(job.run_id)
      .some((row) => row.execution_id === reservation.id && row.state === 'settled');
    if (settled) {
      this.#journal.finalizeInterrupted(job);
      return;
    }
    const claimed = cleanup.claim(job.run_id, this.#owner, Date.now(), 30_000, reservation.id);
    if (!claimed) {
      this.#journal.deferInterrupted(job, Date.now());
      return;
    }
    const attempt = cleanup.begin(claimed, Date.now());
    this.#launcher.abortTransport(reservation.id);
    await this.#performCleanup(attempt, reservation);
    const outcome = cleanup.finishAttempt(attempt, Date.now());
    if (outcome.state !== 'settled') {
      this.#journal.deferInterrupted(job, Date.now());
      return;
    }
    this.#journal.finalizeInterrupted(job);
  }
  async #performCleanup(
    attempt: import('./executionInterruptions.js').ExecutionInterruption,
    reservation: DockerSpecialistReservation,
  ): Promise<void> {
    this.#launcher.beginInterruptionCleanup(attempt);
    try {
      const exists = this.#store.getSchedulerExecution(reservation.id) !== undefined;
      const results = await Promise.allSettled([
        exists ? this.#launcher.stopContainer(reservation) : Promise.resolve(),
        exists ? this.#launcher.revokeCredential(reservation.id) : Promise.resolve(),
      ]);
      await withinCleanupDeadline(
        this.#confirmCleanup(attempt, results, exists, reservation),
        attempt.attempt_deadline_ms,
      );
    } finally {
      this.#launcher.endInterruptionCleanup(reservation.id);
    }
  }
  async #confirmCleanup(
    attempt: import('./executionInterruptions.js').ExecutionInterruption,
    results: PromiseSettledResult<void>[],
    exists: boolean,
    reservation: DockerSpecialistReservation,
  ): Promise<void> {
    const cleanup = this.#journal.interruptions();
    for (const [index, operation] of ['cancel', 'revoke'].entries()) {
      if (results[index]?.status === 'fulfilled')
        cleanup.confirm(attempt, operation as 'cancel' | 'revoke', Date.now());
    }
    if (!exists || this.#launcher.isContainerSettled(reservation.id)) {
      try {
        if (exists)
          await withinCleanupDeadline(
            this.#launcher.removeInterruptedCredentials(reservation.id),
            Math.min(attempt.attempt_deadline_ms, Date.now() + 5000),
          );
        cleanup.confirm(attempt, 'settle', Date.now());
      } catch {
        /* Leave durable settlement pending if credential material could not be removed. */
      }
    }
  }
  async #recoverCoordinator(job: PhaseJob, action: ExecutePhaseAction): Promise<void> {
    try {
      await this.#runCoordinator(job, action, this.#fences(action));
    } catch (error) {
      if (error instanceof Error && error.message === 'resource lease is held by another owner')
        this.#journal.deferCoordinatorAdmission(job, Date.now());
      else
        this.#journal.deferCoordinator(
          job,
          this.#contract.retryPolicy.infrastructureAttempts,
          Date.now(),
        );
    }
  }

  async #recover(job: PhaseJob): Promise<void> {
    // Cleanup has its own narrow lease and cannot dispatch or advance the workflow.
    const heartbeat = setInterval(
      () => {
        try {
          this.#journal.renew(job, this.#config.leaseTtlMs, Date.now());
        } catch {
          /* The next fenced write rejects stale ownership. */
        }
      },
      Math.floor(this.#config.leaseTtlMs / 3),
    );
    try {
      const action = this.#journal.action(job);
      if (PHASE_JOB_DISPATCH[action.phase].endsWith('_coordinator')) {
        await this.#recoverCoordinator(job, action);
        return;
      }
      const execution = this.#store.getSchedulerExecution(job.execution_id!);
      if (execution?.status === 'completed') {
        this.#journal.complete(
          job,
          { executionId: execution.id, evidenceDigest: digestGovernedValue(execution.result) },
          Date.now(),
        );
        return;
      }
      if (execution && this.#store.getImplementationImport(execution.id)) {
        try {
          await this.#recoverImport(job);
        } catch {
          this.#journal.block(job, 'implementation_import_reconciliation_required', Date.now());
        }
        return;
      }
      if (execution) {
        await this.#failExecution(
          job,
          { id: execution.id, role: execution.role, deadlineMs: execution.deadlineMs },
          {
            workspace: execution.workspaceLeaseEpoch,
            run: execution.runLeaseEpoch,
            task: execution.taskLeaseEpoch,
          },
          new Error('phase_restart_requires_new_authorized_attempt'),
        );
      } else if (
        this.#journal
          .interruptions()
          .list(job.run_id)
          .some((row) => row.execution_id === job.execution_id)
      ) {
        await this.#cleanupExecution(
          job,
          {
            id: job.execution_id!,
            role: 'test_runner',
            deadlineMs: Date.now() + 15000,
          },
          new Error('phase_restart_requires_new_authorized_attempt'),
        );
      } else this.#journal.block(job, 'phase_restart_requires_new_authorized_attempt', Date.now());
    } finally {
      clearInterval(heartbeat);
    }
  }

  async #recoverImport(job: PhaseJob): Promise<void> {
    if (this.#cleanupOnly) throw new Error('cleanup_only_runtime');
    if (this.#fatalAdmission) throw new Error('journal_unavailable');
    await this.#admission();
    this.#assertAdmission();
    if (this.#closing) throw new Error('phase_runtime_closing');
    // A recovery may observe a prepared or applied head; pin Git before any import mutation.
    const recoveryGit = new TrustedSourceGit(
      this.#store.getImplementationWorkspace(this.#config.runId, this.#config.sourceRoot),
      this.#config.gitBinary,
      this.#config.gitBinaryDigest,
    );
    recoveryGit.assertSafeIndex();
    const action = this.#journal.action(job);
    const fences = this.#fences(action);
    const authority = {
      id: job.execution_id!,
      ownerId: this.#owner,
      workspaceLeaseEpoch: fences.workspace,
      runLeaseEpoch: fences.run,
      taskLeaseEpoch: fences.task,
    };
    const execution = this.#store.adoptImplementationImport({
      authority,
      phaseLeaseEpoch: job.lease_epoch,
      sourceRoot: this.#config.sourceRoot,
    });
    const packet = specialistInputEnvelopeSchema.parse(execution.packet);
    const capability = this.#capabilities.issue({
      workspaceId: action.workspaceId,
      runId: action.runId,
      role: 'workflow_orchestrator',
      contractVersion: action.contractVersion,
      policyDigest: action.policyDigest,
      operations: ['workspace.read', 'artifact.write'],
      allowedPaths: packet.task.allowedPaths,
      expiresAtMs: execution.deadlineMs,
      process: this.#process,
    });
    const evidenceCapability = { token: capability.token, observedProcess: this.#process };
    try {
      const intent = this.#store.getImplementationImport(execution.id)!;
      const bytes = await this.#vault.read({
        digest: intent.artifactDigest,
        runId: action.runId,
        taskId: action.taskId,
        capability: evidenceCapability,
      });
      const output = implementationOutputSchema.parse(
        JSON.parse(Buffer.from(bytes).toString('utf8')),
      );
      this.#assertAdmission();
      const imported = this.#store.importImplementation({
        authority,
        sourceRoot: this.#config.sourceRoot,
        gitBinary: this.#config.gitBinary,
        gitBinaryDigest: this.#config.gitBinaryDigest,
        artifact: bytes,
        artifactDigest: intent.artifactDigest,
        renewLeaseTtlMs: Math.min(this.#config.leaseTtlMs, 60000),
      });
      await this.#verifySource(
        { ...action, headSha: imported.resultHead },
        packet.task.allowedPaths,
      );
      const inputDigest = digestGovernedValue(packet);
      const input = this.#store.getSecureEvidence(inputDigest, action.runId, action.taskId);
      if (!input) throw new Error('implementation recovery input evidence missing');
      await this.#completeSpecialist({
        job: job,
        action: action,
        packet: packet.task,
        fences: fences,
        executionId: execution.id,
        terminal: output.terminal,
        resultHead: imported.resultHead,
        inputDigest: inputDigest,
        evidenceCapability: evidenceCapability,
        inputProducer: input.producer,
      });
    } finally {
      this.#capabilities.revoke(capability.token);
    }
  }
}
