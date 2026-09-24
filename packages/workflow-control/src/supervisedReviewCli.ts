#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

import {
  prepareSupervisedReview,
  executeSupervisedReview,
  ReviewSettlementError,
} from './supervisedReview.js';

export const supervisedReviewConfigSchema = z
  .object({
    sourceRoot: z.string().min(1),
    evidencePaths: z.array(z.string().min(1)).min(1),
    image: z.string().min(1),
    modelAuthFile: z.string().min(1),
    egressNetwork: z.string().min(1),
    question: z.string().min(1),
    proxyUrl: z.string().url().optional(),
    timeoutMs: z.number().int().positive().max(600_000),
    maxOutputBytes: z.number().int().positive().max(10_000_000),
  })
  .strict();

/** Coordinator supplies bounded JSON; the CLI never opens a model-selected config path. */
export async function readReviewConfig(
  input: AsyncIterable<Uint8Array | string>,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 1_000_000) throw new Error('review configuration exceeds input limit');
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export async function runSupervisedReview(config: unknown) {
  const parsed = supervisedReviewConfigSchema.parse(config);
  const prepared = await prepareSupervisedReview(parsed);
  const result = await executeSupervisedReview(prepared, parsed);
  return {
    kind: 'supervised-review-evidence',
    executionId: prepared.executionId,
    materialDigest: prepared.snapshot.materialDigest,
    manifest: prepared.snapshot.manifest,
    result,
    formalApproval: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2)
      throw new Error('usage: supervised-review < trusted-config.json (JSON on stdin)');
    const config = await readReviewConfig(process.stdin);
    process.stdout.write(`${JSON.stringify(await runSupervisedReview(config))}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(error instanceof ReviewSettlementError ? { error: error.message, recovery: error.recovery } : { error: error instanceof Error ? error.message : String(error) })}\n`,
    );
    process.exitCode = 1;
  }
}
