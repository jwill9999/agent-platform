#!/usr/bin/env node
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, parse, relative, resolve, win32 } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

import { resolveWorkspaceConfig } from './workspace-config.mjs';

export const CONFIRM_PHRASE = 'DELETE AGENT PLATFORM DATA';

function isPathInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function uniquePaths(paths) {
  return [...new Set(paths.map((path) => resolve(path)))];
}

function isDriveRoot(candidate) {
  const parsed = win32.parse(candidate);
  return parsed.root !== '' && win32.normalize(candidate) === win32.normalize(parsed.root);
}

export function unsafeRemovalReason(candidate, options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const homeRoot = resolve(options.homeRoot ?? homedir());
  const trimmed = candidate?.trim();
  if (!trimmed) return 'empty paths are not safe cleanup targets';

  const resolved = resolve(trimmed);
  if (parse(resolved).root === resolved) return 'filesystem roots are not safe cleanup targets';
  if (isDriveRoot(trimmed)) return 'drive roots are not safe cleanup targets';
  if (resolved === homeRoot) return 'the user home directory is not a safe cleanup target';
  if (resolved === repoRoot) return 'the repository root is not a safe cleanup target';
  if (dirname(resolved) === parse(resolved).root) {
    return 'top-level directories are not safe cleanup targets';
  }
  return undefined;
}

export function buildCleanupPlan(config, options = {}) {
  const configuredPaths = uniquePaths([
    config.platformHome,
    config.workspaceHostPath,
    config.dataHostPath,
    ...config.directories,
  ]);
  const unsafe = configuredPaths
    .map((path) => ({ path, reason: unsafeRemovalReason(path, options) }))
    .filter((item) => item.reason);
  if (unsafe.length > 0) {
    return { ok: false, configuredPaths, unsafe };
  }

  const roots = uniquePaths([config.platformHome, config.workspaceHostPath, config.dataHostPath])
    .sort((a, b) => a.length - b.length)
    .filter(
      (path, index, paths) => !paths.slice(0, index).some((parent) => isPathInside(parent, path)),
    );

  return { ok: true, configuredPaths, roots };
}

export function formatPlan(plan, config) {
  const lines = [
    'Agent Platform host data cleanup',
    '',
    'Resolved configuration:',
    `  platform home: ${config.platformHome}`,
    `  workspace host path: ${config.workspaceHostPath}`,
    `  data host path: ${config.dataHostPath}`,
    `  workspace container path: ${config.workspaceContainerPath}`,
    '',
    'Resolved directories:',
    ...plan.configuredPaths.map((path) => `  - ${path}`),
  ];

  if (!plan.ok) {
    lines.push('', 'Refusing cleanup because one or more paths are unsafe:');
    lines.push(...plan.unsafe.map((item) => `  - ${item.path}: ${item.reason}`));
    return lines.join('\n');
  }

  lines.push('', 'Removal targets:');
  lines.push(...plan.roots.map((path) => `  - ${path}${existsSync(path) ? '' : ' (not present)'}`));
  return lines.join('\n');
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function printHelp() {
  console.log(`Usage: node scripts/workspace-clean.mjs [--dry-run] [--force]

Removes host-side Agent Platform workspace/data/config/log directories resolved from
AGENT_PLATFORM_HOME, AGENT_WORKSPACE_HOST_PATH, and AGENT_DATA_HOST_PATH.

Options:
  --dry-run  Print resolved paths and removal targets without deleting anything.
  --force    Delete without an interactive typed confirmation. Use only for automation.
  --help     Show this help text.`);
}

async function confirmDeletion() {
  if (!process.stdin.isTTY) {
    throw new Error('Refusing cleanup without a TTY. Re-run with --force for automation.');
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Type "${CONFIRM_PHRASE}" to permanently delete host data: `);
    return answer === CONFIRM_PHRASE;
  } finally {
    rl.close();
  }
}

export async function runWorkspaceClean(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const config = resolveWorkspaceConfig(env);
  const plan = buildCleanupPlan(config);
  console.log(formatPlan(plan, config));

  if (!plan.ok) return 2;
  if (args.dryRun) {
    console.log('\nDry run only. No files were deleted.');
    return 0;
  }

  console.log('\nThis will permanently delete host-side Agent Platform data.');
  if (!args.force && !(await confirmDeletion())) {
    console.log('Cleanup cancelled. No files were deleted.');
    return 1;
  }

  for (const target of plan.roots) {
    rmSync(target, { recursive: true, force: true });
  }

  console.log('Cleanup complete.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWorkspaceClean()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
