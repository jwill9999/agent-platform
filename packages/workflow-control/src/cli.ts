#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

import { WorkflowStore } from './storage.js';
import { ContinuationJournal } from './continuationJournal.js';
import { StandalonePhaseRuntime } from './phaseRuntime.js';
import { bootstrapPreflight } from './bootstrap.js';
import {
  ContinuationNotificationDispatcher,
  JsonlContinuationNotificationSink,
} from './continuationNotifications.js';
import {
  ContinuationWorker,
  createProcessParentExecutionHost,
  createCommandParentExecutionHost,
  assertDesktopHostConformance,
} from './continuationWorker.js';

function usage(): never {
  throw new Error(
    'usage: workflow-control <migrate|status|timeline|coordinator|host-conformance|phase-runtime|standalone-conformance|bootstrap-preflight> <database-path> [run-id|runtime-config.json] [bootstrap-policy.json]',
  );
}

export async function runPhaseRuntimeCli(
  args: readonly string[],
  conformance = false,
): Promise<void> {
  const [database, configFile] = args;
  if (database === undefined || configFile === undefined)
    throw new Error('standalone_runtime_config_missing');
  const config: unknown = JSON.parse(await readFile(resolve(configFile), 'utf8'));
  const runtime = await StandalonePhaseRuntime.create(resolve(database), config);
  if (conformance) {
    try {
      if (!(await runtime.runOnce())) throw new Error('standalone_conformance_no_completed_phase');
      process.stdout.write(
        `${JSON.stringify({ passed: true, boundary: 'isolated_codex_phase_execution' })}\n`,
      );
    } finally {
      await runtime.close();
    }
    return;
  }
  const stop = () => {
    void runtime.close().catch((error: unknown) => process.stderr.write(`${String(error)}\n`));
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  runtime.start();
}

export function runCli(args: readonly string[]): string {
  const [command, path, runId] = args;
  if (command === undefined || path === undefined) usage();
  const store = new WorkflowStore(resolve(path));
  try {
    if (command === 'migrate') return JSON.stringify({ ok: true, database: resolve(path) });
    if ((command === 'status' || command === 'timeline') && runId !== undefined) {
      const journal = new ContinuationJournal(resolve(path));
      try {
        if (command === 'timeline')
          return JSON.stringify({
            events: journal.timeline(runId),
            deliveries: journal.notificationReceipts(runId),
          });
        return JSON.stringify({
          run: store.getRun(runId) ?? null,
          continuations: journal
            .list()
            .filter((job) => job.run_id === runId)
            .map((job) => ({ ...job, nextAction: journal.action(job.id) ?? null })),
        });
      } finally {
        journal.close();
      }
    }
    return usage();
  } finally {
    store.close();
  }
}

export async function runCoordinatorCli(args: readonly string[]): Promise<void> {
  const path = args[0];
  if (path === undefined) usage();
  const database = resolve(path);
  new WorkflowStore(database).close();
  const journal = new ContinuationJournal(database);
  const readMs = (name: string, fallback: number) => Number(process.env[name] ?? fallback);
  const hostBinary = process.env.WORKFLOW_PARENT_HOST_BINARY;
  const hostArgs: unknown = JSON.parse(process.env.WORKFLOW_PARENT_HOST_ARGS ?? '[]');
  if (!Array.isArray(hostArgs) || !hostArgs.every((arg) => typeof arg === 'string')) {
    throw new Error('WORKFLOW_PARENT_HOST_ARGS must be a JSON array of strings');
  }
  const host =
    hostBinary === undefined
      ? createProcessParentExecutionHost(database)
      : createCommandParentExecutionHost(hostBinary, hostArgs as string[]);
  const worker = new ContinuationWorker(journal, host, {
    pollIntervalMs: readMs('WORKFLOW_WATCHDOG_POLL_MS', 1_000),
    overdueThresholdMs: readMs('WORKFLOW_WATCHDOG_OVERDUE_MS', 30_000),
    maxAttempts: readMs('WORKFLOW_WATCHDOG_MAX_ATTEMPTS', 10),
    deadlineMs: readMs('WORKFLOW_WATCHDOG_DEADLINE_MS', 300_000),
    leaseTtlMs: readMs('WORKFLOW_CONTINUATION_LEASE_MS', 30_000),
    hostTimeoutMs: readMs('WORKFLOW_HOST_TIMEOUT_MS', 5_000),
  });
  const notifications = new ContinuationNotificationDispatcher(
    database,
    new JsonlContinuationNotificationSink(
      process.env.WORKFLOW_NOTIFICATION_FEED_PATH ?? `${database}.notifications.jsonl`,
    ),
  );
  let shuttingDown = false;
  const stop = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void Promise.all([worker.stop(), notifications.stop()]).finally(() => journal.close());
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    notifications.start(readMs('WORKFLOW_NOTIFICATION_POLL_MS', 1000));
    await worker.start();
  } catch (error) {
    await worker.stop();
    await notifications.stop();
    journal.close();
    throw error;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv[2] === 'bootstrap-preflight') {
      const [database, runId, policyPath] = process.argv.slice(3);
      if (!database || !runId || !policyPath) usage();
      process.stdout.write(
        `${JSON.stringify(bootstrapPreflight(resolve(database), runId, JSON.parse(await readFile(resolve(policyPath), 'utf8'))))}\n`,
      );
      process.exit(0);
    }
    if (process.argv[2] === 'host-conformance') assertDesktopHostConformance();
    if (process.argv[2] === 'phase-runtime' || process.argv[2] === 'standalone-conformance')
      await runPhaseRuntimeCli(process.argv.slice(3), process.argv[2] === 'standalone-conformance');
    else if (process.argv[2] === 'coordinator') await runCoordinatorCli(process.argv.slice(3));
    else process.stdout.write(`${runCli(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
