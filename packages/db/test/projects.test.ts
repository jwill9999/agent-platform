import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  updateProject,
} from '../src/repositories/projects.js';
import {
  createSession,
  getSession,
  replaceAgent,
  updateSessionProject,
} from '../src/repositories/registry.js';
import {
  getWorkingMemoryArtifact,
  upsertWorkingMemoryArtifact,
} from '../src/repositories/workingMemory.js';
import { createMemory, queryMemories } from '../src/repositories/memories.js';

describe('projects repository and associations', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-projects-'));
    const opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    db = opened.db;
    sqlite = opened.sqlite;

    replaceAgent(db, {
      id: 'agent-1',
      slug: 'agent-1',
      name: 'Test Agent',
      systemPrompt: 'sys',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates, updates, lists, and archives projects', () => {
    const project = createProject(
      db,
      {
        name: 'Agent Platform',
        description: 'Main application repository',
        metadata: { language: 'typescript' },
      },
      { id: 'project-1', nowMs: 1000 },
    );

    expect(project).toMatchObject({
      id: 'project-1',
      slug: 'agent-platform',
      workspacePath: 'projects/agent-platform',
      workspaceKey: 'projects/agent-platform',
    });

    const updated = updateProject(db, 'agent-platform', { description: null }, 2000);
    expect(updated.description).toBeUndefined();
    expect(updated.updatedAtMs).toBe(2000);
    expect(getProject(db, 'project-1').id).toBe('project-1');
    expect(listProjects(db).map((entry) => entry.id)).toEqual(['project-1']);

    expect(archiveProject(db, 'project-1', 3000)).toBe(true);
    expect(listProjects(db)).toEqual([]);
    expect(listProjects(db, { includeArchived: true }).map((entry) => entry.archivedAtMs)).toEqual([
      3000,
    ]);
  });

  it('keeps sessions valid without projects and supports nullable project binding', () => {
    const unscoped = createSession(db, { agentId: 'agent-1' });
    expect(unscoped.projectId).toBeNull();

    createProject(db, { name: 'Bound Project' }, { id: 'project-1', nowMs: 1000 });
    expect(updateSessionProject(db, unscoped.id, 'project-1')).toBe(true);
    expect(getSession(db, unscoped.id)).toMatchObject({ projectId: 'project-1' });

    const scoped = createSession(db, { agentId: 'agent-1', projectId: 'project-1' });
    expect(scoped.projectId).toBe('project-1');
  });

  it('associates working memory and project-scoped memories without changing scope semantics', () => {
    createProject(db, { name: 'Memory Project' }, { id: 'project-1', nowMs: 1000 });
    const session = createSession(db, { agentId: 'agent-1', projectId: 'project-1' });

    const artifact = upsertWorkingMemoryArtifact(
      db,
      { sessionId: session.id, projectId: 'project-1', activeProject: 'legacy-project-text' },
      2000,
    );
    expect(artifact.projectId).toBe('project-1');
    expect(getWorkingMemoryArtifact(db, session.id)?.activeProject).toBe('legacy-project-text');

    createMemory(
      db,
      {
        scope: 'project',
        scopeId: 'project-1',
        projectId: 'project-1',
        kind: 'decision',
        content: 'Project-scoped memories keep scope and gain indexed association.',
        source: { kind: 'manual' },
      },
      { id: 'memory-1', nowMs: 3000 },
    );

    expect(queryMemories(db, { scope: 'project', scopeId: 'project-1' })).toHaveLength(1);
    expect(queryMemories(db, { projectId: 'project-1' })).toHaveLength(1);
  });
});
