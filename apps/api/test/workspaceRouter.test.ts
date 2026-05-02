import { mkdtempSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createWorkspaceRouter } from '../src/infrastructure/http/v1/workspaceRouter.js';

function buildTestApp(workspaceRoot: string) {
  const app = express();
  app.use('/v1/workspace', createWorkspaceRouter({ workspaceRoot }));
  app.use(errorMiddleware);
  return app;
}

describe('workspaceRouter', () => {
  let workspaceRoot: string;
  let outsideRoot: string;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'agent-platform-workspace-api-'));
    outsideRoot = mkdtempSync(join(tmpdir(), 'agent-platform-workspace-outside-'));
    app = buildTestApp(workspaceRoot);
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  });

  it('lists workspace files grouped by managed area', async () => {
    mkdirSync(join(workspaceRoot, 'generated', 'reports'), { recursive: true });
    mkdirSync(join(workspaceRoot, 'uploads'), { recursive: true });
    writeFileSync(join(workspaceRoot, 'generated', 'reports', 'summary.txt'), 'hello');
    writeFileSync(join(workspaceRoot, 'uploads', 'input.csv'), 'a,b');

    const res = await request(app).get('/v1/workspace/files').expect(200);

    expect(res.body.data.totalFiles).toBe(2);
    expect(res.body.data.areas.map((area: { area: string }) => area.area)).toEqual([
      'uploads',
      'generated',
      'scratch',
      'exports',
      'projects',
    ]);
    expect(
      res.body.data.areas
        .find((area: { area: string }) => area.area === 'generated')
        .files.some((file: { path: string }) => file.path === 'generated/reports/summary.txt'),
    ).toBe(true);
  });

  it('downloads a workspace-relative file', async () => {
    mkdirSync(join(workspaceRoot, 'exports'), { recursive: true });
    writeFileSync(join(workspaceRoot, 'exports', 'result.txt'), 'download me');

    const res = await request(app)
      .get('/v1/workspace/files/download')
      .query({ path: 'exports/result.txt' })
      .expect(200);

    expect(res.headers['content-disposition']).toContain('result.txt');
    expect(Buffer.from(res.body as Buffer).toString('utf8')).toBe('download me');
  });

  it('denies traversal and absolute download paths', async () => {
    await request(app)
      .get('/v1/workspace/files/download')
      .query({ path: '../secret.txt' })
      .expect(403);
    await request(app)
      .get('/v1/workspace/files/download')
      .query({ path: '/etc/passwd' })
      .expect(403);
  });

  it('does not list symlink escapes', async () => {
    mkdirSync(join(workspaceRoot, 'generated'), { recursive: true });
    writeFileSync(join(outsideRoot, 'secret.txt'), 'secret');
    symlinkSync(join(outsideRoot, 'secret.txt'), join(workspaceRoot, 'generated', 'secret-link'));

    const res = await request(app).get('/v1/workspace/files?area=generated').expect(200);

    expect(
      res.body.data.areas[0].files.some((file: { path: string }) =>
        file.path.includes('secret-link'),
      ),
    ).toBe(false);
  });
});
