import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
const docker = vi.hoisted(() => ({
  calls: [] as string[][],
  mode: '',
  labels: {} as Record<string, string>,
}));
vi.mock('node:child_process', async (original) => ({
  ...(await original<typeof import('node:child_process')>()),
  execFile: (
    _binary: string,
    args: string[],
    _options: unknown,
    callback: (error: unknown, result: unknown) => void,
  ) => {
    docker.calls.push(args);
    if (docker.mode === 'docker_unavailable')
      return callback(new Error('sensitive docker detail'), undefined);
    if (args[0] === 'info') return callback(null, { stdout: '1', stderr: '' });
    if (args[0] === 'image') {
      if (docker.mode === 'image_unavailable')
        return callback(
          Object.assign(new Error('missing'), { code: 1, stderr: 'No such image' }),
          undefined,
        );
      return callback(null, { stdout: JSON.stringify([{ Id: 'image' }]), stderr: '' });
    }
    if (args[0] === 'network')
      return callback(null, {
        stdout: JSON.stringify([{ Id: 'network', Internal: false, Labels: docker.labels }]),
        stderr: '',
      });
    return callback(new Error('unexpected Docker action'), undefined);
  },
}));
import { DevelopmentHost } from '../src/developmentHost.js';
const roots: string[] = [];
afterEach(async () => {
  docker.calls = [];
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
it.each(['docker_unavailable', 'image_unavailable', 'topology_invalid'])(
  'blocks startup with %s before worker dispatch',
  async (mode) => {
    docker.mode = mode;
    const root = await mkdtemp(join(tmpdir(), 'lifecycle-fault-'));
    roots.push(root);
    const accountFile = join(root, 'account.json');
    await writeFile(accountFile, '{}', { mode: 0o600 });
    const host = await DevelopmentHost.create({
      stateDirectory: join(root, 'state'),
      accountFile,
      brokerImage: 'sha256:' + 'a'.repeat(64),
      workerImage: 'sha256:' + 'b'.repeat(64),
      containerUser: `${process.getuid?.() || 501}:20`,
      controlPort: 19341,
      clientVersion: 'fixture',
    });
    const db = new Database(join(root, 'state/lifecycle.sqlite'));
    try {
      const owner = db.prepare('SELECT service_id,config_digest FROM development_host').get() as {
        service_id: string;
        config_digest: string;
      };
      docker.labels = {
        'io.agent-platform.development': owner.service_id,
        'io.agent-platform.development-config': owner.config_digest,
      };
      await expect(host.run()).rejects.toThrow(mode);
      expect(docker.calls.some((args) => ['create', 'run', 'start'].includes(args[0]!))).toBe(
        false,
      );
      expect(db.prepare('SELECT code,pid FROM development_host').get()).toEqual({
        code: mode,
        pid: null,
      });
    } finally {
      db.close();
    }
  },
);

it('rejects changed runtime identity after release instead of adopting a different run', async () => {
  docker.mode = 'docker_unavailable';
  const root = await mkdtemp(join(tmpdir(), 'lifecycle-runtime-binding-'));
  roots.push(root);
  const accountFile = join(root, 'account.json'),
    runtimeConfig = join(root, 'runtime.json'),
    database = join(root, 'workflow.sqlite');
  await writeFile(accountFile, '{}', { mode: 0o600 });
  const runtime = {
    runId: 'run-a',
    sourceRoot: root,
    image: 'sha256:' + 'b'.repeat(64),
    containerUser: `${process.getuid?.() || 501}:20`,
  };
  await writeFile(runtimeConfig, JSON.stringify(runtime), { mode: 0o600 });
  const { WorkflowStore } = await import('../src/storage.js');
  new WorkflowStore(database).close();
  const config = {
    stateDirectory: join(root, 'state'),
    accountFile,
    brokerImage: 'sha256:' + 'a'.repeat(64),
    workerImage: 'sha256:' + 'b'.repeat(64),
    containerUser: `${process.getuid?.() || 501}:20`,
    controlPort: 19341,
    clientVersion: 'fixture',
    workflow: { database, runtimeConfig },
  };
  const host = await DevelopmentHost.create(config);
  // Failing runtime attachment releases the owner without changing the bound input digest.
  await expect(host.run()).rejects.toThrow();
  await writeFile(runtimeConfig, JSON.stringify({ ...runtime, runId: 'run-b' }), { mode: 0o600 });
  await expect(DevelopmentHost.create(config, true)).rejects.toThrow('service_identity_mismatch');
});
