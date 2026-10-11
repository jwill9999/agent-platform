#!/usr/bin/env node
/* global console, process */
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SWIFT_BINARY = '/usr/bin/swift';
export const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const swiftBuildArgs = ['build', '--package-path', 'native/macos-vm-runner'];

export function parseHelperArgument(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== '--helper' || !args[1]) {
    throw new Error('Usage: sign-macos-vm-runner.mjs [--helper <exact executable path>]');
  }
  return args[1];
}

export function assertExecutableHelper(path, stat = statSync) {
  if (!isAbsolute(path) || /[\r\n\0]/u.test(path)) {
    throw new Error('macOS VM helper path must be absolute and single-line');
  }
  let info;
  try {
    info = stat(path);
  } catch {
    throw new Error(`macOS VM helper binary is missing: ${path}`);
  }
  if (!info.isFile() || (info.mode & 0o111) === 0) {
    throw new Error(`macOS VM helper must be an executable file: ${path}`);
  }
  return path;
}

export function resolveMacosVmHelper({
  helper,
  run = execFileSync,
  stat = statSync,
  cwd = desktopDir,
} = {}) {
  if (helper !== undefined) return assertExecutableHelper(resolve(helper), stat);
  const output = run(SWIFT_BINARY, [...swiftBuildArgs, '--show-bin-path'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const binDir = output.trim();
  if (!binDir || !isAbsolute(binDir) || /[\r\n\0]/u.test(binDir)) {
    throw new Error('Swift build output must be one absolute directory');
  }
  return assertExecutableHelper(join(binDir, 'macos-vm-runner'), stat);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(resolveMacosVmHelper());
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unable to resolve macOS VM helper');
    process.exitCode = 1;
  }
}
