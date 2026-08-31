import { execFile } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import type { TaskPacket } from './contracts.js';
import { WorkflowStore, workflowCredentialJournalCapability } from './storage.js';

const FORBIDDEN_NAMES = new Set(['.git', '.beads', '.ssh']);
const FORBIDDEN_ENVIRONMENT = /(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|DOCKER|SSH|GITHUB|GH_)/iu;
const FORBIDDEN_NETWORKS = new Set(['bridge', 'default', 'host']);

export interface SpecialistWorkspace {
  root: string;
  codexHome: string;
}

export interface DockerSpecialistLaunch {
  dockerBinary: string;
  args: string[];
  environment: Record<string, string>;
}

export interface SpecialistExecutionResult {
  events: unknown[];
  stderr: string;
  retainedWorkspaceRoot?: string;
}

export type SpecialistProcessExecutor = (
  executable: string,
  args: readonly string[],
  options: { env: Record<string, string>; timeout: number; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

export interface SpecialistLaunchRequest {
  image: string;
  workspaceRoot: string;
  codexHome: string;
  authFile: string;
  promptFile: string;
  egressNetwork: string;
  role: string;
  runId: string;
  containerUser?: string;
  extraEnvironment?: Record<string, string>;
  executionId?: string;
}

function isInside(path: string, root: string): boolean {
  const child = relative(root, path);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child));
}

export async function prepareSpecialistWorkspace(
  sourceRoot: string,
  allowedSourcePaths: readonly string[],
): Promise<SpecialistWorkspace> {
  if (allowedSourcePaths.length === 0) throw new Error('specialist source paths must not be empty');
  const canonicalSource = await realpath(sourceRoot);
  const stagingParent = await mkdtemp(join(tmpdir(), 'workflow-specialist-'));
  const root = join(stagingParent, 'workspace');
  const codexHome = join(stagingParent, 'codex-home');
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  const filter = async (source: string): Promise<boolean> => {
    const name = basename(source);
    if (FORBIDDEN_NAMES.has(name) || name === 'node_modules' || name === '.env') return false;
    return !(await lstat(source)).isSymbolicLink();
  };
  for (const allowedPath of allowedSourcePaths) {
    if (
      isAbsolute(allowedPath) ||
      allowedPath.split('/').includes('..') ||
      allowedPath.split('/').some((segment) => FORBIDDEN_NAMES.has(segment))
    ) {
      throw new Error(`specialist source path is forbidden: ${allowedPath}`);
    }
    const source = await realpath(resolve(canonicalSource, allowedPath));
    if (!isInside(source, canonicalSource)) {
      throw new Error(`specialist source path escapes the repository: ${allowedPath}`);
    }
    const destination = allowedPath === '.' ? root : join(root, allowedPath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await cp(source, destination, { recursive: true, dereference: false, filter });
  }
  await writeFile(
    join(codexHome, 'config.toml'),
    [
      'approval_policy = "never"',
      'sandbox_mode = "workspace-write"',
      'web_search = "disabled"',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  return { root, codexHome };
}

export async function buildDockerSpecialistLaunch(
  request: SpecialistLaunchRequest,
): Promise<DockerSpecialistLaunch> {
  for (const path of [
    request.workspaceRoot,
    request.codexHome,
    request.authFile,
    request.promptFile,
  ]) {
    if (!isAbsolute(path)) throw new Error('specialist launch paths must be absolute');
  }
  if (FORBIDDEN_NETWORKS.has(request.egressNetwork)) {
    throw new Error('specialist requires a dedicated policy-controlled egress network');
  }
  if (request.egressNetwork.trim() === '') throw new Error('specialist egress network is required');
  const containerUser =
    request.containerUser ?? `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;
  if (!/^[1-9]\d*:\d+$/u.test(containerUser)) {
    throw new Error('specialist container user must use a non-root numeric uid and numeric gid');
  }
  const environment = {
    CODEX_HOME: '/codex-home',
    WORKFLOW_RUN_ID: request.runId,
    WORKFLOW_ROLE: request.role,
    ...(request.extraEnvironment ?? {}),
  };
  const forbiddenVariable = Object.keys(environment).find(
    (name) => name !== 'WORKFLOW_RUN_ID' && FORBIDDEN_ENVIRONMENT.test(name),
  );
  if (forbiddenVariable !== undefined) {
    throw new Error(
      `specialist environment contains forbidden credential variable ${forbiddenVariable}`,
    );
  }

  const [workspaceRoot, codexHome, authFile, promptFile, configFile] = await Promise.all([
    realpath(request.workspaceRoot),
    realpath(request.codexHome),
    realpath(request.authFile),
    realpath(request.promptFile),
    realpath(join(request.codexHome, 'config.toml')),
  ]);
  const stagingRoot = await realpath(resolve(workspaceRoot, '..'));
  const mounts = [
    `${workspaceRoot}:/workspace:rw`,
    `${codexHome}:/codex-home:rw`,
    `${configFile}:/codex-home/config.toml:ro`,
    `${authFile}:/codex-home/auth.json:ro`,
    `${promptFile}:/run/specialist/prompt.txt:ro`,
  ];
  for (const mount of mounts) {
    const hostPath = mount.slice(0, mount.indexOf(':'));
    if (!isInside(hostPath, stagingRoot)) {
      throw new Error('specialist mount escapes its private staging directory');
    }
    if (FORBIDDEN_NAMES.has(basename(hostPath)) || hostPath === '/var/run/docker.sock') {
      throw new Error('specialist mount exposes a forbidden host surface');
    }
  }

  const args = [
    'run',
    '--rm',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--network',
    request.egressNetwork,
    '--pids-limit',
    '256',
    '--memory',
    '4g',
    '--cpus',
    '4',
    '--user',
    containerUser,
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,noexec,size=512m',
  ];
  if (request.executionId !== undefined) {
    if (!/^[a-f0-9-]{36}$/u.test(request.executionId)) {
      throw new Error('specialist execution id must be a UUID');
    }
    args.push('--name', `workflow-specialist-${request.executionId}`);
  }
  for (const [name, value] of Object.entries(environment)) args.push('--env', `${name}=${value}`);
  for (const mount of mounts) args.push('--volume', mount);
  args.push(
    '--workdir',
    '/workspace',
    request.image,
    'sh',
    '-c',
    'exec codex exec --json --sandbox workspace-write --skip-git-repo-check -C /workspace - < /run/specialist/prompt.txt',
  );
  return { dockerBinary: '/usr/local/bin/docker', args, environment: {} };
}

const defaultExecutor: SpecialistProcessExecutor = async (executable, args, options) => {
  const result = await promisify(execFile)(executable, [...args], {
    env: options.env,
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
  });
  return { stdout: result.stdout, stderr: result.stderr };
};

export async function executeDockerSpecialist(
  launch: DockerSpecialistLaunch,
  options: {
    timeoutMs: number;
    maxOutputBytes: number;
    executor?: SpecialistProcessExecutor;
  },
): Promise<SpecialistExecutionResult> {
  const executor = options.executor ?? defaultExecutor;
  const result = await executor(launch.dockerBinary, launch.args, {
    env: launch.environment,
    timeout: options.timeoutMs,
    maxBuffer: options.maxOutputBytes,
  });
  return parseSpecialistExecutionResult(result.stdout, result.stderr);
}

function parseSpecialistExecutionResult(stdout: string, stderr: string): SpecialistExecutionResult {
  const events = stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error('specialist returned non-JSONL output');
      }
    });
  return { events, stderr };
}

export interface SpecialistCredentialLease {
  authFile: string;
  leaseId: string;
  generation: string;
}

export class RevocableSpecialistCredentialBroker {
  readonly #store: WorkflowStore;
  readonly #issue: (
    stagingRoot: string,
    executionId: string,
    leaseId: string,
    generation: string,
  ) => Promise<SpecialistCredentialLease>;
  readonly #revoke: (leaseId: string, generation: string) => Promise<void>;
  readonly #observe: (leaseId: string, generation: string) => Promise<'active' | 'revoked'>;
  readonly #conformance: () => Promise<string>;

  private constructor(input: {
    store: WorkflowStore;
    issue: (
      stagingRoot: string,
      executionId: string,
      leaseId: string,
      generation: string,
    ) => Promise<SpecialistCredentialLease>;
    revoke: (leaseId: string, generation: string) => Promise<void>;
    observe: (leaseId: string, generation: string) => Promise<'active' | 'revoked'>;
    conformance: () => Promise<string>;
  }) {
    if (!(input.store instanceof WorkflowStore)) {
      throw new Error('credential broker requires the durable workflow store');
    }
    this.#store = input.store;
    this.#issue = input.issue;
    this.#revoke = input.revoke;
    this.#observe = input.observe;
    this.#conformance = input.conformance;
  }

  static create(input: {
    binary: string;
    store: WorkflowStore;
  }): RevocableSpecialistCredentialBroker {
    if (!isAbsolute(input.binary)) throw new Error('credential broker binary must be absolute');
    return new RevocableSpecialistCredentialBroker({
      store: input.store,
      issue: async (stagingRoot, executionId, leaseId, generation) => {
        const authFile = join(stagingRoot, 'codex-auth.json');
        const result = await defaultExecutor(
          input.binary,
          [
            'issue',
            '--execution-id',
            executionId,
            '--lease-id',
            leaseId,
            '--generation',
            generation,
            '--output',
            authFile,
          ],
          { env: {}, timeout: 30_000, maxBuffer: 64 * 1024 },
        );
        const confirmation = JSON.parse(result.stdout) as Record<string, unknown>;
        if (confirmation.leaseId !== leaseId || confirmation.generation !== generation) {
          throw new Error('credential broker did not confirm the requested lease id');
        }
        return { authFile, leaseId, generation };
      },
      revoke: async (leaseId, generation) => {
        const result = await defaultExecutor(
          input.binary,
          ['revoke', '--lease-id', leaseId, '--generation', generation],
          {
            env: {},
            timeout: 30_000,
            maxBuffer: 64 * 1024,
          },
        );
        const confirmation = JSON.parse(result.stdout) as Record<string, unknown>;
        if (
          confirmation.status !== 'revoked' ||
          confirmation.generation !== generation ||
          confirmation.leaseId !== leaseId
        ) {
          throw new Error('credential broker did not confirm generation-pinned revocation');
        }
      },
      observe: async (leaseId, generation) => {
        const result = await defaultExecutor(
          input.binary,
          ['status', '--lease-id', leaseId, '--generation', generation],
          {
            env: {},
            timeout: 30_000,
            maxBuffer: 64 * 1024,
          },
        );
        const observation = JSON.parse(result.stdout) as Record<string, unknown>;
        const status = observation.status;
        if (
          (status !== 'active' && status !== 'revoked') ||
          observation.generation !== generation ||
          observation.leaseId !== leaseId
        ) {
          throw new Error('credential broker returned an invalid generation-pinned lease status');
        }
        return status;
      },
      conformance: async () => {
        const result = await defaultExecutor(
          input.binary,
          ['conformance', '--protocol', 'revoke-wins-v1', '--max-probe-ttl-seconds', '30'],
          { env: {}, timeout: 30_000, maxBuffer: 64 * 1024 },
        );
        let attestation: unknown;
        try {
          attestation = JSON.parse(result.stdout) as unknown;
        } catch {
          throw new Error('credential broker returned invalid conformance evidence');
        }
        if (
          typeof attestation !== 'object' ||
          attestation === null ||
          Array.isArray(attestation) ||
          (attestation as Record<string, unknown>).protocol !== 'revoke-wins-v1' ||
          (attestation as Record<string, unknown>).passed !== true ||
          (attestation as Record<string, unknown>).cleanup !== 'broker_owned_ttl' ||
          typeof (attestation as Record<string, unknown>).generation !== 'string' ||
          ((attestation as Record<string, unknown>).generation as string).trim() === '' ||
          typeof (attestation as Record<string, unknown>).probeTtlSeconds !== 'number' ||
          !Number.isFinite((attestation as Record<string, unknown>).probeTtlSeconds as number) ||
          ((attestation as Record<string, unknown>).probeTtlSeconds as number) <= 0 ||
          ((attestation as Record<string, unknown>).probeTtlSeconds as number) > 30
        ) {
          throw new Error('credential broker failed revoke-wins conformance');
        }
        return (attestation as Record<string, unknown>).generation as string;
      },
    });
  }

  static createForTest(input: {
    store: WorkflowStore;
    issue: (
      stagingRoot: string,
      executionId: string,
      leaseId: string,
      generation: string,
    ) => Promise<SpecialistCredentialLease>;
    revoke: (leaseId: string, generation: string) => Promise<void>;
    observe: (leaseId: string, generation: string) => Promise<'active' | 'revoked'>;
    conformance: () => Promise<string>;
  }): RevocableSpecialistCredentialBroker {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test credential broker is unavailable outside the test runtime');
    }
    return new RevocableSpecialistCredentialBroker(input);
  }

  async issue(
    stagingRoot: string,
    executionId: string,
    generation: string,
  ): Promise<SpecialistCredentialLease> {
    const leaseId = this.leaseId(executionId);
    this.#store.bindSchedulerCredentialGeneration(
      { id: executionId, leaseId, generation },
      workflowCredentialJournalCapability,
    );
    this.#store.advanceSchedulerCredential(
      { id: executionId, leaseId, from: ['pending', 'issuing'], to: 'issuing' },
      workflowCredentialJournalCapability,
    );
    try {
      const lease = await this.#issue(stagingRoot, executionId, leaseId, generation);
      if (lease.leaseId !== leaseId)
        throw new Error('credential broker changed the durable lease id');
      if (lease.generation !== generation)
        throw new Error('credential broker changed the attested generation');
      const canonicalRoot = await realpath(stagingRoot);
      const canonicalAuth = await realpath(lease.authFile);
      if (!isInside(canonicalAuth, canonicalRoot)) {
        throw new Error('credential broker auth file escapes specialist staging');
      }
      this.#store.advanceSchedulerCredential(
        { id: executionId, leaseId, from: ['issuing'], to: 'issued' },
        workflowCredentialJournalCapability,
      );
      return { ...lease, authFile: canonicalAuth };
    } catch (issueError) {
      try {
        await this.#revokeAndConfirm(leaseId, generation);
        const execution = this.#store.getSchedulerExecution(executionId);
        if (execution?.status === 'active' && execution.credentialLeaseId === leaseId) {
          this.#store.advanceSchedulerCredential(
            {
              id: executionId,
              leaseId,
              from: ['pending', 'issuing', 'issued', 'revoking'],
              to: 'revoking',
            },
            workflowCredentialJournalCapability,
          );
          this.#store.advanceSchedulerCredential(
            { id: executionId, leaseId, from: ['revoking'], to: 'revoked' },
            workflowCredentialJournalCapability,
          );
        }
      } catch (revokeError) {
        throw new AggregateError(
          [issueError, revokeError],
          'credential issue failed and compensating revocation was not confirmed',
        );
      }
      throw issueError;
    }
  }

  leaseId(executionId: string): string {
    if (!/^[a-f0-9-]{36}$/u.test(executionId)) throw new Error('execution id must be a UUID');
    return `specialist:${executionId}`;
  }

  assertConformant(): Promise<string> {
    return this.#conformance();
  }

  async revoke(executionId: string): Promise<void> {
    const leaseId = this.leaseId(executionId);
    let generation: string | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const execution = this.#store.getSchedulerExecution(executionId);
      if (execution === undefined) throw new Error('scheduler execution not found for revocation');
      if (execution.credentialStatus === 'revoked') return;
      if (execution.credentialStatus === 'legacy_quarantined') {
        throw new Error('legacy credential remains quarantined');
      }
      generation = execution.credentialBrokerGeneration;
      if (generation === null && execution.credentialStatus !== 'pending') {
        throw new Error('issued credential is missing its broker generation');
      }
      if (execution.credentialStatus === 'revoking') break;
      try {
        this.#store.advanceSchedulerCredential(
          { id: executionId, leaseId, from: [execution.credentialStatus], to: 'revoking' },
          workflowCredentialJournalCapability,
        );
        break;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('compare-and-swap race'))
          throw error;
        if (attempt === 3) throw new Error('credential revocation CAS retry budget exhausted');
      }
    }
    if (generation === null) {
      this.#store.advanceSchedulerCredential(
        { id: executionId, leaseId, from: ['revoking'], to: 'revoked' },
        workflowCredentialJournalCapability,
      );
      return;
    }
    await this.#revokeAndConfirm(leaseId, generation);
    this.#store.advanceSchedulerCredential(
      { id: executionId, leaseId, from: ['revoking'], to: 'revoked' },
      workflowCredentialJournalCapability,
    );
  }

  async #revokeAndConfirm(leaseId: string, generation: string): Promise<void> {
    await this.#revoke(leaseId, generation);
    if ((await this.#observe(leaseId, generation)) !== 'revoked') {
      throw new Error('credential broker did not confirm lease revocation');
    }
  }
}

export interface DockerSpecialistLauncherOptions {
  sourceRoot: string;
  image: string;
  credentialBroker: RevocableSpecialistCredentialBroker;
  egressNetwork: string;
  containerUser?: string;
  maxOutputBytes?: number;
  executor?: SpecialistProcessExecutor;
  clock?: () => number;
  cancellationSettleMs?: number;
}

export interface DockerSpecialistReservation {
  id: string;
  role: string;
  deadlineMs: number;
}

export class DockerIsolatedSpecialistLauncher {
  readonly #options: DockerSpecialistLauncherOptions;
  readonly #clock: () => number;
  readonly #cancelled = new Set<string>();
  readonly #settlements = new Map<string, Promise<void>>();
  readonly #containerLocks = new Map<string, Promise<void>>();

  private constructor(options: DockerSpecialistLauncherOptions) {
    if (!(options.credentialBroker instanceof RevocableSpecialistCredentialBroker)) {
      throw new Error('specialist launcher requires a revocable credential broker');
    }
    this.#options = options;
    this.#clock = options.clock ?? Date.now;
  }

  static create(
    options: Omit<DockerSpecialistLauncherOptions, 'executor'>,
  ): DockerIsolatedSpecialistLauncher {
    return new DockerIsolatedSpecialistLauncher(options);
  }

  static createForTest(options: DockerSpecialistLauncherOptions): DockerIsolatedSpecialistLauncher {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test specialist executor is unavailable outside the test runtime');
    }
    return new DockerIsolatedSpecialistLauncher(options);
  }

  processIdentity(reservation: DockerSpecialistReservation): string {
    return `docker:workflow-specialist-${reservation.id}`;
  }

  credentialLeaseId(reservation: DockerSpecialistReservation): string {
    return this.#options.credentialBroker.leaseId(reservation.id);
  }

  revokeCredential(executionId: string): Promise<void> {
    return this.#options.credentialBroker.revoke(executionId);
  }

  launch(packet: TaskPacket, reservation: DockerSpecialistReservation): Promise<unknown> {
    const launched = this.#launch(packet, reservation);
    const settlement = launched.then(
      () => undefined,
      () => undefined,
    );
    this.#settlements.set(reservation.id, settlement);
    void settlement.finally(() => this.#settlements.delete(reservation.id));
    return launched;
  }

  async #launch(
    packet: TaskPacket,
    reservation: DockerSpecialistReservation,
  ): Promise<SpecialistExecutionResult> {
    const credentialBrokerGeneration = await this.#options.credentialBroker.assertConformant();
    const workspace = await prepareSpecialistWorkspace(
      this.#options.sourceRoot,
      packet.allowedPaths,
    );
    const stagingRoot = resolve(workspace.root, '..');
    const promptFile = join(stagingRoot, 'task-packet.json');
    const containerName = `workflow-specialist-${reservation.id}`;
    let retainWorkspace = false;
    let credentialLease: SpecialistCredentialLease | undefined;
    let credentialRevoked = false;
    try {
      credentialLease = await this.#options.credentialBroker.issue(
        stagingRoot,
        reservation.id,
        credentialBrokerGeneration,
      );
      await writeFile(promptFile, `${JSON.stringify(packet)}\n`, { mode: 0o600 });
      const launch = await buildDockerSpecialistLaunch({
        image: this.#options.image,
        workspaceRoot: workspace.root,
        codexHome: workspace.codexHome,
        authFile: credentialLease.authFile,
        promptFile,
        egressNetwork: this.#options.egressNetwork,
        role: reservation.role,
        runId: packet.runId,
        containerUser: this.#options.containerUser,
        executionId: reservation.id,
      });
      if (this.#cancelled.has(reservation.id)) {
        throw new Error('specialist launch was cancelled before container start');
      }
      const executor = this.#options.executor ?? defaultExecutor;
      const createArgs = [
        'create',
        ...launch.args.slice(1).filter((argument) => argument !== '--rm'),
      ];
      await executor(launch.dockerBinary, createArgs, {
        env: launch.environment,
        timeout: 60_000,
        maxBuffer: 64 * 1024,
      });
      let started: Promise<{ stdout: string; stderr: string }> | undefined;
      await this.#withContainerLock(reservation.id, () => {
        if (this.#cancelled.has(reservation.id)) {
          throw new Error('specialist launch was cancelled before container start');
        }
        started = executor(launch.dockerBinary, ['start', '--attach', containerName], {
          env: launch.environment,
          timeout: Math.max(1, reservation.deadlineMs - this.#clock()),
          maxBuffer: this.#options.maxOutputBytes ?? 4 * 1024 * 1024,
        });
      });
      const result = await started!;
      const parsed = parseSpecialistExecutionResult(result.stdout, result.stderr);
      await this.#options.credentialBroker.revoke(reservation.id);
      credentialRevoked = true;
      await Promise.all([
        rm(credentialLease.authFile, { force: true }),
        rm(promptFile, { force: true }),
        rm(workspace.codexHome, { recursive: true, force: true }),
      ]);
      retainWorkspace = true;
      return { ...parsed, retainedWorkspaceRoot: workspace.root };
    } finally {
      await this.#removeContainer(containerName);
      if (credentialLease !== undefined && !credentialRevoked) {
        await this.#options.credentialBroker.revoke(reservation.id).catch(() => undefined);
      }
      this.#cancelled.delete(reservation.id);
      if (!retainWorkspace) await rm(stagingRoot, { recursive: true, force: true });
    }
  }

  async cancel(reservation: DockerSpecialistReservation): Promise<void> {
    this.#cancelled.add(reservation.id);
    await this.#withContainerLock(reservation.id, () =>
      this.#stopIfPresent(this.processIdentity(reservation)),
    );
  }

  async cancelProcessIdentity(processIdentity: string): Promise<void> {
    const prefix = 'docker:';
    if (!processIdentity.startsWith(prefix)) throw new Error('unsupported specialist process');
    await this.#stopIfPresent(processIdentity);
  }

  async waitForSettlement(reservation: DockerSpecialistReservation): Promise<boolean> {
    const settlement = this.#settlements.get(reservation.id);
    if (settlement === undefined) return true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const settled = await Promise.race([
      settlement.then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), this.#options.cancellationSettleMs ?? 15_000);
      }),
    ]);
    if (timeout !== undefined) clearTimeout(timeout);
    return settled;
  }

  async #stopIfPresent(processIdentity: string): Promise<void> {
    const name = processIdentity.slice('docker:'.length);
    const executor = this.#options.executor ?? defaultExecutor;
    await executor('/usr/local/bin/docker', ['stop', '--time', '10', name], {
      env: {},
      timeout: 15_000,
      maxBuffer: 64 * 1024,
    }).catch(() => undefined);
    let state: { stdout: string; stderr: string } | undefined;
    try {
      state = await executor(
        '/usr/local/bin/docker',
        ['inspect', '-f', '{{.State.Running}}', name],
        {
          env: {},
          timeout: 5_000,
          maxBuffer: 64 * 1024,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/(?:no such object|no such container)/iu.test(message)) throw error;
    }
    if (state?.stdout.trim() === 'true') throw new Error('specialist container remains running');
  }

  async #removeContainer(name: string): Promise<void> {
    const executor = this.#options.executor ?? defaultExecutor;
    await executor('/usr/local/bin/docker', ['rm', '--force', name], {
      env: {},
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    }).catch(() => undefined);
  }

  async #withContainerLock<T>(id: string, operation: () => Promise<T> | T): Promise<T> {
    const previous = this.#containerLocks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.#containerLocks.set(id, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.#containerLocks.get(id) === queued) this.#containerLocks.delete(id);
    }
  }
}
