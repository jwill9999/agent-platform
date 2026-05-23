import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';

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

export type CommandRunnerMode = 'auto' | 'host' | 'docker-sandbox';

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

function dockerEnvironment(env: CommandEnvironmentPolicy): Record<string, string> {
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
            env: dockerEnvironment(request.env),
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

function configuredMode(env: Record<string, string | undefined>): CommandRunnerMode {
  const raw = env.AGENT_PLATFORM_COMMAND_RUNNER ?? env.AGENT_COMMAND_RUNNER;
  if (raw === 'host' || raw === 'docker-sandbox' || raw === 'auto') return raw;
  return 'host';
}

export function createConfiguredCommandRunner(
  options: ConfiguredCommandRunnerOptions = {},
): CommandRunner {
  const mode = configuredMode(options.env ?? process.env);
  const hostRunner = options.hostRunner ?? createHostShellCommandRunner();
  const dockerRunner = options.dockerRunner ?? createDockerSandboxCommandRunner();

  if (mode === 'host') return hostRunner;
  if (mode === 'docker-sandbox') return dockerRunner;

  return {
    run: async (request) => {
      const sandboxResult = await dockerRunner.run(request);
      return sandboxResult.status === 'denied' && sandboxResult.code === 'DOCKER_UNAVAILABLE'
        ? hostRunner.run(request)
        : sandboxResult;
    },
  };
}
