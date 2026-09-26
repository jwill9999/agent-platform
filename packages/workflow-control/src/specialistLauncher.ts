import { SPECIALIST_SECCOMP } from './specialistSeccomp.js';
import {
  specialistRoleProfile,
  specialistRoleConfig,
  specialistWorkingDirectory,
  specialistSourceEvidence,
  type SpecialistModelConnection,
} from './specialistRoleProfile.js';
import { modelGatewayConfigSchema, type ModelGatewayConfig } from './modelGatewayConfig.js';
import { execFile } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify, isDeepStrictEqual } from 'node:util';

import type { TaskPacket } from './contracts.js';
import {
  specialistInputEnvelopeSchema,
  specialistExecutionDigest,
  type SpecialistInputEnvelope,
} from './specialistInput.js';
import {
  WorkflowStore,
  workflowCredentialJournalCapability,
  workflowContainerJournalCapability,
  type SchedulerContainerAuthority,
  type SchedulerContainerRecord,
} from './storage.js';

const FORBIDDEN_NAMES = new Set(['.git', '.beads', '.ssh', '.codex', '.agents']);
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

const generatedLaunches = new WeakMap<DockerSpecialistLaunch, DockerSpecialistLaunch>();

/** Internal read-only lookup; only the builder can establish launch provenance. */
export function generatedDockerSpecialistLaunch(
  launch: DockerSpecialistLaunch,
): DockerSpecialistLaunch {
  const snapshot = generatedLaunches.get(launch);
  if (snapshot === undefined) throw new Error('specialist lifecycle requires a generated launch');
  return snapshot;
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
  approvedDocumentsRoot?: string;
  egressNetwork: string;
  role: string;
  allowedOperations: readonly string[];
  modelConnection?: SpecialistModelConnection;
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
  const stagingParent = await realpath(await mkdtemp(join(tmpdir(), 'workflow-specialist-')));
  try {
    return await populateSpecialistWorkspace(canonicalSource, allowedSourcePaths, stagingParent);
  } catch (error) {
    await rm(stagingParent, { recursive: true, force: true });
    throw error;
  }
}

async function populateSpecialistWorkspace(
  canonicalSource: string,
  allowedSourcePaths: readonly string[],
  stagingParent: string,
): Promise<SpecialistWorkspace> {
  const root = join(stagingParent, 'workspace');
  const codexHome = join(stagingParent, 'codex-home');
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  const filter = async (source: string): Promise<boolean> => {
    const name = basename(source);
    if (FORBIDDEN_NAMES.has(name) || name === 'node_modules' || name.startsWith('.env'))
      return false;
    return !(await lstat(source)).isSymbolicLink();
  };
  for (const allowedPath of allowedSourcePaths) {
    if (
      isAbsolute(allowedPath) ||
      allowedPath.split('/').includes('..') ||
      allowedPath
        .split('/')
        .some((segment) => FORBIDDEN_NAMES.has(segment) || segment.startsWith('.env'))
    ) {
      throw new Error(`specialist source path is forbidden: ${allowedPath}`);
    }
    let selected = canonicalSource;
    for (const part of allowedPath.split('/')) {
      selected = join(selected, part);
      if ((await lstat(selected)).isSymbolicLink())
        throw new Error('specialist source symlinks are forbidden');
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
  // Docker Desktop needs the nested file mount destination to exist in the mounted home.
  // The real authentication file is mounted read-only over this empty, non-secret placeholder.
  await writeFile(join(codexHome, 'auth.json'), '{}\n', { mode: 0o600, flag: 'wx' });
  return { root, codexHome };
}

function assertPrivateMounts(mounts: readonly string[], stagingRoot: string): void {
  for (const mount of mounts) {
    const hostPath = mount.slice(0, mount.indexOf(':'));
    if (!isInside(hostPath, stagingRoot)) {
      throw new Error('specialist mount escapes its private staging directory');
    }
    if (FORBIDDEN_NAMES.has(basename(hostPath)) || hostPath === '/var/run/docker.sock') {
      throw new Error('specialist mount exposes a forbidden host surface');
    }
  }
}

function prepareLaunchEnvironment(request: SpecialistLaunchRequest) {
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
  if (
    Object.keys(request.extraEnvironment ?? {}).length &&
    !(process.env.NODE_ENV === 'test' && request.egressNetwork === 'none')
  )
    throw new Error('forbidden credential variable or environment override');
  const environment = {
    CODEX_HOME: '/codex-home',
    HOME: '/codex-home',
    XDG_CONFIG_HOME: '/codex-home/config',
    PATH: '/usr/local/bin:/usr/bin:/bin',
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

  return { containerUser, environment };
}

async function validateStagingOwner(containerUser: string, paths: readonly string[]) {
  const uid = Number(containerUser.split(':')[0]);
  for (const path of paths)
    if ((await lstat(path)).uid !== uid)
      throw new Error('specialist staging owner must match the non-root container uid');
}

async function prepareOutputDirectories(paths: readonly string[]) {
  for (const path of paths) {
    const existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink()))
      throw new Error('specialist output directory must be private regular directory');
    await mkdir(path, { recursive: true, mode: 0o700 });
  }
}

export async function buildDockerSpecialistLaunch(
  request: SpecialistLaunchRequest,
): Promise<DockerSpecialistLaunch> {
  const profile = specialistRoleProfile(request.role, request.allowedOperations);
  const { containerUser, environment } = prepareLaunchEnvironment(request);
  const [workspaceRoot, codexHome, authFile, promptFile, configFile] = await Promise.all([
    realpath(request.workspaceRoot),
    realpath(request.codexHome),
    realpath(request.authFile),
    realpath(request.promptFile),
    realpath(join(request.codexHome, 'config.toml')),
  ]);
  const stagingRoot = await realpath(resolve(workspaceRoot, '..'));
  assertPrivateMounts(
    [workspaceRoot, codexHome, configFile, authFile, promptFile].map(
      (path) => `${path}:/checked:ro`,
    ),
    stagingRoot,
  );
  await validateStagingOwner(containerUser, [
    workspaceRoot,
    codexHome,
    authFile,
    promptFile,
    configFile,
  ]);
  const readOnlySource = !profile.patch;
  const workingDirectory = specialistWorkingDirectory(profile);
  const permitsWrites = profile.patch || profile.test || profile.artifacts;
  await writeFile(configFile, specialistRoleConfig(profile, request.modelConnection), {
    mode: 0o600,
  });
  const scratch = join(stagingRoot, 'scratch'),
    evidence = join(stagingRoot, 'evidence');
  await prepareOutputDirectories([scratch, evidence]);
  const mounts = [
    `${workspaceRoot}:/workspace:${readOnlySource ? 'ro' : 'rw'}`,
    `${scratch}:/scratch:${profile.test ? 'rw' : 'ro'}`,
    `${evidence}:/evidence:${profile.artifacts ? 'rw' : 'ro'}`,
    `${codexHome}:/codex-home:rw`,
    `${configFile}:/codex-home/config.toml:ro`,
    `${authFile}:/codex-home/auth.json:ro`,
    `${promptFile}:/run/specialist/prompt.txt:ro`,
  ];
  if (request.approvedDocumentsRoot !== undefined) {
    const approvedRoot = await realpath(request.approvedDocumentsRoot);
    if (approvedRoot === workspaceRoot || isInside(approvedRoot, workspaceRoot))
      throw new Error('approved documents must be outside the writable workspace');
    mounts.push(`${approvedRoot}:/run/approved-documents:ro`);
  }
  assertPrivateMounts(mounts, stagingRoot);

  const seccompFile = join(stagingRoot, 'specialist-seccomp.json');
  if (permitsWrites) {
    // Never follow or replace an existing path, including a symlink outside private staging.
    await writeFile(seccompFile, JSON.stringify(SPECIALIST_SECCOMP), { mode: 0o600, flag: 'wx' });
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
  if (permitsWrites) args.push('--security-opt', `seccomp=${seccompFile}`);
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
    workingDirectory,
    request.image,
    'sh',
    '-c',
    `exec codex exec --json --sandbox ${permitsWrites ? 'workspace-write' : 'read-only'} --skip-git-repo-check -C ${workingDirectory} - < /run/specialist/prompt.txt`,
  );
  // This proves generated Docker policy, not private staging provenance. Trusted composition
  // must supply dedicated staging roots; untrusted/model input must never choose host paths.
  const launch = { dockerBinary: '/usr/local/bin/docker', args, environment: {} };
  Object.freeze(launch.args);
  Object.freeze(launch.environment);
  Object.freeze(launch);
  generatedLaunches.set(launch, launch);
  return launch;
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
    nowMs = Date.now(),
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
      const lease = await this.#store.dispatchSchedulerCredentialIssue(
        executionId,
        () => this.#issue(stagingRoot, executionId, leaseId, generation),
        workflowCredentialJournalCapability,
        nowMs,
      );
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
  modelGateway?: ModelGatewayConfig;
  store: WorkflowStore;
  ownerId: string;
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
    if (!(options.store instanceof WorkflowStore) || options.ownerId.trim() === '')
      throw new Error('specialist launcher requires a store and owner');
    if (!(options.credentialBroker instanceof RevocableSpecialistCredentialBroker)) {
      throw new Error('specialist launcher requires a revocable credential broker');
    }
    if (options.modelGateway) modelGatewayConfigSchema.parse(options.modelGateway);
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
    return this.#trackLaunch(packet, reservation);
  }

  launchBound(
    input: SpecialistInputEnvelope,
    reservation: DockerSpecialistReservation,
  ): Promise<unknown> {
    const envelope = specialistInputEnvelopeSchema.parse(input);
    if (
      envelope.binding.executionDigest !== specialistExecutionDigest(reservation.id) ||
      envelope.task.assignedRole !== reservation.role
    )
      throw new Error('specialist input envelope execution binding mismatch');
    return this.#trackLaunch(envelope.task, reservation, envelope);
  }

  #trackLaunch(
    packet: TaskPacket,
    reservation: DockerSpecialistReservation,
    envelope?: SpecialistInputEnvelope,
  ): Promise<unknown> {
    const copiedEnvelope = envelope === undefined ? undefined : structuredClone(envelope);
    const launched = this.#launch(
      copiedEnvelope?.task ?? structuredClone(packet),
      { ...reservation },
      copiedEnvelope,
    );
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
    envelope?: SpecialistInputEnvelope,
  ): Promise<SpecialistExecutionResult> {
    const authority = this.#authority(reservation.id);
    let stagingRoot: string | undefined;
    let retainWorkspace = false;
    let output: SpecialistExecutionResult | undefined;
    let launchError: unknown;
    try {
      const persisted = this.#options.store.getSchedulerExecution(reservation.id);
      if (
        persisted?.status !== 'active' ||
        persisted.runId !== packet.runId ||
        persisted.taskId !== packet.taskId ||
        persisted.role !== reservation.role ||
        persisted.deadlineMs !== reservation.deadlineMs ||
        !isDeepStrictEqual(persisted.packet, envelope ?? packet)
      )
        throw new Error('specialist input differs from durable scheduler input');
      const roleProfile = specialistRoleProfile(packet.assignedRole, packet.allowedOperations);
      this.#assertCanStart(reservation);
      const credentialBrokerGeneration = await this.#options.credentialBroker.assertConformant();
      const workspace = await prepareSpecialistWorkspace(
        this.#options.sourceRoot,
        packet.allowedPaths,
      );
      stagingRoot = resolve(workspace.root, '..');
      const promptFile = join(stagingRoot, 'task-packet.json');
      const approvedDocumentsRoot = join(stagingRoot, 'approved-documents');
      this.#options.store.stageApprovedDocuments({
        runId: packet.runId,
        taskId: packet.taskId,
        packet,
        ownerId: authority.ownerId,
        runLeaseEpoch: authority.runLeaseEpoch,
        boundary: 'specialist.snapshot',
        sourceRoot: this.#options.sourceRoot,
        destination: approvedDocumentsRoot,
        nowMs: this.#clock(),
      });
      const credentialLease = await this.#options.credentialBroker.issue(
        stagingRoot,
        reservation.id,
        credentialBrokerGeneration,
        this.#clock(),
      );
      const sourceEvidence = await specialistSourceEvidence(roleProfile, workspace.root);
      await writeFile(
        promptFile,
        `${JSON.stringify({ input: envelope ?? packet, sourceEvidence, writableLocations: { scratch: roleProfile.test ? '/scratch' : null, evidence: roleProfile.artifacts ? '/evidence' : null } })}\n`,
        { mode: 0o600 },
      );
      const launch = await buildDockerSpecialistLaunch({
        image: this.#options.image,
        workspaceRoot: workspace.root,
        codexHome: workspace.codexHome,
        authFile: credentialLease.authFile,
        promptFile,
        approvedDocumentsRoot,
        egressNetwork: this.#options.egressNetwork,
        role: reservation.role,
        allowedOperations: packet.allowedOperations,
        modelConnection: this.#options.modelGateway,
        runId: packet.runId,
        containerUser: this.#options.containerUser,
        executionId: reservation.id,
      });
      this.#assertCanStart(reservation);
      const createArgs = [
        'create',
        '--label',
        `io.agent-platform.specialist-execution=${reservation.id}`,
        ...launch.args.slice(2),
      ];
      this.#advance(authority, 'not_dispatched', 'create_pending');
      this.#assertCanStart(reservation);
      const created = await this.#options.store.dispatchSchedulerContainer(
        authority,
        this.#options.sourceRoot,
        () => this.#docker(createArgs, Math.min(60_000, reservation.deadlineMs - this.#clock())),
        workflowContainerJournalCapability,
        this.#clock,
      );
      const containerId = created.stdout.trim();
      if (!/^[a-f0-9]{64}$/u.test(containerId))
        throw new Error('specialist create acknowledgement is invalid');
      this.#advance(authority, 'create_pending', 'acknowledged', containerId);
      if ((await this.#inspectOwned(this.#state(reservation.id), containerId)) === undefined)
        throw new Error('specialist acknowledged container is absent before start');
      let started: Promise<{ stdout: string; stderr: string }> | undefined;
      await this.#withContainerLock(reservation.id, () => {
        this.#assertCanStart(reservation);
        this.#options.store.verifyApprovedDocumentSnapshot({
          runId: packet.runId,
          taskId: packet.taskId,
          packet,
          destination: approvedDocumentsRoot,
          ownerId: authority.ownerId,
          runLeaseEpoch: authority.runLeaseEpoch,
          boundary: 'specialist.snapshot_start',
          expectedSourceRoot: this.#options.sourceRoot,
          nowMs: this.#clock(),
        });
        // Revalidate fences immediately before dispatch without another asynchronous gap.
        this.#assertAuthority(authority);
        started = this.#options.store.dispatchSchedulerContainer(
          authority,
          this.#options.sourceRoot,
          () =>
            this.#docker(
              ['start', '--attach', containerId],
              reservation.deadlineMs - this.#clock(),
              this.#options.maxOutputBytes ?? 4 * 1024 * 1024,
            ),
          workflowContainerJournalCapability,
          this.#clock,
        );
      });
      const result = await started!;
      this.#assertCanStart(reservation);
      const observed = await this.#inspectOwned(this.#state(reservation.id), containerId);
      if (
        observed === undefined ||
        observed.running ||
        observed.status !== 'exited' ||
        observed.exitCode !== 0
      )
        throw new Error('specialist exit was not confirmed');
      const parsed = parseSpecialistExecutionResult(result.stdout, result.stderr);
      await this.#settle(authority);
      await this.#options.credentialBroker.revoke(reservation.id);
      this.#assertAuthority(authority);
      if (!this.#settled(reservation.id))
        throw new Error('specialist settlement remains unconfirmed');
      await Promise.all([
        rm(credentialLease.authFile, { force: true }),
        rm(promptFile, { force: true }),
        rm(workspace.codexHome, { recursive: true, force: true }),
      ]);
      retainWorkspace = true;
      output = { ...parsed, retainedWorkspaceRoot: workspace.root };
    } catch (error) {
      launchError = error;
    }
    // Cleanup and revocation are independent security operations, even when one fails.
    const cleanup = await Promise.allSettled([
      this.#settle(authority),
      this.#options.credentialBroker.revoke(reservation.id),
    ]);
    if (output !== undefined) {
      try {
        this.#assertCanStart(reservation);
        this.#assertAuthority(authority);
      } catch (error) {
        output = undefined;
        retainWorkspace = false;
        launchError = error;
      }
    }
    this.#cancelled.delete(reservation.id);
    if (!retainWorkspace && stagingRoot !== undefined && this.#settled(reservation.id))
      await rm(stagingRoot, { recursive: true, force: true });
    if (cleanup.some((result) => result.status === 'rejected') || !this.#settled(reservation.id))
      throw new Error(
        `specialist settlement unconfirmed; retain staging for docker:workflow-specialist-${reservation.id}`,
        { cause: launchError },
      );
    if (output === undefined) throw launchError;
    return output;
  }

  async cancel(reservation: DockerSpecialistReservation): Promise<void> {
    this.#cancelled.add(reservation.id);
    await this.#boundedSettlement(this.#authority(reservation.id));
  }

  async cancelProcessIdentity(processIdentity: string): Promise<void> {
    const prefix = 'docker:workflow-specialist-';
    if (!processIdentity.startsWith(prefix)) throw new Error('unsupported specialist process');
    const id = processIdentity.slice(prefix.length);
    if (this.#options.store.getSchedulerExecution(id)?.processIdentity !== processIdentity)
      throw new Error('specialist recovery identity changed');
    await this.#boundedSettlement(this.#authority(id));
  }

  async waitForSettlement(reservation: DockerSpecialistReservation): Promise<boolean> {
    const settlement = this.#settlements.get(reservation.id);
    if (settlement === undefined) return this.#settled(reservation.id);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const settled = await Promise.race([
      settlement.then(() => this.#settled(reservation.id)),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), this.#options.cancellationSettleMs ?? 15_000);
      }),
    ]);
    if (timeout !== undefined) clearTimeout(timeout);
    return settled;
  }

  #docker(args: string[], timeout = 10_000, maxBuffer = 64 * 1024) {
    const executor = this.#options.executor ?? defaultExecutor;
    return executor('/usr/local/bin/docker', args, {
      env: {},
      timeout: Math.max(1, timeout),
      maxBuffer,
    });
  }

  #authority(id: string): SchedulerContainerAuthority {
    const execution = this.#options.store.getSchedulerExecution(id);
    if (execution === undefined || execution.ownerId !== this.#options.ownerId)
      throw new Error('specialist execution owner changed');
    return execution;
  }

  #assertAuthority(authority: SchedulerContainerAuthority): void {
    const current = this.#authority(authority.id);
    if (
      current.workspaceLeaseEpoch !== authority.workspaceLeaseEpoch ||
      current.runLeaseEpoch !== authority.runLeaseEpoch ||
      current.taskLeaseEpoch !== authority.taskLeaseEpoch
    )
      throw new Error('specialist execution fence changed');
    const execution = this.#options.store.getSchedulerExecution(authority.id)!;
    for (const [kind, id, epoch] of [
      ['workspace', execution.workspaceId, authority.workspaceLeaseEpoch],
      ['run', execution.runId, authority.runLeaseEpoch],
      ['task', execution.taskId, authority.taskLeaseEpoch],
    ] as const)
      this.#options.store.assertResourceLease(kind, id, authority.ownerId, epoch, this.#clock());
  }

  #state(id: string): SchedulerContainerRecord {
    const state = this.#options.store.getSchedulerContainer(id);
    if (state === undefined) throw new Error('specialist lifecycle is unknown; recovery required');
    return state;
  }

  #advance(
    authority: SchedulerContainerAuthority,
    from: SchedulerContainerRecord['status'],
    to: SchedulerContainerRecord['status'],
    containerId?: string,
  ) {
    return this.#options.store.advanceSchedulerContainer(
      { execution: authority, from, to, containerId },
      workflowContainerJournalCapability,
      this.#clock,
    );
  }

  #settled(id: string): boolean {
    const state = this.#options.store.getSchedulerContainer(id);
    return (
      state !== undefined &&
      (state.status === 'not_dispatched' || state.status === 'removal_confirmed') &&
      this.#options.store.getSchedulerExecution(id)?.credentialStatus === 'revoked'
    );
  }

  #assertCanStart(reservation: DockerSpecialistReservation): void {
    this.#options.store.assertSchedulerAcceptsWork(reservation.id);
    if (this.#cancelled.has(reservation.id))
      throw new Error('specialist launch was cancelled before container start');
    if (this.#clock() >= reservation.deadlineMs)
      throw new Error('specialist reservation timed out');
    const authority = this.#authority(reservation.id);
    const execution = this.#options.store.getSchedulerExecution(reservation.id)!;
    this.#options.store.verifyPlanningDocuments({
      runId: execution.runId,
      taskId: execution.taskId,
      ownerId: authority.ownerId,
      runLeaseEpoch: authority.runLeaseEpoch,
      boundary: 'specialist.lifecycle',
      expectedSourceRoot: this.#options.sourceRoot,
      nowMs: this.#clock(),
    });
  }

  async #inspectOwned(
    state: SchedulerContainerRecord,
    identity: string,
  ): Promise<{ id: string; running: boolean; status: string; exitCode: number } | undefined> {
    let stdout: string;
    try {
      const format =
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "io.agent-platform.specialist-execution")}},"status":{{json .State.Status}},"running":{{json .State.Running}},"exitCode":{{json .State.ExitCode}}}';
      stdout = (await this.#docker(['inspect', '--format', format, identity], 5000)).stdout;
    } catch (error) {
      const failure = error as { code?: unknown; stderr?: unknown };
      if (
        failure.code === 1 &&
        typeof failure.stderr === 'string' &&
        [
          `Error response from daemon: No such container: ${identity}`,
          `Error: No such object: ${identity}`,
          `error: no such object: ${identity}`,
        ].includes(failure.stderr.trim())
      )
        return undefined;
      throw new Error('specialist container inspection failed');
    }
    const observed = JSON.parse(stdout) as Record<string, unknown>;
    if (
      typeof observed.id !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(observed.id) ||
      (state.containerId !== null && observed.id !== state.containerId) ||
      observed.name !== `/${state.name}` ||
      observed.owner !== state.ownerLabel ||
      typeof observed.running !== 'boolean' ||
      typeof observed.status !== 'string' ||
      !Number.isSafeInteger(observed.exitCode) ||
      (observed.exitCode as number) < 0
    )
      throw new Error('specialist container ownership is unconfirmed');
    return observed as { id: string; running: boolean; status: string; exitCode: number };
  }

  async #settle(authority: SchedulerContainerAuthority): Promise<void> {
    return this.#withContainerLock(authority.id, () => this.#settleOwned(authority));
  }

  async #boundedSettlement(authority: SchedulerContainerAuthority): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled([
          this.#settle(authority),
          this.#options.credentialBroker.revoke(authority.id),
        ]).then((results) => {
          const failed = results.find((result) => result.status === 'rejected');
          if (failed?.status === 'rejected') throw failed.reason;
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('specialist settlement wait timed out')),
            this.#options.cancellationSettleMs ?? 15_000,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async #settleOwned(authority: SchedulerContainerAuthority): Promise<void> {
    let state = this.#state(authority.id);
    if (state.status === 'not_dispatched' || state.status === 'removal_confirmed') return;
    const identity = state.containerId ?? state.name;
    const observed = await this.#inspectOwned(state, identity);
    if (state.status === 'create_pending') {
      if (observed === undefined) throw new Error('specialist create remains ambiguous');
      // Positive owned observation reconciles the lost acknowledgement; absence never does.
      state = this.#advance(authority, 'create_pending', 'acknowledged', observed.id);
    }
    if (observed !== undefined) {
      // Security cleanup may proceed with pinned ownership even after a lease expires.
      await this.#docker(['rm', '--force', state.containerId!]).catch(() => undefined);
      if ((await this.#inspectOwned(state, state.containerId!)) !== undefined)
        throw new Error('specialist container removal is unconfirmed');
    }
    this.#advance(authority, 'acknowledged', 'removal_confirmed', state.containerId!);
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
