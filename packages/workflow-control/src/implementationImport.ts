import { AnchoredFileMutation } from './anchoredFileMutation.js';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';
import { TrustedSourceGit } from './sourceGit.js';
import { implementationOutputSchema, type ImplementationOutput } from './implementationOutput.js';

const hash = (bytes: Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export interface ImplementationImportReceipt {
  executionId: string;
  artifactDigest: string;
  baseHead: string;
  resultHead: string;
  status: 'verified';
}
interface ImportRow {
  execution_id: string;
  artifact_digest: string;
  source_root: string;
  base_head: string;
  result_head: string;
  branch_ref: string;
  status: 'prepared' | 'applied' | 'verified';
}
export function initializeImplementationImports(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS implementation_imports (
    execution_id TEXT PRIMARY KEY REFERENCES scheduler_executions(id),
    artifact_digest TEXT NOT NULL,
    source_root TEXT NOT NULL,
    base_head TEXT NOT NULL,
    result_head TEXT NOT NULL,
    branch_ref TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('prepared','applied','verified')),
    authority_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
  )`);
  database.exec(`CREATE TABLE IF NOT EXISTS implementation_import_recoveries (
    execution_id TEXT PRIMARY KEY REFERENCES implementation_imports(execution_id),
    owner_id TEXT NOT NULL, phase_lease_epoch INTEGER NOT NULL,
    workspace_lease_epoch INTEGER NOT NULL, run_lease_epoch INTEGER NOT NULL,
    task_lease_epoch INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL
  )`);
}

/** Trusted synchronous repository adapter. All calls are made inside the store's fenced
 * transaction. It never resolves an output-supplied destination or invokes repository hooks.
 */
class ImportWorkspace {
  readonly repository: TrustedSourceGit;
  readonly files: AnchoredFileMutation;
  constructor(
    readonly root: string,
    binary: string,
    expectedDigest?: string,
  ) {
    this.repository = new TrustedSourceGit(root, binary, expectedDigest);
    this.files = new AnchoredFileMutation(root);
    this.repository.assertSafeIndex();
    if (realpathSync(this.git(['rev-parse', '--show-toplevel']).toString().trim()) !== root)
      throw new Error('import repository root mismatch');
  }
  git(args: string[], input?: Uint8Array, index?: string): Buffer {
    return this.repository.run(args, input, index);
  }
  head() {
    return this.git(['rev-parse', 'HEAD']).toString().trim();
  }
  branch() {
    return this.git(['symbolic-ref', 'HEAD']).toString().trim();
  }
  assertClean() {
    this.repository.assertClean();
  }
  assertBaseFiles(output: ImplementationOutput): void {
    for (const file of output.files) {
      const entry = this.git([
        'ls-tree',
        '-z',
        output.input.binding.headSha,
        '--',
        file.path,
      ]).toString();
      if (file.beforeDigest === null) {
        if (entry !== '') throw new Error('import addition exists in approved base');
      } else {
        const match = /^(100644|100755) blob ([a-f0-9]{40,64})\t[^\0]+\0$/u.exec(entry);
        if (!match || hash(this.git(['cat-file', 'blob', match[2]!])) !== file.beforeDigest)
          throw new Error('import prior digest differs from approved base blob');
      }
    }
  }
  path(path: string): string {
    const absolute = join(this.root, path);
    let parent = dirname(absolute);
    while (parent !== this.root) {
      try {
        if (!lstatSync(parent).isDirectory() || realpathSync(parent) !== parent)
          throw new Error('import parent is not a regular canonical directory');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      parent = dirname(parent);
    }
    return absolute;
  }
  assertFiles(output: ImplementationOutput, side: 'before' | 'after') {
    for (const file of output.files) {
      this.assertFile(file.path, side === 'before' ? file.beforeDigest : file.afterDigest);
    }
  }
  private assertFile(path: string, expected: string | null): void {
    const absolute = this.path(path);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (expected === null) {
      if (stat) throw new Error('import expected absent file');
      return;
    }
    if (!stat?.isFile() || stat.nlink !== 1 || stat.size > 1024 * 1024)
      throw new Error('import source is not a bounded regular file');
    const content = readFileSync(absolute);
    if (content.includes(0) || hash(content) !== expected)
      throw new Error('import prior or resulting content mismatch');
    new TextDecoder('utf-8', { fatal: true }).decode(content);
  }
  prepare(
    output: ImplementationOutput,
    artifactDigest: string,
    assertAuthority: () => void,
  ): string {
    this.assertClean();
    if (this.head() !== output.input.binding.headSha) throw new Error('import base head mismatch');
    this.assertFiles(output, 'before');
    this.assertBaseFiles(output);
    if (output.files.length === 0) return this.head();
    const temporary = mkdtempSync(join(tmpdir(), 'workflow-import-index-'));
    const index = join(temporary, 'index');
    try {
      assertAuthority();
      this.git(['read-tree', output.input.binding.headSha], undefined, index);
      for (const file of output.files) {
        assertAuthority();
        if (file.content === null) {
          this.git(['update-index', '--force-remove', '--', file.path], undefined, index);
        } else {
          const mode =
            file.beforeDigest === null
              ? '100644'
              : this.git(['ls-files', '--stage', '--', file.path]).toString().split(' ')[0];
          if (!['100644', '100755'].includes(mode!))
            throw new Error('import unsupported Git entry');
          const blob = this.git(['hash-object', '-w', '--stdin'], Buffer.from(file.content))
            .toString()
            .trim();
          this.git(
            ['update-index', '--add', '--cacheinfo', `${mode},${blob},${file.path}`],
            undefined,
            index,
          );
        }
      }
      assertAuthority();
      const tree = this.git(['write-tree'], undefined, index).toString().trim();
      assertAuthority();
      return this.git(
        ['commit-tree', tree, '-p', output.input.binding.headSha],
        Buffer.from(`Verified worker output ${artifactDigest}\n`),
      )
        .toString()
        .trim();
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  apply(
    output: ImplementationOutput,
    row: ImportRow,
    fault: (boundary: string) => void,
    assertAuthority: () => void,
    mutationDeadline: () => number | null,
  ) {
    this.assertClean();
    if (this.branch() !== row.branch_ref || this.head() !== row.base_head)
      throw new Error('import source ref changed');
    this.assertFiles(output, 'before');
    for (const file of output.files) {
      assertAuthority();
      fault('before_file_apply');
      assertAuthority();
      this.files.apply(file, mutationDeadline());
      fault('after_file_apply');
    }
    this.assertFiles(output, 'after');
    assertAuthority();
    this.repository.run(['read-tree', row.result_head], undefined, undefined, mutationDeadline());
    assertAuthority();
    this.repository.updateRef(row.branch_ref, row.result_head, row.base_head, mutationDeadline());
    fault('after_head_apply');
    this.assertClean();
  }
}

/** Internal store composition, not a worker-callable import API. Authority must check the
 * exact active execution, approval, phase and all leases on every transaction, including replay.
 * A crash during file application leaves prepared evidence and blocks on source drift.
 */
export function importImplementationOutput(input: {
  database: Database.Database;
  sourceRoot: string;
  gitBinary: string;
  gitBinaryDigest?: string;
  artifact: Uint8Array;
  artifactDigest: string;
  authority: object;
  beforeTransaction?: () => void;
  mutationDeadline?: () => number;
  assertAuthority: (output: ImplementationOutput) => void;
  commitApprovedHead?: (output: ImplementationOutput, head: string) => void;
  fault?: (boundary: string) => void;
}): ImplementationImportReceipt {
  if (
    input.artifact.byteLength > 110 * 1024 * 1024 ||
    hash(input.artifact) !== input.artifactDigest
  )
    throw new Error('import artifact integrity rejected');
  const output = implementationOutputSchema.parse(
    JSON.parse(Buffer.from(input.artifact).toString('utf8')),
  );
  const db = input.database;
  const fault = input.fault ?? (() => undefined);
  const workspace = new ImportWorkspace(input.sourceRoot, input.gitBinary, input.gitBinaryDigest);
  if (workspace.branch() !== `refs/heads/task/${output.input.task.taskId}`)
    throw new Error('import branch is outside task authority');
  const get = () =>
    db
      .prepare('SELECT * FROM implementation_imports WHERE execution_id=?')
      .get(output.executionId) as ImportRow | undefined;
  input.beforeTransaction?.();
  db.transaction(() => {
    input.assertAuthority(output);
    const existing = get();
    if (existing) {
      if (
        existing.artifact_digest !== input.artifactDigest ||
        existing.source_root !== input.sourceRoot ||
        existing.base_head !== output.input.binding.headSha
      )
        throw new Error('import intent conflict');
      return;
    }
    const result = workspace.prepare(output, input.artifactDigest, () =>
      input.assertAuthority(output),
    );
    input.assertAuthority(output);
    db.prepare(`INSERT INTO implementation_imports VALUES(?,?,?,?,?,?,'prepared',?,?,?)`).run(
      output.executionId,
      input.artifactDigest,
      input.sourceRoot,
      output.input.binding.headSha,
      result,
      workspace.branch(),
      JSON.stringify(input.authority),
      Date.now(),
      Date.now(),
    );
  }).immediate();
  fault('after_prepare');
  input.beforeTransaction?.();
  db.transaction(() => {
    input.assertAuthority(output);
    const row = get()!;
    if (workspace.branch() !== row.branch_ref) throw new Error('import branch drift');
    if (workspace.head() === row.result_head) {
      workspace.assertClean();
      workspace.assertFiles(output, 'after');
    } else {
      if (row.status !== 'prepared') throw new Error('import applied head drift');
      workspace.apply(
        output,
        row,
        fault,
        () => input.assertAuthority(output),
        () => input.mutationDeadline?.() ?? null,
      );
    }
    input.assertAuthority(output);
    db.prepare(
      "UPDATE implementation_imports SET status='applied',updated_at_ms=? WHERE execution_id=?",
    ).run(Date.now(), output.executionId);
  }).immediate();
  fault('after_apply');
  input.beforeTransaction?.();
  return db
    .transaction(() => {
      input.assertAuthority(output);
      const row = get()!;
      if (workspace.branch() !== row.branch_ref || workspace.head() !== row.result_head)
        throw new Error('import verification head drift');
      workspace.assertClean();
      workspace.assertFiles(output, 'after');
      input.assertAuthority(output);
      input.commitApprovedHead?.(output, row.result_head);
      db.prepare(
        "UPDATE implementation_imports SET status='verified',updated_at_ms=? WHERE execution_id=?",
      ).run(Date.now(), output.executionId);
      return {
        executionId: output.executionId,
        artifactDigest: input.artifactDigest,
        baseHead: row.base_head,
        resultHead: row.result_head,
        status: 'verified' as const,
      };
    })
    .immediate();
}
