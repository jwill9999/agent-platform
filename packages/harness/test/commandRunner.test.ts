import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import {
  commandRunnerResultToOutput,
  createProjectScopedCommandRunner,
  createSystemToolExecutor,
  type CommandRunner,
} from '../src/index.js';
import { PathJail } from '../src/index.js';

describe('CommandRunner boundary', () => {
  it('passes sys_bash execution through a swappable command runner', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const runner: CommandRunner = {
      run: vi.fn().mockResolvedValue({
        status: 'success',
        stdout: 'hello\n',
        stderr: '',
        exitCode: 0,
        durationMs: 12,
      }),
    };
    const executor = createSystemToolExecutor({ workspaceRoot, commandRunner: runner });

    await expect(
      executor('sys_bash', { command: 'echo hello', timeout_ms: 250_000 }),
    ).resolves.toEqual({
      type: 'tool_result',
      toolId: 'sys_bash',
      data: { stdout: 'hello\n', stderr: '', exitCode: 0 },
    });

    expect(runner.run).toHaveBeenCalledWith({
      command: 'echo hello',
      cwd: workspaceRoot,
      env: { mode: 'inherit', variables: {} },
      timeoutMs: 120_000,
      maxOutputBytes: 100_000,
      workspace: { root: workspaceRoot },
      audit: { toolId: 'sys_bash' },
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('maps command success and command failure results to existing bash tool output shape', () => {
    expect(
      commandRunnerResultToOutput('sys_bash', {
        status: 'success',
        stdout: 'ok',
        stderr: '',
        exitCode: 0,
        durationMs: 5,
      }),
    ).toEqual({
      type: 'tool_result',
      toolId: 'sys_bash',
      data: { stdout: 'ok', stderr: '', exitCode: 0 },
    });

    expect(
      commandRunnerResultToOutput('sys_bash', {
        status: 'failed',
        stdout: '',
        stderr: 'nope',
        exitCode: 2,
        durationMs: 5,
      }),
    ).toEqual({
      type: 'tool_result',
      toolId: 'sys_bash',
      data: { stdout: '', stderr: 'nope', exitCode: 2 },
    });
  });

  it('maps denied and approval-required command results distinctly', () => {
    expect(
      commandRunnerResultToOutput('sys_bash', {
        status: 'denied',
        code: 'COMMAND_DENIED',
        message: 'outside project root',
        reason: 'outside_root',
      }),
    ).toEqual({
      type: 'error',
      code: 'COMMAND_DENIED',
      message: 'outside project root',
    });

    expect(
      commandRunnerResultToOutput('sys_bash', {
        status: 'approval_required',
        riskTier: 'high',
        message: 'destructive command needs approval',
        reason: 'destructive_command',
      }),
    ).toEqual({
      type: 'error',
      code: 'APPROVAL_REQUIRED',
      message: 'destructive command needs approval',
    });
  });

  it('rewrites workspace paths and defaults cwd through the project-scoped runner', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const realWorkspaceRoot = await realpath(workspaceRoot);
    const runner: CommandRunner = {
      run: vi.fn().mockResolvedValue({
        status: 'success',
        stdout: 'ok',
        stderr: '',
        exitCode: 0,
        durationMs: 4,
      }),
    };
    const scopedRunner = createProjectScopedCommandRunner({
      delegate: runner,
      pathJail: new PathJail([
        {
          label: 'Project',
          hostPath: workspaceRoot,
          containerPath: '/workspace',
          permission: 'read_write',
        },
      ]),
    });

    await scopedRunner.run({
      command: 'cat /workspace/input.txt',
      cwd: workspaceRoot,
      env: { mode: 'inherit', variables: {} },
      timeoutMs: 1000,
      maxOutputBytes: 100,
      workspace: { root: workspaceRoot },
      audit: { toolId: 'sys_bash' },
    });

    expect(runner.run).toHaveBeenCalledWith({
      command: `cat ${join(realWorkspaceRoot, 'input.txt')}`,
      cwd: realWorkspaceRoot,
      env: { mode: 'inherit', variables: {} },
      timeoutMs: 1000,
      maxOutputBytes: 100,
      workspace: { root: workspaceRoot },
      audit: { toolId: 'sys_bash' },
    });

    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('denies outside-root command paths and cwd before delegating', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const outsideRoot = await mkdtemp(join(tmpdir(), 'agent-platform-outside-'));
    const runner: CommandRunner = {
      run: vi.fn(),
    };
    const scopedRunner = createProjectScopedCommandRunner({
      delegate: runner,
      pathJail: new PathJail([
        { label: 'Project', hostPath: workspaceRoot, permission: 'read_write' },
      ]),
    });

    await expect(
      scopedRunner.run({
        command: `cat ${join(outsideRoot, 'secret.txt')}`,
        cwd: workspaceRoot,
        env: { mode: 'inherit', variables: {} },
        timeoutMs: 1000,
        maxOutputBytes: 100,
        workspace: { root: workspaceRoot },
        audit: { toolId: 'sys_bash' },
      }),
    ).resolves.toMatchObject({
      status: 'denied',
      code: 'PATH_ACCESS_DENIED',
      reason: 'outside_project',
    });

    await expect(
      scopedRunner.run({
        command: 'pwd',
        cwd: outsideRoot,
        env: { mode: 'inherit', variables: {} },
        timeoutMs: 1000,
        maxOutputBytes: 100,
        workspace: { root: workspaceRoot },
        audit: { toolId: 'sys_bash' },
      }),
    ).resolves.toMatchObject({
      status: 'denied',
      code: 'PATH_ACCESS_DENIED',
      reason: 'outside_project_cwd',
    });

    expect(runner.run).not.toHaveBeenCalled();
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  });

  it('denies symlink escapes before command execution', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const outsideRoot = await mkdtemp(join(tmpdir(), 'agent-platform-outside-'));
    await writeFile(join(outsideRoot, 'secret.txt'), 'secret');
    await symlink(join(outsideRoot, 'secret.txt'), join(workspaceRoot, 'linked-secret.txt'));
    const runner: CommandRunner = {
      run: vi.fn(),
    };
    const scopedRunner = createProjectScopedCommandRunner({
      delegate: runner,
      pathJail: new PathJail([
        { label: 'Project', hostPath: workspaceRoot, permission: 'read_write' },
      ]),
    });

    await expect(
      scopedRunner.run({
        command: 'cat ./linked-secret.txt',
        cwd: workspaceRoot,
        env: { mode: 'inherit', variables: {} },
        timeoutMs: 1000,
        maxOutputBytes: 100,
        workspace: { root: workspaceRoot },
        audit: { toolId: 'sys_bash' },
      }),
    ).resolves.toMatchObject({
      status: 'denied',
      code: 'PATH_ACCESS_DENIED',
      reason: 'outside_project',
    });

    expect(runner.run).not.toHaveBeenCalled();
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  });
});
