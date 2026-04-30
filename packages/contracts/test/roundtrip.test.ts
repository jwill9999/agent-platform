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
  CodingToolEnvelopeSchema,
  CriticVerdictSchema,
  ExecutionLimitsSchema,
  HealthResponseSchema,
  OutputSchema,
  PlanSchema,
  SecretRefSchema,
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
});
