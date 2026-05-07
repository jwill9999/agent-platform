import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  closeDatabase,
  createProject,
  createSession,
  openDatabase,
  replaceAgent,
} from '@agent-platform/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveSessionWorkspace } from '../src/infrastructure/projects/projectWorkspaceResolver.js';

type TestDb = ReturnType<typeof openDatabase>['db'];
type TestOnboardingState = 'missing' | 'approved' | 'needs_review' | 'in_progress';

describe('resolveSessionWorkspace', () => {
  let tmpRoot: string;
  let opened: ReturnType<typeof openDatabase>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'agent-platform-project-workspace-resolver-'));
    opened = openDatabase(join(tmpRoot, 'db.sqlite'));
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
  });

  afterEach(() => {
    closeDatabase(opened.sqlite);
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function createBackendProjectSession(options: {
    name: string;
    projectRoot: string;
    onboardingState?: TestOnboardingState;
  }) {
    const project = createProject(opened.db, {
      name: options.name,
      workspaceKey: options.projectRoot,
      metadata: backendProjectMetadata(options.projectRoot, options.onboardingState ?? 'missing'),
    });
    return createSession(opened.db, {
      agentId: 'agent-1',
      mode: 'project',
      projectId: project.id,
    });
  }

  function backendProjectMetadata(projectRoot: string, onboardingState: TestOnboardingState) {
    return {
      backendProjectRoot: projectRoot,
      repositoryRoot: projectRoot,
      projectRoot: '/workspace',
      capabilityState: 'backend_accessible',
      onboardingState,
      defaultAgentProfile: 'coding',
    };
  }

  function unavailableProjectSession(db: TestDb) {
    const project = createProject(db, {
      name: 'Unavailable Project',
      metadata: {
        backendProjectRoot: '/missing/project',
        repositoryRoot: '/missing/project',
        projectRoot: '/workspace',
        capabilityState: 'unavailable',
        onboardingState: 'missing',
        defaultAgentProfile: 'coding',
      },
    });
    return createSession(db, {
      agentId: 'agent-1',
      mode: 'project',
      projectId: project.id,
    });
  }

  it('returns Project root mounts and repository defaults for project sessions', () => {
    const projectRoot = realpathSync(mkdtempSync(join(tmpRoot, 'project-')));
    const session = createBackendProjectSession({
      name: 'Backend Project',
      projectRoot,
    });

    expect(resolveSessionWorkspace(opened.db, session.id)).toMatchObject({
      ok: true,
      workspaceRoot: projectRoot,
      repositoryRoot: projectRoot,
      defaultRepoPath: projectRoot,
      accessPolicy: {
        canInspect: true,
        canWrite: false,
        writeBlockReason: 'onboarding_not_approved',
      },
      mounts: [
        {
          label: 'workspace',
          hostPath: projectRoot,
          containerPath: '/workspace',
          permission: 'read_write',
        },
      ],
    });
  });

  it('unlocks writes when Project onboarding is approved', () => {
    const projectRoot = realpathSync(mkdtempSync(join(tmpRoot, 'project-')));
    const session = createBackendProjectSession({
      name: 'Approved Backend Project',
      projectRoot,
      onboardingState: 'approved',
    });

    expect(resolveSessionWorkspace(opened.db, session.id)).toMatchObject({
      ok: true,
      accessPolicy: {
        canInspect: true,
        canWrite: true,
      },
    });
  });

  it('distinguishes sessions without a bound Project', () => {
    const session = createSession(opened.db, { agentId: 'agent-1' });

    expect(resolveSessionWorkspace(opened.db, session.id)).toMatchObject({
      ok: false,
      code: 'NO_PROJECT_BOUND',
    });
  });

  it('distinguishes unavailable Project metadata', () => {
    const session = unavailableProjectSession(opened.db);

    expect(resolveSessionWorkspace(opened.db, session.id)).toMatchObject({
      ok: false,
      code: 'PROJECT_UNAVAILABLE',
    });
  });
});
