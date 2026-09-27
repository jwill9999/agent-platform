import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, rename, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
const execute = promisify(execFile);
const supplied = process.env.WORKFLOW_DEVELOPMENT_CONFIG;
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
async function until<T>(
  read: () => Promise<T>,
  matches: (value: T) => boolean,
  timeout = 30000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (true) {
    const value = await read();
    if (matches(value)) return value;
    if (Date.now() >= deadline) throw new Error('condition_timeout');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
it.skipIf(!supplied)(
  'qualifies real CLI startup, ownership, broker loss, explicit recovery and idempotent restart',
  async () => {
    const root = await mkdtemp(join(homedir(), '.codex/lifecycle-integration-'));
    const config = {
      ...JSON.parse(await readFile(supplied!, 'utf8')),
      stateDirectory: join(root, 'state'),
    };
    delete config.workflow;
    const path = join(root, 'config.json');
    await writeFile(path, JSON.stringify(config), { mode: 0o600 });
    let child: ChildProcess | undefined, serviceId: string | undefined;
    const output: string[] = [];
    const start = () => {
      child = spawn(process.execPath, [cli, 'development-host', path], {
        env: {},
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout!.on('data', (b) => output.push(String(b)));
      child.stderr!.on('data', (b) => output.push(String(b)));
    };
    const command = (name: string, p = path) =>
      execute(process.execPath, [cli, name, p], { env: {}, timeout: 45000 });
    const status = async () => {
      try {
        return JSON.parse((await command('development-status')).stdout);
      } catch {
        return { effectiveCode: 'not_started' };
      }
    };
    try {
      start();
      const ready = await until(status, (s) => s.effectiveCode === 'ready');
      serviceId = ready.service.service_id;
      const stateDb = new Database(join(root, 'state/lifecycle.sqlite'), { readonly: true });
      const firstProbe = stateDb
        .prepare('SELECT generation FROM development_probes LIMIT 1')
        .get() as { generation: string };
      expect(
        (
          stateDb
            .prepare("SELECT COUNT(*) AS count FROM development_probes WHERE state='pending'")
            .get() as { count: number }
        ).count,
      ).toBe(0);
      stateDb.close();
      await expect(command('development-host')).rejects.toMatchObject({ code: 3 });
      const wrong = join(root, 'wrong.json');
      await writeFile(wrong, JSON.stringify({ ...config, clientVersion: 'different' }), {
        mode: 0o600,
      });
      await expect(command('development-stop', wrong)).rejects.toMatchObject({ code: 3 });
      const failedAt = Date.now();
      await execute('/usr/local/bin/docker', ['stop', '--time', '1', `ap-dev-${serviceId}`], {
        timeout: 5000,
      });
      const failed = await until(status, (s) => s.effectiveCode !== 'ready', 6000);
      expect(['control_unavailable', 'service_stopped']).toContain(failed.effectiveCode);
      expect(Date.now() - failedAt).toBeLessThan(6000);
      await command('development-recover');
      await until(status, (s) => s.effectiveCode === 'ready');
      const recoveredDb = new Database(join(root, 'state/lifecycle.sqlite'), { readonly: true });
      const generations = recoveredDb
        .prepare('SELECT DISTINCT generation FROM development_probes')
        .all() as Array<{ generation: string }>;
      expect(generations.some((p) => p.generation !== firstProbe.generation)).toBe(true);
      recoveredDb.close();
      await command('development-stop');
      await until(status, (s) => s.service?.pid === null);
      start();
      const restarted = await until(status, (s) => s.effectiveCode === 'ready');
      expect(restarted.service.service_id).toBe(serviceId);
      await command('development-stop');
      await until(status, (s) => s.service?.pid === null);
      expect(output.join('')).not.toMatch(/Bearer |OPENAI_API_KEY|access_token/);
    } finally {
      child?.kill('SIGTERM');
      if (child && child.exitCode === null)
        await new Promise((resolve) => setTimeout(resolve, 2500));
      if (serviceId) {
        await execute('/usr/local/bin/docker', ['rm', '--force', `ap-dev-${serviceId}`]).catch(
          () => undefined,
        );
        for (const suffix of ['internal', 'outbound'])
          await execute('/usr/local/bin/docker', [
            'network',
            'rm',
            `ap-dev-${serviceId}-${suffix}`,
          ]).catch(() => undefined);
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  120000,
);

it
  .skipIf(!supplied || !process.env.WORKFLOW_DEVELOPMENT_WORKER_IMAGE)
  .each(['live', 'restart', 'restart-missing-source', 'replaced-staging', 'delayed-ack'])(
  'interrupts a real fixture worker and reconciles without repeating its recorded effect (%s)',
  async (mode) => {
    const { developmentWorkflowFixture } = await import('./developmentWorkflowFixture.js');
    const f = await developmentWorkflowFixture();
    const root = await mkdtemp(join(homedir(), '.codex/lifecycle-connected-'));
    const config = {
      ...JSON.parse(await readFile(supplied!, 'utf8')),
      stateDirectory: join(root, 'state'),
      workerImage: process.env.WORKFLOW_DEVELOPMENT_WORKER_IMAGE,
      workflow: { database: f.database, runtimeConfig: join(root, 'runtime.json') },
    };
    await writeFile(
      config.workflow.runtimeConfig,
      JSON.stringify({
        runId: 'run',
        sourceRoot: join(f.root, 'source'),
        gitBinary: process.env.WORKFLOW_GIT_BINARY,
        image: config.workerImage,
        containerUser: config.containerUser,
        modelGateway: { url: 'http://development-gateway:18102', model: 'fixture-no-model-call' },
        leaseTtlMs: 5000,
      }),
      { mode: 0o600 },
    );
    const path = join(root, 'config.json');
    await writeFile(path, JSON.stringify(config), { mode: 0o600 });
    let child = spawn(process.execPath, [cli, 'development-host', path], {
      env: { WORKFLOW_GIT_BINARY: process.env.WORKFLOW_GIT_BINARY },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log: string[] = [];
    child.stdout!.on('data', (b) => log.push(String(b)));
    child.stderr!.on('data', (b) => log.push(String(b)));
    const db = new Database(f.database);
    let serviceId: string | undefined, executionId: string | undefined, staging: string | undefined;
    const command = (name: string) =>
      execute(process.execPath, [cli, name, path], { env: {}, timeout: 10000 });
    const status = async () => {
      try {
        return JSON.parse((await command('development-status')).stdout);
      } catch {
        return { effectiveCode: 'not_started' };
      }
    };
    try {
      const ready = await until(status, (s) => s.effectiveCode === 'ready');
      serviceId = ready.service.service_id;
      const staged = await until(
        async () =>
          db.prepare('SELECT execution_id,root FROM scheduler_staging LIMIT 1').get() as
            | { execution_id: string; root: string }
            | undefined,
        (s) => !!s,
      );
      executionId = staged!.execution_id;
      staging = staged!.root;
      const marker = join(staging, 'evidence/lifecycle-marker.txt');
      await until(
        async () => readFile(marker, 'utf8').catch(() => ''),
        (s) => s.trim().length > 0,
      );
      const before = await readFile(marker, 'utf8');
      expect(before.trim().split('\n')).toHaveLength(1);
      if (mode === 'delayed-ack') {
        // Inject the durable state visible while Docker creation has succeeded but its response is delayed.
        const recorded = db
          .prepare('SELECT container_id FROM scheduler_containers WHERE execution_id=?')
          .get(executionId) as { container_id: string };
        db.prepare(
          "UPDATE scheduler_containers SET status='create_pending',container_id=NULL WHERE execution_id=?",
        ).run(executionId);
        await new Promise((resolve) => setTimeout(resolve, 4500));
        expect((await status()).effectiveCode).toBe('ready');
        expect(
          db.prepare('SELECT 1 FROM execution_interruptions WHERE execution_id=?').get(executionId),
        ).toBeUndefined();
        db.prepare(
          "UPDATE scheduler_containers SET status='acknowledged',container_id=? WHERE execution_id=?",
        ).run(recorded.container_id, executionId);
      }
      if (mode === 'replaced-staging') {
        await rename(staging, staging + '-retained');
        await mkdir(staging, { mode: 0o700 });
        await writeFile(join(staging, 'do-not-delete'), 'replacement');
      }
      const failedAt = Date.now();
      await execute('/usr/local/bin/docker', ['stop', '--time', '1', `ap-dev-${serviceId}`], {
        timeout: 5000,
      });
      const interrupted = await until(
        status,
        (s) =>
          s.interruptions?.some((i: { execution_id: string }) => i.execution_id === executionId),
        6000,
      );
      expect(Date.now() - failedAt).toBeLessThan(6000);
      expect(interrupted.interruptions[0]).toMatchObject({ state: 'pending', revoke: 0 });
      if (mode.startsWith('restart')) {
        child.kill('SIGKILL');
        if (mode === 'restart-missing-source')
          await rename(join(f.root, 'source'), join(f.root, 'source-retained'));
        await until(status, (s) => s.service.lease_until_ms <= Date.now(), 20000);
        child = spawn(process.execPath, [cli, 'development-recover', path], {
          env: { WORKFLOW_GIT_BINARY: process.env.WORKFLOW_GIT_BINARY },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout!.on('data', (b) => log.push(String(b)));
        child.stderr!.on('data', (b) => log.push(String(b)));
      } else await command('development-recover');
      if (mode === 'replaced-staging') {
        const exhausted = await until(status, (s) => s.interruptions?.[0]?.state === 'exhausted');
        expect(exhausted.effectiveCode).not.toBe('ready');
        expect(await readFile(join(staging, 'do-not-delete'), 'utf8')).toBe('replacement');
        await rm(staging, { recursive: true, force: true });
        await rename(staging + '-retained', staging);
        await command('development-recover');
      }
      const contained = await until(status, (s) => s.interruptions?.[0]?.state === 'settled');
      expect(contained.interruptions[0].effects).toBe('uncertain');
      await until(status, (s) => s.effectiveCode === 'reconciliation_required');
      expect(await readFile(marker, 'utf8')).toBe(before);
      expect(await readFile(join(staging, 'codex-auth.json'))).toHaveLength(0);
      await expect(readFile(join(staging, 'codex-home/config.toml'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(
        (
          db.prepare("SELECT COUNT(*) AS n FROM scheduler_executions WHERE id!='child'").get() as {
            n: number;
          }
        ).n,
      ).toBe(1);
      expect(db.prepare('SELECT status FROM phase_jobs').get()).toEqual({ status: 'blocked' });
      expect(db.prepare("SELECT state FROM runs WHERE id='run'").get()).toEqual({
        state: 'task_verification',
      });
      await command('development-stop');
      await until(status, (s) => s.service?.pid === null);
      expect(log.join('')).not.toMatch(/Bearer |OPENAI_API_KEY|access_token/);
    } catch (error) {
      throw new Error(
        JSON.stringify({
          failure: String(error),
          log: log.join(''),
          phases: db.prepare('SELECT status,failure_code FROM phase_jobs').all(),
        }),
      );
    } finally {
      child.kill('SIGTERM');
      if (child.exitCode === null) await new Promise((resolve) => setTimeout(resolve, 2500));
      if (executionId)
        await execute('/usr/local/bin/docker', [
          'rm',
          '--force',
          `workflow-specialist-${executionId}`,
        ]).catch(() => undefined);
      if (serviceId) {
        await execute('/usr/local/bin/docker', ['rm', '--force', `ap-dev-${serviceId}`]).catch(
          () => undefined,
        );
        for (const suffix of ['internal', 'outbound'])
          await execute('/usr/local/bin/docker', [
            'network',
            'rm',
            `ap-dev-${serviceId}-${suffix}`,
          ]).catch(() => undefined);
      }
      db.close();
      if (staging) {
        await rm(staging, { recursive: true, force: true });
        await rm(staging + '-retained', { recursive: true, force: true });
      }
      await rm(f.root, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  },
  120000,
);

it.skipIf(!supplied)(
  'rejects a same-name container with unapproved configuration without stopping it',
  async () => {
    const { DevelopmentHost } = await import('../src/developmentHost.js');
    const root = await mkdtemp(join(homedir(), '.codex/lifecycle-rejection-'));
    const config = {
      ...JSON.parse(await readFile(supplied!, 'utf8')),
      stateDirectory: join(root, 'state'),
    };
    delete config.workflow;
    const host = await DevelopmentHost.create(config);
    const db = new Database(join(root, 'state/lifecycle.sqlite'), { readonly: true });
    const owner = db.prepare('SELECT service_id,config_digest FROM development_host').get() as {
      service_id: string;
      config_digest: string;
    };
    db.close();
    const name = `ap-dev-${owner.service_id}`;
    try {
      await execute(
        '/usr/local/bin/docker',
        [
          'run',
          '--detach',
          '--name',
          name,
          '--label',
          `io.agent-platform.development=${owner.service_id}`,
          '--label',
          `io.agent-platform.development-config=${owner.config_digest}`,
          '--entrypoint',
          'node',
          config.brokerImage,
          '-e',
          'setInterval(()=>{},1000)',
        ],
        { timeout: 10000 },
      );
      await expect(host.run()).rejects.toThrow('service_identity_mismatch');
      expect(
        (
          await execute('/usr/local/bin/docker', [
            'inspect',
            '--format',
            '{{.State.Running}}',
            name,
          ])
        ).stdout.trim(),
      ).toBe('true');
    } finally {
      await execute('/usr/local/bin/docker', ['rm', '--force', name]).catch(() => undefined);
      for (const suffix of ['internal', 'outbound'])
        await execute('/usr/local/bin/docker', ['network', 'rm', `${name}-${suffix}`]).catch(
          () => undefined,
        );
      await rm(root, { recursive: true, force: true });
    }
  },
  30000,
);

it.skipIf(!supplied)(
  'rejects an otherwise matching broker with only its command changed',
  async () => {
    const { DevelopmentHost } = await import('../src/developmentHost.js');
    const root = await mkdtemp(join(homedir(), '.codex/lifecycle-command-'));
    const config = {
      ...JSON.parse(await readFile(supplied!, 'utf8')),
      stateDirectory: join(root, 'state'),
    };
    delete config.workflow;
    const host = await DevelopmentHost.create(config);
    const db = new Database(join(root, 'state/lifecycle.sqlite'), { readonly: true });
    const owner = db.prepare('SELECT service_id,config_digest FROM development_host').get() as {
      service_id: string;
      config_digest: string;
    };
    db.close();
    const name = `ap-dev-${owner.service_id}`;
    const labels = [
      '--label',
      `io.agent-platform.development=${owner.service_id}`,
      '--label',
      `io.agent-platform.development-config=${owner.config_digest}`,
    ];
    try {
      await mkdir(join(root, 'state/broker'), { mode: 0o700 });
      await writeFile(join(root, 'state/server.json'), '{}', { mode: 0o600 });
      for (const suffix of ['internal', 'outbound'])
        await execute('/usr/local/bin/docker', [
          'network',
          'create',
          ...labels,
          ...(suffix === 'internal' ? ['--internal'] : []),
          `${name}-${suffix}`,
        ]);
      const mounts = [
        ['/state', join(root, 'state/broker'), false],
        ['/run/account.json', config.accountFile, true],
        ['/run/control.key', join(root, 'state/control.key'), true],
        ['/run/server.json', join(root, 'state/server.json'), true],
      ] as const;
      await execute('/usr/local/bin/docker', [
        'create',
        '--name',
        name,
        ...labels,
        '--network',
        `${name}-outbound`,
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--user',
        config.containerUser,
        '--publish',
        `127.0.0.1:${config.controlPort}:18101`,
        ...mounts.flatMap(([dst, src, ro]) => [
          '--mount',
          `type=bind,src=${src},dst=${dst}${ro ? ',readonly' : ''}`,
        ]),
        config.brokerImage,
        '/run/server.json',
        'serve',
        'unapproved-command-argument',
      ]);
      await execute('/usr/local/bin/docker', [
        'network',
        'connect',
        '--alias',
        'development-gateway',
        `${name}-internal`,
        name,
      ]);
      await expect(host.run()).rejects.toThrow('service_identity_mismatch');
      expect(
        (
          await execute('/usr/local/bin/docker', ['inspect', '--format', '{{.State.Status}}', name])
        ).stdout.trim(),
      ).toBe('created');
    } finally {
      await execute('/usr/local/bin/docker', ['rm', '--force', name]).catch(() => undefined);
      for (const suffix of ['internal', 'outbound'])
        await execute('/usr/local/bin/docker', ['network', 'rm', `${name}-${suffix}`]).catch(
          () => undefined,
        );
      await rm(root, { recursive: true, force: true });
    }
  },
  30000,
);
