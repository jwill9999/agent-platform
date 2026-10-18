import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase } from '../src/database.js';
import {
  appendMessage,
  listMessagesBySession,
  deleteMessagesBySession,
} from '../src/repositories/messages.js';
import {
  appendMessageWithContinuation,
  listMessagesWithContinuation,
  assertContinuationBinding,
  type ProviderContinuationRecord,
} from '../src/repositories/providerContinuation.js';
import {
  createModelConfig,
  getModelConfig,
  updateModelConfig,
  modelConfigCredentialRevision,
  resolveModelConfigKey,
} from '../src/repositories/modelConfigs.js';

let opened: ReturnType<typeof openDatabase>;
let dir: string;
let file: string;
const key = randomBytes(32);
const continuation: ProviderContinuationRecord = {
  version: 1,
  binding: {
    provider: 'openai',
    model: 'CaseSensitiveModel',
    apiMode: 'responses',
    endpoint: 'https://api.openai.com/v1',
    credentialRevision: 'fixture-revision',
  },
  responseMessages: [
    {
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: 'PRIVATE_REASONING_SENTINEL',
          providerOptions: { openai: { encryptedContent: 'PRIVATE_OPAQUE_SENTINEL' } },
        },
      ],
    },
  ],
};
const input = {
  id: 'message-one',
  sessionId: 'session-one',
  role: 'assistant' as const,
  content: 'public-answer',
  toolCalls: [{ id: 'tool-one', name: 'read_file', args: { path: 'public-file' } }],
  continuation,
};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'continuation-test-'));
  file = join(dir, 'profile.sqlite');
  opened = openDatabase(file);
  opened.sqlite.exec(
    "INSERT INTO agents(id,name,execution_limits_json,created_at_ms,updated_at_ms) VALUES('agent-one','Test','{}',1,1); INSERT INTO sessions(id,agent_id,created_at_ms,updated_at_ms) VALUES('session-one','agent-one',1,1),('session-two','agent-one',1,1)",
  );
});
afterEach(() => {
  opened.sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});
function save() {
  return appendMessageWithContinuation(opened.db, input, key, 1);
}
function hydrate() {
  return listMessagesWithContinuation(opened.db, 'session-one', key);
}
function expectSafeFailure(run: () => unknown) {
  expect(run).toThrow('PROVIDER_CONTINUATION_UNAVAILABLE');
  try {
    run();
  } catch (error) {
    expect(String(error)).not.toMatch(
      /SENTINEL|public-file|cipher|sqlite|SQL|decrypt|fixture-revision/,
    );
  }
}
describe('private provider continuation barrier', () => {
  it('encrypts and restores exact opaque SDK parts after clean reopen without leaking public fields', () => {
    save();
    const publicRows = listMessagesBySession(opened.db, 'session-one');
    expect(JSON.stringify(publicRows)).not.toMatch(
      /SENTINEL|continuation|binding|credentialRevision/,
    );
    const raw = JSON.stringify(opened.sqlite.prepare('SELECT * FROM provider_continuations').all());
    expect(raw).not.toMatch(/SENTINEL|fixture-revision|public-file/);
    opened.sqlite.close();
    opened = openDatabase(file);
    expect(hydrate()[0]).toEqual({ message: publicRows[0], continuation });
  });
  it('distinguishes readable legacy marker0 from required marker1 with a deleted private row', () => {
    appendMessage(opened.db, { sessionId: 'session-one', role: 'user', content: 'legacy' });
    expect(
      listMessagesWithContinuation(opened.db, 'session-one', undefined)[0]?.continuation,
    ).toBeUndefined();
    save();
    opened.sqlite.exec('DELETE FROM provider_continuations');
    expectSafeFailure(hydrate);
    expect(listMessagesBySession(opened.db, 'session-one')).toHaveLength(2);
  });
  it.each([
    'corrupt',
    'wrong-key',
    'swapped-session',
    'changed-public',
    'unknown-marker',
    'wrong-byte-count',
  ])('fails safely on %s', (kind) => {
    save();
    if (kind === 'corrupt')
      opened.sqlite.exec("UPDATE provider_continuations SET ciphertext_b64='invalid'");
    if (kind === 'swapped-session')
      opened.sqlite.exec("UPDATE provider_continuations SET session_id='session-two'");
    if (kind === 'changed-public') opened.sqlite.exec("UPDATE messages SET tool_calls_json='[]'");
    if (kind === 'unknown-marker')
      opened.sqlite.exec('UPDATE messages SET provider_continuation_format=7');
    if (kind === 'wrong-byte-count')
      opened.sqlite.exec('UPDATE provider_continuations SET plaintext_bytes=2');
    expectSafeFailure(() =>
      listMessagesWithContinuation(
        opened.db,
        'session-one',
        kind === 'wrong-key' ? randomBytes(32) : key,
      ),
    );
  });
  it('rejects missing master key, rollbacks an insert failure and deduplicates identical stable IDs', () => {
    expectSafeFailure(() => appendMessageWithContinuation(opened.db, input, undefined, 1));
    expect(listMessagesBySession(opened.db, 'session-one')).toHaveLength(0);
    opened.sqlite.exec(
      "CREATE TRIGGER fail_private BEFORE INSERT ON provider_continuations BEGIN SELECT RAISE(ABORT,'PRIVATE_SQL_SENTINEL'); END",
    );
    expectSafeFailure(save);
    expect(listMessagesBySession(opened.db, 'session-one')).toHaveLength(0);
    opened.sqlite.exec('DROP TRIGGER fail_private');
    const first = save();
    expect(save()).toEqual(first);
    expect(hydrate()).toHaveLength(1);
    expectSafeFailure(() =>
      appendMessageWithContinuation(opened.db, { ...input, content: 'changed' }, key, 1),
    );
    expectSafeFailure(() =>
      appendMessageWithContinuation(opened.db, { ...input, continuation: undefined }, key, 1),
    );
    expectSafeFailure(() =>
      appendMessageWithContinuation(opened.db, { ...input, sessionId: 'session-two' }, key, 1),
    );
  });
  it('checks every binding field before use', () => {
    for (const field of Object.keys(continuation.binding) as Array<
      keyof typeof continuation.binding
    >) {
      expectSafeFailure(() =>
        assertContinuationBinding(continuation, { ...continuation.binding, [field]: 'different' }),
      );
    }
    expect(() => assertContinuationBinding(continuation, continuation.binding)).not.toThrow();
  });
  it('rejects message and session capacity overflows atomically without truncating existing history', () => {
    const large = { ...continuation, responseMessages: [{ content: 'x'.repeat(256 * 1024) }] };
    expectSafeFailure(() =>
      appendMessageWithContinuation(opened.db, { ...input, continuation: large }, key, 1),
    );
    expect(hydrate()).toHaveLength(0);
    const bounded = { ...continuation, responseMessages: [{ content: 'x'.repeat(250 * 1024) }] };
    for (let i = 0; i < 16; i++)
      appendMessageWithContinuation(
        opened.db,
        { ...input, id: `bounded-${i}`, continuation: bounded },
        key,
        1,
      );
    expectSafeFailure(() =>
      appendMessageWithContinuation(
        opened.db,
        { ...input, id: 'overflow', continuation: bounded },
        key,
        1,
      ),
    );
    expect(hydrate()).toHaveLength(16);
  });
  it('cascades on message deletion and session deletion', () => {
    save();
    deleteMessagesBySession(opened.db, 'session-one');
    expect(opened.sqlite.prepare('SELECT * FROM provider_continuations').all()).toHaveLength(0);
    save();
    opened.sqlite.exec("DELETE FROM sessions WHERE id='session-one'");
    expect(opened.sqlite.prepare('SELECT * FROM provider_continuations').all()).toHaveLength(0);
  });
});
describe('saved model configuration identity', () => {
  it('retains exact model case/endpoint and clears another provider credential atomically', () => {
    const first = createModelConfig(
      opened.db,
      {
        name: 'one',
        provider: 'openai',
        model: 'MixedCase/Model',
        baseURL: 'https://gateway.example/v1',
        apiKey: 'synthetic-first',
      },
      key,
      1,
    );
    const revision = modelConfigCredentialRevision(opened.db, first.id);
    updateModelConfig(opened.db, first.id, { name: 'rename' }, undefined, 1);
    expect(modelConfigCredentialRevision(opened.db, first.id)).toBe(revision);
    updateModelConfig(opened.db, first.id, { provider: 'anthropic', baseURL: null }, undefined, 1);
    expect(getModelConfig(opened.db, first.id)).toMatchObject({
      model: 'MixedCase/Model',
      baseURL: null,
      hasApiKey: false,
    });
    expect(modelConfigCredentialRevision(opened.db, first.id)).not.toBe(revision);
    expect(opened.sqlite.prepare('SELECT * FROM secret_refs').all()).toHaveLength(0);
  });
  it('credential rotation changes continuation revision, while failed rotation preserves original config/key', () => {
    const first = createModelConfig(
      opened.db,
      { name: 'one', provider: 'openai', model: 'model', apiKey: 'synthetic-first' },
      key,
      1,
    );
    const revision = modelConfigCredentialRevision(opened.db, first.id);
    expect(() =>
      updateModelConfig(
        opened.db,
        first.id,
        { provider: 'google', apiKey: 'replacement' },
        undefined,
        1,
      ),
    ).toThrow();
    expect(getModelConfig(opened.db, first.id)?.provider).toBe('openai');
    expect(resolveModelConfigKey(opened.db, first.id, key)).toBe('synthetic-first');
    updateModelConfig(opened.db, first.id, { apiKey: 'synthetic-second' }, key, 1);
    expect(modelConfigCredentialRevision(opened.db, first.id)).not.toBe(revision);
  });
});
