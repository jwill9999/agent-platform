import type Database from 'better-sqlite3';

/** Mirrors drizzle/0005_add_slugs.sql when the DB predates that migration but the journal is inconsistent. */
function tableExists(sqlite: Database.Database, name: string): boolean {
  const row = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { '1': number } | undefined;
  return row !== undefined;
}

function columnSet(sqlite: Database.Database, table: string): Set<string> | null {
  if (!tableExists(sqlite, table)) return null;
  const rows = sqlite.prepare('SELECT name FROM pragma_table_info(?)').all(table) as {
    name: string;
  }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Idempotent repair after `migrate()`: add slug/name columns from migration 0005 if the physical
 * schema is missing them (stale dev.sqlite vs migration history).
 */
export function repairLegacySlugMigrationIfNeeded(sqlite: Database.Database): void {
  sqlite.transaction(() => {
    const agentsCols = columnSet(sqlite, 'agents');
    if (agentsCols && !agentsCols.has('slug')) {
      sqlite.exec(`ALTER TABLE agents ADD COLUMN slug text DEFAULT '' NOT NULL`);
      sqlite.exec(
        `UPDATE agents SET slug = LOWER(REPLACE(REPLACE(TRIM(name), ' ', '-'), '--', '-'))`,
      );
    }

    const mcpCols = columnSet(sqlite, 'mcp_servers');
    if (mcpCols && !mcpCols.has('slug')) {
      sqlite.exec(`ALTER TABLE mcp_servers ADD COLUMN slug text DEFAULT '' NOT NULL`);
      sqlite.exec(
        `UPDATE mcp_servers SET slug = LOWER(REPLACE(REPLACE(TRIM(name), ' ', '-'), '--', '-'))`,
      );
    }

    const toolsCols = columnSet(sqlite, 'tools');
    if (toolsCols && !toolsCols.has('slug')) {
      sqlite.exec(`ALTER TABLE tools ADD COLUMN slug text DEFAULT '' NOT NULL`);
      sqlite.exec(
        `UPDATE tools SET slug = LOWER(REPLACE(REPLACE(TRIM(name), ' ', '-'), '--', '-'))`,
      );
    }

    const skillsCols = columnSet(sqlite, 'skills');
    if (skillsCols) {
      let skillsNeedsBackfill = false;
      if (!skillsCols.has('name')) {
        sqlite.exec(`ALTER TABLE skills ADD COLUMN name text DEFAULT '' NOT NULL`);
        skillsNeedsBackfill = true;
      }
      if (!skillsCols.has('slug')) {
        sqlite.exec(`ALTER TABLE skills ADD COLUMN slug text DEFAULT '' NOT NULL`);
        skillsNeedsBackfill = true;
      }
      if (skillsNeedsBackfill) {
        sqlite.exec(`
          UPDATE skills SET
            name = SUBSTR(goal, 1, 60),
            slug = LOWER(REPLACE(REPLACE(TRIM(SUBSTR(goal, 1, 60)), ' ', '-'), '--', '-'))
        `);
      }
    }

    if (tableExists(sqlite, 'agents')) {
      sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS agents_slug_idx ON agents (slug)`);
    }
    if (tableExists(sqlite, 'mcp_servers')) {
      sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS mcp_servers_slug_idx ON mcp_servers (slug)`);
    }
    if (tableExists(sqlite, 'skills')) {
      sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS skills_slug_idx ON skills (slug)`);
    }
    if (tableExists(sqlite, 'tools')) {
      sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS tools_slug_idx ON tools (slug)`);
    }
  })();
}
