import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import Database from 'better-sqlite3';
import { DevelopmentHostJournal, type DevelopmentHostState } from './developmentHostJournal.js';
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
  'control_unavailable',
  'control_auth_rejected',
  'broker_generation_changed',
  'provider_unavailable',
  'provider_auth_rejected',
  'journal_unavailable',
  'cleanup_pending',
  'cleanup_exhausted',
  'probe_issue_failed',
  'probe_mount_unavailable',
  'invalid_configuration',
]);
export const classifyDevelopmentError = (error: unknown) =>
  error instanceof z.ZodError
    ? 'invalid_configuration'
    : error instanceof Error && codes.has(error.message)
      ? error.message
      : 'cleanup_pending';
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
  Config?: { Labels?: Record<string, string>; User?: string };
  State?: { Running?: boolean };
  HostConfig?: {
    Privileged?: boolean;
    ReadonlyRootfs?: boolean;
    CapDrop?: string[];
    SecurityOpt?: string[];
    PortBindings?: Record<string, Array<{ HostIp: string; HostPort: string }>>;
  };
  NetworkSettings?: { Networks?: Record<string, unknown> };
  Mounts?: Array<{ Source: string; Destination: string; RW: boolean }>;
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
    if (Number(config.containerUser.split(':')[0]) !== process.getuid?.())
      throw new Error('container_user_mismatch');
    const digest = createHash('sha256').update(JSON.stringify(config)).digest('hex');
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
    const cleanup = this.#runtime?.cleanupStatus();
    this.#observe(
      cleanup === 'pending'
        ? 'cleanup_pending'
        : cleanup === 'exhausted'
          ? 'cleanup_exhausted'
          : 'ready',
    );
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
    await writeFile(join(this.#directory, 'server.json'), JSON.stringify(server), { mode: 0o600 });
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
    const expectedImage = await inspect('image', this.#config.brokerImage);
    if (
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
      if (!expected || expected.Source !== mount.Source || expected.RW !== mount.RW)
        throw new Error('service_identity_mismatch');
    }
  }
  async #topology(allowStopped = false): Promise<void> {
    const container = await inspect('container', this.#prefix);
    if (!container || (!allowStopped && !container.State?.Running))
      throw new Error('service_stopped');
    this.#assertLabels(container.Config?.Labels);
    await this.#definition(container);
    const networks = Object.keys(container.NetworkSettings?.Networks ?? {}).sort();
    if (
      JSON.stringify(networks) !==
      JSON.stringify([`${this.#prefix}-internal`, `${this.#prefix}-outbound`].sort())
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
        const member = await inspect('container', id);
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
            if (
              !db
                .prepare(
                  "SELECT 1 FROM scheduler_executions WHERE id=? AND status='active' AND process_identity=?",
                )
                .get(id, `docker:workflow-specialist-${id}`)
            )
              throw new Error('topology_invalid');
          } finally {
            db.close();
          }
          if (Object.keys(member.NetworkSettings?.Networks ?? {}).length !== 1)
            throw new Error('topology_invalid');
          continue;
        }
        this.#assertLabels(member?.Config?.Labels);
        if (!member?.Name?.startsWith(`/${this.#prefix}-probe-`))
          throw new Error('topology_invalid');
      }
    }
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
    for (const probe of this.#journal.pendingProbes()) {
      await this.#removeProbe(probe.id);
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
      this.#journal.settleProbe(this.#owner, probe.id);
    }
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
      const result = await docker(
        [
          'run',
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
    await this.#topology();
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
  }
  async #attachRuntime(): Promise<void> {
    if (!this.#config.workflow || this.#runtime) return;
    const adapterConfig = join(this.#directory, 'adapter.json');
    await writeFile(
      adapterConfig,
      JSON.stringify({
        database: join(this.#directory, 'broker', 'broker.sqlite'),
        accountFile: this.#config.accountFile,
        controlKeyFile: join(this.#directory, 'control.key'),
        controlPort: this.#config.controlPort,
        gatewayPort: 18102,
      }),
      { mode: 0o600 },
    );
    const adapter = join(this.#directory, `broker-adapter-${this.#owner.epoch}.mjs`);
    await runLocalBrokerCli([adapterConfig, 'create-adapter', '--output', adapter]);
    const supplied = JSON.parse(await privateFile(this.#config.workflow.runtimeConfig)) as Record<
      string,
      unknown
    >;
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
    this.#runtime = await StandalonePhaseRuntime.create(
      this.#config.workflow.database,
      config,
      async () => {
        this.#guard();
        if ((await this.#health()) !== this.#generation)
          throw new Error('broker_generation_changed');
        const state = this.#journal.state()!;
        if (
          !this.#serviceQualified ||
          this.#runtime?.cleanupStatus() !== 'settled' ||
          state.code !== 'ready' ||
          Date.now() - state.observed_at_ms > 5000
        )
          throw new Error('control_unavailable');
      },
      true,
    );
    this.#runtime.start();
  }
  async run(): Promise<void> {
    let shutdownFailure: string | undefined;
    this.#renewTimer = setInterval(() => {
      try {
        this.#journal.renew(this.#owner);
      } catch {
        this.#fatal = true;
        void this.#runtime?.interruptActive('journal_unavailable').catch(() => undefined);
      }
    }, 2000);
    let topologyCheck: Promise<void> | undefined;
    const topologyTimer = setInterval(() => {
      if (topologyCheck || this.#fatal) return;
      try {
        if (!this.#serviceQualified) return;
      } catch {
        this.#fatal = true;
        return;
      }
      topologyCheck = this.#topology()
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
    const stop = () => {
      this.#stopping = true;
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
      while (!this.#stopping && !this.#fatal) {
        const state = this.#journal.state()!;
        if (state.stop_requested) break;
        if (state.recovery_requested !== this.#recovery) {
          this.#serviceQualified = false;
          this.#observe('starting');
          await topologyCheck;
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
      clearInterval(topologyTimer);
      await topologyCheck;
      try {
        await this.#runtime?.interruptActive('service_stopped');
        const cleanupState = this.#runtime?.cleanupStatus();
        await this.#runtime?.close();
        if (cleanupState && cleanupState !== 'settled')
          this.#observe(cleanupState === 'exhausted' ? 'cleanup_exhausted' : 'cleanup_pending');
        if (!this.#fatal) {
          this.#guard();
          await this.#reconcileProbes();
          const owned = this.#verifiedContainerId
            ? await inspect('container', this.#verifiedContainerId)
            : undefined;
          if (owned) {
            this.#assertLabels(owned.Config?.Labels);
            await docker(['stop', '--time', '2', owned.Id]);
          }
          const outcome = this.#journal.state()?.code;
          this.#journal.release(this.#owner);
          if (outcome === 'cleanup_pending' || outcome === 'cleanup_exhausted')
            shutdownFailure = outcome;
        }
      } finally {
        if (this.#renewTimer) clearInterval(this.#renewTimer);
        this.#journal.close();
      }
    }
    if (shutdownFailure) throw new Error(shutdownFailure);
  }
}

export async function runDevelopmentCommand(command: string, path: string): Promise<unknown> {
  const config = developmentHostConfigSchema.parse(JSON.parse(await privateFile(path)));
  if (command === 'development-host') {
    await (await DevelopmentHost.create(config)).run();
    return { code: 'stopped' };
  }
  config.stateDirectory = await realpath(config.stateDirectory);
  config.accountFile = await realpath(config.accountFile);
  const fingerprint = createHash('sha256').update(JSON.stringify(config)).digest('hex');
  const journal = new DevelopmentHostJournal(
    join(config.stateDirectory, 'lifecycle.sqlite'),
    command === 'development-status',
  );
  let restart = false;
  try {
    const state = journal.state();
    if (state && state.config_digest !== fingerprint) throw new Error('service_identity_mismatch');
    if (command === 'development-status') {
      let interruptions: unknown[] = [];
      if (config.workflow) {
        const db = new Database(config.workflow.database, { readonly: true, fileMustExist: true });
        try {
          interruptions = db
            .prepare(
              'SELECT execution_id,run_id,reason,state,cancel,revoke,settle,attempt,batch FROM execution_interruptions',
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
    if (command === 'development-stop') {
      journal.request('stop');
      return { code: 'stop_requested' };
    }
    if (command === 'development-recover') {
      let alive = false;
      if (state?.pid) {
        try {
          process.kill(state.pid, 0);
          alive = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
      }
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
