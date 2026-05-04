import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createBrowserRouter } from '../src/infrastructure/http/v1/browserRouter.js';

function buildTestApp(workspaceRoot: string) {
  const app = express();
  app.use('/v1/browser', createBrowserRouter({ workspaceRoot }));
  app.use(errorMiddleware);
  return app;
}

function writeArtifact(workspaceRoot: string, sessionId: string, id: string) {
  const dir = join(workspaceRoot, '.agent-platform', 'browser', sessionId);
  mkdirSync(dir, { recursive: true });
  const artifactPath = join(dir, `${id}.png`);
  writeFileSync(artifactPath, 'png');
  writeFileSync(
    `${artifactPath}.json`,
    JSON.stringify({
      id,
      sessionId,
      kind: 'screenshot',
      storage: 'workspace_file',
      label: 'Browser screenshot',
      mimeType: 'image/png',
      uri: artifactPath,
      sizeBytes: 3,
      maxBytes: 2_000_000,
      capturedAtMs: 2_000,
      metadata: {
        workspaceRelativePath: `.agent-platform/browser/${sessionId}/${id}.png`,
      },
    }),
  );
}

describe('browserRouter', () => {
  let workspaceRoot: string;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'agent-platform-browser-api-'));
    app = buildTestApp(workspaceRoot);
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('lists browser artifact metadata grouped by session', async () => {
    writeArtifact(workspaceRoot, 'browser-session-1', 'artifact-1');

    const res = await request(app).get('/v1/browser/artifacts').expect(200);

    expect(res.body.data.totalArtifacts).toBe(1);
    expect(res.body.data.sessions[0]).toMatchObject({
      sessionId: 'browser-session-1',
      artifactCount: 1,
      latestCapturedAtMs: 2_000,
    });
    expect(res.body.data.sessions[0].artifacts[0]).toMatchObject({
      id: 'artifact-1',
      kind: 'screenshot',
      downloadPath: '.agent-platform/browser/browser-session-1/artifact-1.png',
    });
  });

  it('filters artifacts by session id', async () => {
    writeArtifact(workspaceRoot, 'browser-session-1', 'artifact-1');
    writeArtifact(workspaceRoot, 'browser-session-2', 'artifact-2');

    const res = await request(app)
      .get('/v1/browser/artifacts')
      .query({ sessionId: 'browser-session-2' })
      .expect(200);

    expect(res.body.data.totalArtifacts).toBe(1);
    expect(res.body.data.sessions[0].sessionId).toBe('browser-session-2');
  });

  it('downloads browser artifacts and blocks metadata or traversal downloads', async () => {
    writeArtifact(workspaceRoot, 'browser-session-1', 'artifact-1');

    const res = await request(app)
      .get('/v1/browser/artifacts/download')
      .query({ path: '.agent-platform/browser/browser-session-1/artifact-1.png' })
      .expect(200);

    expect(Buffer.from(res.body as Buffer).toString('utf8')).toBe('png');

    await request(app)
      .get('/v1/browser/artifacts/download')
      .query({ path: '.agent-platform/browser/browser-session-1/artifact-1.png.json' })
      .expect(403);
    await request(app)
      .get('/v1/browser/artifacts/download')
      .query({ path: '../secret.txt' })
      .expect(403);
  });

  it('serves image artifacts inline for chat previews', async () => {
    writeArtifact(workspaceRoot, 'browser-session-1', 'artifact-1');

    const res = await request(app)
      .get('/v1/browser/artifacts/download')
      .query({
        path: '.agent-platform/browser/browser-session-1/artifact-1.png',
        disposition: 'inline',
      })
      .expect(200);

    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-disposition']).toContain('inline');
    expect(Buffer.from(res.body as Buffer).toString('utf8')).toBe('png');
  });
});
