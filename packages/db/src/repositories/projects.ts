import { randomUUID } from 'node:crypto';

import type {
  ProjectCreateBody,
  ProjectQuery,
  ProjectRecord,
  ProjectUpdateBody,
} from '@agent-platform/contracts';
import {
  ProjectCreateBodySchema,
  ProjectQuerySchema,
  ProjectRecordSchema,
  ProjectUpdateBodySchema,
} from '@agent-platform/contracts';
import { and, asc, eq, isNull, or } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';
import { slugify } from '../slug.js';

type ProjectRow = typeof schema.projects.$inferSelect;

export class ProjectNotFoundError extends Error {
  constructor(idOrSlug: string) {
    super(`Project not found: ${idOrSlug}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectSlugConflictError extends Error {
  constructor(slug: string) {
    super(`Project slug already exists: ${slug}`);
    this.name = 'ProjectSlugConflictError';
  }
}

export class ProjectWorkspacePathError extends Error {
  constructor(workspacePath: string) {
    super(`Project workspace path must stay under projects/: ${workspacePath}`);
    this.name = 'ProjectWorkspacePathError';
  }
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function rowToProject(row: ProjectRow): ProjectRecord {
  return ProjectRecordSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    workspacePath: row.workspacePath,
    workspaceKey: row.workspaceKey ?? undefined,
    metadata: parseMetadata(row.metadataJson),
    archivedAtMs: row.archivedAtMs ?? undefined,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  });
}

function normalizeWorkspacePath(slug: string, workspacePath?: string): string {
  const trimmed = workspacePath?.trim();
  if (!trimmed) return `projects/${slug}`;

  let normalized = trimmed.replaceAll('\\', '/');
  if (normalized.startsWith('./')) normalized = normalized.slice(2);

  if (normalized === '/workspace' || normalized === '/workspace/') {
    return `projects/${slug}`;
  }
  if (normalized.startsWith('/workspace/projects/')) {
    return normalized.replace(/^\/workspace\//, '');
  }
  if (normalized.startsWith('/workspace/')) {
    normalized = `projects/${normalized.slice('/workspace/'.length)}`;
  } else if (!normalized.startsWith('projects/')) {
    normalized = `projects/${normalized.replace(/^\/+/, '')}`;
  }

  if (
    normalized === 'projects' ||
    normalized.startsWith('/') ||
    normalized.split('/').includes('..')
  ) {
    throw new ProjectWorkspacePathError(trimmed);
  }

  return normalized;
}

function conditionForIdOrSlug(idOrSlug: string) {
  return or(eq(schema.projects.id, idOrSlug), eq(schema.projects.slug, idOrSlug));
}

function isProjectSlugConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  return (
    code.startsWith('SQLITE_CONSTRAINT') &&
    (message.includes('projects.slug') || message.includes('projects_slug_idx'))
  );
}

function mapProjectWriteError(error: unknown, slug: string): never {
  if (isProjectSlugConstraintError(error)) {
    throw new ProjectSlugConflictError(slug);
  }
  throw error;
}

export function createProject(
  db: DrizzleDb,
  rawInput: ProjectCreateBody,
  options: { id?: string; nowMs?: number } = {},
): ProjectRecord {
  const input = ProjectCreateBodySchema.parse(rawInput);
  const nowMs = options.nowMs ?? Date.now();
  const id = options.id ?? randomUUID();
  const slug = input.slug ?? slugify(input.name);
  const workspacePath = normalizeWorkspacePath(slug, input.workspacePath);

  try {
    db.insert(schema.projects)
      .values({
        id,
        slug,
        name: input.name,
        description: input.description ?? null,
        workspacePath,
        workspaceKey: input.workspaceKey ?? workspacePath,
        metadataJson: JSON.stringify(input.metadata),
        archivedAtMs: null,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      })
      .run();
  } catch (error) {
    mapProjectWriteError(error, slug);
  }

  return getProject(db, id);
}

export function getProject(db: DrizzleDb, idOrSlug: string): ProjectRecord {
  const row = db.select().from(schema.projects).where(conditionForIdOrSlug(idOrSlug)).get();
  if (!row) throw new ProjectNotFoundError(idOrSlug);
  return rowToProject(row);
}

export function findProject(db: DrizzleDb, idOrSlug: string): ProjectRecord | undefined {
  const row = db.select().from(schema.projects).where(conditionForIdOrSlug(idOrSlug)).get();
  return row ? rowToProject(row) : undefined;
}

export function listProjects(db: DrizzleDb, rawQuery: Partial<ProjectQuery> = {}): ProjectRecord[] {
  const query = ProjectQuerySchema.parse(rawQuery);
  const where = query.includeArchived ? undefined : isNull(schema.projects.archivedAtMs);
  return db
    .select()
    .from(schema.projects)
    .where(where)
    .orderBy(asc(schema.projects.name))
    .all()
    .map(rowToProject);
}

export function updateProject(
  db: DrizzleDb,
  idOrSlug: string,
  rawPatch: ProjectUpdateBody,
  nowMs = Date.now(),
): ProjectRecord {
  const existing = getProject(db, idOrSlug);
  const patch = ProjectUpdateBodySchema.parse(rawPatch);
  const slug = patch.slug ?? existing.slug;

  try {
    db.update(schema.projects)
      .set({
        slug,
        name: patch.name ?? existing.name,
        description:
          patch.description === undefined ? (existing.description ?? null) : patch.description,
        workspacePath: patch.workspacePath
          ? normalizeWorkspacePath(slug, patch.workspacePath)
          : existing.workspacePath,
        workspaceKey:
          patch.workspaceKey === undefined ? (existing.workspaceKey ?? null) : patch.workspaceKey,
        metadataJson:
          patch.metadata === undefined
            ? JSON.stringify(existing.metadata)
            : JSON.stringify(patch.metadata),
        archivedAtMs:
          patch.archivedAtMs === undefined ? (existing.archivedAtMs ?? null) : patch.archivedAtMs,
        updatedAtMs: nowMs,
      })
      .where(eq(schema.projects.id, existing.id))
      .run();
  } catch (error) {
    mapProjectWriteError(error, slug);
  }

  return getProject(db, existing.id);
}

export function archiveProject(db: DrizzleDb, idOrSlug: string, nowMs = Date.now()): boolean {
  const project = findProject(db, idOrSlug);
  if (!project) return false;
  const result = db
    .update(schema.projects)
    .set({ archivedAtMs: nowMs, updatedAtMs: nowMs })
    .where(and(eq(schema.projects.id, project.id), isNull(schema.projects.archivedAtMs)))
    .run();
  return result.changes > 0;
}
