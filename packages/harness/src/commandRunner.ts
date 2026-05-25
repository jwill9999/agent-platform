import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Output, RiskTier } from '@agent-platform/contracts';

import { classifyBashCommand } from './security/bashCommandPolicy.js';
import { validateBashWorkspacePolicy } from './security/bashWorkspacePolicy.js';
import type { PathJail } from './security/pathJail.js';
import { errorMessage, toolError, toolResult, truncate } from './tools/toolHelpers.js';

export type CommandEnvironmentPolicy = {
  mode: 'inherit' | 'explicit';
  variables: Record<string, string>;
};

export type CommandRunnerWorkspace = {
  root: string;
  projectId?: string;
  displayName?: string;
};

export type CommandRunnerAuditMetadata = {
  toolId: string;
  toolCallId?: string;
  sessionId?: string;
  runId?: string;
  reason?: string;
};

export type CommandRunnerRequest = {
  command: string;
  cwd: string;
  env: CommandEnvironmentPolicy;
  timeoutMs: number;
  maxOutputBytes: number;
  approval?: { granted: boolean };
  workspace?: CommandRunnerWorkspace;
  audit: CommandRunnerAuditMetadata;
};

export type CommandRunnerCompletedResult = {
  status: 'success' | 'failed';
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export type CommandRunnerDeniedResult = {
  status: 'denied';
  code: string;
  message: string;
  reason: string;
};

export type CommandRunnerApprovalRequiredResult = {
  status: 'approval_required';
  riskTier: RiskTier;
  message: string;
  reason: string;
};

export type CommandRunnerResult =
  | CommandRunnerCompletedResult
  | CommandRunnerDeniedResult
  | CommandRunnerApprovalRequiredResult;

export type CommandRunner = {
  run(request: CommandRunnerRequest): Promise<CommandRunnerResult>;
};

export type CommandRunnerMode = 'disabled' | 'host' | 'docker-sandbox' | 'macos-vm';

export type CommandRunnerHealthStatus = 'ready' | 'unavailable' | 'disabled';

export type CommandRunnerHealth = {
  mode: CommandRunnerMode;
  status: CommandRunnerHealthStatus;
  production: boolean;
  canExecute: boolean;
  reason?: string;
  message?: string;
  details?: Record<string, string | number | boolean>;
};

type ExecFileLike = typeof execFile;

export type DockerSandboxCommandRunnerOptions = {
  execFile?: ExecFileLike;
  dockerBinary?: string;
  image?: string;
  memory?: string;
  cpus?: string;
  pidsLimit?: number;
  user?: string;
  network?: 'none';
  tmpSize?: string;
};

export type ConfiguredCommandRunnerOptions = {
  env?: Record<string, string | undefined>;
  dockerRunner?: CommandRunner;
  hostRunner?: CommandRunner;
  macosVmRunner?: CommandRunner;
  macosVmHelperPath?: string;
  macosVmRuntimeDir?: string;
};

export type ProjectScopedCommandRunnerOptions = {
  delegate: CommandRunner;
  pathJail: PathJail;
};

export function commandRunnerResultToOutput(toolId: string, result: CommandRunnerResult): Output {
  switch (result.status) {
    case 'success':
    case 'failed':
      return toolResult(toolId, {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    case 'approval_required':
      return toolError('APPROVAL_REQUIRED', result.message);
    case 'denied':
      return toolError(result.code, result.message);
  }
}

function pathAccessDenied(reason: string): CommandRunnerDeniedResult {
  return {
    status: 'denied',
    code: 'PATH_ACCESS_DENIED',
    reason,
    message:
      'This command tries to access a path outside the approved Project. Use a path inside the selected Project.',
  };
}

function commandPolicyDenied(reason: string, message: string): CommandRunnerDeniedResult {
  return {
    status: 'denied',
    code: 'COMMAND_POLICY_DENIED',
    reason,
    message,
  };
}

export function createProjectScopedCommandRunner({
  delegate,
  pathJail,
}: ProjectScopedCommandRunnerOptions): CommandRunner {
  return {
    run: async (request) => {
      const commandPolicy = classifyBashCommand(request.command);
      if (commandPolicy.state === 'denied') {
        return commandPolicyDenied(commandPolicy.code, commandPolicy.reason);
      }
      if (commandPolicy.state === 'approval_required' && request.approval?.granted !== true) {
        return {
          status: 'approval_required',
          riskTier: commandPolicy.riskTier,
          message: commandPolicy.reason,
          reason: commandPolicy.code,
        };
      }

      const cwd = await pathJail.validate(request.cwd, 'read');
      if (!cwd.allowed) return pathAccessDenied('outside_project_cwd');

      const policy = await validateBashWorkspacePolicy(request.command, pathJail);
      if (!policy.allowed) return pathAccessDenied('outside_project');

      const command = (
        await Promise.all(
          policy.accesses.map(async (access) => ({
            original: access.path,
            resolved: await pathJail.enforce(access.path, access.operation),
          })),
        )
      )
        .sort((a, b) => b.original.length - a.original.length)
        .reduce(
          (rewritten, access) => rewritten.split(access.original).join(access.resolved),
          request.command,
        );

      return delegate.run({ ...request, command, cwd: cwd.resolvedPath });
    },
  };
}

export function createHostShellCommandRunner(): CommandRunner {
  return {
    run: (request) =>
      new Promise<CommandRunnerResult>((resolve) => {
        const startedAt = Date.now();
        const proc = execFile(
          '/bin/sh',
          ['-c', request.command],
          {
            cwd: request.cwd,
            timeout: request.timeoutMs,
            maxBuffer: request.maxOutputBytes * 2,
            env:
              request.env.mode === 'explicit'
                ? request.env.variables
                : { ...process.env, ...request.env.variables },
          },
          (error, stdout, stderr) => {
            let exitCode = 0;
            if (error) {
              exitCode = 'code' in error && typeof error.code === 'number' ? error.code : 1;
            }
            resolve({
              status: exitCode === 0 ? 'success' : 'failed',
              stdout: truncate(stdout, request.maxOutputBytes),
              stderr: truncate(stderr, request.maxOutputBytes),
              exitCode,
              durationMs: Date.now() - startedAt,
            });
          },
        );
        proc.on('error', () => {});
      }),
  };
}

function dockerUnavailable(message: string): CommandRunnerDeniedResult {
  return {
    status: 'denied',
    code: 'DOCKER_UNAVAILABLE',
    reason: 'docker_unavailable',
    message,
  };
}

function commandRunnerEnvironment(env: CommandEnvironmentPolicy): Record<string, string> {
  return {
    ...env.variables,
    TERM: env.variables.TERM ?? 'dumb',
  };
}

function replaceAll(value: string, search: string, replacement: string): string {
  return search ? value.split(search).join(replacement) : value;
}

async function dockerWorkspacePaths(request: CommandRunnerRequest): Promise<{
  hostWorkspaceRoot: string;
  containerCwd: string;
  containerCommand: string;
}> {
  const workspaceRoot = await realpath(request.workspace?.root ?? request.cwd);
  const cwd = await realpath(request.cwd);
  const containerCwd = cwd.startsWith(workspaceRoot)
    ? `/workspace${cwd.slice(workspaceRoot.length)}`
    : '/workspace';
  const containerCommand = replaceAll(request.command, workspaceRoot, '/workspace');
  return { hostWorkspaceRoot: workspaceRoot, containerCwd, containerCommand };
}

export function createDockerSandboxCommandRunner(
  options: DockerSandboxCommandRunnerOptions = {},
): CommandRunner {
  const exec = options.execFile ?? execFile;
  const dockerBinary = options.dockerBinary ?? 'docker';
  const image = options.image ?? 'node:20-bookworm-slim';
  const memory = options.memory ?? '2g';
  const cpus = options.cpus ?? '2';
  const pidsLimit = options.pidsLimit ?? 256;
  const user = options.user ?? '1000:1000';
  const network = options.network ?? 'none';
  const tmpSize = options.tmpSize ?? '256m';

  return {
    run: async (request) => {
      let paths: Awaited<ReturnType<typeof dockerWorkspacePaths>>;
      try {
        paths = await dockerWorkspacePaths(request);
      } catch (error) {
        return {
          status: 'denied',
          code: 'DOCKER_WORKSPACE_UNAVAILABLE',
          reason: 'workspace_unavailable',
          message: `Unable to prepare the Project workspace for sandbox execution: ${errorMessage(error)}`,
        };
      }

      return new Promise<CommandRunnerResult>((resolve) => {
        const startedAt = Date.now();
        const args = [
          'run',
          '--rm',
          '--network',
          network,
          '--memory',
          memory,
          '--cpus',
          cpus,
          '--pids-limit',
          String(pidsLimit),
          '--user',
          user,
          '--tmpfs',
          `/tmp:rw,nosuid,nodev,size=${tmpSize}`,
          '-v',
          `${paths.hostWorkspaceRoot}:/workspace:rw`,
          '-w',
          paths.containerCwd,
          image,
          'sh',
          '-lc',
          paths.containerCommand,
        ];
        const proc = exec(
          dockerBinary,
          args,
          {
            cwd: paths.hostWorkspaceRoot,
            timeout: request.timeoutMs,
            maxBuffer: request.maxOutputBytes * 2,
            env: commandRunnerEnvironment(request.env),
          },
          (error, stdout, stderr) => {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
              resolve(
                dockerUnavailable('Docker is not available. Install Docker or use host mode.'),
              );
              return;
            }
            let exitCode = 0;
            if (error) {
              exitCode = 'code' in error && typeof error.code === 'number' ? error.code : 1;
            }
            resolve({
              status: exitCode === 0 ? 'success' : 'failed',
              stdout: truncate(stdout, request.maxOutputBytes),
              stderr: truncate(stderr, request.maxOutputBytes),
              exitCode,
              durationMs: Date.now() - startedAt,
            });
          },
        );
        proc.on('error', () => {});
      });
    },
  };
}

export type MacosVmCommandRunnerOptions = {
  helperPath: string;
  runtimeDir: string;
  execFile?: ExecFileLike;
};

type MacosVmHelperResponse = {
  ok: boolean;
  mode: 'macos-vm';
  state: 'ready' | 'unavailable' | 'disabled';
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
};

function macosVmUnavailable(reason: string, message: string): CommandRunnerDeniedResult {
  return {
    status: 'denied',
    code: 'MACOS_VM_RUNNER_UNAVAILABLE',
    reason,
    message,
  };
}

function childProcessErrorCode(error: unknown): string | number | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? (error.code as string | number | undefined)
    : undefined;
}

function macosVmProcessFailure(error: unknown, stderr: string): CommandRunnerDeniedResult {
  const code = childProcessErrorCode(error);
  if (code === 'ENOENT') {
    return macosVmUnavailable(
      'macos_vm_runner_helper_missing',
      'macOS VM runner helper binary was not found.',
    );
  }
  if (code === 'EACCES') {
    return macosVmUnavailable(
      'macos_vm_runner_helper_not_executable',
      'macOS VM runner helper binary is not executable.',
    );
  }
  return macosVmUnavailable('macos_vm_runner_process_failed', stderr || errorMessage(error));
}

function parseMacosVmHelperResponse(stdout: string): MacosVmHelperResponse | undefined {
  try {
    const parsed = JSON.parse(stdout) as Partial<MacosVmHelperResponse>;
    if (
      parsed.mode === 'macos-vm' &&
      typeof parsed.ok === 'boolean' &&
      typeof parsed.state === 'string' &&
      typeof parsed.message === 'string'
    ) {
      return parsed as MacosVmHelperResponse;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function macosVmWorkspacePaths(request: CommandRunnerRequest): Promise<{
  hostWorkspaceRoot: string;
  hostCwd: string;
  guestCommand: string;
}> {
  const hostWorkspaceRoot = await realpath(request.workspace?.root ?? request.cwd);
  const hostCwd = await realpath(request.cwd);
  const guestCommand = replaceAll(request.command, hostWorkspaceRoot, '/workspace');
  if (hostCwd !== hostWorkspaceRoot && !hostCwd.startsWith(`${hostWorkspaceRoot}/`)) {
    return { hostWorkspaceRoot, hostCwd: hostWorkspaceRoot, guestCommand };
  }
  return { hostWorkspaceRoot, hostCwd, guestCommand };
}

export function createMacosVmCommandRunner({
  helperPath,
  runtimeDir,
  execFile: exec = execFile,
}: MacosVmCommandRunnerOptions): CommandRunner {
  return {
    run: async (request) => {
      if (!runtimeDir.trim()) {
        return macosVmUnavailable(
          'macos_vm_runner_runtime_unconfigured',
          'macOS VM runner runtime directory is not configured.',
        );
      }

      let paths: Awaited<ReturnType<typeof macosVmWorkspacePaths>>;
      try {
        paths = await macosVmWorkspacePaths(request);
      } catch (error) {
        return macosVmUnavailable(
          'workspace_unavailable',
          `Unable to prepare the Project workspace for VM execution: ${errorMessage(error)}`,
        );
      }

      const envDir = await mkdtemp(join(tmpdir(), 'agent-platform-macos-vm-env-'));
      const envFile = join(envDir, 'env.json');
      await writeFile(envFile, JSON.stringify(commandRunnerEnvironment(request.env)), 'utf8');

      return new Promise<CommandRunnerResult>((resolve) => {
        const startedAt = Date.now();
        const args = [
          'exec',
          '--runtime-dir',
          runtimeDir,
          '--workspace',
          paths.hostWorkspaceRoot,
          '--cwd',
          paths.hostCwd,
          '--timeout-ms',
          String(request.timeoutMs),
          '--max-output-bytes',
          String(request.maxOutputBytes),
          '--env-file',
          envFile,
          '--',
          paths.guestCommand,
        ];
        const proc = exec(
          helperPath,
          args,
          {
            cwd: paths.hostWorkspaceRoot,
            timeout: request.timeoutMs,
            maxBuffer: request.maxOutputBytes * 2,
            env: commandRunnerEnvironment(request.env),
          },
          (error, stdout, stderr) => {
            rm(envDir, { recursive: true, force: true }).catch(() => undefined);
            if (error) {
              resolve(macosVmProcessFailure(error, stderr));
              return;
            }

            const response = parseMacosVmHelperResponse(stdout);
            if (!response) {
              resolve(
                macosVmUnavailable(
                  'macos_vm_runner_invalid_response',
                  'macOS VM runner returned an invalid response.',
                ),
              );
              return;
            }

            if (!response.ok) {
              resolve(macosVmUnavailable('macos_vm_runner_unavailable', response.message));
              return;
            }

            const exitCode = response.exitCode ?? 0;
            resolve({
              status: exitCode === 0 ? 'success' : 'failed',
              stdout: truncate(response.stdout ?? '', request.maxOutputBytes),
              stderr: truncate(response.stderr ?? '', request.maxOutputBytes),
              exitCode,
              durationMs: response.durationMs ?? Date.now() - startedAt,
            });
          },
        );
        proc.on('error', () => {});
      });
    },
  };
}

function createDisabledCommandRunner(): CommandRunner {
  return {
    run: async () => ({
      status: 'denied',
      code: 'COMMAND_RUNNER_UNAVAILABLE',
      reason: 'command_runner_disabled',
      message:
        'Command execution is unavailable because no production sandbox runner is configured.',
    }),
  };
}

function configuredMode(env: Record<string, string | undefined>): CommandRunnerMode {
  const raw = env.AGENT_PLATFORM_COMMAND_RUNNER ?? env.AGENT_COMMAND_RUNNER;
  if (raw === 'host' || raw === 'docker-sandbox' || raw === 'macos-vm' || raw === 'disabled') {
    return raw;
  }
  return 'disabled';
}

function configuredMacosVmRunner(
  options: ConfiguredCommandRunnerOptions,
): CommandRunner | undefined {
  if (options.macosVmRunner) return options.macosVmRunner;
  const helperPath =
    options.macosVmHelperPath ??
    options.env?.AGENT_PLATFORM_MACOS_VM_RUNNER_PATH ??
    process.env.AGENT_PLATFORM_MACOS_VM_RUNNER_PATH;
  const runtimeDir =
    options.macosVmRuntimeDir ??
    options.env?.AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR ??
    process.env.AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR;
  return helperPath && runtimeDir
    ? createMacosVmCommandRunner({ helperPath, runtimeDir })
    : undefined;
}

function configuredMacosVmHelperPath(options: ConfiguredCommandRunnerOptions): string | undefined {
  return (
    options.macosVmHelperPath ??
    options.env?.AGENT_PLATFORM_MACOS_VM_RUNNER_PATH ??
    process.env.AGENT_PLATFORM_MACOS_VM_RUNNER_PATH
  );
}

function configuredMacosVmRuntimeDir(options: ConfiguredCommandRunnerOptions): string | undefined {
  return (
    options.macosVmRuntimeDir ??
    options.env?.AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR ??
    process.env.AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR
  );
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function getConfiguredCommandRunnerHealth(
  options: ConfiguredCommandRunnerOptions = {},
): CommandRunnerHealth {
  const mode = configuredMode(options.env ?? process.env);

  if (mode === 'host') {
    return {
      mode,
      status: 'ready',
      production: false,
      canExecute: true,
      reason: 'development_only',
      message: 'Host command execution is available for explicit local development only.',
    };
  }

  if (mode === 'docker-sandbox') {
    return {
      mode,
      status: 'ready',
      production: false,
      canExecute: true,
      reason: 'development_only',
      message: 'Docker sandbox execution is available for development and adapter testing only.',
    };
  }

  if (mode === 'macos-vm') {
    const helperPath = configuredMacosVmHelperPath(options);
    const runtimeDir = configuredMacosVmRuntimeDir(options);
    if (
      options.macosVmRunner ||
      (helperPath && runtimeDir && existsSync(helperPath) && isDirectory(runtimeDir))
    ) {
      return {
        mode,
        status: 'ready',
        production: true,
        canExecute: true,
        reason: 'production_runner_ready',
        message: 'macOS VM command execution is configured.',
        ...(helperPath && runtimeDir ? { details: { helperPath, runtimeDir } } : {}),
      };
    }

    return {
      mode,
      status: 'unavailable',
      production: true,
      canExecute: false,
      reason: 'macos_vm_runner_unavailable',
      message:
        'macOS VM command execution is selected but the VM helper or runtime directory is unavailable.',
    };
  }

  return {
    mode,
    status: 'disabled',
    production: false,
    canExecute: false,
    reason: 'command_runner_disabled',
    message: 'Command execution is disabled because no production runner is configured.',
  };
}

export function createConfiguredCommandRunner(
  options: ConfiguredCommandRunnerOptions = {},
): CommandRunner {
  const mode = configuredMode(options.env ?? process.env);
  const hostRunner = options.hostRunner ?? createHostShellCommandRunner();
  const dockerRunner = options.dockerRunner ?? createDockerSandboxCommandRunner();

  if (mode === 'disabled') return createDisabledCommandRunner();
  if (mode === 'host') return hostRunner;
  if (mode === 'docker-sandbox') return dockerRunner;
  return configuredMacosVmRunner(options) ?? createDisabledCommandRunner();
}
