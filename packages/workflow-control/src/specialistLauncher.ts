import { execFile } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const FORBIDDEN_NAMES = new Set(['.git', '.beads', '.ssh']);
const FORBIDDEN_ENVIRONMENT = /(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|DOCKER|SSH|GITHUB|GH_)/iu;
const FORBIDDEN_NETWORKS = new Set(['bridge', 'default', 'host']);

export interface SpecialistWorkspace {
  root: string;
  codexHome: string;
}

export interface DockerSpecialistLaunch {
  dockerBinary: string;
  args: string[];
  environment: Record<string, string>;
}

export interface SpecialistExecutionResult {
  events: unknown[];
  stderr: string;
}

export type SpecialistProcessExecutor = (
  executable: string,
  args: readonly string[],
  options: { env: Record<string, string>; timeout: number; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

export interface SpecialistLaunchRequest {
  image: string;
  workspaceRoot: string;
  codexHome: string;
  authFile: string;
  promptFile: string;
  egressNetwork: string;
  role: string;
  runId: string;
  containerUser?: string;
  extraEnvironment?: Record<string, string>;
}

function isInside(path: string, root: string): boolean {
  const child = relative(root, path);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child));
}

export async function prepareSpecialistWorkspace(
  sourceRoot: string,
  allowedSourcePaths: readonly string[],
): Promise<SpecialistWorkspace> {
  if (allowedSourcePaths.length === 0) throw new Error('specialist source paths must not be empty');
  const canonicalSource = await realpath(sourceRoot);
  const stagingParent = await mkdtemp(join(tmpdir(), 'workflow-specialist-'));
  const root = join(stagingParent, 'workspace');
  const codexHome = join(stagingParent, 'codex-home');
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  const filter = async (source: string): Promise<boolean> => {
    const name = basename(source);
    if (FORBIDDEN_NAMES.has(name) || name === 'node_modules' || name === '.env') return false;
    return !(await lstat(source)).isSymbolicLink();
  };
  for (const allowedPath of allowedSourcePaths) {
    if (
      isAbsolute(allowedPath) ||
      allowedPath.split('/').includes('..') ||
      allowedPath.split('/').some((segment) => FORBIDDEN_NAMES.has(segment))
    ) {
      throw new Error(`specialist source path is forbidden: ${allowedPath}`);
    }
    const source = await realpath(resolve(canonicalSource, allowedPath));
    if (!isInside(source, canonicalSource)) {
      throw new Error(`specialist source path escapes the repository: ${allowedPath}`);
    }
    const destination = allowedPath === '.' ? root : join(root, allowedPath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await cp(source, destination, { recursive: true, dereference: false, filter });
  }
  await writeFile(
    join(codexHome, 'config.toml'),
    [
      'approval_policy = "never"',
      'sandbox_mode = "workspace-write"',
      'web_search = "disabled"',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  return { root, codexHome };
}

export async function buildDockerSpecialistLaunch(
  request: SpecialistLaunchRequest,
): Promise<DockerSpecialistLaunch> {
  for (const path of [
    request.workspaceRoot,
    request.codexHome,
    request.authFile,
    request.promptFile,
  ]) {
    if (!isAbsolute(path)) throw new Error('specialist launch paths must be absolute');
  }
  if (FORBIDDEN_NETWORKS.has(request.egressNetwork)) {
    throw new Error('specialist requires a dedicated policy-controlled egress network');
  }
  if (request.egressNetwork.trim() === '') throw new Error('specialist egress network is required');
  const containerUser =
    request.containerUser ?? `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;
  if (!/^[1-9]\d*:\d+$/u.test(containerUser)) {
    throw new Error('specialist container user must use a non-root numeric uid and numeric gid');
  }
  const environment = {
    CODEX_HOME: '/codex-home',
    WORKFLOW_RUN_ID: request.runId,
    WORKFLOW_ROLE: request.role,
    ...(request.extraEnvironment ?? {}),
  };
  const forbiddenVariable = Object.keys(environment).find(
    (name) => name !== 'WORKFLOW_RUN_ID' && FORBIDDEN_ENVIRONMENT.test(name),
  );
  if (forbiddenVariable !== undefined) {
    throw new Error(
      `specialist environment contains forbidden credential variable ${forbiddenVariable}`,
    );
  }

  const [workspaceRoot, codexHome, authFile, promptFile, configFile] = await Promise.all([
    realpath(request.workspaceRoot),
    realpath(request.codexHome),
    realpath(request.authFile),
    realpath(request.promptFile),
    realpath(join(request.codexHome, 'config.toml')),
  ]);
  const stagingRoot = await realpath(resolve(workspaceRoot, '..'));
  const mounts = [
    `${workspaceRoot}:/workspace:rw`,
    `${codexHome}:/codex-home:rw`,
    `${configFile}:/codex-home/config.toml:ro`,
    `${authFile}:/codex-home/auth.json:ro`,
    `${promptFile}:/run/specialist/prompt.txt:ro`,
  ];
  for (const mount of mounts) {
    const hostPath = mount.slice(0, mount.indexOf(':'));
    if (!isInside(hostPath, stagingRoot)) {
      throw new Error('specialist mount escapes its private staging directory');
    }
    if (FORBIDDEN_NAMES.has(basename(hostPath)) || hostPath === '/var/run/docker.sock') {
      throw new Error('specialist mount exposes a forbidden host surface');
    }
  }

  const args = [
    'run',
    '--rm',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--network',
    request.egressNetwork,
    '--pids-limit',
    '256',
    '--memory',
    '4g',
    '--cpus',
    '4',
    '--user',
    containerUser,
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,noexec,size=512m',
  ];
  for (const [name, value] of Object.entries(environment)) args.push('--env', `${name}=${value}`);
  for (const mount of mounts) args.push('--volume', mount);
  args.push(
    '--workdir',
    '/workspace',
    request.image,
    'sh',
    '-c',
    'exec codex exec --json --sandbox workspace-write --skip-git-repo-check -C /workspace - < /run/specialist/prompt.txt',
  );
  return { dockerBinary: '/usr/local/bin/docker', args, environment: {} };
}

const defaultExecutor: SpecialistProcessExecutor = async (executable, args, options) => {
  const result = await promisify(execFile)(executable, [...args], {
    env: options.env,
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
  });
  return { stdout: result.stdout, stderr: result.stderr };
};

export async function executeDockerSpecialist(
  launch: DockerSpecialistLaunch,
  options: {
    timeoutMs: number;
    maxOutputBytes: number;
    executor?: SpecialistProcessExecutor;
  },
): Promise<SpecialistExecutionResult> {
  const executor = options.executor ?? defaultExecutor;
  const result = await executor(launch.dockerBinary, launch.args, {
    env: launch.environment,
    timeout: options.timeoutMs,
    maxBuffer: options.maxOutputBytes,
  });
  const events = result.stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error('specialist returned non-JSONL output');
      }
    });
  return { events, stderr: result.stderr };
}
