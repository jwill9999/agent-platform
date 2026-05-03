import { z } from 'zod';

export const WorkspaceAreaSchema = z.enum([
  'uploads',
  'generated',
  'scratch',
  'exports',
  'projects',
]);
export type WorkspaceArea = z.infer<typeof WorkspaceAreaSchema>;

export const WorkspaceFileKindSchema = z.enum(['file', 'directory']);
export type WorkspaceFileKind = z.infer<typeof WorkspaceFileKindSchema>;

export const WorkspaceFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  area: WorkspaceAreaSchema,
  kind: WorkspaceFileKindSchema,
  size: z.number().int().nonnegative(),
  modifiedAt: z.string(),
});
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;

export const WorkspaceAreaListingSchema = z.object({
  area: WorkspaceAreaSchema,
  label: z.string(),
  path: z.string(),
  files: z.array(WorkspaceFileSchema),
});
export type WorkspaceAreaListing = z.infer<typeof WorkspaceAreaListingSchema>;

export const WorkspaceFilesResponseSchema = z.object({
  areas: z.array(WorkspaceAreaListingSchema),
  totalFiles: z.number().int().nonnegative(),
});
export type WorkspaceFilesResponse = z.infer<typeof WorkspaceFilesResponseSchema>;
