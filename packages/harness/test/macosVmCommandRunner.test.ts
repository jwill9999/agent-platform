import type { ChildProcess } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createConfiguredCommandRunner, createMacosVmCommandRunner } from '../src/index.js';
import type { CommandRunnerRequest } from '../src/index.js';

function request(workspaceRoot: string, overrides: Partial<CommandRunnerRequest> = {}) {
  return {
    command: 'pwd',
    cwd: workspaceRoot,
    env: { mode: 'explicit' as const, variables: { CI: '1' } },
    timeoutMs: 1000,
    maxOutputBytes: 4096,
    audit: { toolId: 'sys_bash' },
    workspace: { root: workspaceRoot },
    ...overrides,
  };
}

function fakeChildProcess(): ChildProcess {
  return { on: vi.fn() } as unknown as ChildProcess;
}

describe('macOS VM command runner adapter', () => {
  it('calls the native helper with exec and maps unavailable responses to denied results', async () => {
    const workspaceRoot = await realpath(
      await mkdtemp(join(tmpdir(), 'agent-platform-macos-vm-runner-')),
    );
    const execFile = vi.fn((_binary, _args, _options, callback) => {
      callback(
        null,
        '{"message":"VM runner is not prepared.","mode":"macos-vm","ok":false,"state":"unavailable"}\n',
        '',
      );
      return fakeChildProcess();
    });
    const runner = createMacosVmCommandRunner({
      helperPath: '/app/macos-vm-runner',
      runtimeDir: '/app/vm',
      execFile,
    });

    const result = await runner.run(request(workspaceRoot));

    expect(execFile).toHaveBeenCalledWith(
      '/app/macos-vm-runner',
      [
        'exec',
        '--runtime-dir',
        '/app/vm',
        '--workspace',
        workspaceRoot,
        '--cwd',
        workspaceRoot,
        '--timeout-ms',
        '1000',
        '--max-output-bytes',
        '4096',
        '--',
        'pwd',
      ],
      expect.objectContaining({
        cwd: workspaceRoot,
        env: { CI: '1', TERM: 'dumb' },
        timeout: 1000,
        maxBuffer: 8192,
      }),
      expect.any(Function),
    );
    expect(result).toMatchObject({
      status: 'denied',
      code: 'MACOS_VM_RUNNER_UNAVAILABLE',
      reason: 'macos_vm_runner_unavailable',
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('maps successful VM execution responses to completed command results', async () => {
    const workspaceRoot = await realpath(
      await mkdtemp(join(tmpdir(), 'agent-platform-macos-vm-runner-')),
    );
    const execFile = vi.fn((_binary, _args, _options, callback) => {
      callback(
        null,
        '{"exitCode":0,"message":"Command completed.","mode":"macos-vm","ok":true,"state":"ready","stdout":"/workspace\\n","stderr":"","durationMs":12}\n',
        '',
      );
      return fakeChildProcess();
    });
    const runner = createMacosVmCommandRunner({
      helperPath: '/app/macos-vm-runner',
      runtimeDir: '/app/vm',
      execFile,
    });

    await expect(runner.run(request(workspaceRoot))).resolves.toEqual({
      status: 'success',
      stdout: '/workspace\n',
      stderr: '',
      exitCode: 0,
      durationMs: 12,
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('does not fall back to host execution when the configured helper process fails', async () => {
    const workspaceRoot = await realpath(
      await mkdtemp(join(tmpdir(), 'agent-platform-macos-vm-runner-')),
    );
    const execFile = vi.fn((_binary, _args, _options, callback) => {
      callback(new Error('spawn ENOENT'), '', '');
      return fakeChildProcess();
    });
    const runner = createMacosVmCommandRunner({
      helperPath: '/missing/macos-vm-runner',
      runtimeDir: '/app/vm',
      execFile,
    });

    await expect(runner.run(request(workspaceRoot))).resolves.toMatchObject({
      status: 'denied',
      code: 'MACOS_VM_RUNNER_UNAVAILABLE',
      reason: 'macos_vm_runner_process_failed',
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('returns an actionable reason when the helper binary is missing', async () => {
    const workspaceRoot = await realpath(
      await mkdtemp(join(tmpdir(), 'agent-platform-macos-vm-runner-')),
    );
    const missingHelperError = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    const execFile = vi.fn((_binary, _args, _options, callback) => {
      callback(missingHelperError, '', '');
      return fakeChildProcess();
    });
    const runner = createMacosVmCommandRunner({
      helperPath: '/missing/macos-vm-runner',
      runtimeDir: '/app/vm',
      execFile,
    });

    await expect(runner.run(request(workspaceRoot))).resolves.toMatchObject({
      status: 'denied',
      code: 'MACOS_VM_RUNNER_UNAVAILABLE',
      reason: 'macos_vm_runner_helper_missing',
      message: 'macOS VM runner helper binary was not found.',
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('uses the helper path from environment for configured macOS VM execution', async () => {
    const workspaceRoot = await realpath(
      await mkdtemp(join(tmpdir(), 'agent-platform-macos-vm-runner-')),
    );
    const runner = createConfiguredCommandRunner({
      env: {
        AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
        AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: '/missing/macos-vm-runner',
        AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR: '/app/vm',
      },
    });

    await expect(runner.run(request(workspaceRoot))).resolves.toMatchObject({
      status: 'denied',
      code: 'MACOS_VM_RUNNER_UNAVAILABLE',
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('fails closed when macOS VM mode is selected without a runtime directory', async () => {
    const workspaceRoot = await realpath(
      await mkdtemp(join(tmpdir(), 'agent-platform-macos-vm-runner-')),
    );
    const runner = createConfiguredCommandRunner({
      env: {
        AGENT_PLATFORM_COMMAND_RUNNER: 'macos-vm',
        AGENT_PLATFORM_MACOS_VM_RUNNER_PATH: '/app/macos-vm-runner',
      },
    });

    await expect(runner.run(request(workspaceRoot))).resolves.toMatchObject({
      status: 'denied',
      code: 'COMMAND_RUNNER_UNAVAILABLE',
      reason: 'command_runner_disabled',
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });
});
