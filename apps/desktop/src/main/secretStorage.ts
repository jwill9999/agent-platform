import type { SafeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface DesktopSecretProtector {
  readonly isEncryptionAvailable: () => Promise<boolean>;
  readonly encryptString: (plainText: string) => Promise<Buffer>;
  readonly decryptString: (
    encrypted: Buffer,
  ) => Promise<{ readonly result: string; readonly shouldReEncrypt?: boolean }>;
}

export interface DesktopSecretsMasterKeyResult {
  readonly masterKeyB64: string;
  readonly source: 'environment' | 'safe-storage';
  readonly persisted: boolean;
}

interface ProtectedMasterKeyFile {
  readonly version: 1;
  readonly algorithm: 'electron-safe-storage';
  readonly ciphertextB64: string;
}

function assertMasterKey(value: string): string {
  const trimmed = value.trim();
  const decoded = Buffer.from(trimmed, 'base64');
  if (decoded.byteLength !== 32) {
    throw new Error('SECRETS_MASTER_KEY must be base64 that decodes to exactly 32 bytes');
  }
  return trimmed;
}

function parseProtectedMasterKeyFile(filePath: string): ProtectedMasterKeyFile {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ProtectedMasterKeyFile>;
  if (
    parsed.version !== 1 ||
    parsed.algorithm !== 'electron-safe-storage' ||
    typeof parsed.ciphertextB64 !== 'string' ||
    parsed.ciphertextB64.trim().length === 0
  ) {
    throw new Error('Desktop secret storage metadata is invalid');
  }
  return parsed as ProtectedMasterKeyFile;
}

function writeProtectedMasterKeyFile(filePath: string, encrypted: Buffer): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const payload: ProtectedMasterKeyFile = {
    version: 1,
    algorithm: 'electron-safe-storage',
    ciphertextB64: encrypted.toString('base64'),
  };
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

export function createElectronSafeStorageProtector(
  safeStorage: Pick<
    SafeStorage,
    | 'decryptString'
    | 'decryptStringAsync'
    | 'encryptString'
    | 'encryptStringAsync'
    | 'isAsyncEncryptionAvailable'
    | 'isEncryptionAvailable'
  >,
): DesktopSecretProtector {
  return {
    async isEncryptionAvailable() {
      return safeStorage.isAsyncEncryptionAvailable();
    },
    async encryptString(plainText: string) {
      return safeStorage.encryptStringAsync(plainText);
    },
    async decryptString(encrypted: Buffer) {
      return safeStorage.decryptStringAsync(encrypted);
    },
  };
}

export async function ensureDesktopSecretsMasterKey({
  env = process.env,
  filePath,
  protector,
}: {
  env?: NodeJS.ProcessEnv;
  filePath: string;
  protector: DesktopSecretProtector;
}): Promise<DesktopSecretsMasterKeyResult> {
  const configuredMasterKey = env.SECRETS_MASTER_KEY?.trim();
  if (configuredMasterKey) {
    return {
      masterKeyB64: assertMasterKey(configuredMasterKey),
      source: 'environment',
      persisted: false,
    };
  }

  if (!(await protector.isEncryptionAvailable())) {
    throw new Error(
      'Electron safeStorage is unavailable; set SECRETS_MASTER_KEY for development/test or retry when OS secure storage is available.',
    );
  }

  if (existsSync(filePath)) {
    const protectedFile = parseProtectedMasterKeyFile(filePath);
    const encrypted = Buffer.from(protectedFile.ciphertextB64, 'base64');
    const decrypted = await protector.decryptString(encrypted);
    const masterKeyB64 = assertMasterKey(decrypted.result);
    if (decrypted.shouldReEncrypt === true) {
      writeProtectedMasterKeyFile(filePath, await protector.encryptString(masterKeyB64));
    }
    return { masterKeyB64, source: 'safe-storage', persisted: true };
  }

  const masterKeyB64 = randomBytes(32).toString('base64');
  writeProtectedMasterKeyFile(filePath, await protector.encryptString(masterKeyB64));
  return { masterKeyB64, source: 'safe-storage', persisted: true };
}

export function deleteDesktopSecretsMasterKey(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  rmSync(filePath, { force: true });
  return true;
}
