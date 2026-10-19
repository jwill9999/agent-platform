import { listenLoopback, closeLoopback } from './support/loopbackServer.js';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import * as filesystem from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { correlationMiddleware } from '../src/infrastructure/http/correlationMiddleware.js';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createWorkspaceRouter } from '../src/infrastructure/http/v1/workspaceRouter.js';

vi.hoisted(() => vi.resetModules());
afterAll(() => {
  vi.doUnmock('node:fs/promises');
  vi.resetModules();
});

// Native ESM fs exports are non-configurable. Mock only the read boundary while keeping
// all real initialization, HTTP, path-jail and filesystem operations in these tests.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readdir: vi.fn(actual.readdir), stat: vi.fn(actual.stat) };
});

async function buildTestApp(workspaceRoot: string) {
  const app = express();
  app.use(correlationMiddleware);
  app.use('/v1/workspace', createWorkspaceRouter({ workspaceRoot }));
  app.use(errorMiddleware);
  return listenLoopback(app);
}

describe('workspaceRouter', () => {
  let workspaceRoot: string;
  let outsideRoot: string;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'agent-platform-workspace-api-'));
    outsideRoot = mkdtempSync(join(tmpdir(), 'agent-platform-workspace-outside-'));
    app = await buildTestApp(workspaceRoot);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await closeLoopback(app);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
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
      res.body.data.areas.find((area: { area: string }) => area.area === 'projects'),
    ).toMatchObject({
      area: 'projects',
      label: 'Projects',
      path: 'projects',
    });
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

  async function expectUnavailable(options: {
    phase: 'initialize' | 'read';
    category: string;
    root?: string;
  }) {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const target = options.root ? await buildTestApp(options.root) : app;
    try {
      const res = await request(target)
        .get('/v1/workspace/files')
        .set('x-correlation-id', 'caller-canary')
        .expect(503);
      expect(res.body).toEqual({
        error: {
          code: 'WORKSPACE_FILES_UNAVAILABLE',
          message: 'Workspace files are unavailable. Refresh to retry.',
        },
      });
      const lines = log.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        service: 'workspace-files',
        phase: options.phase,
        category: options.category,
        correlationId: res.headers['x-request-id'],
      });
      expect(lines[0].correlationId).not.toBe('caller-canary');
      expect(Object.keys(lines[0]).sort()).toEqual([
        'category',
        'correlationId',
        'level',
        'msg',
        'phase',
        'service',
        'ts',
      ]);
      const text = JSON.stringify(lines) + JSON.stringify(res.body);
      for (const secret of [workspaceRoot, outsideRoot, 'PRIVATE_ERROR_CANARY', 'caller-canary'])
        expect(text).not.toContain(secret);
    } finally {
      if (target !== app) await closeLoopback(target);
    }
  }

  it('reports initialization failure safely with trusted request correlation', async () => {
    const blocked = join(workspaceRoot, 'blocked');
    writeFileSync(blocked, 'unchanged');
    await expectUnavailable({ root: blocked, phase: 'initialize', category: 'EEXIST' });
    expect(readFileSync(blocked, 'utf8')).toBe('unchanged');
  });

  it.each([
    { method: 'readdir' as const, category: 'EIO' },
    { method: 'stat' as const, category: 'EACCES' },
  ])(
    'reports read-phase $method failure rather than a partial or empty success',
    async ({ method, category }) => {
      mkdirSync(join(workspaceRoot, 'uploads'));
      writeFileSync(join(workspaceRoot, 'uploads', 'report.txt'), 'safe');
      vi.spyOn(filesystem, method).mockRejectedValueOnce(
        Object.assign(new Error('PRIVATE_ERROR_CANARY'), { code: category }),
      );
      await expectUnavailable({ phase: 'read', category });
    },
  );

  it('omits a file that disappears during listing', async () => {
    mkdirSync(join(workspaceRoot, 'uploads'));
    writeFileSync(join(workspaceRoot, 'uploads', 'gone.txt'), 'safe');
    vi.spyOn(filesystem, 'stat').mockRejectedValueOnce(
      Object.assign(new Error('gone'), { code: 'ENOENT' }),
    );
    const response = await request(app).get('/v1/workspace/files').expect(200);
    expect(response.body.data.totalFiles).toBe(0);
  });

  it('retains the safe response when failure logging itself throws', async () => {
    const blocked = join(workspaceRoot, 'blocked');
    writeFileSync(blocked, 'unchanged');
    const target = await buildTestApp(blocked);
    vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('PRIVATE_ERROR_CANARY');
    });
    try {
      const response = await request(target).get('/v1/workspace/files').expect(503);
      expect(response.body.error.code).toBe('WORKSPACE_FILES_UNAVAILABLE');
      expect(JSON.stringify(response.body)).not.toContain('PRIVATE_ERROR_CANARY');
      expect(readFileSync(blocked, 'utf8')).toBe('unchanged');
    } finally {
      await closeLoopback(target);
    }
  });

  it('retains validation and symlink download denials without outside effects', async () => {
    await request(app).get('/v1/workspace/files?area=unknown').expect(400);
    mkdirSync(join(workspaceRoot, 'generated'), { recursive: true });
    const canary = join(outsideRoot, 'private.txt');
    writeFileSync(canary, 'unchanged');
    symlinkSync(canary, join(workspaceRoot, 'generated', 'outside-link'));
    await request(app).get('/v1/workspace/files/download?path=generated/outside-link').expect(403);
    expect(readFileSync(canary, 'utf8')).toBe('unchanged');
  });
});
