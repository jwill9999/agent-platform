import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import {
  commandRunnerResultToOutput,
  createConfiguredCommandRunner,
  createDockerSandboxCommandRunner,
  createProjectScopedCommandRunner,
  createSystemToolExecutor,
  type CommandRunner,
  type CommandRunnerRequest,
} from '../src/index.js';
import { PathJail } from '../src/index.js';

function commandRequest(
  workspaceRoot: string,
  overrides: Partial<CommandRunnerRequest> = {},
): CommandRunnerRequest {
  return {
    command: 'pwd',
    cwd: workspaceRoot,
    env: { mode: 'inherit', variables: {} },
    timeoutMs: 1000,
    maxOutputBytes: 100,
    workspace: { root: workspaceRoot },
    audit: { toolId: 'sys_bash' },
    ...overrides,
  };
}

function scopedRunner(workspaceRoot: string, delegate: CommandRunner): CommandRunner {
  return createProjectScopedCommandRunner({
    delegate,
    pathJail: new PathJail([
      { label: 'Project', hostPath: workspaceRoot, permission: 'read_write' },
    ]),
  });
}

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
      approval: { granted: false },
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

    await scopedRunner.run(commandRequest(workspaceRoot, { command: 'cat /workspace/input.txt' }));

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
    const scoped = scopedRunner(workspaceRoot, runner);

    await expect(
      scoped.run(
        commandRequest(workspaceRoot, {
          command: `cat ${join(outsideRoot, 'secret.txt')}`,
        }),
      ),
    ).resolves.toMatchObject({
      status: 'denied',
      code: 'PATH_ACCESS_DENIED',
      reason: 'outside_project',
    });

    await expect(
      scoped.run(
        commandRequest(workspaceRoot, {
          command: 'pwd',
          cwd: outsideRoot,
        }),
      ),
    ).resolves.toMatchObject({
      status: 'denied',
      code: 'PATH_ACCESS_DENIED',
      reason: 'outside_project_cwd',
    });

    expect(runner.run).not.toHaveBeenCalled();
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  });

  it('requires approval for write commands and denies destructive commands before delegating', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const runner: CommandRunner = {
      run: vi.fn(),
    };
    const scoped = scopedRunner(workspaceRoot, runner);

    await expect(
      scoped.run(commandRequest(workspaceRoot, { command: 'touch generated/report.md' })),
    ).resolves.toMatchObject({
      status: 'approval_required',
      riskTier: 'high',
      reason: 'write_command',
    });

    await expect(
      scoped.run(commandRequest(workspaceRoot, { command: 'rm -rf generated' })),
    ).resolves.toMatchObject({
      status: 'denied',
      code: 'COMMAND_POLICY_DENIED',
      reason: 'recursive_removal',
    });

    expect(runner.run).not.toHaveBeenCalled();
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('delegates approval-gated project commands after approval is granted', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const runner: CommandRunner = {
      run: vi.fn().mockResolvedValue({
        status: 'success',
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: 4,
      }),
    };
    const scoped = scopedRunner(workspaceRoot, runner);

    await expect(
      scoped.run(
        commandRequest(workspaceRoot, {
          command: 'touch generated/report.md',
          approval: { granted: true },
        }),
      ),
    ).resolves.toMatchObject({ status: 'success' });

    expect(runner.run).toHaveBeenCalledOnce();
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('denies symlink escapes before command execution', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const outsideRoot = await mkdtemp(join(tmpdir(), 'agent-platform-outside-'));
    await writeFile(join(outsideRoot, 'secret.txt'), 'secret');
    await symlink(join(outsideRoot, 'secret.txt'), join(workspaceRoot, 'linked-secret.txt'));
    const runner: CommandRunner = {
      run: vi.fn(),
    };
    const scoped = scopedRunner(workspaceRoot, runner);

    await expect(
      scoped.run(commandRequest(workspaceRoot, { command: 'cat ./linked-secret.txt' })),
    ).resolves.toMatchObject({
      status: 'denied',
      code: 'PATH_ACCESS_DENIED',
      reason: 'outside_project',
    });

    expect(runner.run).not.toHaveBeenCalled();
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  });

  it('runs commands through a Docker sandbox with a project-only mount and no inherited secrets', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const realWorkspaceRoot = await realpath(workspaceRoot);
    process.env.AGENT_PLATFORM_TEST_SECRET = 'must-not-leak';
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, 'ok\n', '');
      return { on: vi.fn() };
    });
    const runner = createDockerSandboxCommandRunner({ execFile });

    await expect(
      runner.run(
        commandRequest(workspaceRoot, {
          command: `cat ${realWorkspaceRoot}/input.txt`,
          cwd: realWorkspaceRoot,
          env: { mode: 'inherit', variables: { CI: '1' } },
        }),
      ),
    ).resolves.toMatchObject({
      status: 'success',
      stdout: 'ok\n',
      exitCode: 0,
    });

    expect(execFile).toHaveBeenCalledOnce();
    const [file, args, options] = execFile.mock.calls[0]!;
    expect(file).toBe('docker');
    expect(args).toEqual(
      expect.arrayContaining([
        'run',
        '--rm',
        '--network',
        'none',
        '--memory',
        '2g',
        '--cpus',
        '2',
        '--pids-limit',
        '256',
        '--user',
        '1000:1000',
        '-v',
        `${realWorkspaceRoot}:/workspace:rw`,
        '-w',
        '/workspace',
      ]),
    );
    expect(args.at(-3)).toBe('sh');
    expect(args.at(-2)).toBe('-lc');
    expect(args.at(-1)).toBe('cat /workspace/input.txt');
    expect(options.cwd).toBe(realWorkspaceRoot);
    expect(options.env).toEqual({ CI: '1', TERM: 'dumb' });
    expect(options.env).not.toHaveProperty('AGENT_PLATFORM_TEST_SECRET');

    delete process.env.AGENT_PLATFORM_TEST_SECRET;
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('defaults configured command execution to disabled when no mode is provided', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const dockerRunner: CommandRunner = { run: vi.fn() };
    const hostRunner: CommandRunner = { run: vi.fn() };
    const runner = createConfiguredCommandRunner({ env: {}, dockerRunner, hostRunner });

    await expect(runner.run(commandRequest(workspaceRoot))).resolves.toMatchObject({
      status: 'denied',
      code: 'COMMAND_RUNNER_UNAVAILABLE',
      reason: 'command_runner_disabled',
    });
    expect(dockerRunner.run).not.toHaveBeenCalled();
    expect(hostRunner.run).not.toHaveBeenCalled();
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('uses host execution only when explicitly requested', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const dockerRunner: CommandRunner = { run: vi.fn() };
    const hostRunner: CommandRunner = {
      run: vi.fn().mockResolvedValue({
        status: 'success',
        stdout: 'host\n',
        stderr: '',
        exitCode: 0,
        durationMs: 1,
      }),
    };
    const runner = createConfiguredCommandRunner({
      env: { AGENT_PLATFORM_COMMAND_RUNNER: 'host' },
      dockerRunner,
      hostRunner,
    });

    await expect(runner.run(commandRequest(workspaceRoot))).resolves.toMatchObject({
      status: 'success',
      stdout: 'host\n',
    });
    expect(dockerRunner.run).not.toHaveBeenCalled();
    expect(hostRunner.run).toHaveBeenCalledOnce();
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('uses Docker sandbox execution only when explicitly requested', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-platform-runner-'));
    const dockerRunner: CommandRunner = {
      run: vi.fn().mockResolvedValue({
        status: 'success',
        stdout: 'docker\n',
        stderr: '',
        exitCode: 0,
        durationMs: 1,
      }),
    };
    const hostRunner: CommandRunner = { run: vi.fn() };
    const runner = createConfiguredCommandRunner({
      env: { AGENT_PLATFORM_COMMAND_RUNNER: 'docker-sandbox' },
      dockerRunner,
      hostRunner,
    });

    await expect(runner.run(commandRequest(workspaceRoot))).resolves.toMatchObject({
      status: 'success',
      stdout: 'docker\n',
    });
    expect(dockerRunner.run).toHaveBeenCalledOnce();
    expect(hostRunner.run).not.toHaveBeenCalled();
    await rm(workspaceRoot, { recursive: true, force: true });
  });
});
