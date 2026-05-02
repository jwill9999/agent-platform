import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { executeGitTool, GIT_TOOL_IDS, GIT_TOOLS } from '../src/tools/gitTools.js';

const GIT_BIN = '/usr/bin/git';

function git(cwd: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(GIT_BIN, ['-C', cwd, ...args], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function resultData(output: Awaited<ReturnType<typeof executeGitTool>>) {
  expect(output).not.toBeNull();
  expect(output!.type).toBe('tool_result');
  if (output!.type !== 'tool_result') throw new Error('Expected tool_result');
  expect(output.data.ok).toBe(true);
  return output.data.result as Record<string, unknown>;
}

function failedMessage(output: Awaited<ReturnType<typeof executeGitTool>>) {
  expect(output).not.toBeNull();
  expect(output!.type).toBe('tool_result');
  if (output!.type !== 'tool_result') throw new Error('Expected tool_result');
  expect(output.data.ok).toBe(false);
  const error = output.data.error as { message: string };
  return error.message;
}

describe('git tools', () => {
  let root: string;
  let repo: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'git-tools-test-'));
    repo = join(root, 'repo');
    await mkdir(repo);
    await git(repo, ['init']);
    await git(repo, ['config', 'user.name', 'Test User']);
    await git(repo, ['config', 'user.email', 'test@example.com']);
    await writeFile(join(repo, 'README.md'), 'hello\n', 'utf-8');
    await git(repo, ['add', 'README.md']);
    await git(repo, ['commit', '-m', 'Initial commit']);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('defines read-only low-risk git tools', () => {
    expect(GIT_TOOLS).toHaveLength(5);
    expect(GIT_TOOLS.map((tool) => tool.name)).toEqual([
      'git_status',
      'git_diff',
      'git_log',
      'git_branch_info',
      'git_changed_files',
    ]);
    expect(GIT_TOOLS.every((tool) => tool.riskTier === 'low')).toBe(true);
  });

  it('returns clean status for a committed repository', async () => {
    const result = resultData(
      await executeGitTool(GIT_TOOL_IDS.status, { repoPath: repo }, { workspaceRoot: root }),
    );

    expect(result.clean).toBe(true);
    expect(result.head).toEqual(expect.any(String));
    expect(result.changedFiles).toEqual([]);
  });

  it('defaults git tools to the active project path when repoPath is omitted', async () => {
    const result = resultData(
      await executeGitTool(
        GIT_TOOL_IDS.status,
        {},
        { workspaceRoot: root, defaultRepoPath: 'repo' },
      ),
    );

    expect(result.clean).toBe(true);
  });

  it('summarizes staged, unstaged, and untracked files', async () => {
    await writeFile(join(repo, 'README.md'), 'hello\nupdated\n', 'utf-8');
    await writeFile(join(repo, 'staged.txt'), 'staged\n', 'utf-8');
    await writeFile(join(repo, 'untracked.txt'), 'new\n', 'utf-8');
    await git(repo, ['add', 'staged.txt']);

    const result = resultData(
      await executeGitTool(GIT_TOOL_IDS.changedFiles, { repoPath: repo }, { workspaceRoot: root }),
    );
    const files = result.files as Array<{ path: string; staged: boolean; unstaged: boolean }>;

    expect(result.count).toBe(3);
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', staged: false, unstaged: true }),
        expect.objectContaining({ path: 'staged.txt', staged: true, unstaged: false }),
        expect.objectContaining({ path: 'untracked.txt', staged: false, unstaged: true }),
      ]),
    );
  });

  it('returns bounded diff output', async () => {
    await writeFile(join(repo, 'README.md'), `${'changed\n'.repeat(200)}`, 'utf-8');

    const result = resultData(
      await executeGitTool(
        GIT_TOOL_IDS.diff,
        { repoPath: repo, path: 'README.md', maxBytes: 120 },
        { workspaceRoot: root },
      ),
    );

    expect(result.filesChanged).toBe(1);
    expect(result.truncated).toBe(true);
    expect(String(result.diff).length).toBeLessThan(260);
  });

  it('returns recent log entries', async () => {
    const result = resultData(
      await executeGitTool(
        GIT_TOOL_IDS.log,
        { repoPath: repo, maxCount: 5 },
        { workspaceRoot: root },
      ),
    );
    const commits = result.commits as Array<{ subject: string; author: string }>;

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ subject: 'Initial commit', author: 'Test User' });
  });

  it('returns branch information', async () => {
    const result = resultData(
      await executeGitTool(GIT_TOOL_IDS.branchInfo, { repoPath: repo }, { workspaceRoot: root }),
    );

    expect(result.branch).toEqual(expect.any(String));
    expect(result.head).toEqual(expect.any(String));
    expect(result.ahead).toBe(0);
    expect(result.behind).toBe(0);
  });

  it('denies non-repository paths', async () => {
    const nonRepo = join(root, 'not-a-repo');
    await mkdir(nonRepo);

    const message = failedMessage(
      await executeGitTool(GIT_TOOL_IDS.status, { repoPath: nonRepo }, { workspaceRoot: root }),
    );

    expect(message).toContain('not inside a git repository');
  });

  it('denies repositories outside the configured workspace', async () => {
    const workspace = join(root, 'workspace');
    const outside = join(root, 'outside');
    await mkdir(workspace);
    await mkdir(outside);
    await git(outside, ['init']);

    const message = failedMessage(
      await executeGitTool(
        GIT_TOOL_IDS.status,
        { repoPath: outside },
        { workspaceRoot: workspace },
      ),
    );

    expect(message).toContain('outside the approved workspace');
  });

  it('returns null for unknown tool ID', async () => {
    await expect(executeGitTool('sys_unknown', {}, { workspaceRoot: root })).resolves.toBeNull();
  });
});
