import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildDockerSpecialistLaunch,
  executeDockerSpecialist,
  prepareSpecialistWorkspace,
} from '../src/index.js';

const cleanup: string[] = [];

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: vi.fn(actual.writeFile), mkdtemp: vi.fn(actual.mkdtemp) };
});
const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

afterEach(async () => {
  vi.mocked(writeFile).mockImplementation(actualFs.writeFile);
  vi.clearAllMocks();
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('specialist launcher', () => {
  it('removes private staging when auth placeholder creation fails', async () => {
    const source = await mkdtemp(join(tmpdir(), 'workflow-source-'));
    cleanup.push(source);
    await writeFile(join(source, 'safe.txt'), 'private fixture');
    vi.mocked(writeFile).mockImplementation(async (path, data, options) => {
      if (String(path).endsWith('/auth.json')) throw new Error('fixture write failure');
      return actualFs.writeFile(path, data, options);
    });
    await expect(prepareSpecialistWorkspace(source, ['safe.txt'])).rejects.toThrow(
      'fixture write failure',
    );
    const staged = await vi.mocked(mkdtemp).mock.results.at(-1)?.value;
    expect(staged).toContain('workflow-specialist-');
    cleanup.push(staged);
    await expect(stat(staged)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(source, 'safe.txt'), 'utf8')).resolves.toBe('private fixture');
  });
  it('copies source into a private workspace without credential or repository-control surfaces', async () => {
    const source = await mkdtemp(join(tmpdir(), 'workflow-source-'));
    cleanup.push(source);
    await mkdir(join(source, '.git'));
    await mkdir(join(source, '.beads'));
    await mkdir(join(source, '.ssh'));
    await writeFile(join(source, '.env'), 'GITHUB_TOKEN=secret');
    await writeFile(join(source, 'safe.txt'), 'safe');
    await writeFile(join(source, '.git', 'config'), 'secret');

    const workspace = await prepareSpecialistWorkspace(source, ['safe.txt']);
    cleanup.push(join(workspace.root, '..'));
    await expect(readFile(join(workspace.root, 'safe.txt'), 'utf8')).resolves.toBe('safe');
    await expect(readFile(join(workspace.root, '.git', 'config'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(workspace.root, '.env'), 'utf8')).rejects.toThrow();
    const config = await readFile(join(workspace.codexHome, 'config.toml'), 'utf8');
    expect(config).not.toContain('mcp_servers');
    expect(config).toContain('approval_policy = "never"');
    await expect(readFile(join(workspace.codexHome, 'auth.json'), 'utf8')).resolves.toBe('{}\n');
  });

  it('builds a hardened codex exec container invocation with only private mounts', async () => {
    const privateRoot = await mkdtemp(join(tmpdir(), 'workflow-specialist-'));
    cleanup.push(privateRoot);
    const workspaceRoot = join(privateRoot, 'workspace');
    const codexHome = join(privateRoot, 'codex-home');
    const authFile = join(privateRoot, 'codex-auth.json');
    const promptFile = join(privateRoot, 'prompt.txt');
    await Promise.all([mkdir(workspaceRoot), mkdir(codexHome)]);
    await Promise.all([
      writeFile(authFile, '{}'),
      writeFile(promptFile, 'perform the task'),
      writeFile(join(codexHome, 'config.toml'), 'approval_policy = "never"\n'),
    ]);
    const launch = await buildDockerSpecialistLaunch({
      image: 'workflow-codex:local',
      workspaceRoot,
      codexHome,
      authFile,
      promptFile,
      egressNetwork: 'workflow-model-egress',
      role: 'implementation_worker',
      runId: 'run-1',
      containerUser: '501:20',
    });
    expect(launch.args).toEqual(
      expect.arrayContaining([
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--network',
        'workflow-model-egress',
        '--user',
        '501:20',
        'sh',
        '-c',
      ]),
    );
    expect(launch.args.join(' ')).not.toMatch(/(?:\.git|\.beads|docker\.sock|\.ssh|GITHUB_TOKEN)/u);
    expect(launch.environment).toEqual({});
    const canonicalWorkspaceRoot = await realpath(workspaceRoot);
    expect(launch.args).toContain(`${canonicalWorkspaceRoot}:/workspace:rw`);
    expect(launch.args.at(-1)).toContain('--sandbox workspace-write');
    for (const role of ['feature_planner', 'plan_critic']) {
      const reviewer = await buildDockerSpecialistLaunch({
        image: 'workflow-codex:local',
        workspaceRoot,
        codexHome,
        authFile,
        promptFile,
        egressNetwork: 'workflow-model-egress',
        role,
        runId: 'preapproval-review',
        containerUser: '501:20',
      });
      expect(reviewer.args).toContain(`${canonicalWorkspaceRoot}:/workspace:ro`);
      expect(reviewer.args).not.toContain(`${canonicalWorkspaceRoot}:/workspace:rw`);
      expect(reviewer.args.at(-1)).toContain('--sandbox read-only');
      expect(reviewer.args.at(-1)).not.toContain('--sandbox workspace-write');
    }
  });

  it('rejects declared source paths that resolve outside the repository', async () => {
    const source = await mkdtemp(join(tmpdir(), 'workflow-source-'));
    const outside = await mkdtemp(join(tmpdir(), 'workflow-outside-'));
    cleanup.push(source, outside);
    await writeFile(join(outside, 'secret.txt'), 'secret');
    await symlink(join(outside, 'secret.txt'), join(source, 'escape'));
    await expect(prepareSpecialistWorkspace(source, ['escape'])).rejects.toThrow(
      'escapes the repository',
    );
    await expect(prepareSpecialistWorkspace(source, ['.git'])).rejects.toThrow('forbidden');
  });

  it('rejects host/default networking and credential-bearing environment variables', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-specialist-'));
    cleanup.push(root);
    const request = {
      image: 'workflow-codex:local',
      workspaceRoot: join(root, 'workspace'),
      codexHome: join(root, 'codex-home'),
      authFile: join(root, 'auth'),
      promptFile: join(root, 'prompt'),
      egressNetwork: 'host',
      role: 'implementation_worker',
      runId: 'run-1',
    };
    await expect(buildDockerSpecialistLaunch(request)).rejects.toThrow(
      'dedicated policy-controlled',
    );
    await expect(
      buildDockerSpecialistLaunch({
        ...request,
        egressNetwork: 'workflow-model-egress',
        extraEnvironment: { GITHUB_TOKEN: 'secret' },
      }),
    ).rejects.toThrow('forbidden credential variable');
    await expect(
      buildDockerSpecialistLaunch({
        ...request,
        egressNetwork: 'workflow-model-egress',
        containerUser: '0:0',
      }),
    ).rejects.toThrow('non-root numeric');
  });

  it('executes without an inherited environment and requires structured JSONL results', async () => {
    const launch = { dockerBinary: '/usr/local/bin/docker', args: ['run'], environment: {} };
    const calls: unknown[] = [];
    const result = await executeDockerSpecialist(launch, {
      timeoutMs: 1000,
      maxOutputBytes: 4096,
      executor: async (...args) => {
        calls.push(args);
        return { stdout: '{"type":"result","ok":true}\n', stderr: '' };
      },
    });
    expect(result.events).toEqual([{ type: 'result', ok: true }]);
    expect(calls).toEqual([
      ['/usr/local/bin/docker', ['run'], { env: {}, timeout: 1000, maxBuffer: 4096 }],
    ]);
    await expect(
      executeDockerSpecialist(launch, {
        timeoutMs: 1000,
        maxOutputBytes: 4096,
        executor: async () => ({ stdout: 'not-json\n', stderr: '' }),
      }),
    ).rejects.toThrow('non-JSONL');
  });
});
