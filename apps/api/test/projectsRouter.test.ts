import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '@agent-platform/db';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createProjectsRouter } from '../src/infrastructure/http/v1/projectsRouter.js';

function buildTestApp(db: ReturnType<typeof openDatabase>['db']) {
  const app = express();
  app.use(express.json());
  app.use('/v1/projects', createProjectsRouter(db));
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
});
