#!/usr/bin/env node
/* global console, process */
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const scriptArgs = process.argv.slice(2);
if (scriptArgs[0] === '--') scriptArgs.shift();

const { values } = parseArgs({
  args: scriptArgs,
  options: {
    'assets-dir': { type: 'string' },
    'work-dir': {
      type: 'string',
      default: `/private/tmp/agent-platform-macos-vm-repair-smoke-${process.pid}`,
    },
  },
});

const assetsDir = values['assets-dir'];
const workDir = resolve(values['work-dir']);

if (!assetsDir) {
  console.error(
    [
      'Usage: node scripts/smoke-macos-vm-repair.mjs --assets-dir <prepared-images-dir> [--work-dir <dir>]',
      '',
      'Runs a release-shaped macOS VM repair smoke using packaged resources, the signed helper,',
      'and the compiled desktop repair API. Run apps/desktop build/native helper signing first.',
    ].join('\n'),
  );
  process.exit(2);
}

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const desktopDir = join(repoRoot, 'apps/desktop');
const resourcesDir = join(workDir, 'resources');
const packagedVmDir = join(resourcesDir, 'macos-vm');
const userDataDir = join(workDir, 'user-data');
const logsDir = join(workDir, 'logs');
const tempDir = join(workDir, 'temp');
const projectDir = join(workDir, 'project');
const projectFile = join(projectDir, 'README.md');

const runtimePathsModule = await importDistModule('runtimePaths.js');
const backendSupervisorModule = await importDistModule('backendSupervisor.js');
const { resolveDesktopRuntimePaths, ensureDesktopRuntimeDirectories } = runtimePathsModule;
const { getDesktopBackendPaths, repairPackagedMacosVmRuntime } = backendSupervisorModule;

rmSync(workDir, { recursive: true, force: true });
mkdirSync(projectDir, { recursive: true });
writeFileSync(projectFile, '# Project data must survive VM repair\n');

execFileSync(
  process.execPath,
  [
    join(desktopDir, 'scripts/package-macos-vm-runtime.mjs'),
    '--skip-build',
    '--assets-dir',
    resolve(assetsDir),
    '--out-dir',
    packagedVmDir,
  ],
  { stdio: 'inherit' },
);

const runtimePaths = resolveDesktopRuntimePaths({
  userDataDir,
  logDir: logsDir,
  resourcesDir,
  tempDir,
  env: {},
});
ensureDesktopRuntimeDirectories(runtimePaths);
const backendPaths = getDesktopBackendPaths(repoRoot, runtimePaths);
const vmRuntimeDir = join(runtimePaths.dataDir, 'vm');

mkdirSync(join(vmRuntimeDir, 'state/commands/jobs'), { recursive: true });
mkdirSync(join(vmRuntimeDir, 'images'), { recursive: true });
mkdirSync(join(vmRuntimeDir, 'logs'), { recursive: true });
writeFileSync(join(vmRuntimeDir, 'state/stale-marker'), 'stale\n');
writeFileSync(join(vmRuntimeDir, 'images/manifest.json'), '{"corrupt":true}\n');
writeFileSync(join(vmRuntimeDir, 'logs/last-error.log'), 'previous boot failed\n');
writeFileSync(join(vmRuntimeDir, 'logs/support.log'), 'diagnostics preserved\n');
chmodSync(backendPaths.macosVmPackagedHelperPath, 0o755);

const repairResult = repairPackagedMacosVmRuntime({
  paths: backendPaths,
  env: { AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm' },
});
assert(repairResult.ok, 'repair result must be ok');
assert(repairResult.runtimeDir === vmRuntimeDir, 'repair must target the app-owned VM runtime dir');
assert(repairResult.repairedAssets, 'repair must recopy packaged VM assets');
assert(repairResult.preservedDiagnostics, 'repair must preserve diagnostics by default');
assert(repairResult.preservedProjectFolders, 'repair must preserve Project folders');
assert(!existsSync(join(vmRuntimeDir, 'state')), 'repair must delete stale VM state');
assert(existsSync(join(vmRuntimeDir, 'logs/support.log')), 'repair must preserve diagnostic logs');
assert(existsSync(join(vmRuntimeDir, 'images/manifest.json')), 'repair must restore packaged assets');
assert(readFileSync(projectFile, 'utf8').includes('Project data'), 'repair must not delete Project data');

const prepare = runHelper(['prepare', '--runtime-dir', vmRuntimeDir]);
assert(prepare.ok && prepare.state === 'disabled', 'packaged helper prepare must succeed after repair');
const start = runHelper(['start', '--runtime-dir', vmRuntimeDir, '--workspace', projectDir]);
assert(start.ok && start.state === 'ready', 'packaged helper must start VM after repair');
const status = runHelper(['status', '--runtime-dir', vmRuntimeDir]);
assert(status.ok && status.state === 'ready', 'packaged helper must report ready after repair');
const stop = runHelper(['stop', '--runtime-dir', vmRuntimeDir]);
assert(stop.ok && stop.state === 'disabled', 'packaged helper must stop after repair smoke');

const report = {
  ok: true,
  workDir,
  packagedVmDir,
  projectDir,
  vmRuntimeDir,
  repairResult,
  helperStates: {
    prepare: prepare.state,
    start: start.state,
    status: status.state,
    stop: stop.state,
  },
  preservedProjectFile: projectFile,
  preservedDiagnostics: join(vmRuntimeDir, 'logs/support.log'),
  restoredManifest: join(vmRuntimeDir, 'images/manifest.json'),
};

console.log(JSON.stringify(report, null, 2));

function runHelper(args) {
  const stdout = execFileSync(backendPaths.macosVmPackagedHelperPath, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  return JSON.parse(stdout);
}

async function importDistModule(fileName) {
  const modulePath = join(desktopDir, 'dist/main', fileName);
  if (!existsSync(modulePath) || !statSync(modulePath).isFile()) {
    throw new Error(`Desktop build output is missing at ${modulePath}. Run pnpm --filter @agent-platform/desktop build first.`);
  }
  return import(pathToFileURL(modulePath).href);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
