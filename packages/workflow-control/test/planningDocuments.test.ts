import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
  chmod,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { ContentAddressedArtifactStore } from '../src/artifacts.js';
import {
  canonicalPlanningDocuments,
  planningDocumentsDigest,
  publishPlanningDocumentObjects,
} from '../src/planningDocuments.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { executionContractSchema } from '../src/contracts.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'document-binding-')));
  roots.push(root);
  const sourceRoot = join(root, 'source');
  await mkdir(sourceRoot);
  await writeFile(join(sourceRoot, 'spec.md'), 'spec\n');
  await writeFile(join(sourceRoot, 'tests.md'), 'test\n');
  const artifacts = new ContentAddressedArtifactStore(join(root, 'artifacts'));
  return {
    sourceRoot,
    artifacts,
    workspaceId: `sha256:${'a'.repeat(64)}`,
    repository: 'owner/repo',
    sourceRevision: 'b'.repeat(40),
    documents: [
      { path: 'spec.md', kind: 'specification' as const, taskIds: ['task'] },
      { path: 'tests.md', kind: 'verification' as const, taskIds: ['task'] },
    ],
  };
}
it('publishes exact-byte objects and canonicalizes order without normalizing document bytes', async () => {
  const input = await fixture();
  const manifest = await publishPlanningDocumentObjects(input);
  for (const file of manifest.files)
    expect(await input.artifacts.get(file.digest)).toEqual(
      await readFile(join(input.sourceRoot, file.path)),
    );
  expect(planningDocumentsDigest({ ...manifest, files: [...manifest.files].reverse() })).toBe(
    planningDocumentsDigest(manifest),
  );
  await writeFile(join(input.sourceRoot, 'spec.md'), 'spec\r\n');
  const changed = await publishPlanningDocumentObjects(input);
  expect(planningDocumentsDigest(changed)).not.toBe(planningDocumentsDigest(manifest));
});
it('rejects aliases, unknown versions and duplicate task mappings', async () => {
  const manifest = await publishPlanningDocumentObjects(await fixture());
  expect(() => canonicalPlanningDocuments({ ...manifest, version: 2 })).toThrow();
  expect(() =>
    canonicalPlanningDocuments({
      ...manifest,
      files: [...manifest.files, { ...manifest.files[0]!, path: 'SPEC.md' }],
    }),
  ).toThrow('duplicate document path');
  expect(() =>
    canonicalPlanningDocuments({
      ...manifest,
      files: [{ ...manifest.files[0]!, taskIds: ['task', 'task'] }],
    }),
  ).toThrow('duplicate document task');
});
it('fails publication on missing or symlinked files rather than following alternate bytes', async () => {
  const input = await fixture();
  await rm(join(input.sourceRoot, 'spec.md'));
  await expect(publishPlanningDocumentObjects(input)).rejects.toThrow('staging failed');
  await symlink(join(input.sourceRoot, 'tests.md'), join(input.sourceRoot, 'spec.md'));
  await expect(publishPlanningDocumentObjects(input)).rejects.toThrow('staging failed');
});
it('binds manifest identity and per-task coverage while preserving legacy contract digest', async () => {
  // Immutable reviewed fixture from the preceding planning change; not runtime approval.
  const legacy = JSON.parse(
    await readFile(
      new URL('./fixtures/documentBindingLegacyContract.json', import.meta.url),
      'utf8',
    ),
  );
  expect(deriveContractMaterialDigest(legacy)).toBe(
    'sha256:0ec6f078ef119f50b0a8d0e032204897d9e39884209583be480597f4428069a1',
  );
  const manifest = await publishPlanningDocumentObjects(await fixture());
  const bound = {
    ...legacy,
    planningDocuments: {
      ...manifest,
      workspaceId: legacy.workspaceId,
      repository: legacy.authority.github.repository,
      files: manifest.files.map((file) => ({ ...file, taskIds: [legacy.tasks[0].id] })),
    },
  };
  expect(deriveContractMaterialDigest(bound)).not.toBe(deriveContractMaterialDigest(legacy));
  expect(() => executionContractSchema.parse({ ...bound, planningDocuments: manifest })).toThrow();
  expect(() =>
    executionContractSchema.parse({
      ...bound,
      planningDocuments: { ...bound.planningDocuments, files: [bound.planningDocuments.files[0]] },
    }),
  ).toThrow('coverage missing');
  const changed = structuredClone(bound);
  changed.planningDocuments.files[0].digest = `sha256:${createHash('sha256').update('changed').digest('hex')}`;
  expect(deriveContractMaterialDigest(changed)).not.toBe(deriveContractMaterialDigest(bound));
});

it('retries a partial object write without publishing a manifest as authority', async () => {
  const input = await fixture();
  const put = input.artifacts.put.bind(input.artifacts);
  let writes = 0;
  const spy = vi.spyOn(input.artifacts, 'put').mockImplementation(async (bytes) => {
    if (++writes === 2) throw new Error('injected_object_failure');
    return put(bytes);
  });
  await expect(publishPlanningDocumentObjects(input)).rejects.toThrow('injected_object_failure');
  spy.mockRestore();
  const manifest = await publishPlanningDocumentObjects(input);
  for (const file of manifest.files)
    expect(await input.artifacts.get(file.digest)).toEqual(
      await readFile(join(input.sourceRoot, file.path)),
    );
});

it.each(['path', 'kind', 'taskIds', 'sizeBytes', 'digest', 'set'])(
  'changes the manifest digest when %s changes',
  async (dimension) => {
    const manifest = await publishPlanningDocumentObjects(await fixture());
    const changed = structuredClone(manifest);
    const file = changed.files[0]!;
    if (dimension === 'path') file.path = 'renamed.md';
    if (dimension === 'kind') file.kind = 'design';
    if (dimension === 'taskIds') file.taskIds = ['other-task'];
    if (dimension === 'sizeBytes') file.sizeBytes++;
    if (dimension === 'digest') file.digest = `sha256:${'f'.repeat(64)}`;
    if (dimension === 'set') changed.files.pop();
    expect(planningDocumentsDigest(changed)).not.toBe(planningDocumentsDigest(manifest));
  },
);

it.skipIf(process.getuid?.() === 0)('rejects an unreadable regular normative file', async () => {
  const input = await fixture();
  const path = join(input.sourceRoot, 'spec.md');
  await chmod(path, 0);
  try {
    await expect(publishPlanningDocumentObjects(input)).rejects.toThrow('staging failed');
  } finally {
    await chmod(path, 0o600);
  }
});
