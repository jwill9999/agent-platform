#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { WorkflowStore } from './storage.js';

function usage(): never {
  throw new Error('usage: workflow-control <migrate|status> <database-path> [run-id]');
}

export function runCli(args: readonly string[]): string {
  const [command, path, runId] = args;
  if (command === undefined || path === undefined) usage();
  const store = new WorkflowStore(resolve(path));
  try {
    if (command === 'migrate') return JSON.stringify({ ok: true, database: resolve(path) });
    if (command === 'status' && runId !== undefined) {
      return JSON.stringify({ run: store.getRun(runId) ?? null });
    }
    return usage();
  } finally {
    store.close();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.stdout.write(`${runCli(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
