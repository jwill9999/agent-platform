import { randomUUID } from 'node:crypto';

import type { MessageRecord, PersistedToolCall } from '@agent-platform/contracts';
import { asc, eq } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';

/** Convert a message row to the contract shape. */
function rowToContract(row: typeof schema.messages.$inferSelect): MessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as MessageRecord['role'],
    content: row.content,
    toolCallId: row.toolCallId ?? null,
    toolCalls:
      row.toolCallsJson && row.role === 'assistant'
        ? (JSON.parse(row.toolCallsJson) as PersistedToolCall[])
        : undefined,
    createdAtMs: row.createdAtMs,
  };
}

/** Append a message to a session's conversation history. */
export function appendMessage(
  db: DrizzleDb,
  input: {
    sessionId: string;
    role: MessageRecord['role'];
    content: string;
    toolCallId?: string;
    toolCalls?: PersistedToolCall[];
    id?: string;
  },
): MessageRecord {
  const id = input.id ?? randomUUID();
  const now = Date.now();

  db.insert(schema.messages)
    .values({
      id,
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      toolCallId: input.toolCallId ?? null,
      toolCallsJson:
        input.role === 'assistant' && input.toolCalls ? JSON.stringify(input.toolCalls) : null,
      createdAtMs: now,
    })
    .run();

  const row = db.select().from(schema.messages).where(eq(schema.messages.id, id)).get();
  if (!row) throw new Error('message insert failed');
  return rowToContract(row);
}

/** List all messages for a session ordered by creation time (oldest first). */
export function listMessagesBySession(db: DrizzleDb, sessionId: string): MessageRecord[] {
  return db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
    .orderBy(asc(schema.messages.createdAtMs))
    .all()
    .map(rowToContract);
}

/** Delete all messages for a session. Returns number of deleted rows. */
export function deleteMessagesBySession(db: DrizzleDb, sessionId: string): number {
  const result = db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId)).run();
  return result.changes;
}
