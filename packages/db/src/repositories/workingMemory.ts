import type {
  WorkingMemoryArtifact,
  WorkingMemoryToolSummary,
  WorkingMemoryUpdateBody,
} from '@agent-platform/contracts';
import {
  WorkingMemoryArtifactSchema,
  WorkingMemoryToolSummarySchema,
  WorkingMemoryUpdateBodySchema,
} from '@agent-platform/contracts';
import { eq } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';

const MAX_LIST_ITEMS = 20;
const MAX_TOOL_SUMMARIES = 12;

type WorkingMemoryRow = typeof schema.workingMemoryArtifacts.$inferSelect;
type WorkingMemoryPersistenceValues = typeof schema.workingMemoryArtifacts.$inferInsert;

function parseJsonArray<T>(value: string | null, guard: (entry: unknown) => entry is T): T[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(guard) : [];
}

function isString(entry: unknown): entry is string {
  return typeof entry === 'string';
}

function isToolSummary(entry: unknown): entry is WorkingMemoryToolSummary {
  return WorkingMemoryToolSummarySafeParse(entry) !== null;
}

function WorkingMemoryToolSummarySafeParse(entry: unknown): WorkingMemoryToolSummary | null {
  const result = WorkingMemoryToolSummarySchema.safeParse(entry);
  return result.success ? result.data : null;
}

function uniqueBounded(values: readonly string[], maxItems = MAX_LIST_ITEMS): string[] {
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || result.includes(trimmed)) continue;
    result.push(trimmed.slice(0, 500));
    if (result.length >= maxItems) break;
  }
  return result;
}

function mergeStrings(existing: readonly string[], incoming: readonly string[] | undefined) {
  if (incoming === undefined) return [...existing];
  if (incoming.length === 0) return [];
  return uniqueBounded([...(incoming ?? []), ...existing]);
}

function mergeToolSummaries(
  existing: readonly WorkingMemoryToolSummary[],
  incoming: readonly WorkingMemoryToolSummary[] | undefined,
): WorkingMemoryToolSummary[] {
  if (incoming === undefined) return [...existing];
  if (incoming.length === 0) return [];
  const merged = [...(incoming ?? []), ...existing];
  const seen = new Set<string>();
  const result: WorkingMemoryToolSummary[] = [];
  for (const summary of merged) {
    const key = `${summary.toolName}:${summary.atMs}:${summary.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(summary);
    if (result.length >= MAX_TOOL_SUMMARIES) break;
  }
  return result;
}

function rowToArtifact(row: WorkingMemoryRow): WorkingMemoryArtifact {
  return WorkingMemoryArtifactSchema.parse({
    sessionId: row.sessionId,
    runId: row.runId ?? undefined,
    currentGoal: row.currentGoal ?? undefined,
    activeProject: row.activeProject ?? undefined,
    projectId: row.projectId ?? undefined,
    activeTask: row.activeTask ?? undefined,
    decisions: parseJsonArray(row.decisionsJson, isString),
    importantFiles: parseJsonArray(row.importantFilesJson, isString),
    toolsUsed: parseJsonArray(row.toolsUsedJson, isString),
    toolSummaries: parseJsonArray(row.toolSummariesJson, isToolSummary),
    blockers: parseJsonArray(row.blockersJson, isString),
    pendingApprovalIds: parseJsonArray(row.pendingApprovalIdsJson, isString),
    nextAction: row.nextAction ?? undefined,
    summary: row.summary,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  });
}

function buildSummary(artifact: WorkingMemoryArtifact): string {
  const parts = [];
  if (artifact.currentGoal) parts.push(`Goal: ${artifact.currentGoal}`);
  if (artifact.activeTask) parts.push(`Task: ${artifact.activeTask}`);
  if (artifact.decisions.length)
    parts.push(`Decisions: ${artifact.decisions.slice(0, 3).join('; ')}`);
  if (artifact.blockers.length) parts.push(`Blockers: ${artifact.blockers.slice(0, 3).join('; ')}`);
  if (artifact.nextAction) parts.push(`Next: ${artifact.nextAction}`);
  return parts.join('\n').slice(0, 1200);
}

function toPersistenceValues(
  artifact: WorkingMemoryArtifact,
  summary: string,
): WorkingMemoryPersistenceValues {
  return {
    sessionId: artifact.sessionId,
    runId: artifact.runId ?? null,
    currentGoal: artifact.currentGoal ?? null,
    activeProject: artifact.activeProject ?? null,
    projectId: artifact.projectId ?? null,
    activeTask: artifact.activeTask ?? null,
    decisionsJson: JSON.stringify(artifact.decisions),
    importantFilesJson: JSON.stringify(artifact.importantFiles),
    toolsUsedJson: JSON.stringify(artifact.toolsUsed),
    toolSummariesJson: JSON.stringify(artifact.toolSummaries),
    blockersJson: JSON.stringify(artifact.blockers),
    pendingApprovalIdsJson: JSON.stringify(artifact.pendingApprovalIds),
    nextAction: artifact.nextAction ?? null,
    summary,
    createdAtMs: artifact.createdAtMs,
    updatedAtMs: artifact.updatedAtMs,
  };
}

function toUpdateValues(values: WorkingMemoryPersistenceValues) {
  return {
    runId: values.runId,
    currentGoal: values.currentGoal,
    activeProject: values.activeProject,
    projectId: values.projectId,
    activeTask: values.activeTask,
    decisionsJson: values.decisionsJson,
    importantFilesJson: values.importantFilesJson,
    toolsUsedJson: values.toolsUsedJson,
    toolSummariesJson: values.toolSummariesJson,
    blockersJson: values.blockersJson,
    pendingApprovalIdsJson: values.pendingApprovalIdsJson,
    nextAction: values.nextAction,
    summary: values.summary,
    updatedAtMs: values.updatedAtMs,
  };
}

export function getWorkingMemoryArtifact(
  db: DrizzleDb,
  sessionId: string,
): WorkingMemoryArtifact | undefined {
  const row = db
    .select()
    .from(schema.workingMemoryArtifacts)
    .where(eq(schema.workingMemoryArtifacts.sessionId, sessionId))
    .get();
  return row ? rowToArtifact(row) : undefined;
}

export function upsertWorkingMemoryArtifact(
  db: DrizzleDb,
  input: WorkingMemoryUpdateBody,
  nowMs = Date.now(),
): WorkingMemoryArtifact {
  const parsed = WorkingMemoryUpdateBodySchema.parse(input);
  const existing = getWorkingMemoryArtifact(db, parsed.sessionId);
  const next: WorkingMemoryArtifact = WorkingMemoryArtifactSchema.parse({
    sessionId: parsed.sessionId,
    runId: parsed.runId ?? existing?.runId,
    currentGoal: parsed.currentGoal ?? existing?.currentGoal,
    activeProject: parsed.activeProject ?? existing?.activeProject,
    projectId: parsed.projectId ?? existing?.projectId,
    activeTask: parsed.activeTask ?? existing?.activeTask,
    decisions: mergeStrings(existing?.decisions ?? [], parsed.decisions),
    importantFiles: mergeStrings(existing?.importantFiles ?? [], parsed.importantFiles),
    toolsUsed: mergeStrings(existing?.toolsUsed ?? [], parsed.toolsUsed),
    toolSummaries: mergeToolSummaries(existing?.toolSummaries ?? [], parsed.toolSummaries),
    // Blockers and pending approvals reflect current state, so a provided list replaces
    // previous values; undefined preserves the existing state, and [] clears it.
    blockers:
      parsed.blockers === undefined
        ? (existing?.blockers ?? [])
        : uniqueBounded(parsed.blockers, MAX_LIST_ITEMS),
    pendingApprovalIds:
      parsed.pendingApprovalIds === undefined
        ? (existing?.pendingApprovalIds ?? [])
        : uniqueBounded(parsed.pendingApprovalIds, MAX_LIST_ITEMS),
    nextAction: parsed.nextAction ?? existing?.nextAction,
    summary: parsed.summary ?? '',
    createdAtMs: existing?.createdAtMs ?? nowMs,
    updatedAtMs: nowMs,
  });
  const summary = (parsed.summary ?? buildSummary(next)).slice(0, 1200);
  const persistenceValues = toPersistenceValues(next, summary);

  db.insert(schema.workingMemoryArtifacts)
    .values(persistenceValues)
    .onConflictDoUpdate({
      target: schema.workingMemoryArtifacts.sessionId,
      set: toUpdateValues(persistenceValues),
    })
    .run();

  return getWorkingMemoryArtifact(db, parsed.sessionId)!;
}

export function deleteWorkingMemoryArtifact(db: DrizzleDb, sessionId: string): boolean {
  const result = db
    .delete(schema.workingMemoryArtifacts)
    .where(eq(schema.workingMemoryArtifacts.sessionId, sessionId))
    .run();
  return result.changes > 0;
}
