import { deriveContractMaterialDigest } from '../src/planning.js';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { executionContractSchema, type ExecutionContract } from '../src/contracts.js';
import { ContentAddressedArtifactStore } from '../src/artifacts.js';
import { publishPlanningDocumentObjects } from '../src/planningDocuments.js';
import type { WorkflowStore } from '../src/storage.js';

/** Synthetic normative inputs for existing execution tests. No production guard is bypassed. */
export async function documentFixture(contract: ExecutionContract, root: string, source?: string) {
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
  const taskIds = contract.tasks.map((task) => task.id);
  contract.planningDocuments = await publishPlanningDocumentObjects({
    sourceRoot: canonical,
    workspaceId: contract.workspaceId,
    repository: contract.authority.github.repository,
    sourceRevision: 'a'.repeat(40),
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
    store.recordPlanningDocumentPublication({ runId, sourceRoot: canonical });
    if (approved)
      store.seedLineageApprovalForTest({
        runId,
        materialDigest: deriveContractMaterialDigest(contract),
        nowMs: 0,
      });
  };
}
