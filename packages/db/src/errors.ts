/**
 * Typed database errors that wrap raw SQLite constraint violations.
 * Consumers (API layer) can match on `error.code` without leaking
 * database internals.
 */

export type DbErrorCode =
  | 'FOREIGN_KEY_VIOLATION'
  | 'UNIQUE_CONSTRAINT_VIOLATION'
  | 'DB_CONSTRAINT_ERROR';

export class DbError extends Error {
  readonly name = 'DbError';
  constructor(
    readonly code: DbErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class ForeignKeyViolationError extends DbError {
  constructor(message: string, cause?: unknown) {
    super('FOREIGN_KEY_VIOLATION', message, cause);
  }
}

export class UniqueConstraintError extends DbError {
  constructor(message: string, cause?: unknown) {
    super('UNIQUE_CONSTRAINT_VIOLATION', message, cause);
  }
}

interface SqliteError {
  code?: string;
  message?: string;
}

function isSqliteError(err: unknown): err is SqliteError {
  return err instanceof Error && typeof (err as SqliteError).code === 'string';
}

/**
 * Wrap a database operation, converting raw SQLite constraint errors
 * into typed {@link DbError} subclasses.
 *
 * @param context - Human-readable context (e.g. "creating session for agent abc")
 *   used in the wrapped error message.
 */
export function wrapConstraintError<T>(fn: () => T, context: string): T {
  try {
    return fn();
  } catch (err: unknown) {
    if (isSqliteError(err)) {
      if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        throw new ForeignKeyViolationError(`Referenced entity not found: ${context}`, err);
      }
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new UniqueConstraintError(`Duplicate entity: ${context}`, err);
      }
    }
    throw err;
  }
}
