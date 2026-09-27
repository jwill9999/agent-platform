import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { chmod, readFile, realpath, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { StandaloneCoordinators } from '../src/standaloneCoordinators.js';
import { WorkflowStore } from '../src/storage.js';
import type { DockerIsolatedSpecialistLauncher } from '../src/specialistLauncher.js';
import type { ExecutePhaseAction, PhaseJob } from '../src/phaseJobs.js';
import { developmentWorkflowFixture } from './developmentWorkflowFixture.js';

it('renews cancelled coordinator transport only after admission and never after permanent stop', async () => {
  const f = await developmentWorkflowFixture(true, true, true);
  const store = new WorkflowStore(f.database);
  let service: StandaloneCoordinators | undefined;
  try {
    const root = await realpath(join(f.root, 'source'));
    const fixtureRoot = await realpath(f.root);
    const executable = join(fixtureRoot, 'service.mjs');
    const evidence = join(f.root, 'dispatch.txt');
    await writeFile(
      executable,
      `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';
      appendFileSync(${JSON.stringify(evidence)},process.argv[3]+'\\n');process.stdout.write('null');\n`,
    );
    await chmod(executable, 0o700);
    const contract = store.getExecutionContract('run');
    const gitPath =
      process.env.WORKFLOW_GIT_BINARY ??
      execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
    const owned = join(fixtureRoot, 'owned');
    execFileSync(gitPath, ['clone', '--quiet', '--no-local', root, owned]);
    const inode = await stat(owned);
    const db = new Database(f.database);
    db.prepare('INSERT INTO implementation_workspaces VALUES(?,?,?,?,?,?)').run(
      'run',
      root,
      owned,
      String(inode.dev),
      String(inode.ino),
      f.callback.headSha,
    );
    db.close();

    service = new StandaloneCoordinators({
      database: f.database,
      store,
      contract,
      sourceRoot: root,
      owner: 'supervisor',
      // This path performs no specialist launch; unexpected launcher access fails immediately.
      launcher: new Proxy(
        {},
        {
          get() {
            throw new Error('unexpected specialist access');
          },
        },
      ) as DockerIsolatedSpecialistLauncher,
      gitPin: {
        path: gitPath,
        digest:
          'sha256:' +
          createHash('sha256')
            .update(await readFile(gitPath))
            .digest('hex'),
      },
      config: {
        transport: {
          path: executable,
          digest:
            'sha256:' +
            createHash('sha256')
              .update(await readFile(executable))
              .digest('hex'),
        },
        artifactRoot: join(f.root, 'artifacts'),
        checkCommands: {},
        approvedParentShas: { task: f.callback.headSha },
        remoteName: 'origin',
        protectionDigest: 'sha256:' + 'a'.repeat(64),
      },
    });
    const action = {
      kind: 'execute_phase',
      runId: 'run',
      taskId: 'task',
      workspaceId: contract.workspaceId,
      phase: 'delivery',
      headSha: f.callback.headSha,
      contractVersion: 1,
      policyDigest: contract.policyDigest,
    } as ExecutePhaseAction;
    const fence = {
      ownerId: 'supervisor',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 1,
      taskLeaseEpoch: 1,
    };
    const job = { execution_id: 'coordinator' } as PhaseJob;
    const dispatch = vi.fn();
    service.cancelExecution();
    await expect(
      service.execute(
        job,
        action,
        fence,
        () => {
          throw new Error('admission denied');
        },
        dispatch,
      ),
    ).rejects.toThrow('admission denied');
    expect(dispatch).not.toHaveBeenCalled();
    await expect(readFile(evidence)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.execute(job, action, fence, () => undefined, dispatch)).rejects.toThrow(
      'coordinator_pr_unavailable',
    );
    expect(await readFile(evidence, 'utf8')).toBe('github.findPullRequest\n');
    expect(dispatch).toHaveBeenCalledTimes(2); // before dispatch and before accepting reply
    service.abort();
    const admission = vi.fn();
    await expect(service.execute(job, action, fence, admission, dispatch)).rejects.toThrow(
      'coordinator_service_stopped',
    );
    expect(admission).not.toHaveBeenCalled();
    expect(await readFile(evidence, 'utf8')).toBe('github.findPullRequest\n');
  } finally {
    service?.close();
    store.close();
    await rm(f.root, { recursive: true, force: true });
  }
});
