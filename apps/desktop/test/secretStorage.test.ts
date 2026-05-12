import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteDesktopSecretsMasterKey,
  ensureDesktopSecretsMasterKey,
  type DesktopSecretProtector,
} from '../src/main/secretStorage.js';

const tempDirs: string[] = [];
const validMasterKeyB64 = Buffer.alloc(32, 7).toString('base64');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-secret-storage-test-'));
  tempDirs.push(dir);
  return dir;
}

function reverse(value: string): string {
  return [...value].reverse().join('');
}

function createProtector({
  available = true,
  shouldReEncrypt = false,
}: {
  available?: boolean;
  shouldReEncrypt?: boolean;
} = {}): DesktopSecretProtector {
  return {
    async isEncryptionAvailable() {
      return available;
    },
    async encryptString(plainText: string) {
      return Buffer.from(reverse(plainText), 'utf8');
    },
    async decryptString(encrypted: Buffer) {
      return { result: reverse(encrypted.toString('utf8')), shouldReEncrypt };
    },
  };
}

describe('desktop secret storage', () => {
  it('uses an explicit environment master key without writing a protected key file', async () => {
    const filePath = join(makeTempDir(), 'config/secrets-master-key.json');
    const result = await ensureDesktopSecretsMasterKey({
      env: { SECRETS_MASTER_KEY: validMasterKeyB64 },
      filePath,
      protector: createProtector({ available: false }),
    });

    expect(result).toEqual({
      masterKeyB64: validMasterKeyB64,
      source: 'environment',
      persisted: false,
    });
    expect(existsSync(filePath)).toBe(false);
  });

  it('creates and reuses an OS-protected desktop master key file', async () => {
    const filePath = join(makeTempDir(), 'config/secrets-master-key.json');
    const protector = createProtector();
    const created = await ensureDesktopSecretsMasterKey({ env: {}, filePath, protector });
    const reused = await ensureDesktopSecretsMasterKey({ env: {}, filePath, protector });
    const persisted = readFileSync(filePath, 'utf8');

    expect(created.source).toBe('safe-storage');
    expect(created.persisted).toBe(true);
    expect(Buffer.from(created.masterKeyB64, 'base64')).toHaveLength(32);
    expect(reused.masterKeyB64).toBe(created.masterKeyB64);
    expect(persisted).not.toContain(created.masterKeyB64);
  });

  it('handles safe storage key rotation without changing the plaintext master key', async () => {
    const filePath = join(makeTempDir(), 'config/secrets-master-key.json');
    const created = await ensureDesktopSecretsMasterKey({
      env: {},
      filePath,
      protector: createProtector(),
    });
    const before = readFileSync(filePath, 'utf8');

    const reused = await ensureDesktopSecretsMasterKey({
      env: {},
      filePath,
      protector: createProtector({ shouldReEncrypt: true }),
    });
    const after = readFileSync(filePath, 'utf8');

    expect(reused.masterKeyB64).toBe(created.masterKeyB64);
    expect(after).toBe(before);
  });

  it('fails closed when secure storage is unavailable and no env key is configured', async () => {
    await expect(
      ensureDesktopSecretsMasterKey({
        env: {},
        filePath: join(makeTempDir(), 'config/secrets-master-key.json'),
        protector: createProtector({ available: false }),
      }),
    ).rejects.toThrow('Electron safeStorage is unavailable');
  });

  it('deletes the protected desktop master key file when requested', async () => {
    const filePath = join(makeTempDir(), 'config/secrets-master-key.json');
    await ensureDesktopSecretsMasterKey({ env: {}, filePath, protector: createProtector() });

    expect(deleteDesktopSecretsMasterKey(filePath)).toBe(true);
    expect(deleteDesktopSecretsMasterKey(filePath)).toBe(false);
  });
});
