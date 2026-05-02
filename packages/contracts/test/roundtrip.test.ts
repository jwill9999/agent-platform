import { describe, expect, it } from 'vitest';
import {
  AgentSchema,
  ApprovalRequestDecisionBodySchema,
  ApprovalRequestQuerySchema,
  ApprovalRequestSchema,
  CodingApplyPatchInputSchema,
  CodingApplyPatchResultSchema,
  CodingGitBranchInfoResultSchema,
  CodingGitChangedFilesResultSchema,
  CodingGitDiffResultSchema,
  CodingGitLogResultSchema,
  CodingGitStatusResultSchema,
  CodingRunQualityGateInputSchema,
  CodingRunQualityGateResultSchema,
  CodingRepoMapInputSchema,
  CodingRepoMapResultSchema,
  CodingCodeSearchInputSchema,
  CodingCodeSearchResultSchema,
  CodingFindRelatedTestsInputSchema,
  CodingFindRelatedTestsResultSchema,
  CodingToolEnvelopeSchema,
  CriticVerdictSchema,
  ExecutionLimitsSchema,
  ExtractedMemoryCandidateSchema,
  HealthResponseSchema,
  MemoryCandidateExtractionInputSchema,
  MemoryCreateBodySchema,
  MemoryLinkSchema,
  PromptMemoryBundleSchema,
  MemoryQuerySchema,
  MemoryRecordSchema,
  MemoryCleanupBodySchema,
  SelfLearningEvaluateBodySchema,
  SelfLearningEvaluationResultSchema,
  WorkingMemoryArtifactSchema,
  WorkingMemoryUpdateBodySchema,
  OutputSchema,
  PlanSchema,
  ProjectCreateBodySchema,
  ProjectRecordSchema,
  SecretRefSchema,
  ScheduledJobCreateBodySchema,
  ScheduledJobRecordSchema,
  ScheduledJobRunCreateBodySchema,
  ScheduledJobRunLogRecordSchema,
  ScheduledJobRunRecordSchema,
  SkillSchema,
} from '../src/index.js';

describe('contracts round-trip', () => {
  it('OutputSchema', () => {
    const samples = [
      { type: 'text' as const, content: 'hi' },
      { type: 'code' as const, language: 'ts', content: 'const x = 1' },
      { type: 'tool_result' as const, toolId: 't1', data: { ok: true } },
      { type: 'error' as const, message: 'bad', code: 'E1' },
      { type: 'thinking' as const, content: '...' },
      {
        type: 'approval_required' as const,
        approvalRequestId: 'approval-1',
        toolName: 'sys_bash',
        riskTier: 'high' as const,
        argsPreview: { command: 'date' },
        message: 'Tool "sys_bash" requires human approval before execution.',
      },
    ];
    for (const s of samples) {
      const parsed = OutputSchema.parse(s);
      expect(OutputSchema.parse(structuredClone(parsed))).toEqual(parsed);
    }
  });

  it('SkillSchema + AgentSchema + limits', () => {
    const limits = ExecutionLimitsSchema.parse({
      maxSteps: 10,
      maxParallelTasks: 2,
      timeoutMs: 60_000,
    });
    const skill = SkillSchema.parse({
      id: 'skill-1',
      slug: 'skill-1',
      name: 'Skill 1',
      goal: 'Do X',
      constraints: ['c1'],
      tools: ['tool-a'],
    });
    const agent = AgentSchema.parse({
      id: 'agent-1',
      slug: 'agent-1',
      name: 'Default',
      systemPrompt: 'Test agent',
      allowedSkillIds: [skill.id],
      allowedToolIds: ['tool-a'],
      allowedMcpServerIds: [],
      executionLimits: limits,
    });
    expect(AgentSchema.parse(structuredClone(agent))).toEqual(agent);
  });

  it('HealthResponseSchema', () => {
    const h = HealthResponseSchema.parse({ ok: true });
    expect(HealthResponseSchema.parse(structuredClone(h))).toEqual(h);
  });

  it('PlanSchema + SecretRefSchema', () => {
    const ref = SecretRefSchema.parse({ id: 'sec-1', label: 'OpenAI' });
    const plan = PlanSchema.parse({
      id: 'plan-1',
      tasks: [{ id: 'task-1', description: 'step', toolIds: ['t'] }],
    });
    expect(SecretRefSchema.parse(structuredClone(ref))).toEqual(ref);
    expect(PlanSchema.parse(structuredClone(plan))).toEqual(plan);
  });

  it('Project schemas round-trip', () => {
    const project = ProjectRecordSchema.parse({
      id: 'project-1',
      slug: 'agent-platform',
      name: 'Agent Platform',
      description: 'Main repository',
      workspacePath: 'projects/agent-platform',
      workspaceKey: 'projects/agent-platform',
      metadata: { language: 'typescript' },
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });
    expect(ProjectRecordSchema.parse(structuredClone(project))).toEqual(project);

    expect(ProjectCreateBodySchema.parse({ name: 'Agent Platform' })).toMatchObject({
      name: 'Agent Platform',
      metadata: {},
    });
  });

  it('CriticVerdictSchema', () => {
    const accept = CriticVerdictSchema.parse({ verdict: 'accept' });
    expect(accept).toEqual({ verdict: 'accept', reasons: [] });
    const revise = CriticVerdictSchema.parse({
      verdict: 'revise',
      reasons: ['gap', 'fix'],
    });
    expect(CriticVerdictSchema.parse(structuredClone(revise))).toEqual(revise);
    expect(() => CriticVerdictSchema.parse({ verdict: 'maybe' })).toThrow();
  });

  it('ExecutionLimitsSchema accepts maxCriticIterations', () => {
    const limits = ExecutionLimitsSchema.parse({
      maxSteps: 10,
      maxParallelTasks: 2,
      timeoutMs: 60_000,
      maxCriticIterations: 4,
    });
    expect(limits.maxCriticIterations).toBe(4);
  });

  it('ExecutionLimitsSchema rejects non-positive maxCriticIterations', () => {
    expect(() =>
      ExecutionLimitsSchema.parse({
        maxSteps: 10,
        maxParallelTasks: 2,
        timeoutMs: 60_000,
        maxCriticIterations: 0,
      }),
    ).toThrow();

    expect(() =>
      ExecutionLimitsSchema.parse({
        maxSteps: 10,
        maxParallelTasks: 2,
        timeoutMs: 60_000,
        maxCriticIterations: -1,
      }),
    ).toThrow();
  });

  it('ApprovalRequest schemas round-trip and validate decisions', () => {
    const request = ApprovalRequestSchema.parse({
      id: 'approval-1',
      sessionId: 'session-1',
      runId: 'run-1',
      agentId: 'agent-1',
      toolName: 'sys_bash',
      argsJson: '{"command":"date"}',
      executionPayloadJson: '{"toolCallId":"tc-1"}',
      riskTier: 'high',
      status: 'pending',
      createdAtMs: 1000,
      expiresAtMs: 2000,
    });

    expect(ApprovalRequestSchema.parse(structuredClone(request))).toEqual(request);
    expect(ApprovalRequestQuerySchema.parse({ status: 'pending', limit: '10' })).toMatchObject({
      status: 'pending',
      limit: 10,
      offset: 0,
    });
    expect(ApprovalRequestDecisionBodySchema.parse({ reason: 'approved by user' })).toEqual({
      reason: 'approved by user',
    });
    expect(() => ApprovalRequestSchema.parse({ ...request, status: 'done' })).toThrow();
  });

  it('Scheduler schemas round-trip and enforce ownership/schedule policy', () => {
    const job = ScheduledJobRecordSchema.parse({
      id: 'job-1',
      scope: 'project',
      scopeId: 'project-1',
      projectId: 'project-1',
      executionAgentId: 'agent-1',
      createdFromSessionId: 'session-1',
      name: 'Nightly checks',
      instructions: 'Run the project quality checks and summarize failures.',
      targetKind: 'agent_turn',
      targetPayload: { prompt: 'Run quality checks' },
      scheduleType: 'recurring',
      intervalMs: 86_400_000,
      timezone: 'UTC',
      nextRunAtMs: 2000,
      status: 'paused',
      retryPolicy: { maxAttempts: 2, backoffMs: 60_000 },
      timeoutMs: 300_000,
      metadata: { source: 'test' },
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });
    expect(ScheduledJobRecordSchema.parse(structuredClone(job))).toEqual(job);
    expect(
      ScheduledJobCreateBodySchema.parse({
        scope: 'global',
        name: 'One off cleanup',
        instructions: 'Inspect expired records.',
        targetKind: 'built_in_task',
        scheduleType: 'one_off',
        runAtMs: 1000,
      }),
    ).toMatchObject({ status: 'paused', retryPolicy: { maxAttempts: 1 } });
    expect(() =>
      ScheduledJobCreateBodySchema.parse({
        scope: 'project',
        scopeId: 'project-1',
        name: 'Bad project',
        instructions: 'Bad owner',
        targetKind: 'agent_turn',
        scheduleType: 'delayed',
        runAtMs: 1000,
      }),
    ).toThrow();
    expect(() =>
      ScheduledJobCreateBodySchema.parse({
        scope: 'global',
        name: 'Bad schedule',
        instructions: 'Bad schedule',
        targetKind: 'built_in_task',
        scheduleType: 'recurring',
      }),
    ).toThrow();

    const run = ScheduledJobRunRecordSchema.parse({
      id: 'run-1',
      jobId: 'job-1',
      status: 'queued',
      attempt: 1,
      queuedAtMs: 1000,
      metadata: {},
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });
    expect(ScheduledJobRunRecordSchema.parse(structuredClone(run))).toEqual(run);
    expect(ScheduledJobRunCreateBodySchema.parse({ jobId: 'job-1' })).toMatchObject({
      status: 'queued',
      attempt: 1,
    });

    const log = ScheduledJobRunLogRecordSchema.parse({
      id: 'log-1',
      runId: 'run-1',
      jobId: 'job-1',
      sequence: 0,
      level: 'info',
      message: 'Queued',
      data: {},
      truncated: false,
      createdAtMs: 1000,
    });
    expect(ScheduledJobRunLogRecordSchema.parse(structuredClone(log))).toEqual(log);
  });

  it('Memory schemas round-trip and enforce scoped policy', () => {
    const record = MemoryRecordSchema.parse({
      id: 'memory-1',
      scope: 'project',
      scopeId: 'project-1',
      projectId: 'project-1',
      kind: 'decision',
      status: 'approved',
      reviewStatus: 'approved',
      content: 'Use relational memory storage for v1.',
      confidence: 0.9,
      source: {
        kind: 'user',
        id: 'message-1',
        metadata: { channel: 'chat' },
      },
      tags: ['architecture'],
      metadata: { ticket: 'agent-platform-memory.1' },
      safetyState: 'safe',
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });
    expect(MemoryRecordSchema.parse(structuredClone(record))).toEqual(record);

    const createBody = MemoryCreateBodySchema.parse({
      scope: 'global',
      kind: 'preference',
      content: 'Prefer concise answers.',
      source: { kind: 'manual' },
    });
    expect(createBody).toMatchObject({
      scope: 'global',
      kind: 'preference',
      status: 'pending',
      reviewStatus: 'unreviewed',
      confidence: 0.5,
    });

    expect(() =>
      MemoryCreateBodySchema.parse({
        scope: 'session',
        kind: 'fact',
        content: 'Missing scope id.',
        source: { kind: 'manual' },
      }),
    ).toThrow();

    expect(MemoryCleanupBodySchema.parse({ scope: 'global' })).toEqual({
      scope: 'global',
      dryRun: true,
      confirm: false,
    });
    expect(() =>
      MemoryCleanupBodySchema.parse({
        scope: 'session',
        scopeId: 'session-1',
        dryRun: false,
      }),
    ).toThrow();

    expect(
      MemoryQuerySchema.parse({ minConfidence: '0.75', includeExpired: 'true' }),
    ).toMatchObject({
      minConfidence: 0.75,
      includeExpired: true,
      limit: 100,
      offset: 0,
    });

    const link = MemoryLinkSchema.parse({
      sourceMemoryId: 'memory-1',
      targetMemoryId: 'memory-2',
      relation: 'supports',
      createdAtMs: 1000,
    });
    expect(MemoryLinkSchema.parse(structuredClone(link))).toEqual(link);

    const promptBundle = PromptMemoryBundleSchema.parse({
      items: [
        {
          id: 'memory-1',
          scope: 'project',
          scopeId: 'project-1',
          kind: 'decision',
          content: 'Use relational memory storage for v1.',
          confidence: 0.9,
          source: { kind: 'user', id: 'message-1', label: 'reviewed user message' },
          tags: ['architecture'],
          updatedAtMs: 1000,
          score: 0.81,
        },
      ],
      includedCount: 1,
      omitted: { expired: 0, lowConfidence: 0, unsafe: 0, notRelevant: 2, crossScope: 0 },
    });
    expect(PromptMemoryBundleSchema.parse(structuredClone(promptBundle))).toEqual(promptBundle);
  });

  it('Working memory schemas round-trip and bound summaries', () => {
    const artifact = WorkingMemoryArtifactSchema.parse({
      sessionId: 'session-1',
      runId: 'run-1',
      currentGoal: 'Implement working memory.',
      activeProject: 'agent-platform',
      projectId: 'project-1',
      activeTask: 'agent-platform-memory.2',
      decisions: ['Keep short-term state session scoped.'],
      importantFiles: ['packages/db/src/repositories/workingMemory.ts'],
      toolsUsed: ['sys_read_file'],
      toolSummaries: [
        {
          toolName: 'sys_read_file',
          ok: true,
          summary: 'Read a repository file.',
          atMs: 1000,
        },
      ],
      blockers: ['Waiting for review'],
      pendingApprovalIds: ['approval-1'],
      nextAction: 'Run focused tests.',
      summary: 'Goal: Implement working memory. Next: Run focused tests.',
      createdAtMs: 1000,
      updatedAtMs: 2000,
    });
    expect(WorkingMemoryArtifactSchema.parse(structuredClone(artifact))).toEqual(artifact);

    const update = WorkingMemoryUpdateBodySchema.parse({
      sessionId: 'session-1',
      currentGoal: 'Continue the task.',
      toolsUsed: ['sys_list_files'],
    });
    expect(update).toEqual({
      sessionId: 'session-1',
      currentGoal: 'Continue the task.',
      toolsUsed: ['sys_list_files'],
    });
  });

  it('Memory candidate schemas round-trip and enforce scoped policy', () => {
    const input = MemoryCandidateExtractionInputSchema.parse({
      sessionId: 'session-1',
      agentId: 'agent-1',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: 'Remember that we prefer project-scoped memory for repo decisions.',
          createdAtMs: 1000,
        },
      ],
    });
    expect(MemoryCandidateExtractionInputSchema.parse(structuredClone(input))).toEqual(input);

    const candidate = ExtractedMemoryCandidateSchema.parse({
      scope: 'project',
      scopeId: 'agent-platform',
      kind: 'preference',
      content: 'Prefer project-scoped memory for repo decisions.',
      confidence: 0.84,
      rationale: 'The user explicitly asked the agent to remember this information.',
      evidence: [
        {
          kind: 'user_message',
          id: 'message-1',
          excerpt: 'Remember that we prefer project-scoped memory for repo decisions.',
          atMs: 1000,
        },
      ],
      tags: ['candidate', 'explicit'],
      safetyState: 'safe',
    });
    expect(ExtractedMemoryCandidateSchema.parse(structuredClone(candidate))).toEqual(candidate);
    expect(() =>
      ExtractedMemoryCandidateSchema.parse({
        ...candidate,
        scope: 'session',
        scopeId: undefined,
      }),
    ).toThrow();
  });

  it('Self-learning schemas round-trip with review-gated result metadata', () => {
    const input = SelfLearningEvaluateBodySchema.parse({
      sessionId: 'session-1',
      agentId: 'agent-1',
      observedOutcomes: [
        {
          kind: 'observability_error',
          id: 'event-1',
          message: "ENOENT: no such file or directory, open '/workspace/app/src/index.ts'",
          atMs: 1000,
        },
      ],
    });
    expect(input).toMatchObject({
      objective: 'recoverable_workspace_path_errors',
      minOccurrences: 2,
    });

    const result = SelfLearningEvaluationResultSchema.parse({
      objective: 'recoverable_workspace_path_errors',
      proposed: false,
      reason: 'Not enough matching signals.',
      metrics: {
        before: { observedSignals: 1, matchingSignals: 1, candidateSignals: 0 },
        after: { approvedLearningMemories: 0, existingPendingProposals: 0 },
      },
    });
    expect(SelfLearningEvaluationResultSchema.parse(structuredClone(result))).toEqual(result);
  });

  it('Coding apply patch schemas round-trip', () => {
    const input = CodingApplyPatchInputSchema.parse({
      reason: 'Update greeting',
      dryRun: true,
      operations: [{ path: 'src/example.ts', oldText: 'hello', newText: 'hello world' }],
    });
    expect(CodingApplyPatchInputSchema.parse(structuredClone(input))).toEqual(input);

    const result = CodingApplyPatchResultSchema.parse({
      dryRun: true,
      changedFiles: ['src/example.ts'],
      createdFiles: [],
      deletedFiles: [],
      diffStat: { filesChanged: 1, insertions: 1, deletions: 1 },
    });
    expect(CodingApplyPatchResultSchema.parse(structuredClone(result))).toEqual(result);

    const envelope = CodingToolEnvelopeSchema.parse({
      ok: true,
      result,
      evidence: {
        kind: 'edit',
        summary: 'Dry run would change 1 file.',
        riskTier: 'medium',
        status: 'succeeded',
        sourceTool: 'coding_apply_patch',
        startedAtMs: 1000,
        completedAtMs: 1010,
        durationMs: 10,
        artifacts: [
          {
            kind: 'diff',
            label: 'Patch diff',
            storage: 'inline',
            mimeType: 'text/x-diff',
            content: '--- a/src/example.ts\n+++ b/src/example.ts',
            sizeBytes: 43,
            truncated: false,
          },
        ],
      },
    });
    expect(CodingToolEnvelopeSchema.parse(structuredClone(envelope))).toEqual(envelope);
  });

  it('Coding git result schemas round-trip', () => {
    const fileChange = { path: 'src/index.ts', status: 'M', staged: true, unstaged: false };

    const status = CodingGitStatusResultSchema.parse({
      repoPath: '/workspace/repo',
      branch: 'main',
      head: 'abc123',
      clean: false,
      ahead: 1,
      behind: 0,
      changedFiles: [fileChange],
    });
    expect(CodingGitStatusResultSchema.parse(structuredClone(status))).toEqual(status);

    const diff = CodingGitDiffResultSchema.parse({
      repoPath: '/workspace/repo',
      staged: false,
      path: 'src/index.ts',
      diff: 'diff --git a/src/index.ts b/src/index.ts',
      sizeBytes: 42,
      truncated: false,
      filesChanged: 1,
    });
    expect(CodingGitDiffResultSchema.parse(structuredClone(diff))).toEqual(diff);

    const log = CodingGitLogResultSchema.parse({
      repoPath: '/workspace/repo',
      ref: 'HEAD',
      commits: [
        {
          hash: 'abcdef',
          shortHash: 'abcdef',
          author: 'Test User',
          authoredAt: '2026-04-30T00:00:00Z',
          subject: 'Initial commit',
        },
      ],
      truncated: false,
    });
    expect(CodingGitLogResultSchema.parse(structuredClone(log))).toEqual(log);

    const branch = CodingGitBranchInfoResultSchema.parse({
      repoPath: '/workspace/repo',
      branch: 'main',
      head: 'abcdef',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
    });
    expect(CodingGitBranchInfoResultSchema.parse(structuredClone(branch))).toEqual(branch);

    const changedFiles = CodingGitChangedFilesResultSchema.parse({
      repoPath: '/workspace/repo',
      count: 1,
      files: [fileChange],
      truncated: false,
    });
    expect(CodingGitChangedFilesResultSchema.parse(structuredClone(changedFiles))).toEqual(
      changedFiles,
    );
  });

  it('Coding quality gate schemas round-trip', () => {
    const input = CodingRunQualityGateInputSchema.parse({
      profile: 'test',
      repoPath: '.',
      packageName: '@agent-platform/harness',
      timeoutMs: 120_000,
      maxOutputBytes: 20_000,
    });
    expect(CodingRunQualityGateInputSchema.parse(structuredClone(input))).toEqual(input);

    const result = CodingRunQualityGateResultSchema.parse({
      profile: 'test',
      packageName: '@agent-platform/harness',
      repoPath: '/workspace/repo',
      command: ['pnpm', '--filter', '@agent-platform/harness', 'run', 'test'],
      exitCode: 1,
      timedOut: false,
      durationMs: 1250,
      stdoutTail: 'FAIL test/example.test.ts',
      stderrTail: '',
      truncated: false,
      failures: [{ message: 'FAIL test/example.test.ts', file: 'test/example.test.ts' }],
    });
    expect(CodingRunQualityGateResultSchema.parse(structuredClone(result))).toEqual(result);
  });

  it('Coding repository discovery schemas round-trip', () => {
    const repoMapInput = CodingRepoMapInputSchema.parse({
      repoPath: '.',
      maxDepth: 4,
      maxFiles: 200,
    });
    expect(CodingRepoMapInputSchema.parse(structuredClone(repoMapInput))).toEqual(repoMapInput);

    const repoMap = CodingRepoMapResultSchema.parse({
      repoPath: '/workspace/repo',
      totalFiles: 2,
      totalDirectories: 1,
      files: [
        { path: 'apps/web', kind: 'directory' },
        { path: 'apps/web/package.json', kind: 'file', sizeBytes: 42 },
      ],
      packageBoundaries: [{ path: 'apps/web', name: '@agent-platform/web', kind: 'app' }],
      testDirectories: ['apps/web/test'],
      ignoredDirectories: ['node_modules'],
      truncated: false,
    });
    expect(CodingRepoMapResultSchema.parse(structuredClone(repoMap))).toEqual(repoMap);

    const searchInput = CodingCodeSearchInputSchema.parse({
      repoPath: '.',
      query: 'render',
      regex: false,
      caseSensitive: false,
      maxResults: 50,
    });
    expect(CodingCodeSearchInputSchema.parse(structuredClone(searchInput))).toEqual(searchInput);

    const search = CodingCodeSearchResultSchema.parse({
      repoPath: '/workspace/repo',
      query: 'render',
      regex: false,
      matches: [{ path: 'apps/web/src/page.tsx', line: 7, column: 3, snippet: 'render()' }],
      searchedFiles: 10,
      truncated: false,
    });
    expect(CodingCodeSearchResultSchema.parse(structuredClone(search))).toEqual(search);

    const relatedInput = CodingFindRelatedTestsInputSchema.parse({
      repoPath: '.',
      path: 'apps/web/src/page.tsx',
      maxResults: 20,
    });
    expect(CodingFindRelatedTestsInputSchema.parse(structuredClone(relatedInput))).toEqual(
      relatedInput,
    );

    const related = CodingFindRelatedTestsResultSchema.parse({
      repoPath: '/workspace/repo',
      path: 'apps/web/src/page.tsx',
      tests: [{ path: 'apps/web/test/page.test.tsx', reason: 'same basename' }],
      searchedFiles: 10,
      truncated: false,
    });
    expect(CodingFindRelatedTestsResultSchema.parse(structuredClone(related))).toEqual(related);
  });
});
