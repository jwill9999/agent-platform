import type { PlatformSettings, PlatformSettingsUpdate } from '@agent-platform/contracts';
import { PlatformSettingsSchema } from '@agent-platform/contracts';
import { eq } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';

type SettingRow = { key: string; value: string; updatedAtMs: number };

function rowsToSettings(rows: SettingRow[]): PlatformSettings {
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    const keys = row.key.split('.');
    let cursor: Record<string, unknown> = raw;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]!;
      cursor[k] = (cursor[k] as Record<string, unknown>) ?? {};
      cursor = cursor[k] as Record<string, unknown>;
    }
    const leaf = keys[keys.length - 1]!;
    cursor[leaf] = JSON.parse(row.value);
  }
  return PlatformSettingsSchema.parse(raw);
}

/** Load all platform settings, merging DB values with schema defaults. */
export function loadSettings(db: DrizzleDb): PlatformSettings {
  const rows = db.select().from(schema.settings).all();
  return rowsToSettings(rows);
}

/** Persist a partial settings update, merging with existing values. */
export function updateSettings(db: DrizzleDb, update: PlatformSettingsUpdate): PlatformSettings {
  const now = Date.now();
  const entries = flattenUpdate(update);

  db.transaction((tx) => {
    for (const [key, value] of entries) {
      tx.insert(schema.settings)
        .values({ key, value: JSON.stringify(value), updatedAtMs: now })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: JSON.stringify(value), updatedAtMs: now },
        })
        .run();
    }
  });

  return loadSettings(db);
}

/** Reset all settings to defaults by clearing the settings table. */
export function resetSettings(db: DrizzleDb): PlatformSettings {
  db.delete(schema.settings).run();
  return PlatformSettingsSchema.parse({});
}

/** Delete a specific setting key, reverting it to default. */
export function deleteSetting(db: DrizzleDb, key: string): boolean {
  const r = db.delete(schema.settings).where(eq(schema.settings.key, key)).run();
  return r.changes > 0;
}

/** Flatten a nested settings update into dot-separated key-value pairs. */
function flattenUpdate(obj: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  const result: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== undefined && v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result.push(...flattenUpdate(v as Record<string, unknown>, fullKey));
    } else if (v !== undefined) {
      result.push([fullKey, v]);
    }
  }
  return result;
}
