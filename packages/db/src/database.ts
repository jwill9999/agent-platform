import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';

import * as schema from './schema.js';
import { applyVerifiedMigrations } from './migrationHistory.js';
import { MigrationHistoryError } from './errors.js';

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

/** Open SQLite, apply pending migrations, return Drizzle client (caller owns lifecycle). */
export function openDatabase(sqlitePath: string): { db: DrizzleDb; sqlite: Database.Database } {
  const dir = path.dirname(sqlitePath);
  mkdirSync(dir, { recursive: true });
  const sqlite = new Database(sqlitePath);
  try {
    sqlite.pragma('foreign_keys = ON');
    applyVerifiedMigrations(
      sqlite,
      readMigrationFiles({ migrationsFolder: path.join(packageRoot, 'drizzle') }),
    );
    return { db: drizzle(sqlite, { schema }), sqlite };
  } catch {
    sqlite.close();
    throw new MigrationHistoryError();
  }
}

export function closeDatabase(sqlite: Database.Database): void {
  sqlite.close();
}
