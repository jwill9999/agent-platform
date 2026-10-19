import type { MessageRecord, PersistedToolCall } from '@agent-platform/contracts';
import { and, eq, sql } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import { decryptUtf8, encryptUtf8 } from '../crypto/envelope.js';
import * as schema from '../schema.js';
import { withTransaction } from '../transaction.js';
import { appendMessage, listMessagesBySession } from './messages.js';

export interface ProviderContinuationBinding {
  provider: string;
  model: string;
  apiMode: string;
  endpoint: string;
  credentialRevision: string;
}
export interface ProviderContinuationRecord {
  version: 1;
  binding: ProviderContinuationBinding;
  /** Opaque until the selected SDK validates its own message format. */
  responseMessages: unknown[];
}
export interface MessageWithContinuation {
  message: MessageRecord;
  continuation?: ProviderContinuationRecord;
}
export interface ContinuationMessageInput {
  id: string;
  sessionId: string;
  role: MessageRecord['role'];
  content: string;
  toolCallId?: string;
  toolCalls?: PersistedToolCall[];
  continuation?: ProviderContinuationRecord;
}
export class ProviderContinuationError extends Error {
  constructor() {
    super('PROVIDER_CONTINUATION_UNAVAILABLE');
    this.name = 'ProviderContinuationError';
  }
}
const MESSAGE_CAP = 256 * 1024;
const SESSION_CAP = 4 * 1024 * 1024;
const BINDING_KEYS = ['provider', 'model', 'apiMode', 'endpoint', 'credentialRevision'] as const;
function fail(): never {
  throw new ProviderContinuationError();
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isBinding(value: unknown): value is ProviderContinuationBinding {
  return (
    isObject(value) &&
    BINDING_KEYS.every((key) => typeof value[key] === 'string' && value[key].length > 0)
  );
}
function isContinuation(value: unknown): value is ProviderContinuationRecord {
  return (
    isObject(value) &&
    value.version === 1 &&
    isBinding(value.binding) &&
    Array.isArray(value.responseMessages) &&
    value.responseMessages.length > 0
  );
}
export function assertContinuationBinding(
  record: ProviderContinuationRecord,
  expected: ProviderContinuationBinding,
): void {
  if (
    !isContinuation(record) ||
    !isBinding(expected) ||
    !BINDING_KEYS.every((key) => record.binding[key] === expected[key])
  )
    fail();
}
function identity(
  message: Pick<
    MessageRecord,
    'id' | 'sessionId' | 'role' | 'content' | 'toolCallId' | 'toolCalls'
  >,
): string {
  return JSON.stringify({
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    toolCallId: message.toolCallId ?? null,
    toolCalls: message.toolCalls ?? null,
  });
}
function serialize(message: MessageRecord, continuation: ProviderContinuationRecord): string {
  if (message.role !== 'assistant' || !isContinuation(continuation)) fail();
  const plaintext = JSON.stringify({ messageIdentity: identity(message), continuation });
  if (Buffer.byteLength(plaintext, 'utf8') > MESSAGE_CAP) fail();
  return plaintext;
}
function readContinuation(
  db: DrizzleDb,
  message: MessageRecord,
  masterKey: Buffer | undefined,
): { continuation: ProviderContinuationRecord; bytes: number } {
  const row = db
    .select()
    .from(schema.providerContinuations)
    .where(
      and(
        eq(schema.providerContinuations.messageId, message.id),
        eq(schema.providerContinuations.sessionId, message.sessionId),
      ),
    )
    .get();
  if (
    !row ||
    !masterKey ||
    row.algorithm !== 'aes-256-gcm-v1' ||
    row.plaintextBytes <= 0 ||
    row.plaintextBytes > MESSAGE_CAP
  )
    fail();
  const plaintext = decryptUtf8({ ...row, algorithm: 'aes-256-gcm-v1' }, masterKey);
  const bytes = Buffer.byteLength(plaintext, 'utf8');
  if (bytes !== row.plaintextBytes || bytes > MESSAGE_CAP) fail();
  const payload: unknown = JSON.parse(plaintext);
  if (
    !isObject(payload) ||
    payload.messageIdentity !== identity(message) ||
    !isContinuation(payload.continuation) ||
    message.role !== 'assistant'
  )
    fail();
  return { continuation: payload.continuation, bytes };
}
/** Internal hydration. Any missing required, corrupt or swapped envelope fails closed. */
export function listMessagesWithContinuation(
  db: DrizzleDb,
  sessionId: string,
  masterKey: Buffer | undefined,
): MessageWithContinuation[] {
  try {
    return withTransaction(db, (tx) => {
      let totalBytes = 0;
      return listMessagesBySession(tx, sessionId).map((message) => {
        const row = tx
          .select({ format: schema.messages.providerContinuationFormat })
          .from(schema.messages)
          .where(eq(schema.messages.id, message.id))
          .get();
        if (!row || (row.format !== 0 && row.format !== 1)) fail();
        if (row.format === 0) {
          if (
            tx
              .select()
              .from(schema.providerContinuations)
              .where(eq(schema.providerContinuations.messageId, message.id))
              .get()
          )
            fail();
          return { message };
        }
        const { continuation, bytes } = readContinuation(tx, message, masterKey);
        totalBytes += bytes;
        if (totalBytes > SESSION_CAP) fail();
        return { message, continuation };
      });
    });
  } catch {
    throw new ProviderContinuationError();
  }
}
function persistContinuation(
  db: DrizzleDb,
  message: MessageRecord,
  continuation: ProviderContinuationRecord,
  masterKey: Buffer | undefined,
  keyVersion: number,
): void {
  if (!masterKey) fail();
  const plaintext = serialize(message, continuation);
  const bytes = Buffer.byteLength(plaintext, 'utf8');
  const existing = db
    .select({
      bytes: sql<number>`coalesce(sum(${schema.providerContinuations.plaintextBytes}), 0)`,
    })
    .from(schema.providerContinuations)
    .where(eq(schema.providerContinuations.sessionId, message.sessionId))
    .get();
  if ((existing?.bytes ?? 0) + bytes > SESSION_CAP) fail();
  const envelope = encryptUtf8(plaintext, masterKey, keyVersion);
  db.insert(schema.providerContinuations)
    .values({
      messageId: message.id,
      sessionId: message.sessionId,
      ...envelope,
      plaintextBytes: bytes,
    })
    .run();
  db.update(schema.messages)
    .set({ providerContinuationFormat: 1 })
    .where(eq(schema.messages.id, message.id))
    .run();
}
/** Await this atomic barrier before any approval creation or tool dispatch. Repeated stable IDs deduplicate only identical content. */
export function appendMessageWithContinuation(
  db: DrizzleDb,
  input: ContinuationMessageInput,
  masterKey: Buffer | undefined,
  keyVersion: number,
): MessageRecord {
  try {
    return withTransaction(db, (tx) => {
      const previous = listMessagesWithContinuation(tx, input.sessionId, masterKey).find(
        ({ message }) => message.id === input.id,
      );
      if (previous) {
        if (
          identity(previous.message) !== identity(input) ||
          JSON.stringify(previous.continuation) !== JSON.stringify(input.continuation)
        )
          fail();
        return previous.message;
      }
      const message = appendMessage(tx, input);
      if (input.continuation)
        persistContinuation(tx, message, input.continuation, masterKey, keyVersion);
      return message;
    });
  } catch {
    throw new ProviderContinuationError();
  }
}
