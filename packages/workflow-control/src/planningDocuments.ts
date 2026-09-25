import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

import { stagePreapprovalMaterial, validatePreapprovalPaths } from './preapprovalMaterial.js';

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const identifier = z.string().min(1).max(200);
const path = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (value) =>
      !/[\\:\r\n\0]/u.test(value) &&
      value.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
    'document path must be canonical and repository-relative',
  );

export const planningDocumentSchema = z
  .object({
    path,
    kind: z.enum(['specification', 'verification', 'design', 'reference']),
    taskIds: z.array(identifier).min(1).max(1024),
    sizeBytes: z
      .number()
      .int()
      .nonnegative()
      .max(16 * 1024 * 1024),
    digest,
  })
  .strict();

export const planningDocumentsSchema = z
  .object({
    version: z.literal(1),
    workspaceId: digest,
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/u),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    files: z.array(planningDocumentSchema).min(1).max(1024),
  })
  .strict()
  .superRefine((manifest, context) => {
    try {
      validatePreapprovalPaths(manifest.files.map((file) => file.path));
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'document paths are prohibited or duplicated',
      });
    }
    const paths = new Set<string>();
    let total = 0;
    for (const entry of manifest.files) {
      const key = entry.path.toLowerCase();
      if (paths.has(key))
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate document path' });
      paths.add(key);
      if (new Set(entry.taskIds).size !== entry.taskIds.length)
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate document task' });
      total += entry.sizeBytes;
    }
    if (total > 16 * 1024 * 1024)
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'document byte limit exceeded' });
  });

export type PlanningDocuments = z.infer<typeof planningDocumentsSchema>;

function compareCanonicalStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function canonicalPlanningDocuments(input: unknown): PlanningDocuments {
  const manifest = planningDocumentsSchema.parse(input);
  return {
    ...manifest,
    files: manifest.files
      .map((entry) => ({ ...entry, taskIds: [...entry.taskIds].sort(compareCanonicalStrings) }))
      .sort((left, right) => compareCanonicalStrings(left.path, right.path)),
  };
}

export function planningDocumentsDigest(input: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalPlanningDocuments(input)))
    .digest('hex')}`;
}

/** Trusted publisher only. Object publication does not create an approval or grant authority. */
export async function publishPlanningDocumentObjects(input: {
  sourceRoot: string;
  workspaceId: string;
  repository: string;
  sourceRevision: string;
  documents: {
    path: string;
    kind: PlanningDocuments['files'][number]['kind'];
    taskIds: string[];
  }[];
  artifacts: { put(bytes: Buffer): Promise<{ digest: string; sizeBytes: number }> };
}): Promise<PlanningDocuments> {
  const stage = stagePreapprovalMaterial({
    sourceRoot: input.sourceRoot,
    paths: input.documents.map((entry) => entry.path),
  });
  try {
    const manifest = canonicalPlanningDocuments({
      version: 1,
      workspaceId: input.workspaceId,
      repository: input.repository,
      sourceRevision: input.sourceRevision,
      files: stage.manifest.map((entry) => ({
        ...entry,
        ...input.documents.find((document) => document.path === entry.path),
      })),
    });
    for (const entry of manifest.files) {
      const stored = await input.artifacts.put(
        await readFile(join(stage.stagedSourceRoot, entry.path)),
      );
      if (stored.digest !== entry.digest || stored.sizeBytes !== entry.sizeBytes)
        throw new Error('document_publication_changed');
    }
    stage.verify();
    return manifest;
  } finally {
    stage.cleanup();
  }
}
