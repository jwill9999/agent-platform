import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile, realpath, readdir, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  CodingCodeSearchInputSchema,
  CodingCodeSearchResultSchema,
  CodingFindRelatedTestsInputSchema,
  CodingFindRelatedTestsResultSchema,
  CodingRepoMapInputSchema,
  CodingRepoMapResultSchema,
  type CodingCodeSearchMatch,
  type CodingEvidence,
  type CodingRelatedTest,
  type CodingRepoMapFile,
  type CodingRepoPackageBoundary,
  type CodingToolEnvelope,
  type Output,
  type Tool as ContractTool,
} from '@agent-platform/contracts';
import { buildRiskMap, errorMessage, toolResult } from './toolHelpers.js';

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_FILES = 200;
const HARD_MAX_FILES = 1_000;
const DEFAULT_SEARCH_RESULTS = 50;
const HARD_SEARCH_RESULTS = 200;
const MAX_SNIPPET_CHARS = 240;
const MAX_WALK_FILES = 10_000;

const IGNORED_DIR_NAMES = new Set([
  '.agent-platform',
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'data',
  'dist',
  'node_modules',
  'test-results',
]);

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

export const REPO_DISCOVERY_TOOL_IDS = {
  repoMap: 'sys_repo_map',
  codeSearch: 'sys_code_search',
  findRelatedTests: 'sys_find_related_tests',
} as const;

export const REPO_DISCOVERY_TOOL_MAP = buildRiskMap(REPO_DISCOVERY_TOOL_IDS, 'low');

export const REPO_DISCOVERY_TOOLS: readonly ContractTool[] = [
  {
    id: REPO_DISCOVERY_TOOL_IDS.repoMap,
    slug: 'sys-repo-map',
    name: 'repo_map',
    description: 'Return a bounded repository map with ignored/generated directories excluded.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
          maxDepth: { type: 'number', description: 'Maximum directory depth, capped at 10.' },
          maxFiles: { type: 'number', description: 'Maximum returned files, capped at 1000.' },
        },
      },
    },
  },
  {
    id: REPO_DISCOVERY_TOOL_IDS.codeSearch,
    slug: 'sys-code-search',
    name: 'code_search',
    description: 'Search text files in a repository with bounded match output.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
          query: { type: 'string', description: 'Literal or regex search query.' },
          regex: { type: 'boolean', description: 'Interpret query as a regex when true.' },
          caseSensitive: { type: 'boolean', description: 'Case-sensitive search when true.' },
          maxResults: { type: 'number', description: 'Maximum matches, capped at 200.' },
          maxFileBytes: {
            type: 'number',
            description: 'Skip files larger than this byte count, capped at 1000000.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    id: REPO_DISCOVERY_TOOL_IDS.findRelatedTests,
    slug: 'sys-find-related-tests',
    name: 'find_related_tests',
    description: 'Find likely test files related to a source path.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Repository path, default ".".' },
          path: { type: 'string', description: 'Source file path to match against tests.' },
          maxResults: { type: 'number', description: 'Maximum related test files, capped at 100.' },
        },
        required: ['path'],
      },
    },
  },
];

type RepoDiscoveryOptions = {
  workspaceRoot?: string;
  defaultRepoPath?: string;
};

type WalkEntry = {
  path: string;
  absolutePath: string;
  kind: 'file' | 'directory';
  depth: number;
  sizeBytes?: number;
};

type WalkResult = {
  entries: WalkEntry[];
  ignoredDirectories: string[];
  totalFiles: number;
  totalDirectories: number;
  truncated: boolean;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

async function resolveRepoPath(
  inputRepoPath: string,
  options?: RepoDiscoveryOptions,
): Promise<string> {
  const workspaceRoot = await realpath(options?.workspaceRoot ?? process.cwd());
  const requested = inputRepoPath || options?.defaultRepoPath || '.';
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
  const info = await stat(repoPath);
  if (!info.isDirectory()) throw new Error(`Repository path "${repoPath}" is not a directory`);
  return repoPath;
}

async function walkRepository(repoPath: string, maxDepth = 10): Promise<WalkResult> {
  const entries: WalkEntry[] = [];
  const ignoredDirectories: string[] = [];
  let totalFiles = 0;
  let totalDirectories = 0;
  let truncated = false;

  async function visit(dir: string, relDir: string, depth: number): Promise<void> {
    if (totalFiles >= MAX_WALK_FILES) {
      truncated = true;
      return;
    }

    const children = await readdir(dir, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name));

    for (const child of children) {
      if (child.isSymbolicLink()) continue;
      const relPath = relDir ? `${relDir}/${child.name}` : child.name;
      const absPath = join(dir, child.name);

      if (child.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(child.name)) {
          ignoredDirectories.push(relPath);
          continue;
        }
        totalDirectories += 1;
        entries.push({ path: relPath, absolutePath: absPath, kind: 'directory', depth });
        if (depth < maxDepth) await visit(absPath, relPath, depth + 1);
        continue;
      }

      if (!child.isFile()) continue;
      const fileStat = await stat(absPath);
      totalFiles += 1;
      entries.push({
        path: relPath,
        absolutePath: absPath,
        kind: 'file',
        depth,
        sizeBytes: fileStat.size,
      });
      if (totalFiles >= MAX_WALK_FILES) {
        truncated = true;
        return;
      }
    }
  }

  await visit(repoPath, '', 1);
  return { entries, ignoredDirectories, totalFiles, totalDirectories, truncated };
}

function envelope(toolId: string, data: CodingToolEnvelope): Output {
  return toolResult(toolId, data as unknown as Record<string, unknown>);
}

function buildEvidence(
  sourceTool: string,
  kind: CodingEvidence['kind'],
  summary: string,
  startedAtMs: number,
  artifact: {
    kind: 'repo_map' | 'search_matches' | 'file_list';
    label: string;
    content: string;
    truncated: boolean;
  },
): CodingEvidence {
  const completedAtMs = Date.now();
  return {
    kind,
    summary,
    artifacts: [
      {
        kind: artifact.kind,
        label: artifact.label,
        storage: 'inline',
        mimeType: 'application/json',
        content: artifact.content,
        sizeBytes: byteLength(artifact.content),
        truncated: artifact.truncated,
        sha256: sha256(artifact.content),
      },
    ],
    riskTier: 'low',
    status: 'succeeded',
    sourceTool,
    startedAtMs,
    completedAtMs,
    durationMs: completedAtMs - startedAtMs,
  };
}

function failure(
  toolId: string,
  kind: CodingEvidence['kind'],
  message: string,
  startedAtMs: number,
): Output {
  const completedAtMs = Date.now();
  return envelope(toolId, {
    ok: false,
    result: {},
    message,
    error: { code: 'REPO_DISCOVERY_FAILED', message },
    evidence: {
      kind,
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

function packageKind(packagePath: string): CodingRepoPackageBoundary['kind'] {
  if (packagePath === '.') return 'workspace';
  if (packagePath.startsWith('apps/')) return 'app';
  if (packagePath.startsWith('packages/')) return 'package';
  return 'unknown';
}

async function packageBoundary(entry: WalkEntry): Promise<CodingRepoPackageBoundary | null> {
  if (entry.kind !== 'file' || basename(entry.path) !== 'package.json') return null;
  const packagePath =
    entry.path === 'package.json' ? '.' : entry.path.slice(0, -'/package.json'.length);
  try {
    const parsed = JSON.parse(await readFile(entry.absolutePath, 'utf-8')) as { name?: unknown };
    return {
      path: packagePath,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      kind: packageKind(packagePath),
    };
  } catch {
    return { path: packagePath, kind: packageKind(packagePath) };
  }
}

function isTestPath(path: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__|e2e)(\/|$)/.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
  );
}

function isTextFile(path: string): boolean {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchRegex(query: string, regex: boolean, caseSensitive: boolean): RegExp {
  return new RegExp(regex ? query : escapeRegExp(query), caseSensitive ? 'g' : 'gi');
}

function snippetFor(line: string, column: number): string {
  const start = Math.max(0, column - 1 - 80);
  const snippet = line.slice(start, start + MAX_SNIPPET_CHARS).trimEnd();
  return start > 0 ? `...${snippet}` : snippet;
}

async function handleRepoMap(
  toolId: string,
  args: Record<string, unknown>,
  options?: RepoDiscoveryOptions,
) {
  const startedAtMs = Date.now();
  try {
    const input = CodingRepoMapInputSchema.parse(args);
    const repoPath = await resolveRepoPath(
      typeof args.repoPath === 'string' ? input.repoPath : '',
      options,
    );
    const walk = await walkRepository(repoPath, input.maxDepth ?? DEFAULT_MAX_DEPTH);
    const files = walk.entries
      .slice(0, Math.min(input.maxFiles ?? DEFAULT_MAX_FILES, HARD_MAX_FILES))
      .map<CodingRepoMapFile>((entry) => ({
        path: entry.path,
        kind: entry.kind,
        sizeBytes: entry.sizeBytes,
      }));
    const packageBoundaries = (
      await Promise.all(walk.entries.map((entry) => packageBoundary(entry)))
    ).filter((entry): entry is CodingRepoPackageBoundary => entry !== null);
    const testDirectories = [
      ...new Set(
        walk.entries
          .filter((entry) => entry.kind === 'directory' && isTestPath(entry.path))
          .map((entry) => entry.path),
      ),
    ];
    const result = CodingRepoMapResultSchema.parse({
      repoPath,
      totalFiles: walk.totalFiles,
      totalDirectories: walk.totalDirectories,
      files,
      packageBoundaries,
      testDirectories,
      ignoredDirectories: walk.ignoredDirectories,
      truncated: walk.truncated || files.length < walk.entries.length,
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(
        toolId,
        'repo_map',
        `Mapped ${result.totalFiles} file(s) and ${result.totalDirectories} directories.`,
        startedAtMs,
        {
          kind: 'repo_map',
          label: 'Repository map',
          content: JSON.stringify(result, null, 2),
          truncated: result.truncated,
        },
      ),
    });
  } catch (err) {
    return failure(toolId, 'repo_map', errorMessage(err), startedAtMs);
  }
}

async function handleCodeSearch(
  toolId: string,
  args: Record<string, unknown>,
  options?: RepoDiscoveryOptions,
) {
  const startedAtMs = Date.now();
  try {
    const input = CodingCodeSearchInputSchema.parse(args);
    const repoPath = await resolveRepoPath(
      typeof args.repoPath === 'string' ? input.repoPath : '',
      options,
    );
    const matcher = buildSearchRegex(input.query, input.regex, input.caseSensitive);
    const walk = await walkRepository(repoPath);
    const matches: CodingCodeSearchMatch[] = [];
    let searchedFiles = 0;
    const maxResults = Math.min(input.maxResults ?? DEFAULT_SEARCH_RESULTS, HARD_SEARCH_RESULTS);

    for (const entry of walk.entries) {
      if (entry.kind !== 'file' || !isTextFile(entry.path)) continue;
      if ((entry.sizeBytes ?? 0) > input.maxFileBytes) continue;
      searchedFiles += 1;
      const content = await readFile(entry.absolutePath, 'utf-8');
      if (content.includes('\0')) continue;
      const lines = content.split('\n');
      for (const [index, line] of lines.entries()) {
        matcher.lastIndex = 0;
        const match = matcher.exec(line);
        if (!match) continue;
        matches.push({
          path: entry.path,
          line: index + 1,
          column: match.index + 1,
          snippet: snippetFor(line, match.index + 1),
        });
        if (matches.length >= maxResults) break;
      }
      if (matches.length >= maxResults) break;
    }

    const result = CodingCodeSearchResultSchema.parse({
      repoPath,
      query: input.query,
      regex: input.regex,
      matches,
      searchedFiles,
      truncated: walk.truncated || matches.length >= maxResults,
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(
        toolId,
        'search',
        `Found ${result.matches.length} match(es).`,
        startedAtMs,
        {
          kind: 'search_matches',
          label: 'Code search matches',
          content: JSON.stringify(result.matches, null, 2),
          truncated: result.truncated,
        },
      ),
    });
  } catch (err) {
    return failure(toolId, 'search', errorMessage(err), startedAtMs);
  }
}

function withoutKnownSuffix(fileName: string): string {
  return fileName
    .replace(/\.(test|spec)\.[cm]?[jt]sx?$/u, '')
    .replace(/\.[cm]?[jt]sx?$/u, '')
    .replace(/\.[^.]+$/u, '');
}

function relatedReason(sourcePath: string, testPath: string): string | null {
  const sourceBase = withoutKnownSuffix(basename(sourcePath));
  const testBase = withoutKnownSuffix(basename(testPath));
  if (!isTestPath(testPath)) return null;
  if (testBase === sourceBase) return 'same basename';
  if (testPath.includes(`/${sourceBase}.`)) return 'test filename contains source basename';
  const sourceDir = sourcePath.split('/').slice(0, -1).join('/');
  if (sourceDir && testPath.startsWith(`${sourceDir}/`)) return 'near source file';
  return null;
}

async function handleFindRelatedTests(
  toolId: string,
  args: Record<string, unknown>,
  options?: RepoDiscoveryOptions,
) {
  const startedAtMs = Date.now();
  try {
    const input = CodingFindRelatedTestsInputSchema.parse(args);
    const repoPath = await resolveRepoPath(
      typeof args.repoPath === 'string' ? input.repoPath : '',
      options,
    );
    const targetPath = isAbsolute(input.path) ? relative(repoPath, input.path) : input.path;
    if (targetPath.startsWith('..')) {
      throw new Error(`Path "${input.path}" is outside the repository`);
    }
    const walk = await walkRepository(repoPath);
    const tests: CodingRelatedTest[] = [];

    for (const entry of walk.entries) {
      if (entry.kind !== 'file') continue;
      const reason = relatedReason(targetPath, entry.path);
      if (!reason) continue;
      tests.push({ path: entry.path, reason });
      if (tests.length >= input.maxResults) break;
    }

    const result = CodingFindRelatedTestsResultSchema.parse({
      repoPath,
      path: targetPath,
      tests,
      searchedFiles: walk.totalFiles,
      truncated: walk.truncated || tests.length >= input.maxResults,
    });
    return envelope(toolId, {
      ok: true,
      result,
      evidence: buildEvidence(
        toolId,
        'search',
        `Found ${result.tests.length} related test file(s).`,
        startedAtMs,
        {
          kind: 'file_list',
          label: 'Related tests',
          content: JSON.stringify(result.tests, null, 2),
          truncated: result.truncated,
        },
      ),
    });
  } catch (err) {
    return failure(toolId, 'search', errorMessage(err), startedAtMs);
  }
}

export async function executeRepoDiscoveryTool(
  toolId: string,
  args: Record<string, unknown>,
  options?: RepoDiscoveryOptions,
): Promise<Output | null> {
  switch (toolId) {
    case REPO_DISCOVERY_TOOL_IDS.repoMap:
      return handleRepoMap(toolId, args, options);
    case REPO_DISCOVERY_TOOL_IDS.codeSearch:
      return handleCodeSearch(toolId, args, options);
    case REPO_DISCOVERY_TOOL_IDS.findRelatedTests:
      return handleFindRelatedTests(toolId, args, options);
    default:
      return null;
  }
}
