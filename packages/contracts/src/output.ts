import { z } from 'zod';

/** Stream / API payload union for chat and tool events. */
export const OutputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('code'),
    language: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal('tool_result'),
    toolId: z.string(),
    data: z.unknown(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal('thinking'),
    content: z.string(),
  }),
]);

export type Output = z.infer<typeof OutputSchema>;
