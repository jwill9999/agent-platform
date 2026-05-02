import type {
  ExtractedMemoryCandidate,
  MemoryCandidateEvidence,
  MemoryCandidateExtractionInput,
  MemoryCandidateMessage,
  MemoryKind,
  MemorySafetyState,
} from '@agent-platform/contracts';
import {
  compactText,
  ExtractedMemoryCandidateSchema,
  MemoryCandidateExtractionInputSchema,
  parseStructuredToolError,
} from '@agent-platform/contracts';

import type { DrizzleDb } from '../database.js';
import { createMemory } from './memories.js';
import { redactCredentialText } from './memoryRedaction.js';
import { findProject } from './projects.js';

const EXPLICIT_REMEMBER_RE =
  /\b(?:remember|please remember|make a note|note that|save this)\b[:\s-]*(?<content>.+)/i;
const CORRECTION_RE =
  /\b(?:actually|correction|to be clear|instead|not quite|wrong|should have|should be|do not|don't)\b/i;
const REMEDIATION_RE = /\b(?:fixed|resolved|corrected|updated|passing|green|works now)\b/i;

export interface CreateMemoryCandidatesOptions {
  nowMs?: number;
}

interface RedactedText {
  content: string;
  safetyState: MemorySafetyState;
}

type JsonObject = Record<string, unknown>;

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (typeof value !== 'object' || value === null) return value;

  const clean: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) clean[key] = stripUndefined(child);
  }
  return clean;
}

function redactCandidateText(content: string): RedactedText {
  const result = redactCredentialText(content);
  return { content: result.value, safetyState: result.wasRedacted ? 'redacted' : 'safe' };
}

function inferKind(content: string): MemoryKind {
  if (/\bprefer|preference|always|never\b/i.test(content)) return 'preference';
  if (/\bdecided|decision|use|keep|standardise|standardize\b/i.test(content)) return 'decision';
  return 'working_note';
}

function inferScope(input: MemoryCandidateExtractionInput) {
  if (input.projectId) {
    return { scope: 'project' as const, scopeId: input.projectId, projectId: input.projectId };
  }
  if (input.agentId) return { scope: 'agent' as const, scopeId: input.agentId };
  return { scope: 'session' as const, scopeId: input.sessionId };
}

function evidenceFor(message: MemoryCandidateMessage): MemoryCandidateEvidence {
  const redacted = redactCandidateText(compactText(message.content, 1000));
  return {
    kind:
      message.role === 'tool'
        ? 'tool_result'
        : message.role === 'assistant'
          ? 'assistant_message'
          : message.role === 'system'
            ? 'observability'
            : 'user_message',
    id: message.id,
    excerpt: redacted.content,
    atMs: message.createdAtMs,
  };
}

function redactEvidence(evidence: MemoryCandidateEvidence[]): {
  evidence: MemoryCandidateEvidence[];
  wasRedacted: boolean;
} {
  let wasRedacted = false;
  return {
    evidence: evidence.map((entry) => {
      const redacted = redactCandidateText(entry.excerpt);
      wasRedacted ||= redacted.safetyState === 'redacted';
      return { ...entry, excerpt: redacted.content };
    }),
    wasRedacted,
  };
}

function candidateFrom({
  input,
  message,
  content,
  kind,
  confidence,
  rationale,
  tags,
  evidence,
}: {
  input: MemoryCandidateExtractionInput;
  message: MemoryCandidateMessage;
  content: string;
  kind: MemoryKind;
  confidence: number;
  rationale: string;
  tags: string[];
  evidence?: MemoryCandidateEvidence[];
}): ExtractedMemoryCandidate {
  const redacted = redactCandidateText(compactText(content, 2000));
  const redactedEvidence = redactEvidence(evidence ?? [evidenceFor(message)]);
  return ExtractedMemoryCandidateSchema.parse({
    ...inferScope(input),
    kind,
    content: redacted.content,
    confidence,
    rationale,
    evidence: redactedEvidence.evidence,
    tags,
    safetyState:
      redacted.safetyState === 'redacted' || redactedEvidence.wasRedacted ? 'redacted' : 'safe',
  });
}

function explicitRememberCandidate(
  input: MemoryCandidateExtractionInput,
  message: MemoryCandidateMessage,
): ExtractedMemoryCandidate | undefined {
  const match = message.content.match(EXPLICIT_REMEMBER_RE);
  const rawContent = match?.groups?.['content'];
  if (!rawContent || rawContent.trim().length < 8) return undefined;

  return candidateFrom({
    input,
    message,
    content: rawContent,
    kind: inferKind(rawContent),
    confidence: 0.84,
    rationale: 'The user explicitly asked the agent to remember this information.',
    tags: ['candidate', 'explicit'],
  });
}

function correctionCandidate(
  input: MemoryCandidateExtractionInput,
  message: MemoryCandidateMessage,
): ExtractedMemoryCandidate | undefined {
  if (!CORRECTION_RE.test(message.content) || message.content.trim().length < 12) return undefined;

  return candidateFrom({
    input,
    message,
    content: `User correction: ${message.content}`,
    kind: 'correction',
    confidence: 0.72,
    rationale: 'The user phrased this turn as a correction or replacement instruction.',
    tags: ['candidate', 'correction'],
  });
}

function parseToolError(message: MemoryCandidateMessage): string | undefined {
  if (message.role !== 'tool') return undefined;
  const structuredError = parseStructuredToolError(message.content);
  if (structuredError) return structuredError;
  return /\b(error|failed|enoent|exception|timeout)\b/i.test(message.content)
    ? message.content
    : undefined;
}

function repeatedFailureCandidates(
  input: MemoryCandidateExtractionInput,
): ExtractedMemoryCandidate[] {
  const failures = input.messages
    .map((message) => ({ message, error: parseToolError(message) }))
    .filter((entry): entry is { message: MemoryCandidateMessage; error: string } =>
      Boolean(entry.error),
    );
  const bySignature = new Map<string, Array<{ message: MemoryCandidateMessage; error: string }>>();
  for (const failure of failures) {
    const signature = compactText(failure.error.toLowerCase(), 120);
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), failure]);
  }

  const candidates: ExtractedMemoryCandidate[] = [];
  for (const entries of bySignature.values()) {
    if (entries.length < 2) continue;
    const first = entries[0]!;
    candidates.push(
      candidateFrom({
        input,
        message: first.message,
        content: `Repeated runtime failure observed: ${first.error}`,
        kind: 'failure_learning',
        confidence: 0.68,
        rationale: 'The same tool/runtime failure appeared more than once in the session.',
        tags: ['candidate', 'failure', 'repeated'],
        evidence: entries.slice(0, 5).map((entry) => evidenceFor(entry.message)),
      }),
    );
  }
  return candidates;
}

function remediationCandidate(
  input: MemoryCandidateExtractionInput,
): ExtractedMemoryCandidate | undefined {
  const failure = input.messages
    .map((message) => ({ message, error: parseToolError(message) }))
    .find((entry): entry is { message: MemoryCandidateMessage; error: string } =>
      Boolean(entry.error),
    );
  if (!failure) return undefined;

  const remediation = input.messages.find(
    (message) => message.role === 'assistant' && REMEDIATION_RE.test(message.content),
  );
  if (!remediation) return undefined;

  return candidateFrom({
    input,
    message: remediation,
    content: `Failure learning: ${failure.error}. Remediation: ${remediation.content}`,
    kind: 'failure_learning',
    confidence: 0.74,
    rationale: 'A failed tool/runtime result was followed by an assistant remediation statement.',
    tags: ['candidate', 'failure', 'remediation'],
    evidence: [evidenceFor(failure.message), evidenceFor(remediation)],
  });
}

function dedupeCandidates(candidates: ExtractedMemoryCandidate[]): ExtractedMemoryCandidate[] {
  const seen = new Set<string>();
  const deduped: ExtractedMemoryCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.scope}:${candidate.scopeId ?? ''}:${candidate.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

export function extractMemoryCandidates(
  rawInput: MemoryCandidateExtractionInput,
): ExtractedMemoryCandidate[] {
  const input = MemoryCandidateExtractionInputSchema.parse(rawInput);
  const candidates: ExtractedMemoryCandidate[] = [];

  for (const message of input.messages) {
    if (message.role !== 'user') continue;
    const explicit = explicitRememberCandidate(input, message);
    if (explicit) candidates.push(explicit);

    const correction = correctionCandidate(input, message);
    if (correction) candidates.push(correction);
  }

  candidates.push(...repeatedFailureCandidates(input));
  const remediation = remediationCandidate(input);
  if (remediation) candidates.push(remediation);

  return dedupeCandidates(candidates);
}

export function createMemoryCandidates(
  db: DrizzleDb,
  rawInput: MemoryCandidateExtractionInput,
  options: CreateMemoryCandidatesOptions = {},
) {
  const input = MemoryCandidateExtractionInputSchema.parse(rawInput);
  return extractMemoryCandidates(input).map((candidate) => {
    const projectId =
      candidate.projectId && findProject(db, candidate.projectId) ? candidate.projectId : undefined;
    return createMemory(
      db,
      {
        scope: candidate.scope,
        scopeId: candidate.scopeId,
        projectId,
        kind: candidate.kind,
        status: 'pending',
        reviewStatus: 'unreviewed',
        content: candidate.content,
        confidence: candidate.confidence,
        source: {
          kind: 'observability',
          id: input.sessionId,
          label: 'memory candidate extractor',
          metadata: stripUndefined({
            sessionId: input.sessionId,
            agentId: input.agentId,
            evidence: candidate.evidence,
          }) as JsonObject,
        },
        tags: candidate.tags,
        metadata: {
          candidate: true,
          rationale: candidate.rationale,
          scopeSuggestion: {
            scope: candidate.scope,
            scopeId: candidate.scopeId,
          },
        },
        safetyState: candidate.safetyState,
      },
      { nowMs: options.nowMs },
    );
  });
}
