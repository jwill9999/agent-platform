import { randomUUID } from 'node:crypto';

import type {
  MemoryCreateBodyInput,
  MemoryLink,
  MemoryLinkRelation,
  MemoryQuery,
  MemoryQueryInput,
  MemoryRecord,
  MemoryUpdateBody,
} from '@agent-platform/contracts';
import {
  MemoryCreateBodySchema,
  MemoryLinkSchema,
  MemoryQuerySchema,
  MemoryRecordSchema,
  MemoryUpdateBodySchema,
} from '@agent-platform/contracts';
import { and, desc, eq, gte, isNull, or, sql } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';
import { type JsonObject, redactObject, stringifyRedactedJson } from './memoryRedaction.js';

type MemoryRow = typeof schema.memories.$inferSelect;
type MemoryLinkRow = typeof schema.memoryLinks.$inferSelect;

export class MemoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Memory not found: ${id}`);
    this.name = 'MemoryNotFoundError';
  }
}

function stringifyJson(value: unknown): string {
  return stringifyRedactedJson(value);
}

function parseJsonValue(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function parseJsonObject(value: string | null): JsonObject {
  const parsed = parseJsonValue(value);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as JsonObject)
    : {};
}

function parseJsonArray(value: string | null): string[] {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function rowToMemory(row: MemoryRow): MemoryRecord {
  return MemoryRecordSchema.parse({
    id: row.id,
    scope: row.scope,
    scopeId: row.scopeId ?? undefined,
    kind: row.kind,
    status: row.status,
    reviewStatus: row.reviewStatus,
    content: row.content,
    confidence: row.confidence,
    source: {
      kind: row.sourceKind,
      id: row.sourceId ?? undefined,
      label: row.sourceLabel ?? undefined,
      metadata: parseJsonObject(row.sourceMetadataJson),
    },
    tags: parseJsonArray(row.tagsJson),
    metadata: parseJsonObject(row.metadataJson),
    safetyState: row.safetyState,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
    expiresAtMs: row.expiresAtMs ?? undefined,
    reviewedAtMs: row.reviewedAtMs ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
  });
}

function rowToMemoryLink(row: MemoryLinkRow): MemoryLink {
  return MemoryLinkSchema.parse({
    sourceMemoryId: row.sourceMemoryId,
    targetMemoryId: row.targetMemoryId,
    relation: row.relation,
    metadata: parseJsonObject(row.metadataJson),
    createdAtMs: row.createdAtMs,
  });
}

export interface CreateMemoryOptions {
  id?: string;
  nowMs?: number;
}

export function createMemory(
  db: DrizzleDb,
  input: MemoryCreateBodyInput,
  options: CreateMemoryOptions = {},
): MemoryRecord {
  const parsed = MemoryCreateBodySchema.parse(input);
  const nowMs = options.nowMs ?? Date.now();
  const id = options.id ?? randomUUID();
  const sourceMetadata = redactObject(parsed.source.metadata);
  const metadata = redactObject(parsed.metadata);
  const safetyState =
    parsed.safetyState === 'unchecked' && (sourceMetadata.wasRedacted || metadata.wasRedacted)
      ? 'redacted'
      : parsed.safetyState;

  db.insert(schema.memories)
    .values({
      id,
      scope: parsed.scope,
      scopeId: parsed.scopeId ?? null,
      kind: parsed.kind,
      status: parsed.status,
      reviewStatus: parsed.reviewStatus,
      content: parsed.content,
      confidence: parsed.confidence,
      sourceKind: parsed.source.kind,
      sourceId: parsed.source.id ?? null,
      sourceLabel: parsed.source.label ?? null,
      sourceMetadataJson: JSON.stringify(sourceMetadata.value),
      tagsJson: stringifyJson(parsed.tags),
      metadataJson: JSON.stringify(metadata.value),
      safetyState,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      expiresAtMs: parsed.expiresAtMs ?? null,
      reviewedAtMs: parsed.reviewedAtMs ?? null,
      reviewedBy: parsed.reviewedBy ?? null,
    })
    .run();

  return getMemory(db, id);
}

export function getMemory(db: DrizzleDb, id: string): MemoryRecord {
  const row = db.select().from(schema.memories).where(eq(schema.memories.id, id)).get();
  if (!row) throw new MemoryNotFoundError(id);
  return rowToMemory(row);
}

export interface QueryMemoriesOptions {
  nowMs?: number;
}

export function queryMemories(
  db: DrizzleDb,
  rawQuery: MemoryQueryInput,
  options: QueryMemoriesOptions = {},
): MemoryRecord[] {
  const query = MemoryQuerySchema.parse(rawQuery);
  const conditions = buildMemoryConditions(query, options.nowMs ?? Date.now());
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = db
    .select()
    .from(schema.memories)
    .where(where)
    .orderBy(desc(schema.memories.updatedAtMs))
    .limit(query.limit)
    .offset(query.offset)
    .all();

  return rows.map(rowToMemory);
}

export function countMemories(
  db: DrizzleDb,
  rawQuery: MemoryQueryInput,
  options: QueryMemoriesOptions = {},
): number {
  const query = MemoryQuerySchema.parse(rawQuery);
  const conditions = buildMemoryConditions(query, options.nowMs ?? Date.now());
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.memories)
    .where(where)
    .get();

  return result?.count ?? 0;
}

function buildMemoryConditions(query: MemoryQuery, nowMs: number) {
  const conditions = [];
  if (query.scope) conditions.push(eq(schema.memories.scope, query.scope));
  if (query.scopeId) conditions.push(eq(schema.memories.scopeId, query.scopeId));
  if (query.kind) conditions.push(eq(schema.memories.kind, query.kind));
  if (query.status) conditions.push(eq(schema.memories.status, query.status));
  if (query.reviewStatus) conditions.push(eq(schema.memories.reviewStatus, query.reviewStatus));
  if (query.safetyState) conditions.push(eq(schema.memories.safetyState, query.safetyState));
  if (query.minConfidence !== undefined) {
    conditions.push(gte(schema.memories.confidence, query.minConfidence));
  }
  if (query.sourceKind) conditions.push(eq(schema.memories.sourceKind, query.sourceKind));
  if (query.sourceId) conditions.push(eq(schema.memories.sourceId, query.sourceId));
  if (query.tag) {
    conditions.push(
      sql`exists (select 1 from json_each(${schema.memories.tagsJson}) where json_each.value = ${query.tag})`,
    );
  }
  if (query.sourceMetadata) {
    for (const [key, value] of Object.entries(query.sourceMetadata)) {
      const jsonPath = `$."${key.replaceAll(/["\\]/g, '\\$&')}"`;
      conditions.push(
        sql`json_extract(${schema.memories.sourceMetadataJson}, ${jsonPath}) = ${value}`,
      );
    }
  }
  if (!query.includeExpired) {
    conditions.push(
      or(isNull(schema.memories.expiresAtMs), gte(schema.memories.expiresAtMs, nowMs)),
    );
  }
  return conditions;
}

export function updateMemory(
  db: DrizzleDb,
  id: string,
  patch: MemoryUpdateBody,
  nowMs = Date.now(),
): MemoryRecord {
  const parsed = MemoryUpdateBodySchema.parse(patch);
  const existing = getMemory(db, id);
  const nextSource = parsed.source ?? existing.source;
  const sourceMetadata = redactObject(nextSource.metadata);
  const metadata =
    parsed.metadata === undefined ? existing.metadata : redactObject(parsed.metadata);
  const safetyState =
    parsed.safetyState ??
    (sourceMetadata.wasRedacted || metadata.wasRedacted ? 'redacted' : existing.safetyState);

  db.update(schema.memories)
    .set({
      kind: parsed.kind ?? existing.kind,
      status: parsed.status ?? existing.status,
      reviewStatus: parsed.reviewStatus ?? existing.reviewStatus,
      content: parsed.content ?? existing.content,
      confidence: parsed.confidence ?? existing.confidence,
      sourceKind: nextSource.kind,
      sourceId: nextSource.id ?? null,
      sourceLabel: nextSource.label ?? null,
      sourceMetadataJson: JSON.stringify(sourceMetadata.value),
      tagsJson:
        parsed.tags === undefined ? JSON.stringify(existing.tags) : stringifyJson(parsed.tags),
      metadataJson: JSON.stringify(metadata.value),
      safetyState,
      updatedAtMs: nowMs,
      expiresAtMs:
        parsed.expiresAtMs === undefined ? (existing.expiresAtMs ?? null) : parsed.expiresAtMs,
      reviewedAtMs:
        parsed.reviewedAtMs === undefined ? (existing.reviewedAtMs ?? null) : parsed.reviewedAtMs,
      reviewedBy:
        parsed.reviewedBy === undefined ? (existing.reviewedBy ?? null) : parsed.reviewedBy,
    })
    .where(eq(schema.memories.id, id))
    .run();

  return getMemory(db, id);
}

export function deleteMemory(db: DrizzleDb, id: string): boolean {
  const result = db.delete(schema.memories).where(eq(schema.memories.id, id)).run();
  return result.changes > 0;
}

export function deleteMemoriesByQuery(
  db: DrizzleDb,
  rawQuery: MemoryQueryInput,
  options: QueryMemoriesOptions = {},
): number {
  const query = MemoryQuerySchema.parse(rawQuery);
  const conditions = buildMemoryConditions(query, options.nowMs ?? Date.now());
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const result = db.delete(schema.memories).where(where).run();
  return result.changes;
}

export interface CreateMemoryLinkInput {
  sourceMemoryId: string;
  targetMemoryId: string;
  relation: MemoryLinkRelation;
  metadata?: JsonObject;
}

export function createMemoryLink(
  db: DrizzleDb,
  input: CreateMemoryLinkInput,
  nowMs = Date.now(),
): MemoryLink {
  const metadata = redactObject(input.metadata ?? {});

  db.insert(schema.memoryLinks)
    .values({
      sourceMemoryId: input.sourceMemoryId,
      targetMemoryId: input.targetMemoryId,
      relation: input.relation,
      metadataJson: JSON.stringify(metadata.value),
      createdAtMs: nowMs,
    })
    .run();

  return MemoryLinkSchema.parse({ ...input, metadata: metadata.value, createdAtMs: nowMs });
}

export function listMemoryLinks(db: DrizzleDb, memoryId: string): MemoryLink[] {
  const rows = db
    .select()
    .from(schema.memoryLinks)
    .where(
      or(
        eq(schema.memoryLinks.sourceMemoryId, memoryId),
        eq(schema.memoryLinks.targetMemoryId, memoryId),
      ),
    )
    .orderBy(desc(schema.memoryLinks.createdAtMs))
    .all();

  return rows.map(rowToMemoryLink);
}
