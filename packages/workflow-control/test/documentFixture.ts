import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve, join, isAbsolute } from 'node:path';
import { executionContractSchema, type ExecutionContract } from '../src/contracts.js';
import { ContentAddressedArtifactStore } from '../src/artifacts.js';
import { publishPlanningDocumentObjects } from '../src/planningDocuments.js';
import type { WorkflowStore } from '../src/storage.js';

/** Synthetic normative inputs for existing execution tests. No production guard is bypassed. */
export async function documentFixture(
  contract: ExecutionContract,
  root: string,
  source?: string,
  sourcePolicy?: unknown,
) {
  const sourceRoot = source ?? join(root, 'document-source');
  await mkdir(sourceRoot, { recursive: true });
  const canonical = await realpath(sourceRoot);
  await writeFile(
    join(canonical, 'fixture-spec.md'),
    'Synthetic requirements for execution regression.\n',
  );
  await writeFile(
    join(canonical, 'fixture-tests.md'),
    'Synthetic verification requirements for execution regression.\n',
  );
  const executable = process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git';
  if (!isAbsolute(executable)) throw new Error('fixture git must be absolute');
  const git = (args: string[]) =>
    execFileSync(executable, ['-C', canonical, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.com',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.com',
      },
    }).trim();
  let existing = true;
  try {
    git(['rev-parse', '--show-toplevel']);
  } catch {
    existing = false;
  }
  if (!existing) {
    git(['init', '-q']);
    git(['add', 'fixture-spec.md', 'fixture-tests.md']);
    git(['commit', '-qm', 'reviewed fixture documents']);
    git([
      'remote',
      'add',
      'origin',
      `https://github.com/${contract.authority.github.repository}.git`,
    ]);
  }
  const canonicalRoot = await realpath(
    dirname(resolve(canonical, git(['rev-parse', '--git-common-dir']))),
  );
  contract.workspaceId = `sha256:${createHash('sha256').update(canonicalRoot).digest('hex')}`;
  const taskIds = contract.tasks.map((task) => task.id);
  if (!existing) {
    const ids = [...taskIds];
    for (let i = 1; i <= contract.repairTaskPolicy.maxChildren; i++)
      ids.push(contract.repairTaskPolicy.idPattern.replace('<sequence>', String(i)));
    for (const [i, id] of ids.entries()) {
      if (i === 0) git(['checkout', '-qb', `task/${id}`]);
      else git(['worktree', 'add', '-q', '-b', `task/${id}`, join(root, `document-task-${i}`)]);
    }
  }

  contract.planningDocuments = await publishPlanningDocumentObjects({
    sourceRoot: canonical,
    workspaceId: contract.workspaceId,
    repository: contract.authority.github.repository,
    sourceRevision: git(['rev-parse', 'HEAD']),
    documents: [
      { path: 'fixture-spec.md', kind: 'specification', taskIds },
      { path: 'fixture-tests.md', kind: 'verification', taskIds },
    ],
    artifacts: new ContentAddressedArtifactStore(join(root, 'artifacts')),
  });
  const canonicalContract = executionContractSchema.parse(contract);
  for (const key of Object.keys(contract))
    delete (contract as unknown as Record<string, unknown>)[key];
  Object.assign(contract, canonicalContract);
  return (store: WorkflowStore, runId: string, approved = false) => {
    store.recordPlanningDocumentPublication({ runId, sourceRoot: canonical, sourcePolicy });
    if (approved)
      store.seedLineageApprovalForTest({
        runId,
        materialDigest: deriveContractMaterialDigest(contract),
        nowMs: 0,
      });
  };
}
