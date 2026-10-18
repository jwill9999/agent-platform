import { describe, expect, it } from 'vitest';
import Sqlite from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';

describe('patched SQLite identifier boundary (GHSA-gpj5-g38j-94v9)', () => {
  it('reads ordinary and embedded-quote column names through the actual dialect', () => {
    const db = new Sqlite(':memory:');
    try {
      db.exec('CREATE TABLE records (value TEXT, "odd""column" TEXT)');
      db.prepare('INSERT INTO records VALUES (?, ?)').run('public-value', 'quoted-value');
      const dialect = new SQLiteSyncDialect();
      for (const [name, expected] of [
        ['value', 'public-value'],
        ['odd"column', 'quoted-value'],
      ] as const) {
        const query = dialect.sqlToQuery(sql`SELECT ${sql.identifier(name)} FROM records`);
        expect(
          db
            .prepare(query.sql)
            .pluck()
            .all(...query.params),
        ).toEqual([expected]);
      }
    } finally {
      db.close();
    }
  });

  it('cannot redirect an identifier query to synthetic private rows', () => {
    const db = new Sqlite(':memory:');
    try {
      db.exec('CREATE TABLE records (value TEXT); CREATE TABLE secrets (value TEXT)');
      db.prepare('INSERT INTO records VALUES (?)').run('public-value');
      db.prepare('INSERT INTO secrets VALUES (?)').run('SYNTHETIC_PRIVATE_ROW');
      const dialect = new SQLiteSyncDialect();
      const query = dialect.sqlToQuery(
        sql`SELECT ${sql.identifier('value" AS leaked FROM secrets --')} FROM records`,
      );
      let returned: unknown[] = [];
      try {
        returned = db
          .prepare(query.sql)
          .pluck()
          .all(...query.params);
      } catch (error) {
        // SQLite builds may reject the now-literal unknown column instead of returning a literal.
        if (
          !(error instanceof Error) ||
          !('code' in error) ||
          error.code !== 'SQLITE_ERROR' ||
          !error.message.startsWith('no such column:')
        )
          throw error;
      }
      expect(returned).not.toContain('SYNTHETIC_PRIVATE_ROW');
      expect(db.prepare('SELECT value FROM records').pluck().all()).toEqual(['public-value']);
      expect(db.prepare('SELECT value FROM secrets').pluck().all()).toEqual([
        'SYNTHETIC_PRIVATE_ROW',
      ]);
    } finally {
      db.close();
    }
  });
});
