import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  decryptUtf8,
  encryptUtf8,
  parseMasterKeyFromBase64,
  SECRETS_ALGORITHM_V1,
  timingSafeEqualUtf8,
} from '../src/crypto/envelope.js';
import { SecretDecryptionError, SecretKeyError } from '../src/crypto/errors.js';

const validKeyB64 = Buffer.alloc(32, 7).toString('base64');

describe('envelope AES-256-GCM', () => {
  it('round-trips UTF-8 plaintext', () => {
    const key = parseMasterKeyFromBase64(validKeyB64);
    const payload = encryptUtf8('sk-test-abc', key, 1);
    expect(payload.algorithm).toBe(SECRETS_ALGORITHM_V1);
    expect(payload.keyVersion).toBe(1);
    const out = decryptUtf8(payload, key);
    expect(out).toBe('sk-test-abc');
    expect(timingSafeEqualUtf8(out, 'sk-test-abc')).toBe(true);
  });

  it('rejects invalid master key length', () => {
    expect(() => parseMasterKeyFromBase64(Buffer.alloc(31).toString('base64'))).toThrow(
      SecretKeyError,
    );
  });

  it('fails decryption with wrong key', () => {
    const key = parseMasterKeyFromBase64(validKeyB64);
    const wrong = randomBytes(32);
    const payload = encryptUtf8('x', key, 1);
    expect(() => decryptUtf8(payload, wrong)).toThrow(SecretDecryptionError);
  });

  it('fails decryption when ciphertext is tampered', () => {
    const key = parseMasterKeyFromBase64(validKeyB64);
    const payload = encryptUtf8('unchanged', key, 1);
    const ct = Buffer.from(payload.ciphertextB64, 'base64');
    ct[0] ^= 1;
    const bad: typeof payload = {
      ...payload,
      ciphertextB64: ct.toString('base64'),
    };
    expect(() => decryptUtf8(bad, key)).toThrow(SecretDecryptionError);
  });

  it('fails decryption for unsupported algorithm label', () => {
    const key = parseMasterKeyFromBase64(validKeyB64);
    const payload = encryptUtf8('x', key, 1);
    expect(() =>
      decryptUtf8({ ...payload, algorithm: 'aes-256-gcm-v99' as typeof payload.algorithm }, key),
    ).toThrow(SecretDecryptionError);
  });
});
