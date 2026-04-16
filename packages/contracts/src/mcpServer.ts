import { z } from 'zod';

/** Full MCP server record returned by the API. */
export const McpServerSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  transport: z.string().min(1),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type McpServer = z.infer<typeof McpServerSchema>;

/** POST /v1/mcp-servers body — id and slug are system-generated. */
export const McpServerCreateBodySchema = McpServerSchema.omit({ id: true, slug: true });

export type McpServerCreateBody = z.infer<typeof McpServerCreateBodySchema>;
