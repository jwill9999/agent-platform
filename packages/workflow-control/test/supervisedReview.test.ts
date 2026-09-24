import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';

import { prepareReviewSnapshot, prepareSupervisedReview } from '../src/supervisedReview.js';
import { supervisedReviewConfigSchema } from '../src/supervisedReviewCli.js';

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function source() {
  const root = await mkdtemp(join(tmpdir(), 'review-test-'));
  cleanup.push(root);
  await writeFile(join(root, 'plan.md'), 'original');
  return root;
}
it('binds review evidence to copied content independently of later source edits', async () => {
  const root = await source();
  const first = await prepareReviewSnapshot(root, ['plan.md']);
  cleanup.push(dirname(first.root));
  await writeFile(join(root, 'plan.md'), 'changed');
  const second = await prepareReviewSnapshot(root, ['plan.md']);
  cleanup.push(dirname(second.root));
  expect(first.materialDigest).not.toBe(second.materialDigest);
  expect(await readFile(join(first.root, 'plan.md'), 'utf8')).toBe('original');
  expect(await readFile(join(first.codexHome, 'config.toml'), 'utf8')).toContain(
    'sandbox_mode = "read-only"',
  );
});
it('rejects credential/configuration directories even when nested in evidence', async () => {
  const root = await source();
  await mkdir(join(root, 'docs', '.codex'), { recursive: true });
  await writeFile(join(root, 'docs', '.codex', 'config.toml'), 'unsafe');
  await expect(prepareReviewSnapshot(root, ['docs'])).rejects.toThrow('forbidden');
  await expect(prepareReviewSnapshot(root, ['.'])).rejects.toThrow('forbidden');
});
it('rejects mutable images before staging or reading authentication', async () => {
  await expect(
    prepareSupervisedReview({
      sourceRoot: '/missing',
      evidencePaths: ['plan.md'],
      image: 'latest',
      modelAuthFile: '/missing',
      egressNetwork: 'none',
      question: 'Review',
    }),
  ).rejects.toThrow('immutable');
});

it('rejects unbounded execution and unexpected configuration', () => {
  const config = {
    sourceRoot: '/evidence',
    evidencePaths: ['plan.md'],
    image: 'image',
    modelAuthFile: '/auth',
    egressNetwork: 'review-egress',
    question: 'Review',
    timeoutMs: 600001,
    maxOutputBytes: 4096,
  };
  expect(supervisedReviewConfigSchema.safeParse(config).success).toBe(false);
  expect(
    supervisedReviewConfigSchema.safeParse({ ...config, timeoutMs: 1000, mcp_servers: {} }).success,
  ).toBe(false);
});

it('rejects innocent aliases to forbidden files and symlinked ancestors', async () => {
  const root = await source();
  await mkdir(join(root, '.codex'));
  await writeFile(join(root, '.codex', 'config.toml'), 'sensitive');
  await symlink(join(root, '.codex', 'config.toml'), join(root, 'innocent.md'));
  await symlink(join(root, '.codex'), join(root, 'docs'));
  await expect(prepareReviewSnapshot(root, ['innocent.md'])).rejects.toThrow('symlink');
  await expect(prepareReviewSnapshot(root, ['docs/config.toml'])).rejects.toThrow('symlink');
});
