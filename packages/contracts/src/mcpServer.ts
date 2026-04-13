import { z } from 'zod';

export const McpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  transport: z.string().min(1),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type McpServer = z.infer<typeof McpServerSchema>;
