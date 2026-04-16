import type { DrizzleDb } from './database.js';

/**
 * Wrap a callback in a SQLite transaction. If `fn` throws, all writes
 * inside it are rolled back atomically. The return value of `fn` is
 * forwarded to the caller.
 *
 * When `db` is already a transaction (nested call), Drizzle uses a
 * SAVEPOINT under the hood so the semantics are preserved.
 */
export function withTransaction<T>(db: DrizzleDb, fn: (tx: DrizzleDb) => T): T {
  // Drizzle's transaction callback receives a BetterSQLiteTransaction which
  // is structurally compatible with DrizzleDb for all query-builder methods.
  return db.transaction((tx) => fn(tx as unknown as DrizzleDb));
}
