import { z } from 'zod';
import { createHash } from 'node:crypto';
import { realpathSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { executionContractSchema } from './contracts.js';
import { deriveContractMaterialDigest } from './planning.js';
import { workflowStateSchema } from './stateMachine.js';

export interface RunDiscoveryQuery {
  workspaceId: string;
  taskId: string;
  materialDigest?: string;
  policyDigest?: string;
}

export interface DiscoveredRun {
  id: string;
  contractId: string;
  state: string;
  version: number;
  materialDigest: string;
  policyDigest: string;
}

export interface RunInventory {
  status: 'absent' | 'terminal_only' | 'matching' | 'conflict';
  workspaceId: string;
  taskId: string;
  active: DiscoveredRun[];
  terminal: DiscoveredRun[];
  leases: Array<{
    resourceType: string;
    resourceId: string;
    ownerId: string;
    epoch: number;
    expiresAtMs: number;
    expired: boolean;
  }>;
}

/** Caller owns the read snapshot or admission transaction. Never migrates or writes. */
export function queryRunInventory(
  database: Database.Database,
  query: RunDiscoveryQuery,
  nowMs = Date.now(),
): RunInventory {
  if (!query.taskId.trim() || !/^sha256:[a-f0-9]{64}$/u.test(query.workspaceId))
    throw new Error('run_discovery_invalid_identity');
  for (const digest of [query.materialDigest, query.policyDigest]) {
    if (digest !== undefined && !/^sha256:[a-f0-9]{64}$/u.test(digest))
      throw new Error('run_discovery_invalid_digest');
  }
  if ((database.pragma('foreign_key_check') as unknown[]).length)
    throw new Error('run_discovery_journal_inconsistent');
  // Validate required schema even when there are no rows.
  database.prepare('SELECT id, run_id FROM repair_child_intents LIMIT 0').all();
  const contracts = database
    .prepare('SELECT workspace_id, body_json FROM contracts')
    .all() as Array<{ workspace_id: string; body_json: string }>;
  for (const row of contracts) {
    if (executionContractSchema.parse(JSON.parse(row.body_json)).workspaceId !== row.workspace_id)
      throw new Error('run_discovery_identity_mismatch');
  }
  const rows = database
    .prepare(
      `SELECT r.id, r.contract_id, r.state, r.version,
    c.body_json FROM runs r JOIN contracts c ON c.id = r.contract_id
    WHERE c.workspace_id = ? ORDER BY r.created_at_ms, r.id`,
    )
    .all(query.workspaceId) as Array<{
    id: string;
    contract_id: string;
    state: string;
    version: number;
    body_json: string;
  }>;
  const active: DiscoveredRun[] = [];
  const terminal: DiscoveredRun[] = [];
  for (const row of rows) {
    const contract = executionContractSchema.parse(JSON.parse(row.body_json));
    if (contract.workspaceId !== query.workspaceId)
      throw new Error('run_discovery_identity_mismatch');
    const repair = database
      .prepare('SELECT id FROM repair_child_intents WHERE run_id = ? AND id = ?')
      .get(row.id, query.taskId);
    if (!contract.tasks.some((task) => task.id === query.taskId) && !repair) continue;
    const state = workflowStateSchema.parse(row.state);
    const run = {
      id: row.id,
      contractId: row.contract_id,
      state,
      version: row.version,
      materialDigest: deriveContractMaterialDigest(contract),
      policyDigest: contract.policyDigest,
    };
    (state === 'closed' || state === 'cancelled' ? terminal : active).push(run);
  }
  const ids = new Set([...active, ...terminal].map((run) => run.id));
  const leases = z
    .array(
      z.object({
        resource_type: z.enum(['workspace', 'run', 'task', 'closeout']),
        resource_id: z.string().min(1),
        owner_id: z.string().min(1),
        epoch: z.number().int().nonnegative(),
        expires_at_ms: z.number().int().nonnegative(),
      }),
    )
    .parse(
      database
        .prepare('SELECT resource_type, resource_id, owner_id, epoch, expires_at_ms FROM leases')
        .all(),
    )
    .filter(
      (lease) =>
        (lease.resource_type === 'workspace' && lease.resource_id === query.workspaceId) ||
        (lease.resource_type === 'task' && lease.resource_id === query.taskId) ||
        (lease.resource_type === 'run' && ids.has(lease.resource_id)),
    )
    .map((lease) => ({
      resourceType: lease.resource_type,
      resourceId: lease.resource_id,
      ownerId: lease.owner_id,
      epoch: lease.epoch,
      expiresAtMs: lease.expires_at_ms,
      expired: lease.expires_at_ms <= nowMs,
    }));
  const conflicts =
    active.length > 1 ||
    active.some(
      (run) =>
        (query.materialDigest !== undefined && run.materialDigest !== query.materialDigest) ||
        (query.policyDigest !== undefined && run.policyDigest !== query.policyDigest),
    );
  return {
    status: conflicts
      ? 'conflict'
      : active.length
        ? 'matching'
        : terminal.length
          ? 'terminal_only'
          : 'absent',
    workspaceId: query.workspaceId,
    taskId: query.taskId,
    active,
    terminal,
    leases,
  };
}

/** Canonical path derivation deliberately does not call the directory-creating resolver. */
export function discoverCanonicalRuns(input: {
  codexHome: string;
  workspaceRoot: string;
  taskId: string;
  materialDigest?: string;
  policyDigest?: string;
}): RunInventory | { status: 'unknown'; reason: string } {
  let database: Database.Database | undefined;
  try {
    const workspace = realpathSync(input.workspaceRoot);
    const home = realpathSync(input.codexHome);
    const hash = createHash('sha256').update(workspace).digest('hex');
    const path = join(home, 'workflow-control', hash, 'workflow.sqlite');
    if (!lstatSync(path).isFile() || realpathSync(path) !== path)
      return { status: 'unknown', reason: 'run_discovery_journal_identity_invalid' };
    database = new Database(path, { readonly: true, fileMustExist: true });
    database.pragma('query_only = ON');
    const binding = database
      .prepare('SELECT workspace_id FROM workflow_journal_identity WHERE singleton = 1')
      .get() as { workspace_id: string } | undefined;
    if (binding?.workspace_id !== `sha256:${hash}`)
      return { status: 'unknown', reason: 'run_discovery_workspace_unbound' };
    const reader = database;
    return reader.transaction(() =>
      queryRunInventory(reader, {
        workspaceId: `sha256:${hash}`,
        taskId: input.taskId,
        ...(input.materialDigest === undefined ? {} : { materialDigest: input.materialDigest }),
        ...(input.policyDigest === undefined ? {} : { policyDigest: input.policyDigest }),
      }),
    )();
  } catch {
    return { status: 'unknown', reason: 'run_discovery_unavailable' };
  } finally {
    database?.close();
  }
}
