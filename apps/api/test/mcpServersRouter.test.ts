import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDatabase, resolveMcpConnection, mcpServers, secretRefs } from '@agent-platform/db';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMcpServersRouter } from '../src/infrastructure/http/v1/mcpServersRouter.js';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';

const fixture = fileURLToPath(
  new URL('../../../packages/mcp-adapter/test/fixtures/protocol-server.mjs', import.meta.url),
);
describe('MCP API real DB and transport', () => {
  let dir: string;
  let opened: ReturnType<typeof openDatabase>;
  let app: express.Express;
  const servers: ReturnType<typeof createServer>[] = [];
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'mcp-api-'));
    opened = openDatabase(path.join(dir, 'db.sqlite'));
    vi.stubEnv('SECRETS_MASTER_KEY', randomBytes(32).toString('base64'));
    app = express();
    app.use(express.json());
    app.use('/mcp', createMcpServersRouter(opened.db));
    app.use(errorMiddleware);
  });
  afterEach(async () => {
    for (const server of servers.splice(0))
      await new Promise<void>((resolve) => server.close(() => resolve()));
    opened.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });
  it('save does not execute; Test performs real stdio discovery, no call, and closes child', async () => {
    const journal = path.join(dir, 'effects.jsonl');
    const saved = await request(app)
      .post('/mcp')
      .send({
        name: 'Local',
        transport: 'stdio',
        command: process.execPath,
        args: [fixture, journal],
        credentials: { env: { FIXTURE_SECRET: 'test-value' } },
      })
      .expect(201);
    expect(existsSync(journal)).toBe(false);
    const tested = await request(app).post(`/mcp/${saved.body.data.id}/test`).expect(200);
    expect(tested.body.data).toMatchObject({
      status: 'ok',
      discoveredCount: 1,
      eligibleCount: 1,
      configurationRevision: 1,
    });
    const events = readFileSync(journal, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(events.filter((event) => event.event === 'effect')).toHaveLength(0);
    expect(() => process.kill(events[0].pid, 0)).toThrow();
    expect(JSON.stringify(tested.body)).not.toContain('PRIVATE_SERVER_STDERR_CANARY');
    expect(JSON.stringify((await request(app).get('/mcp')).body)).not.toContain('test-value');
  });
  it('HTTP test uses same decrypted config as runtime and reports trust exclusions without raw descriptions', async () => {
    const requests: string[] = [];
    const server = createServer(async (req, res) => {
      if (req.method === 'GET') {
        res.writeHead(405).end();
        return;
      }
      if (req.headers.authorization !== 'Bearer synthetic-secret') {
        res.writeHead(401).end('PRIVATE_AUTH_RESPONSE');
        return;
      }
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const message = JSON.parse(raw) as {
        id?: number;
        method: string;
        params?: { protocolVersion: string };
      };
      requests.push(message.method);
      if (message.id === undefined) {
        res.writeHead(202).end();
        return;
      }
      const result =
        message.method === 'initialize'
          ? {
              protocolVersion: message.params?.protocolVersion,
              capabilities: { tools: {} },
              serverInfo: { name: 'fixture', version: '1' },
            }
          : {
              tools: [
                { name: 'fixture_read', inputSchema: { type: 'object', properties: {} } },
                {
                  name: 'bash',
                  description: 'PRIVATE_REJECTED_DESCRIPTION',
                  inputSchema: { type: 'object', properties: {} },
                },
              ],
            };
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No port');
    const saved = await request(app)
      .post('/mcp')
      .send({
        name: 'HTTP',
        transport: 'http',
        url: `http://127.0.0.1:${address.port}/mcp`,
        credentials: { headers: { Authorization: 'Bearer synthetic-secret' } },
      })
      .expect(201);
    expect(requests).toEqual([]);
    expect(saved.body.data.transport).toBe('streamable-http');
    expect(resolveMcpConnection(opened.db, saved.body.data.id).headers?.['Authorization']).toBe(
      'Bearer synthetic-secret',
    );
    const tested = await request(app).post(`/mcp/${saved.body.data.id}/test`).expect(200);
    expect(tested.body.data).toMatchObject({
      status: 'ok',
      discoveredCount: 2,
      eligibleCount: 1,
      rejections: [{ category: 'trust_policy', count: 1 }],
    });
    expect(requests).not.toContain('tools/call');
    expect(JSON.stringify(tested.body)).not.toMatch(/PRIVATE|synthetic-secret/);
    await request(app)
      .put(`/mcp/${saved.body.data.id}`)
      .send({
        name: 'HTTP',
        transport: 'streamable-http',
        url: `http://127.0.0.1:${address.port}/mcp`,
        credentials: { headers: { Authorization: 'Bearer wrong-private' } },
      })
      .expect(200);
    const denied = await request(app).post(`/mcp/${saved.body.data.id}/test`).expect(200);
    expect(denied.body.data).toMatchObject({
      status: 'error',
      code: 'AUTHENTICATION_FAILED',
      configurationRevision: 2,
    });
    expect(JSON.stringify(denied.body)).not.toMatch(/PRIVATE|wrong-private/);
  });
  it('atomic selected import rolls back all writes and ciphertext if any selected entry fails', async () => {
    const config = {
      name: 'Duplicate',
      transport: 'stdio',
      command: 'node',
      credentials: { env: { TOKEN: 'batch-secret' } },
    };
    await request(app)
      .post('/mcp/import')
      .send({ servers: [config, config] })
      .expect(400);
    expect(opened.db.select().from(mcpServers).all()).toEqual([]);
    expect(opened.db.select().from(secretRefs).all()).toEqual([]);
    await request(app)
      .post('/mcp/import')
      .send({ servers: [config, { ...config, name: 'Bad', cwd: '/tmp' }] })
      .expect(400);
    expect(opened.db.select().from(mcpServers).all()).toEqual([]);
  });
  it('duplicate requires reentry; invalid writes and missing key never echo secret input', async () => {
    const saved = await request(app)
      .post('/mcp')
      .send({
        name: 'Saved',
        transport: 'stdio',
        command: 'node',
        credentials: { env: { TOKEN: 'private-key' } },
      })
      .expect(201);
    const duplicate = await request(app).post(`/mcp/${saved.body.data.id}/duplicate`).expect(201);
    expect(duplicate.body.data).toMatchObject({
      needsReconfiguration: true,
      credentialStatus: { env: { TOKEN: false } },
    });
    const test = await request(app).post(`/mcp/${duplicate.body.data.id}/test`).expect(200);
    expect(test.body.data).toMatchObject({
      status: 'error',
      stage: 'configuration',
      code: 'MCP_CONFIGURATION_INVALID',
    });
    const bad = await request(app)
      .post('/mcp')
      .send({
        name: 'bad',
        transport: 'stdio',
        command: 'node',
        metadata: { 'private-key': 'private-key' },
      })
      .expect(400);
    expect(JSON.stringify(bad.body)).not.toContain('private-key');
    vi.stubEnv('SECRETS_MASTER_KEY', '');
    const keylessTest = await request(app).post(`/mcp/${saved.body.data.id}/test`).expect(200);
    expect(keylessTest.body.data).toMatchObject({
      status: 'error',
      stage: 'configuration',
      code: 'MCP_SECRET_KEY_UNAVAILABLE',
      configurationRevision: 1,
    });
    const missing = await request(app)
      .post('/mcp')
      .send({
        name: 'Keyless',
        transport: 'stdio',
        command: 'node',
        credentials: { env: { TOKEN: 'private-key' } },
      })
      .expect(503);
    expect(missing.body.error.code).toBe('MCP_SECRET_KEY_UNAVAILABLE');
    expect(JSON.stringify(missing.body)).not.toContain('private-key');
  });
});
