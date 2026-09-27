import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { developmentWorkflowFixture } from './developmentWorkflowFixture.js';

const execute = promisify(execFile);
const image = process.env.WORKFLOW_R2_IMAGE;
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const brokerCli = fileURLToPath(new URL('../dist/localCredentialBrokerCli.js', import.meta.url));
async function port(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture port unavailable');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
const docker = (args: string[]) =>
  execute('/usr/local/bin/docker', args, { env: {}, timeout: 30000, maxBuffer: 1024 * 1024 });
it.skipIf(!image).each(['import', 'verify-review'] as const)(
  'qualifies %s through production runtime, Docker, credential broker and retained evidence',
  async (mode) => {
    const f = await developmentWorkflowFixture(true, mode === 'verify-review');
    const root = await realpath(await mkdtemp(join(tmpdir(), 'implementation-connected-')));
    const name = `r2-${randomUUID()}`;
    let broker: ChildProcess | undefined;
    const supervisors: ChildProcess[] = [];
    const db = new Database(f.database);
    try {
      const account = join(root, 'dummy-account.json'),
        key = join(root, 'control.key');
      await writeFile(
        account,
        JSON.stringify({
          tokens: { access_token: 'disposable-fixture-only', account_id: 'disposable' },
        }),
        { mode: 0o600 },
      );
      await writeFile(key, '1'.repeat(64), { mode: 0o600 });
      const config = join(root, 'broker.json');
      await writeFile(
        config,
        JSON.stringify({
          database: join(root, 'broker.sqlite'),
          accountFile: account,
          controlKeyFile: key,
          controlPort: await port(),
          gatewayPort: await port(),
        }),
        { mode: 0o600 },
      );
      broker = spawn(process.execPath, [brokerCli, config, 'serve'], { env: {}, stdio: 'ignore' });
      const adapter = join(root, 'adapter.mjs');
      await execute(process.execPath, [brokerCli, config, 'create-adapter', '--output', adapter], {
        env: {},
        timeout: 10000,
      });
      let healthy = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          await execute(adapter, ['health'], { env: {}, timeout: 2000 });
          healthy = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      expect(healthy).toBe(true);
      await docker(['network', 'create', '--internal', name]);
      await docker([
        'run',
        '--detach',
        '--name',
        name,
        '--network',
        name,
        '--network-alias',
        'fixture-model',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--mount',
        `type=bind,src=${fileURLToPath(new URL('./fixtures/implementationResponses.mjs', import.meta.url))},dst=/fixture.mjs,readonly`,
        '--entrypoint',
        'node',
        image!,
        '/fixture.mjs',
      ]);
      const runtime = join(root, 'runtime.json');
      await writeFile(
        runtime,
        JSON.stringify({
          runId: 'run',
          sourceRoot: await realpath(join(f.root, 'source')),
          gitBinary: process.env.WORKFLOW_GIT_BINARY,
          credentialBrokerBinary: adapter,
          image,
          egressNetwork: name,
          containerUser: `${process.getuid!()}:${process.getgid!()}`,
          modelGateway: { url: 'http://fixture-model:18103', model: 'offline-fixture' },
          leaseTtlMs: 30000,
        }),
        { mode: 0o600 },
      );
      if (mode === 'import') {
        const result = await execute(
          process.execPath,
          [cli, 'standalone-conformance', f.database, runtime],
          { env: {}, timeout: 90000, maxBuffer: 100000 },
        );
        expect(JSON.parse(result.stdout)).toMatchObject({ passed: true });
      } else {
        // Two supported long-lived production processes; no phase or continuation injected
        // after startup and no human turn between implement, verify and review.
        for (const args of [
          ['coordinator', f.database],
          ['phase-runtime', f.database, runtime],
        ])
          supervisors.push(spawn(process.execPath, [cli, ...args], { env: {}, stdio: 'ignore' }));
        const deadline = Date.now() + 90000;
        while (Date.now() < deadline) {
          const run = db.prepare('SELECT state FROM runs WHERE id=?').get('run') as {
            state: string;
          };
          if (run.state === 'task_accepted' || run.state === 'escalated') break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        expect(db.prepare('SELECT state FROM runs WHERE id=?').get('run')).toEqual({
          state: 'task_accepted',
        });
        for (const child of supervisors) child.kill('SIGTERM');
        await Promise.all(
          supervisors.map((child) =>
            child.exitCode !== null
              ? Promise.resolve()
              : new Promise<void>((resolve) => child.once('exit', () => resolve())),
          ),
        );
      }
      const owned = db
        .prepare('SELECT workspace_root FROM implementation_workspaces WHERE run_id=?')
        .get('run') as { workspace_root: string };
      expect(
        await readFile(join(owned.workspace_root, 'packages/workflow-control/example.txt'), 'utf8'),
      ).toBe('verified fixture change\n');
      expect(
        await readFile(join(f.root, 'source/packages/workflow-control/example.txt'), 'utf8'),
      ).not.toBe('verified fixture change\n');
      expect(db.prepare('SELECT status FROM implementation_imports').get()).toEqual({
        status: 'verified',
      });
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM phase_jobs WHERE status='completed'").get(),
      ).toEqual({ n: mode === 'import' ? 1 : 3 });
      const actual = db
        .prepare("SELECT status,credential_status FROM scheduler_executions WHERE id!='child'")
        .all();
      expect(actual).toEqual(
        Array.from({ length: mode === 'import' ? 1 : 3 }, () => ({
          status: 'completed',
          credential_status: 'revoked',
        })),
      );
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM delegate_callbacks WHERE status='committed'").get(),
      ).toEqual({ n: mode === 'import' ? 2 : 4 });
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM scheduler_containers WHERE status!='removal_confirmed' AND execution_id!='child'",
          )
          .get(),
      ).toEqual({ n: 0 });
    } catch (error) {
      throw new Error(
        JSON.stringify({
          failure: String(error),
          modelTrace: (await docker(['logs', name]).catch(() => ({ stdout: '' }))).stdout,
          phases: db.prepare('SELECT status,failure_code FROM phase_jobs').all(),
          executions: db
            .prepare("SELECT status,result_json FROM scheduler_executions WHERE id!='child'")
            .all(),
          interruptions: db.prepare('SELECT reason,state FROM execution_interruptions').all(),
        }),
      );
    } finally {
      for (const child of supervisors) if (child.exitCode === null) child.kill('SIGKILL');
      for (const row of db
        .prepare("SELECT id FROM scheduler_executions WHERE id!='child'")
        .all() as Array<{ id: string }>)
        await docker(['rm', '--force', `workflow-specialist-${row.id}`]).catch(() => undefined);
      for (const row of db.prepare('SELECT root FROM scheduler_staging').all() as Array<{
        root: string;
      }>)
        await rm(row.root, { recursive: true, force: true });
      for (const row of db
        .prepare('SELECT workspace_root FROM implementation_workspaces')
        .all() as { workspace_root: string }[])
        await rm(dirname(row.workspace_root), { recursive: true, force: true });
      db.close();
      if (broker && broker.exitCode === null) {
        broker.kill('SIGTERM');
        await new Promise<void>((resolve) => broker!.once('exit', () => resolve()));
      }
      await docker(['rm', '--force', name]).catch(() => undefined);
      await docker(['network', 'rm', name]).catch(() => undefined);
      await rm(root, { recursive: true, force: true });
      await rm(f.root, { recursive: true, force: true });
    }
  },
  120000,
);
