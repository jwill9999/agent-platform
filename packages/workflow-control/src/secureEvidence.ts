import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  evidenceReferenceSchema,
  executionContractSchema,
  workflowRoleSchema,
  type EvidenceReference,
  type ExecutionContract,
  type WorkflowRole,
} from './contracts.js';
import { ProcessCapabilityBroker, type ProcessIdentity } from './authorization.js';
import {
  workflowSecureEvidenceMutationCapability,
  type SecureEvidenceRecord,
  type WorkflowStore,
} from './storage.js';

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const shaSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const supportedMediaTypes = new Set([
  'application/json',
  'application/x-ndjson',
  'image/png',
  'image/webp',
  'text/markdown',
  'text/plain',
]);
const textMediaTypes = new Set([
  'application/json',
  'application/x-ndjson',
  'text/markdown',
  'text/plain',
]);
const directSecretPatterns = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/gu,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/gu,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]{12,}={0,2}\b/giu,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]{8,}@/giu,
  /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/gu,
  /\bAIza[0-9A-Za-z_-]{30,}\b/gu,
];
const secretKeySchema =
  /^(?:api[_-]?key|key|token|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|access[_-]?key|private[_-]?key|authorization|auth|credential|credentials|secret)$/iu;
const keyValueSecretPattern =
  /\b(api[_-]?key|key|token|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|access[_-]?key|private[_-]?key|authorization|auth|credential|credentials|secret)(\s*[:=]\s*)(["']?)(?!\[REDACTED\])[^\s,"']{8,}(["']?)/giu;

export interface SecureEvidenceInput {
  content: Uint8Array;
  mediaType: string;
  kind: EvidenceReference['kind'];
  producer: string;
  producerRole: WorkflowRole;
  workspaceId: string;
  runId: string;
  taskId: string;
  contractVersion: number;
  policyDigest: string;
  headSha: string;
  capability?: EvidenceCapability;
}

export interface EvidenceCapability {
  token: string;
  observedProcess: ProcessIdentity;
}

export interface SecureEvidenceResult {
  reference: EvidenceReference;
  record: SecureEvidenceRecord;
}

function redactText(input: string): { value: string; count: number } {
  let value = input;
  let count = 0;
  for (const pattern of directSecretPatterns) {
    value = value.replace(pattern, () => {
      count += 1;
      return '[REDACTED]';
    });
  }
  value = value.replace(
    keyValueSecretPattern,
    (_match, key: string, separator: string, openQuote: string, closeQuote: string) => {
      count += 1;
      const quote = openQuote !== '' && closeQuote === openQuote ? openQuote : '';
      return `${key}${separator}${quote}[REDACTED]${quote}`;
    },
  );
  return { value, count };
}

function redactJsonValue(value: unknown): { value: unknown; count: number } {
  if (Array.isArray(value)) {
    const items = value.map(redactJsonValue);
    return {
      value: items.map((item) => item.value),
      count: items.reduce((total, item) => total + item.count, 0),
    };
  }
  if (typeof value === 'object' && value !== null) {
    let count = 0;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (secretKeySchema.test(key)) {
        output[key] = '[REDACTED]';
        count += 1;
      } else {
        const redacted = redactJsonValue(item);
        output[key] = redacted.value;
        count += redacted.count;
      }
    }
    return { value: output, count };
  }
  if (typeof value === 'string') {
    const redacted = redactText(value);
    return { value: redacted.value, count: redacted.count };
  }
  return { value, count: 0 };
}

function redact(content: Uint8Array, mediaType: string): { content: Uint8Array; count: number } {
  const rawText = Buffer.from(content).toString('utf8');
  if (mediaType === 'application/json') {
    const redacted = redactJsonValue(JSON.parse(rawText) as unknown);
    return { content: Buffer.from(JSON.stringify(redacted.value)), count: redacted.count };
  }
  if (mediaType === 'application/x-ndjson') {
    let count = 0;
    const lines = rawText.split('\n').map((line) => {
      if (line.trim() === '') return line;
      const redacted = redactJsonValue(JSON.parse(line) as unknown);
      count += redacted.count;
      return JSON.stringify(redacted.value);
    });
    return { content: Buffer.from(lines.join('\n')), count };
  }
  const redacted = redactText(rawText);
  if (textMediaTypes.has(mediaType)) {
    return { content: Buffer.from(redacted.value), count: redacted.count };
  }
  if (redacted.count > 0) throw new Error('binary evidence contains a secret-like value');
  return { content, count: 0 };
}

function assertNoResidualSecrets(content: Uint8Array): void {
  const text = Buffer.from(content).toString('utf8');
  const residual = [...directSecretPatterns, keyValueSecretPattern].some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
  const scanText = text
    .replace(/\bsha256:[a-f0-9]{64}\b/giu, '')
    .replace(/\b(?:commit|head|sha)\s*[:=]\s*[a-f0-9]{40}\b/giu, '');
  const unknownHighEntropy = scanText.match(/[^\s"'`,;:()[\]{}<>]{24,}/gu)?.some((candidate) => {
    const frequencies = new Map<string, number>();
    for (const character of candidate) {
      frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
    }
    const entropy = [...frequencies.values()].reduce((total, count) => {
      const probability = count / candidate.length;
      return total - probability * Math.log2(probability);
    }, 0);
    return entropy >= 3.5;
  });
  if (residual || unknownHighEntropy) {
    throw new Error('evidence failed residual secret scanning');
  }
}

function assertMedia(content: Uint8Array, mediaType: string): void {
  if (!supportedMediaTypes.has(mediaType)) throw new Error('unsupported evidence media type');
  const bytes = Buffer.from(content);
  if (
    mediaType === 'image/png' &&
    !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  ) {
    throw new Error('evidence content does not match its PNG media type');
  }
  if (
    mediaType === 'image/webp' &&
    !(
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  ) {
    throw new Error('evidence content does not match its WebP media type');
  }
  if (mediaType === 'application/json') JSON.parse(bytes.toString('utf8'));
  if (mediaType === 'application/x-ndjson') {
    for (const line of bytes.toString('utf8').split('\n')) {
      if (line.trim() !== '') JSON.parse(line);
    }
  }
}

function canRead(actorRole: WorkflowRole, record: SecureEvidenceRecord): boolean {
  if (actorRole === 'workflow_orchestrator' || actorRole === record.producerRole) return true;
  if (actorRole === 'code_reviewer') return record.kind !== 'artifact';
  if (actorRole === 'feature_evaluator')
    return ['test', 'review', 'evaluation', 'external'].includes(record.kind);
  if (actorRole === 'qa_evaluator') return ['test', 'artifact', 'evaluation'].includes(record.kind);
  return false;
}

export class SecureEvidenceVault {
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;
  readonly #maxBytes: number;
  readonly #maxRunBytes: number;
  readonly #capabilityBroker: ProcessCapabilityBroker | undefined;
  readonly #clock: () => number;

  constructor(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    maxBytes?: number;
    maxRunBytes?: number;
    capabilityBroker?: ProcessCapabilityBroker;
    clock?: () => number;
  }) {
    this.#store = input.store;
    this.#contract = executionContractSchema.parse(input.contract);
    this.#maxBytes = input.maxBytes ?? 1024 * 1024;
    this.#maxRunBytes = input.maxRunBytes ?? 10 * 1024 * 1024;
    this.#capabilityBroker = input.capabilityBroker;
    if (input.clock !== undefined && process.env.NODE_ENV !== 'test') {
      throw new Error('custom evidence clocks are test-only');
    }
    const clock = input.clock ?? Date.now;
    let lastNow = Number.NEGATIVE_INFINITY;
    this.#clock = () => {
      const now = clock();
      if (!Number.isFinite(now) || now < lastNow) {
        throw new Error('evidence clock must be finite and monotonic');
      }
      lastNow = now;
      return now;
    };
    if (!Number.isInteger(this.#maxBytes) || this.#maxBytes <= 0)
      throw new Error('invalid evidence size limit');
    if (!Number.isInteger(this.#maxRunBytes) || this.#maxRunBytes < this.#maxBytes) {
      throw new Error('invalid per-run evidence size limit');
    }
  }

  async record(input: SecureEvidenceInput): Promise<SecureEvidenceResult> {
    workflowRoleSchema.parse(input.producerRole);
    if (input.content.byteLength === 0 || input.content.byteLength > this.#maxBytes) {
      throw new Error('evidence size is outside the approved bound');
    }
    assertMedia(input.content, input.mediaType);
    if (
      input.workspaceId !== this.#contract.workspaceId ||
      input.contractVersion !== this.#contract.contractVersion ||
      input.policyDigest !== this.#contract.policyDigest
    ) {
      throw new Error('evidence changes its execution contract binding');
    }
    const task = this.#store.getAuthorizedRunTask(
      input.runId,
      input.taskId,
      workflowSecureEvidenceMutationCapability,
    );
    if (task === undefined || !task.allowedOperations.includes('artifact.write')) {
      throw new Error('task lacks evidence write authority');
    }
    this.#assertCapability(
      input.capability,
      input.producerRole,
      'artifact.write',
      task.allowedPaths[0] ?? this.#contract.constraints.allowedPaths[0],
      input.runId,
    );
    shaSchema.parse(input.headSha);
    this.#store.assertApprovedEvaluationHead(
      {
        workspaceId: input.workspaceId,
        runId: input.runId,
        taskId: input.taskId,
        headSha: input.headSha,
      },
      workflowSecureEvidenceMutationCapability,
    );
    const createdAtMs = this.#clock();
    if (!Number.isFinite(createdAtMs)) throw new Error('evidence clock must be finite');
    const retentionUntilMs = createdAtMs + 30 * 24 * 60 * 60 * 1000;
    const processed = redact(input.content, input.mediaType);
    assertNoResidualSecrets(processed.content);
    assertMedia(processed.content, input.mediaType);
    if (processed.content.byteLength === 0 || processed.content.byteLength > this.#maxBytes) {
      throw new Error('redacted evidence size is outside the approved bound');
    }
    const expectedDigest = `sha256:${createHash('sha256').update(processed.content).digest('hex')}`;
    const existing = this.#store.getSecureEvidence(expectedDigest, input.runId, input.taskId);
    if (existing !== undefined && existing.deletedAtMs !== null) {
      throw new Error('tombstoned secure evidence cannot be recreated');
    }
    if (
      existing === undefined &&
      this.#store.sumLiveSecureEvidenceBytes(input.runId) + processed.content.byteLength >
        this.#maxRunBytes
    ) {
      throw new Error('evidence exceeds the approved per-run size bound');
    }
    const record = this.#store.recordSecureEvidence(
      {
        digest: expectedDigest,
        workspaceId: input.workspaceId,
        runId: input.runId,
        taskId: input.taskId,
        mediaType: input.mediaType,
        sizeBytes: processed.content.byteLength,
        kind: input.kind,
        producer: input.producer,
        producerRole: input.producerRole,
        contractVersion: input.contractVersion,
        policyDigest: input.policyDigest,
        headSha: input.headSha,
        redactionCount: processed.count,
        retentionClass: 'raw',
        retentionUntilMs,
        createdAtMs,
      },
      processed.content,
      this.#maxRunBytes,
      workflowSecureEvidenceMutationCapability,
    );
    this.#store.recordEvidence({
      digest: record.digest,
      mediaType: record.mediaType,
      sizeBytes: record.sizeBytes,
      kind: record.kind,
      producer: record.producer,
      producerRole: record.producerRole,
      workspaceId: record.workspaceId,
      runId: record.runId,
      taskId: record.taskId,
      contractVersion: record.contractVersion,
      policyDigest: record.policyDigest,
      headSha: record.headSha,
      createdAtMs: record.createdAtMs,
    });
    const reference = evidenceReferenceSchema.parse({
      digest: record.digest,
      mediaType: record.mediaType,
      sizeBytes: record.sizeBytes,
      kind: record.kind,
    });
    return { reference, record };
  }

  async read(input: {
    digest: string;
    runId: string;
    taskId: string;
    actorRole?: WorkflowRole;
    capability?: EvidenceCapability;
  }): Promise<Uint8Array> {
    digestSchema.parse(input.digest);
    const record = this.#store.getSecureEvidence(input.digest, input.runId, input.taskId);
    if (record === undefined || record.deletedAtMs !== null)
      throw new Error('secure evidence is unavailable');
    const actorRole = this.#assertCapability(
      input.capability,
      input.actorRole,
      'workspace.read',
      this.#contract.constraints.allowedPaths[0],
      input.runId,
    );
    if (!canRead(actorRole, record))
      throw new Error('role is not authorized to read this evidence');
    return this.#store.getSecureEvidenceBlob(
      input.digest,
      workflowSecureEvidenceMutationCapability,
    );
  }

  accept(input: {
    digest: string;
    runId: string;
    taskId: string;
    actorRole?: WorkflowRole;
    capability?: EvidenceCapability;
  }): SecureEvidenceRecord {
    const actorRole = this.#assertCapability(
      input.capability,
      input.actorRole,
      'workspace.read',
      this.#contract.constraints.allowedPaths[0],
      input.runId,
    );
    if (!['workflow_orchestrator', 'qa_evaluator', 'feature_evaluator'].includes(actorRole)) {
      throw new Error('secure evidence acceptance requires an evaluator or orchestrator role');
    }
    return this.#store.acceptSecureEvidence(
      {
        digest: input.digest,
        runId: input.runId,
        taskId: input.taskId,
        acceptedAtMs: this.#clock(),
      },
      workflowSecureEvidenceMutationCapability,
    );
  }

  async delete(input: {
    digest: string;
    runId: string;
    taskId: string;
    actorRole?: WorkflowRole;
    capability?: EvidenceCapability;
  }): Promise<SecureEvidenceRecord> {
    const actorRole = this.#assertCapability(
      input.capability,
      input.actorRole,
      'workspace.read',
      this.#contract.constraints.allowedPaths[0],
      input.runId,
    );
    if (actorRole !== 'workflow_orchestrator') {
      throw new Error('secure evidence deletion requires the orchestrator role');
    }
    const deletedAtMs = this.#clock();
    const tombstoneDigest = `sha256:${createHash('sha256')
      .update(JSON.stringify([input.digest, input.runId, input.taskId, deletedAtMs, 'deleted']))
      .digest('hex')}`;
    const record = this.#store.tombstoneSecureEvidence(
      {
        digest: input.digest,
        runId: input.runId,
        taskId: input.taskId,
        deletedAtMs,
        tombstoneDigest,
      },
      workflowSecureEvidenceMutationCapability,
    );
    return record;
  }

  #assertCapability(
    capability: EvidenceCapability | undefined,
    claimedRole: WorkflowRole | undefined,
    operation: 'artifact.write' | 'workspace.read',
    path: string | undefined,
    runId: string,
  ): WorkflowRole {
    if (capability !== undefined && this.#capabilityBroker !== undefined && path !== undefined) {
      const decision = this.#capabilityBroker.authorize(
        capability.token,
        capability.observedProcess,
        {
          workspaceId: this.#contract.workspaceId,
          runId,
          contractVersion: this.#contract.contractVersion,
          policyDigest: this.#contract.policyDigest,
          operation,
          normalizedArguments: { path },
          nowMs: this.#clock(),
        },
      );
      if (!decision.allowed || decision.role === undefined) {
        throw new Error(`evidence ${operation} capability is denied`);
      }
      const role = workflowRoleSchema.parse(decision.role);
      if (claimedRole !== undefined && claimedRole !== role) {
        throw new Error('evidence role differs from the authenticated capability');
      }
      return role;
    }
    if (process.env.NODE_ENV === 'test' && claimedRole !== undefined) {
      return workflowRoleSchema.parse(claimedRole);
    }
    throw new Error(`evidence ${operation} requires an authenticated process capability`);
  }
}
