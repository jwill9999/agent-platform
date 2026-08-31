import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CompositeDeliveryMutationPort,
  GitHubDeliveryPort,
  LocalGitDeliveryPort,
  type BrokeredRemoteRefClient,
  type DeliveryRequest,
  type NarrowGitHubDeliveryClient,
} from '../src/index.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;

class MemoryRemoteRefClient implements BrokeredRemoteRefClient {
  sha: string | null;
  pushes = 0;

  constructor(sha: string | null) {
    this.sha = sha;
  }

  async observeRef(): Promise<string | null> {
    return this.sha;
  }

  async pushCas(input: { expectedOldSha: string | null; newSha: string }): Promise<void> {
    if (this.sha !== input.expectedOldSha) throw new Error('remote CAS changed');
    this.sha = input.newSha;
    this.pushes += 1;
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(root: string, args: string[], input?: string): string {
  return execFileSync('/usr/bin/git', args, {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
    },
    input,
    encoding: 'utf8',
  });
}

async function setupGit() {
  const root = await mkdtemp(join(tmpdir(), 'workflow-git-delivery-'));
  roots.push(root);
  git(root, ['init', '-q']);
  await mkdir(join(root, 'packages/workflow-control/src'), { recursive: true });
  await writeFile(join(root, 'packages/workflow-control/src/base.ts'), 'export const base = 1;\n');
  git(root, ['add', '--', '.']);
  git(root, ['commit', '-qm', 'base']);
  const parentSha = git(root, ['rev-parse', 'HEAD']).trim();
  const remote = new MemoryRemoteRefClient(parentSha);
  const port = LocalGitDeliveryPort.createForTest({
    workspaceRoot: root,
    remoteName: 'origin',
    remote,
    gitBinary: '/usr/bin/git',
  });
  return { root, parentSha, remote, port };
}

function binding() {
  return {
    workspaceId,
    runId: 'run-delivery',
    taskId: 'delivery-feature.7',
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator' as const,
    contractVersion: 1 as const,
    policyDigest,
  };
}

function createRefRequest(parentSha: string): DeliveryRequest {
  return {
    ...binding(),
    kind: 'git.create_ref',
    ref: 'refs/heads/task/delivery-feature.7',
    parentRef: 'task/delivery-feature.6',
    parentSha,
  };
}

function treeEvidence(
  root: string,
  parentSha: string,
): {
  treeSha: string;
  diffDigest: string;
} {
  git(root, ['add', '-A', '--', '.']);
  const treeSha = git(root, ['write-tree']).trim();
  const raw = execFileSync(
    '/usr/bin/git',
    [
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-z',
      '-r',
      '--find-renames',
      '--find-copies',
      parentSha,
      treeSha,
    ],
    { cwd: root },
  );
  return {
    treeSha,
    diffDigest: `sha256:${createHash('sha256').update(raw).digest('hex')}`,
  };
}

describe('LocalGitDeliveryPort', () => {
  it('captures and freezes the reviewed production dispatch methods', async () => {
    const { parentSha, port } = await setupGit();
    const githubClient: NarrowGitHubDeliveryClient = {
      async findPullRequest() {
        return null;
      },
      async createPullRequest() {
        throw new Error('not used');
      },
      async mergePullRequest() {
        throw new Error('not used');
      },
    };
    const composite = CompositeDeliveryMutationPort.create(
      port,
      new GitHubDeliveryPort(githubClient, 'example/repository'),
    );
    let redirected = false;
    (port as unknown as { mutate: typeof port.mutate }).mutate = async () => {
      redirected = true;
      return { sha: '9'.repeat(40) };
    };
    (CompositeDeliveryMutationPort.prototype as { mutate?: () => Promise<unknown> }).mutate =
      async () => {
        redirected = true;
        return { sha: '8'.repeat(40) };
      };

    try {
      await composite.mutate(createRefRequest(parentSha));
      expect(redirected).toBe(false);
      await expect(composite.observe(createRefRequest(parentSha))).resolves.toMatchObject({
        kind: 'expected',
      });
      expect(Object.isFrozen(composite)).toBe(true);
    } finally {
      delete (CompositeDeliveryMutationPort.prototype as { mutate?: () => Promise<unknown> })
        .mutate;
    }
  });

  it('creates only the exact absent task ref', async () => {
    const { parentSha, port } = await setupGit();
    const request = createRefRequest(parentSha);

    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'unchanged' });
    await port.mutate(request);
    await expect(port.observe(request)).resolves.toMatchObject({
      kind: 'expected',
      result: { sha: parentSha },
    });
  });

  it('creates and recovers an exact-tree commit without executing hooks', async () => {
    const { root, parentSha, port } = await setupGit();
    await port.mutate(createRefRequest(parentSha));
    const hookMarker = join(root, 'hook-ran');
    const hook = join(root, '.git/hooks/pre-commit');
    await writeFile(hook, `#!/bin/sh\ntouch '${hookMarker}'\n`);
    await chmod(hook, 0o755);
    await writeFile(
      join(root, 'packages/workflow-control/src/delivery.ts'),
      'export const delivered = true;\n',
    );
    const evidence = treeEvidence(root, parentSha);
    const request: DeliveryRequest = {
      ...binding(),
      kind: 'git.commit',
      ref: 'refs/heads/task/delivery-feature.7',
      parentSha,
      ...evidence,
      changedFiles: ['packages/workflow-control/src/delivery.ts'],
      message: 'delivery-feature.7 feat add exact commit',
      authorName: 'Agent Platform',
      authorEmail: 'agent@example.com',
      authoredAtUnix: 1_700_000_000,
    };

    const result = (await port.mutate(request)) as { sha: string };
    expect(result.sha).toMatch(/^[a-f0-9]{40}$/u);
    await expect(port.observe(request)).resolves.toMatchObject({
      kind: 'expected',
      result: { sha: result.sha },
    });
    await expect(access(hookMarker)).rejects.toThrow();
  });

  it('rejects clean filters and unexpected changed paths before moving the ref', async () => {
    const { root, parentSha, port } = await setupGit();
    await port.mutate(createRefRequest(parentSha));
    const marker = join(root, 'filter-ran');
    await writeFile(join(root, '.gitattributes'), '*.txt filter=credential-stealer\n');
    await writeFile(join(root, 'payload.txt'), 'secret\n');
    const evidence = treeEvidence(root, parentSha);
    git(root, ['config', 'filter.credential-stealer.clean', `sh -c "touch '${marker}'; cat"`]);
    const request: DeliveryRequest = {
      ...binding(),
      kind: 'git.commit',
      ref: 'refs/heads/task/delivery-feature.7',
      parentSha,
      ...evidence,
      changedFiles: ['.gitattributes', 'payload.txt'],
      message: 'delivery-feature.7 feat reject filters',
      authorName: 'Agent Platform',
      authorEmail: 'agent@example.com',
      authoredAtUnix: 1_700_000_000,
    };

    await expect(port.mutate(request)).rejects.toThrow('unsafe local Git config');
    await expect(access(marker)).rejects.toThrow();
    expect(git(root, ['show-ref', '--verify', '--hash', request.ref]).trim()).toBe(parentSha);
  });

  it('rejects executable fsmonitor config before index access', async () => {
    const { root, parentSha, port } = await setupGit();
    await port.mutate(createRefRequest(parentSha));
    await writeFile(
      join(root, 'packages/workflow-control/src/fsmonitor.ts'),
      'export const x = 1;\n',
    );
    const evidence = treeEvidence(root, parentSha);
    const marker = join(root, 'fsmonitor-ran');
    const monitor = join(root, 'monitor.sh');
    await writeFile(monitor, `#!/bin/sh\ntouch '${marker}'\nexit 0\n`);
    await chmod(monitor, 0o755);
    git(root, ['config', 'core.fsmonitor', monitor]);

    await expect(
      port.mutate({
        ...binding(),
        kind: 'git.commit',
        ref: 'refs/heads/task/delivery-feature.7',
        parentSha,
        ...evidence,
        changedFiles: ['packages/workflow-control/src/fsmonitor.ts'],
        message: 'delivery-feature.7 feat reject fsmonitor',
        authorName: 'Agent Platform',
        authorEmail: 'agent@example.com',
        authoredAtUnix: 1_700_000_000,
      }),
    ).rejects.toThrow('unsafe local Git config');
    await expect(access(marker)).rejects.toThrow();
  });

  it('rejects Git replacement refs before interpreting ancestry or diffs', async () => {
    const { root, parentSha, port } = await setupGit();
    await writeFile(join(root, 'outside.ts'), 'export const attacker = true;\n');
    git(root, ['add', '--', 'outside.ts']);
    git(root, ['commit', '-qm', 'attacker replacement']);
    const attackerSha = git(root, ['rev-parse', 'HEAD']).trim();
    git(root, ['reset', '--hard', '-q', parentSha]);
    git(root, ['replace', parentSha, attackerSha]);

    await expect(port.observe(createRefRequest(parentSha))).rejects.toThrow(
      'Git replacement refs are denied',
    );
  });

  it('performs a fast-forward CAS push through the narrow remote client', async () => {
    const { root, parentSha, port, remote } = await setupGit();
    await port.mutate(createRefRequest(parentSha));
    await writeFile(
      join(root, 'packages/workflow-control/src/push.ts'),
      'export const push = true;\n',
    );
    const evidence = treeEvidence(root, parentSha);
    const commit = (await port.mutate({
      ...binding(),
      kind: 'git.commit',
      ref: 'refs/heads/task/delivery-feature.7',
      parentSha,
      ...evidence,
      changedFiles: ['packages/workflow-control/src/push.ts'],
      message: 'delivery-feature.7 feat push exactly',
      authorName: 'Agent Platform',
      authorEmail: 'agent@example.com',
      authoredAtUnix: 1_700_000_000,
    })) as { sha: string };
    const request: DeliveryRequest = {
      ...binding(),
      kind: 'git.push',
      ref: 'refs/heads/task/delivery-feature.7',
      expectedRemoteSha: parentSha,
      newSha: commit.sha,
    };
    let redirected = false;
    remote.observeRef = async () => {
      redirected = true;
      return '9'.repeat(40);
    };
    remote.pushCas = async () => {
      redirected = true;
    };

    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'unchanged' });
    await port.mutate(request);
    expect(redirected).toBe(false);
    expect(remote.sha).toBe(commit.sha);
    expect(remote.pushes).toBe(1);
    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'expected' });
  });
});
