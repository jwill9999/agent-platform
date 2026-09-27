#!/usr/bin/env node
import { discoverCanonicalRuns } from './runDiscovery.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { WorkflowStore } from './storage.js';

export function createWorkflowMcpServer(
  store: WorkflowStore,
  scope?: { codexHome: string; workspaceRoot: string },
): McpServer {
  const server = new McpServer({ name: 'workflow-control', version: '0.1.0' });
  server.registerTool(
    'workflow_status',
    {
      description: 'Read durable workflow run state. This tool performs no external mutation.',
      inputSchema: { runId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    ({ runId }) => ({
      content: [{ type: 'text', text: JSON.stringify(store.getRun(runId) ?? null) }],
    }),
  );
  server.registerTool(
    'workflow_resume_preview',
    {
      description: 'List prepared transitions requiring broker reconciliation.',
      inputSchema: { runId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    ({ runId }) => ({
      content: [{ type: 'text', text: JSON.stringify(store.listPreparedTransitions(runId)) }],
    }),
  );
  server.registerTool(
    'workflow_discover',
    {
      description:
        'Read canonical task run inventory. Unknown state blocks new-run creation; this tool never starts work.',
      inputSchema: {
        taskId: z.string().min(1),
        materialDigest: z.string().optional(),
        policyDigest: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (query) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            scope
              ? discoverCanonicalRuns({ ...scope, ...query })
              : { status: 'unknown', reason: 'run_discovery_scope_unconfigured' },
          ),
        },
      ],
    }),
  );
  return server;
}

async function main(): Promise<void> {
  const path = process.env.WORKFLOW_CONTROL_DB;
  if (path === undefined || path.trim() === '') {
    throw new Error('WORKFLOW_CONTROL_DB is required');
  }
  const store = new WorkflowStore(resolve(path), { readonly: true });
  const home = process.env.CODEX_HOME;
  const workspace = process.env.WORKFLOW_WORKSPACE_ROOT;
  const server = createWorkflowMcpServer(
    store,
    home && workspace ? { codexHome: home, workspaceRoot: workspace } : undefined,
  );
  const shutdown = (): void => {
    void server.close().finally(() => store.close());
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await server.connect(new StdioServerTransport());
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
