import { describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { PathJail } from '../src/security/pathJail.js';
import { createToolDispatchNode, type ToolDispatchContext } from '../src/nodes/toolDispatch.js';
import { CODING_APPLY_PATCH_ID, executeCodingEditTool } from '../src/tools/codingEditTool.js';
import type { Agent, Output } from '@agent-platform/contracts';
import type { HarnessStateType } from '../src/graphState.js';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';

async function withWorkspace<T>(fn: (workspace: string) => Promise<T>): Promise<T> {
  const workspace = join(tmpdir(), `coding-edit-tool-${randomUUID()}`);
  await mkdir(workspace, { recursive: true });
  try {
    return await fn(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function dataOf(output: Output): Record<string, unknown> {
  expect(output.type).toBe('tool_result');
  return (output as Extract<Output, { type: 'tool_result' }>).data as Record<string, unknown>;
}

const makeAgent = (): Agent => ({
  id: 'agent-1',
  slug: 'agent-1',
  name: 'test-agent',
  systemPrompt: '',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 10 },
});

const makeMcpManager = (): McpSessionManager =>
  ({ getSession: () => undefined }) as unknown as McpSessionManager;

const makeState = (call: Record<string, unknown>): HarnessStateType =>
  ({
    trace: [],
    plan: null,
    taskIndex: 1,
    limits: { maxSteps: 10 },
    runId: 'run-1',
    halted: false,
    messages: [],
    toolDefinitions: [],
    llmOutput: {
      kind: 'tool_calls',
      calls: [{ id: 'tc-edit', name: CODING_APPLY_PATCH_ID, args: call }],
    },
    modelConfig: null,
    totalTokensUsed: 0,
    totalCostUnits: 0,
  }) as HarnessStateType;

describe('coding_apply_patch', () => {
  it('previews a replacement without mutating the file', async () =>
    withWorkspace(async (workspace) => {
      const file = join(workspace, 'example.txt');
      await writeFile(file, 'hello\n', 'utf-8');

      const output = await executeCodingEditTool(
        CODING_APPLY_PATCH_ID,
        {
          reason: 'Update greeting',
          dryRun: true,
          operations: [{ path: file, oldText: 'hello', newText: 'hello world' }],
        },
        { workspaceRoot: workspace },
      );

      const data = dataOf(output!);
      expect(data.ok).toBe(true);
      expect(data.result).toMatchObject({ dryRun: true, changedFiles: ['example.txt'] });
      expect(JSON.stringify(data.evidence)).toContain('--- a/example.txt');
      await expect(readFile(file, 'utf-8')).resolves.toBe('hello\n');
    }));

  it('applies a replacement and returns diff evidence', async () =>
    withWorkspace(async (workspace) => {
      const file = join(workspace, 'example.txt');
      await writeFile(file, 'hello\n', 'utf-8');

      const output = await executeCodingEditTool(
        CODING_APPLY_PATCH_ID,
        {
          reason: 'Update greeting',
          operations: [{ path: file, oldText: 'hello', newText: 'hello world' }],
        },
        { workspaceRoot: workspace },
      );

      const data = dataOf(output!);
      expect(data.ok).toBe(true);
      expect(data.evidence).toMatchObject({
        kind: 'edit',
        riskTier: 'medium',
        status: 'succeeded',
      });
      await expect(readFile(file, 'utf-8')).resolves.toBe('hello world\n');
    }));

  it('creates a file when oldText is omitted and the file is missing', async () =>
    withWorkspace(async (workspace) => {
      const file = join(workspace, 'created.txt');

      const output = await executeCodingEditTool(
        CODING_APPLY_PATCH_ID,
        {
          reason: 'Create file',
          operations: [{ path: file, newText: 'new file\n' }],
        },
        { workspaceRoot: workspace },
      );

      const data = dataOf(output!);
      expect(data.ok).toBe(true);
      expect(data.result).toMatchObject({ createdFiles: ['created.txt'] });
      await expect(readFile(file, 'utf-8')).resolves.toBe('new file\n');
    }));

  it('rejects binary edits', async () =>
    withWorkspace(async (workspace) => {
      const file = join(workspace, 'binary.bin');
      await writeFile(file, Buffer.from([0, 1, 2]));

      const output = await executeCodingEditTool(
        CODING_APPLY_PATCH_ID,
        {
          reason: 'Edit binary',
          operations: [{ path: file, oldText: 'x', newText: 'y' }],
        },
        { workspaceRoot: workspace },
      );

      expect(dataOf(output!)).toMatchObject({
        ok: false,
        error: { code: 'BINARY_FILE_DENIED' },
        evidence: { status: 'denied' },
      });
    }));

  it('rejects traversal before native execution through PathJail', async () =>
    withWorkspace(async (workspace) => {
      const nativeToolExecutor = vi.fn();
      const ctx: ToolDispatchContext = {
        agent: makeAgent(),
        mcpManager: makeMcpManager(),
        nativeToolExecutor,
        pathJail: new PathJail([
          { label: 'workspace', hostPath: workspace, permission: 'read_write' },
        ]),
      };
      const node = createToolDispatchNode(ctx);

      const result = await node(
        makeState({
          reason: 'Escape',
          operations: [{ path: '../escape.txt', newText: 'nope' }],
        }),
      );

      expect(nativeToolExecutor).not.toHaveBeenCalled();
      const content = JSON.parse(result.messages![0]!.content);
      expect(content.error).toBe('PATH_ACCESS_DENIED');
      expect(result.trace).toContainEqual(
        expect.objectContaining({
          type: 'tool_dispatch',
          toolId: CODING_APPLY_PATCH_ID,
          ok: false,
        }),
      );
    }));

  it('rejects symlink escapes before native execution through PathJail', async () =>
    withWorkspace(async (workspace) => {
      const outside = join(tmpdir(), `coding-edit-outside-${randomUUID()}`);
      await mkdir(outside, { recursive: true });
      try {
        await symlink(outside, join(workspace, 'link-out'));
        const nativeToolExecutor = vi.fn();
        const ctx: ToolDispatchContext = {
          agent: makeAgent(),
          mcpManager: makeMcpManager(),
          nativeToolExecutor,
          pathJail: new PathJail([
            { label: 'workspace', hostPath: workspace, permission: 'read_write' },
          ]),
        };
        const node = createToolDispatchNode(ctx);

        await node(
          makeState({
            reason: 'Escape',
            operations: [{ path: 'link-out/file.txt', newText: 'nope' }],
          }),
        );

        expect(nativeToolExecutor).not.toHaveBeenCalled();
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    }));
});
