import { z } from 'zod';

const ProjectSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const ProjectMetadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
);

export const ProjectRecordSchema = z.object({
  id: z.string().min(1),
  slug: ProjectSlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  workspacePath: z.string().min(1).max(1000),
  workspaceKey: z.string().min(1).max(300).optional(),
  metadata: ProjectMetadataSchema.default({}),
  archivedAtMs: z.number().int().nonnegative().optional(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const ProjectCreateBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: ProjectSlugSchema.optional(),
  description: z.string().max(1000).optional(),
  workspacePath: z.string().min(1).max(1000).optional(),
  workspaceKey: z.string().min(1).max(300).optional(),
  metadata: ProjectMetadataSchema.default({}),
});

export const ProjectUpdateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: ProjectSlugSchema.optional(),
  description: z.string().max(1000).nullable().optional(),
  workspacePath: z.string().min(1).max(1000).optional(),
  workspaceKey: z.string().min(1).max(300).nullable().optional(),
  metadata: ProjectMetadataSchema.optional(),
  archivedAtMs: z.number().int().nonnegative().nullable().optional(),
});

export const ProjectQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
});

export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export type ProjectCreateBody = z.infer<typeof ProjectCreateBodySchema>;
export type ProjectUpdateBody = z.infer<typeof ProjectUpdateBodySchema>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
