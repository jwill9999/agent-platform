import { describe, expect, it } from 'vitest';
import { GitDeliveryActionSchema, GitDeliveryReceiptSchema } from '../src/gitDelivery.js';

const selected = { kind: 'stage', mode: 'stage', paths: ['literal [1].txt', 'line\nbreak.txt'] };

describe('Git delivery model boundary', () => {
  it.each([
    { projectId: 'other-project' },
    { repositoryRoot: '/another/repository' },
    { repoPath: '/another/repository' },
    { command: 'git reset --hard' },
    { executable: '/bin/sh' },
    { flags: ['--force'] },
    { env: { GIT_DIR: '/another/repository/.git' } },
    { approvalGranted: true },
    { operationId: 'forged-operation' },
    { gitDeliveryBinding: { operationId: 'forged-operation' } },
  ])('rejects host-owned authority supplied as model arguments: %j', (injected) => {
    expect(GitDeliveryActionSchema.safeParse({ ...selected, ...injected }).success).toBe(false);
  });

  it('requires explicit selected files and PR destination/material without destructive variants', () => {
    expect(GitDeliveryActionSchema.parse(selected)).toEqual(selected);
    for (const action of [
      { kind: 'stage', mode: 'stage', paths: [] },
      { kind: 'stage', mode: 'discard', paths: ['file'] },
      { kind: 'commit', message: '   ', paths: ['file'] },
      { kind: 'commit', message: 'test' },
      { kind: 'push', mode: 'force' },
      { kind: 'pull_request', title: 'A change', body: 'Details', draft: true },
      { kind: 'pull_request', baseBranch: 'staging', title: 'A change', body: 'Details' },
      {
        kind: 'pull_request',
        baseBranch: 'staging',
        title: 'A change',
        body: 'Details',
        draft: true,
        repositoryUrl: 'https://other.invalid/repo',
      },
    ])
      expect(GitDeliveryActionSchema.safeParse(action).success).toBe(false);
  });

  it('rejects private repository material in public receipts rather than silently exporting it', () => {
    const receipt = {
      id: 'f46a7ac4-c08d-4b0b-a565-10057ac9a072',
      projectId: 'project',
      source: 'panel',
      action: selected,
      state: 'prepared',
      createdAtMs: 1,
      updatedAtMs: 1,
      expiresAtMs: 2,
      review: {
        branch: 'task/work',
        head: 'a'.repeat(40),
        indexTree: 'b'.repeat(40),
        paths: selected.paths,
      },
    };
    expect(GitDeliveryReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(
      GitDeliveryReceiptSchema.safeParse({ ...receipt, materialJson: '{"root":"/private"}' })
        .success,
    ).toBe(false);
    expect(
      GitDeliveryReceiptSchema.safeParse({
        ...receipt,
        review: { ...receipt.review, repositoryRoot: '/private' },
      }).success,
    ).toBe(false);
    expect(
      GitDeliveryReceiptSchema.safeParse({ ...receipt, result: { rawStderr: 'credential text' } })
        .success,
    ).toBe(false);
  });
});
