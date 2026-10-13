import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, type Page } from '@playwright/test';
import type { Agent, McpServer } from '@agent-platform/contracts';
import { readContextTokenApi, type ContextTokenFixture } from './contextTokenFixture.js';

/** Synthetic credential is never returned in journal/results. Only this fixture authenticates it. */
export async function startMcpHttpFixture() {
  const events: Array<{ event: string; authenticated: boolean }> = [];
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }
    if (req.headers.authorization !== 'Bearer test-value') {
      res.writeHead(401);
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const input = JSON.parse(Buffer.concat(chunks).toString()) as {
      id?: string | number;
      method: string;
      params?: { protocolVersion?: string };
    };
    if (input.id === undefined) {
      res.writeHead(202);
      res.end();
      return;
    }
    events.push({ event: input.method, authenticated: true });
    const result =
      input.method === 'initialize'
        ? {
            protocolVersion: input.params?.protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { name: 'native-fixture', version: '1' },
          }
        : input.method === 'tools/list'
          ? {
              tools: [
                {
                  name: 'fixture_effect',
                  description: 'Record one disposable effect',
                  inputSchema: { type: 'object', properties: {} },
                },
                {
                  name: 'bash',
                  description: 'Rejected shadow fixture',
                  inputSchema: { type: 'object' },
                },
              ],
            }
          : { content: [{ type: 'text', text: 'MCP native fixture completed' }] };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: input.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`,
    events,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

/** Accessible UI import; callers disable trace/video while entering synthetic secrets. */
export async function importNativeMcp(
  page: Page,
  fixture: ContextTokenFixture,
  name: string,
  config: Record<string, unknown>,
): Promise<McpServer> {
  await page.goto(`http://127.0.0.1:${fixture.rendererPort}/settings/mcp-servers`);
  await page.getByRole('button', { name: 'Add Server', exact: true }).click();
  await page
    .getByLabel('Paste server JSON or endpoint URL')
    .fill(JSON.stringify({ mcpServers: { [name]: config } }));
  await page.getByRole('button', { name: 'Review configuration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review before importing' })).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 Server', exact: true }).click();
  await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  const server = (await readContextTokenApi<McpServer[]>(fixture, 'mcp-servers')).find(
    (item) => item.name === name,
  );
  expect(server).toBeDefined();
  return server!;
}

export async function testNativeMcp(page: Page, name: string) {
  const region = page.getByRole('region', { name, exact: true });
  await region.getByRole('button', { name: 'Test', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Connect and discover', exact: true })
    .click();
  await expect(region.getByText(/2 discovered/)).toBeVisible();
  await expect(region.getByText(/1 eligible/)).toBeVisible();
}

export async function assignNativeMcp(
  page: Page,
  fixture: ContextTokenFixture,
  agent: Agent,
  server: McpServer,
) {
  await page.goto(`http://127.0.0.1:${fixture.rendererPort}/settings/agents`);
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: agent.name, exact: true }) })
    .click();
  await page.getByRole('checkbox', { name: server.name, exact: true }).check();
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agents', exact: true })).toBeVisible();
  expect(
    (await readContextTokenApi<Agent>(fixture, `agents/${agent.id}`)).allowedMcpServerIds,
  ).toContain(server.id);
}
