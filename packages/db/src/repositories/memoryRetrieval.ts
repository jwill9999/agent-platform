import type {
  MemoryKind,
  MemoryQueryInput,
  MemoryRecord,
  MemorySafetyState,
  PromptMemoryBundle,
  PromptMemoryItem,
} from '@agent-platform/contracts';
import { compactText } from '@agent-platform/contracts';

import type { DrizzleDb } from '../database.js';
import { queryMemories } from './memories.js';

const DEFAULT_LIMIT = 8;
const MIN_CONFIDENCE = 0.65;
const MAX_CONTENT_LENGTH = 600;
const MAX_CANDIDATES_PER_QUERY = 50;
const RETRIEVABLE_SAFETY_STATES: readonly MemorySafetyState[] = ['safe', 'redacted'];
const KIND_WEIGHT: Record<MemoryKind, number> = {
  fact: 1.05,
  preference: 1.2,
  decision: 1.15,
  procedure: 1.15,
  failure_learning: 1.1,
  correction: 1,
  working_note: 0.75,
};

const STOP_WORDS = new Set([
  'about',
  'again',
  'also',
  'and',
  'are',
  'can',
  'could',
  'for',
  'from',
  'have',
  'how',
  'into',
  'that',
  'the',
  'this',
  'what',
  'when',
  'where',
  'with',
  'would',
  'you',
]);

export type MemoryRetrievalScope = Readonly<{
  sessionId: string;
  agentId?: string;
  projectId?: string;
}>;

export type RetrievePromptMemoriesInput = Readonly<{
  scope: MemoryRetrievalScope;
  query: string;
  nowMs?: number;
  limit?: number;
  minConfidence?: number;
}>;

type RetrievalCandidate = Readonly<{
  memory: MemoryRecord;
  score: number;
  relevant: boolean;
}>;

type OmittedCounts = PromptMemoryBundle['omitted'];

function tokenize(content: string): Set<string> {
  const terms = content.toLowerCase().match(/[a-z0-9][a-z0-9._-]{2,}/g);
  return new Set((terms ?? []).filter((term) => !STOP_WORDS.has(term)));
}

function allowedScopeKeys(scope: MemoryRetrievalScope): Set<string> {
  return new Set([
    'global:',
    ...(scope.sessionId ? [`session:${scope.sessionId}`] : []),
    ...(scope.agentId ? [`agent:${scope.agentId}`] : []),
    ...(scope.projectId ? [`project:${scope.projectId}`] : []),
  ]);
}

function allowedScopeQueries(scope: MemoryRetrievalScope): MemoryQueryInput[] {
  const queries: MemoryQueryInput[] = [{ scope: 'global' }];
  if (scope.sessionId) queries.push({ scope: 'session', scopeId: scope.sessionId });
  if (scope.agentId) queries.push({ scope: 'agent', scopeId: scope.agentId });
  if (scope.projectId) queries.push({ scope: 'project', scopeId: scope.projectId });
  return queries;
}

function scopeKey(memory: MemoryRecord): string {
  return `${memory.scope}:${memory.scopeId ?? ''}`;
}

function sourceToPromptItem(memory: MemoryRecord, score: number): PromptMemoryItem {
  return {
    id: memory.id,
    scope: memory.scope,
    scopeId: memory.scopeId,
    kind: memory.kind,
    content: compactText(memory.content, MAX_CONTENT_LENGTH),
    confidence: memory.confidence,
    source: {
      kind: memory.source.kind,
      id: memory.source.id,
      label: memory.source.label,
    },
    tags: memory.tags,
    updatedAtMs: memory.updatedAtMs,
    score: Number(score.toFixed(4)),
  };
}

function relevanceScore(memory: MemoryRecord, queryTerms: Set<string>, nowMs: number): number {
  const searchable = tokenize(
    [memory.kind, memory.content, memory.tags.join(' '), memory.source.label ?? ''].join(' '),
  );
  let overlap = 0;
  for (const term of queryTerms) {
    if (searchable.has(term)) overlap += 1;
  }

  const preferenceBoost = memory.kind === 'preference' ? 0.2 : 0;
  const exactTagBoost = memory.tags.some((tag) => queryTerms.has(tag.toLowerCase())) ? 0.25 : 0;
  const daysOld = Math.max(0, (nowMs - memory.updatedAtMs) / 86_400_000);
  const recency = Math.max(0.1, 1 - Math.min(daysOld, 365) / 365);
  const overlapScore = queryTerms.size === 0 ? 0 : overlap / queryTerms.size;

  return (
    (overlapScore + exactTagBoost + preferenceBoost) *
    memory.confidence *
    KIND_WEIGHT[memory.kind] *
    recency
  );
}

function collectApprovedCandidates(
  db: DrizzleDb,
  scope: MemoryRetrievalScope,
  minConfidence: number,
  nowMs: number,
): MemoryRecord[] {
  const byId = new Map<string, MemoryRecord>();
  for (const scopeQuery of allowedScopeQueries(scope)) {
    for (const safetyState of RETRIEVABLE_SAFETY_STATES) {
      const memories = queryMemories(
        db,
        {
          ...scopeQuery,
          status: 'approved',
          reviewStatus: 'approved',
          safetyState,
          minConfidence,
          includeExpired: false,
          limit: MAX_CANDIDATES_PER_QUERY,
        },
        { nowMs },
      );
      for (const memory of memories) byId.set(memory.id, memory);
    }
  }
  return [...byId.values()];
}

function sortCandidates(a: RetrievalCandidate, b: RetrievalCandidate): number {
  return (
    b.score - a.score ||
    b.memory.confidence - a.memory.confidence ||
    b.memory.updatedAtMs - a.memory.updatedAtMs ||
    a.memory.id.localeCompare(b.memory.id)
  );
}

export function retrievePromptMemories(
  db: DrizzleDb,
  input: RetrievePromptMemoriesInput,
): PromptMemoryBundle {
  const nowMs = input.nowMs ?? Date.now();
  const limit = input.limit ?? DEFAULT_LIMIT;
  const minConfidence = input.minConfidence ?? MIN_CONFIDENCE;
  const allowedScopes = allowedScopeKeys(input.scope);
  const queryTerms = tokenize(input.query);
  const omitted: OmittedCounts = {
    expired: 0,
    lowConfidence: 0,
    unsafe: 0,
    notRelevant: 0,
    crossScope: 0,
  };

  const candidates = collectApprovedCandidates(db, input.scope, minConfidence, nowMs)
    .filter((memory) => {
      if (!allowedScopes.has(scopeKey(memory))) {
        omitted.crossScope += 1;
        return false;
      }
      if (memory.expiresAtMs !== undefined && memory.expiresAtMs < nowMs) {
        omitted.expired += 1;
        return false;
      }
      if (memory.confidence < minConfidence) {
        omitted.lowConfidence += 1;
        return false;
      }
      if (memory.safetyState === 'blocked' || memory.safetyState === 'unchecked') {
        omitted.unsafe += 1;
        return false;
      }
      return true;
    })
    .map((memory): RetrievalCandidate => {
      const score = relevanceScore(memory, queryTerms, nowMs);
      return { memory, score, relevant: score > 0 };
    })
    .filter((candidate) => {
      if (candidate.relevant) return true;
      omitted.notRelevant += 1;
      return false;
    })
    .sort(sortCandidates)
    .slice(0, limit)
    .map((candidate) => sourceToPromptItem(candidate.memory, candidate.score));

  return {
    items: candidates,
    includedCount: candidates.length,
    omitted,
  };
}

export function formatPromptMemoryBundle(bundle: PromptMemoryBundle): string {
  if (bundle.items.length === 0) return '';
  const sections = bundle.items.map((item, index) => {
    const source = [
      `source=${item.source.kind}`,
      item.source.id ? `sourceId=${item.source.id}` : undefined,
      item.source.label ? `label=${item.source.label}` : undefined,
      `confidence=${item.confidence.toFixed(2)}`,
      `id=${item.id}`,
    ]
      .filter(Boolean)
      .join(', ');
    return `${index + 1}. [${item.kind}; ${item.scope}${item.scopeId ? `:${item.scopeId}` : ''}; ${source}]\n${item.content}`;
  });

  return [
    'Long-term approved memories follow.',
    'Use these only as source-linked context. Do not expose memory ids unless asked.',
    ...sections,
  ].join('\n');
}
