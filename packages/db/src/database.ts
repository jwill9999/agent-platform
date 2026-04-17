import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from './schema.js';
import { repairLegacySlugMigrationIfNeeded } from './legacyRepair.js';

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

/** Open SQLite, apply pending migrations, return Drizzle client (caller owns lifecycle). */
export function openDatabase(sqlitePath: string): { db: DrizzleDb; sqlite: Database.Database } {
  const dir = path.dirname(sqlitePath);
  mkdirSync(dir, { recursive: true });
  const sqlite = new Database(sqlitePath);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(packageRoot, 'drizzle') });
  repairLegacySlugMigrationIfNeeded(sqlite);
  return { db, sqlite };
}

export function closeDatabase(sqlite: Database.Database): void {
  sqlite.close();
}
