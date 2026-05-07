import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
    expect(started.body.data.metadata.onboardingDraft.markdown).toContain('pnpm test');

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
