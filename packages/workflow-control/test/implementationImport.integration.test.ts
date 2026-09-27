import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { workflowCancellationMutationCapability, WorkflowStore } from '../src/storage.js';
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
it
  .skipIf(!image)
  .each([
    'import',
    'verify-review',
    'coordinators',
    'repair-verifier',
    'repair-reviewer',
    'repair-feature',
    'lost-close-ack',
    'no-hosted-checks',
    'late-first-checks',
    'cancel-active',
    'alter-documents',
    'restart-active',
    'lost-notification',
  ] as const)(
  'qualifies %s through production runtime, Docker, credential broker and retained evidence',
  async (mode) => {
    const negative = ['cancel-active', 'alter-documents', 'restart-active'].includes(mode);
    const complete = !['import', 'verify-review'].includes(mode) && !negative;
    const repair = mode.startsWith('repair-');
    const f = await developmentWorkflowFixture(true, mode !== 'import', complete, {
      noHostedChecks: mode === 'no-hosted-checks',
      repairPlanning: mode === 'repair-feature',
      ...(mode === 'late-first-checks' ? { waitDeadlineSeconds: 20 } : {}),
    });
    const root = await realpath(await mkdtemp(join(tmpdir(), 'implementation-connected-')));
    const name = `r2-${randomUUID()}`;
    let broker: ChildProcess | undefined;
    const supervisors: ChildProcess[] = [];
    const supervisorErrors: string[] = [];
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
        ...(repair
          ? [
              '--env',
              `WORKFLOW_FIXTURE_REPAIR=${mode === 'repair-feature' ? 'feature_evaluator' : mode === 'repair-verifier' ? 'test_runner' : 'code_reviewer'}`,
            ]
          : []),
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
      let coordinators;
      if (complete) {
        const source = await realpath(join(f.root, 'source'));
        const git = process.env.WORKFLOW_GIT_BINARY!;
        const parent = (await execute(git, ['-C', source, 'rev-parse', 'HEAD'])).stdout.trim();
        await execute(git, ['-C', source, 'branch', 'feature/test', parent]);
        const remote = join(root, 'remote.git');
        await execute(git, ['init', '--bare', '--quiet', remote]);
        await execute(git, [
          '-C',
          source,
          'push',
          '--quiet',
          remote,
          `${parent}:refs/heads/task/task`,
        ]);
        const state = join(root, 'services.json');
        await writeFile(state, JSON.stringify({ closed: [], synced: false, pr: null }));
        const protectionDigest = 'sha256:' + 'a'.repeat(64);
        const service = join(root, 'services.mjs');
        await writeFile(
          service,
          '#!' +
            process.execPath +
            '\n' +
            'import {serve} from ' +
            JSON.stringify(new URL('./fixtures/coordinatorServices.mjs', import.meta.url).href) +
            ';\n' +
            'await serve(' +
            JSON.stringify({
              state,
              remote,
              git,
              protectionDigest,
              loseCloseAcknowledgement: mode === 'lost-close-ack',
              delayFirstChecksMs: mode === 'late-first-checks' ? 22000 : undefined,
              noHostedChecks: mode === 'no-hosted-checks',
            }) +
            ');\n',
        );
        await chmod(service, 0o700);
        coordinators = {
          transport: {
            path: service,
            digest:
              'sha256:' +
              createHash('sha256')
                .update(await readFile(service))
                .digest('hex'),
          },
          artifactRoot: join(root, 'artifacts'),
          checkCommands: {
            'connected-check': [
              process.execPath,
              '-e',
              mode === 'repair-feature'
                ? `const fs=require('node:fs');const initial=fs.readFileSync('.git/HEAD','utf8').trim()==='ref: refs/heads/task/task';const expected=initial?'verified fixture change\\n':'verified repaired change\\n';if(fs.readFileSync('packages/workflow-control/example.txt','utf8')!==expected)process.exit(1)`
                : `const fs=require('node:fs');if(fs.readFileSync('packages/workflow-control/example.txt','utf8')!==${JSON.stringify(repair ? 'verified repaired change\n' : 'verified fixture change\n')})process.exit(1)`,
            ],
          },
          approvedParentShas: { task: parent },
          remoteName: 'origin',
          protectionDigest,
        };
      }
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
          ...(coordinators ? { coordinators } : {}),
        }),
        { mode: 0o600 },
      );
      await recordConnectedStartup(mode, runtime, config, name, healthy);
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
        ]) {
          const child = spawn(process.execPath, [cli, ...args], {
            env: {},
            stdio: ['ignore', 'ignore', 'pipe'],
          });
          child.stderr!.on('data', (chunk: Buffer) => supervisorErrors.push(chunk.toString()));
          supervisors.push(child);
        }
        await injectConnectedFailure(mode, f, db, supervisors, supervisorErrors, runtime);
        const deadline = Date.now() + (mode === 'repair-feature' ? 180000 : 90000);
        while (Date.now() < deadline) {
          const run = db.prepare('SELECT state FROM runs WHERE id=?').get('run') as {
            state: string;
          };
          if (run.state === (complete ? 'closed' : 'task_accepted') || run.state === 'escalated')
            break;
          if (db.prepare("SELECT 1 FROM phase_jobs WHERE status='blocked'").get()) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (negative) {
          expect(
            db.prepare("SELECT COUNT(*) AS n FROM phase_jobs WHERE status='blocked'").get(),
          ).toEqual({ n: 1 });
          expect(
            db
              .prepare("SELECT COUNT(*) AS n FROM scheduler_executions WHERE status='active'")
              .get(),
          ).toEqual({ n: 0 });
          expect(db.prepare('SELECT COUNT(*) AS n FROM implementation_imports').get()).toEqual({
            n: 0,
          });
          expect(db.prepare('SELECT COUNT(*) AS n FROM delegate_callbacks').get()).toEqual({
            n: 1,
          });
          expect(db.prepare('SELECT state FROM execution_interruptions').all()).toEqual([
            { state: 'settled' },
          ]);
          expect(
            await readFile(join(f.root, 'source/packages/workflow-control/example.txt'), 'utf8'),
          ).not.toBe('verified fixture change\n');
          recordConnectedEvidence(db, mode, image!);
          return;
        }
        if (mode === 'late-first-checks') {
          expect(db.prepare('SELECT state FROM runs').get()).toEqual({ state: 'pipeline' });
          expect(
            db
              .prepare(
                "SELECT status,failure_code FROM phase_jobs WHERE json_extract(action_json,'$.phase')='pipeline'",
              )
              .get(),
          ).toEqual({ status: 'blocked', failure_code: 'phase_coordinator_recovery_exhausted' });
          expect(
            db.prepare('SELECT COUNT(*) AS n FROM passed_pipeline_observations').get(),
          ).toEqual({ n: 0 });
          expect(
            db
              .prepare("SELECT COUNT(*) AS n FROM delivery_operations WHERE kind='github.merge'")
              .get(),
          ).toEqual({ n: 0 });
          recordConnectedEvidence(db, mode, image!);
          return;
        }
        expect(db.prepare('SELECT state FROM runs WHERE id=?').get('run')).toEqual({
          state: complete ? 'closed' : 'task_accepted',
        });
        for (const child of supervisors) child.kill('SIGTERM');
        await Promise.all(
          supervisors.map((child) =>
            child.exitCode !== null || child.signalCode !== null
              ? Promise.resolve()
              : new Promise<void>((resolve) => child.once('exit', () => resolve())),
          ),
        );
      }
      if (mode === 'lost-close-ack') {
        const state = JSON.parse(await readFile(join(root, 'services.json'), 'utf8'));
        expect(state.lostCloseAcknowledgement).toBe(true);
        expect(state.closeMutations).toBe(2); // task and epic, each exactly once
        expect(
          db.prepare('SELECT SUM(attempts) AS n FROM coordinator_recovery_attempts').get(),
        ).toEqual({ n: 1 });
      }
      if (repair && mode !== 'repair-feature') {
        expect(db.prepare('SELECT status,task_attempt FROM repair_dispatches').all()).toEqual([
          { status: 'accepted', task_attempt: 2 },
        ]);
        expect(
          db.prepare("SELECT attempt FROM attempts WHERE scope='task' ORDER BY attempt").all(),
        ).toEqual([{ attempt: 1 }, { attempt: 2 }]);
        expect(
          db
            .prepare(
              "SELECT attempt_number FROM scheduler_executions WHERE role='implementation_worker' ORDER BY created_at_ms",
            )
            .all(),
        ).toEqual([{ attempt_number: 1 }, { attempt_number: 2 }]);
        expect(db.prepare('SELECT COUNT(*) AS n FROM implementation_phase_attempts').get()).toEqual(
          { n: 2 },
        );
      }
      if (mode === 'repair-feature') {
        expect(db.prepare('SELECT status FROM repair_child_intents').all()).toEqual([
          { status: 'committed' },
        ]);
        expect(db.prepare('SELECT activated FROM repair_planning_handoffs').all()).toEqual([
          { activated: 1 },
        ]);
        expect(
          db
            .prepare("SELECT attempt FROM attempts WHERE scope='task' ORDER BY created_at_ms")
            .all(),
        ).toEqual([{ attempt: 1 }, { attempt: 1 }]);
        const state = JSON.parse(await readFile(join(root, 'services.json'), 'utf8'));
        expect(state.claimMutations).toBe(1);
        expect(state.closeMutations).toBe(3);
      }
      const owned = db
        .prepare('SELECT workspace_root FROM implementation_workspaces WHERE run_id=?')
        .get('run') as { workspace_root: string };
      expect(
        await readFile(join(owned.workspace_root, 'packages/workflow-control/example.txt'), 'utf8'),
      ).toBe(repair ? 'verified repaired change\n' : 'verified fixture change\n');
      expect(
        await readFile(join(f.root, 'source/packages/workflow-control/example.txt'), 'utf8'),
      ).not.toBe('verified fixture change\n');
      expect(
        db.prepare('SELECT status FROM implementation_imports ORDER BY created_at_ms DESC').get(),
      ).toEqual({
        status: 'verified',
      });
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM phase_jobs WHERE status='completed'").get(),
      ).toEqual({
        n:
          mode === 'import'
            ? 1
            : complete
              ? mode === 'repair-verifier'
                ? 11
                : mode === 'repair-reviewer'
                  ? 12
                  : mode === 'repair-feature'
                    ? 14
                    : 8
              : 3,
      });
      const actual = db
        .prepare("SELECT status,credential_status FROM scheduler_executions WHERE id!='child'")
        .all();
      expect(actual).toEqual(
        Array.from(
          {
            length:
              mode === 'import'
                ? 1
                : complete
                  ? mode === 'repair-verifier'
                    ? 6
                    : mode === 'repair-reviewer'
                      ? 7
                      : mode === 'repair-feature'
                        ? 9
                        : 4
                  : 3,
          },
          () => ({
            status: 'completed',
            credential_status: 'revoked',
          }),
        ),
      );
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM delegate_callbacks WHERE status='committed'").get(),
      ).toEqual({
        n:
          mode === 'import'
            ? 2
            : complete
              ? mode === 'repair-verifier'
                ? 7
                : mode === 'repair-reviewer'
                  ? 8
                  : mode === 'repair-feature'
                    ? 10
                    : 5
              : 4,
      });
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM scheduler_containers WHERE status!='removal_confirmed' AND execution_id!='child'",
          )
          .get(),
      ).toEqual({ n: 0 });
      recordConnectedEvidence(db, mode, image!);
    } catch (error) {
      throw new Error(
        JSON.stringify({
          failure: error instanceof Error ? error.stack : String(error),
          supervisorErrors,
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
  210000,
);

async function untilConnected(predicate: () => boolean, timeout = 45000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('connected injection boundary unavailable');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGKILL');
  await stopped;
}
async function injectConnectedFailure(
  mode: string,
  fixture: { database: string; root: string; store: WorkflowStore },
  db: Database.Database,
  supervisors: ChildProcess[],
  errors: string[],
  runtime: string,
): Promise<void> {
  const restart = (args: string[]) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env: {},
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr!.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
    supervisors.push(child);
  };
  if (mode === 'lost-notification') {
    await stopProcess(supervisors[0]!);
    await untilConnected(
      () =>
        (db.prepare('SELECT COUNT(*) AS n FROM delegate_callbacks').get() as { n: number }).n > 1,
    );
    restart(['coordinator', fixture.database]);
    return;
  }
  if (!['cancel-active', 'alter-documents', 'restart-active'].includes(mode)) return;
  await untilConnected(() =>
    Boolean(
      db
        .prepare(
          "SELECT 1 FROM scheduler_executions WHERE status='active' AND role='implementation_worker'",
        )
        .get(),
    ),
  );
  if (mode === 'restart-active') {
    await stopProcess(supervisors[1]!);
    restart(['phase-runtime', fixture.database, runtime]);
    return;
  }
  if (mode === 'alter-documents') {
    await writeFile(
      join(fixture.root, 'source/fixture-tests.md'),
      'Changed after execution admission\n',
    );
    return;
  }
  const execution = db
    .prepare(
      "SELECT id FROM scheduler_executions WHERE status='active' AND role='implementation_worker'",
    )
    .get() as { id: string };
  const store = new WorkflowStore(fixture.database);
  const active = store.getSchedulerExecution(execution.id)!;
  const now = Date.now();
  // Exercise the production durable cancellation request, not a direct runs-table mutation.
  try {
    store.requestWorkflowCancellation(
      {
        id: 'connected-cancel',
        runId: 'run',
        requestedBy: 'fixture-owner',
        reason: 'controlled cancellation',
        requestedAtMs: now,
        nowMs: now,
        stopDeadlineMs: now + 30000,
        retainedEvidence: [],
        ownerId: active.ownerId,
        workspaceLeaseEpoch: active.workspaceLeaseEpoch,
        runLeaseEpoch: active.runLeaseEpoch,
      },
      workflowCancellationMutationCapability,
    );
  } finally {
    store.close();
  }
}

function recordConnectedEvidence(db: Database.Database, mode: string, image: string): void {
  const handoffs = db
    .prepare(
      `SELECT json_extract(p.action_json,'$.phase') AS phase,
    p.created_at_ms-c.created_at_ms AS callbackToQueueMs,
    p.started_at_ms-c.created_at_ms AS callbackToPhaseStartMs,
    s.created_at_ms-c.created_at_ms AS callbackToSpecialistReservationMs
    FROM phase_jobs p JOIN delegate_callbacks c ON c.callback_id=p.callback_id
    LEFT JOIN scheduler_executions s ON s.id=p.execution_id ORDER BY p.created_at_ms`,
    )
    .all();
  process.stdout.write(
    JSON.stringify({
      qualification: mode,
      image,
      handoffs,
      run: db.prepare('SELECT state FROM runs').get(),
      phases: db.prepare('SELECT status,COUNT(*) AS count FROM phase_jobs GROUP BY status').all(),
      executions: db
        .prepare(
          "SELECT status,credential_status,COUNT(*) AS count FROM scheduler_executions WHERE id!='child' GROUP BY status,credential_status",
        )
        .all(),
      interruptions: db.prepare('SELECT reason,state FROM execution_interruptions').all(),
    }) + '\n',
  );
}

async function recordConnectedStartup(
  mode: string,
  runtimePath: string,
  brokerPath: string,
  container: string,
  brokerHealthy: boolean,
): Promise<void> {
  const configurations = await Promise.all(
    [runtimePath, brokerPath].map(async (path) => {
      const bytes = await readFile(path);
      // These fixture configs contain only settings and credential file paths, never file contents.
      return {
        path,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        settings: JSON.parse(bytes.toString('utf8')) as unknown,
      };
    }),
  );
  const running = (
    await docker(['inspect', '--format', '{{.State.Running}}', container])
  ).stdout.trim();
  expect(running).toBe('true');
  process.stdout.write(
    JSON.stringify({
      qualification: mode,
      startup: { brokerHealthy, modelContainerRunning: running === 'true', configurations },
    }) + '\n',
  );
}
