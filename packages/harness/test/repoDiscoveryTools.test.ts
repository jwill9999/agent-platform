import { mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  executeRepoDiscoveryTool,
  REPO_DISCOVERY_TOOL_IDS,
  REPO_DISCOVERY_TOOLS,
} from '../src/tools/repoDiscoveryTools.js';

function data(output: Awaited<ReturnType<typeof executeRepoDiscoveryTool>>) {
  expect(output).not.toBeNull();
  expect(output!.type).toBe('tool_result');
  if (output!.type !== 'tool_result') throw new Error('Expected tool_result');
  expect(output.data.ok, JSON.stringify(output.data, null, 2)).toBe(true);
  return output.data.result as Record<string, unknown>;
}

function failedMessage(output: Awaited<ReturnType<typeof executeRepoDiscoveryTool>>) {
  expect(output).not.toBeNull();
  expect(output!.type).toBe('tool_result');
  if (output!.type !== 'tool_result') throw new Error('Expected tool_result');
  expect(output.data.ok).toBe(false);
  const error = output.data.error as { message: string };
  return error.message;
}

describe('repo discovery tools', () => {
  let root: string;
  let repo: string;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'repo-discovery-test-'));
    repo = join(root, 'repo');
    await mkdir(join(repo, 'apps', 'web', 'src'), { recursive: true });
    await mkdir(join(repo, 'apps', 'web', 'test'), { recursive: true });
    await mkdir(join(repo, 'packages', 'harness', 'src'), { recursive: true });
    await mkdir(join(repo, 'packages', 'harness', 'test'), { recursive: true });
    await mkdir(join(repo, 'node_modules', 'hidden'), { recursive: true });
    await mkdir(join(repo, '.git'), { recursive: true });
    await writeFile(
      join(repo, 'package.json'),
      JSON.stringify({ name: 'agent-platform', private: true }),
      'utf-8',
    );
    await writeFile(
      join(repo, 'apps', 'web', 'package.json'),
      JSON.stringify({ name: '@agent-platform/web' }),
      'utf-8',
    );
    await writeFile(
      join(repo, 'apps', 'web', 'src', 'widget.ts'),
      'export function renderWidget() {\n  return "Needle";\n}\n',
      'utf-8',
    );
    await writeFile(
      join(repo, 'apps', 'web', 'test', 'widget.test.ts'),
      'import { renderWidget } from "../src/widget";\n',
      'utf-8',
    );
    await writeFile(
      join(repo, 'packages', 'harness', 'src', 'runner.ts'),
      'export const runner = "needle";\n',
      'utf-8',
    );
    await writeFile(
      join(repo, 'packages', 'harness', 'test', 'runner.test.ts'),
      'import { runner } from "../src/runner";\n',
      'utf-8',
    );
    await writeFile(join(repo, 'node_modules', 'hidden', 'bad.ts'), 'Needle\n', 'utf-8');
    await symlink(join(root, 'outside'), join(repo, 'outside-link'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('defines three low-risk repository discovery tools', () => {
    expect(REPO_DISCOVERY_TOOLS.map((tool) => tool.name)).toEqual([
      'repo_map',
      'code_search',
      'find_related_tests',
    ]);
    expect(REPO_DISCOVERY_TOOLS.every((tool) => tool.riskTier === 'low')).toBe(true);
  });

  it('returns a bounded repository map and excludes ignored directories', async () => {
    const result = data(
      await executeRepoDiscoveryTool(
        REPO_DISCOVERY_TOOL_IDS.repoMap,
        { repoPath: repo, maxDepth: 5, maxFiles: 50 },
        { workspaceRoot: root },
      ),
    );

    const files = result.files as Array<{ path: string }>;
    const boundaries = result.packageBoundaries as Array<{ path: string; name?: string }>;

    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'apps/web/src/widget.ts' }),
        expect.objectContaining({ path: 'packages/harness/test/runner.test.ts' }),
      ]),
    );
    expect(files.some((file) => file.path.includes('node_modules'))).toBe(false);
    expect(result.ignoredDirectories).toEqual(expect.arrayContaining(['.git', 'node_modules']));
    expect(boundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '.', name: 'agent-platform' }),
        expect.objectContaining({ path: 'apps/web', name: '@agent-platform/web' }),
      ]),
    );
    expect(result.testDirectories).toEqual(
      expect.arrayContaining(['apps/web/test', 'packages/harness/test']),
    );
  });

  it('searches text files with bounded results and skips ignored directories', async () => {
    const result = data(
      await executeRepoDiscoveryTool(
        REPO_DISCOVERY_TOOL_IDS.codeSearch,
        { repoPath: repo, query: 'needle', maxResults: 1 },
        { workspaceRoot: root },
      ),
    );

    const matches = result.matches as Array<{ path: string; line: number; snippet: string }>;
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ path: 'apps/web/src/widget.ts', line: 2 });
    expect(matches[0]?.snippet).toContain('Needle');
    expect(String(JSON.stringify(matches))).not.toContain('node_modules');
    expect(result.truncated).toBe(true);
  });

  it('supports regex search', async () => {
    const result = data(
      await executeRepoDiscoveryTool(
        REPO_DISCOVERY_TOOL_IDS.codeSearch,
        { repoPath: repo, query: 'renderW[a-z]+', regex: true, caseSensitive: true },
        { workspaceRoot: root },
      ),
    );

    expect(result.matches).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'apps/web/src/widget.ts' })]),
    );
  });

  it('finds related tests by basename', async () => {
    const result = data(
      await executeRepoDiscoveryTool(
        REPO_DISCOVERY_TOOL_IDS.findRelatedTests,
        { repoPath: repo, path: 'apps/web/src/widget.ts' },
        { workspaceRoot: root },
      ),
    );

    expect(result.tests).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'apps/web/test/widget.test.ts' })]),
    );
  });

  it('denies repository paths outside the workspace', async () => {
    const outside = join(root, 'outside');
    await mkdir(outside);

    const message = failedMessage(
      await executeRepoDiscoveryTool(
        REPO_DISCOVERY_TOOL_IDS.repoMap,
        { repoPath: outside },
        { workspaceRoot: repo },
      ),
    );

    expect(message).toContain('outside the approved workspace');
  });

  it('returns null for unknown tool IDs', async () => {
    await expect(
      executeRepoDiscoveryTool('sys_unknown', {}, { workspaceRoot: root }),
    ).resolves.toBeNull();
  });
});
