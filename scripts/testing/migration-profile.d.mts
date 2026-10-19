export function createMigrationProfile(
  sqlitePath: string,
  mode: 'legacy' | 'blocked' | 'complete' | 'complete-unknown' | 'sdk-watermark',
): void;
export function inspectMigrationProfile(sqlitePath: string): {
  retained: Record<string, unknown>;
  journal: unknown[];
  schema: unknown[];
  tables: string[];
  integrity: string;
  foreignKeyViolations: number;
};
