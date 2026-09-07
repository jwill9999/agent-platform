import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { workflowRoleSchema } from '../src/contracts.js';
import { ContinuationJournal } from '../src/continuationJournal.js';
import { createWorkflowStoreDelegateCallbackStore } from '../src/governedPersistence.js';
import { continuationFixture, terminalResult } from './continuationFixture.js';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const roots: string[] = [];
const children: ChildProcess[] = [];
afterEach(async () => {
  await Promise.all(
    children.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) return resolve();
          child.once('exit', () => resolve());
          child.kill('SIGTERM');
        }),
    ),
  );
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function coordinator(database: string, environment: Record<string, string> = {}): ChildProcess {
  const child = spawn(process.execPath, [cli, 'coordinator', database], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WORKFLOW_WATCHDOG_POLL_MS: '10',
      WORKFLOW_WATCHDOG_OVERDUE_MS: '100',
      WORKFLOW_CONTINUATION_LEASE_MS: '1000',
      WORKFLOW_HOST_TIMEOUT_MS: '500',
      WORKFLOW_NOTIFICATION_POLL_MS: '10',
      ...environment,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  return child;
}

describe('production process continuation release gate', () => {
  it.each(workflowRoleSchema.options.filter((role) => role !== 'workflow_orchestrator'))(
    'consumes %s completion exactly once in a real parent process with no user turn',
    async (role) => {
      const fixture = await continuationFixture(Date.now(), role);
      roots.push(fixture.root);
      const supervisor = coordinator(fixture.database);
      coordinator(fixture.database); // Duplicate watchdog process must not duplicate consumption.
      // A real specialist child emits the terminal result, which is committed through production storage.
      const specialist = await execute(process.execPath, [
        '-e',
        'process.stdout.write(JSON.stringify(JSON.parse(process.argv[1])))',
        JSON.stringify(terminalResult),
      ]);
      fixture.finish(true, JSON.parse(specialist.stdout));
      const journal = new ContinuationJournal(fixture.database);
      await expect
        .poll(() => journal.get('specialist:child')?.status, { timeout: 5000, interval: 10 })
        .toBe('consumed');
      const job = journal.get('specialist:child')!;
      expect(supervisor.exitCode).toBeNull();
      expect(job.host_execution_id).toBeTruthy();
      expect(job.host_process_id).toBeGreaterThan(0);
      expect(job.host_process_id).not.toBe(process.pid);
      expect(job.host_process_id).not.toBe(supervisor.pid);
      expect(job.started_at_ms).not.toBeNull();
      expect(job.consumed_at_ms).toBeGreaterThanOrEqual(job.started_at_ms!);
      expect(fixture.store.getSchedulerExecution('child')).toMatchObject({
        status: 'completed',
        result: terminalResult,
      });
      expect(journal.action(job.id)).toEqual({
        kind: 'approval_required',
        eventId: fixture.callback.approvalIntent.eventId,
      });
      const callbacks = createWorkflowStoreDelegateCallbackStore({
        store: fixture.store,
        ownerId: 'owner',
      });
      expect(
        callbacks.recordAndTransition({
          callback: fixture.callback,
          target: 'approval_waiting',
          expectedParentVersion: 0,
        }),
      ).toMatchObject({ disposition: 'duplicate', needsWake: false });
      const sql = new Database(fixture.database, { readonly: true });
      expect(sql.prepare('SELECT count(*) AS count FROM continuation_actions').get()).toEqual({
        count: 1,
      });
      sql.close();
      journal.close();
      fixture.store.close();
    },
    10_000,
  );

  it('startup watchdog recovers result persistence without a callback or live original coordinator', async () => {
    const fixture = await continuationFixture();
    roots.push(fixture.root);
    const specialist = await execute(process.execPath, [
      '-e',
      'console.log(process.argv[1])',
      JSON.stringify(terminalResult),
    ]);
    fixture.finish(false, JSON.parse(specialist.stdout));
    fixture.store.close();
    const sql = new Database(fixture.database);
    sql.prepare('DELETE FROM continuation_events').run();
    sql.prepare('DELETE FROM continuation_jobs').run(); // Pre-fix result-persistence crash boundary.
    sql.close();
    coordinator(fixture.database);
    const journal = new ContinuationJournal(fixture.database);
    await expect
      .poll(() => journal.get('specialist:child')?.status, { timeout: 5000, interval: 10 })
      .toBe('consumed');
    expect(journal.get('specialist:child')?.started_at_ms).not.toBeNull();
    expect(journal.action('specialist:child')).toEqual({
      kind: 'blocked',
      reason: 'specialist_callback_authority_unavailable',
    });
    journal.close();
  });

  it('fails the mandatory desktop host gate visibly instead of skipping green', async () => {
    await expect(execute(process.execPath, [cli, 'host-conformance'])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('host_resume_unavailable'),
    });
  });

  it('watchdog bounds acceptance from a real host process that never starts the parent', async () => {
    const fixture = await continuationFixture();
    roots.push(fixture.root);
    fixture.finish();
    coordinator(fixture.database, {
      WORKFLOW_PARENT_HOST_BINARY: process.execPath,
      WORKFLOW_PARENT_HOST_ARGS: JSON.stringify([
        fileURLToPath(new URL('./fixtures/acceptOnlyHost.mjs', import.meta.url)),
      ]),
      WORKFLOW_WATCHDOG_MAX_ATTEMPTS: '2',
      WORKFLOW_CONTINUATION_LEASE_MS: '200',
      WORKFLOW_HOST_TIMEOUT_MS: '100',
    });
    const journal = new ContinuationJournal(fixture.database);
    await expect
      .poll(() => journal.get('specialist:child')?.status, { timeout: 5000, interval: 10 })
      .toBe('blocked');
    expect(journal.get('specialist:child')).toMatchObject({
      failure_code: 'host_resume_unavailable',
      attempts: 3,
      started_at_ms: null,
      consumed_at_ms: null,
    });
    expect(journal.action('specialist:child')).toBeUndefined();
    await expect
      .poll(
        async () => {
          const feed = await readFile(`${fixture.database}.notifications.jsonl`, 'utf8').catch(
            () => '',
          );
          return feed
            .split('\n')
            .filter(Boolean)
            .some((line) => (JSON.parse(line) as { kind: string }).kind === 'blocked');
        },
        { timeout: 5000, interval: 10 },
      )
      .toBe(true);
    expect(journal.timeline('run').filter((event) => event.kind === 'blocked')).toHaveLength(1);
    journal.close();
    fixture.store.close();
  });

  it('retries a real busy host then consumes its actual parent process exactly once', async () => {
    const fixture = await continuationFixture();
    roots.push(fixture.root);
    fixture.finish();
    coordinator(fixture.database, {
      WORKFLOW_PARENT_HOST_BINARY: process.execPath,
      WORKFLOW_PARENT_HOST_ARGS: JSON.stringify([
        fileURLToPath(new URL('./fixtures/busyThenProcessHost.mjs', import.meta.url)),
        fixture.database,
      ]),
    });
    const journal = new ContinuationJournal(fixture.database);
    await expect
      .poll(() => journal.get('specialist:child')?.status, { timeout: 5000, interval: 10 })
      .toBe('consumed');
    expect(journal.get('specialist:child')).toMatchObject({ attempts: 2 });
    expect(journal.get('specialist:child')?.host_process_id).not.toBe(process.pid);
    expect(journal.action('specialist:child')?.kind).toBe('approval_required');
    journal.close();
    fixture.store.close();
  });
});
