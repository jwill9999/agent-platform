import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import { decryptUtf8, encryptUtf8 } from '../crypto/envelope.js';
import { SecretDecryptionError } from '../crypto/errors.js';
import * as schema from '../schema.js';

// ---------------------------------------------------------------------------
// Types (safe — no key material)
// ---------------------------------------------------------------------------

export type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  model: string;
  /** true when an API key is stored for this config */
  hasApiKey: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ModelConfigCreateBody = {
  name: string;
  provider: string;
  model: string;
  /** Plaintext API key — will be encrypted before storage. Optional for Ollama. */
  apiKey?: string;
};

export type ModelConfigUpdateBody = {
  name?: string;
  provider?: string;
  model?: string;
  /** Provide to rotate the key; omit to keep the existing key. */
  apiKey?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToModelConfig(row: typeof schema.modelConfigs.$inferSelect): ModelConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    hasApiKey: row.secretRefId != null,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function listModelConfigs(db: DrizzleDb): ModelConfig[] {
  return db.select().from(schema.modelConfigs).all().map(rowToModelConfig);
}

export function getModelConfig(db: DrizzleDb, id: string): ModelConfig | undefined {
  const row = db.select().from(schema.modelConfigs).where(eq(schema.modelConfigs.id, id)).get();
  return row ? rowToModelConfig(row) : undefined;
}

export function createModelConfig(
  db: DrizzleDb,
  body: ModelConfigCreateBody,
  masterKey: Buffer,
  keyVersion: number,
): ModelConfig {
  const id = randomUUID();
  const now = Date.now();
  let secretRefId: string | null = null;

  if (body.apiKey) {
    const secretId = randomUUID();
    const payload = encryptUtf8(body.apiKey, masterKey, keyVersion);
    db.insert(schema.secretRefs)
      .values({
        id: secretId,
        label: `model-config:${id}`,
        ciphertextB64: payload.ciphertextB64,
        ivB64: payload.ivB64,
        authTagB64: payload.authTagB64,
        keyVersion: payload.keyVersion,
        algorithm: payload.algorithm,
      })
      .run();
    secretRefId = secretId;
  }

  db.insert(schema.modelConfigs)
    .values({
      id,
      name: body.name,
      provider: body.provider,
      model: body.model,
      secretRefId,
      createdAtMs: now,
      updatedAtMs: now,
    })
    .run();

  return {
    id,
    name: body.name,
    provider: body.provider,
    model: body.model,
    hasApiKey: secretRefId != null,
    createdAtMs: now,
    updatedAtMs: now,
  };
}

export function updateModelConfig(
  db: DrizzleDb,
  id: string,
  body: ModelConfigUpdateBody,
  masterKey: Buffer,
  keyVersion: number,
): ModelConfig | undefined {
  const existing = db
    .select()
    .from(schema.modelConfigs)
    .where(eq(schema.modelConfigs.id, id))
    .get();
  if (!existing) return undefined;

  const now = Date.now();
  let secretRefId = existing.secretRefId;

  if (body.apiKey !== undefined) {
    if (body.apiKey === '') {
      // Empty string = clear the key
      if (secretRefId) {
        db.delete(schema.secretRefs).where(eq(schema.secretRefs.id, secretRefId)).run();
        secretRefId = null;
      }
    } else {
      const payload = encryptUtf8(body.apiKey, masterKey, keyVersion);
      if (secretRefId) {
        // Re-encrypt in place
        db.update(schema.secretRefs)
          .set({
            ciphertextB64: payload.ciphertextB64,
            ivB64: payload.ivB64,
            authTagB64: payload.authTagB64,
            keyVersion: payload.keyVersion,
            algorithm: payload.algorithm,
          })
          .where(eq(schema.secretRefs.id, secretRefId))
          .run();
      } else {
        // Create new secret ref
        const secretId = randomUUID();
        db.insert(schema.secretRefs)
          .values({
            id: secretId,
            label: `model-config:${id}`,
            ciphertextB64: payload.ciphertextB64,
            ivB64: payload.ivB64,
            authTagB64: payload.authTagB64,
            keyVersion: payload.keyVersion,
            algorithm: payload.algorithm,
          })
          .run();
        secretRefId = secretId;
      }
    }
  }

  const updated = {
    name: body.name ?? existing.name,
    provider: body.provider ?? existing.provider,
    model: body.model ?? existing.model,
    secretRefId,
    updatedAtMs: now,
  };

  db.update(schema.modelConfigs).set(updated).where(eq(schema.modelConfigs.id, id)).run();

  return {
    id,
    name: updated.name,
    provider: updated.provider,
    model: updated.model,
    hasApiKey: secretRefId != null,
    createdAtMs: existing.createdAtMs,
    updatedAtMs: now,
  };
}

export function deleteModelConfig(db: DrizzleDb, id: string): boolean {
  const existing = db
    .select()
    .from(schema.modelConfigs)
    .where(eq(schema.modelConfigs.id, id))
    .get();
  if (!existing) return false;

  // Delete secret ref first (FK: model_configs.secret_ref_id → secret_refs.id)
  if (existing.secretRefId) {
    db.delete(schema.secretRefs).where(eq(schema.secretRefs.id, existing.secretRefId)).run();
  }

  db.delete(schema.modelConfigs).where(eq(schema.modelConfigs.id, id)).run();
  return true;
}

/**
 * Decrypt and return the stored API key for a model config.
 * Throws `SecretDecryptionError` if no key is stored or decryption fails.
 */
export function resolveModelConfigKey(db: DrizzleDb, id: string, masterKey: Buffer): string {
  const row = db.select().from(schema.modelConfigs).where(eq(schema.modelConfigs.id, id)).get();
  if (!row) throw new SecretDecryptionError('model config not found');
  if (!row.secretRefId) throw new SecretDecryptionError('model config has no stored API key');

  const secretRow = db
    .select()
    .from(schema.secretRefs)
    .where(eq(schema.secretRefs.id, row.secretRefId))
    .get();
  if (!secretRow) throw new SecretDecryptionError('secret ref not found');

  if (
    secretRow.ciphertextB64 == null ||
    secretRow.ivB64 == null ||
    secretRow.authTagB64 == null ||
    secretRow.keyVersion == null ||
    secretRow.algorithm == null
  ) {
    throw new SecretDecryptionError('secret material incomplete');
  }
  if (secretRow.algorithm !== 'aes-256-gcm-v1') {
    throw new SecretDecryptionError('unsupported algorithm');
  }

  return decryptUtf8(
    {
      algorithm: 'aes-256-gcm-v1',
      keyVersion: secretRow.keyVersion,
      ivB64: secretRow.ivB64,
      ciphertextB64: secretRow.ciphertextB64,
      authTagB64: secretRow.authTagB64,
    },
    masterKey,
  );
}
