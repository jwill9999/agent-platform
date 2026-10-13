import { randomUUID } from 'node:crypto';

import {
  McpConnectionConfigSchema,
  McpCredentialChangesSchema,
  McpServerCreateBodySchema,
  validateMcpEndpoint,
} from '@agent-platform/contracts';
import type {
  McpServer,
  McpServerCreateBody,
  ResolvedMcpConnection,
} from '@agent-platform/contracts';
import { eq, or } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import { parseMasterKeyFromBase64 } from '../crypto/envelope.js';
import * as schema from '../schema.js';
import { getSecretUtf8, putSecretUtf8 } from '../secrets/store.js';
import { slugify } from '../slug.js';
import { withTransaction } from '../transaction.js';

type Row = typeof schema.mcpServers.$inferSelect;
type CredentialGroup = 'env' | 'headers';
type References = Record<CredentialGroup, Record<string, string | null>>;
interface StoredConfig {
  version: 1;
  revision: number;
  refs: References;
}
const groups: CredentialGroup[] = ['env', 'headers'];
export class McpConfigurationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'McpConfigurationError';
  }
}
function invalid(): never {
  throw new McpConfigurationError(
    'MCP_CONFIGURATION_INVALID',
    'Review and replace unsupported MCP connection settings.',
  );
}
function readMetadata(row: Row): Record<string, unknown> {
  try {
    const data: unknown = row.metadataJson ? JSON.parse(row.metadataJson) : {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data as Record<string, unknown>;
  } catch {
    return {};
  }
}
function stored(row: Row): StoredConfig | undefined {
  const value = readMetadata(row)['connection'];
  if (!value || typeof value !== 'object') return undefined;
  const data = value as Partial<StoredConfig>;
  if (
    Array.isArray(value) ||
    Object.keys(value).some((key) => !['version', 'revision', 'refs'].includes(key))
  )
    return undefined;
  if (
    data.version !== 1 ||
    !Number.isSafeInteger(data.revision) ||
    (data.revision ?? 0) < 1 ||
    !data.refs
  )
    return undefined;
  for (const group of groups) {
    if (
      !data.refs[group] ||
      typeof data.refs[group] !== 'object' ||
      Array.isArray(data.refs[group])
    )
      return undefined;
    for (const ref of Object.values(data.refs[group]))
      if (ref !== null && typeof ref !== 'string') return undefined;
  }
  if (Object.keys(data.refs).some((key) => key !== 'env' && key !== 'headers')) return undefined;
  const names = {
    env: Object.fromEntries(Object.keys(data.refs.env).map((name) => [name, ''])),
    headers: Object.fromEntries(Object.keys(data.refs.headers).map((name) => [name, ''])),
  };
  if (!McpCredentialChangesSchema.safeParse(names).success) return undefined;
  return data as StoredConfig;
}
function metadataHealthy(row: Row): boolean {
  let value: unknown;
  try {
    value = row.metadataJson ? JSON.parse(row.metadataJson) : {};
  } catch {
    return false;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  if ('connection' in metadata)
    return Object.keys(metadata).length === 1 && stored(row) !== undefined;
  return Object.keys(metadata).every((key) => key === 'env' || key === 'headers');
}
function metadataReadableForReplacement(row: Row): boolean {
  try {
    const value: unknown = row.metadataJson ? JSON.parse(row.metadataJson) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    // Unknown legacy options can be replaced explicitly, but corrupt private envelopes cannot
    // be downgraded to legacy credentials and silently discarded.
    return !('connection' in value) || stored(row) !== undefined;
  } catch {
    return false;
  }
}
function legacyCredentials(row: Row) {
  const metadata = readMetadata(row);
  const parsed = McpCredentialChangesSchema.safeParse({
    env: metadata['env'],
    headers: metadata['headers'],
  });
  if (!parsed.success) invalid();
  return parsed.data;
}
function rowConfig(row: Row) {
  let args: unknown;
  try {
    args = row.argsJson ? JSON.parse(row.argsJson) : undefined;
  } catch {
    invalid();
  }
  return {
    name: row.name,
    transport: row.transport,
    command: row.command ?? undefined,
    args,
    url: row.url ?? undefined,
  };
}
function getRow(db: DrizzleDb, id: string): Row | undefined {
  return db
    .select()
    .from(schema.mcpServers)
    .where(or(eq(schema.mcpServers.id, id), eq(schema.mcpServers.slug, id)))
    .get();
}
function publicNames(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([name, v]) => [name, typeof v === 'string']),
  );
}
/** Never include legacy credentials, URLs containing credentials, or private secret references. */
export function publicMcpServer(row: Row): McpServer {
  const config = stored(row);
  const metadata = readMetadata(row);
  const env = publicNames(config?.refs.env ?? metadata['env']);
  const headers = publicNames(config?.refs.headers ?? metadata['headers']);
  let parsed: ReturnType<typeof McpConnectionConfigSchema.safeParse>;
  try {
    parsed = McpConnectionConfigSchema.safeParse(rowConfig(row));
  } catch {
    parsed = McpConnectionConfigSchema.safeParse({});
  }
  let legacyValid = true;
  try {
    legacyCredentials(row);
  } catch {
    legacyValid = false;
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    transport: row.transport,
    command: row.command ?? undefined,
    args: parsed.success ? parsed.data.args : undefined,
    url: row.url && validateMcpEndpoint(row.url) ? row.url : undefined,
    credentialStatus: { env, headers },
    configurationRevision: config?.revision ?? 0,
    needsReconfiguration:
      !parsed.success ||
      !legacyValid ||
      !metadataHealthy(row) ||
      ('connection' in metadata && !config) ||
      [...Object.values(env), ...Object.values(headers)].some((value) => !value),
  };
}
export function listMcpServers(db: DrizzleDb): McpServer[] {
  return db.select().from(schema.mcpServers).all().map(publicMcpServer);
}
export function getMcpServer(db: DrizzleDb, id: string): McpServer | undefined {
  const row = getRow(db, id);
  return row ? publicMcpServer(row) : undefined;
}
function masterKey(explicit?: Buffer): Buffer {
  try {
    const encoded = (process.env['SECRETS_MASTER_KEY'] ?? '').trim();
    const key = explicit ?? parseMasterKeyFromBase64(encoded);
    if (key.length !== 32 || (!explicit && key.toString('base64') !== encoded))
      throw new Error('invalid');
    return key;
  } catch {
    throw new McpConfigurationError(
      'MCP_SECRET_KEY_UNAVAILABLE',
      'Configure a valid SECRETS_MASTER_KEY on the API host before storing or using credentials.',
    );
  }
}
function label(id: string, group: CredentialGroup, name: string) {
  return `mcp:${id}:${group}:${name}`;
}
function ownedSecret(db: DrizzleDb, id: string, group: CredentialGroup, name: string, ref: string) {
  const row = db.select().from(schema.secretRefs).where(eq(schema.secretRefs.id, ref)).get();
  if (!ref.startsWith(`mcp:${id}:`) || row?.label !== label(id, group, name)) invalid();
  return row;
}
function removeRef(
  db: DrizzleDb,
  id: string,
  group: CredentialGroup,
  name: string,
  ref: string | null | undefined,
) {
  if (!ref) return;
  ownedSecret(db, id, group, name, ref);
  db.delete(schema.secretRefs).where(eq(schema.secretRefs.id, ref)).run();
}
function applyCredentialChanges(
  db: DrizzleDb,
  id: string,
  input: McpServerCreateBody,
  refs: References,
  changes: McpServerCreateBody['credentials'],
  key?: Buffer,
): void {
  for (const group of groups) {
    const merged = { ...changes?.[group], ...input.credentials?.[group] };
    for (const [name, value] of Object.entries(merged)) {
      removeRef(db, id, group, name, refs[group][name]);
      if (value === null) {
        delete refs[group][name];
        continue;
      }
      const ref = `mcp:${id}:${randomUUID()}`;
      putSecretUtf8(db, {
        id: ref,
        label: label(id, group, name),
        plaintext: value,
        key: masterKey(key),
        keyVersion: 1,
      });
      refs[group][name] = ref;
    }
    const incompatible = input.transport === 'stdio' ? group === 'headers' : group === 'env';
    if (incompatible && Object.keys(refs[group]).length) invalid();
  }
}
function save(
  db: DrizzleDb,
  id: string,
  slug: string,
  body: McpServerCreateBody,
  previous?: Row,
  key?: Buffer,
): McpServer {
  const validated = McpServerCreateBodySchema.safeParse(body);
  if (!validated.success) invalid();
  const input = validated.data;
  if (previous && !metadataReadableForReplacement(previous)) invalid();
  const old = previous && stored(previous);
  const refs: References = old ? structuredClone(old.refs) : { env: {}, headers: {} };
  const changes = previous && !old ? legacyCredentials(previous) : {};
  applyCredentialChanges(db, id, input, refs, changes, key);
  const credentialNames = {
    env: Object.fromEntries(Object.keys(refs.env).map((name) => [name, ''])),
    headers: Object.fromEntries(Object.keys(refs.headers).map((name) => [name, ''])),
  };
  if (
    !McpCredentialChangesSchema.safeParse(credentialNames).success ||
    (old?.revision ?? 0) >= Number.MAX_SAFE_INTEGER
  )
    invalid();
  const connection: StoredConfig = { version: 1, revision: (old?.revision ?? 0) + 1, refs };
  const row = {
    id,
    slug,
    name: input.name,
    transport: input.transport,
    command: input.command ?? null,
    argsJson: input.args ? JSON.stringify(input.args) : null,
    url: input.url ?? null,
    metadataJson: JSON.stringify({ connection }),
  };
  db.insert(schema.mcpServers)
    .values(row)
    .onConflictDoUpdate({ target: schema.mcpServers.id, set: row })
    .run();
  return publicMcpServer(row);
}
export function createMcpServer(db: DrizzleDb, body: McpServerCreateBody, key?: Buffer): McpServer {
  return withTransaction(db, (tx) =>
    save(tx, randomUUID(), slugify(body.name), body, undefined, key),
  );
}
export function importMcpServers(
  db: DrizzleDb,
  bodies: McpServerCreateBody[],
  key?: Buffer,
): McpServer[] {
  if (!bodies.length || bodies.length > 100) invalid();
  return withTransaction(db, (tx) =>
    bodies.map((body) => save(tx, randomUUID(), slugify(body.name), body, undefined, key)),
  );
}
export function updateMcpServer(
  db: DrizzleDb,
  id: string,
  body: McpServerCreateBody,
  key?: Buffer,
): McpServer | undefined {
  return withTransaction(db, (tx) => {
    const previous = getRow(tx, id);
    return previous ? save(tx, previous.id, previous.slug, body, previous, key) : undefined;
  });
}
/** Trusted seed API. Public mutation routes use strict create/update instead. */
export function upsertMcpServer(db: DrizzleDb, value: McpServer): void {
  withTransaction(db, (tx) => {
    const previous = getRow(tx, value.id);
    save(
      tx,
      value.id,
      value.slug,
      {
        name: value.name,
        transport: value.transport as McpServerCreateBody['transport'],
        command: value.command,
        args: value.args,
        url: value.url,
        ...(value.metadata && ('env' in value.metadata || 'headers' in value.metadata)
          ? {
              credentials: McpCredentialChangesSchema.parse({
                env: value.metadata['env'],
                headers: value.metadata['headers'],
              }),
            }
          : {}),
      },
      previous,
    );
  });
}
export function duplicateMcpServer(db: DrizzleDb, id: string): McpServer | undefined {
  return withTransaction(db, (tx) => {
    const original = getRow(tx, id);
    if (!original) return undefined;
    if (
      !metadataHealthy(original) ||
      !McpConnectionConfigSchema.safeParse(rowConfig(original)).success
    )
      invalid();
    const publicRecord = publicMcpServer(original);
    const duplicateId = randomUUID();
    const refs: References = { env: {}, headers: {} };
    for (const group of groups)
      refs[group] = Object.fromEntries(
        Object.keys(publicRecord.credentialStatus?.[group] ?? {}).map((name) => [name, null]),
      );
    const row = {
      ...original,
      id: duplicateId,
      slug: `${slugify(original.name)}-copy-${duplicateId.slice(0, 8)}`,
      name: `${original.name} copy`,
      url: publicRecord.url ?? null,
      metadataJson: JSON.stringify({ connection: { version: 1, revision: 1, refs } }),
    };
    tx.insert(schema.mcpServers).values(row).run();
    return publicMcpServer(row);
  });
}
export function deleteMcpServer(db: DrizzleDb, id: string): boolean {
  return withTransaction(db, (tx) => {
    const row = getRow(tx, id);
    if (!row) return false;
    const refs = stored(row)?.refs;
    if (refs)
      for (const group of groups)
        for (const [name, ref] of Object.entries(refs[group]))
          removeRef(tx, row.id, group, name, ref);
    // Also remove orphaned owned material when a damaged private envelope is deleted.
    // Both independently stored ownership markers must match; unrelated model/server secrets stay.
    const prefix = `mcp:${row.id}:`;
    for (const secret of tx.select().from(schema.secretRefs).all()) {
      if (secret.id.startsWith(prefix) && secret.label?.startsWith(prefix)) {
        tx.delete(schema.secretRefs).where(eq(schema.secretRefs.id, secret.id)).run();
      }
    }
    tx.delete(schema.mcpServers).where(eq(schema.mcpServers.id, row.id)).run();
    return true;
  });
}
function resolveCredentials(
  db: DrizzleDb,
  id: string,
  config: StoredConfig,
  key?: Buffer,
): Record<CredentialGroup, Record<string, string>> {
  const values: Record<CredentialGroup, Record<string, string>> = { env: {}, headers: {} };
  for (const group of groups)
    for (const [name, ref] of Object.entries(config.refs[group])) {
      if (!ref) invalid();
      ownedSecret(db, id, group, name, ref);
      try {
        values[group][name] = getSecretUtf8(db, ref, masterKey(key));
      } catch (error) {
        if (error instanceof McpConfigurationError) throw error;
        throw new McpConfigurationError(
          'MCP_SECRET_DECRYPTION_FAILED',
          'MCP credentials could not be decrypted. Restore the correct key or replace the credentials.',
        );
      }
    }
  return values;
}
/** Single Test/chat boundary. No connection is attempted until migration/validation/decryption completes. */
export function resolveMcpConnection(
  db: DrizzleDb,
  id: string,
  key?: Buffer,
): ResolvedMcpConnection {
  return withTransaction(db, (tx) => {
    let row = getRow(tx, id);
    if (!row) throw new McpConfigurationError('MCP_NOT_FOUND', 'MCP server no longer exists.');
    const parsed = McpConnectionConfigSchema.safeParse(rowConfig(row));
    if (!parsed.success || publicMcpServer(row).needsReconfiguration) invalid();
    let config = stored(row);
    if (!config) {
      save(tx, row.id, row.slug, parsed.data, row, key);
      row = getRow(tx, row.id)!;
      config = stored(row)!;
    }
    const values = resolveCredentials(tx, row.id, config, key);
    const checked = McpCredentialChangesSchema.safeParse(values);
    if (!checked.success) invalid();
    return { ...publicMcpServer(row), ...parsed.data, env: values.env, headers: values.headers };
  });
}
