import type {
  MemoryCandidateEvidence,
  MemoryRecord,
  SelfLearningEvaluateBody,
  SelfLearningEvaluationResult,
  SelfLearningMetrics,
  SelfLearningObservedOutcome,
} from '@agent-platform/contracts';
import {
  compactText,
  SelfLearningEvaluateBodySchema,
  SelfLearningEvaluationResultSchema,
} from '@agent-platform/contracts';

import type { DrizzleDb } from '../database.js';
import { createMemory, queryMemories } from './memories.js';

const WORKSPACE_PATH_ERROR_RE =
  /\b(?:enoent|no such file or directory|stat_failed|read_failed|write_failed|pathjail|path jail|outside (?:the )?workspace|workspace path|missing (?:file|directory|folder))\b/i;

type JsonObject = Record<string, unknown>;

interface LearningSignal {
  id?: string;
  kind: SelfLearningObservedOutcome['kind'];
  message: string;
  atMs?: number;
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (typeof value !== 'object' || value === null) return value;

  const clean: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) clean[key] = stripUndefined(child);
  }
  return clean;
}

function scopeFor(input: SelfLearningEvaluateBody) {
  if (input.projectId) return { scope: 'project' as const, scopeId: input.projectId };
  if (input.agentId) return { scope: 'agent' as const, scopeId: input.agentId };
  return { scope: 'session' as const, scopeId: input.sessionId };
}

function matchesRecoverableWorkspacePathError(message: string): boolean {
  return WORKSPACE_PATH_ERROR_RE.test(message);
}

function candidateSignals(db: DrizzleDb, sessionId: string): LearningSignal[] {
  return queryMemories(db, {
    scope: 'session',
    scopeId: sessionId,
    tag: 'failure',
    includeExpired: true,
    limit: 100,
  }).map((memory) => ({
    id: memory.id,
    kind: 'memory_candidate' as const,
    message: memory.content,
    atMs: memory.createdAtMs,
  }));
}

function existingSelfLearningProposals(db: DrizzleDb, input: SelfLearningEvaluateBody) {
  const scope = scopeFor(input);
  return queryMemories(db, {
    ...scope,
    kind: 'failure_learning',
    tag: 'self-learning',
    includeExpired: true,
    limit: 100,
  }).filter((memory) => selfLearningObjective(memory) === input.objective);
}

function selfLearningObjective(memory: MemoryRecord): string | undefined {
  const selfLearning = memory.metadata['selfLearning'];
  if (typeof selfLearning !== 'object' || selfLearning === null || Array.isArray(selfLearning)) {
    return undefined;
  }
  const objective = (selfLearning as JsonObject)['objective'];
  return typeof objective === 'string' ? objective : undefined;
}

function evidenceFor(signal: LearningSignal): MemoryCandidateEvidence {
  return {
    kind: signal.kind === 'memory_candidate' ? 'observability' : 'observability',
    id: signal.id,
    excerpt: compactText(signal.message, 1000),
    atMs: signal.atMs,
  };
}

function buildMetrics({
  observedSignals,
  matchingSignals,
  candidateSignalsCount,
  existingProposals,
}: {
  observedSignals: number;
  matchingSignals: number;
  candidateSignalsCount: number;
  existingProposals: MemoryRecord[];
}): SelfLearningMetrics {
  return {
    before: {
      observedSignals,
      matchingSignals,
      candidateSignals: candidateSignalsCount,
    },
    after: {
      approvedLearningMemories: existingProposals.filter((memory) => memory.status === 'approved')
        .length,
      existingPendingProposals: existingProposals.filter((memory) => memory.status === 'pending')
        .length,
    },
  };
}

export interface EvaluateSelfLearningOptions {
  nowMs?: number;
}

export function evaluateSelfLearning(
  db: DrizzleDb,
  rawInput: SelfLearningEvaluateBody,
  options: EvaluateSelfLearningOptions = {},
): SelfLearningEvaluationResult {
  const input = SelfLearningEvaluateBodySchema.parse(rawInput);
  const signals = [...input.observedOutcomes, ...candidateSignals(db, input.sessionId)];
  const matchingSignals = signals.filter((signal) =>
    matchesRecoverableWorkspacePathError(signal.message),
  );
  const existingProposals = existingSelfLearningProposals(db, input);
  const metrics = buildMetrics({
    observedSignals: signals.length,
    matchingSignals: matchingSignals.length,
    candidateSignalsCount: signals.filter((signal) => signal.kind === 'memory_candidate').length,
    existingProposals,
  });

  if (matchingSignals.length < input.minOccurrences) {
    return SelfLearningEvaluationResultSchema.parse({
      objective: input.objective,
      proposed: false,
      reason: 'Not enough matching recoverable workspace/path error signals.',
      metrics,
    });
  }

  if (metrics.after.existingPendingProposals > 0) {
    return SelfLearningEvaluationResultSchema.parse({
      objective: input.objective,
      proposed: false,
      reason: 'A pending self-learning proposal already exists for this objective and scope.',
      metrics,
    });
  }

  const scope = scopeFor(input);
  const memory = createMemory(
    db,
    {
      ...scope,
      kind: 'failure_learning',
      status: 'pending',
      reviewStatus: 'unreviewed',
      content:
        'Self-learning candidate: repeated recoverable workspace/path errors were observed. ' +
        'Before running file or quality tools, verify the target path exists inside the active workspace and create missing parent directories only after user intent is clear.',
      confidence: 0.78,
      source: {
        kind: 'observability',
        id: input.sessionId,
        label: 'self-learning evaluator',
        metadata: stripUndefined({
          sessionId: input.sessionId,
          agentId: input.agentId,
          projectId: input.projectId,
          evidence: matchingSignals.slice(0, 5).map(evidenceFor),
        }) as JsonObject,
      },
      tags: ['candidate', 'self-learning', 'workspace-path', 'failure'],
      metadata: {
        candidate: true,
        rationale:
          'The same recoverable workspace/path failure pattern crossed the configured threshold.',
        selfLearning: {
          objective: input.objective,
          status: 'proposed',
          minOccurrences: input.minOccurrences,
          metrics,
          reviewGate:
            'Human review is required before this can become durable memory or drive task/policy changes.',
          allowedActionsAfterApproval: ['durable_memory'],
          blockedAutonomousActions: ['code_change', 'policy_change', 'prompt_change', 'beads_task'],
        },
      },
      safetyState: 'safe',
    },
    { nowMs: options.nowMs },
  );

  return SelfLearningEvaluationResultSchema.parse({
    objective: input.objective,
    proposed: true,
    reason: 'Created a pending self-learning memory candidate for review.',
    metrics,
    memory,
  });
}
