import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { isAbsolute, join } from 'node:path';

export interface BootstrapExecutablePin {
  path: string;
  digest: string;
}

/** Embedded in the generated, policy-pinned executable; never read from mutable runtime config. */
export interface BootstrapAdapterConfig {
  version: 1;
  workspaceRoot: string;
  gitCommonDirectory: string;
  repository: string;
  taskId: string;
  ref: string;
  remoteName: string;
  remoteUrl: string;
  expectedRemoteSha: string | null;
  homeDirectory: string;
  node: BootstrapExecutablePin;
  git: BootstrapExecutablePin;
  beads: BootstrapExecutablePin;
  beadsProjectId: string;
  beadsDatabase: string;
  gitExecPath: string;
  https: {
    remoteHelper: BootstrapExecutablePin;
    credentialHelper: BootstrapExecutablePin;
  } | null;
}

const shaPattern = /^[a-f0-9]{40}$/u;
const digestPattern = /^sha256:[a-f0-9]{64}$/u;

function reject(): never {
  // Never include subprocess output, request contents, credentials or environment in errors.
  throw new Error('bootstrap adapter rejected request or dependency');
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) reject();
  return value as Record<string, unknown>;
}

function exactKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const record = object(value);
  if (Object.keys(record).length !== keys.length || keys.some((key) => !Object.hasOwn(record, key)))
    reject();
  return record;
}

function realDirectory(path: unknown): asserts path is string {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    /[\r\n\0]/u.test(path) ||
    realpathSync(path) !== path ||
    !statSync(path).isDirectory()
  )
    reject();
}

export function assertBootstrapExecutablePin(
  input: unknown,
): asserts input is BootstrapExecutablePin {
  const pin = exactKeys(input, ['path', 'digest']);
  if (
    typeof pin.path !== 'string' ||
    !isAbsolute(pin.path) ||
    typeof pin.digest !== 'string' ||
    !digestPattern.test(pin.digest)
  )
    reject();
  const stat = statSync(pin.path);
  if (
    realpathSync(pin.path) !== pin.path ||
    !stat.isFile() ||
    !(stat.mode & 0o111) ||
    stat.mode & 0o022 ||
    (stat.uid !== 0 && stat.uid !== process.getuid?.()) ||
    `sha256:${createHash('sha256').update(readFileSync(pin.path)).digest('hex')}` !== pin.digest
  )
    reject();
}

export function bootstrapAdapterDependencies(
  config: BootstrapAdapterConfig,
): BootstrapExecutablePin[] {
  return [
    config.node,
    config.git,
    config.beads,
    ...(config.https === null ? [] : [config.https.remoteHelper, config.https.credentialHelper]),
  ];
}

export function validateBootstrapAdapterConfig(input: unknown): BootstrapAdapterConfig {
  const config = exactKeys(input, [
    'version',
    'workspaceRoot',
    'gitCommonDirectory',
    'repository',
    'taskId',
    'ref',
    'remoteName',
    'remoteUrl',
    'expectedRemoteSha',
    'homeDirectory',
    'node',
    'git',
    'beads',
    'beadsProjectId',
    'beadsDatabase',
    'gitExecPath',
    'https',
  ]);
  if (
    config.version !== 1 ||
    typeof config.repository !== 'string' ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(config.repository) ||
    typeof config.taskId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(config.taskId) ||
    config.ref !== `refs/heads/task/${config.taskId}` ||
    typeof config.remoteName !== 'string' ||
    !/^[A-Za-z0-9._-]+$/u.test(config.remoteName) ||
    (config.expectedRemoteSha !== null &&
      (typeof config.expectedRemoteSha !== 'string' || !shaPattern.test(config.expectedRemoteSha)))
  )
    reject();
  for (const path of [
    config.workspaceRoot,
    config.gitCommonDirectory,
    config.gitExecPath,
    config.homeDirectory,
  ])
    realDirectory(path);
  if (config.homeDirectory !== realpathSync(userInfo().homedir)) reject();
  if (
    typeof config.beadsProjectId !== 'string' ||
    !/^[a-f0-9-]{36}$/u.test(config.beadsProjectId) ||
    typeof config.beadsDatabase !== 'string' ||
    !/^\w+$/u.test(config.beadsDatabase)
  )
    reject();
  if (realpathSync(join(config.workspaceRoot as string, '.git')) !== config.gitCommonDirectory)
    reject();
  if (config.https !== null) {
    const https = exactKeys(config.https, ['remoteHelper', 'credentialHelper']);
    assertBootstrapExecutablePin(https.remoteHelper);
    assertBootstrapExecutablePin(https.credentialHelper);
    if (config.remoteUrl !== `https://github.com/${config.repository}.git`) reject();
  } else {
    // An explicit absolute bare repository is supported for local conformance, never file:// or ext:.
    realDirectory(config.remoteUrl);
  }
  for (const pin of [config.node, config.git, config.beads]) assertBootstrapExecutablePin(pin);
  const parsed = config as unknown as BootstrapAdapterConfig;
  assertGitHelperPins(parsed);
  return parsed;
}

function assertGitHelperPins(config: BootstrapAdapterConfig): void {
  // Git launches these helpers through its exec directory; symlink replacement cannot escape pins.
  for (const name of ['git', 'git-pack-objects', 'git-upload-pack', 'git-receive-pack'])
    if (realpathSync(join(config.gitExecPath, name)) !== config.git.path) reject();
  if (
    config.https !== null &&
    realpathSync(join(config.gitExecPath, 'git-remote-https')) !== config.https.remoteHelper.path
  )
    reject();
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`;
}

function assertRequest(
  config: BootstrapAdapterConfig,
  channel: 'beads' | 'remote',
  input: unknown,
): Record<string, unknown> {
  const initial = object(input);
  if (channel === 'beads') {
    const request = exactKeys(input, ['kind', 'workspaceRoot', 'taskId']);
    if (
      request.kind !== 'beads.read' ||
      request.workspaceRoot !== config.workspaceRoot ||
      request.taskId !== config.taskId
    )
      reject();
    return request;
  }
  const keys = ['kind', 'workspaceRoot', 'repository', 'remoteName', 'remoteUrl', 'ref'];
  if (initial.kind === 'git.push') keys.push('expectedOldSha', 'newSha');
  else if (initial.kind !== 'git.observe_ref') reject();
  const request = exactKeys(input, keys);
  for (const key of ['workspaceRoot', 'repository', 'remoteName', 'remoteUrl', 'ref'] as const)
    if (request[key] !== config[key]) reject();
  if (
    request.kind === 'git.push' &&
    (request.expectedOldSha !== config.expectedRemoteSha ||
      typeof request.newSha !== 'string' ||
      !shaPattern.test(request.newSha))
  )
    reject();
  return request;
}

type AdapterExecute = (binary: string, args: string[], cwd: string) => string;

function readBeadsSnapshot(config: BootstrapAdapterConfig, execute: AdapterExecute): unknown {
  const flags = ['--readonly', '--sandbox', '--dolt-auto-commit=off', '--json'];
  const context = object(
    JSON.parse(execute(config.beads.path, [...flags, 'context'], config.workspaceRoot)),
  );
  if (
    context.repo_root !== config.workspaceRoot ||
    context.cwd_repo_root !== config.workspaceRoot ||
    context.beads_dir !== join(config.workspaceRoot, '.beads') ||
    context.is_redirected !== false ||
    context.is_worktree !== false ||
    context.backend !== 'dolt' ||
    context.dolt_mode !== 'embedded' ||
    context.project_id !== config.beadsProjectId ||
    context.database !== config.beadsDatabase
  )
    reject();
  const records: unknown = JSON.parse(
    execute(
      config.beads.path,
      [...flags, 'show', '--long', `--id=${config.taskId}`],
      config.workspaceRoot,
    ),
  );
  if (!Array.isArray(records) || records.length !== 1) reject();
  const snapshot = object(records[0]);
  if (snapshot.id !== config.taskId || snapshot.status !== 'in_progress') reject();
  return snapshot; // Preserve the whole official CLI snapshot; never project fields into MCP shape.
}

/** No arbitrary commands or inherited environment. All subprocess failures are redacted. */
export function runBootstrapAdapter(
  configInput: unknown,
  channel: 'beads' | 'remote',
  input: unknown,
): unknown {
  const config = validateBootstrapAdapterConfig(configInput);
  const request = assertRequest(config, channel, input);
  const deadline = Date.now() + 8000;
  const environment: NodeJS.ProcessEnv = {
    PATH: `${config.gitExecPath}:/usr/bin:/bin`,
    HOME: config.homeDirectory,
    LANG: 'C',
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '/usr/bin/false',
    GIT_SSH_COMMAND: '/usr/bin/false',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_EXEC_PATH: config.gitExecPath,
  };
  const execute = (binary: string, args: string[], cwd: string, extra: NodeJS.ProcessEnv = {}) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) reject();
    try {
      return execFileSync(binary, args, {
        cwd,
        env: { ...environment, ...extra },
        encoding: 'utf8',
        timeout: Math.min(4000, remaining),
        maxBuffer: 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      return reject();
    }
  };
  if (channel === 'beads') return readBeadsSnapshot(config, execute);
  const directory = mkdtempSync(join(tmpdir(), 'bootstrap-remote-'));
  try {
    const privateExec = join(directory, 'exec');
    mkdirSync(privateExec, { mode: 0o700 });
    for (const name of [
      'git',
      'git-pack-objects',
      'git-upload-pack',
      'git-receive-pack',
      'git-send-pack',
      'git-fetch-pack',
      'git-index-pack',
      'git-unpack-objects',
    ])
      symlinkSync(config.git.path, join(privateExec, name));
    if (config.https !== null)
      symlinkSync(config.https.remoteHelper.path, join(privateExec, 'git-remote-https'));
    environment.GIT_EXEC_PATH = privateExec;
    environment.PATH = `${privateExec}:/usr/bin:/bin`;
    const options = [
      '--no-replace-objects',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'protocol.allow=never',
      '-c',
      `protocol.${config.https === null ? 'file' : 'https'}.allow=always`,
      '-c',
      'credential.helper=',
      '-c',
      'credential.interactive=false',
      '-c',
      'credential.useHttpPath=true',
      '-c',
      'http.followRedirects=false',
    ];
    if (config.https !== null)
      options.push(
        '-c',
        `credential.helper=!f() { if test "$1" = get; then ${quoteShell(config.https.credentialHelper.path)} get; fi; }; f`,
      );
    const git = (args: string[]) => execute(config.git.path, [...options, ...args], directory);
    git(['init', '--bare', '--template=', '.']);
    // Repository-local alternates stay on the client; an env alternate would leak into a local receiver.
    writeFileSync(
      join(directory, 'objects/info/alternates'),
      `${join(config.gitCommonDirectory, 'objects')}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    const observe = (): string | null => {
      const lines = git([
        'ls-remote',
        '--refs',
        ...(config.https === null
          ? [`--upload-pack=${quoteShell(config.git.path)} upload-pack`]
          : []),
        config.remoteUrl,
        config.ref,
      ]).trim();
      if (lines === '') return null;
      const entries = lines.split('\n');
      if (entries.length !== 1) reject();
      const [sha, ref] = entries[0]!.split('\t');
      if (ref !== config.ref || sha === undefined || !shaPattern.test(sha)) reject();
      return sha;
    };
    const prior = observe();
    if (request.kind === 'git.observe_ref') return { sha: prior };
    if (prior !== request.expectedOldSha) reject();
    // Read only the configured local task ref; the push repository itself has no user Git config.
    const localHead = execute(
      config.git.path,
      [
        ...options,
        `--git-dir=${config.gitCommonDirectory}`,
        'rev-parse',
        '--verify',
        `${config.ref}^{commit}`,
      ],
      directory,
    ).trim();
    if (localHead !== request.newSha) reject();
    if (prior !== null) git(['merge-base', '--is-ancestor', prior, localHead]);
    for (const pin of bootstrapAdapterDependencies(config)) assertBootstrapExecutablePin(pin);
    git([
      'push',
      '--porcelain',
      '--no-verify',
      '--no-follow-tags',
      `--force-with-lease=${config.ref}:${prior ?? ''}`,
      ...(config.https === null
        ? [`--receive-pack=${quoteShell(config.git.path)} receive-pack`]
        : []),
      config.remoteUrl,
      `${localHead}:${config.ref}`,
    ]);
    if (observe() !== localHead) reject();
    return { sha: localHead };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Generated executable entry point. Its entire module and config are embedded, with no npm imports. */
export function bootstrapAdapterMain(
  config: BootstrapAdapterConfig,
  channel: 'beads' | 'remote',
): void {
  try {
    if (process.argv.length !== 2) reject();
    const buffer = Buffer.alloc(65_537);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(0, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length > 65_536) reject();
    if (realpathSync(process.execPath) !== config.node.path) reject();
    const response = runBootstrapAdapter(
      config,
      channel,
      JSON.parse(buffer.subarray(0, length).toString('utf8')),
    );
    process.stdout.write(JSON.stringify(response));
  } catch {
    process.stderr.write('bootstrap adapter rejected request or dependency\n');
    process.exitCode = 1;
  }
}
