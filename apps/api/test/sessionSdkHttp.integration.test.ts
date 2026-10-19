import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  closeDatabase,
  countToolExecutions,
  createModelConfig,
  DEFAULT_AGENT_ID,
  listMessagesBySession,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { closeLoopbacks, listenLoopback } from './support/loopbackServer.js';
import { restoreChatEnv, snapshotChatEnv } from './support/chatEnv.js';

// The API suite shares one fork (isolate:false). This actual SDK transport fixture
// must not inherit a cached graph/factory from preceding mocked unit fixtures.
vi.hoisted(() => vi.resetModules());
vi.unmock('@agent-platform/harness');
vi.unmock('@agent-platform/model-router');
vi.unmock('../../../packages/harness/node_modules/ai');
vi.unmock('../../../packages/model-router/node_modules/@ai-sdk/openai-compatible');
afterAll(() => vi.resetModules());

it('records an SDK7 HTTP tool response and pending approval through the actual reasoning node', async () => {
  const envSnap = snapshotChatEnv();
  const previousMasterKey = process.env.SECRETS_MASTER_KEY;
  const originalFetch = globalThis.fetch;
  const root = mkdtempSync(join(tmpdir(), 'session-sdk-http-'));
  const servers: Server[] = [];
  let opened: ReturnType<typeof openDatabase> | undefined;
  const providerRequests: { path: string; body: Record<string, unknown> }[] = [];
  let blockedForeignFetch = 0;
  let ownedFetch = 0;
  try {
    delete process.env.AGENT_OPENAI_API_KEY;
    const masterKey = Buffer.alloc(32, 19);
    process.env.SECRETS_MASTER_KEY = masterKey.toString('base64');
    opened = openDatabase(join(root, 'db.sqlite'));
    const { db } = opened;
    runSeed(db);
    const app = await listenLoopback(createApp({ db }));
    servers.push(app);
    const provider = await listenLoopback((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        providerRequests.push({
          path: req.url ?? '',
          body: JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>,
        });
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const delta = {
          id: 'chat_fixture',
          created: 1,
          model: 'SDK7-Fixture',
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: 'tc-sdk7-http',
                    type: 'function',
                    function: {
                      name: 'sys_bash',
                      arguments: '{"command":"date"}',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        const finish = {
          id: 'chat_fixture',
          created: 1,
          model: 'SDK7-Fixture',
          choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
        res.end(
          `data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(finish)}\n\ndata: [DONE]\n\n`,
        );
      });
    });
    servers.push(provider);
    const address = provider.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected disposable loopback provider');
    const providerOrigin = `http://127.0.0.1:${address.port}`;
    globalThis.fetch = (input, init) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      if (target.origin !== providerOrigin) {
        blockedForeignFetch++;
        return Promise.reject(new Error('Unowned provider transport blocked by fixture'));
      }
      ownedFetch++;
      return originalFetch(input, init);
    };
    const config = createModelConfig(
      db,
      {
        name: 'SDK7 local transport',
        provider: 'ollama',
        model: 'SDK7-Fixture',
        baseURL: `${providerOrigin}/v1`,
      },
      masterKey,
      1,
    );
    const session = await request(app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);
    const sessionId = session.body.data.id as string;
    const response = await request(app)
      .post('/v1/chat')
      .set('x-model-config-id', config.id)
      .send({ sessionId, message: 'Run date' })
      .expect(200);
    const events = response.text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string });
    expect(
      events.find((event) => event.type === 'error'),
      JSON.stringify({
        ownedFetch,
        blockedForeignFetch,
        providerRequests: providerRequests.map(({ path, body }) => ({
          path,
          model: body['model'],
          stream: body['stream'],
        })),
      }),
    ).toBeUndefined();
    expect(events.find((event) => event.type === 'approval_required')).toMatchObject({
      toolName: 'sys_bash',
      argsPreview: { command: 'date' },
      riskTier: 'high',
    });
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]).toMatchObject({
      path: '/v1/chat/completions',
      body: { model: 'SDK7-Fixture', stream: true },
    });
    expect(ownedFetch).toBe(1);
    expect(blockedForeignFetch).toBe(0);
    expect(listMessagesBySession(db, sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          toolCalls: [{ id: 'tc-sdk7-http', name: 'sys_bash', args: { command: 'date' } }],
        }),
      ]),
    );
    expect(
      countToolExecutions(db, {
        sessionId,
        toolName: 'sys_bash',
        status: 'pending',
        limit: 10,
        offset: 0,
      }),
    ).toBe(1);
    expect(
      countToolExecutions(db, {
        sessionId,
        toolName: 'sys_bash',
        status: 'success',
        limit: 10,
        offset: 0,
      }),
    ).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreChatEnv(envSnap);
    if (previousMasterKey === undefined) delete process.env.SECRETS_MASTER_KEY;
    else process.env.SECRETS_MASTER_KEY = previousMasterKey;
    try {
      await closeLoopbacks(servers);
    } finally {
      if (opened) closeDatabase(opened.sqlite);
      rmSync(root, { recursive: true, force: true });
    }
  }
});
