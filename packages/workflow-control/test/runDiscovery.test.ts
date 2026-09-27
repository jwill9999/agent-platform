import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWorkflowMcpServer } from '../src/mcpServer.js';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  symlink,
  copyFile,
  readdir,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowStore } from '../src/storage.js';
import { discoverCanonicalRuns } from '../src/runDiscovery.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { executionContractSchema } from '../src/contracts.js';
import { runCli } from '../src/cli.js';

const roots: string[] = [];
const exec = promisify(execFile);
afterEach(async () => {
  await Promise.all(roots.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'run-discovery-')));
  roots.push(root);
  const workspaceRoot = join(root, 'workspace');
  const codexHome = join(root, 'home');
  await mkdir(workspaceRoot);
  await mkdir(codexHome);
  const hash = createHash('sha256').update(workspaceRoot).digest('hex');
  const folder = join(codexHome, 'workflow-control', hash);
  await mkdir(folder, { recursive: true });
  const database = join(folder, 'workflow.sqlite');
  const contract = executionContractSchema.parse(
    JSON.parse(
      await readFile(
        new URL(
          '../../../docs/planning/standalone-pilot/execution-contract.v1.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
  delete contract.planningDocuments;
  contract.workspaceId = `sha256:${hash}`;
  const store = new WorkflowStore(database);
  const contractId = store.createContract(contract);
  store.bindWorkspaceIdentity(contract.workspaceId);
  const input = { workspaceRoot, codexHome, taskId: contract.tasks[0]!.id };
  return { root, folder, database, contract, contractId, store, input };
}

describe('canonical discovery and atomic admission', () => {
  it('distinguishes absence, matching material, conflicting material, and terminal history', async () => {
    const f = await fixture();
    try {
      expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'absent', active: [] });
      f.store.createRun(f.contractId, 'approved', 'one');
      const lease = f.store.acquireLease('run', 'one', 'owner', 10000);
      expect(
        discoverCanonicalRuns({
          ...f.input,
          materialDigest: deriveContractMaterialDigest(f.contract),
        }),
      ).toMatchObject({
        status: 'matching',
        active: [{ id: 'one' }],
        leases: [{ ownerId: 'owner', epoch: lease.epoch }],
      });
      expect(
        discoverCanonicalRuns({ ...f.input, materialDigest: `sha256:${'f'.repeat(64)}` }),
      ).toMatchObject({ status: 'conflict' });
      expect(
        discoverCanonicalRuns({ ...f.input, policyDigest: `sha256:${'f'.repeat(64)}` }),
      ).toMatchObject({ status: 'conflict' });
      const db = new Database(f.database);
      db.prepare("UPDATE runs SET state='cancelled'").run();
      db.close();
      expect(discoverCanonicalRuns(f.input)).toMatchObject({
        status: 'terminal_only',
        terminal: [{ id: 'one' }],
      });
      f.store.createRun(f.contractId, 'approved', 'two');
      expect(discoverCanonicalRuns(f.input)).toMatchObject({
        active: [{ id: 'two' }],
        terminal: [{ id: 'one' }],
      });
    } finally {
      f.store.close();
    }
  });
  it('retains escalated ownership despite expired leases and rejects duplicate start', async () => {
    const f = await fixture();
    try {
      f.store.createRun(f.contractId, 'escalated', 'one');
      f.store.acquireLease('run', 'one', 'old-owner', 10, 1);
      expect(discoverCanonicalRuns(f.input)).toMatchObject({
        status: 'matching',
        leases: [{ expired: true }],
      });
      expect(() => f.store.createRun(f.contractId, 'approved', 'two')).toThrow(
        'run_admission_conflict',
      );
      expect(f.store.getRun('two')).toBeUndefined();
    } finally {
      f.store.close();
    }
  });
  it('reports multiple legacy owners and does not choose one', async () => {
    const f = await fixture();
    try {
      f.store.createRunForTest(f.contractId, 'approved', 'one');
      f.store.createRunForTest(f.contractId, 'approved', 'two');
      expect(discoverCanonicalRuns(f.input)).toMatchObject({
        status: 'conflict',
        active: [{ id: 'one' }, { id: 'two' }],
      });
    } finally {
      f.store.close();
    }
  });
  it('fails closed without creating a missing journal, including CLI', async () => {
    const f = await fixture();
    f.store.close();
    await rm(f.folder, { recursive: true });
    expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'unknown' });
    expect(
      JSON.parse(runCli(['discover', f.input.codexHome, f.input.workspaceRoot, f.input.taskId])),
    ).toMatchObject({ status: 'unknown' });
    expect(await readdir(join(f.input.codexHome, 'workflow-control'))).toEqual([]);
  });
  it('rejects corrupt, incomplete and substituted journals', async () => {
    const f = await fixture();
    f.store.close();
    await writeFile(f.database, 'invalid database');
    expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'unknown' });
    await rm(f.database);
    const db = new Database(f.database);
    db.exec('CREATE TABLE wrong (id TEXT)');
    db.close();
    expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'unknown' });
    const other = join(f.root, 'other');
    await writeFile(other, 'unrelated');
    await rm(f.database);
    await symlink(other, f.database);
    expect(discoverCanonicalRuns(f.input)).toMatchObject({
      status: 'unknown',
      reason: 'run_discovery_journal_identity_invalid',
    });
  });
  it('does not mutate database bytes during canonical lookup or readonly store inspection', async () => {
    const f = await fixture();
    f.store.createRun(f.contractId, 'approved', 'one');
    f.store.close();
    const before = await readFile(f.database);
    const reader = new WorkflowStore(f.database, { readonly: true });
    try {
      expect(reader.getRun('one')?.state).toBe('approved');
      expect(() => reader.createRun(f.contractId)).toThrow();
    } finally {
      reader.close();
    }
    expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'matching' });
    expect(await readFile(f.database)).toEqual(before);
  });
  it('serializes independent racing processes and makes same-id retry idempotent after restart', async () => {
    const f = await fixture();
    f.store.close();
    const module = new URL('../dist/storage.js', import.meta.url).href;
    const discoveryModule = new URL('../dist/runDiscovery.js', import.meta.url).href;
    const script = `import { discoverCanonicalRuns } from ${JSON.stringify(discoveryModule)};
      import { existsSync, writeFileSync } from 'node:fs';
      import { WorkflowStore } from ${JSON.stringify(module)};
      const s = new WorkflowStore(process.argv[1]);
      if (process.argv[4]) {
        const input = JSON.parse(process.argv[5]);
        if (discoverCanonicalRuns(input).status !== 'absent') throw new Error('initial inventory not empty');
        writeFileSync(process.argv[4] + '/' + process.argv[3] + '.ready', 'ready');
        const deadline = Date.now() + 10000;
        while (!existsSync(process.argv[4] + '/release')) {
          if (Date.now() > deadline) throw new Error('barrier timeout');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        }
      }
      try { console.log(JSON.stringify(s.createRun(process.argv[2], 'approved', process.argv[3]))); }
      catch(e) { console.log(JSON.stringify({ error: e.message })); } finally { s.close(); }`;
    const pending = ['a', 'b'].map((id) =>
      exec(process.execPath, [
        '--input-type=module',
        '-e',
        script,
        f.database,
        f.contractId,
        id,
        f.root,
        JSON.stringify(f.input),
      ]),
    );
    const deadline = Date.now() + 10000;
    while (
      !(await readdir(f.root)).includes('a.ready') ||
      !(await readdir(f.root)).includes('b.ready')
    ) {
      if (Date.now() > deadline) throw new Error('barrier timeout');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await writeFile(join(f.root, 'release'), 'go');
    const results = await Promise.all(pending);
    const parsed = results.map((r) => JSON.parse(r.stdout));
    expect(parsed.filter((r) => r.error === 'run_admission_conflict')).toHaveLength(1);
    const winner = parsed.find((r) => r.id);
    const retry = await exec(process.execPath, [
      '--input-type=module',
      '-e',
      script,
      f.database,
      f.contractId,
      winner.id,
    ]);
    expect(JSON.parse(retry.stdout)).toEqual(winner);
    expect(discoverCanonicalRuns(f.input)).toMatchObject({ active: [{ id: winner.id }] });
  });
  it('guards every overlapping task even when contract version/material changes', async () => {
    const f = await fixture();
    try {
      f.store.createRun(f.contractId, 'approved', 'one');
      const second = f.store.createContract({
        ...f.contract,
        policyDigest: `sha256:${'e'.repeat(64)}`,
      });
      expect(() => f.store.createRun(second, 'approved', 'two')).toThrow('run_admission_conflict');
      expect(() => f.store.createRun(second, 'approved', 'one')).toThrow(
        'run_admission_identity_conflict',
      );
    } finally {
      f.store.close();
    }
  });
  it('exposes canonical discovery through MCP without adding a launch tool', async () => {
    const f = await fixture();
    f.store.createRun(f.contractId, 'approved', 'mcp-run');
    const server = createWorkflowMcpServer(f.store, f.input);
    const client = new Client({ name: 'discovery-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    try {
      await Promise.all([client.connect(a), server.connect(b)]);
      const result = await client.callTool({
        name: 'workflow_discover',
        arguments: {
          taskId: f.input.taskId,
          materialDigest: deriveContractMaterialDigest(f.contract),
        },
      });
      expect(result.content).toEqual([
        {
          type: 'text',
          text: JSON.stringify(
            discoverCanonicalRuns({
              ...f.input,
              materialDigest: deriveContractMaterialDigest(f.contract),
            }),
          ),
        },
      ]);
      expect((await client.listTools()).tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
    } finally {
      await client.close();
      await server.close();
      f.store.close();
    }
  });
  it('finds journaled repair children, including an interrupted reservation', async () => {
    const f = await fixture();
    try {
      f.store.createRun(f.contractId, 'repair_planning', 'parent');
      const db = new Database(f.database);
      db.prepare(
        `INSERT INTO repair_child_intents
        (id,workspace_id,run_id,sequence,finding_digest,chain_tip_task_id,request_json,status,
         owner_id,workspace_lease_epoch,run_lease_epoch,task_lease_epoch,created_at_ms,updated_at_ms)
        VALUES (?,?,?,1,'finding','tip','{}','prepared','owner',1,1,1,0,0)`,
      ).run('child', f.contract.workspaceId, 'parent');
      db.close();
      expect(discoverCanonicalRuns({ ...f.input, taskId: 'child' })).toMatchObject({
        status: 'matching',
        active: [{ id: 'parent' }],
      });
    } finally {
      f.store.close();
    }
  });
  it.each(['recovering', 'cancelling'] as const)('retains %s ownership', async (state) => {
    const f = await fixture();
    try {
      f.store.createRun(f.contractId, state, 'one');
      expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'matching' });
      expect(() => f.store.createRun(f.contractId, 'approved', 'two')).toThrow(
        'run_admission_conflict',
      );
    } finally {
      f.store.close();
    }
  });
  it('rejects indexed workspace mismatch in discovery and admission', async () => {
    const f = await fixture();
    try {
      f.store.createRun(f.contractId, 'approved', 'one');
      const db = new Database(f.database);
      db.prepare('UPDATE contracts SET workspace_id = ?').run(`sha256:${'e'.repeat(64)}`);
      db.close();
      expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'unknown' });
      expect(() => f.store.createRun(f.contractId, 'approved', 'two')).toThrow(
        'run_discovery_identity_mismatch',
      );
    } finally {
      f.store.close();
    }
  });
  it('rejects valid foreign journals and empty journals lacking required schema', async () => {
    const f = await fixture();
    const other = await fixture();
    f.store.close();
    other.store.close();
    await copyFile(other.database, f.database);
    expect(discoverCanonicalRuns(f.input)).toMatchObject({
      status: 'unknown',
      reason: 'run_discovery_workspace_unbound',
    });
    const db = new Database(other.database);
    db.exec('DROP TABLE repair_child_intents');
    db.close();
    expect(discoverCanonicalRuns(other.input)).toMatchObject({ status: 'unknown' });
  });
  it('requires explicit immutable workspace provisioning and rejects malformed state', async () => {
    const f = await fixture();
    try {
      expect(() => f.store.bindWorkspaceIdentity(`sha256:${'f'.repeat(64)}`)).toThrow(
        'journal_workspace_conflict',
      );
      f.store.createRun(f.contractId, 'closed', 'closed');
      expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'terminal_only' });
      const db = new Database(f.database);
      db.exec("UPDATE runs SET state='nonsense'");
      db.close();
      expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'unknown' });
    } finally {
      f.store.close();
    }
  });
  it.each(['schema', 'row'])('rejects malformed lease %s', async (kind) => {
    const f = await fixture();
    try {
      const db = new Database(f.database);
      if (kind === 'schema') db.exec('DROP TABLE leases; CREATE TABLE leases(resource_type TEXT)');
      else db.exec("INSERT INTO leases VALUES ('workspace','scope','owner','not-an-epoch',0)");
      db.close();
      expect(discoverCanonicalRuns(f.input)).toMatchObject({ status: 'unknown' });
    } finally {
      f.store.close();
    }
  });
});
