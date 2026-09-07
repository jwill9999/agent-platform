import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { createWorkflowMcpServer } from '../src/mcpServer.js';
import { WorkflowStore } from '../src/storage.js';

describe('workflow-control MCP', () => {
  it('exposes read-only status and recovery preview without direct external writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-mcp-'));
    const store = new WorkflowStore(join(root, 'workflow.sqlite'));
    const server = createWorkflowMcpServer(store);
    const client = new Client({ name: 'workflow-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      'workflow_status',
      'workflow_resume_preview',
    ]);
    expect(listed.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    const result = await client.callTool({
      name: 'workflow_status',
      arguments: { runId: 'missing' },
    });
    expect(result.content).toEqual([{ type: 'text', text: 'null' }]);
    await client.close();
    await server.close();
    store.close();
    await rm(root, { recursive: true, force: true });
  });
});
