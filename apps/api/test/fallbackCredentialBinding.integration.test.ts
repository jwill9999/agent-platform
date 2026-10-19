import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDatabase,
  DEFAULT_AGENT_ID,
  openDatabase,
  runSeed,
  type ProviderContinuationBinding,
} from '@agent-platform/db';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { closeLoopback, listenLoopback } from './support/loopbackServer.js';

vi.hoisted(() => vi.resetModules());
vi.unmock('@agent-platform/harness');
vi.unmock('@agent-platform/model-router');
afterAll(() => vi.resetModules());

const cleanups: Array<() => Promise<void>> = [];
const master = Buffer.alloc(32, 51).toString('base64');
const fixtureCredential = 'fixture-credential-A';
let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubEnv('SECRETS_MASTER_KEY', master);
  vi.stubEnv('DEFAULT_MODEL_PROVIDER', 'openai');
  vi.stubEnv('DEFAULT_MODEL', 'ExactCase');
  vi.stubEnv('AGENT_OPENAI_API_KEY', fixtureCredential);
  vi.stubEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:18445/v1');
  for (const key of ['LANGCHAIN_TRACING_V2', 'LANGSMITH_TRACING', 'LANGSMITH_TRACING_V2'])
    vi.stubEnv(key, 'false');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('No transport in binding fixture'))),
  );
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
  try {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  }
});

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'fallback-binding-'));
  const { db, sqlite } = openDatabase(join(root, 'db.sqlite'));
  runSeed(db);
  const bindings: ProviderContinuationBinding[] = [];
  const app = await listenLoopback(
    createApp({
      db,
      v1: {
        chat: {
          disableEvaluatorNodes: true,
          emitFinalAssistantMessage: true,
          llmReasonNode: async (state) => {
            const binding = state.modelConfig?.continuationBinding;
            if (!binding) throw new Error('Missing internal fallback binding');
            bindings.push(binding);
            return {
              llmOutput: { kind: 'text', content: 'Local binding ready' },
              messages: [{ role: 'assistant', content: 'Local binding ready' }],
              trace: [{ type: 'llm_call', step: state.taskIndex ?? 0 }],
              totalTokensUsed: 0,
            };
          },
        },
      },
    }),
  );
  cleanups.push(async () => {
    try {
      await closeLoopback(app);
    } finally {
      closeDatabase(sqlite);
      rmSync(root, { recursive: true, force: true });
    }
  });
  const session = await request(app)
    .post('/v1/sessions')
    .send({ agentId: DEFAULT_AGENT_ID })
    .expect(201);
  return {
    bindings,
    sqlite,
    async ask(headerKey?: string, status = 200) {
      const req = request(app)
        .post('/v1/chat')
        .send({ sessionId: session.body.data.id, message: 'Inspect the local fallback' });
      if (headerKey !== undefined) req.set('x-openai-key', headerKey);
      return req.expect(status);
    },
  };
}

function assertPrivate(response: string, bindings: ProviderContinuationBinding[]) {
  const publicAndLogs = response + JSON.stringify(log.mock.calls);
  expect(publicAndLogs.includes(fixtureCredential)).toBe(false);
  for (const binding of bindings) {
    // Compare booleans so a regression does not print a private credential identity.
    expect(publicAndLogs.includes(binding.credentialRevision)).toBe(false);
    expect(/^[0-9a-f]{64}$/.test(binding.credentialRevision)).toBe(true);
  }
  expect(globalThis.fetch).not.toHaveBeenCalled();
}

describe('private fallback credential binding through the actual API resolver', () => {
  it('keeps header selection stable, ignores an unused env key and fences a changed header', async () => {
    const f = await fixture();
    const first = await f.ask(fixtureCredential);
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'unused-environment-credential');
    const same = await f.ask(fixtureCredential);
    const changed = await f.ask('fixture-credential-B');
    expect(isDeepStrictEqual(f.bindings[0], f.bindings[1])).toBe(true);
    expect(isDeepStrictEqual(f.bindings[0], f.bindings[2])).toBe(false);
    expect(first.text + same.text + changed.text).toContain('Local binding ready');
    assertPrivate(first.text + same.text + changed.text, f.bindings);
  });

  it('keeps an environment credential stable and fences its replacement', async () => {
    const f = await fixture();
    await f.ask();
    await f.ask();
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'fixture-credential-B');
    const changed = await f.ask();
    expect(isDeepStrictEqual(f.bindings[0], f.bindings[1])).toBe(true);
    expect(isDeepStrictEqual(f.bindings[0], f.bindings[2])).toBe(false);
    assertPrivate(changed.text, f.bindings);
  });

  it.each(['provider', 'model', 'endpoint', 'master'] as const)(
    'fences a changed fallback %s',
    async (field) => {
      vi.stubEnv('DEFAULT_MODEL_PROVIDER', 'ollama');
      const f = await fixture();
      await f.ask(fixtureCredential);
      if (field === 'provider') vi.stubEnv('DEFAULT_MODEL_PROVIDER', 'openai');
      if (field === 'model') vi.stubEnv('DEFAULT_MODEL', 'ChangedCase');
      if (field === 'endpoint') vi.stubEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:18446/v1');
      if (field === 'master')
        vi.stubEnv('SECRETS_MASTER_KEY', Buffer.alloc(32, 52).toString('base64'));
      const changed = await f.ask(fixtureCredential);
      expect(isDeepStrictEqual(f.bindings[0], f.bindings[1])).toBe(false);
      assertPrivate(changed.text, f.bindings);
    },
  );

  it('allows stable keyless plaintext fallback without a master key or private storage', async () => {
    vi.stubEnv('SECRETS_MASTER_KEY', undefined);
    vi.stubEnv('DEFAULT_MODEL_PROVIDER', 'ollama');
    vi.stubEnv('AGENT_OPENAI_API_KEY', undefined);
    const f = await fixture();
    const first = await f.ask();
    const second = await f.ask();
    expect(isDeepStrictEqual(f.bindings[0], f.bindings[1])).toBe(true);
    expect(first.text + second.text).toContain('Local binding ready');
    expect(f.sqlite.prepare('SELECT COUNT(*) AS count FROM provider_continuations').get()).toEqual({
      count: 0,
    });
    assertPrivate(first.text + second.text, f.bindings);
  });

  it.each(['', 'invalid-master'])(
    'fails closed for present invalid master %j before invoking a reasoning node',
    async (value) => {
      vi.stubEnv('SECRETS_MASTER_KEY', value);
      const f = await fixture();
      const response = await f.ask(undefined, 500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(f.bindings.length).toBe(0);
      assertPrivate(response.text, []);
    },
  );
});

// Separate real Node processes load the compiled API. Bindings travel only over private IPC;
// no credential revision is returned by an HTTP route, printed or written to an artifact.
const childFixture = String.raw`
const { createApp } = await import(process.env.BINDING_APP_MODULE);
const { openDatabase, closeDatabase, runSeed, DEFAULT_AGENT_ID } = await import(process.env.BINDING_DB_MODULE);
const { createServer } = await import('node:http');
const opened = openDatabase(process.env.SQLITE_PATH);
runSeed(opened.db);
const bindings = [];
const server = createServer(createApp({db:opened.db,v1:{chat:{disableEvaluatorNodes:true,emitFinalAssistantMessage:true,llmReasonNode:async state=>{
 bindings.push(state.modelConfig.continuationBinding);
 return {llmOutput:{kind:'text',content:'Local binding ready'},messages:[{role:'assistant',content:'Local binding ready'}],trace:[{type:'llm_call',step:0}],totalTokensUsed:0};
}}}}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const dispatch=globalThis.fetch;
let foreign=0;
globalThis.fetch=(input,init)=>{
 const target=new URL(input instanceof Request?input.url:String(input));
 if(target.origin!==origin){foreign++;return Promise.reject(new Error('Unowned child transport'));}
 return dispatch(input,init);
};
try {
 const session=await fetch(origin+'/v1/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agentId:DEFAULT_AGENT_ID})});
 if(session.status!==201)throw new Error('Fixture session failed');
 const id=(await session.json()).data.id;
 for(let i=0;i<2;i++){
  const response=await fetch(origin+'/v1/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:id,message:'Local binding'})});
  const text=await response.text();
  if(response.status!==200||!text.includes('Local binding ready'))throw new Error('Fixture request failed');
  if(bindings.some(binding=>text.includes(binding.credentialRevision)))throw new Error('Private identity exposed');
 }
 process.send({pid:process.pid,bindings,foreign});
} finally {
 globalThis.fetch=dispatch;
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
 closeDatabase(opened.sqlite);
 process.disconnect();
}
`;

async function captureChild(root: string, masterKey: string) {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (/^(?:AGENT_)?(?:OPENAI|ANTHROPIC|GOOGLE|DEEPSEEK|XAI|OPENROUTER).*KEY$/.test(key))
      delete env[key];
  Object.assign(env, {
    SQLITE_PATH: join(root, 'child.sqlite'),
    SECRETS_MASTER_KEY: masterKey,
    AGENT_OPENAI_API_KEY: fixtureCredential,
    DEFAULT_MODEL_PROVIDER: 'openai',
    DEFAULT_MODEL: 'ExactCase',
    BINDING_APP_MODULE: new URL('../dist/infrastructure/http/createApp.js', import.meta.url).href,
    BINDING_DB_MODULE: new URL('../../../packages/db/dist/index.js', import.meta.url).href,
    LANGSMITH_TRACING: 'false',
    LANGSMITH_TRACING_V2: 'false',
    LANGCHAIN_TRACING_V2: 'false',
  });
  const child = spawn(process.execPath, ['--input-type=module', '--eval', childFixture], {
    cwd: dirname(fileURLToPath(import.meta.url)),
    env,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const result = await new Promise<{
    pid: number;
    bindings: ProviderContinuationBinding[];
    foreign: number;
  }>((resolve, reject) => {
    let message: unknown;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Binding child deadline exceeded'));
    }, 10000);
    child.once('message', (value) => {
      message = value;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0 || !message || typeof message !== 'object')
        reject(new Error('Binding child failed'));
      else
        resolve(
          message as { pid: number; bindings: ProviderContinuationBinding[]; foreign: number },
        );
    });
  });
  expect(result.bindings.length).toBe(2);
  expect(result.foreign).toBe(0);
  expect(isDeepStrictEqual(result.bindings[0], result.bindings[1])).toBe(true);
  return result;
}

it('keeps configured-master fallback identity stable across separate clean API processes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fallback-binding-process-'));
  try {
    const first = await captureChild(root, master);
    const reopened = await captureChild(root, master);
    const changed = await captureChild(root, randomBytes(32).toString('base64'));
    expect(first.pid === reopened.pid).toBe(false);
    expect(isDeepStrictEqual(first.bindings[0], reopened.bindings[0])).toBe(true);
    expect(isDeepStrictEqual(first.bindings[0], changed.bindings[0])).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
