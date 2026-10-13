import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase } from '../src/database.js';
import {
  createMcpServer,
  deleteMcpServer,
  duplicateMcpServer,
  getMcpServer,
  importMcpServers,
  listMcpServers,
  resolveMcpConnection,
  updateMcpServer,
} from '../src/repositories/mcpConnections.js';
import { putSecretUtf8 } from '../src/secrets/store.js';
import * as schema from '../src/schema.js';

const local = {
  name: 'Fixture',
  transport: 'stdio' as const,
  command: '/fixture path/node',
  args: ['literal"argument'],
};
describe('MCP encrypted configuration persistence', () => {
  let opened: ReturnType<typeof openDatabase>;
  let dir: string;
  let key: Buffer;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'mcp-credentials-'));
    opened = openDatabase(path.join(dir, 'db.sqlite'));
    key = randomBytes(32);
    vi.stubEnv('SECRETS_MASTER_KEY', '');
  });
  afterEach(() => {
    opened.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });
  it('stores encrypted values, never returns refs/values, resolves literal args and credentials', () => {
    const server = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { FIXTURE_TOKEN: 'canary-secret' } } },
      key,
    );
    expect(server.credentialStatus?.env).toEqual({ FIXTURE_TOKEN: true });
    expect(JSON.stringify(server)).not.toContain('canary-secret');
    expect(JSON.stringify(listMcpServers(opened.db))).not.toContain('mcp:');
    expect(JSON.stringify(opened.db.select().from(schema.mcpServers).all())).not.toContain(
      'canary-secret',
    );
    expect(JSON.stringify(opened.db.select().from(schema.secretRefs).all())).not.toContain(
      'canary-secret',
    );
    expect(resolveMcpConnection(opened.db, server.id, key).env).toEqual({
      FIXTURE_TOKEN: 'canary-secret',
    });
    expect(resolveMcpConnection(opened.db, server.id, key).args).toEqual(['literal"argument']);
  });
  it('retains, replaces and clears with monotonic public revision', () => {
    const server = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { TOKEN: 'first' } } },
      key,
    );
    const retained = updateMcpServer(opened.db, server.id, local);
    expect(retained?.configurationRevision).toBe(2);
    expect(resolveMcpConnection(opened.db, server.id, key).env?.['TOKEN']).toBe('first');
    updateMcpServer(
      opened.db,
      server.id,
      { ...local, credentials: { env: { TOKEN: 'second' } } },
      key,
    );
    expect(resolveMcpConnection(opened.db, server.id, key).env?.['TOKEN']).toBe('second');
    expect(opened.db.select().from(schema.secretRefs).all()).toHaveLength(1);
    updateMcpServer(opened.db, server.id, { ...local, credentials: { env: { TOKEN: null } } });
    expect(getMcpServer(opened.db, server.id)?.configurationRevision).toBe(4);
    expect(resolveMcpConnection(opened.db, server.id).env).toEqual({});
    expect(opened.db.select().from(schema.secretRefs).all()).toHaveLength(0);
  });
  it('duplicate retains missing credential names and never copies values', () => {
    const original = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { TOKEN: 'original' } } },
      key,
    );
    const duplicate = duplicateMcpServer(opened.db, original.id)!;
    expect(duplicate.credentialStatus?.env).toEqual({ TOKEN: false });
    expect(duplicate.needsReconfiguration).toBe(true);
    expect(() => resolveMcpConnection(opened.db, duplicate.id, key)).toThrow('Review and replace');
    expect(opened.db.select().from(schema.secretRefs).all()).toHaveLength(1);
    updateMcpServer(
      opened.db,
      duplicate.id,
      { ...local, name: 'Copy', credentials: { env: { TOKEN: 'copy' } } },
      key,
    );
    expect(resolveMcpConnection(opened.db, original.id, key).env?.['TOKEN']).toBe('original');
  });
  it('deletes only owned credentials, leaving model secrets intact', () => {
    putSecretUtf8(opened.db, {
      id: 'model-secret',
      label: 'Model',
      plaintext: 'model-key',
      key,
      keyVersion: 1,
    });
    const server = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { TOKEN: 'server-key' } } },
      key,
    );
    expect(deleteMcpServer(opened.db, server.id)).toBe(true);
    expect(
      opened.db
        .select()
        .from(schema.secretRefs)
        .all()
        .map((row) => row.id),
    ).toEqual(['model-secret']);
  });
  it('rejects cross-server reference tampering without reading or deleting secrets', () => {
    const server = createMcpServer(opened.db, local);
    putSecretUtf8(opened.db, {
      id: 'model-secret',
      label: 'Model',
      plaintext: 'model-key',
      key,
      keyVersion: 1,
    });
    opened.db
      .update(schema.mcpServers)
      .set({
        metadataJson: JSON.stringify({
          connection: {
            version: 1,
            revision: 2,
            refs: { env: { TOKEN: 'model-secret' }, headers: {} },
          },
        }),
      })
      .where(eq(schema.mcpServers.id, server.id))
      .run();
    expect(() => resolveMcpConnection(opened.db, server.id, key)).toThrow();
    expect(() => deleteMcpServer(opened.db, server.id)).toThrow();
    expect(opened.db.select().from(schema.secretRefs).all()).toHaveLength(1);
  });
  it('selected import is atomic when a later name conflicts', () => {
    expect(() =>
      importMcpServers(
        opened.db,
        [{ ...local, credentials: { env: { TOKEN: 'never-persist' } } }, local],
        key,
      ),
    ).toThrow();
    expect(listMcpServers(opened.db)).toEqual([]);
    expect(opened.db.select().from(schema.secretRefs).all()).toEqual([]);
  });
  it('fails closed with no key, malformed key, or wrong authenticated-ciphertext key', () => {
    expect(() =>
      createMcpServer(opened.db, { ...local, credentials: { env: { TOKEN: 'canary' } } }),
    ).toThrow('SECRETS_MASTER_KEY');
    expect(() =>
      createMcpServer(
        opened.db,
        { ...local, credentials: { env: { TOKEN: 'canary' } } },
        Buffer.alloc(2),
      ),
    ).toThrow('SECRETS_MASTER_KEY');
    const server = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { TOKEN: 'canary' } } },
      key,
    );
    expect(() => resolveMcpConnection(opened.db, server.id, randomBytes(32))).toThrow(
      'could not be decrypted',
    );
    expect(resolveMcpConnection(opened.db, server.id, key).env?.['TOKEN']).toBe('canary');
    const plain = createMcpServer(opened.db, { ...local, name: 'No credential' });
    expect(resolveMcpConnection(opened.db, plain.id).env).toEqual({});
  });
  function legacy(url: string | null = null) {
    opened.db
      .insert(schema.mcpServers)
      .values({
        id: 'legacy',
        slug: 'legacy',
        name: 'Legacy',
        transport: url ? 'http' : 'stdio',
        command: url ? null : 'node',
        url,
        metadataJson: JSON.stringify(
          url
            ? { headers: { Authorization: 'legacy-canary' } }
            : { env: { TOKEN: 'legacy-canary' } },
        ),
      })
      .run();
  }
  it('masks legacy values immediately and migrates atomically before activation', () => {
    legacy();
    expect(JSON.stringify(getMcpServer(opened.db, 'legacy'))).not.toContain('legacy-canary');
    const before = opened.db.select().from(schema.mcpServers).all();
    expect(() => resolveMcpConnection(opened.db, 'legacy')).toThrow();
    expect(opened.db.select().from(schema.mcpServers).all()).toEqual(before);
    expect(resolveMcpConnection(opened.db, 'legacy', key).env?.['TOKEN']).toBe('legacy-canary');
    expect(JSON.stringify(opened.db.select().from(schema.mcpServers).all())).not.toContain(
      'legacy-canary',
    );
  });
  it('rolls back legacy migration on a real SQLite write failure', () => {
    legacy();
    opened.sqlite.exec(
      "CREATE TRIGGER reject_mcp_update BEFORE UPDATE ON mcp_servers BEGIN SELECT RAISE(ABORT, 'fixture'); END",
    );
    expect(() => resolveMcpConnection(opened.db, 'legacy', key)).toThrow();
    expect(opened.db.select().from(schema.secretRefs).all()).toEqual([]);
    expect(opened.db.select().from(schema.mcpServers).get()?.metadataJson).toContain(
      'legacy-canary',
    );
  });
  it('never returns unsafe legacy URLs and requires explicit safe replacement', () => {
    legacy('https://user:url-canary@example.test/mcp?token=query-canary#fragment-canary');
    const publicRecord = getMcpServer(opened.db, 'legacy')!;
    expect(publicRecord.needsReconfiguration).toBe(true);
    expect(publicRecord.url).toBeUndefined();
    expect(JSON.stringify(publicRecord)).not.toMatch(/canary/);
    expect(() => resolveMcpConnection(opened.db, 'legacy', key)).toThrow();
    expect(() =>
      updateMcpServer(opened.db, 'legacy', {
        name: 'Legacy',
        transport: 'streamable-http',
        url: 'https://example.test/mcp',
      }),
    ).toThrow();
    expect(opened.db.select().from(schema.mcpServers).get()?.url).toContain('url-canary');
    updateMcpServer(
      opened.db,
      'legacy',
      { name: 'Legacy', transport: 'streamable-http', url: 'https://example.test/mcp' },
      key,
    );
    expect(resolveMcpConnection(opened.db, 'legacy', key).headers?.['Authorization']).toBe(
      'legacy-canary',
    );
  });
  it.each([
    '{broken',
    'null',
    '[]',
    '{"connection":{"version":2,"revision":9,"refs":{"env":{"TOKEN":"private-ref"},"headers":{}}}}',
    '{"connection":{"version":1,"revision":2,"refs":{"env":[],"headers":{}}}}',
  ])('masks and refuses corrupt metadata without rewriting it: %s', (metadataJson) => {
    opened.db
      .insert(schema.mcpServers)
      .values({
        id: 'corrupt',
        slug: 'corrupt',
        name: 'Corrupt',
        transport: 'stdio',
        command: 'node',
        metadataJson,
      })
      .run();
    expect(getMcpServer(opened.db, 'corrupt')?.needsReconfiguration).toBe(true);
    expect(JSON.stringify(getMcpServer(opened.db, 'corrupt'))).not.toContain('private-ref');
    expect(() => resolveMcpConnection(opened.db, 'corrupt', key)).toThrow();
    expect(() => updateMcpServer(opened.db, 'corrupt', local, key)).toThrow();
    expect(opened.db.select().from(schema.mcpServers).get()?.metadataJson).toBe(metadataJson);
    expect(opened.db.select().from(schema.secretRefs).all()).toEqual([]);
  });
  it('blocks legacy execution options until explicit replacement and preserves credentials atomically', () => {
    const metadataJson = JSON.stringify({
      cwd: '/tmp/unsupported',
      shell: true,
      env: { TOKEN: 'legacy-private' },
    });
    opened.db
      .insert(schema.mcpServers)
      .values({
        id: 'legacy-options',
        slug: 'legacy-options',
        name: 'Legacy options',
        transport: 'stdio',
        command: 'node',
        metadataJson,
      })
      .run();
    expect(getMcpServer(opened.db, 'legacy-options')?.needsReconfiguration).toBe(true);
    expect(() => resolveMcpConnection(opened.db, 'legacy-options', key)).toThrow();
    expect(() => updateMcpServer(opened.db, 'legacy-options', local)).toThrow();
    expect(opened.db.select().from(schema.mcpServers).get()?.metadataJson).toBe(metadataJson);
    updateMcpServer(opened.db, 'legacy-options', local, key);
    expect(resolveMcpConnection(opened.db, 'legacy-options', key).env?.['TOKEN']).toBe(
      'legacy-private',
    );
    expect(opened.db.select().from(schema.mcpServers).get()?.metadataJson).not.toContain('cwd');
  });
  it('requires explicit clearing when switching credential transport kinds', () => {
    const saved = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { TOKEN: 'stored' } } },
      key,
    );
    const remote = {
      name: 'Remote',
      transport: 'streamable-http' as const,
      url: 'https://example.test/mcp',
    };
    expect(() => updateMcpServer(opened.db, saved.id, remote, key)).toThrow();
    expect(resolveMcpConnection(opened.db, saved.id, key).env?.['TOKEN']).toBe('stored');
    updateMcpServer(
      opened.db,
      saved.id,
      {
        ...remote,
        credentials: { env: { TOKEN: null }, headers: { Authorization: 'Bearer remote' } },
      },
      key,
    );
    expect(resolveMcpConnection(opened.db, saved.id, key).headers?.['Authorization']).toBe(
      'Bearer remote',
    );
    expect(opened.db.select().from(schema.secretRefs).all()).toHaveLength(1);
  });
  it('rejects malformed base64 even when a permissive decoder would produce 32 bytes', () => {
    vi.stubEnv('SECRETS_MASTER_KEY', `!${key.toString('base64')}`);
    expect(() =>
      createMcpServer(opened.db, { ...local, credentials: { env: { TOKEN: 'private' } } }),
    ).toThrow('SECRETS_MASTER_KEY');
    expect(listMcpServers(opened.db)).toEqual([]);
  });
  it('deleting a damaged envelope removes only independently labelled owned material', () => {
    const saved = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { TOKEN: 'private' } } },
      key,
    );
    putSecretUtf8(opened.db, {
      id: 'other',
      label: 'Model',
      plaintext: 'unrelated',
      key,
      keyVersion: 1,
    });
    opened.db
      .update(schema.mcpServers)
      .set({ metadataJson: '{broken' })
      .where(eq(schema.mcpServers.id, saved.id))
      .run();
    expect(deleteMcpServer(opened.db, saved.id)).toBe(true);
    expect(
      opened.db
        .select()
        .from(schema.secretRefs)
        .all()
        .map((value) => value.id),
    ).toEqual(['other']);
  });
  it('survives real database close/reopen with encrypted credentials', () => {
    const server = createMcpServer(
      opened.db,
      { ...local, credentials: { env: { TOKEN: 'persisted' } } },
      key,
    );
    opened.sqlite.close();
    opened = openDatabase(path.join(dir, 'db.sqlite'));
    expect(resolveMcpConnection(opened.db, server.id, key).env?.['TOKEN']).toBe('persisted');
  });
});
