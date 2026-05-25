import { describe, expect, it, vi } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  getConfiguredCommandRunnerHealth,
  type CommandRunner,
  type CommandRunnerHealth,
} from '../src/index.js';

const macosVmRunner: CommandRunner = {
  run: vi.fn(),
};

async function createExecutableHelper(root: string): Promise<string> {
  const helperPath = join(root, 'macos-vm-runner');
  await writeFile(helperPath, '#!/bin/sh\n');
  await chmod(helperPath, 0o755);
  return helperPath;
}

async function createRuntimeAssets(runtimeDir: string): Promise<void> {
  const imagesDir = join(runtimeDir, 'images');
  await mkdir(imagesDir, { recursive: true });
  await Promise.all(
    ['manifest.json', 'base-linux.img', 'vmlinuz', 'initrd.img', 'guest-bootstrap.sh'].map(
      (asset) => writeFile(join(imagesDir, asset), `${asset}\n`),
    ),
  );
}

describe('CommandRunner health contract', () => {
  it('reports disabled mode as non-executable and non-production', () => {
    expect(getConfiguredCommandRunnerHealth({ env: {} })).toEqual({
      mode: 'disabled',
      status: 'disabled',
      production: false,
      canExecute: false,
      reason: 'command_runner_disabled',
      message: 'Command execution is disabled because no production runner is configured.',
    } satisfies CommandRunnerHealth);
  });

  it('reports host mode as executable development-only mode', () => {
    expect(
      getConfiguredCommandRunnerHealth({ env: { AGENT_PLATFORM_COMMAND_RUNNER: 'host' } }),
    ).toEqual({
      mode: 'host',
      status: 'ready',
      production: false,
      canExecute: true,
      reason: 'development_only',
      message: 'Host command execution is available for explicit local development only.',
    } satisfies CommandRunnerHealth);
  });

  it('reports Docker sandbox mode as executable development-only mode', () => {
    expect(
      getConfiguredCommandRunnerHealth({
        env: { AGENT_PLATFORM_COMMAND_RUNNER: 'docker-sandbox' },
      }),
    ).toEqual({
      mode: 'docker-sandbox',
      status: 'ready',
      production: false,
      canExecute: true,
      reason: 'development_only',
      message: 'Docker sandbox execution is available for development and adapter testing only.',
    } satisfies CommandRunnerHealth);
  });

  it('reports macOS VM mode as unavailable until a runner is configured', () => {
    expect(
      getConfiguredCommandRunnerHealth({
        env: { AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm' },
      }),
    ).toEqual({
      mode: 'macos-vm',
      status: 'unavailable',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_helper_missing',
      message: 'macOS VM command execution is selected but the VM helper path is not configured.',
    } satisfies CommandRunnerHealth);
  });

  it('reports macOS VM mode as unavailable when the runtime directory is missing', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-health-'));
    const helperPath = await createExecutableHelper(tempRoot);

    expect(
      getConfiguredCommandRunnerHealth({
        env: {
          AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
          AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: helperPath,
          AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: join(tempRoot, 'missing-runtime'),
        },
      }),
    ).toEqual({
      mode: 'macos-vm',
      status: 'unavailable',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_runtime_missing',
      message: 'macOS VM command execution is selected but the runtime directory is unavailable.',
      details: {
        helperPath,
        runtimeDir: join(tempRoot, 'missing-runtime'),
      },
    } satisfies CommandRunnerHealth);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as unavailable when runtime assets are missing', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-health-'));
    const helperPath = await createExecutableHelper(tempRoot);
    const runtimeDir = join(tempRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });

    expect(
      getConfiguredCommandRunnerHealth({
        env: {
          AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
          AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: helperPath,
          AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: runtimeDir,
        },
      }),
    ).toMatchObject({
      mode: 'macos-vm',
      status: 'unavailable',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_assets_missing',
    } satisfies Partial<CommandRunnerHealth>);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as starting when daemon markers are present but not ready', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-health-'));
    const helperPath = await createExecutableHelper(tempRoot);
    const runtimeDir = join(tempRoot, 'runtime');
    await createRuntimeAssets(runtimeDir);
    await mkdir(join(runtimeDir, 'state'), { recursive: true });
    await writeFile(join(runtimeDir, 'state/daemon.pid'), `${process.pid}\n`);

    expect(
      getConfiguredCommandRunnerHealth({
        env: {
          AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
          AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: helperPath,
          AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: runtimeDir,
        },
      }),
    ).toMatchObject({
      mode: 'macos-vm',
      status: 'starting',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_starting',
    } satisfies Partial<CommandRunnerHealth>);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as failed closed when the runner records an error', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-health-'));
    const helperPath = await createExecutableHelper(tempRoot);
    const runtimeDir = join(tempRoot, 'runtime');
    await createRuntimeAssets(runtimeDir);
    await mkdir(join(runtimeDir, 'logs'), { recursive: true });
    await writeFile(join(runtimeDir, 'logs/last-error.log'), 'boot failed\n');

    expect(
      getConfiguredCommandRunnerHealth({
        env: {
          AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
          AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: helperPath,
          AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: runtimeDir,
        },
      }),
    ).toMatchObject({
      mode: 'macos-vm',
      status: 'failed',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_failed_closed',
      message: 'macOS VM command execution failed closed: boot failed',
    } satisfies Partial<CommandRunnerHealth>);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as ready only when the daemon is alive and fresh', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-health-'));
    const helperPath = await createExecutableHelper(tempRoot);
    const runtimeDir = join(tempRoot, 'runtime');
    const stateDir = join(runtimeDir, 'state');
    await createRuntimeAssets(runtimeDir);
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'runner.sock'), '');
    await writeFile(join(stateDir, 'daemon.pid'), `${process.pid}\n`);
    await writeFile(join(stateDir, 'daemon.heartbeat'), `${Date.now()}\n`);
    const now = new Date();
    await utimes(join(stateDir, 'daemon.heartbeat'), now, now);

    expect(
      getConfiguredCommandRunnerHealth({
        env: {
          AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
          AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: helperPath,
          AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: runtimeDir,
        },
      }),
    ).toMatchObject({
      mode: 'macos-vm',
      status: 'ready',
      production: true,
      canExecute: true,
      reason: 'production_runner_ready',
      message: 'macOS VM command execution is ready.',
    } satisfies Partial<CommandRunnerHealth>);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as production-ready when a runner is configured', () => {
    expect(
      getConfiguredCommandRunnerHealth({
        env: { AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm' },
        macosVmRunner,
      }),
    ).toEqual({
      mode: 'macos-vm',
      status: 'ready',
      production: true,
      canExecute: true,
      reason: 'production_runner_ready',
      message: 'macOS VM command execution is configured.',
    } satisfies CommandRunnerHealth);
  });
});
