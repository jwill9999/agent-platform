import {
  establishDocumentSource,
  resolveDocumentSource,
  type DocumentSourceIdentity,
} from './documentSources.js';
import { createHash, randomUUID } from 'node:crypto';
import {
  readFileSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
  lstatSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { TaskPacket } from './contracts.js';
import type Database from 'better-sqlite3';
import { executionContractSchema } from './contracts.js';
import { deriveContractMaterialDigest } from './planning.js';
import { planningDocumentsDigest, type PlanningDocuments } from './planningDocuments.js';
import { stagePreapprovalMaterial } from './preapprovalMaterial.js';

/** Recheck durable authority under the transaction that dispatches or adopts the effect. */
export function assertDocumentAuthority(
  database: Database.Database,
  runId: string,
  approvalId: string,
): void {
  const current = binding(database, runId);
  if (
    !database
      .prepare(
        "SELECT 1 FROM plan_approvals WHERE id=? AND run_id=? AND status='active' AND material_digest=? AND policy_digest=?",
      )
      .get(approvalId, runId, current.materialDigest, current.policyDigest)
  )
    throw new Error('document_approval_changed');
  if (
    database
      .prepare(
        "SELECT 1 FROM planning_document_attempts a JOIN runs r ON r.id=a.run_id WHERE r.contract_id=? AND a.status='pending'",
      )
      .get(current.contractId)
  )
    throw new Error('document_verification_unresolved');
}

export function assertDocumentApprovalCandidate(
  database: Database.Database,
  runId: string,
  materialDigest: string,
): void {
  const current = binding(database, runId);
  if (current.materialDigest !== materialDigest) throw new Error('document_approval_changed');
  const unresolved = database
    .prepare(
      `SELECT a.status FROM planning_document_attempts a
    JOIN runs r ON r.id=a.run_id WHERE r.contract_id=? AND a.status IN ('pending','invalidated','recovered') LIMIT 1`,
    )
    .get(current.contractId) as { status: string } | undefined;
  if (unresolved)
    throw new Error(
      unresolved.status === 'pending'
        ? 'document_verification_unresolved'
        : 'document_new_contract_required',
    );
}

/** Lives in the workflow journal; never an independently resettable sidecar marker. */
export function initializeDocumentApprovalSchema(database: Database.Database): void {
  database
    .transaction(() => {
      database.exec(`
      CREATE TABLE IF NOT EXISTS planning_document_publications (
        contract_id TEXT PRIMARY KEY REFERENCES contracts(id),
        manifest_digest TEXT NOT NULL,
        source_root TEXT NOT NULL,
        published_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS planning_document_attempts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT,
        approval_id TEXT NOT NULL,
        material_digest TEXT NOT NULL,
        manifest_digest TEXT NOT NULL,
        boundary TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        run_lease_epoch INTEGER,
        status TEXT NOT NULL CHECK(status IN ('pending','verified','invalidated','recovered')),
        reason TEXT,
        created_at_ms INTEGER NOT NULL,
        deadline_ms INTEGER NOT NULL,
        settled_at_ms INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS planning_document_pending
        ON planning_document_attempts(run_id,approval_id) WHERE status='pending';
      INSERT OR IGNORE INTO schema_migrations(version,applied_at_ms)
        VALUES(17,unixepoch()*1000);
    `);
      const columns = database.prepare('PRAGMA table_info(planning_document_attempts)').all() as {
        name: string;
      }[];
      const publicationColumns = database
        .prepare('PRAGMA table_info(planning_document_publications)')
        .all() as { name: string }[];
      if (!publicationColumns.some((column) => column.name === 'source_identity_json'))
        database.exec(
          'ALTER TABLE planning_document_publications ADD COLUMN source_identity_json TEXT',
        );
      if (!columns.some((column) => column.name === 'deadline_ms'))
        database.exec(
          'ALTER TABLE planning_document_attempts ADD COLUMN deadline_ms INTEGER NOT NULL DEFAULT 0',
        );
    })
    .immediate();
}

interface Binding {
  contractId: string;
  materialDigest: string;
  manifest: PlanningDocuments;
  manifestDigest: string;
  sourceRoot: string;
  policyDigest: string;
  taskIds: string[];
  sourceIdentity: DocumentSourceIdentity;
}

function binding(database: Database.Database, runId: string): Binding {
  const row = database
    .prepare(
      `SELECT c.id,c.body_json,p.manifest_digest,p.source_root,p.source_identity_json
    FROM runs r JOIN contracts c ON c.id=r.contract_id
    LEFT JOIN planning_document_publications p ON p.contract_id=c.id WHERE r.id=?`,
    )
    .get(runId) as
    | {
        id: string;
        body_json: string;
        manifest_digest: string | null;
        source_root: string | null;
        source_identity_json: string | null;
      }
    | undefined;
  if (!row) throw new Error('document_run_missing');
  const contract = executionContractSchema.parse(JSON.parse(row.body_json));
  const manifest = contract.planningDocuments;
  if (!manifest) throw new Error('document_manifest_required');
  const manifestDigest = planningDocumentsDigest(manifest);
  if (row.manifest_digest !== manifestDigest || !row.source_root || !row.source_identity_json)
    throw new Error('document_publication_missing');
  return {
    policyDigest: contract.policyDigest,
    taskIds: contract.tasks.map((task) => task.id),
    contractId: row.id,
    materialDigest: deriveContractMaterialDigest(contract),
    manifest,
    manifestDigest,
    sourceRoot: row.source_root,
    sourceIdentity: JSON.parse(row.source_identity_json) as DocumentSourceIdentity,
  };
}

function verifyBytes(database: Database.Database, current: Binding): void {
  const stage = stagePreapprovalMaterial({
    sourceRoot: current.sourceRoot,
    paths: current.manifest.files.map((file) => file.path),
  });
  try {
    const artifactRoot = join(dirname(database.name), 'artifacts');
    for (const file of current.manifest.files) {
      const staged = stage.manifest.find((entry) => entry.path === file.path);
      if (staged?.digest !== file.digest || staged.sizeBytes !== file.sizeBytes)
        throw new Error('mismatch');
      const hash = file.digest.slice(7);
      const bytes = readFileSync(join(artifactRoot, hash.slice(0, 2), hash));
      if (
        bytes.length !== file.sizeBytes ||
        createHash('sha256').update(bytes).digest('hex') !== hash
      )
        throw new Error('mismatch');
    }
    stage.verify();
  } finally {
    stage.cleanup();
  }
}

/** Trusted publication coordinator calls this only after object publication and contract creation. */
export function recordPlanningDocumentPublication(
  database: Database.Database,
  input: {
    runId: string;
    sourceRoot: string;
    sourcePolicy?: unknown;
    nowMs?: number;
  },
): void {
  if (database.inTransaction) throw new Error('document_publication_requires_top_level');
  const row = database
    .prepare(
      'SELECT c.id,c.body_json FROM contracts c JOIN runs r ON r.contract_id=c.id WHERE r.id=?',
    )
    .get(input.runId) as { id: string; body_json: string } | undefined;
  if (!row) throw new Error('document_run_missing');
  const contract = executionContractSchema.parse(JSON.parse(row.body_json));
  if (!contract.planningDocuments) throw new Error('document_manifest_required');
  let sourceRoot: string;
  try {
    sourceRoot = realpathSync(input.sourceRoot);
  } catch {
    throw new Error('document_publication_source_unavailable');
  }
  let sourceIdentity: DocumentSourceIdentity;
  try {
    sourceIdentity = establishDocumentSource(contract, sourceRoot, input.sourcePolicy);
  } catch (error) {
    if (error instanceof Error && /^document_[a-z_]+$/u.test(error.message)) throw error;
    throw new Error('document_publication_source_rejected');
  }
  const current: Binding = {
    sourceIdentity,
    policyDigest: contract.policyDigest,
    taskIds: contract.tasks.map((task) => task.id),
    contractId: row.id,
    sourceRoot,
    materialDigest: deriveContractMaterialDigest(contract),
    manifest: contract.planningDocuments,
    manifestDigest: planningDocumentsDigest(contract.planningDocuments),
  };
  try {
    verifyBytes(database, current);
  } catch {
    throw new Error('document_publication_verification_failed');
  }
  database
    .transaction(() => {
      const old = database
        .prepare(
          'SELECT manifest_digest,source_root,source_identity_json FROM planning_document_publications WHERE contract_id=?',
        )
        .get(row.id) as
        | { manifest_digest: string; source_root: string; source_identity_json: string }
        | undefined;
      if (
        old &&
        (old.manifest_digest !== current.manifestDigest ||
          old.source_root !== sourceRoot ||
          old.source_identity_json !== JSON.stringify(sourceIdentity))
      )
        throw new Error('document_publication_immutable');
      database
        .prepare(
          'INSERT OR IGNORE INTO planning_document_publications(contract_id,manifest_digest,source_root,published_at_ms,source_identity_json) VALUES(?,?,?,?,?)',
        )
        .run(
          row.id,
          current.manifestDigest,
          sourceRoot,
          input.nowMs ?? Date.now(),
          JSON.stringify(sourceIdentity),
        );
    })
    .immediate();
}

export interface DocumentBoundary {
  runId: string;
  taskId?: string;
  boundary: string;
  ownerId: string;
  runLeaseEpoch?: number;
  expectedSourceRoot?: string;
  /** Additional incoming lineage source; strengthens rather than replaces current-source checks. */
  additionalSourceRef?: string;
  nowMs?: number;
}

function assertFence(database: Database.Database, input: DocumentBoundary, nowMs: number): void {
  if (input.runLeaseEpoch === undefined) return;
  if (
    !database
      .prepare(
        "SELECT 1 FROM leases WHERE resource_type='run' AND resource_id=? AND owner_id=? AND epoch=? AND expires_at_ms>?",
      )
      .get(input.runId, input.ownerId, input.runLeaseEpoch, nowMs)
  )
    throw new Error('document_lease_stale');
}

/** Generated repair tasks inherit the documented ancestor; normal role/operation gates still apply. */
function documentTaskInScope(
  database: Database.Database,
  runId: string,
  taskId: string,
  declared: string[],
): boolean {
  const visited = new Set<string>();
  let candidate = taskId;
  while (!declared.includes(candidate)) {
    if (visited.has(candidate)) return false;
    visited.add(candidate);
    const parent = database
      .prepare('SELECT chain_tip_task_id FROM repair_child_intents WHERE run_id=? AND id=?')
      .get(runId, candidate) as { chain_tip_task_id: string } | undefined;
    if (!parent) return false;
    candidate = parent.chain_tip_task_id;
  }
  return true;
}

/** Must run before entering the caller's transaction, so an outer rollback cannot erase its intent. */
export function verifyDocumentBoundary(database: Database.Database, input: DocumentBoundary) {
  return verifyBoundary(database, input, false);
}

export interface DeliveryDocumentSource {
  sourceRoot: string;
  manifest: PlanningDocuments;
}

export function verifyDeliveryDocumentSource(
  database: Database.Database,
  input: DocumentBoundary,
): DeliveryDocumentSource {
  let source!: DeliveryDocumentSource;
  verifyBoundary(database, input, false, (current) => {
    source = { sourceRoot: current.sourceRoot, manifest: current.manifest };
  });
  return source;
}

/** Publication check only; the approval coordinator must still validate critic and owner evidence. */
export function verifyDocumentsForApproval(database: Database.Database, input: DocumentBoundary) {
  return verifyBoundary(database, input, true);
}

function verifyCurrentSources(
  database: Database.Database,
  current: Binding,
  input: DocumentBoundary,
): void {
  const accepted = database
    .prepare(
      `
      SELECT task_id,ref FROM delivery_approved_heads WHERE run_id=?
      UNION SELECT task_id,ref FROM repair_approved_heads WHERE run_id=?
      UNION SELECT task_id,ref FROM lineage_approved_heads WHERE run_id=?`,
    )
    .all(input.runId, input.runId, input.runId) as { task_id: string; ref: string }[];
  const relevant = accepted.filter(
    (row) => input.taskId === undefined || row.task_id === input.taskId,
  );
  const byTask = new Map<string, string>();
  for (const row of relevant) {
    if (byTask.has(row.task_id) && byTask.get(row.task_id) !== row.ref)
      throw new Error('document_task_workspace_ambiguous');
    byTask.set(row.task_id, row.ref);
  }
  const publishedRoot = current.sourceRoot;
  const refs: (string | undefined)[] =
    byTask.size === 0 ? [undefined] : [...new Set(byTask.values())];
  if (input.additionalSourceRef !== undefined && !refs.includes(input.additionalSourceRef))
    refs.push(input.additionalSourceRef);
  for (const ref of refs) {
    current.sourceRoot = resolveDocumentSource(current.sourceIdentity, publishedRoot, ref);
    if (
      input.expectedSourceRoot !== undefined &&
      realpathSync(input.expectedSourceRoot) !== current.sourceRoot
    )
      throw new Error('document_source_changed');
    verifyBytes(database, current);
  }
}

function verifyBoundary(
  database: Database.Database,
  input: DocumentBoundary,
  approvalCreation: boolean,
  checkSnapshot?: (current: Binding, verified: NonNullable<TaskPacket['documentBinding']>) => void,
): {
  approvalId: string;
  snapshotPath: '/run/approved-documents';
  materialDigest: string;
  manifestDigest: string;
} {
  if (database.inTransaction) throw new Error('document_verification_requires_top_level');
  const current = binding(database, input.runId);
  if (input.taskId && !documentTaskInScope(database, input.runId, input.taskId, current.taskIds))
    throw new Error('document_task_unknown');
  const wallStart = input.nowMs ?? Date.now();
  const monotonicStart = performance.now();
  const now = () => wallStart + Math.max(0, Math.floor(performance.now() - monotonicStart));
  const approval = database
    .prepare(
      "SELECT id FROM plan_approvals WHERE run_id=? AND status='active' AND material_digest=? AND policy_digest=? ORDER BY approved_at_ms DESC,id DESC LIMIT 1",
    )
    .get(input.runId, current.materialDigest, current.policyDigest) as { id: string } | undefined;
  if (
    approvalCreation &&
    database
      .prepare(
        "SELECT 1 FROM planning_document_attempts a JOIN runs r ON r.id=a.run_id WHERE r.contract_id=? AND a.status IN ('invalidated','recovered') LIMIT 1",
      )
      .get(current.contractId)
  )
    throw new Error('document_new_contract_required');
  const approvalId = approvalCreation ? `candidate:${current.contractId}` : approval?.id;
  if (!approvalId) throw new Error('document_approval_required');
  const attemptId = randomUUID();
  const deadline = now() + 30_000;
  database
    .transaction(() => {
      assertFence(database, input, now());
      if (
        database
          .prepare(
            "SELECT 1 FROM planning_document_attempts a JOIN runs r ON r.id=a.run_id WHERE r.contract_id=? AND a.status='pending'",
          )
          .get(current.contractId)
      )
        throw new Error('document_verification_unresolved');
      database
        .prepare(
          `INSERT INTO planning_document_attempts(id,run_id,task_id,approval_id,material_digest,manifest_digest,boundary,owner_id,run_lease_epoch,status,created_at_ms,deadline_ms)
      VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)`,
        )
        .run(
          attemptId,
          input.runId,
          input.taskId ?? null,
          approvalId,
          current.materialDigest,
          current.manifestDigest,
          input.boundary,
          input.ownerId,
          input.runLeaseEpoch ?? null,
          now(),
          deadline,
        );
    })
    .immediate();
  const verified = {
    approvalId,
    snapshotPath: '/run/approved-documents' as const,
    materialDigest: current.materialDigest,
    manifestDigest: current.manifestDigest,
  };
  let valid = false;
  try {
    verifyCurrentSources(database, current, input);
    checkSnapshot?.(current, verified);
    valid = true;
  } catch {
    /* Safe reason only; pending intent survives settlement failure. */
  }
  database
    .transaction(() => {
      assertFence(database, input, now());
      if (now() >= deadline) throw new Error('document_attempt_expired');
      if (
        !approvalCreation &&
        !database
          .prepare(
            "SELECT 1 FROM plan_approvals WHERE id=? AND status='active' AND material_digest=?",
          )
          .get(approvalId, current.materialDigest)
      )
        throw new Error('document_approval_changed');
      if (!valid)
        database
          .prepare(
            "UPDATE plan_approvals SET status='invalidated',invalidated_at_ms=?,invalidation_reason='planning_documents_changed' WHERE run_id IN (SELECT id FROM runs WHERE contract_id=?) AND status='active'",
          )
          .run(now(), current.contractId);
      const settled = database
        .prepare(
          "UPDATE planning_document_attempts SET status=?,reason=?,settled_at_ms=? WHERE id=? AND status='pending' AND owner_id=?",
        )
        .run(
          valid ? 'verified' : 'invalidated',
          valid ? null : 'planning_documents_changed',
          now(),
          attemptId,
          input.ownerId,
        );
      if (settled.changes !== 1) throw new Error('document_attempt_stale');
    })
    .immediate();
  if (!valid) throw new Error('planning_documents_changed');
  return {
    approvalId,
    snapshotPath: '/run/approved-documents',
    materialDigest: current.materialDigest,
    manifestDigest: current.manifestDigest,
  };
}

/** Explicit coordinator recovery: never turns a matching hash back into approval. */
export function recoverDocumentVerification(
  database: Database.Database,
  input: DocumentBoundary,
): void {
  if (database.inTransaction) throw new Error('document_recovery_requires_top_level');
  if (input.runLeaseEpoch === undefined) throw new Error('document_recovery_fence_required');
  const current = binding(database, input.runId);
  database
    .transaction(() => {
      assertFence(database, input, input.nowMs ?? Date.now());
      const pending = database
        .prepare(
          "SELECT run_lease_epoch,deadline_ms FROM planning_document_attempts WHERE run_id=? AND status='pending'",
        )
        .all(input.runId) as { run_lease_epoch: number | null; deadline_ms: number }[];
      if (
        pending.some(
          (attempt) =>
            attempt.deadline_ms > (input.nowMs ?? Date.now()) &&
            (attempt.run_lease_epoch === null || input.runLeaseEpoch! <= attempt.run_lease_epoch),
        )
      )
        throw new Error('document_attempt_owner_live');
      if (
        !database
          .prepare("SELECT 1 FROM planning_document_attempts WHERE run_id=? AND status='pending'")
          .get(input.runId)
      )
        throw new Error('document_recovery_not_required');
      database
        .prepare(
          "UPDATE plan_approvals SET status='invalidated',invalidated_at_ms=?,invalidation_reason='document_verification_unresolved' WHERE run_id IN (SELECT id FROM runs WHERE contract_id=?) AND status='active'",
        )
        .run(input.nowMs ?? Date.now(), current.contractId);
      database
        .prepare(
          "UPDATE planning_document_attempts SET status='recovered',reason='explicit_invalidation',settled_at_ms=? WHERE run_id=? AND status='pending'",
        )
        .run(input.nowMs ?? Date.now(), input.runId);
    })
    .immediate();
}

/** Copies only content-addressed approved bytes into a fresh private staging directory. */
export function stageApprovedDocuments(
  database: Database.Database,
  input: DocumentBoundary & { packet: TaskPacket; sourceRoot: string; destination: string },
): void {
  const verified = verifyDocumentBoundary(database, {
    ...input,
    expectedSourceRoot: input.sourceRoot,
  });
  const current = binding(database, input.runId);
  if (
    input.packet.runId !== input.runId ||
    input.packet.taskId !== input.taskId ||
    input.packet.documentBinding?.approvalId !== verified.approvalId ||
    input.packet.documentBinding.materialDigest !== verified.materialDigest ||
    input.packet.documentBinding.manifestDigest !== verified.manifestDigest
  )
    throw new Error('document_snapshot_binding_rejected');
  verifyBoundary(database, input, false, () => {
    mkdirSync(input.destination, { mode: 0o700 });
    try {
      for (const file of current.manifest.files) {
        const hash = file.digest.slice(7);
        const bytes = readFileSync(
          join(dirname(database.name), 'artifacts', hash.slice(0, 2), hash),
        );
        if (
          bytes.length !== file.sizeBytes ||
          createHash('sha256').update(bytes).digest('hex') !== hash
        )
          throw new Error('document_snapshot_object_changed');
        const target = join(input.destination, 'documents', file.path);
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        writeFileSync(target, bytes, { flag: 'wx', mode: 0o400 });
      }
      writeFileSync(
        join(input.destination, 'binding.json'),
        JSON.stringify({
          runId: input.runId,
          taskId: input.taskId,
          ...verified,
          manifest: current.manifest,
        }),
        { flag: 'wx', mode: 0o400 },
      );
    } catch {
      rmSync(input.destination, { recursive: true, force: true });
      throw new Error('document_snapshot_failed');
    }
  });
}

function verifySnapshotFile(
  root: string,
  path: string,
  file: PlanningDocuments['files'][number] | undefined,
  wantedBinding: string,
): void {
  const target = join(root, path);
  const stat = lstatSync(target);
  if (!stat.isFile()) throw new Error('type');
  if (path === 'binding.json') {
    if (readFileSync(target, 'utf8') !== wantedBinding) throw new Error('binding');
    return;
  }
  if (!file || stat.size !== file.sizeBytes) throw new Error('file');
  if (`sha256:${createHash('sha256').update(readFileSync(target)).digest('hex')}` !== file.digest)
    throw new Error('bytes');
}

/** Recheck the actual mount source immediately before dispatch, not only the object store. */
export function verifyApprovedDocumentSnapshot(
  database: Database.Database,
  input: DocumentBoundary & { packet: TaskPacket; destination: string },
): void {
  verifyBoundary(database, input, false, (current, verified) => {
    if (
      realpathSync(input.destination) !== input.destination ||
      !lstatSync(input.destination).isDirectory()
    )
      throw new Error('root');
    if (
      input.packet.runId !== input.runId ||
      input.packet.taskId !== input.taskId ||
      JSON.stringify(input.packet.documentBinding) !== JSON.stringify(verified)
    )
      throw new Error('packet');
    const expected = new Map(
      current.manifest.files.map((file) => [`documents/${file.path}`, file]),
    );
    const seen = new Set<string>();
    const visit = (relative: string) => {
      for (const name of readdirSync(join(input.destination, relative))) {
        const path = relative ? `${relative}/${name}` : name;
        const stat = lstatSync(join(input.destination, path));
        if (stat.isDirectory()) {
          if (![...expected.keys()].some((file) => file.startsWith(`${path}/`)))
            throw new Error('directory');
          visit(path);
          continue;
        }
        verifySnapshotFile(
          input.destination,
          path,
          expected.get(path),
          JSON.stringify({
            runId: input.runId,
            taskId: input.taskId,
            ...verified,
            manifest: current.manifest,
          }),
        );
        seen.add(path);
      }
    };
    visit('');
    if (!seen.has('binding.json') || [...expected.keys()].some((path) => !seen.has(path)))
      throw new Error('missing');
  });
}
