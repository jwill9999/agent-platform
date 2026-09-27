import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rm, writeFile, rename } from 'node:fs/promises';
import { isAbsolute, join, relative, dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import Database from 'better-sqlite3';
import {
  DevelopmentHostJournal,
  type DevelopmentHostState,
  reconcileDevelopmentProbe,
  assertDevelopmentAdmission,
  developmentOwnerAlive,
} from './developmentHostJournal.js';
import { specialistInputEnvelopeSchema } from './specialistInput.js';
import { specialistRoleProfile } from './specialistRoleProfile.js';
import { SPECIALIST_SECCOMP } from './specialistSeccomp.js';
import { runLocalBrokerCli } from './localCredentialBrokerCli.js';
import { StandalonePhaseRuntime, readPhaseRuntimeConfig } from './phaseRuntime.js';

const execute = promisify(execFile);
const absolute = z.string().refine(isAbsolute);
export const developmentHostConfigSchema = z
  .object({
    stateDirectory: absolute,
    accountFile: absolute,
    brokerImage: z.string().regex(/^(?:[^\s]+@)?sha256:[a-f0-9]{64}$/u),
    workerImage: z.string().regex(/^(?:[^\s]+@)?sha256:[a-f0-9]{64}$/u),
    containerUser: z.string().regex(/^[1-9]\d*:\d+$/u),
    controlPort: z.number().int().min(1024).max(65535),
    clientVersion: z.string().regex(/^[0-9A-Za-z._-]{1,64}$/u),
    workflow: z.object({ database: absolute, runtimeConfig: absolute }).strict().optional(),
  })
  .strict();
type Config = z.infer<typeof developmentHostConfigSchema>;
const LABEL = 'io.agent-platform.development';
const FINGERPRINT = 'io.agent-platform.development-config';
const codes = new Set([
  'starting',
  'ready',
  'stopped',
  'docker_unavailable',
  'image_unavailable',
  'service_stopped',
  'service_identity_mismatch',
  'service_owner_active',
  'service_owner_lost',
  'topology_invalid',
  'topology_stale',
  'control_unavailable',
  'control_auth_rejected',
  'broker_generation_changed',
  'provider_unavailable',
  'provider_auth_rejected',
  'journal_unavailable',
  'cleanup_pending',
  'cleanup_exhausted',
  'reconciliation_required',
  'probe_issue_failed',
  'probe_mount_unavailable',
  'invalid_configuration',
  'process_identity_unavailable',
]);
export function classifyDevelopmentError(error: unknown): string {
  if (error instanceof z.ZodError) return 'invalid_configuration';
  if (
    error instanceof Error &&
    [
      'private_configuration_required',
      'private_state_directory_required',
      'container_user_mismatch',
      'private_control_key_required',
    ].includes(error.message)
  )
    return 'invalid_configuration';
  if (error instanceof Error && codes.has(error.message)) return error.message;
  return 'cleanup_pending';
}
export function developmentExitCode(code: string): number {
  if (code === 'invalid_configuration') return 2;
  if (['cleanup_pending', 'cleanup_exhausted', 'journal_unavailable'].includes(code)) return 4;
  return 3;
}
async function privateFile(path: string): Promise<string> {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    (info.mode & 0o077) !== 0 ||
    info.uid !== process.getuid?.()
  )
    throw new Error('private_configuration_required');
  return readFile(path, 'utf8');
}
async function developmentFingerprint(config: Config, runtime?: string): Promise<string> {
  const runtimeBytes = config.workflow
    ? (runtime ?? (await privateFile(config.workflow.runtimeConfig)))
    : null;
  return createHash('sha256')
    .update(
      JSON.stringify({
        config,
        runtimeDigest:
          runtimeBytes === null ? null : createHash('sha256').update(runtimeBytes).digest('hex'),
      }),
    )
    .digest('hex');
}
async function assertInputOutsideState(stateDirectory: string, file: string): Promise<void> {
  const state = await realpath(stateDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return resolve(stateDirectory);
  });
  const input = await realpath(file);
  const path = relative(state, input);
  if (!path.startsWith('../') && path !== '..' && !isAbsolute(path))
    throw new Error('invalid_configuration');
}
export async function writeDevelopmentFile(path: string, data: string): Promise<void> {
  try {
    const existing = await lstat(path);
    if (
      !existing.isFile() ||
      existing.isSymbolicLink() ||
      existing.nlink !== 1 ||
      existing.uid !== process.getuid?.()
    )
      throw new Error('invalid_configuration');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = join(dirname(path), `.new-${randomBytes(16).toString('hex')}`);
  try {
    await writeFile(temporary, data, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
async function docker(args: string[], timeout = 5000): Promise<string> {
  return (
    await execute('/usr/local/bin/docker', args, { env: {}, timeout, maxBuffer: 1024 * 1024 })
  ).stdout.trim();
}
interface DockerInspection {
  Id: string;
  Image?: string;
  Name?: string;
  Internal?: boolean;
  Labels?: Record<string, string>;
  Containers?: Record<string, unknown>;
  Config?: {
    Labels?: Record<string, string>;
    User?: string;
    Entrypoint?: string[];
    Cmd?: string[];
    Env?: string[];
  };
  State?: { Running?: boolean };
  HostConfig?: {
    Privileged?: boolean;
    CapAdd?: string[] | null;
    Devices?: unknown[];
    DeviceRequests?: unknown[] | null;
    PidMode?: string;
    IpcMode?: string;
    UTSMode?: string;
    UsernsMode?: string;
    GroupAdd?: string[] | null;
    ReadonlyRootfs?: boolean;
    CapDrop?: string[];
    SecurityOpt?: string[];
    PortBindings?: Record<string, Array<{ HostIp: string; HostPort: string }>>;
  };
  NetworkSettings?: { Networks?: Record<string, unknown> };
  Mounts?: Array<{ Source: string; Destination: string; RW: boolean; Type?: string }>;
}
export function assertBrokerHardening(
  host: DockerInspection['HostConfig'],
  security = ['no-new-privileges'],
): void {
  if (
    !host ||
    JSON.stringify(host.CapDrop) !== JSON.stringify(['ALL']) ||
    JSON.stringify(host.SecurityOpt) !== JSON.stringify(security)
  )
    throw new Error('service_identity_mismatch');
  for (const entries of [host.CapAdd, host.Devices, host.DeviceRequests, host.GroupAdd])
    if (entries?.length) throw new Error('service_identity_mismatch');
  for (const mode of [host.PidMode, host.UTSMode, host.UsernsMode])
    if (mode) throw new Error('service_identity_mismatch');
  if (host.IpcMode !== 'private') throw new Error('service_identity_mismatch');
}
/** The whole check has one deadline; heartbeats cannot extend topology freshness. */
export async function checkDevelopmentTopology(
  check: () => Promise<void>,
  timeout = 5000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('topology_stale')), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function assertDevelopmentWorkerPolicy(
  member: DockerInspection,
  root: string,
  packet: { assignedRole: string; allowedOperations: string[] },
): void {
  const profile = specialistRoleProfile(packet.assignedRole, packet.allowedOperations);
  const security = ['no-new-privileges'];
  if (profile.patch || profile.test || profile.artifacts)
    security.push('seccomp=' + JSON.stringify(SPECIALIST_SECCOMP));
  assertBrokerHardening(member.HostConfig, security);
  if (
    member.HostConfig?.Privileged ||
    !member.HostConfig?.ReadonlyRootfs ||
    Object.keys(member.HostConfig?.PortBindings ?? {}).length
  )
    throw new Error('topology_invalid');
  const expected = new Map<string, { source: string; rw: boolean }>([
    ['/workspace', { source: join(root, 'workspace'), rw: profile.patch }],
    ['/scratch', { source: join(root, 'scratch'), rw: profile.test }],
    ['/evidence', { source: join(root, 'evidence'), rw: profile.artifacts }],
    ['/codex-home', { source: join(root, 'codex-home'), rw: true }],
    ['/codex-home/config.toml', { source: join(root, 'codex-home/config.toml'), rw: false }],
    ['/codex-home/auth.json', { source: join(root, 'codex-auth.json'), rw: false }],
    ['/run/specialist/prompt.txt', { source: join(root, 'task-packet.json'), rw: false }],
    ['/run/approved-documents', { source: join(root, 'approved-documents'), rw: false }],
  ]);
  for (const mount of member.Mounts ?? []) {
    if (mount.Type === 'tmpfs' && mount.Destination === '/tmp') continue;
    const match = expected.get(mount.Destination);
    if (!match || mount.Type !== 'bind' || match.source !== mount.Source || match.rw !== mount.RW)
      throw new Error('topology_invalid');
    expected.delete(mount.Destination);
  }
  if (expected.size) throw new Error('topology_invalid');
}
async function inspect(
  kind: 'container' | 'network' | 'image',
  name: string,
): Promise<DockerInspection | undefined> {
  try {
    return (JSON.parse(await docker([kind, 'inspect', name])) as DockerInspection[])[0];
  } catch (error) {
    const e = error as { code?: number; stderr?: string };
    if (
      e.code === 1 &&
      e.stderr &&
      /No such (?:object|container|network|image)|network .* not found/iu.test(e.stderr)
    )
      return undefined;
    throw new Error('docker_unavailable');
  }
}
const probeProgram = `
const fs=require('node:fs');
const token=JSON.parse(fs.readFileSync('/probe/token.json','utf8')).token;
fetch('http://development-gateway:18102/models?client_version='+process.argv[1],{
 headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(5000),redirect:'error'
}).then(async r=>{let valid=false;if(r.ok){const reader=r.body.getReader();let n=0,parts=[];
while(true){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>1048576){await reader.cancel();throw Error('large');}parts.push(Buffer.from(x.value));}
valid=Array.isArray(JSON.parse(Buffer.concat(parts).toString()).models);}
process.stdout.write(JSON.stringify({status:r.status,valid}));}).catch(()=>{process.stdout.write(JSON.stringify({status:0,valid:false}));process.exitCode=1;});`;

/** Foreground, trusted development service owner. It never creates or approves a workflow. */
export class DevelopmentHost {
  readonly #config: Config;
  readonly #journal: DevelopmentHostJournal;
  readonly #owner: DevelopmentHostState;
  readonly #prefix: string;
  readonly #key: string;
  readonly #directory: string;
  #generation: string | undefined;
  #verifiedContainerId: string | undefined;
  #runtime: StandalonePhaseRuntime | undefined;
  #renewTimer: ReturnType<typeof setInterval> | undefined;
  #fatal = false;
  #serviceQualified = false;
  #topologyObservedAt = 0;
  #runId: string | undefined;
  #stopping = false;
  #recovery: number;
  #recoverOnStart = false;
  private constructor(
    config: Config,
    journal: DevelopmentHostJournal,
    owner: DevelopmentHostState,
    key: string,
  ) {
    this.#config = config;
    this.#journal = journal;
    this.#owner = owner;
    this.#key = key;
    this.#directory = config.stateDirectory;
    this.#prefix = `ap-dev-${owner.service_id}`;
    this.#recovery = owner.recovery_requested;
  }
  static async create(input: unknown, recover = false): Promise<DevelopmentHost> {
    const config = developmentHostConfigSchema.parse(input);
    await privateFile(config.accountFile);
    await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 });
    const info = await lstat(config.stateDirectory);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (info.mode & 0o077) !== 0 ||
      info.uid !== process.getuid?.()
    )
      throw new Error('private_state_directory_required');
    config.stateDirectory = await realpath(config.stateDirectory);
    config.accountFile = await realpath(config.accountFile);
    await assertInputOutsideState(config.stateDirectory, config.accountFile);
    if (config.workflow) {
      await assertInputOutsideState(config.stateDirectory, config.workflow.runtimeConfig);
      await assertInputOutsideState(config.stateDirectory, config.workflow.database);
    }
    if (Number(config.containerUser.split(':')[0]) !== process.getuid?.())
      throw new Error('container_user_mismatch');
    const digest = await developmentFingerprint(config);
    const journal = new DevelopmentHostJournal(join(config.stateDirectory, 'lifecycle.sqlite'));
    try {
      const owner = journal.claim(digest);
      const keyPath = join(config.stateDirectory, 'control.key');
      try {
        await writeFile(keyPath, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      const key = (await privateFile(keyPath)).trim();
      if (!/^[a-f0-9]{64}$/u.test(key)) throw new Error('private_control_key_required');
      const host = new DevelopmentHost(config, journal, owner, key);
      host.#recoverOnStart = recover;
      return host;
    } catch (error) {
      journal.close();
      throw error;
    }
  }
  #guard(): void {
    if (this.#fatal) throw new Error('journal_unavailable');
    this.#journal.assertOwner(this.#owner);
  }
  #observe(code: string): void {
    this.#guard();
    const previous = this.#journal.state()?.code;
    this.#journal.observe(this.#owner, code);
    if (previous === code) return;
    process.stdout.write(
      JSON.stringify({
        serviceId: this.#owner.service_id,
        code,
        observedAtMs: Date.now(),
        recoveryAction:
          code === 'ready'
            ? 'use approved runtime only'
            : 'inspect development-status; use development-recover after resolving the reported cause',
      }) + '\n',
    );
  }
  #publishReadiness(): void {
    if (this.#stopping || this.#journal.state()?.stop_requested) {
      this.#serviceQualified = false;
      this.#observe('service_stopped');
      return;
    }
    if (Date.now() - this.#topologyObservedAt > 5000) {
      this.#observe('topology_stale');
      return;
    }
    const cleanup = this.#runtime?.cleanupStatus();
    if (cleanup === 'pending') {
      this.#observe('cleanup_pending');
      return;
    }
    if (cleanup === 'exhausted') {
      this.#observe('cleanup_exhausted');
      return;
    }
    if (cleanup === 'reconciliation_required' || cleanup === 'journal_unavailable') {
      this.#observe(cleanup);
      return;
    }
    this.#observe('ready');
  }

  async #control(body: unknown, timeout = 3000): Promise<Record<string, unknown>> {
    this.#guard();
    let response: Response;
    try {
      response = await fetch(`http://127.0.0.1:${this.#config.controlPort}/control`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.#key}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
        redirect: 'error',
      });
    } catch {
      throw new Error('control_unavailable');
    }
    if (response.status === 403) throw new Error('control_auth_rejected');
    if (!response.ok) throw new Error('control_unavailable');
    return z.record(z.unknown()).parse(await response.json());
  }
  async #health(): Promise<string> {
    const result = z
      .object({ protocol: z.literal('broker-health-v1'), generation: z.string().uuid() })
      .strict()
      .parse(await this.#control({ operation: 'health' }));
    return result.generation;
  }
  #assertLabels(labels: Record<string, string> | undefined): void {
    if (
      labels?.[LABEL] !== this.#owner.service_id ||
      labels?.[FINGERPRINT] !== this.#owner.config_digest
    )
      throw new Error('service_identity_mismatch');
  }
  #labels(): string[] {
    return [
      '--label',
      `${LABEL}=${this.#owner.service_id}`,
      '--label',
      `${FINGERPRINT}=${this.#owner.config_digest}`,
    ];
  }
  async #network(suffix: string, internal: boolean): Promise<void> {
    const name = `${this.#prefix}-${suffix}`;
    let network = await inspect('network', name);
    if (!network) {
      this.#guard();
      await docker([
        'network',
        'create',
        ...this.#labels(),
        ...(internal ? ['--internal'] : []),
        name,
      ]);
      network = await inspect('network', name);
    }
    this.#assertLabels(network?.Labels);
    if (network?.Internal !== internal) throw new Error('topology_invalid');
  }
  async #provision(): Promise<void> {
    try {
      await docker(['info', '--format', '{{.ServerVersion}}']);
    } catch {
      throw new Error('docker_unavailable');
    }
    for (const image of [this.#config.brokerImage, this.#config.workerImage])
      if (!(await inspect('image', image))) throw new Error('image_unavailable');
    await this.#network('internal', true);
    await this.#network('outbound', false);
    const brokerDirectory = join(this.#directory, 'broker');
    await mkdir(brokerDirectory, { mode: 0o700, recursive: true });
    const brokerInfo = await lstat(brokerDirectory);
    if (!brokerInfo.isDirectory() || brokerInfo.isSymbolicLink() || (brokerInfo.mode & 0o077) !== 0)
      throw new Error('private_state_directory_required');
    const server = {
      database: '/state/broker.sqlite',
      accountFile: '/run/account.json',
      controlKeyFile: '/run/control.key',
      controlPort: 18101,
      gatewayPort: 18102,
      listenHost: '0.0.0.0',
    };
    await writeDevelopmentFile(join(this.#directory, 'server.json'), JSON.stringify(server));
    let container = await inspect('container', this.#prefix);
    if (!container) {
      this.#guard();
      await docker([
        'create',
        '--name',
        this.#prefix,
        ...this.#labels(),
        '--network',
        `${this.#prefix}-outbound`,
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--user',
        this.#config.containerUser,
        '--publish',
        `127.0.0.1:${this.#config.controlPort}:18101`,
        '--mount',
        `type=bind,src=${brokerDirectory},dst=/state`,
        '--mount',
        `type=bind,src=${this.#config.accountFile},dst=/run/account.json,readonly`,
        '--mount',
        `type=bind,src=${join(this.#directory, 'control.key')},dst=/run/control.key,readonly`,
        '--mount',
        `type=bind,src=${join(this.#directory, 'server.json')},dst=/run/server.json,readonly`,
        this.#config.brokerImage,
        '/run/server.json',
        'serve',
      ]);
      container = await inspect('container', this.#prefix);
    }
    this.#assertLabels(container?.Config?.Labels);
    await this.#definition(container!);
    const networks = Object.keys(container?.NetworkSettings?.Networks ?? {});
    if (
      networks.some(
        (name) => ![`${this.#prefix}-internal`, `${this.#prefix}-outbound`].includes(name),
      )
    )
      throw new Error('topology_invalid');

    if (!container?.NetworkSettings?.Networks?.[`${this.#prefix}-internal`]) {
      this.#guard();
      await docker([
        'network',
        'connect',
        '--alias',
        'development-gateway',
        `${this.#prefix}-internal`,
        this.#prefix,
      ]);
    }
    await this.#topology(true);
    this.#verifiedContainerId = container!.Id;
    if (!container?.State?.Running) {
      this.#guard();
      await docker(['start', this.#prefix]);
    }
    for (let i = 0; i < 10; i++) {
      try {
        this.#generation = await this.#health();
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw new Error('control_unavailable');
  }
  async #definition(container: DockerInspection): Promise<void> {
    assertBrokerHardening(container.HostConfig);
    const expectedImage = await inspect('image', this.#config.brokerImage);
    if (
      JSON.stringify(container.Config?.Entrypoint) !==
        JSON.stringify(expectedImage?.Config?.Entrypoint) ||
      JSON.stringify(container.Config?.Cmd) !== JSON.stringify(['/run/server.json', 'serve']) ||
      JSON.stringify(container.Config?.Env) !== JSON.stringify(expectedImage?.Config?.Env) ||
      container.Image !== expectedImage?.Id ||
      container.Config?.User !== this.#config.containerUser ||
      container.HostConfig?.Privileged ||
      !container.HostConfig?.ReadonlyRootfs ||
      !container.HostConfig?.CapDrop?.includes('ALL') ||
      !container.HostConfig?.SecurityOpt?.includes('no-new-privileges')
    )
      throw new Error('service_identity_mismatch');
    const ports = container.HostConfig?.PortBindings ?? {};
    if (
      Object.keys(ports ?? {}).length !== 1 ||
      ports['18101/tcp']?.length !== 1 ||
      ports['18101/tcp'][0]?.HostIp !== '127.0.0.1' ||
      ports['18101/tcp'][0]?.HostPort !== String(this.#config.controlPort)
    )
      throw new Error('topology_invalid');

    const expectedMounts = new Map([
      ['/state', { Source: join(this.#directory, 'broker'), RW: true }],
      ['/run/account.json', { Source: this.#config.accountFile, RW: false }],
      ['/run/control.key', { Source: join(this.#directory, 'control.key'), RW: false }],
      ['/run/server.json', { Source: join(this.#directory, 'server.json'), RW: false }],
    ]);
    if (container.Mounts?.length !== expectedMounts.size)
      throw new Error('service_identity_mismatch');
    for (const mount of container.Mounts) {
      const expected = expectedMounts.get(mount.Destination);
      if (expected?.Source !== mount.Source || expected.RW !== mount.RW)
        throw new Error('service_identity_mismatch');
    }
  }
  async #topology(allowStopped = false): Promise<void> {
    const container = await inspect('container', this.#prefix);
    if (!container || (!allowStopped && !container.State?.Running))
      throw new Error('service_stopped');
    this.#assertLabels(container.Config?.Labels);
    await this.#definition(container);
    const networks = Object.keys(container.NetworkSettings?.Networks ?? {}).sort((a, b) =>
      a.localeCompare(b),
    );
    if (
      JSON.stringify(networks) !==
      JSON.stringify(
        [`${this.#prefix}-internal`, `${this.#prefix}-outbound`].sort((a, b) => a.localeCompare(b)),
      )
    )
      throw new Error('topology_invalid');
    for (const [suffix, internal] of [
      ['internal', true],
      ['outbound', false],
    ] as const) {
      const network = await inspect('network', `${this.#prefix}-${suffix}`);
      this.#assertLabels(network?.Labels);
      if (network?.Internal !== internal) throw new Error('topology_invalid');
      for (const id of Object.keys(network?.Containers ?? {})) {
        if (id === container.Id) continue;
        await this.#validateMember(id, suffix);
      }
    }
  }
  async #validateMember(id: string, suffix: string): Promise<void> {
    const member = await inspect('container', id);
    if (!member) return; // Docker network snapshots can retain a just-removed endpoint.
    if (
      member?.Config?.Labels?.['io.agent-platform.specialist-execution'] &&
      this.#config.workflow &&
      suffix === 'internal'
    ) {
      const id = member.Config.Labels['io.agent-platform.specialist-execution'];
      const db = new Database(this.#config.workflow.database, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        const record = db
          .prepare(
            "SELECT c.status,c.container_id,s.root,e.packet_json FROM scheduler_executions e JOIN scheduler_containers c ON c.execution_id=e.id JOIN scheduler_staging s ON s.execution_id=e.id WHERE e.id=? AND e.run_id=? AND e.status='active' AND e.process_identity=?",
          )
          .get(id, this.#runId, `docker:workflow-specialist-${id}`) as
          | { status: string; container_id: string | null; root: string; packet_json: string }
          | undefined;
        if (!record || member.Name !== `/workflow-specialist-${id}`)
          throw new Error('topology_invalid');
        if (record.status !== 'acknowledged' || record.container_id !== member.Id)
          throw new Error('topology_invalid');
        await this.#workerDefinition(member, record.root, record.packet_json);
      } finally {
        db.close();
      }

      return;
    }
    this.#assertLabels(member?.Config?.Labels);
    if (
      suffix !== 'internal' ||
      Object.keys(member?.NetworkSettings?.Networks ?? {}).length !== 1 ||
      !this.#journal.hasProbeContainer(member?.Id ?? '')
    )
      throw new Error('topology_invalid');
    if (
      !member?.Name?.startsWith(`/${this.#prefix}-probe-`) ||
      member.Image !== (await inspect('image', this.#config.brokerImage))?.Id ||
      member.Config?.User !== this.#config.containerUser ||
      member.HostConfig?.Privileged ||
      !member.HostConfig?.ReadonlyRootfs
    )
      throw new Error('topology_invalid');
  }
  async #workerDefinition(member: DockerInspection, root: string, packet: string): Promise<void> {
    const input = specialistInputEnvelopeSchema.parse(JSON.parse(packet)).task;
    assertDevelopmentWorkerPolicy(member, root, input);
    if (
      Object.keys(member.NetworkSettings?.Networks ?? {}).length !== 1 ||
      member.Image !== (await inspect('image', this.#config.workerImage))?.Id ||
      member.Config?.User !== this.#config.containerUser
    )
      throw new Error('topology_invalid');
  }
  async #removeProbe(id: string, removeToken = true): Promise<void> {
    const name = `${this.#prefix}-probe-${id}`;
    const container = await inspect('container', name);
    if (container) {
      this.#assertLabels(container.Config?.Labels);
      this.#guard();
      await docker(['rm', '--force', container.Id]);
      if (await inspect('container', container.Id)) throw new Error('cleanup_pending');
    }
    if (removeToken)
      await rm(join(this.#directory, `probe-${id}`), { force: true, recursive: true });
  }
  async #reconcileProbes(): Promise<void> {
    let failed = false;
    for (const probe of this.#journal.pendingProbes()) {
      try {
        await reconcileDevelopmentProbe(
          this.#journal,
          this.#owner,
          probe.id,
          () => this.#removeProbe(probe.id),
          () => this.#revokeProbe(probe),
        );
      } catch {
        failed = true;
      }
    }
    if (failed) throw new Error('cleanup_pending');
  }
  async #revokeProbe(probe: { id: string; generation: string }): Promise<void> {
    await this.#control({
      operation: 'revoke',
      leaseId: `probe:${probe.id}`,
      generation: probe.generation,
    });
    const status = await this.#control({
      operation: 'probe-status',
      requestId: probe.id,
      generation: probe.generation,
    });
    if (status.status !== 'revoked') throw new Error('cleanup_pending');
  }
  async #probe(id: string, token: string): Promise<{ status: number; valid: boolean }> {
    const directory = join(this.#directory, `probe-${id}`);
    await mkdir(directory, { mode: 0o700, recursive: true });
    const file = join(directory, 'token.json');
    try {
      await writeFile(file, JSON.stringify({ token }), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'EEXIST' ||
        (await privateFile(file)) !== JSON.stringify({ token })
      )
        throw new Error('probe_mount_unavailable');
    }
    this.#guard();
    try {
      await docker(
        [
          'create',
          '--name',
          `${this.#prefix}-probe-${id}`,
          ...this.#labels(),
          '--network',
          `${this.#prefix}-internal`,
          '--read-only',
          '--cap-drop',
          'ALL',
          '--security-opt',
          'no-new-privileges',
          '--user',
          this.#config.containerUser,
          '--mount',
          `type=bind,src=${directory},dst=/probe,readonly`,
          '--entrypoint',
          'node',
          this.#config.brokerImage,
          '-e',
          probeProgram,
          this.#config.clientVersion,
        ],
        7000,
      );
      const container = await inspect('container', `${this.#prefix}-probe-${id}`);
      if (!container) throw new Error('cleanup_pending');
      this.#journal.bindProbeContainer(this.#owner, id, container.Id);
      const result = await docker(['start', '--attach', container.Id], 7000);
      return z
        .object({ status: z.number().int(), valid: z.boolean() })
        .strict()
        .parse(JSON.parse(result));
    } catch {
      throw new Error('provider_unavailable');
    } finally {
      await this.#removeProbe(id, false);
    }
  }
  async #qualify(): Promise<void> {
    await this.#checkedTopology();
    await this.#reconcileProbes();
    const conformance = await this.#control({ operation: 'conformance' });
    if (conformance.passed !== true || conformance.generation !== this.#generation)
      throw new Error('control_unavailable');
    const generation = this.#generation!;
    const id = this.#journal.probeIntent(this.#owner, generation);
    try {
      const issued = z
        .object({
          token: z.string().regex(/^[a-f0-9]{64}$/u),
          leaseId: z.string(),
          generation: z.string(),
        })
        .strict()
        .parse(await this.#control({ operation: 'probe-issue', requestId: id, generation }));
      if (issued.leaseId !== `probe:${id}` || issued.generation !== generation)
        throw new Error('control_unavailable');
      const success = await this.#probe(id, issued.token);
      if (!success.valid || success.status !== 200)
        throw new Error(
          [401, 403].includes(success.status) ? 'provider_auth_rejected' : 'provider_unavailable',
        );
      await this.#control({ operation: 'revoke', leaseId: issued.leaseId, generation });
      const denied = await this.#probe(id, issued.token);
      if (denied.status !== 403) throw new Error('cleanup_pending');
    } finally {
      await this.#reconcileProbes();
    }
    await this.#checkedTopology();
  }
  async #attachRuntime(): Promise<void> {
    if (!this.#config.workflow || this.#runtime) return;
    const runtimeBytes = await privateFile(this.#config.workflow.runtimeConfig);
    if ((await developmentFingerprint(this.#config, runtimeBytes)) !== this.#owner.config_digest)
      throw new Error('service_identity_mismatch');
    const supplied = JSON.parse(runtimeBytes) as Record<string, unknown>;
    const adapterConfig = join(this.#directory, 'adapter.json');
    await writeDevelopmentFile(
      adapterConfig,
      JSON.stringify({
        database: join(this.#directory, 'broker', 'broker.sqlite'),
        accountFile: this.#config.accountFile,
        controlKeyFile: join(this.#directory, 'control.key'),
        controlPort: this.#config.controlPort,
        gatewayPort: 18102,
      }),
    );
    const adapter = join(this.#directory, `broker-adapter-${this.#owner.epoch}.mjs`);
    await runLocalBrokerCli([adapterConfig, 'create-adapter', '--output', adapter]);
    // Runtime authority remains in the approved journal; these transport settings belong to this owner.
    for (const key of ['credentialBrokerBinary', 'egressNetwork'])
      if (key in supplied) throw new Error('invalid_configuration');
    const config = readPhaseRuntimeConfig({
      ...supplied,
      credentialBrokerBinary: adapter,
      egressNetwork: `${this.#prefix}-internal`,
    });
    if (
      config.image !== this.#config.workerImage ||
      config.containerUser !== this.#config.containerUser
    )
      throw new Error('service_identity_mismatch');
    if (
      config.egressNetwork !== `${this.#prefix}-internal` ||
      !config.modelGateway ||
      new URL(config.modelGateway.url).origin !== `http://development-gateway:18102`
    )
      throw new Error('topology_invalid');
    this.#runId = config.runId;
    this.#runtime = await StandalonePhaseRuntime.create(
      this.#config.workflow.database,
      config,
      async () => {
        this.#guard();
        if ((await this.#health()) !== this.#generation)
          throw new Error('broker_generation_changed');
        this.#assertAdmission();
      },
      true,
      () => {
        this.#serviceQualified = false;
        try {
          this.#observe('journal_unavailable');
        } catch {
          this.#fatal = true;
        }
      },
      () => this.#assertAdmission(),
    );
    this.#runtime.start();
  }
  #assertAdmission(): void {
    this.#guard();
    assertDevelopmentAdmission(
      this.#journal.state()!,
      this.#stopping,
      this.#serviceQualified,
      this.#runtime?.cleanupStatus() ?? 'pending',
      Date.now(),
      this.#topologyObservedAt,
    );
  }
  async #monitor(topology: () => Promise<void> | undefined): Promise<void> {
    while (!this.#stopping && !this.#fatal) {
      const state = this.#journal.state()!;
      if (state.stop_requested) break;
      if (state.recovery_requested !== this.#recovery) {
        this.#serviceQualified = false;
        this.#observe('starting');
        await topology();
        this.#observe('starting');
        this.#recovery = state.recovery_requested;
        this.#runtime?.requestCleanupRecovery();
        try {
          await this.#provision();
          await this.#qualify();
          this.#serviceQualified = true;
          this.#publishReadiness();
        } catch (error) {
          this.#observe(classifyDevelopmentError(error));
        }
      }
      try {
        if ((await this.#health()) !== this.#generation)
          throw new Error('broker_generation_changed');
        if (this.#serviceQualified) this.#publishReadiness();
      } catch (error) {
        const code = classifyDevelopmentError(error);
        this.#serviceQualified = false;
        this.#observe(code);
        await this.#runtime?.interruptActive(code);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  async #shutdown(): Promise<string | undefined> {
    this.#stopping = true;
    this.#serviceQualified = false;
    const results = await Promise.allSettled([this.#runtime?.close(), this.#reconcileProbes()]);
    let outcome = results.some((result) => result.status === 'rejected')
      ? 'cleanup_pending'
      : undefined;
    if (!this.#fatal) {
      this.#guard();
      const owned = this.#verifiedContainerId
        ? await inspect('container', this.#verifiedContainerId)
        : undefined;
      if (owned) {
        this.#assertLabels(owned.Config?.Labels);
        await docker(['stop', '--time', '2', owned.Id]);
      }
      outcome = this.#cleanupOutcome() ?? outcome;
      outcome ??= this.#journal.state()?.code;
      if (outcome === 'cleanup_pending' || outcome === 'cleanup_exhausted') this.#observe(outcome);
      this.#journal.release(this.#owner);
      if (outcome === 'cleanup_pending' || outcome === 'cleanup_exhausted') return outcome;
    }
    return undefined;
  }
  #cleanupOutcome(): string | undefined {
    if (!this.#config.workflow) return undefined;
    const status = developmentStatus(this.#config, this.#journal.state()) as {
      interruptions: Array<{ state: string }>;
    };
    if (status.interruptions.some((row) => row.state === 'exhausted')) return 'cleanup_exhausted';
    if (status.interruptions.some((row) => row.state === 'pending')) return 'cleanup_pending';
    return undefined;
  }
  #startRenewal(): void {
    this.#renewTimer = setInterval(() => {
      try {
        this.#journal.renew(this.#owner);
      } catch {
        this.#fatal = true;
        void this.#runtime?.interruptActive('journal_unavailable').catch(() => undefined);
      }
    }, 2000);
  }
  async #checkedTopology(): Promise<void> {
    const started = Date.now();
    await checkDevelopmentTopology(() => this.#topology());
    this.#topologyObservedAt = started;
  }
  #startTopologyMonitor() {
    let topologyCheck: Promise<void> | undefined;
    const topologyTimer = setInterval(() => {
      if (topologyCheck || this.#fatal) return;
      if (!this.#serviceQualified) return;
      topologyCheck = this.#checkedTopology()
        .catch(async (error: unknown) => {
          const code = classifyDevelopmentError(error);
          this.#serviceQualified = false;
          this.#observe(code);
          await this.#runtime?.interruptActive(code);
        })
        .catch(() => {
          this.#fatal = true;
        })
        .finally(() => {
          topologyCheck = undefined;
        });
    }, 2000);
    return {
      pending: () => topologyCheck,
      stop: async () => {
        clearInterval(topologyTimer);
        await topologyCheck;
      },
    };
  }
  async run(): Promise<void> {
    let shutdownFailure: string | undefined;
    this.#startRenewal();
    const topology = this.#startTopologyMonitor();
    const stop = () => {
      this.#stopping = true;
      this.#serviceQualified = false;
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    try {
      await this.#attachRuntime();
      if (this.#recoverOnStart) this.#runtime?.requestCleanupRecovery();
      await this.#provision();
      await this.#qualify();
      this.#serviceQualified = true;
      this.#publishReadiness();
      await this.#monitor(topology.pending);
      if (this.#fatal) throw new Error('journal_unavailable');
    } catch (error) {
      try {
        this.#observe(classifyDevelopmentError(error));
      } catch {
        /* Durable reporting is unavailable; CLI still returns a redacted failure. */
      }
      throw new Error(classifyDevelopmentError(error));
    } finally {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      await topology.stop();
      try {
        shutdownFailure = await this.#shutdown();
      } finally {
        if (this.#renewTimer) clearInterval(this.#renewTimer);
        this.#journal.close();
      }
    }
    if (shutdownFailure) throw new Error(shutdownFailure);
  }
}

function developmentStatus(config: Config, state: DevelopmentHostState | undefined): unknown {
  let interruptions: unknown[] = [];
  if (config.workflow) {
    const db = new Database(config.workflow.database, { readonly: true, fileMustExist: true });
    try {
      interruptions = db
        .prepare(
          'SELECT execution_id,run_id,reason,state,cancel,revoke,settle,effects,attempt,batch FROM execution_interruptions',
        )
        .all();
    } finally {
      db.close();
    }
  }
  return {
    service: state,
    effectiveCode:
      state?.code === 'ready' && state.lease_until_ms <= Date.now()
        ? 'service_owner_lost'
        : state?.code,
    interruptions,
  };
}

export async function runDevelopmentCommand(command: string, path: string): Promise<unknown> {
  const config = developmentHostConfigSchema.parse(JSON.parse(await privateFile(path)));
  await assertInputOutsideState(config.stateDirectory, path);
  if (command === 'development-host') {
    await (await DevelopmentHost.create(config)).run();
    return { code: 'stopped' };
  }
  config.stateDirectory = await realpath(config.stateDirectory);
  config.accountFile = await realpath(config.accountFile);
  const fingerprint = await developmentFingerprint(config);
  const journal = new DevelopmentHostJournal(
    join(config.stateDirectory, 'lifecycle.sqlite'),
    command === 'development-status',
  );
  let restart = false;
  try {
    const state = journal.state();
    if (state && state.config_digest !== fingerprint) throw new Error('service_identity_mismatch');
    if (command === 'development-status') return developmentStatus(config, state);
    if (command === 'development-stop') {
      journal.request('stop');
      return { code: 'stop_requested' };
    }
    if (command === 'development-recover') {
      const alive = developmentOwnerAlive(state);
      if (alive) {
        journal.request('recover');
        return { code: 'recovery_requested' };
      }
      restart = true;
    } else throw new Error('unknown_development_command');
  } finally {
    journal.close();
  }
  if (restart) {
    await (await DevelopmentHost.create(config, true)).run();
    return { code: 'stopped' };
  }
  return undefined;
}
