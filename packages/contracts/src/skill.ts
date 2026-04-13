import { z } from 'zod';

/** Normalized skill (parsed from markdown in the harness). */
export const SkillSchema = z.object({
  id: z.string().min(1),
  goal: z.string(),
  constraints: z.array(z.string()),
  tools: z.array(z.string()),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
});

export type Skill = z.infer<typeof SkillSchema>;
