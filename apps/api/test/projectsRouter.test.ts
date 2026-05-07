import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, createSession, openDatabase, replaceAgent } from '@agent-platform/db';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createProjectsRouter } from '../src/infrastructure/http/v1/projectsRouter.js';
import { createSessionsRouter } from '../src/infrastructure/http/v1/sessionsRouter.js';

const GIT_BINARY = '/usr/bin/git';

function buildTestApp(db: ReturnType<typeof openDatabase>['db']) {
  const app = express();
  app.use(express.json());
  app.use('/v1/projects', createProjectsRouter(db));
  app.use('/v1/sessions', createSessionsRouter(db));
  app.use(errorMiddleware);
  return app;
}

describe('projectsRouter', () => {
  let opened: ReturnType<typeof openDatabase>;
  let tmpDir: string;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-projects-api-'));
    opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    replaceAgent(opened.db, {
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
    app = buildTestApp(opened.db);
  });

  afterEach(() => {
    closeDatabase(opened.sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates, lists, updates, and archives projects', async () => {
    const created = await request(app)
      .post('/v1/projects')
      .send({ name: 'Agent Platform', metadata: { language: 'typescript' } })
      .expect(201);

    expect(created.body.data).toMatchObject({
      slug: 'agent-platform',
      workspacePath: 'projects/agent-platform',
    });

    const listed = await request(app).get('/v1/projects').expect(200);
    expect(listed.body.data).toHaveLength(1);

    const updated = await request(app)
      .put(`/v1/projects/${created.body.data.id}`)
      .send({ description: 'Updated project' })
      .expect(200);
    expect(updated.body.data.description).toBe('Updated project');

    await request(app).delete(`/v1/projects/${created.body.data.id}`).expect(204);
    const active = await request(app).get('/v1/projects').expect(200);
    expect(active.body.data).toEqual([]);
  });

  it('opens a backend-accessible project, persists repository metadata, and binds project sessions', async () => {
    const repoDir = path.join(tmpDir, 'repo');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'project\n');
    const repoRealPath = realpathSync(repoDir);

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Backend Repo' })
      .expect(201);

    expect(openedProject.body.data).toMatchObject({
      name: 'Backend Repo',
      workspaceKey: repoRealPath,
      metadata: {
        backendProjectRoot: repoRealPath,
        repositoryRoot: repoRealPath,
        activeBranch: 'main',
        capabilityState: 'backend_accessible',
        onboardingState: 'missing',
        defaultAgentProfile: 'coding',
      },
    });

    const selectedAgain = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Backend Repo Renamed' })
      .expect(200);
    expect(selectedAgain.body.data.id).toBe(openedProject.body.data.id);
    expect(selectedAgain.body.data.name).toBe('Backend Repo Renamed');

    const session = await request(app)
      .post('/v1/sessions')
      .send({
        agentId: 'agent-1',
        mode: 'project',
        projectId: openedProject.body.data.id,
      })
      .expect(201);
    expect(session.body.data).toMatchObject({
      mode: 'project',
      projectId: openedProject.body.data.id,
    });
  });

  it('keeps backend-inaccessible paths unavailable and does not create project records', async () => {
    const missingPath = path.join(tmpDir, 'missing');

    const unavailable = await request(app)
      .post('/v1/projects/open')
      .send({ path: missingPath, name: 'Missing Repo' })
      .expect(422);

    expect(unavailable.body.error).toMatchObject({
      code: 'PROJECT_UNAVAILABLE',
    });
    expect(unavailable.body.error.details).toMatchObject({
      capabilityState: 'unavailable',
      path: missingPath,
    });

    const listed = await request(app).get('/v1/projects').expect(200);
    expect(listed.body.data).toEqual([]);
  });

  it('returns clear errors for duplicate slugs, invalid workspace paths, and missing session projects', async () => {
    await request(app).post('/v1/projects').send({ name: 'Agent Platform' }).expect(201);
    await request(app)
      .post('/v1/projects')
      .send({ name: 'Agent Platform Copy', slug: 'agent-platform' })
      .expect(409);
    await request(app)
      .post('/v1/projects')
      .send({ name: 'Invalid Workspace', workspacePath: '../outside' })
      .expect(400);

    const session = createSession(opened.db, { agentId: 'agent-1' });
    await request(app)
      .put(`/v1/sessions/${session.id}/project`)
      .send({ projectId: 'missing-project' })
      .expect(404);
  });
});
