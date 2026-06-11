import { describe, expect, it, vi } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MACOS_VM_PRODUCTION_POLICY,
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

async function createMacosVmRuntimeFixture({
  withAssets = true,
}: {
  withAssets?: boolean;
} = {}): Promise<{ tempRoot: string; helperPath: string; runtimeDir: string }> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-health-'));
  const helperPath = await createExecutableHelper(tempRoot);
  const runtimeDir = join(tempRoot, 'runtime');
  if (withAssets) {
    await createRuntimeAssets(runtimeDir);
  } else {
    await mkdir(runtimeDir, { recursive: true });
  }
  return { tempRoot, helperPath, runtimeDir };
}

function getMacosVmHealth(helperPath: string, runtimeDir: string): CommandRunnerHealth {
  return getConfiguredCommandRunnerHealth({
    env: {
      AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
      AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: helperPath,
      AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: runtimeDir,
    },
  });
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
      details: expect.objectContaining({
        cpuCount: MACOS_VM_PRODUCTION_POLICY.cpuCount,
        memoryMB: MACOS_VM_PRODUCTION_POLICY.memoryMB,
        networkPolicy: 'disabled',
        guestUser: 'agentplatform',
        workspaceMount: '/workspace',
      }) as CommandRunnerHealth['details'],
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
      details: expect.objectContaining({
        helperPath,
        runtimeDir: join(tempRoot, 'missing-runtime'),
        cpuCount: MACOS_VM_PRODUCTION_POLICY.cpuCount,
        memoryMB: MACOS_VM_PRODUCTION_POLICY.memoryMB,
        networkPolicy: 'disabled',
      }) as CommandRunnerHealth['details'],
    } satisfies CommandRunnerHealth);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as unavailable when runtime assets are missing', async () => {
    const { tempRoot, helperPath, runtimeDir } = await createMacosVmRuntimeFixture({
      withAssets: false,
    });

    expect(getMacosVmHealth(helperPath, runtimeDir)).toMatchObject({
      mode: 'macos-vm',
      status: 'unavailable',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_assets_missing',
    } satisfies Partial<CommandRunnerHealth>);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as starting when daemon markers are present but not ready', async () => {
    const { tempRoot, helperPath, runtimeDir } = await createMacosVmRuntimeFixture();
    await mkdir(join(runtimeDir, 'state'), { recursive: true });
    await writeFile(join(runtimeDir, 'state/daemon.pid'), `${process.pid}\n`);

    expect(getMacosVmHealth(helperPath, runtimeDir)).toMatchObject({
      mode: 'macos-vm',
      status: 'starting',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_starting',
    } satisfies Partial<CommandRunnerHealth>);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it('reports macOS VM mode as failed closed when the runner records an error', async () => {
    const { tempRoot, helperPath, runtimeDir } = await createMacosVmRuntimeFixture();
    await mkdir(join(runtimeDir, 'logs'), { recursive: true });
    await writeFile(join(runtimeDir, 'logs/last-error.log'), 'boot failed\n');

    expect(getMacosVmHealth(helperPath, runtimeDir)).toMatchObject({
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
    const { tempRoot, helperPath, runtimeDir } = await createMacosVmRuntimeFixture();
    const stateDir = join(runtimeDir, 'state');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'runner.sock'), '');
    await writeFile(join(stateDir, 'daemon.pid'), `${process.pid}\n`);
    await writeFile(join(stateDir, 'daemon.heartbeat'), `${Date.now()}\n`);
    const now = new Date();
    await utimes(join(stateDir, 'daemon.heartbeat'), now, now);

    expect(getMacosVmHealth(helperPath, runtimeDir)).toMatchObject({
      mode: 'macos-vm',
      status: 'ready',
      production: true,
      canExecute: true,
      reason: 'production_runner_ready',
      message: 'macOS VM command execution is ready.',
      details: expect.objectContaining({
        cpuCount: MACOS_VM_PRODUCTION_POLICY.cpuCount,
        memoryMB: MACOS_VM_PRODUCTION_POLICY.memoryMB,
        commandTimeoutMaxMs: MACOS_VM_PRODUCTION_POLICY.commandTimeoutMaxMs,
        outputMaxBytes: MACOS_VM_PRODUCTION_POLICY.outputMaxBytes,
        networkPolicy: 'disabled',
        filesystemPolicy: 'project_rw_workspace_guest_owned_scratch',
      }) as CommandRunnerHealth['details'],
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
      details: expect.objectContaining({
        cpuCount: MACOS_VM_PRODUCTION_POLICY.cpuCount,
        memoryMB: MACOS_VM_PRODUCTION_POLICY.memoryMB,
        networkPolicy: 'disabled',
        guestUser: 'agentplatform',
      }) as CommandRunnerHealth['details'],
    } satisfies CommandRunnerHealth);
  });
});
