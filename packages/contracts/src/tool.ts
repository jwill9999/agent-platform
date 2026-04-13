import { z } from 'zod';

export const ToolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export type Tool = z.infer<typeof ToolSchema>;
