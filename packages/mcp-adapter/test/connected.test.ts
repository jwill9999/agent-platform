import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import type { ResolvedMcpConnection } from '@agent-platform/contracts';
import { McpSessionManager } from '../src/manager.js';
import { openMcpSession, type McpSession } from '../src/session.js';

const fixture = fileURLToPath(new URL('./fixtures/protocol-server.mjs', import.meta.url));
const dirs: string[] = [];
const sessions: McpSession[] = [];
const servers: Server[] = [];
const newStdio = (mode = 'normal') => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-connected-'));
  dirs.push(dir);
  const journal = join(dir, 'journal.jsonl');
  const config: ResolvedMcpConnection = {
    id: 'fixture',
    name: 'Fixture',
    transport: 'stdio',
    command: process.execPath,
    args: [fixture, journal, mode],
    env: { FIXTURE_SECRET: 'test-value' },
  };
  return {
    config,
    events: () =>
      readFileSync(journal, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { event: string; pid?: number }),
  };
};
const connect = async (config: ResolvedMcpConnection, signal?: AbortSignal) => {
  const session = await openMcpSession(config, { signal });
  sessions.push(session);
  return session;
};
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(sessions.splice(0).map((s) => s.close()));
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections();
          s.close(() => resolve());
        }),
    ),
  );
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
  vi.unstubAllEnvs();
});

async function httpFixture(
  mode: 'normal' | 'auth' | 'redirect' | 'lost-response' | 'malformed' = 'normal',
) {
  const observations = { effects: 0, posts: 0, gets: 0, authenticated: 0, redirected: 0 };
  const server = createServer(async (req, res) => {
    if (req.url === '/redirected') {
      observations.redirected++;
      res.end();
      return;
    }
    if (req.method === 'GET') {
      observations.gets++;
      res.writeHead(405).end();
      return;
    }
    observations.posts++;
    if (req.headers.authorization === 'Bearer test-canary') observations.authenticated++;
    if (mode === 'redirect') {
      res.writeHead(307, { location: '/redirected' }).end();
      return;
    }
    if (mode === 'auth') {
      res.writeHead(401).end('PRIVATE_AUTH_BODY_CANARY');
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    const request = JSON.parse(body);
    if (!('id' in request)) {
      res.writeHead(202).end();
      return;
    }
    let result: unknown;
    if (request.method === 'initialize')
      result = {
        protocolVersion: request.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'http-fixture', version: '1' },
      };
    else if (request.method === 'tools/list')
      result =
        mode === 'malformed'
          ? { tools: 'PRIVATE_BODY_CANARY' }
          : { tools: [{ name: 'fixture_effect', inputSchema: { type: 'object' } }] };
    else {
      observations.effects++;
      if (mode === 'lost-response') {
        req.socket.destroy();
        return;
      }
      result = { content: [{ type: 'text', text: 'effect recorded' }] };
    }
    res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing fixture address');
  const config: ResolvedMcpConnection = {
    id: 'http-fixture',
    name: 'HTTP fixture',
    transport: 'http',
    url: `http://127.0.0.1:${address.port}/mcp`,
    headers: { Authorization: 'Bearer test-canary' },
  };
  return { config, observations };
}

describe('real MCP SDK connections', () => {
  it('stdio performs handshake, discovery and one effect with explicit env only, then closes its child', async () => {
    vi.stubEnv('PRIVATE_API_CANARY', 'never-forward');
    const fixture = newStdio();
    expect(() => fixture.events()).toThrow(); // building/importing configuration launches nothing
    const session = await connect(fixture.config);
    expect(await session.listContractTools()).toHaveLength(1);
    expect(fixture.events().filter((e) => e.event === 'effect')).toHaveLength(0);
    const result = await session.callToolAsOutput('fixture_effect', {});
    expect(result.output.type).toBe('tool_result');
    if (result.output.type !== 'tool_result') throw new Error('expected result');
    expect(JSON.parse(String(result.output.data))).toMatchObject({
      explicitEnv: true,
      ambientAbsent: true,
    });
    const pid = fixture.events()[0]!.pid!;
    expect(fixture.events().filter((e) => e.event === 'effect')).toHaveLength(1);
    await session.close();
    await vi.waitFor(() => expect(alive(pid)).toBe(false));
    expect((await session.callToolAsOutput('fixture_effect', {})).output).toMatchObject({
      code: 'MCP_CALL_NOT_STARTED',
    });
  });

  it.each(['http', 'streamable-http', 'sse'])(
    '%s alias uses HTTP credentials consistently for handshake/list/call',
    async (transport) => {
      const { config, observations } = await httpFixture();
      const session = await connect({ ...config, transport });
      expect(await session.listContractTools()).toHaveLength(1);
      expect((await session.callToolAsOutput('fixture_effect', {})).output).toMatchObject({
        type: 'tool_result',
        data: 'effect recorded',
      });
      expect(observations.effects).toBe(1);
      expect(observations.authenticated).toBe(observations.posts);
    },
  );

  it('does not follow redirects or forward credentials to their target', async () => {
    const { config, observations } = await httpFixture('redirect');
    await expect(connect(config)).rejects.toMatchObject({ code: 'CONNECT_FAILED' });
    expect(observations.redirected).toBe(0);
  });

  it('reports safe static-auth guidance without retaining response bodies or causes', async () => {
    const { config } = await httpFixture('auth');
    try {
      await connect(config);
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toMatchObject({ code: 'AUTHENTICATION_FAILED' });
      expect(error).not.toHaveProperty('cause');
      expect(String(error)).not.toContain('PRIVATE_AUTH_BODY_CANARY');
    }
  });

  it('reports missing host executable safely', async () => {
    await expect(
      connect({
        id: 'missing',
        name: 'Missing',
        transport: 'stdio',
        command: '/nonexistent/mcp-private-path',
      }),
    ).rejects.toMatchObject({ code: 'MISSING_EXECUTABLE' });
  });

  it.each(['stdio', 'http'])(
    'hides malformed %s protocol payloads and closes the connection',
    async (transport) => {
      const config =
        transport === 'stdio'
          ? newStdio('malformed').config
          : (await httpFixture('malformed')).config;
      const session = await connect(config);
      await expect(session.listContractTools()).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' });
      expect((await session.callToolAsOutput('fixture_effect', {})).output).toMatchObject({
        code: 'MCP_CALL_NOT_STARTED',
      });
    },
  );

  it.each(['connect-timeout', 'list-timeout'])(
    'bounds %s and terminates its direct child',
    async (mode) => {
      vi.stubEnv('MCP_ADAPTER_CONNECT_TIMEOUT_MS', '200');
      vi.stubEnv('MCP_ADAPTER_REQUEST_TIMEOUT_MS', '200');
      const fixture = newStdio(mode);
      const action =
        mode === 'connect-timeout'
          ? connect(fixture.config)
          : connect(fixture.config).then((s) => s.listContractTools());
      await expect(action).rejects.toMatchObject({ code: 'MCP_TIMEOUT' });
      await vi.waitFor(() => expect(alive(fixture.events()[0]!.pid!)).toBe(false));
    },
  );

  it('cancels a pending call, closes child, and returns unknown outcome without replay', async () => {
    const fixture = newStdio('call-timeout');
    const controller = new AbortController();
    const session = await connect(fixture.config);
    const call = session.callToolAsOutput('fixture_effect', {}, { signal: controller.signal });
    await vi.waitFor(() =>
      expect(fixture.events().filter((e) => e.event === 'effect')).toHaveLength(1),
    );
    controller.abort();
    expect((await call).output).toMatchObject({ code: 'MCP_OUTCOME_UNKNOWN' });
    await vi.waitFor(() => expect(alive(fixture.events()[0]!.pid!)).toBe(false));
    expect((await session.callToolAsOutput('fixture_effect', {})).output).toMatchObject({
      code: 'MCP_CALL_NOT_STARTED',
    });
    expect(fixture.events().filter((e) => e.event === 'effect')).toHaveLength(1);
  });

  it.each(['stdio', 'http'])(
    'a %s effect followed by lost response is unknown, never replayed',
    async (transport) => {
      const stdio = transport === 'stdio' ? newStdio('lost-response') : undefined;
      const http = transport === 'http' ? await httpFixture('lost-response') : undefined;
      const session = await connect((stdio ?? http)!.config);
      expect((await session.callToolAsOutput('fixture_effect', {})).output).toMatchObject({
        code: 'MCP_OUTCOME_UNKNOWN',
      });
      expect((await session.callToolAsOutput('fixture_effect', {})).output).toMatchObject({
        code: 'MCP_CALL_NOT_STARTED',
      });
      expect(
        stdio
          ? stdio.events().filter((e) => e.event === 'effect').length
          : http!.observations.effects,
      ).toBe(1);
    },
  );

  it('suppresses server-controlled tool error details', async () => {
    const session = await connect(newStdio('tool-error').config);
    const result = await session.callToolAsOutput('fixture_effect', {});
    expect(result.output).toMatchObject({ code: 'MCP_TOOL_ERROR' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_TOOL_ERROR_CANARY');
  });

  it('does not launch for pre-cancelled connection and does not dispatch pre-cancelled call', async () => {
    const fixture = newStdio();
    const controller = new AbortController();
    controller.abort();
    await expect(connect(fixture.config, controller.signal)).rejects.toMatchObject({
      code: 'MCP_INTERRUPTED',
    });
    expect(() => fixture.events()).toThrow();
    const session = await connect(fixture.config);
    expect(
      (await session.callToolAsOutput('fixture_effect', {}, { signal: controller.signal })).output,
    ).toMatchObject({ code: 'MCP_CALL_NOT_STARTED' });
    expect(fixture.events().filter((e) => e.event === 'effect')).toHaveLength(0);
  });

  it.each(['connect-timeout', 'list-timeout'])(
    'cancels %s and closes the owned process',
    async (mode) => {
      const fixture = newStdio(mode);
      const controller = new AbortController();
      const action =
        mode === 'connect-timeout'
          ? connect(fixture.config, controller.signal)
          : connect(fixture.config).then((session) =>
              session.listContractTools({ signal: controller.signal }),
            );
      const rejected = expect(action).rejects.toMatchObject({ code: 'MCP_INTERRUPTED' });
      await vi.waitFor(() => expect(fixture.events()[0]!.pid).toBeGreaterThan(0));
      controller.abort();
      await rejected;
      await vi.waitFor(() => expect(alive(fixture.events()[0]!.pid!)).toBe(false));
    },
  );

  it('a request deadline closes the child and reports uncertain effect, not a safe retry', async () => {
    const fixture = newStdio('call-timeout');
    const session = await connect(fixture.config);
    expect(
      (await session.callToolAsOutput('fixture_effect', {}, { timeoutMs: 100 })).output,
    ).toMatchObject({ code: 'MCP_OUTCOME_UNKNOWN' });
    expect(fixture.events().filter((e) => e.event === 'effect')).toHaveLength(1);
    await vi.waitFor(() => expect(alive(fixture.events()[0]!.pid!)).toBe(false));
  });

  it('deduplicates repeated and concurrent opens, then closes the only owned child', async () => {
    const fixture = newStdio();
    const manager = new McpSessionManager();
    try {
      const results = await manager.openSessions([fixture.config, fixture.config, fixture.config]);
      expect(results).toHaveLength(1);
      const first = manager.getSession(fixture.config.id);
      await Promise.all([
        manager.openSessions([fixture.config]),
        manager.openSessions([fixture.config, fixture.config]),
      ]);
      expect(manager.getSession(fixture.config.id)).toBe(first);
      const started = fixture.events().filter((event) => event.event === 'started');
      expect(started).toHaveLength(1);
      await manager.closeAll();
      await vi.waitFor(() => expect(alive(started[0]!.pid!)).toBe(false));
      expect(fixture.events().filter((event) => event.event === 'effect')).toHaveLength(0);
    } finally {
      await manager.closeAll();
    }
  });

  it('serializes close with an in-flight open and explicit replacement closes the prior child', async () => {
    const fixture = newStdio();
    const manager = new McpSessionManager();
    try {
      await manager.openSessions([fixture.config]);
      const firstPid = fixture.events()[0]!.pid!;
      expect(await manager.reconnect(fixture.config)).toBe(true);
      await vi.waitFor(() => expect(alive(firstPid)).toBe(false));
      const started = fixture.events().filter((event) => event.event === 'started');
      expect(started).toHaveLength(2);
      await manager.closeAll();
      await vi.waitFor(() => expect(alive(started[1]!.pid!)).toBe(false));
      await Promise.all([manager.openSessions([fixture.config]), manager.closeAll()]);
      expect(manager.getSessions().size).toBe(0);
      const finalPid = fixture
        .events()
        .filter((event) => event.event === 'started')
        .at(-1)!.pid!;
      await vi.waitFor(() => expect(alive(finalPid)).toBe(false));
      expect(fixture.events().filter((event) => event.event === 'effect')).toHaveLength(0);
    } finally {
      await manager.closeAll();
    }
  });
});
