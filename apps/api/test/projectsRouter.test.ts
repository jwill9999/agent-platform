import { execFileSync } from 'node:child_process';
import {
  chmodSync,
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
  CODING_PROJECT_WORKSPACE_CAPABILITIES,
  workspaceResourceUri,
} from '@agent-platform/contracts';
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
const EXPECTED_CODING_WORKSPACE_CAPABILITIES = expect.arrayContaining([
  ...CODING_PROJECT_WORKSPACE_CAPABILITIES,
]);

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
    delete process.env['AGENT_PLATFORM_GH_BINARY'];
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
        workspaceProfile: 'coding_project',
        workspaceCapabilities: EXPECTED_CODING_WORKSPACE_CAPABILITIES,
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
          workspaceProfile: 'coding_project',
          workspaceCapabilities: EXPECTED_CODING_WORKSPACE_CAPABILITIES,
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
        workspaceProfile: 'coding_project',
        workspaceCapabilities: EXPECTED_CODING_WORKSPACE_CAPABILITIES,
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
    mkdirSync(path.join(repoDir, '.agent-platform', 'browser', 'session-1'), { recursive: true });
    writeFileSync(
      path.join(repoDir, '.agent-platform', 'browser', 'session-1', 'artifact.json'),
      '{}\n',
    );

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
    });
    expect(branches.body.data.branches).toEqual(
      expect.arrayContaining([
        { name: 'main', current: true, upstreamState: 'none' },
        { name: 'feature/chat-input-branch', current: false, upstreamState: 'none' },
      ]),
    );

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

  it('labels Project branches whose configured upstream no longer exists', async () => {
    const remoteDir = path.join(tmpDir, 'desktop-stale-upstream-remote.git');
    const repoDir = path.join(tmpDir, 'desktop-stale-upstream-repo');
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['switch', '-c', 'stale/upstream'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'stale branch\n');
    execFileSync(GIT_BINARY, ['commit', '-am', 'stale branch'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'stale/upstream'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['update-ref', '-d', 'refs/heads/stale/upstream'], {
      cwd: remoteDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['fetch', '--prune'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Stale Upstream Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const branches = await request(app).get(`/v1/projects/${projectId}/branches`).expect(200);
    expect(branches.body.data).toMatchObject({
      currentBranch: 'stale/upstream',
      clean: true,
    });
    expect(branches.body.data.branches).toEqual(
      expect.arrayContaining([
        {
          name: 'main',
          current: false,
          upstreamBranch: 'origin/main',
          upstreamState: 'active',
        },
        {
          name: 'stale/upstream',
          current: true,
          upstreamBranch: 'origin/stale/upstream',
          upstreamState: 'missing',
        },
      ]),
    );

    const status = await request(app).get(`/v1/projects/${projectId}/git/status`).expect(200);
    expect(status.body.data).toMatchObject({
      currentBranch: 'stale/upstream',
      upstreamBranch: 'origin/stale/upstream',
      upstreamState: 'missing',
      clean: true,
    });

    const push = await request(app).post(`/v1/projects/${projectId}/git/push`).send({}).expect(409);
    expect(push.body.error).toMatchObject({
      code: 'PROJECT_GIT_UPSTREAM_MISSING',
    });
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
    mkdirSync(path.join(repoDir, '.agent-platform', 'browser', 'session-1'), { recursive: true });
    writeFileSync(
      path.join(repoDir, '.agent-platform', 'browser', 'session-1', 'artifact.json'),
      '{}\n',
    );

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
    mkdirSync(path.join(repoDir, '.agent-platform', 'browser', 'session-1'), { recursive: true });
    writeFileSync(
      path.join(repoDir, '.agent-platform', 'browser', 'session-1', 'artifact.json'),
      '{}\n',
    );
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
    expect(changes.body.data.files).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('.agent-platform') }),
      ]),
    );

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
    expect(
      execFileSync(GIT_BINARY, ['status', '--porcelain=v1', '--', '.agent-platform'], {
        cwd: repoDir,
        encoding: 'utf8',
      }).trim(),
    ).toBe('?? .agent-platform/');

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

  it('stashes selected Project Git files and validates repository-relative paths', async () => {
    const repoDir = path.join(tmpDir, 'desktop-git-stash-repo');
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
    writeFileSync(path.join(repoDir, 'server.log'), 'started\n');
    writeFileSync(path.join(repoDir, 'server.pid'), '12345\n');

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Git Stash Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    await request(app).post(`/v1/projects/${projectId}/git/stash`).send({ paths: [] }).expect(400);
    await request(app)
      .post(`/v1/projects/${projectId}/git/stash`)
      .send({ paths: ['../outside.log'] })
      .expect(400);

    const stashed = await request(app)
      .post(`/v1/projects/${projectId}/git/stash`)
      .send({ paths: ['server.log'] })
      .expect(200);

    expect(stashed.body.data.files).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'server.log' })]),
    );
    expect(stashed.body.data.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'server.pid' })]),
    );
    expect(existsSync(path.join(repoDir, 'server.log'))).toBe(false);
    expect(existsSync(path.join(repoDir, 'server.pid'))).toBe(true);
    expect(
      execFileSync(GIT_BINARY, ['stash', 'list', '--format=%s'], {
        cwd: repoDir,
        encoding: 'utf8',
      }),
    ).toContain('AI Studio: stash selected Project files');
  });

  it('reports unavailable GitHub checks when no GitHub remote is configured', async () => {
    const repoDir = path.join(tmpDir, 'desktop-git-checks-no-remote-repo');
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

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Git Checks No Remote Repo' })
      .expect(201);

    const checks = await request(app)
      .get(`/v1/projects/${registered.body.data.project.id}/git/checks`)
      .expect(200);

    expect(checks.body.data).toMatchObject({
      available: false,
      reason: 'No GitHub origin remote is configured for this Project.',
      githubRemoteDetected: false,
      ghAvailable: false,
      authenticated: false,
      summary: { total: 0 },
      checks: [],
    });
  });

  it('creates a GitHub repository for a local Project without an origin remote', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-create-repo');
    const remoteDir = path.join(tmpDir, 'created-remote.git');
    const ghLog = path.join(tmpDir, 'fake-gh-create.log');
    const ghBinary = path.join(tmpDir, 'fake-gh-create');
    writeFileSync(
      ghBinary,
      String.raw`#!/bin/sh
printf '%s\n' "$*" >> "${ghLog}"
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "Logged in to github.com"
  exit 0
fi
if [ "$1" = "repo" ] && [ "$2" = "create" ]; then
  git init --bare "${remoteDir}" >/dev/null 2>&1
  git -C "$PWD" remote add origin "${remoteDir}"
  git -C "$PWD" push -u origin main >/dev/null 2>&1
  echo "https://github.com/jwill9999/desktop-github-create-repo"
  exit 0
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;

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

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub Create Repo' })
      .expect(201);

    const created = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/git/github/create-repository`)
      .send({
        owner: 'jwill9999',
        name: 'desktop-github-create-repo',
        description: 'Created from AI Studio',
        visibility: 'private',
        pushCurrentBranch: true,
      })
      .expect(200);

    expect(created.body.data).toMatchObject({
      repositoryUrl: 'https://github.com/jwill9999/desktop-github-create-repo',
      remoteUrl: remoteDir,
      pushed: true,
      status: {
        currentBranch: 'main',
        upstreamBranch: 'origin/main',
        upstreamState: 'active',
        ahead: 0,
      },
    });
    expect(readFileSync(ghLog, 'utf8')).toContain(
      'repo create jwill9999/desktop-github-create-repo',
    );
  });

  it('connects an existing GitHub repository as origin and exposes pull state', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-connect-repo');
    const remoteDir = path.join(tmpDir, 'existing-remote.git');
    const seedDir = path.join(tmpDir, 'existing-seed');
    const ghLog = path.join(tmpDir, 'fake-gh-connect.log');
    const ghBinary = path.join(tmpDir, 'fake-gh-connect');
    writeFileSync(
      ghBinary,
      String.raw`#!/bin/sh
printf '%s\n' "$*" >> "${ghLog}"
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "Logged in to github.com"
  exit 0
fi
if [ "$1" = "repo" ] && [ "$2" = "view" ]; then
  echo "https://github.com/jwill9999/existing-repo"
  exit 0
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;

    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', seedDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: seedDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: seedDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(seedDir, 'README.md'), 'remote\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: seedDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'remote initial'], { cwd: seedDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: seedDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], { cwd: seedDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
      cwd: remoteDir,
      stdio: 'ignore',
    });

    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'local\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'local initial'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub Connect Repo' })
      .expect(201);

    const connected = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/git/github/connect-repository`)
      .send({
        repository: 'jwill9999/existing-repo',
        remoteUrl: remoteDir,
      })
      .expect(200);

    expect(connected.body.data).toMatchObject({
      repositoryUrl: 'https://github.com/jwill9999/existing-repo',
      remoteUrl: remoteDir,
      pushed: false,
      status: {
        currentBranch: 'main',
        upstreamBranch: 'origin/main',
        upstreamState: 'active',
        ahead: 1,
        behind: 1,
      },
    });
    expect(readFileSync(ghLog, 'utf8')).toContain('repo view jwill9999/existing-repo');
  });

  it('returns a clear error when GitHub CLI is missing for repository creation', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-create-missing-gh');
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
    process.env['AGENT_PLATFORM_GH_BINARY'] = path.join(tmpDir, 'missing-gh');

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Missing GH Repo' })
      .expect(201);

    const response = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/git/github/create-repository`)
      .send({
        owner: 'jwill9999',
        name: 'desktop-missing-gh',
        visibility: 'private',
        pushCurrentBranch: true,
      })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: 'PROJECT_GITHUB_CLI_UNAVAILABLE',
      message: 'GitHub CLI is not installed or is not available on PATH.',
    });
  });

  it('loads GitHub checks for the current branch pull request', async () => {
    const repoDir = path.join(tmpDir, 'desktop-git-checks-repo');
    const ghBinary = path.join(tmpDir, 'fake-gh');
    writeFileSync(
      ghBinary,
      String.raw`#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "Logged in to github.com"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  printf '%s\n' '{"number":42,"url":"https://github.com/user/repo/pull/42","statusCheckRollup":[{"databaseId":101,"name":"CI","displayTitle":"Build and test","workflowName":"CI","status":"COMPLETED","conclusion":"SUCCESS","startedAt":"2026-05-16T15:55:00Z","completedAt":"2026-05-16T15:58:00Z","detailsUrl":"https://github.com/user/repo/actions/runs/101"},{"databaseId":102,"name":"Lint","workflowName":"Lint","status":"COMPLETED","conclusion":"FAILURE","startedAt":"2026-05-16T15:56:00Z","completedAt":"2026-05-16T15:59:00Z","detailsUrl":"https://github.com/user/repo/actions/runs/102"}]}'
  exit 0
fi
if [ "$1" = "run" ]; then
  echo "unexpected broad workflow history call" >&2
  exit 12
fi
if [ "$1" = "api" ]; then
  echo "unexpected head checks fallback" >&2
  exit 12
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;

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

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Git Checks Repo' })
      .expect(201);

    const checks = await request(app)
      .get(`/v1/projects/${registered.body.data.project.id}/git/checks`)
      .expect(200);

    expect(checks.body.data).toMatchObject({
      available: true,
      repositoryName: 'desktop-git-checks-repo',
      remoteUrl: 'git@github.com:user/repo.git',
      currentBranch: 'main',
      scope: 'pull_request',
      pullRequestNumber: 42,
      pullRequestUrl: 'https://github.com/user/repo/pull/42',
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      summary: {
        total: 2,
        success: 1,
        failure: 1,
      },
      checks: [
        expect.objectContaining({
          id: '101',
          name: 'CI',
          displayTitle: 'Build and test',
          status: 'completed',
          conclusion: 'success',
        }),
        expect.objectContaining({
          id: '102',
          name: 'Lint',
          status: 'completed',
          conclusion: 'failure',
        }),
      ],
    });
  });

  it('falls back to GitHub checks for the branch head commit when no PR exists', async () => {
    const repoDir = path.join(tmpDir, 'desktop-git-head-checks-repo');
    const ghBinary = path.join(tmpDir, 'fake-gh-head-checks');
    writeFileSync(
      ghBinary,
      String.raw`#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "Logged in to github.com"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  echo "no pull requests found" >&2
  exit 1
fi
if [ "$1" = "api" ]; then
  printf '%s\n' '[{"id":201,"name":"CI / build","status":"completed","conclusion":"success","html_url":"https://github.com/user/repo/runs/201","started_at":"2026-05-16T15:55:00Z","completed_at":"2026-05-16T15:58:00Z","check_suite":{"workflow_name":"CI"}},{"id":202,"name":"Tests","status":"in_progress","conclusion":null,"html_url":"https://github.com/user/repo/runs/202","check_suite":{"workflow_name":"CI"}}]'
  exit 0
fi
if [ "$1" = "run" ]; then
  echo "unexpected broad workflow history call" >&2
  exit 12
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;

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

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Git Head Checks Repo' })
      .expect(201);

    const checks = await request(app)
      .get(`/v1/projects/${registered.body.data.project.id}/git/checks`)
      .expect(200);

    expect(checks.body.data).toMatchObject({
      available: true,
      repositoryName: 'desktop-git-head-checks-repo',
      remoteUrl: 'git@github.com:user/repo.git',
      currentBranch: 'main',
      scope: 'head_commit',
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      summary: {
        total: 2,
        success: 1,
        inProgress: 1,
      },
      checks: [
        expect.objectContaining({
          id: '201',
          name: 'CI / build',
          workflowName: 'CI',
          status: 'completed',
          conclusion: 'success',
        }),
        expect.objectContaining({
          id: '202',
          name: 'Tests',
          status: 'in_progress',
        }),
      ],
    });
  });

  it('reports unavailable GitHub pull requests when no GitHub remote is configured', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-prs-no-remote-repo');
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

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub PRs No Remote Repo' })
      .expect(201);

    const pullRequests = await request(app)
      .get(`/v1/projects/${registered.body.data.project.id}/github/pull-requests`)
      .expect(200);

    expect(pullRequests.body.data).toMatchObject({
      available: false,
      reason: 'No GitHub origin remote is configured for this Project.',
      githubRemoteDetected: false,
      ghAvailable: false,
      authenticated: false,
      pullRequests: [],
    });
  });

  it('loads read-only GitHub pull requests through the configured GitHub CLI binary', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-prs-repo');
    const ghBinary = path.join(tmpDir, 'fake-gh-prs');
    writeFileSync(
      ghBinary,
      String.raw`#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "Logged in to github.com"
  exit 0
fi
if [ "$1" = "pr" ]; then
  printf '%s\n' '[{"number":42,"title":"Add PRs view","state":"OPEN","url":"https://github.com/user/repo/pull/42","headRefName":"task/prs","baseRefName":"main","author":{"login":"jwill9999"},"isDraft":false,"reviewDecision":"REVIEW_REQUIRED","mergeable":"MERGEABLE","createdAt":"2026-05-16T15:00:00Z","updatedAt":"2026-05-16T15:30:00Z","statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"},{"status":"COMPLETED","conclusion":"FAILURE"},{"status":"IN_PROGRESS","conclusion":null}]},{"number":41,"title":"Other branch","state":"OPEN","url":"https://github.com/user/repo/pull/41","headRefName":"task/other","baseRefName":"main","author":{"login":"agent-bot"},"isDraft":true,"reviewDecision":"APPROVED","mergeable":"UNKNOWN","createdAt":"2026-05-15T15:00:00Z","updatedAt":"2026-05-15T15:30:00Z","statusCheckRollup":[]}]'
  exit 0
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;

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
    execFileSync(GIT_BINARY, ['switch', '-c', 'task/prs'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub PRs Repo' })
      .expect(201);

    const pullRequests = await request(app)
      .get(`/v1/projects/${registered.body.data.project.id}/github/pull-requests`)
      .expect(200);

    expect(pullRequests.body.data).toMatchObject({
      available: true,
      repositoryName: 'desktop-github-prs-repo',
      remoteUrl: 'git@github.com:user/repo.git',
      currentBranch: 'task/prs',
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      pullRequests: [
        expect.objectContaining({
          number: 42,
          title: 'Add PRs view',
          state: 'open',
          headRefName: 'task/prs',
          baseRefName: 'main',
          authorLogin: 'jwill9999',
          currentBranch: true,
          reviewDecision: 'review_required',
          checks: {
            total: 3,
            success: 1,
            failure: 1,
            pending: 1,
            unknown: 0,
          },
        }),
        expect.objectContaining({
          number: 41,
          isDraft: true,
          currentBranch: false,
          reviewDecision: 'approved',
        }),
      ],
    });
  });

  it('creates a GitHub pull request for a published branch using the configured GitHub CLI binary', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-create-pr-repo');
    const bareRemoteDir = path.join(tmpDir, 'desktop-github-create-pr-remote.git');
    const ghBinary = path.join(tmpDir, 'fake-gh-create-pr');
    writeFileSync(
      ghBinary,
      String.raw`#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "Logged in to github.com"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "create" ]; then
  found_base=0
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--base" ] && [ "$2" = "staging" ]; then
      found_base=1
    fi
    shift
  done
  if [ "$found_base" != "1" ]; then
    echo "expected --base staging" >&2
    exit 1
  fi
  printf '%s\n' '{"number":43,"title":"Add PR creation flow","state":"OPEN","url":"https://github.com/user/repo/pull/43","headRefName":"task/pr-flow","baseRefName":"staging","author":{"login":"jwill9999"},"isDraft":false,"reviewDecision":"REVIEW_REQUIRED","mergeable":"UNKNOWN","createdAt":"2026-05-22T12:00:00Z","updatedAt":"2026-05-22T12:00:00Z","statusCheckRollup":[{"status":"IN_PROGRESS","conclusion":null}]}'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  printf '%s\n' '[{"number":43,"title":"Add PR creation flow","state":"OPEN","url":"https://github.com/user/repo/pull/43","headRefName":"task/pr-flow","baseRefName":"staging","author":{"login":"jwill9999"},"isDraft":false,"reviewDecision":"REVIEW_REQUIRED","mergeable":"UNKNOWN","createdAt":"2026-05-22T12:00:00Z","updatedAt":"2026-05-22T12:00:00Z","statusCheckRollup":[{"status":"IN_PROGRESS","conclusion":null}]}]'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  printf '%s\n' '{"number":43,"url":"https://github.com/user/repo/pull/43","statusCheckRollup":[{"__typename":"CheckRun","name":"CI","workflowName":"CI","status":"IN_PROGRESS","conclusion":null,"detailsUrl":"https://github.com/user/repo/actions/runs/1"}]}'
  exit 0
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;

    execFileSync(GIT_BINARY, ['init', '--bare', bareRemoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', bareRemoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['switch', '-c', 'task/pr-flow'], { cwd: repoDir, stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'feature.txt'), 'feature\n');
    execFileSync(GIT_BINARY, ['add', 'feature.txt'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'Add PR creation flow'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'task/pr-flow'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['remote', 'set-url', 'origin', 'git@github.com:user/repo.git'], {
      cwd: repoDir,
      stdio: 'ignore',
    });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub Create PR Repo' })
      .expect(201);

    const created = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/github/pull-requests`)
      .send({ title: 'Add PR creation flow', baseBranch: 'staging' })
      .expect(200);

    expect(created.body.data).toMatchObject({
      pullRequest: {
        number: 43,
        title: 'Add PR creation flow',
        url: 'https://github.com/user/repo/pull/43',
        headRefName: 'task/pr-flow',
        baseRefName: 'staging',
        currentBranch: true,
      },
      pullRequests: {
        available: true,
        pullRequests: [expect.objectContaining({ number: 43, currentBranch: true })],
      },
      checks: {
        available: true,
        scope: 'pull_request',
        pullRequestNumber: 43,
        summary: expect.objectContaining({ total: 1, inProgress: 1 }),
      },
    });
  });

  it('rejects GitHub pull request creation without a GitHub remote', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-create-pr-no-remote-repo');
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

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub Create PR No Remote Repo' })
      .expect(201);

    const rejected = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/github/pull-requests`)
      .send({ title: 'Add PR creation flow' })
      .expect(409);

    expect(rejected.body.error).toMatchObject({
      code: 'PROJECT_GITHUB_REMOTE_REQUIRED',
    });
  });

  it('rejects GitHub pull request creation when gh is missing or unauthenticated', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-create-pr-auth-repo');
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

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub Create PR Auth Repo' })
      .expect(201);

    process.env['AGENT_PLATFORM_GH_BINARY'] = path.join(tmpDir, 'missing-gh');
    const missingGh = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/github/pull-requests`)
      .send({ title: 'Add PR creation flow' })
      .expect(409);
    expect(missingGh.body.error).toMatchObject({ code: 'PROJECT_GITHUB_CLI_UNAVAILABLE' });

    const ghBinary = path.join(tmpDir, 'fake-gh-create-pr-unauth');
    writeFileSync(
      ghBinary,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "not logged in" >&2
  exit 1
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;
    const unauthenticated = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/github/pull-requests`)
      .send({ title: 'Add PR creation flow' })
      .expect(409);
    expect(unauthenticated.body.error).toMatchObject({ code: 'PROJECT_GITHUB_AUTH_REQUIRED' });
  });

  it('rejects GitHub pull request creation before the branch is published', async () => {
    const repoDir = path.join(tmpDir, 'desktop-github-create-pr-unpublished-repo');
    const ghBinary = path.join(tmpDir, 'fake-gh-create-pr-unpublished');
    writeFileSync(
      ghBinary,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ]; then
  echo "Logged in to github.com"
  exit 0
fi
exit 1
`,
    );
    chmodSync(ghBinary, 0o755);
    process.env['AGENT_PLATFORM_GH_BINARY'] = ghBinary;

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
    execFileSync(GIT_BINARY, ['switch', '-c', 'task/pr-flow'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop GitHub Create PR Unpublished Repo' })
      .expect(201);

    const rejected = await request(app)
      .post(`/v1/projects/${registered.body.data.project.id}/github/pull-requests`)
      .send({ title: 'Add PR creation flow' })
      .expect(409);

    expect(rejected.body.error).toMatchObject({
      code: 'PROJECT_GIT_UPSTREAM_REQUIRED',
    });
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

  it('pushes the current Project branch when an upstream is configured', async () => {
    const remoteDir = path.join(tmpDir, 'desktop-push-remote.git');
    const repoDir = path.join(tmpDir, 'desktop-push-repo');
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], { cwd: repoDir, stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\nupdated\n');
    execFileSync(GIT_BINARY, ['commit', '-am', 'update readme'], {
      cwd: repoDir,
      stdio: 'ignore',
    });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Push Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const beforePush = await request(app).get(`/v1/projects/${projectId}/git/status`).expect(200);
    expect(beforePush.body.data).toMatchObject({
      currentBranch: 'main',
      upstreamBranch: 'origin/main',
      ahead: 1,
    });

    const pushed = await request(app)
      .post(`/v1/projects/${projectId}/git/push`)
      .send({})
      .expect(200);
    expect(pushed.body.data).toMatchObject({
      currentBranch: 'main',
      upstreamBranch: 'origin/main',
      ahead: 0,
      behind: 0,
    });
  });

  it('publishes the current Project branch and sets upstream when origin exists', async () => {
    const remoteDir = path.join(tmpDir, 'desktop-publish-remote.git');
    const repoDir = path.join(tmpDir, 'desktop-publish-repo');
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Publish Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const beforePublish = await request(app)
      .get(`/v1/projects/${projectId}/git/status`)
      .expect(200);
    expect(beforePublish.body.data).toMatchObject({
      currentBranch: 'main',
      upstreamState: 'none',
    });

    const published = await request(app)
      .post(`/v1/projects/${projectId}/git/publish`)
      .send({})
      .expect(200);

    expect(published.body.data).toMatchObject({
      currentBranch: 'main',
      upstreamBranch: 'origin/main',
      upstreamState: 'active',
      ahead: 0,
      behind: 0,
    });
  });

  it('pulls remote commits for a clean behind Project branch', async () => {
    const remoteDir = path.join(tmpDir, 'desktop-pull-remote.git');
    const repoDir = path.join(tmpDir, 'desktop-pull-repo');
    const collaboratorDir = path.join(tmpDir, 'desktop-pull-collaborator');
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'initial\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
      cwd: remoteDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['clone', remoteDir, collaboratorDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'collab@example.com'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Collaborator'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(collaboratorDir, 'remote.txt'), 'remote change\n');
    execFileSync(GIT_BINARY, ['add', 'remote.txt'], { cwd: collaboratorDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'remote change'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push'], { cwd: collaboratorDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['fetch', 'origin'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Pull Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const beforePull = await request(app).get(`/v1/projects/${projectId}/git/status`).expect(200);
    expect(beforePull.body.data).toMatchObject({ currentBranch: 'main', ahead: 0, behind: 1 });

    const pulled = await request(app)
      .post(`/v1/projects/${projectId}/git/pull`)
      .send({})
      .expect(200);
    expect(pulled.body.data).toMatchObject({
      outcome: 'clean',
      status: { currentBranch: 'main', ahead: 0, behind: 0 },
    });
    expect(readFileSync(path.join(repoDir, 'remote.txt'), 'utf8')).toBe('remote change\n');
  });

  it('rejects pulling remote commits when local changes need user review first', async () => {
    const remoteDir = path.join(tmpDir, 'desktop-pull-dirty-remote.git');
    const repoDir = path.join(tmpDir, 'desktop-pull-dirty-repo');
    const collaboratorDir = path.join(tmpDir, 'desktop-pull-dirty-collaborator');
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'initial\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
      cwd: remoteDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['clone', remoteDir, collaboratorDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'collab@example.com'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Collaborator'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(collaboratorDir, 'remote.txt'), 'remote change\n');
    execFileSync(GIT_BINARY, ['add', 'remote.txt'], { cwd: collaboratorDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'remote change'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push'], { cwd: collaboratorDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['fetch', 'origin'], { cwd: repoDir, stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'local.txt'), 'local unsaved work\n');

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Dirty Pull Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const response = await request(app)
      .post(`/v1/projects/${projectId}/git/pull`)
      .send({})
      .expect(409);
    expect(response.body.error).toMatchObject({
      code: 'PROJECT_GIT_DIRTY',
      message: 'Commit, stash, or discard local changes before pulling remote changes.',
    });
  });

  it('detects pull conflicts and resolves them with file-level choices before merge commit', async () => {
    const remoteDir = path.join(tmpDir, 'desktop-conflict-remote.git');
    const repoDir = path.join(tmpDir, 'desktop-conflict-repo');
    const collaboratorDir = path.join(tmpDir, 'desktop-conflict-collaborator');
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'line one\nshared\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
      cwd: remoteDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['clone', remoteDir, collaboratorDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'collab@example.com'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Collaborator'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(collaboratorDir, 'README.md'), 'line one\nincoming\n');
    execFileSync(GIT_BINARY, ['commit', '-am', 'remote readme'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push'], { cwd: collaboratorDir, stdio: 'ignore' });
    writeFileSync(path.join(repoDir, 'README.md'), 'line one\ncurrent\n');
    execFileSync(GIT_BINARY, ['commit', '-am', 'local readme'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['fetch', 'origin'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Conflict Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const pulled = await request(app)
      .post(`/v1/projects/${projectId}/git/pull`)
      .send({})
      .expect(200);
    expect(pulled.body.data).toMatchObject({
      outcome: 'conflicts',
      conflicts: { totalFiles: 1, totalConflicts: 1 },
    });

    const blockedCommit = await request(app)
      .post(`/v1/projects/${projectId}/git/conflicts/commit`)
      .send({ message: 'Merge remote changes' })
      .expect(409);
    expect(blockedCommit.body.error).toMatchObject({
      code: 'PROJECT_GIT_CONFLICT_UNRESOLVED',
      message: 'Resolve all merge conflicts before committing.',
    });

    const conflicts = await request(app).get(`/v1/projects/${projectId}/git/conflicts`).expect(200);
    expect(conflicts.body.data).toMatchObject({
      totalFiles: 1,
      totalConflicts: 1,
      files: [{ path: 'README.md', conflictCount: 1, resolved: false }],
    });

    const detail = await request(app)
      .get(`/v1/projects/${projectId}/git/conflicts/file`)
      .query({ path: 'README.md' })
      .expect(200);
    expect(detail.body.data.hunks[0]).toMatchObject({
      current: 'current\n',
      incoming: 'incoming\n',
    });

    const resolved = await request(app)
      .post(`/v1/projects/${projectId}/git/conflicts/resolve`)
      .send({ path: 'README.md', strategy: 'both' })
      .expect(200);
    expect(resolved.body.data.files[0]).toMatchObject({ path: 'README.md', resolved: true });
    expect(readFileSync(path.join(repoDir, 'README.md'), 'utf8')).toBe(
      'line one\ncurrent\nincoming\n',
    );

    const committed = await request(app)
      .post(`/v1/projects/${projectId}/git/conflicts/commit`)
      .send({ message: 'Merge remote changes' })
      .expect(200);
    expect(committed.body.data).toMatchObject({
      currentBranch: 'main',
      workingTree: { conflicts: 0 },
    });
  });

  it('clears stale upstream configuration without switching branches', async () => {
    const remoteDir = path.join(tmpDir, 'desktop-clear-upstream-remote.git');
    const repoDir = path.join(tmpDir, 'desktop-clear-upstream-repo');
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'test@example.com'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    writeFileSync(path.join(repoDir, 'README.md'), 'main\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['switch', '-c', 'fix/stale-upstream'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'fix/stale-upstream'], {
      cwd: repoDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['update-ref', '-d', 'refs/heads/fix/stale-upstream'], {
      cwd: remoteDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['fetch', '--prune', 'origin'], { cwd: repoDir, stdio: 'ignore' });

    const registered = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Stale Upstream Repo' })
      .expect(201);
    const projectId = registered.body.data.project.id;

    const stale = await request(app).get(`/v1/projects/${projectId}/git/status`).expect(200);
    expect(stale.body.data).toMatchObject({
      currentBranch: 'fix/stale-upstream',
      upstreamBranch: 'origin/fix/stale-upstream',
      upstreamState: 'missing',
    });

    const cleared = await request(app)
      .post(`/v1/projects/${projectId}/git/clear-upstream`)
      .send({})
      .expect(200);

    expect(cleared.body.data).toMatchObject({
      currentBranch: 'fix/stale-upstream',
      upstreamState: 'none',
    });
    expect(cleared.body.data).not.toHaveProperty('upstreamBranch');
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
    writeFileSync(path.join(repoDir, 'chart.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
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
      expect.objectContaining({ name: 'chart.png', path: 'chart.png', type: 'file' }),
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

    const preview = await request(app)
      .get(`/v1/projects/${projectId}/files/preview`)
      .query({ path: 'chart.png' })
      .expect('Content-Type', /image\/png/)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(200);
    expect(preview.headers['content-disposition']).toBe('inline; filename="chart.png"');
    expect(preview.headers['content-security-policy']).toContain('sandbox');
    expect(JSON.stringify(preview.headers)).not.toContain(realRoot);
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
    await request(app)
      .get(`/v1/projects/${projectId}/files/preview`)
      .query({ path: '../outside/secret.txt' })
      .expect(403);
    await request(app)
      .get(`/v1/projects/${projectId}/files/preview`)
      .query({ path: 'secret-link.txt' })
      .expect(403);
    await request(app)
      .get(`/v1/projects/${projectId}/files/preview`)
      .query({ path: 'binary.bin' })
      .expect(415);
  });

  it('exports a URI-scoped Project file with safe attachment headers and bytes', async () => {
    const repoDir = path.join(tmpDir, 'desktop-export-project');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    mkdirSync(path.join(repoDir, 'generated'), { recursive: true });
    writeFileSync(path.join(repoDir, 'generated', 'report.md'), '# Exported report\n');
    const realRoot = realpathSync(repoDir);

    const openedProject = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Desktop Export Project' })
      .expect(201);
    const projectId = openedProject.body.data.project.id as string;
    const uri = workspaceResourceUri({
      projectId,
      kind: 'file',
      target: 'generated/report.md',
    });

    const exported = await request(app)
      .get(`/v1/projects/${projectId}/resources/export`)
      .query({ uri })
      .expect('Content-Type', /text\/markdown/)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('Cache-Control', 'no-store')
      .expect(200);

    expect(exported.text).toBe('# Exported report\n');
    expect(exported.headers['content-disposition']).toContain('attachment; filename="report.md"');
    expect(exported.headers['content-disposition']).toContain("filename*=UTF-8''report.md");
    expect(exported.headers['content-security-policy']).toContain("default-src 'none'");
    expect(JSON.stringify(exported.headers)).not.toContain(realRoot);
  });

  it('rejects mismatched, non-file, traversal, symlink, directory, and missing exports', async () => {
    const repoDir = path.join(tmpDir, 'desktop-export-guarded');
    const outsideDir = path.join(tmpDir, 'export-outside');
    execFileSync(GIT_BINARY, ['init', '-b', 'main', repoDir], { stdio: 'ignore' });
    mkdirSync(path.join(repoDir, 'generated'), { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(path.join(outsideDir, 'secret.txt'), 'outside secret\n');
    symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(repoDir, 'generated', 'secret.txt'));

    const openedProject = await request(app)
      .post('/v1/projects/desktop/register')
      .set('x-agent-platform-desktop-bridge', '1')
      .send({ path: repoDir, name: 'Guarded Desktop Export' })
      .expect(201);
    const projectId = openedProject.body.data.project.id as string;
    const exportRequest = (uri: string) =>
      request(app).get(`/v1/projects/${projectId}/resources/export`).query({ uri });

    const mismatchedProject = await exportRequest(
      workspaceResourceUri({ projectId: 'another-project', kind: 'file', target: 'file.txt' }),
    ).expect(403);
    expect(mismatchedProject.body.error.code).toBe('PROJECT_RESOURCE_MISMATCH');
    await exportRequest(
      workspaceResourceUri({ projectId, kind: 'diff', target: 'generated/report.md' }),
    ).expect(415);
    await exportRequest(
      workspaceResourceUri({ projectId, kind: 'file', target: '../export-outside/secret.txt' }),
    ).expect(403);
    await exportRequest(
      workspaceResourceUri({ projectId, kind: 'file', target: 'generated/secret.txt' }),
    ).expect(403);
    await exportRequest(
      workspaceResourceUri({ projectId, kind: 'file', target: 'generated' }),
    ).expect(400);
    await exportRequest(
      workspaceResourceUri({ projectId, kind: 'file', target: 'generated/missing.txt' }),
    ).expect(404);
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
