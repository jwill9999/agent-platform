import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeDatabase,
  createSession,
  listProjects,
  openDatabase,
  replaceAgent,
} from '@agent-platform/db';
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
        onboardingState: 'in_progress',
        defaultAgentProfile: 'coding',
        onboardingAssessment: expect.objectContaining({
          status: 'in_progress',
          profile: expect.any(String),
          gaps: expect.arrayContaining([expect.objectContaining({ kind: 'missing_instructions' })]),
          display: expect.not.objectContaining({ relativePath: '/workspace' }),
        }),
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

  it('registers a trusted desktop project with a safe response and stable reopen semantics', async () => {
    const repoDir = path.join(tmpDir, 'desktop-repo');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'desktop project\n');
    const repoRealPath = realpathSync(repoDir);

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Repo' })
      .expect(201);

    expect(registered.body.data).toMatchObject({
      created: true,
      project: {
        name: 'Desktop Repo',
        workspacePath: expect.stringMatching(/^projects\/desktop-repo-[a-f0-9]{8}$/),
        metadata: {
          source: 'desktop',
          folderName: 'desktop-repo',
          capabilityState: 'backend_accessible',
          onboardingState: 'in_progress',
          defaultAgentProfile: 'coding',
          activeBranch: 'main',
          instructionFileCount: 0,
        },
      },
    });
    expect(registered.body.data.project).not.toHaveProperty('workspaceKey');
    expect(JSON.stringify(registered.body.data)).not.toContain(repoRealPath);

    const persisted = listProjects(opened.db, { includeArchived: true }).find(
      (project) => project.id === registered.body.data.project.id,
    );
    expect(persisted).toMatchObject({
      workspaceKey: expect.stringMatching(/^desktop:[a-f0-9]{64}$/),
      metadata: expect.objectContaining({
        backendProjectRoot: repoRealPath,
        repositoryRoot: repoRealPath,
        source: 'desktop',
      }),
    });

    const selectedAgain = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Repo Renamed' })
      .expect(200);

    expect(selectedAgain.body.data).toMatchObject({
      created: false,
      project: {
        id: registered.body.data.project.id,
        name: 'Desktop Repo Renamed',
      },
    });
    expect(JSON.stringify(selectedAgain.body.data)).not.toContain(repoRealPath);
  });

  it('lists Project branches and switches clean Git-backed Projects', async () => {
    const repoDir = path.join(tmpDir, 'desktop-branches-repo');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['switch', '-c', 'feature/chat-input-branch'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'feature\n');
    execFileSync(GIT_BINARY, ['commit', '-am', 'feature'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['switch', 'main'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Branches Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const branches = await request(app).get(`/v1/projects/${projectId}/branches`).expect(200);
    expect(branches.body.data).toMatchObject({
      currentBranch: 'main',
      clean: true,
      branches: expect.arrayContaining([
        { name: 'main', current: true },
        { name: 'feature/chat-input-branch', current: false },
      ]),
    });

    const switched = await request(app)
      .post(`/v1/projects/${projectId}/branches/checkout`)
      .send({ branch: 'feature/chat-input-branch' })
      .expect(200);

    expect(switched.body.data).toMatchObject({
      metadata: {
        activeBranch: 'feature/chat-input-branch',
      },
    });
    expect(
      execFileSync(GIT_BINARY, ['branch', '--show-current'], {
        cwd: repoDir,
        encoding: 'utf8',
      }).trim(),
    ).toBe('feature/chat-input-branch');
  });

  it('summarizes local Project Git status for the Git and GitHub panel', async () => {
    const repoDir = path.join(tmpDir, 'desktop-git-status-repo');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', 'git@github.com:user/repo.git'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'modified\n');
    writeFileSync(path.join(repoDir, 'notes.md'), 'untracked\n');

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Git Status Repo' })
      .expect(201);

    const status = await request(app)
      .get(`/v1/projects/${registered.body.data.project.id}/git/status`)
      .expect(200);

    expect(status.body.data).toMatchObject({
      available: true,
      repositoryName: 'desktop-git-status-repo',
      remoteUrl: 'git@github.com:user/repo.git',
      currentBranch: 'main',
      clean: false,
      githubRemoteDetected: true,
      workingTree: expect.objectContaining({
        total: 2,
        modified: 1,
        untracked: 1,
      }),
      recentCommit: expect.objectContaining({
        subject: 'initial',
        authorName: 'Test User',
      }),
    });
  });

  it('lists changed files, returns diffs, and stages/unstages Project Git changes', async () => {
    const repoDir = path.join(tmpDir, 'desktop-git-changes-repo');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    writeFileSync(path.join(repoDir, 'remove-me.md'), 'delete me\n');
    execFileSync(GIT_BINARY, ['add', '.'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\nchanged\n');
    writeFileSync(path.join(repoDir, 'notes.md'), 'untracked\n');
    rmSync(path.join(repoDir, 'remove-me.md'), { force: true });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Git Changes Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const changes = await request(app).get(`/v1/projects/${projectId}/git/changes`).expect(200);
    expect(changes.body.data).toMatchObject({
      available: true,
      clean: false,
      workingTree: expect.objectContaining({
        total: 3,
        modified: 1,
        deleted: 1,
        untracked: 1,
      }),
      files: expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', status: 'modified', unstaged: true }),
        expect.objectContaining({ path: 'remove-me.md', status: 'deleted', unstaged: true }),
        expect.objectContaining({ path: 'notes.md', status: 'untracked', unstaged: true }),
      ]),
    });

    const diff = await request(app)
      .get(`/v1/projects/${projectId}/git/diff`)
      .query({ path: 'README.md', mode: 'unstaged' })
      .expect(200);
    expect(diff.body.data).toMatchObject({
      path: 'README.md',
      mode: 'unstaged',
      status: 'modified',
    });
    expect(diff.body.data.diff).toContain('+changed');

    const untrackedDiff = await request(app)
      .get(`/v1/projects/${projectId}/git/diff`)
      .query({ path: 'notes.md', mode: 'unstaged' })
      .expect(200);
    expect(untrackedDiff.body.data.diff).toContain('--- /dev/null');
    expect(untrackedDiff.body.data.diff).toContain('+untracked');

    const staged = await request(app)
      .post(`/v1/projects/${projectId}/git/stage`)
      .send({ paths: ['README.md'] })
      .expect(200);
    expect(staged.body.data.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'README.md', staged: true })]),
    );

    const unstaged = await request(app)
      .post(`/v1/projects/${projectId}/git/unstage`)
      .send({ paths: ['README.md'] })
      .expect(200);
    expect(unstaged.body.data.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', staged: false, unstaged: true }),
      ]),
    );

    const stageAll = await request(app)
      .post(`/v1/projects/${projectId}/git/stage`)
      .send({ all: true })
      .expect(200);
    expect(stageAll.body.data.workingTree.staged).toBe(3);

    const committed = await request(app)
      .post(`/v1/projects/${projectId}/git/commit`)
      .send({ message: 'update project docs' })
      .expect(200);

    expect(committed.body.data).toMatchObject({
      available: true,
      clean: true,
      recentCommit: expect.objectContaining({
        subject: 'update project docs',
        authorName: 'Test User',
      }),
      workingTree: expect.objectContaining({
        total: 0,
        staged: 0,
      }),
    });
    expect(
      execFileSync(GIT_BINARY, ['log', '-1', '--format=%s'], {
        cwd: repoDir,
        encoding: 'utf8',
      }).trim(),
    ).toBe('update project docs');
  });

  it('blocks Project branch switching when the working tree is dirty', async () => {
    const repoDir = path.join(tmpDir, 'desktop-dirty-branches-repo');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['branch', 'feature/clean-target'], { cwd: repoDir, stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'dirty\n');

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Dirty Branches Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const branches = await request(app).get(`/v1/projects/${projectId}/branches`).expect(200);
    expect(branches.body.data).toMatchObject({
      currentBranch: 'main',
      clean: false,
    });

    const response = await request(app)
      .post(`/v1/projects/${projectId}/branches/checkout`)
      .send({ branch: 'feature/clean-target' })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: 'PROJECT_BRANCH_DIRTY',
      message: 'Commit or stash local changes before switching branches.',
    });
    expect(
      execFileSync(GIT_BINARY, ['branch', '--show-current'], {
        cwd: repoDir,
        encoding: 'utf8',
      }).trim(),
    ).toBe('main');
  });

  it('creates and resumes a Project-bound session for a registered desktop project', async () => {
    const repoDir = path.join(tmpDir, 'desktop-session-repo');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'desktop project session\n');

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Session Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const created = await request(app)
      .post('/v1/sessions/project')
      .send({ agentId: 'agent-1', projectId })
      .expect(201);
    expect(created.body.data).toMatchObject({
      created: true,
      session: {
        agentId: 'agent-1',
        mode: 'project',
        projectId,
      },
    });

    const resumed = await request(app)
      .post('/v1/sessions/project')
      .send({ agentId: 'agent-1', projectId })
      .expect(200);
    expect(resumed.body.data).toMatchObject({
      created: false,
      session: {
        id: created.body.data.session.id,
        mode: 'project',
        projectId,
      },
    });

    const unscoped = await request(app)
      .post('/v1/sessions')
      .send({ agentId: 'agent-1' })
      .expect(201);
    expect(unscoped.body.data).toMatchObject({
      mode: 'chat',
      projectId: null,
    });
  });

  it('lists recent desktop projects with safe labels and unavailable state for moved folders', async () => {
    const firstRepo = path.join(tmpDir, 'desktop-recent-first');
    const secondRepo = path.join(tmpDir, 'desktop-recent-second');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', firstRepo], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', secondRepo], { stdio: 'ignore' });
    writeFileSync(path.join(firstRepo, 'README.md'), 'first desktop project\n');
    writeFileSync(path.join(secondRepo, 'README.md'), 'second desktop project\n');
    const firstRealPath = realpathSync(firstRepo);
    const secondRealPath = realpathSync(secondRepo);

    const first = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: firstRepo, name: 'First Desktop Project' })
      .expect(201);
    const second = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: secondRepo, name: 'Second Desktop Project' })
      .expect(201);

    rmSync(firstRepo, { recursive: true, force: true });

    const recent = await request(app).get('/v1/projects/desktop/recent').expect(200);
    expect(recent.body.data.projects.map((project: { id: string }) => project.id)).toEqual([
      second.body.data.project.id,
      first.body.data.project.id,
    ]);
    expect(recent.body.data.projects).toEqual([
      expect.objectContaining({
        id: second.body.data.project.id,
        metadata: expect.objectContaining({
          source: 'desktop',
          folderName: 'desktop-recent-second',
          capabilityState: 'backend_accessible',
        }),
      }),
      expect.objectContaining({
        id: first.body.data.project.id,
        metadata: expect.objectContaining({
          source: 'desktop',
          folderName: 'desktop-recent-first',
          capabilityState: 'unavailable',
        }),
      }),
    ]);
    expect(recent.body.data.projects[0]).not.toHaveProperty('workspaceKey');
    expect(JSON.stringify(recent.body.data)).not.toContain(firstRealPath);
    expect(JSON.stringify(recent.body.data)).not.toContain(secondRealPath);

    await request(app).delete(`/v1/projects/${second.body.data.project.id}`).expect(204);

    const afterForget = await request(app).get('/v1/projects/desktop/recent').expect(200);
    expect(afterForget.body.data.projects.map((project: { id: string }) => project.id)).toEqual([
      first.body.data.project.id,
    ]);
  });

  it('serves desktop project file trees and text reads without exposing host paths', async () => {
    const repoDir = path.join(tmpDir, 'desktop-files-project');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    mkdirSync(path.join(repoDir, 'src'), { recursive: true });
    mkdirSync(path.join(repoDir, 'node_modules', 'hidden-package'), { recursive: true });
    writeFileSync(path.join(repoDir, 'README.md'), '# Desktop files\n');
    writeFileSync(path.join(repoDir, 'src', 'index.ts'), 'export const value = 1;\n');
    writeFileSync(path.join(repoDir, 'node_modules', 'hidden-package', 'index.js'), 'hidden\n');
    const realRoot = realpathSync(repoDir);

    const openedProject = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Files Project' })
      .expect(201);
    const projectId = openedProject.body.data.project.id;

    const tree = await request(app).get(`/v1/projects/${projectId}/files/tree`).expect(200);
    expect(tree.body.data.rootName).toBe('desktop-files-project');
    expect(tree.body.data.files).toEqual([
      expect.objectContaining({
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [expect.objectContaining({ name: 'index.ts', path: 'src/index.ts' })],
      }),
      expect.objectContaining({ name: 'README.md', path: 'README.md', type: 'file' }),
    ]);
    expect(JSON.stringify(tree.body.data)).not.toContain(realRoot);
    expect(JSON.stringify(tree.body.data)).not.toContain('node_modules');

    const read = await request(app)
      .get(`/v1/projects/${projectId}/files/read`)
      .query({ path: 'src/index.ts' })
      .expect(200);
    expect(read.body.data).toMatchObject({
      name: 'index.ts',
      path: 'src/index.ts',
      content: 'export const value = 1;\n',
      size: 24,
    });
    expect(JSON.stringify(read.body.data)).not.toContain(realRoot);
  });

  it('blocks project file traversal, symlink escapes, binary files, and oversized files', async () => {
    const repoDir = path.join(tmpDir, 'desktop-files-guarded');
    const outsideDir = path.join(tmpDir, 'outside');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(path.join(outsideDir, 'secret.txt'), 'outside secret\n');
    writeFileSync(path.join(repoDir, 'binary.bin'), Buffer.from([0x41, 0x00, 0x42]));
    writeFileSync(path.join(repoDir, 'large.txt'), 'x'.repeat(512 * 1024 + 1));
    symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(repoDir, 'secret-link.txt'));

    const openedProject = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Guarded Desktop Files' })
      .expect(201);
    const projectId = openedProject.body.data.project.id;

    await request(app)
      .get(`/v1/projects/${projectId}/files/read`)
      .query({ path: '../outside/secret.txt' })
      .expect(403);
    await request(app)
      .get(`/v1/projects/${projectId}/files/read`)
      .query({ path: 'secret-link.txt' })
      .expect(403);
    await request(app)
      .get(`/v1/projects/${projectId}/files/read`)
      .query({ path: 'binary.bin' })
      .expect(415);
    await request(app)
      .get(`/v1/projects/${projectId}/files/read`)
      .query({ path: 'large.txt' })
      .expect(413);
  });

  it('rejects desktop project registration without the desktop bridge or inspectable folder', async () => {
    await request(app)
      .post('/v1/projects/desktop/register')
      .send({ path: tmpDir, name: 'Untrusted Desktop Repo' })
      .expect(403);

    const missingPath = path.join(tmpDir, 'missing-desktop-project');
    const unavailable = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: missingPath, name: 'Missing Desktop Repo' })
      .expect(422);

    expect(unavailable.body.error).toMatchObject({
      code: 'PROJECT_UNAVAILABLE',
      message:
        'This Project folder could not be opened. Choose a folder you can access and try again.',
      details: {
        capabilityState: 'unavailable',
      },
    });
    expect(unavailable.body.error.message).not.toMatch(/backend|inspect|path/i);
    expect(JSON.stringify(unavailable.body.error)).not.toContain(missingPath);
  });

  it('tracks AGENTS.md onboarding state and approval metadata', async () => {
    const repoDir = path.join(tmpDir, 'repo-with-agents');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    mkdirSync(path.join(repoDir, 'apps', 'web'), { recursive: true });
    writeFileSync(path.join(repoDir, 'AGENTS.md'), 'root instructions\n');
    writeFileSync(path.join(repoDir, 'apps', 'web', 'AGENTS.md'), 'web instructions\n');

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Repo With Agents' })
      .expect(201);

    expect(openedProject.body.data.metadata).toMatchObject({
      onboardingState: 'in_progress',
      onboardingAssessment: expect.objectContaining({
        status: 'in_progress',
        gaps: expect.arrayContaining([expect.objectContaining({ kind: 'stale_instructions' })]),
        questions: expect.any(Array),
      }),
      instructionFiles: expect.arrayContaining([
        expect.objectContaining({ scope: 'root', path: 'AGENTS.md' }),
        expect.objectContaining({
          scope: 'nested',
          path: 'apps/web/AGENTS.md',
          appliesToPath: 'apps/web',
        }),
      ]),
    });

    await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/approve`)
      .send({})
      .expect(409);

    writeFileSync(
      path.join(repoDir, 'AGENTS.md'),
      [
        '# Agent Instructions',
        '',
        'Use Beads for task tracking and keep Project work read-only until instructions are approved.',
        'Run build, typecheck, lint, tests, and docs quality gates before closing a ticket.',
        'Open a pull request and wait for CI, SonarCloud, GitGuardian, and review comments.',
      ].join('\n'),
    );
    const reassessed = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/assess`)
      .send({})
      .expect(200);

    expect(reassessed.body.data.metadata).toMatchObject({
      onboardingState: 'approved',
      onboardingApproval: expect.objectContaining({
        projectId: openedProject.body.data.id,
        targetPath: 'AGENTS.md',
        contentHash: expect.any(String),
        source: 'auto_assessment',
      }),
      instructionFiles: expect.arrayContaining([
        expect.objectContaining({
          scope: 'root',
          path: 'AGENTS.md',
          approvedAtMs: expect.any(Number),
        }),
      ]),
    });

    const unchanged = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Repo With Agents' })
      .expect(200);
    expect(unchanged.body.data.metadata.onboardingState).toBe('approved');

    writeFileSync(path.join(repoDir, 'AGENTS.md'), 'updated root instructions\n');
    const changed = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Repo With Agents' })
      .expect(200);
    expect(changed.body.data.metadata.onboardingState).toBe('needs_review');
  });

  it('refuses AGENTS.md approval when the root instruction file is missing', async () => {
    const repoDir = path.join(tmpDir, 'repo-without-agents');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Repo Without Agents' })
      .expect(201);

    expect(openedProject.body.data.metadata).toMatchObject({
      onboardingState: 'in_progress',
      instructionFiles: [],
      onboardingAssessment: expect.objectContaining({
        status: 'in_progress',
        gaps: expect.arrayContaining([expect.objectContaining({ kind: 'missing_instructions' })]),
      }),
    });

    await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/approve`)
      .send({})
      .expect(409);
  });

  it('drafts updates for existing AGENTS.md without discarding the current instructions', async () => {
    const repoDir = path.join(tmpDir, 'repo-with-thin-agents');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'AGENTS.md'), 'thin instructions\n');
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        name: 'thin-agents-project',
        scripts: { test: 'vitest' },
      }),
    );

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Thin Agents Project' })
      .expect(201);

    const started = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    const draftMarkdown = started.body.data.metadata.onboardingDraft.markdown as string;
    expect(draftMarkdown).toContain('thin instructions');
    expect(draftMarkdown).toContain('<!-- agent-platform:onboarding-update:start -->');
    expect(draftMarkdown).toContain('## Proposed Agent Platform Updates');
    expect(draftMarkdown).toContain('npm run test');
    expect(readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8')).toBe('thin instructions\n');

    const approved = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/approve`)
      .send({ reviewer: 'Test reviewer' })
      .expect(200);

    const approvedContent = readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
    expect(approvedContent).toBe(approved.body.data.metadata.onboardingDraft.markdown);
    expect(approvedContent).toContain('thin instructions');
    expect(approvedContent).toContain('## Proposed Agent Platform Updates');
  });

  it('uses npm commands in onboarding drafts for npm Projects', async () => {
    const repoDir = path.join(tmpDir, 'repo-with-npm-lock');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        name: 'npm-project',
        scripts: { build: 'tsc', test: 'vitest', lint: 'eslint .' },
      }),
    );
    writeFileSync(path.join(repoDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));
    writeFileSync(path.join(repoDir, 'README.md'), 'Run npm commands for this project.\n');

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'NPM Project' })
      .expect(201);

    const started = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    const draftMarkdown = started.body.data.metadata.onboardingDraft.markdown as string;
    expect(draftMarkdown).toContain('npm run test');
    expect(draftMarkdown).toContain('npm run build');
    expect(draftMarkdown).not.toContain('pnpm test');
    expect(draftMarkdown).not.toContain('pnpm build');
  });

  it('drafts useful baseline instructions for a simple static HTML Project', async () => {
    const repoDir = path.join(tmpDir, 'static-html-project');
    mkdirSync(repoDir, { recursive: true });
    writeFileSync(path.join(repoDir, 'index.html'), '<h1>Chocolate shop</h1>\n');

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Static HTML Project' })
      .expect(201);

    const started = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    const draftMarkdown = started.body.data.metadata.onboardingDraft.markdown as string;
    expect(draftMarkdown).toContain('index.html (source)');
    expect(draftMarkdown).toContain('Follow existing files and local project conventions first.');
    expect(draftMarkdown).not.toContain('No project evidence files were discovered');
    expect(draftMarkdown).not.toContain('write-capable Project work');
    expect(draftMarkdown).not.toContain('approval of generated instructions remain blocked');
  });

  it('refreshes an existing onboarding draft from current Project evidence', async () => {
    const repoDir = path.join(tmpDir, 'repo-package-manager-refresh');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        name: 'package-manager-refresh',
        scripts: { build: 'tsc', test: 'vitest' },
      }),
    );
    writeFileSync(path.join(repoDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Package Manager Refresh' })
      .expect(201);

    const firstDraft = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    expect(firstDraft.body.data.metadata.onboardingDraft).toMatchObject({
      revision: 1,
      markdown: expect.stringContaining('pnpm test'),
    });

    rmSync(path.join(repoDir, 'pnpm-lock.yaml'), { force: true });
    writeFileSync(path.join(repoDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));

    const refreshedDraft = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    const refreshedMarkdown = refreshedDraft.body.data.metadata.onboardingDraft.markdown as string;
    expect(refreshedDraft.body.data.metadata.onboardingDraft).toMatchObject({
      revision: 2,
      history: [expect.objectContaining({ revision: 1 })],
    });
    expect(refreshedMarkdown).toContain('npm run test');
    expect(refreshedMarkdown).toContain('npm run build');
    expect(refreshedMarkdown).not.toContain('pnpm test');
    expect(refreshedMarkdown).not.toContain('pnpm build');
  });

  it('rejects an onboarding draft without leaving stale instructions approvable', async () => {
    const repoDir = path.join(tmpDir, 'repo-reject-draft');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        name: 'reject-draft',
        scripts: { test: 'vitest' },
      }),
    );

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Reject Draft' })
      .expect(201);

    await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    const rejected = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/review`)
      .send({
        decision: 'reject',
        reviewer: 'Test reviewer',
        comment: 'Use different commands.',
      })
      .expect(200);

    expect(rejected.body.data.metadata).toMatchObject({
      onboardingState: 'in_progress',
      onboardingReview: expect.objectContaining({
        decision: 'reject',
        reviewer: 'Test reviewer',
      }),
    });
    expect(rejected.body.data.metadata.onboardingDraft).toBeUndefined();
    expect(existsSync(path.join(repoDir, 'AGENTS.md'))).toBe(false);
  });

  it('refuses approved AGENTS.md writes through a symlink outside the Project root', async () => {
    const repoDir = path.join(tmpDir, 'repo-with-symlinked-agents');
    const outsideDir = path.join(tmpDir, 'outside-root');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    mkdirSync(outsideDir, { recursive: true });
    const outsideInstructions = path.join(outsideDir, 'AGENTS.md');
    writeFileSync(outsideInstructions, 'outside instructions\n');
    symlinkSync(outsideInstructions, path.join(repoDir, 'AGENTS.md'));

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Symlinked Agents Project' })
      .expect(201);

    await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/approve`)
      .send({ reviewer: 'Test reviewer' })
      .expect(403);

    expect(readFileSync(outsideInstructions, 'utf8')).toBe('outside instructions\n');
  });

  it('stores onboarding dialogue answers, reviews feedback, and finalizes an approved draft', async () => {
    const repoDir = path.join(tmpDir, 'repo-needing-dialogue');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        name: 'dialogue-project',
        scripts: { build: 'tsc', test: 'vitest', lint: 'eslint .' },
      }),
    );
    writeFileSync(path.join(repoDir, 'README.md'), 'mixed project\n');

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Dialogue Project' })
      .expect(201);

    const started = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/draft`)
      .send({})
      .expect(200);

    expect(started.body.data.metadata).toMatchObject({
      onboardingState: 'in_progress',
      onboardingDialogue: expect.objectContaining({
        status: 'asking',
        activeQuestionId: expect.any(String),
        turns: [expect.objectContaining({ role: 'assistant' })],
      }),
      onboardingDraft: expect.objectContaining({
        targetPath: 'AGENTS.md',
        revision: 1,
        markdown: expect.stringContaining('# Agent Instructions'),
      }),
    });
    expect(started.body.data.metadata.onboardingDraft.markdown).toContain('Dialogue Project');
    expect(started.body.data.metadata.onboardingDraft.markdown).toContain('npm run test');

    const answered = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/answer`)
      .send({
        questionId: started.body.data.metadata.onboardingDialogue.activeQuestionId,
        answer: 'This project mixes code changes and documentation updates.',
      })
      .expect(200);

    expect(answered.body.data.metadata).toMatchObject({
      onboardingState: 'in_progress',
      onboardingDialogue: expect.objectContaining({
        answeredQuestionIds: expect.arrayContaining([
          started.body.data.metadata.onboardingDialogue.activeQuestionId,
        ]),
        turns: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'This project mixes code changes and documentation updates.',
          }),
        ]),
      }),
      onboardingDraft: expect.objectContaining({
        revision: 2,
        history: [expect.objectContaining({ revision: 1 })],
        markdown: expect.stringContaining(
          'This project mixes code changes and documentation updates.',
        ),
      }),
    });

    const requestedChanges = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/review`)
      .send({
        decision: 'request_changes',
        reviewer: 'Test reviewer',
        comment: 'Clarify that documentation updates are in scope.',
      })
      .expect(200);

    expect(requestedChanges.body.data.metadata).toMatchObject({
      onboardingState: 'in_progress',
      onboardingReview: expect.objectContaining({
        decision: 'request_changes',
        reviewer: 'Test reviewer',
      }),
      onboardingDialogue: expect.objectContaining({
        turns: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Clarify that documentation updates are in scope.',
          }),
        ]),
      }),
    });
    expect(existsSync(path.join(repoDir, 'AGENTS.md'))).toBe(false);

    const approved = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/approve`)
      .send({ reviewer: 'Test reviewer', comment: 'Draft looks ready.' })
      .expect(200);

    expect(readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8')).toBe(
      approved.body.data.metadata.onboardingDraft.markdown,
    );
    expect(approved.body.data.metadata).toMatchObject({
      onboardingState: 'approved',
      onboardingApproval: expect.objectContaining({
        projectId: openedProject.body.data.id,
        targetPath: 'AGENTS.md',
        contentHash: expect.any(String),
        reviewer: 'Test reviewer',
        source: 'manual_review',
        comment: 'Draft looks ready.',
      }),
      instructionFiles: expect.arrayContaining([
        expect.objectContaining({
          scope: 'root',
          path: 'AGENTS.md',
          approvedAtMs: expect.any(Number),
        }),
      ]),
    });
  });

  it('opens a plain folder without git metadata and omits unknown branch display data', async () => {
    const folderDir = path.join(tmpDir, 'plain-folder');
    mkdirSync(folderDir, { recursive: true });
    writeFileSync(path.join(folderDir, 'README.md'), 'plain workspace\n');

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: folderDir, name: 'Plain Folder' })
      .expect(201);

    expect(openedProject.body.data.metadata).toMatchObject({
      backendProjectRoot: realpathSync(folderDir),
      capabilityState: 'backend_accessible',
      onboardingState: 'in_progress',
      onboardingAssessment: expect.objectContaining({
        status: 'in_progress',
        display: expect.not.objectContaining({ branchLabel: expect.anything() }),
      }),
    });

    const status = await request(app)
      .get(`/v1/projects/${openedProject.body.data.id}/git/status`)
      .expect(200);
    expect(status.body.data).toMatchObject({
      available: false,
      reason: 'Project is not a Git repository.',
      clean: true,
    });
  });

  it('refreshes Project Git metadata when a plain folder becomes a Git repo', async () => {
    const folderDir = path.join(tmpDir, 'plain-to-git-folder');
    mkdirSync(folderDir, { recursive: true });
    writeFileSync(path.join(folderDir, 'README.md'), 'plain workspace\n');

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: folderDir, name: 'Plain To Git Folder' })
      .expect(201);

    expect(openedProject.body.data.metadata.activeBranch).toBeUndefined();
    await request(app).get(`/v1/projects/${openedProject.body.data.id}/branches`).expect(409);

    execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: folderDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: folderDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: folderDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: folderDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: folderDir, stdio: 'ignore' });

    const refreshed = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/refresh`)
      .send({})
      .expect(200);

    expect(refreshed.body.data.metadata.activeBranch).toBe('main');
    const branches = await request(app)
      .get(`/v1/projects/${openedProject.body.data.id}/branches`)
      .expect(200);
    expect(branches.body.data).toMatchObject({
      currentBranch: 'main',
      clean: true,
      branches: [{ name: 'main', current: true }],
    });
  });

  it('auto-approves sufficient existing AGENTS.md instructions during assessment', async () => {
    const repoDir = path.join(tmpDir, 'repo-with-sufficient-agents');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(
      path.join(repoDir, 'AGENTS.md'),
      [
        '# Agent Instructions',
        '',
        'Use Beads for task tracking and keep Project work read-only until instructions are approved.',
        'Run build, typecheck, lint, tests, and docs quality gates before closing a ticket.',
        'Open a pull request and wait for CI, SonarCloud, GitGuardian, and review comments.',
      ].join('\n'),
    );
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        name: 'sufficient-project',
        scripts: { build: 'tsc', test: 'vitest', lint: 'eslint .' },
      }),
    );

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Sufficient Repo' })
      .expect(201);

    expect(openedProject.body.data.metadata).toMatchObject({
      onboardingState: 'approved',
      onboardingAssessment: expect.objectContaining({
        status: 'approved',
        profile: 'coding',
        commands: expect.arrayContaining([
          expect.objectContaining({ kind: 'build' }),
          expect.objectContaining({ kind: 'test' }),
          expect.objectContaining({ kind: 'lint' }),
        ]),
      }),
      instructionFiles: expect.arrayContaining([
        expect.objectContaining({
          scope: 'root',
          path: 'AGENTS.md',
          approvedAtMs: expect.any(Number),
        }),
      ]),
      onboardingApproval: expect.objectContaining({
        projectId: openedProject.body.data.id,
        targetPath: 'AGENTS.md',
        contentHash: expect.any(String),
        source: 'auto_assessment',
      }),
    });
  });

  it('batches closeout instruction updates and applies or rejects reviewable candidates', async () => {
    const repoDir = path.join(tmpDir, 'repo-with-closeout-updates');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(
      path.join(repoDir, 'AGENTS.md'),
      [
        '# Agent Instructions',
        '',
        'Use Beads for task tracking and keep Project work read-only until instructions are approved.',
        'Run build, typecheck, lint, tests, and docs quality gates before closing a ticket.',
        'Open a pull request and wait for CI, SonarCloud, GitGuardian, and review comments.',
      ].join('\n'),
    );

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Closeout Repo' })
      .expect(201);

    const collected = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/instruction-updates/candidates`)
      .send({
        candidates: [
          {
            summary: 'Use pnpm --filter @agent-platform/api test for focused API tests.',
            proposedMarkdown:
              '- Focused API tests: pnpm --filter @agent-platform/api test -- <test-file>',
            source: 'closeout',
            risk: 'low_risk_fact',
            evidence: [{ path: 'package.json', kind: 'manifest' }],
          },
          {
            summary: 'Remove user-authored workflow guidance.',
            source: 'closeout',
            risk: 'policy_change',
          },
        ],
      })
      .expect(200);

    expect(collected.body.data.metadata.instructionUpdateCandidates).toHaveLength(2);

    const proposed = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/instruction-updates/closeout`)
      .send({})
      .expect(200);
    const candidates = proposed.body.data.metadata.instructionUpdateCandidates;
    expect(proposed.body.data.metadata.instructionUpdateProposal).toMatchObject({
      status: 'ready',
      policy: 'relaxed_reviewable',
      candidateIds: [candidates[0].id],
    });
    expect(candidates[0]).toMatchObject({ status: 'proposed' });
    expect(candidates[1]).toMatchObject({ status: 'pending', risk: 'policy_change' });

    const applied = await request(app)
      .post(
        `/v1/projects/${openedProject.body.data.id}/instruction-updates/candidates/${candidates[0].id}/apply`,
      )
      .send({ reviewer: 'Test reviewer' })
      .expect(200);
    expect(applied.body.data.metadata.instructionUpdateCandidates[0]).toMatchObject({
      status: 'applied',
      reviewer: 'Test reviewer',
    });
    expect(readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8')).toContain(
      'Focused API tests: pnpm --filter @agent-platform/api test -- <test-file>',
    );

    const rejected = await request(app)
      .post(
        `/v1/projects/${openedProject.body.data.id}/instruction-updates/candidates/${candidates[1].id}/reject`,
      )
      .send({ reviewer: 'Test reviewer', comment: 'Policy changes need a separate review.' })
      .expect(200);
    expect(rejected.body.data.metadata.instructionUpdateCandidates[1]).toMatchObject({
      status: 'rejected',
      reviewer: 'Test reviewer',
      decisionComment: 'Policy changes need a separate review.',
    });
  });

  it('records refresh and rescan states while preserving mixed Project framing', async () => {
    const repoDir = path.join(tmpDir, 'repo-refresh-rescan');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    writeFileSync(
      path.join(repoDir, 'AGENTS.md'),
      [
        '# Agent Instructions',
        '',
        'Use Beads for task tracking and keep Project work read-only until instructions are approved.',
        'Run build, typecheck, lint, tests, and docs quality gates before closing a ticket.',
        'Open a pull request and wait for CI, SonarCloud, GitGuardian, and review comments.',
      ].join('\n'),
    );
    writeFileSync(path.join(repoDir, 'README.md'), 'docs\n');
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest' } }),
    );

    const openedProject = await request(app)
      .post('/v1/projects/open')
      .send({ path: repoDir, name: 'Refresh Repo' })
      .expect(201);
    expect(openedProject.body.data.metadata.onboardingAssessment.profile).toBe('mixed');

    const unchanged = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/refresh`)
      .send({})
      .expect(200);
    expect(unchanged.body.data.metadata.onboardingRefresh).toMatchObject({
      previousState: 'approved',
      nextState: 'approved',
      updateStatus: 'no_change',
      materialDrift: false,
    });

    writeFileSync(path.join(repoDir, 'AGENTS.md'), 'thin instructions\n');
    const drifted = await request(app)
      .post(`/v1/projects/${openedProject.body.data.id}/onboarding/refresh`)
      .send({})
      .expect(200);
    expect(drifted.body.data.metadata.onboardingState).toBe('approved');
    expect(drifted.body.data.metadata.onboardingApproval).toMatchObject({
      source: 'auto_assessment',
      targetPath: 'AGENTS.md',
    });
    expect(drifted.body.data.metadata.onboardingRefresh).toMatchObject({
      previousState: 'approved',
      nextState: 'needs_review',
      updateStatus: 'material_drift',
      materialDrift: true,
    });
    expect(drifted.body.data.metadata.instructionUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'refresh',
          status: 'pending',
          targetPath: 'AGENTS.md',
          risk: 'needs_review',
        }),
      ]),
    );
    expect(drifted.body.data.metadata.onboardingAssessment.profile).toBe('mixed');

    const missingInstructionsDir = path.join(tmpDir, 'repo-refresh-proposed-update');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', missingInstructionsDir], { stdio: 'ignore' });
    writeFileSync(path.join(missingInstructionsDir, 'README.md'), 'docs only\n');
    const missing = await request(app)
      .post('/v1/projects/open')
      .send({ path: missingInstructionsDir, name: 'Refresh Proposed Update Repo' })
      .expect(201);
    const proposedUpdate = await request(app)
      .post(`/v1/projects/${missing.body.data.id}/onboarding/refresh`)
      .send({})
      .expect(200);
    expect(proposedUpdate.body.data.metadata.onboardingRefresh).toMatchObject({
      previousState: 'in_progress',
      nextState: 'in_progress',
      updateStatus: 'proposed_update',
      materialDrift: false,
    });
    expect(proposedUpdate.body.data.metadata.instructionUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'refresh',
          status: 'pending',
          targetPath: 'AGENTS.md',
        }),
      ]),
    );
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
