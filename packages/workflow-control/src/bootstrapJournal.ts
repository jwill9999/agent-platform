import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

import {
  bootstrapPolicySchema,
  bootstrapDigest,
  bootstrapJson,
  type BootstrapPolicy,
  type observeBootstrapCandidate,
} from './bootstrapPolicy.js';
import { executionContractSchema, type ExecutionContract } from './contracts.js';
import { deriveContractMaterialDigest } from './planning.js';
import { deriveTransitionIdempotencyKey } from './lifecycle.js';
import { validateTransition } from './stateMachine.js';
// Storage-level lease shape deliberately has no dependency on broker/orchestrator composition.
interface DeliveryFence {
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
}
type BootstrapObservation = ReturnType<typeof observeBootstrapCandidate> & {
  beadsSnapshotDigest: string;
  policyDigest: string;
  sourceRoot: string;
  canonicalRoot: string;
  gitCommonDirectory: string;
};
interface PreexistingRefReceipt {
  kind: 'git.preexisting_ref_observed';
  ref: string;
  headSha: string;
  treeSha: string;
  policyDigest: string;
}

export function initializeBootstrapSchema(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS bootstrap_artifacts (
    run_id TEXT PRIMARY KEY REFERENCES runs(id), policy_json TEXT NOT NULL, policy_digest TEXT NOT NULL,
    approval_id TEXT NOT NULL, contract_digest TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('prepared','adopted','attested')),
    observation_json TEXT NOT NULL, head_sha TEXT, attestation_digest TEXT, attestation_json TEXT,
    created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL
  );`);
}

/** Bootstrap-specific policy is checked before saga preparation and again at durable commit. */
export function assertBootstrapDeliveryPolicy(
  database: Database.Database,
  runId: string,
  requestInput: unknown,
): void {
  const row = database
    .prepare(
      'SELECT policy_json,approval_id,contract_digest FROM bootstrap_artifacts WHERE run_id=?',
    )
    .get(runId) as
    | { policy_json: string; approval_id: string; contract_digest: string }
    | undefined;
  if (!row) return;
  const policy = bootstrapPolicySchema.parse(JSON.parse(row.policy_json));
  const stored = database
    .prepare('SELECT c.body_json FROM contracts c JOIN runs r ON r.contract_id=c.id WHERE r.id=?')
    .get(runId) as { body_json: string };
  const contract = executionContractSchema.parse(JSON.parse(stored.body_json));
  if (
    bootstrapDigest(policy) !== contract.policyDigest ||
    bootstrapDigest(contract) !== row.contract_digest ||
    !database
      .prepare(
        "SELECT 1 FROM plan_approvals WHERE id=? AND run_id=? AND status='active' AND policy_digest=? AND material_digest=?",
      )
      .get(row.approval_id, runId, contract.policyDigest, deriveContractMaterialDigest(contract))
  )
    throw new Error('bootstrap stored policy approval rejected');
  const request = requestInput as Record<string, unknown>;
  if (
    request === null ||
    typeof request !== 'object' ||
    request.runId !== runId ||
    request.taskId !== policy.taskId ||
    request.ref !== policy.ref ||
    request.policyDigest !== contract.policyDigest ||
    request.repository !== policy.repository ||
    request.workspaceId !== contract.workspaceId
  )
    throw new Error('bootstrap delivery binding rejected');
  if (request.kind === 'git.commit') {
    if (
      request.parentSha !== policy.initialHeadSha ||
      request.treeSha !== policy.treeSha ||
      request.diffDigest !== policy.diffDigest ||
      bootstrapJson(request.changedFiles) !==
        bootstrapJson(policy.manifest.map((item) => item.path)) ||
      request.authorName !== policy.author.name ||
      request.authorEmail !== policy.author.email ||
      request.message !== policy.author.message ||
      request.authoredAtUnix !== policy.author.authoredAtUnix
    )
      throw new Error('bootstrap commit differs from stored policy');
  } else if (request.kind === 'git.push') {
    if (request.expectedRemoteSha !== policy.expectedRemoteSha)
      throw new Error('bootstrap remote precondition differs from stored policy');
  } else throw new Error('bootstrap only permits commit and push');
}

export class BootstrapJournal {
  readonly database: Database.Database;
  constructor(path: string, readonlyMode = false) {
    this.database = new Database(path, { readonly: readonlyMode, fileMustExist: true });
    this.database.pragma('foreign_keys = ON');
    this.database.pragma('busy_timeout = 5000');
    if (readonlyMode) this.database.pragma('query_only = ON');
  }
  close() {
    this.database.close();
  }
  contract(runId: string): ExecutionContract {
    const row = this.database
      .prepare('SELECT c.body_json FROM contracts c JOIN runs r ON r.contract_id=c.id WHERE r.id=?')
      .get(runId) as { body_json: string } | undefined;
    if (!row) throw new Error('bootstrap run missing');
    return executionContractSchema.parse(JSON.parse(row.body_json));
  }
  assertApproved(runId: string, policy: BootstrapPolicy) {
    const contract = this.contract(runId);
    const task = contract.tasks.find((item) => item.id === policy.taskId);
    const workspaceId = `sha256:${createHash('sha256').update(policy.canonicalRoot).digest('hex')}`;
    if (
      contract.workspaceId !== workspaceId ||
      contract.policyDigest !== bootstrapDigest(policy) ||
      contract.authority.github.repository !== policy.repository ||
      task === undefined
    )
      throw new Error('bootstrap policy differs from approved contract');
    for (const action of [
      'workspace.read',
      'artifact.write',
      'workflow.transition',
      'beads.read',
      'git.read',
      'git.commit',
      'git.push',
    ] as const)
      if (
        !contract.authority.allowedActions.includes(action) ||
        !task.allowedOperations.includes(action)
      )
        throw new Error(`bootstrap lacks ${action} authority`);
    if (
      policy.prohibitedActions.some((action) => contract.authority.allowedActions.includes(action))
    )
      throw new Error('bootstrap contract includes prohibited external authority');
    if (
      bootstrapJson(policy.allowedPaths) !== bootstrapJson(task.allowedPaths) ||
      policy.allowedPaths.some((path) => !contract.constraints.allowedPaths.includes(path))
    )
      throw new Error('bootstrap path authority differs');
    const approval = this.database
      .prepare(
        `SELECT id FROM plan_approvals WHERE run_id=? AND status='active'
      AND contract_version=1 AND policy_digest=? AND material_digest=? ORDER BY approved_at_ms DESC,id DESC LIMIT 1`,
      )
      .get(runId, contract.policyDigest, deriveContractMaterialDigest(contract)) as
      | { id: string }
      | undefined;
    const critic = this.database
      .prepare(
        `SELECT id,verdict,material_digest,policy_digest FROM critic_reviews WHERE run_id=? ORDER BY created_at_ms DESC,id DESC LIMIT 1`,
      )
      .get(runId) as
      | { id: string; verdict: string; material_digest: string; policy_digest: string }
      | undefined;
    if (
      !approval ||
      critic?.verdict !== 'approved' ||
      critic.material_digest !== deriveContractMaterialDigest(contract) ||
      critic.policy_digest !== contract.policyDigest ||
      this.database.prepare('SELECT 1 FROM critic_findings WHERE review_id=?').get(critic.id)
    )
      throw new Error('bootstrap exact approval and independent critic required');
    for (const evidence of policy.evidence) {
      // Pre-bootstrap review/test artifacts predate the initial approved-head ledger. They are
      // explicitly named by the exact human-approved policy, not accepted phase execution results.
      if (
        !this.database
          .prepare(
            `SELECT 1 FROM evidence WHERE digest=? AND run_id=? AND task_id=?
        AND workspace_id=? AND contract_version=1 AND policy_digest=? AND head_sha=?
        AND media_type=? AND size_bytes=? AND kind=? AND producer_role=? AND producer=?`,
          )
          .get(
            evidence.digest,
            runId,
            policy.taskId,
            workspaceId,
            contract.policyDigest,
            policy.initialHeadSha,
            evidence.mediaType,
            evidence.sizeBytes,
            evidence.kind,
            evidence.producerRole,
            evidence.producer,
          )
      )
        throw new Error('bootstrap evidence is not approved exact-candidate evidence');
    }
    return { contract, approvalId: approval.id };
  }
  assertStored(runId: string, policy: BootstrapPolicy) {
    const binding = this.assertApproved(runId, policy);
    const row = this.database
      .prepare('SELECT * FROM bootstrap_artifacts WHERE run_id=?')
      .get(runId) as
      | {
          policy_json: string;
          approval_id: string;
          contract_digest: string;
          status: string;
          head_sha: string | null;
          attestation_json: string | null;
          attestation_digest: string | null;
        }
      | undefined;
    if (
      !row ||
      bootstrapJson(bootstrapPolicySchema.parse(JSON.parse(row.policy_json))) !==
        bootstrapJson(policy) ||
      row.approval_id !== binding.approvalId ||
      row.contract_digest !== bootstrapDigest(binding.contract)
    )
      throw new Error('stored bootstrap policy or approval changed');
    return row;
  }
  assertFence(runId: string, policy: BootstrapPolicy, fence: DeliveryFence, nowMs: number): void {
    for (const [type, id, epoch] of [
      ['workspace', this.contract(runId).workspaceId, fence.workspaceLeaseEpoch],
      ['run', runId, fence.runLeaseEpoch],
      ['task', policy.taskId, fence.taskLeaseEpoch],
    ] as const) {
      if (
        !this.database
          .prepare(
            'SELECT 1 FROM leases WHERE resource_type=? AND resource_id=? AND owner_id=? AND epoch=? AND expires_at_ms>?',
          )
          .get(type, id, fence.ownerId, epoch, nowMs)
      )
        throw new Error('bootstrap fence rejected');
    }
  }
  withMutation<T>(
    runId: string,
    policy: BootstrapPolicy,
    fence: DeliveryFence,
    operation: () => T,
  ): T {
    return this.database
      .transaction(() => {
        this.assertStored(runId, policy);
        this.assertFence(runId, policy, fence, Date.now());
        const run = this.database.prepare('SELECT state FROM runs WHERE id=?').get(runId) as {
          state: string;
        };
        if (run.state !== 'implementing')
          throw new Error('bootstrap mutation run is not implementing');
        return operation();
      })
      .immediate();
  }
  attest(
    runId: string,
    policy: BootstrapPolicy,
    fence: DeliveryFence,
    headSha: string,
    attestation: unknown,
    digest: string,
  ): void {
    this.withMutation(runId, policy, fence, () => {
      const row = this.assertStored(runId, policy);
      if (
        row.attestation_json !== null &&
        (row.attestation_json !== bootstrapJson(attestation) || row.attestation_digest !== digest)
      )
        throw new Error('bootstrap attestation identity collision');
      const head = this.database
        .prepare(
          'SELECT current_sha,published_sha FROM delivery_approved_heads WHERE run_id=? AND task_id=? AND ref=?',
        )
        .get(runId, policy.taskId, policy.ref) as
        | { current_sha: string; published_sha: string | null }
        | undefined;
      if (
        head?.current_sha !== headSha ||
        head.published_sha !== headSha ||
        this.pendingWork(runId).length
      )
        throw new Error('bootstrap artifact is not a settled published head');
      const evidence = this.database
        .prepare(
          `SELECT 1 FROM secure_evidence WHERE run_id=? AND task_id=? AND digest=? AND head_sha=? AND accepted_at_ms IS NOT NULL AND deleted_at_ms IS NULL`,
        )
        .get(runId, policy.taskId, digest, headSha);
      if (!evidence) throw new Error('bootstrap attestation evidence is not accepted');
      this.database
        .prepare(
          "UPDATE bootstrap_artifacts SET status='attested',head_sha=?,attestation_digest=?,attestation_json=?,updated_at_ms=? WHERE run_id=?",
        )
        .run(headSha, digest, bootstrapJson(attestation), Date.now(), runId);
    });
  }
  /** Each real observation and its normative transition commits atomically; restart resumes stage 2. */
  advance(
    runId: string,
    policy: BootstrapPolicy,
    observation: BootstrapObservation,
    fence: DeliveryFence,
    nowMs: number,
    assertObserved: () => void,
  ): void {
    this.database
      .transaction(() => {
        const { contract, approvalId } = this.assertApproved(runId, policy);
        this.assertFence(runId, policy, fence, nowMs);
        assertObserved();
        const run = this.database
          .prepare('SELECT state,version FROM runs WHERE id=?')
          .get(runId) as { state: string; version: number };
        const prior = this.database
          .prepare('SELECT observation_json FROM bootstrap_artifacts WHERE run_id=?')
          .get(runId) as { observation_json: string } | undefined;
        if (prior && prior.observation_json !== bootstrapJson(observation))
          throw new Error('bootstrap observation changed');
        if (run.state === 'implementing') {
          this.assertStored(runId, policy);
          return;
        }
        const scheduledFrom =
          run.state === 'scheduling' && run.version === 1 && prior ? 'scheduling' : undefined;
        const from = run.state === 'approved' && run.version === 0 ? 'approved' : scheduledFrom;
        if (!from) throw new Error('bootstrap lifecycle is not a fresh approved observation');
        const to = from === 'approved' ? 'scheduling' : 'implementing';
        validateTransition(from, to, {
          currentContractVersion: 1,
          requestedContractVersion: 1,
          currentPolicyDigest: contract.policyDigest,
          requestedPolicyDigest: contract.policyDigest,
          workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
          actorWorkspaceLeaseEpoch: fence.workspaceLeaseEpoch,
          taskLeaseEpoch: fence.taskLeaseEpoch,
          actorTaskLeaseEpoch: fence.taskLeaseEpoch,
        });
        const operation =
          from === 'approved'
            ? 'workflow.bootstrap_task_observed'
            : 'workflow.bootstrap_candidate_adopted';
        const id = `${operation}:${runId}`;
        const key = deriveTransitionIdempotencyKey({
          runId,
          transitionId: id,
          operation,
          expectedVersion: run.version,
        });
        this.assertFence(runId, policy, fence, Date.now());
        this.database
          .prepare(
            `INSERT INTO transitions(id,run_id,from_state,to_state,operation,expected_run_version,idempotency_key,status,actor_role,contract_version,policy_digest,lease_owner_id,lease_epoch,transition_context_json,expected_external_state_json,external_arguments_json,result_json,created_at_ms,updated_at_ms)
        VALUES(?,?,?,?,?,?,?,'committed','workflow_orchestrator',1,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            id,
            runId,
            from,
            to,
            operation,
            run.version,
            key,
            contract.policyDigest,
            fence.ownerId,
            fence.runLeaseEpoch,
            bootstrapJson(fence),
            bootstrapJson(observation),
            bootstrapJson({ taskId: policy.taskId }),
            bootstrapJson(observation),
            nowMs,
            nowMs,
          );
        if (from === 'approved')
          this.database
            .prepare(
              `INSERT INTO bootstrap_artifacts(run_id,policy_json,policy_digest,approval_id,contract_digest,status,observation_json,created_at_ms,updated_at_ms) VALUES(?,?,?,?,?,'prepared',?,?,?)`,
            )
            .run(
              runId,
              bootstrapJson(policy),
              contract.policyDigest,
              approvalId,
              bootstrapDigest(contract),
              bootstrapJson(observation),
              nowMs,
              nowMs,
            );
        else {
          this.assertStored(runId, policy);
          const receipt: PreexistingRefReceipt = {
            kind: 'git.preexisting_ref_observed',
            ref: policy.ref,
            headSha: policy.initialHeadSha,
            treeSha: policy.treeSha,
            policyDigest: contract.policyDigest,
          };
          const operationId = `bootstrap-ref:${runId}`;
          this.database
            .prepare(
              `INSERT INTO delivery_operations(id,workspace_id,run_id,task_id,kind,actor_role,request_digest,request_json,status,owner_id,workspace_lease_epoch,run_lease_epoch,task_lease_epoch,result_json,created_at_ms,updated_at_ms)
          VALUES(?,?,?,?,'git.preexisting_ref_observed','workflow_orchestrator',?,?,'committed',?,?,?,?,?,?,?)`,
            )
            .run(
              operationId,
              contract.workspaceId,
              runId,
              policy.taskId,
              bootstrapDigest({ runId, ...receipt }),
              bootstrapJson(receipt),
              fence.ownerId,
              fence.workspaceLeaseEpoch,
              fence.runLeaseEpoch,
              fence.taskLeaseEpoch,
              bootstrapJson(receipt),
              nowMs,
              nowMs,
            );
          this.database
            .prepare(
              `INSERT INTO delivery_approved_heads(workspace_id,run_id,task_id,ref,base_sha,current_sha,published_sha,operation_id,updated_at_ms) VALUES(?,?,?,?,?,?,NULL,?,?)`,
            )
            .run(
              contract.workspaceId,
              runId,
              policy.taskId,
              policy.ref,
              policy.initialHeadSha,
              policy.initialHeadSha,
              operationId,
              nowMs,
            );
          this.database
            .prepare(
              "UPDATE bootstrap_artifacts SET status='adopted',updated_at_ms=? WHERE run_id=?",
            )
            .run(nowMs, runId);
        }
        if (
          this.database
            .prepare(
              'UPDATE runs SET state=?,version=version+1,updated_at_ms=? WHERE id=? AND state=? AND version=?',
            )
            .run(to, nowMs, runId, from, run.version).changes !== 1
        )
          throw new Error('bootstrap lifecycle CAS rejected');
      })
      .immediate();
  }
  pendingWork(runId: string): string[] {
    const checks = [
      [
        'scheduler',
        "SELECT 1 FROM scheduler_executions WHERE run_id=? AND (status='active' OR credential_status NOT IN ('revoked','pending'))",
      ],
      ['transitions', "SELECT 1 FROM transitions WHERE run_id=? AND status='prepared'"],
      ['delivery', "SELECT 1 FROM delivery_operations WHERE run_id=? AND status='prepared'"],
      ['repair', "SELECT 1 FROM repair_dispatches WHERE run_id=? AND status='dispatched'"],
      ['children', "SELECT 1 FROM repair_child_intents WHERE run_id=? AND status='prepared'"],
      ['waits', 'SELECT 1 FROM waits WHERE run_id=?'],
      ['phases', "SELECT 1 FROM phase_jobs WHERE run_id=? AND status='started'"],
      [
        'approval-delivery',
        "SELECT 1 FROM approval_notifications WHERE run_id=? AND state IN ('delivery_pending','resume_pending')",
      ],
      [
        'notification-delivery',
        "SELECT 1 FROM continuation_event_deliveries d JOIN continuation_events e ON e.id=d.event_id WHERE e.run_id=? AND d.status='pending' AND d.lease_owner IS NOT NULL",
      ],
    ] as const;
    return checks.filter(([, sql]) => this.database.prepare(sql).get(runId)).map(([kind]) => kind);
  }
}
