import { eq } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';
import { decryptUtf8, encryptUtf8, type EncryptedSecretPayloadV1 } from '../crypto/envelope.js';
import { SecretDecryptionError } from '../crypto/errors.js';

function rowToPayload(row: typeof schema.secretRefs.$inferSelect): EncryptedSecretPayloadV1 {
  if (
    row.ciphertextB64 == null ||
    row.ivB64 == null ||
    row.authTagB64 == null ||
    row.keyVersion == null ||
    row.algorithm == null
  ) {
    throw new SecretDecryptionError('secret material incomplete');
  }
  if (row.algorithm !== 'aes-256-gcm-v1') {
    throw new SecretDecryptionError('unsupported algorithm');
  }
  return {
    algorithm: 'aes-256-gcm-v1',
    keyVersion: row.keyVersion,
    ivB64: row.ivB64,
    ciphertextB64: row.ciphertextB64,
    authTagB64: row.authTagB64,
  };
}

/** Persist UTF-8 secret value as ciphertext only (insert or replace by id). */
export function putSecretUtf8(
  db: DrizzleDb,
  params: {
    id: string;
    label: string | null;
    plaintext: string;
    key: Buffer;
    keyVersion: number;
  },
): void {
  const payload = encryptUtf8(params.plaintext, params.key, params.keyVersion);
  db.insert(schema.secretRefs)
    .values({
      id: params.id,
      label: params.label,
      ciphertextB64: payload.ciphertextB64,
      ivB64: payload.ivB64,
      authTagB64: payload.authTagB64,
      keyVersion: payload.keyVersion,
      algorithm: payload.algorithm,
    })
    .onConflictDoUpdate({
      target: schema.secretRefs.id,
      set: {
        label: params.label,
        ciphertextB64: payload.ciphertextB64,
        ivB64: payload.ivB64,
        authTagB64: payload.authTagB64,
        keyVersion: payload.keyVersion,
        algorithm: payload.algorithm,
      },
    })
    .run();
}

export function getSecretUtf8(db: DrizzleDb, id: string, key: Buffer): string {
  const row = db.select().from(schema.secretRefs).where(eq(schema.secretRefs.id, id)).get();
  if (!row) {
    throw new SecretDecryptionError('secret not found');
  }
  const payload = rowToPayload(row);
  return decryptUtf8(payload, key);
}
