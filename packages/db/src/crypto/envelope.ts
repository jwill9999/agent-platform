import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { SecretDecryptionError, SecretKeyError } from './errors.js';

export const SECRETS_ALGORITHM_V1 = 'aes-256-gcm-v1' as const;
const CIPHER = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptedSecretPayloadV1 {
  readonly algorithm: typeof SECRETS_ALGORITHM_V1;
  readonly keyVersion: number;
  readonly ivB64: string;
  readonly ciphertextB64: string;
  readonly authTagB64: string;
}

/** Decode `SECRETS_MASTER_KEY` (base64, 32 bytes) for AES-256-GCM. Never log the result. */
export function parseMasterKeyFromBase64(base64: string): Buffer {
  const key = Buffer.from(base64.trim(), 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new SecretKeyError('SECRETS_MASTER_KEY must be base64 that decodes to exactly 32 bytes');
  }
  return key;
}

export function encryptUtf8(
  plaintext: string,
  key: Buffer,
  keyVersion: number,
): EncryptedSecretPayloadV1 {
  if (key.length !== KEY_LENGTH) {
    throw new SecretKeyError('encryption key must be 32 bytes');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(CIPHER, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: SECRETS_ALGORITHM_V1,
    keyVersion,
    ivB64: iv.toString('base64'),
    ciphertextB64: ciphertext.toString('base64'),
    authTagB64: authTag.toString('base64'),
  };
}

export function decryptUtf8(payload: EncryptedSecretPayloadV1, key: Buffer): string {
  if (payload.algorithm !== SECRETS_ALGORITHM_V1) {
    throw new SecretDecryptionError('unsupported algorithm');
  }
  if (key.length !== KEY_LENGTH) {
    throw new SecretKeyError('decryption key must be 32 bytes');
  }
  const iv = Buffer.from(payload.ivB64, 'base64');
  const ciphertext = Buffer.from(payload.ciphertextB64, 'base64');
  const authTag = Buffer.from(payload.authTagB64, 'base64');
  if (iv.length !== IV_LENGTH || authTag.length !== 16) {
    throw new SecretDecryptionError('invalid envelope');
  }
  try {
    const decipher = createDecipheriv(CIPHER, key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    throw new SecretDecryptionError('decryption failed');
  }
}

/** Compare two UTF-8 secrets in constant time (for tests / optional callers). */
export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
