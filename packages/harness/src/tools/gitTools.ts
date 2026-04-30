import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  CodingGitBranchInfoResultSchema,
  CodingGitChangedFilesResultSchema,
  CodingGitDiffInputSchema,
  CodingGitDiffResultSchema,
  CodingGitLogInputSchema,
  CodingGitLogResultSchema,
  CodingGitStatusResultSchema,
  type CodingEvidence,
  type CodingGitFileChange,
  type CodingToolEnvelope,
  type Output,
  type Tool as ContractTool,
} from '@agent-platform/contracts';
import { buildRiskMap, errorMessage, stringArg, toolResult } from './toolHelpers.js';

const GIT_BIN = '/usr/bin/git';
const MAX_GIT_BUFFER_BYTES = 2 * 1024 * 1024;
const DEFAULT_DIFF_BYTES = 20_000;
const HARD_DIFF_BYTES = 100_000;
const MAX_CHANGED_FILES = 500;

export const GIT_TOOL_IDS = {
  status: 'sys_git_status',
  diff: 'sys_git_diff',
  log: 'sys_git_log',
  branchInfo: 'sys_git_branch_info',
  changedFiles: 'sys_git_changed_files',
} as const;

export const GIT_TOOL_MAP = buildRiskMap(GIT_TOOL_IDS, 'low');

export const GIT_TOOLS: readonly ContractTool[] = [
  {
    id: GIT_TOOL_IDS.status,
    slug: 'sys-git-status',
    name: 'git_status',
    description: 'Read repository status, current branch, HEAD, and changed files.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
        },
      },
    },
  },
  {
    id: GIT_TOOL_IDS.diff,
    slug: 'sys-git-diff',
    name: 'git_diff',
    description: 'Read a bounded unstaged or staged git diff.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
          path: { type: 'string', description: 'Optional file path to limit the diff.' },
          staged: { type: 'boolean', description: 'Read staged diff when true.' },
          maxBytes: {
            type: 'number',
            description: `Maximum inline diff bytes, capped at ${HARD_DIFF_BYTES}.`,
          },
        },
      },
    },
  },
  {
    id: GIT_TOOL_IDS.log,
    slug: 'sys-git-log',
    name: 'git_log',
    description: 'Read recent git commits in structured form.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
          ref: { type: 'string', description: 'Optional revision or branch to inspect.' },
          maxCount: { type: 'number', description: 'Maximum commits to return, capped at 50.' },
        },
      },
    },
  },
  {
    id: GIT_TOOL_IDS.branchInfo,
    slug: 'sys-git-branch-info',
    name: 'git_branch_info',
    description: 'Read current branch, HEAD, upstream, and ahead/behind counts.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
        },
      },
    },
  },
  {
    id: GIT_TOOL_IDS.changedFiles,
    slug: 'sys-git-changed-files',
    name: 'git_changed_files',
    description: 'Read a bounded summary of staged, unstaged, and untracked files.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
        },
      },
    },
  },
];

type GitOptions = {
  workspaceRoot?: string;
};

type GitCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

async function runGit(repoPath: string, args: readonly string[]): Promise<GitCommandResult> {
  return new Promise((resolveResult) => {
    execFile(
      GIT_BIN,
      ['-C', repoPath, ...args],
      { maxBuffer: MAX_GIT_BUFFER_BYTES },
      (error, stdout, stderr) => {
        const exitCode =
          error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolveResult({ stdout, stderr, exitCode });
      },
    );
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

function truncateUtf8(value: string, maxBytes: number): { content: string; truncated: boolean } {
  const bytes = Buffer.from(value, 'utf-8');
  if (bytes.byteLength <= maxBytes) return { content: value, truncated: false };
  return {
    content: `${bytes.subarray(0, maxBytes).toString('utf-8')}\n... (truncated, ${bytes.byteLength} bytes total)`,
    truncated: true,
  };
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

async function resolveRepoPath(
  args: Record<string, unknown>,
  options?: GitOptions,
): Promise<string> {
  const workspaceRoot = await realpath(options?.workspaceRoot ?? process.cwd());
  const requested = stringArg(args, 'repoPath', '.');
  const candidate = isAbsolute(requested) ? requested : resolve(workspaceRoot, requested);

  try {
    await access(candidate, constants.R_OK);
  } catch {
    throw new Error(`Repository path "${candidate}" is not readable`);
  }

  const repoPath = await realpath(candidate);
  if (!isWithin(workspaceRoot, repoPath)) {
    throw new Error(`Repository path "${repoPath}" is outside the approved workspace`);
  }

  const topLevel = await runGit(repoPath, ['rev-parse', '--show-toplevel']);
  if (topLevel.exitCode !== 0) {
    throw new Error('Path is not inside a git repository');
  }

  const repoRoot = (await realpath(topLevel.stdout.trim())) || repoPath;
  if (!isWithin(workspaceRoot, repoRoot)) {
    throw new Error(`Git repository "${repoRoot}" is outside the approved workspace`);
  }
  return repoRoot;
}

function parseAheadBehind(branchLine: string): { ahead: number; behind: number } {
  const aheadMatch = /\bahead (\d+)/.exec(branchLine);
  const behindMatch = /\bbehind (\d+)/.exec(branchLine);
  return {
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0,
  };
}

function parseBranchName(branchLine: string): string {
  const body = branchLine.replace(/^##\s*/, '');
  const noCommits = /^No commits yet on (.+)$/.exec(body);
  if (noCommits?.[1]) return noCommits[1];
  return body.split('...')[0]?.split(' [')[0]?.trim() || 'HEAD';
}

function parseStatusLines(stdout: string): {
  branch: string;
  ahead: number;
  behind: number;
  files: CodingGitFileChange[];
} {
  const lines = stdout.split('\n').filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith('## ')) ?? '## HEAD';
  const branch = parseBranchName(branchLine);
  const { ahead, behind } = parseAheadBehind(branchLine);
  const files = lines
    .filter((line) => !line.startsWith('## '))
    .map((line) => {
      const stagedCode = line[0] ?? ' ';
      const unstagedCode = line[1] ?? ' ';
      const filePath = line.slice(3).trim();
      return {
        path: filePath.includes(' -> ') ? (filePath.split(' -> ').at(-1) ?? filePath) : filePath,
        status: `${stagedCode}${unstagedCode}`.trim() || 'M',
        staged: stagedCode !== ' ' && stagedCode !== '?',
        unstaged: unstagedCode !== ' ' || stagedCode === '?',
      };
    });

  return { branch, ahead, behind, files };
}

function envelope(toolId: string, data: CodingToolEnvelope): Output {
  return toolResult(toolId, data as unknown as Record<string, unknown>);
}

function buildEvidence(
  sourceTool: string,
  summary: string,
  startedAtMs: number,
  artifact?: {
    kind: 'stdout' | 'diff' | 'file_list';
    label: string;
    content: string;
    truncated: boolean;
  },
): CodingEvidence {
  const completedAtMs = Date.now();
  return {
    kind: 'git',
    summary,
    artifacts: artifact
      ? [
          {
            kind: artifact.kind,
            label: artifact.label,
            storage: 'inline',
            mimeType: artifact.kind === 'diff' ? 'text/x-diff' : 'application/json',
            content: artifact.content,
            sizeBytes: byteLength(artifact.content),
            truncated: artifact.truncated,
            sha256: sha256(artifact.content),
          },
        ]
      : [],
    riskTier: 'low',
    status: 'succeeded',
    sourceTool,
    startedAtMs,
    completedAtMs,
    durationMs: completedAtMs - startedAtMs,
  };
}

function failure(toolId: string, message: string, startedAtMs: number): Output {
  const completedAtMs = Date.now();
  return envelope(toolId, {
    ok: false,
    result: {},
    message,
    error: { code: 'GIT_TOOL_FAILED', message },
    evidence: {
      kind: 'git',
      summary: message,
      artifacts: [],
      riskTier: 'low',
      status: 'failed',
      sourceTool: toolId,
      startedAtMs,
      completedAtMs,
      durationMs: completedAtMs - startedAtMs,
    },
  });
}

async function headFor(repoPath: string): Promise<string | undefined> {
  const result = await runGit(repoPath, ['rev-parse', '--verify', 'HEAD']);
  return result.exitCode === 0 ? result.stdout.trim() : undefined;
}

async function handleStatus(toolId: string, args: Record<string, unknown>, options?: GitOptions) {
  const startedAtMs = Date.now();
  try {
    const repoPath = await resolveRepoPath(args, options);
    const status = await runGit(repoPath, [
      'status',
      '--short',
      '--branch',
      '--untracked-files=all',
    ]);
    if (status.exitCode !== 0) throw new Error(status.stderr || 'git status failed');
    const parsed = parseStatusLines(status.stdout);
    const result = CodingGitStatusResultSchema.parse({
      repoPath,
      branch: parsed.branch,
      head: await headFor(repoPath),
      clean: parsed.files.length === 0,
      ahead: parsed.ahead,
      behind: parsed.behind,
      changedFiles: parsed.files.slice(0, MAX_CHANGED_FILES),
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(
        toolId,
        result.clean
          ? 'Working tree is clean.'
          : `Working tree has ${result.changedFiles.length} changed file(s).`,
        startedAtMs,
        {
          kind: 'file_list',
          label: 'Git status',
          content: JSON.stringify(result.changedFiles, null, 2),
          truncated: parsed.files.length > result.changedFiles.length,
        },
      ),
    });
  } catch (err) {
    return failure(toolId, errorMessage(err), startedAtMs);
  }
}

function pathspecFor(repoPath: string, pathArg: string | undefined): string | undefined {
  if (!pathArg) return undefined;
  const absPath = isAbsolute(pathArg) ? pathArg : resolve(repoPath, pathArg);
  if (!isWithin(repoPath, absPath)) {
    throw new Error(`Diff path "${absPath}" is outside the repository`);
  }
  return relative(repoPath, absPath) || '.';
}

async function handleDiff(toolId: string, args: Record<string, unknown>, options?: GitOptions) {
  const startedAtMs = Date.now();
  try {
    const repoPath = await resolveRepoPath(args, options);
    const input = CodingGitDiffInputSchema.parse(args);
    const gitArgs = ['diff', '--no-ext-diff'];
    if (input.staged) gitArgs.push('--cached');
    const pathspec = pathspecFor(repoPath, input.path);
    if (pathspec) gitArgs.push('--', pathspec);
    const diff = await runGit(repoPath, gitArgs);
    if (diff.exitCode !== 0) throw new Error(diff.stderr || 'git diff failed');
    const maxBytes = Math.min(input.maxBytes ?? DEFAULT_DIFF_BYTES, HARD_DIFF_BYTES);
    const truncated = truncateUtf8(diff.stdout, maxBytes);
    const result = CodingGitDiffResultSchema.parse({
      repoPath,
      staged: input.staged,
      path: pathspec,
      diff: truncated.content,
      sizeBytes: byteLength(diff.stdout),
      truncated: truncated.truncated,
      filesChanged: (diff.stdout.match(/^diff --git /gm) ?? []).length,
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(
        toolId,
        `Read diff for ${result.filesChanged} file(s).`,
        startedAtMs,
        {
          kind: 'diff',
          label: 'Git diff',
          content: result.diff,
          truncated: result.truncated,
        },
      ),
    });
  } catch (err) {
    return failure(toolId, errorMessage(err), startedAtMs);
  }
}

async function handleLog(toolId: string, args: Record<string, unknown>, options?: GitOptions) {
  const startedAtMs = Date.now();
  try {
    const repoPath = await resolveRepoPath(args, options);
    const input = CodingGitLogInputSchema.parse(args);
    const maxCount = input.maxCount;
    const gitArgs = [
      'log',
      `--max-count=${maxCount}`,
      '--date=iso-strict',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%aI%x1f%s',
    ];
    if (input.ref) gitArgs.push(input.ref);
    const log = await runGit(repoPath, gitArgs);
    if (log.exitCode !== 0) throw new Error(log.stderr || 'git log failed');
    const commits = log.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash = '', shortHash = '', author = '', authoredAt = '', subject = ''] =
          line.split('\x1f');
        return { hash, shortHash, author, authoredAt, subject };
      });
    const result = CodingGitLogResultSchema.parse({
      repoPath,
      ref: input.ref,
      commits,
      truncated: commits.length >= maxCount,
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(toolId, `Read ${result.commits.length} commit(s).`, startedAtMs, {
        kind: 'stdout',
        label: 'Git log',
        content: JSON.stringify(result.commits, null, 2),
        truncated: result.truncated,
      }),
    });
  } catch (err) {
    return failure(toolId, errorMessage(err), startedAtMs);
  }
}

async function handleBranchInfo(
  toolId: string,
  args: Record<string, unknown>,
  options?: GitOptions,
) {
  const startedAtMs = Date.now();
  try {
    const repoPath = await resolveRepoPath(args, options);
    const status = await runGit(repoPath, ['status', '--short', '--branch']);
    if (status.exitCode !== 0) throw new Error(status.stderr || 'git status failed');
    const parsed = parseStatusLines(status.stdout);
    const upstream = await runGit(repoPath, [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}',
    ]);
    const result = CodingGitBranchInfoResultSchema.parse({
      repoPath,
      branch: parsed.branch,
      head: await headFor(repoPath),
      upstream: upstream.exitCode === 0 ? upstream.stdout.trim() : undefined,
      ahead: parsed.ahead,
      behind: parsed.behind,
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(toolId, `Current branch is ${result.branch}.`, startedAtMs, {
        kind: 'stdout',
        label: 'Git branch info',
        content: JSON.stringify(result, null, 2),
        truncated: false,
      }),
    });
  } catch (err) {
    return failure(toolId, errorMessage(err), startedAtMs);
  }
}

async function handleChangedFiles(
  toolId: string,
  args: Record<string, unknown>,
  options?: GitOptions,
) {
  const startedAtMs = Date.now();
  try {
    const repoPath = await resolveRepoPath(args, options);
    const status = await runGit(repoPath, [
      'status',
      '--short',
      '--branch',
      '--untracked-files=all',
    ]);
    if (status.exitCode !== 0) throw new Error(status.stderr || 'git status failed');
    const parsed = parseStatusLines(status.stdout);
    const files = parsed.files.slice(0, MAX_CHANGED_FILES);
    const result = CodingGitChangedFilesResultSchema.parse({
      repoPath,
      count: parsed.files.length,
      files,
      truncated: parsed.files.length > files.length,
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(toolId, `Found ${result.count} changed file(s).`, startedAtMs, {
        kind: 'file_list',
        label: 'Git changed files',
        content: JSON.stringify(result.files, null, 2),
        truncated: result.truncated,
      }),
    });
  } catch (err) {
    return failure(toolId, errorMessage(err), startedAtMs);
  }
}

export async function executeGitTool(
  toolId: string,
  args: Record<string, unknown>,
  options?: GitOptions,
): Promise<Output | null> {
  switch (toolId) {
    case GIT_TOOL_IDS.status:
      return handleStatus(toolId, args, options);
    case GIT_TOOL_IDS.diff:
      return handleDiff(toolId, args, options);
    case GIT_TOOL_IDS.log:
      return handleLog(toolId, args, options);
    case GIT_TOOL_IDS.branchInfo:
      return handleBranchInfo(toolId, args, options);
    case GIT_TOOL_IDS.changedFiles:
      return handleChangedFiles(toolId, args, options);
    default:
      return null;
  }
}
