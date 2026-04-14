import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseMasterKeyFromBase64 } from '../src/crypto/envelope.js';
import { SecretDecryptionError } from '../src/crypto/errors.js';
import { closeDatabase, openDatabase } from '../src/database.js';
import { getSecretUtf8, putSecretUtf8 } from '../src/secrets/store.js';

const masterKeyB64 = Buffer.alloc(32, 9).toString('base64');

describe('secret storage (DB ciphertext only)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it('stores only ciphertext in sqlite file (no plaintext substring)', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-db-'));
    dirs.push(dir);
    const sqlitePath = path.join(dir, 's.sqlite');
    const key = parseMasterKeyFromBase64(masterKeyB64);
    const { db, sqlite } = openDatabase(sqlitePath);

    putSecretUtf8(db, {
      id: 'sec-1',
      label: 'OpenAI',
      plaintext: 'sk-live-PLAIN-MUST-NOT-APPEAR-IN-DB',
      key,
      keyVersion: 1,
    });

    const raw = readFileSync(sqlitePath);
    expect(raw.includes(Buffer.from('sk-live-PLAIN-MUST-NOT-APPEAR-IN-DB', 'utf8'))).toBe(false);

    expect(getSecretUtf8(db, 'sec-1', key)).toBe('sk-live-PLAIN-MUST-NOT-APPEAR-IN-DB');
    closeDatabase(sqlite);
  });

  it('getSecret fails when key is wrong', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-db-'));
    dirs.push(dir);
    const key = parseMasterKeyFromBase64(masterKeyB64);
    const wrong = parseMasterKeyFromBase64(Buffer.alloc(32, 3).toString('base64'));
    const { db, sqlite } = openDatabase(path.join(dir, 'w.sqlite'));

    putSecretUtf8(db, { id: 'a', label: null, plaintext: 'x', key, keyVersion: 1 });
    expect(() => getSecretUtf8(db, 'a', wrong)).toThrow(SecretDecryptionError);
    closeDatabase(sqlite);
  });
});
