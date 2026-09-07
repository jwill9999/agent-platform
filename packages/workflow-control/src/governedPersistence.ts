import { workflowGovernedPersistenceCapability, type WorkflowStore } from './storage.js';
import { isProductionBeadsPort } from './beadsPortCapability.js';
import { OfficialBeadsDoltPort } from './reconciliation.js';
import {
  digestGovernedValue,
  lineageImportSchema,
  type ApprovalNotificationJournal,
  type DelegateCallbackStore,
  type LineageImport,
} from './governedOperations.js';

export interface TrustedLineageObservation {
  sourceRunId: string;
  sourceTaskId: string;
  sourceState: 'cancelled';
  sourceFenced: true;
  sourcePreparedOperationCount: 0;
  ref: string;
  headSha: string;
  treeSha: string;
  implementationArtifactDigest: string;
  beadsSnapshotDigest: string;
  materialDigest: string;
  observationDigest: string;
}

export interface TrustedLineageObservationPort {
  observe(request: LineageImport): Promise<TrustedLineageObservation>;
}

const trustedLineagePorts = new WeakSet<object>();
const productionLineageCapability = Symbol('productionLineageCapability');
const productionLineageGitPorts = new WeakSet<object>();
const productionLineageEvidencePorts = new WeakSet<object>();

export class OfficialLineageGitObservationPort {
  constructor(
    readonly observeRef: (ref: string) => Promise<{ headSha: string; treeSha: string }>,
    capability: symbol,
  ) {
    if (capability !== productionLineageCapability) {
      throw new Error('lineage Git observation requires the package bootstrap capability');
    }
    productionLineageGitPorts.add(this);
    Object.freeze(this);
  }
}

export class OfficialLineageEvidenceObservationPort {
  constructor(
    readonly observeImplementation: (input: {
      sourceRunId: string;
      sourceTaskId: string;
      headSha: string;
    }) => Promise<{ implementationArtifactDigest: string; materialDigest: string }>,
    capability: symbol,
  ) {
    if (capability !== productionLineageCapability) {
      throw new Error('lineage evidence observation requires the package bootstrap capability');
    }
    productionLineageEvidencePorts.add(this);
    Object.freeze(this);
  }
}

Object.freeze(OfficialLineageGitObservationPort.prototype);
Object.freeze(OfficialLineageEvidenceObservationPort.prototype);

// Package-internal construction helpers. Deliberately omitted from the package index.
export function createProductionLineageGitObservationPort(
  observeRef: OfficialLineageGitObservationPort['observeRef'],
): OfficialLineageGitObservationPort {
  return new OfficialLineageGitObservationPort(observeRef, productionLineageCapability);
}

export function createProductionLineageEvidenceObservationPort(
  observeImplementation: OfficialLineageEvidenceObservationPort['observeImplementation'],
): OfficialLineageEvidenceObservationPort {
  return new OfficialLineageEvidenceObservationPort(
    observeImplementation,
    productionLineageCapability,
  );
}

function createTrustedLineageObservationPort(clients: {
  git: { observeRef(ref: string): Promise<{ headSha: string; treeSha: string }> };
  evidence: {
    observeImplementation(input: {
      sourceRunId: string;
      sourceTaskId: string;
      headSha: string;
    }): Promise<{ implementationArtifactDigest: string; materialDigest: string }>;
  };
  beads: {
    observeTask(input: {
      taskId: string;
      sourceRunId: string;
    }): Promise<{ snapshotDigest: string }>;
  };
}): TrustedLineageObservationPort {
  const port = Object.freeze({
    async observe(request: LineageImport): Promise<TrustedLineageObservation> {
      const git = await clients.git.observeRef(request.ref);
      const evidence = await clients.evidence.observeImplementation({
        sourceRunId: request.sourceRunId,
        sourceTaskId: request.sourceTaskId,
        headSha: git.headSha,
      });
      const beads = await clients.beads.observeTask({
        taskId: request.sourceTaskId,
        sourceRunId: request.sourceRunId,
      });
      const identity = {
        sourceRunId: request.sourceRunId,
        sourceTaskId: request.sourceTaskId,
        sourceState: 'cancelled' as const,
        sourceFenced: true as const,
        sourcePreparedOperationCount: 0 as const,
        ref: request.ref,
        headSha: git.headSha,
        treeSha: git.treeSha,
        implementationArtifactDigest: evidence.implementationArtifactDigest,
        beadsSnapshotDigest: beads.snapshotDigest,
        materialDigest: evidence.materialDigest,
      };
      return { ...identity, observationDigest: digestGovernedValue(identity) };
    },
  });
  trustedLineagePorts.add(port);
  return port;
}

export function createTrustedLineageObservationPortForTest(
  clients: Parameters<typeof createTrustedLineageObservationPort>[0],
): TrustedLineageObservationPort {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('test lineage observation composition is unavailable outside tests');
  }
  return createTrustedLineageObservationPort(clients);
}

// Package-internal production composition over capability-authenticated concrete observers.
export function createProductionTrustedLineageObservationPort(input: {
  git: OfficialLineageGitObservationPort;
  evidence: OfficialLineageEvidenceObservationPort;
  beads: OfficialBeadsDoltPort;
}): TrustedLineageObservationPort {
  if (
    !productionLineageGitPorts.has(input.git) ||
    !productionLineageEvidencePorts.has(input.evidence) ||
    !isProductionBeadsPort(input.beads) ||
    Object.getPrototypeOf(input.beads) !== OfficialBeadsDoltPort.prototype
  ) {
    throw new Error('production lineage requires authenticated concrete observation ports');
  }
  return createTrustedLineageObservationPort({
    git: input.git,
    evidence: input.evidence,
    beads: {
      async observeTask({ taskId }) {
        const issue = await input.beads.readIssueWithNotes(taskId);
        return { snapshotDigest: digestGovernedValue(issue) };
      },
    },
  });
}

export function createWorkflowStoreApprovalNotificationJournal(
  store: WorkflowStore,
  clock: () => number = Date.now,
): ApprovalNotificationJournal {
  return {
    prepare(event) {
      return store.prepareApprovalNotification(
        event,
        clock(),
        workflowGovernedPersistenceCapability,
      );
    },
    get(eventId) {
      return store.getApprovalNotification(eventId);
    },
    compareAndSwap(input) {
      return store.casApprovalNotification(
        { ...input, nowMs: clock() },
        workflowGovernedPersistenceCapability,
      );
    },
  };
}

export function createWorkflowStoreDelegateCallbackStore(input: {
  store: WorkflowStore;
  ownerId: string;
  clock?: () => number;
}): DelegateCallbackStore {
  const clock = input.clock ?? Date.now;
  return {
    recordAndTransition({ callback, target }) {
      return input.store.recordDelegateCallbackAndTransition(
        { callback, target, ownerId: input.ownerId, nowMs: clock() },
        workflowGovernedPersistenceCapability,
      );
    },
    markParentWoken(acceptance) {
      input.store.markDelegateParentWoken(
        { ...acceptance, nowMs: clock() },
        workflowGovernedPersistenceCapability,
      );
    },
    listPendingWakeups() {
      return input.store.listPendingDelegateWakeups(workflowGovernedPersistenceCapability);
    },
  };
}

export async function importWorkflowLineage(input: {
  store: WorkflowStore;
  request: unknown;
  observationPort: TrustedLineageObservationPort;
  ownerId: string;
  operationId: string;
  nowMs?: number;
  testFault?: (boundary: 'after_journal' | 'after_ledger') => void;
}) {
  if (input.testFault !== undefined && process.env.NODE_ENV !== 'test') {
    throw new Error('lineage fault injection is unavailable outside tests');
  }
  if (!trustedLineagePorts.has(input.observationPort as object)) {
    throw new Error('lineage import requires trusted composition-root observation port');
  }
  const request = lineageImportSchema.parse(input.request);
  const observation = await input.observationPort.observe(request);
  const { observationDigest, ...identity } = observation;
  if (observationDigest !== digestGovernedValue(identity)) {
    throw new Error('lineage observation attestation is invalid');
  }
  const expected = {
    sourceRunId: request.sourceRunId,
    sourceTaskId: request.sourceTaskId,
    sourceState: request.sourceState,
    sourceFenced: request.sourceFenced,
    sourcePreparedOperationCount: request.sourcePreparedOperationCount,
    ref: request.ref,
    headSha: request.headSha,
    treeSha: request.treeSha,
    implementationArtifactDigest: request.implementationArtifactDigest,
    beadsSnapshotDigest: request.beadsSnapshotDigest,
    materialDigest: request.materialDigest,
  };
  if (JSON.stringify(identity) !== JSON.stringify(expected)) {
    throw new Error('lineage trusted observation differs from requested source material');
  }
  return input.store.importWorkflowLineage(
    {
      request: input.request,
      ownerId: input.ownerId,
      operationId: input.operationId,
      nowMs: input.nowMs ?? Date.now(),
      testFault: input.testFault,
    },
    workflowGovernedPersistenceCapability,
  );
}
