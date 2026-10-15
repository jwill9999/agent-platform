import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDatabase,
  createProject,
  getGitDeliveryOperation,
  openDatabase,
  transitionGitDeliveryOperation,
  updateSettings,
} from '@agent-platform/db';
import type { GitDeliveryReceipt } from '@agent-platform/contracts';
import { createApp } from '../src/infrastructure/http/createApp.js';

function git(root: string, args: string[]) {
  return execFileSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}
const stage = { kind: 'stage', mode: 'stage', paths: ['file.txt'] };

describe('production Git delivery HTTP routing', () => {
  let directory: string;
  let repo: string;
  let opened: ReturnType<typeof openDatabase>;
  let server: Server;
  let url: string;
  let route: string;
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'git-delivery-http-'));
    repo = join(directory, 'repo');
    execFileSync('/usr/bin/git', ['init', '-b', 'feature/http', repo], { stdio: 'ignore' });
    git(repo, ['config', 'user.name', 'HTTP test']);
    git(repo, ['config', 'user.email', 'http@example.invalid']);
    writeFileSync(join(repo, 'file.txt'), 'initial');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-m', 'initial']);
    writeFileSync(join(repo, 'file.txt'), 'changed');
    opened = openDatabase(join(directory, 'state.sqlite'));
    const project = createProject(opened.db, {
      name: 'HTTP project',
      metadata: {
        backendProjectRoot: repo,
        repositoryRoot: repo,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
      },
    });
    route = `/v1/projects/${project.id}/git/delivery`;
    const app = createApp({ db: opened.db });
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    url = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    closeDatabase(opened.sqlite);
    rmSync(directory, { recursive: true, force: true });
  });
  async function prepare(action = stage): Promise<GitDeliveryReceipt> {
    const response = await request(url).post(route).send({ action }).expect(200);
    return response.body.data;
  }
  async function execute(id: string) {
    return request(url).post(`${route}/${id}/execute`).send({ confirmed: true }).expect(200);
  }
  it('prepares/confirms/retrieves only reviewed effects and repeats the recorded result', async () => {
    const prepared = await prepare();
    expect(prepared.state).toBe('prepared');
    expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('');
    await request(url).post(`${route}/${prepared.id}/execute`).send({}).expect(400);
    const done = await execute(prepared.id);
    expect(done.body.data.state).toBe('succeeded');
    expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('file.txt');
    expect((await execute(prepared.id)).body.data).toEqual(done.body.data);
    const listed = await request(url).get(route).expect(200);
    expect(listed.body.data.operations.map((item: GitDeliveryReceipt) => item.id)).toEqual([
      prepared.id,
    ]);
    const fetched = await request(url).get(`${route}/${prepared.id}`).expect(200);
    expect(fetched.body.data).toEqual(done.body.data);
    expect(JSON.stringify(fetched.body)).not.toContain(repo);
  });
  it('reviews the complete hidden-only index and commits it through the production mount', async () => {
    mkdirSync(join(repo, '.agent-platform'), { recursive: true });
    writeFileSync(join(repo, '.agent-platform', 'retained.txt'), 'private fixture contents');
    git(repo, ['add', '--', '.agent-platform/retained.txt']);
    const originalIndex = readFileSync(join(repo, '.git', 'index'));
    const index = await request(url).get(`${route}/index`).expect(200);
    expect(index.body.data).toEqual({ paths: ['.agent-platform/retained.txt'] });
    expect(readFileSync(join(repo, '.git', 'index'))).toEqual(originalIndex);
    expect(JSON.stringify(index.body)).not.toContain('private fixture contents');
    expect(JSON.stringify(index.body)).not.toContain(repo);
    const prepared = await request(url)
      .post(route)
      .send({
        action: {
          kind: 'commit',
          paths: index.body.data.paths,
          message: 'Reviewed hidden file',
        },
      })
      .expect(200);
    const done = await execute(prepared.body.data.id);
    expect(done.body.data.state).toBe('succeeded');
    expect(git(repo, ['log', '-1', '--format=%s'])).toBe('Reviewed hidden file');
    expect((await request(url).get(`${route}/index`).expect(200)).body.data.paths).toEqual([]);
    expect(readFileSync(join(repo, 'file.txt'), 'utf8')).toBe('changed');
  });
  it('refuses oversized complete-index disclosure rather than truncating it', async () => {
    for (let i = 0; i < 501; i++) writeFileSync(join(repo, `staged-${i}.txt`), 'fixture');
    git(repo, ['add', '--', '.']);
    const original = readFileSync(join(repo, '.git', 'index'));
    const response = await request(url).get(`${route}/index`).expect(409);
    expect(response.body.error.code).toBe('GIT_DELIVERY_INDEX_LIMIT');
    expect(response.body.data).toBeUndefined();
    expect(readFileSync(join(repo, '.git', 'index'))).toEqual(original);
  });
  it('disables legacy ordinary write endpoints even with forged confirmation', async () => {
    const oldBase = route.replace('/delivery', '');
    for (const endpoint of ['stage', 'unstage', 'commit', 'push', 'publish']) {
      const response = await request(url)
        .post(`${oldBase}/${endpoint}`)
        .send({ paths: ['file.txt'], message: 'no bypass', confirmed: true })
        .expect(410);
      expect(response.body.error.code).toBe('PROJECT_GIT_PREPARE_REQUIRED');
    }
    expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('');
    expect(git(repo, ['log', '-1', '--format=%s'])).toBe('initial');
  });
  it('does not let the conflict commit route bypass ordinary commit review', async () => {
    git(repo, ['add', '--', 'file.txt']);
    const index = git(repo, ['write-tree']);
    const head = git(repo, ['rev-parse', 'HEAD']);
    const response = await request(url)
      .post(`${route.replace('/delivery', '')}/conflicts/commit`)
      .send({ message: 'bypass', push: false })
      .expect(409);
    expect(response.body.error.code).toBe('PROJECT_GIT_MERGE_REQUIRED');
    expect(git(repo, ['write-tree'])).toBe(index);
    expect(git(repo, ['rev-parse', 'HEAD'])).toBe(head);
  });
  it.each([
    { action: { ...stage, root: '/outside' } },
    { action: { ...stage, executable: '/bin/sh' } },
    { action: stage, projectId: 'forged' },
    { action: stage, source: 'chat' },
    { action: stage, approvalRequestId: 'forged' },
  ])('rejects caller authority and command configuration %j', async (body) => {
    await request(url).post(route).send(body).expect(400);
    expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('');
  });
  it('rejects cross-project/forged IDs and extra execute flags without effects', async () => {
    const prepared = await prepare();
    await request(url)
      .post(`${route}/${prepared.id}/execute`)
      .send({ confirmed: true, root: repo })
      .expect(400);
    await request(url)
      .post(`${route}/${randomUUID()}/execute`)
      .send({ confirmed: true })
      .expect(404);
    const another = createProject(opened.db, {
      name: 'Another',
      metadata: {
        backendProjectRoot: repo,
        repositoryRoot: repo,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
      },
    });
    await request(url)
      .post(`/v1/projects/${another.id}/git/delivery/${prepared.id}/execute`)
      .send({ confirmed: true })
      .expect(404);
    expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('');
  });
  it('applies current policy at HTTP execution and cancellation/deletion never execute or resurrect work', async () => {
    const prepared = await prepare();
    updateSettings(opened.db, { executionPolicy: { gitMutation: 'block' } });
    expect((await execute(prepared.id)).body.data.state).toBe('denied');
    await request(url).delete(`${route}/${prepared.id}`).send({ confirmed: true }).expect(200);
    await request(url)
      .post(`${route}/${prepared.id}/execute`)
      .send({ confirmed: true })
      .expect(404);
    updateSettings(opened.db, { executionPolicy: { gitMutation: 'ask' } });
    const next = await prepare();
    expect(
      (await request(url).post(`${route}/${next.id}/cancel`).send({}).expect(200)).body.data.state,
    ).toBe('cancelled');
    expect((await execute(next.id)).body.data.state).toBe('cancelled');
    expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('');
  });
  it('returns the complete actual staged paths for disclosure, including previously excluded paths', async () => {
    const prepared = await prepare();
    await execute(prepared.id);
    mkdirSync(join(repo, '.agent-platform'));
    writeFileSync(join(repo, '.agent-platform/retained.txt'), 'private content not in error');
    git(repo, ['add', '.agent-platform/retained.txt']);
    const response = await request(url)
      .post(route)
      .send({ action: { kind: 'commit', message: 'reviewed', paths: ['file.txt'] } })
      .expect(409);
    expect(response.body.error.details.stagedPaths).toEqual([
      '.agent-platform/retained.txt',
      'file.txt',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('private content');
    expect(JSON.stringify(response.body)).not.toContain(repo);
    expect(git(repo, ['rev-list', '--count', 'HEAD'])).toBe('1');
  });
  it('requires explicit human acknowledgement before fresh preparation after unknown, without changing it to success', async () => {
    const prepared = await prepare();
    const row = getGitDeliveryOperation(opened.db, prepared.id)!;
    transitionGitDeliveryOperation(opened.db, prepared.id, 'prepared', {
      ...row.receipt,
      state: 'unknown',
    });
    expect(
      (await request(url).post(`${route}/${prepared.id}/reconcile`).send({}).expect(200)).body.data
        .state,
    ).toBe('unknown');
    await request(url).post(route).send({ action: stage }).expect(409);
    await request(url)
      .post(`${route}/${prepared.id}/acknowledge`)
      .send({ confirmed: false })
      .expect(400);
    await request(url).delete(`${route}/${prepared.id}`).send({ confirmed: true }).expect(409);
    const ack = await request(url)
      .post(`${route}/${prepared.id}/acknowledge`)
      .send({ confirmed: true })
      .expect(200);
    expect(ack.body.data.state).toBe('unknown');
    expect((await prepare()).review.warning).toContain('may duplicate');
  });
  it('aborts owned hook descendants on client disconnect and retains a safe unknown outcome', async () => {
    const staged = await prepare();
    await execute(staged.id);
    const marker = join(directory, 'started');
    const late = join(directory, 'late');
    writeFileSync(
      join(repo, '.git/hooks/pre-commit'),
      `#!/bin/sh\nprintf started > '${marker}'\n(sleep 1; printf secret > '${late}') &\nprintf 'secret hook data' >&2\nsleep 3\n`,
    );
    chmodSync(join(repo, '.git/hooks/pre-commit'), 0o755);
    const prepared = (
      await request(url)
        .post(route)
        .send({ action: { kind: 'commit', message: 'slow', paths: ['file.txt'] } })
        .expect(200)
    ).body.data as GitDeliveryReceipt;
    const controller = new AbortController();
    const pending = fetch(`${url}${route}/${prepared.id}/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
      signal: controller.signal,
    }).catch(() => undefined);
    const deadline = Date.now() + 4000;
    while (!existsSync(marker) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(existsSync(marker)).toBe(true);
    await request(url).get('/health').expect(200);
    controller.abort();
    await pending;
    while (
      getGitDeliveryOperation(opened.db, prepared.id)?.receipt.state === 'executing' &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 10));
    const response = await request(url).get(`${route}/${prepared.id}`).expect(200);
    expect(response.body.data.state).toBe('unknown');
    expect(JSON.stringify(response.body)).not.toContain('secret hook data');
    expect(JSON.stringify(response.body)).not.toContain(directory);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(existsSync(late)).toBe(false);
    expect(git(repo, ['rev-list', '--count', 'HEAD'])).toBe('1');
    expect(readFileSync(join(repo, 'file.txt'), 'utf8')).toBe('changed');
  });
});
