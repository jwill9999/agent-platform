import { z } from 'zod';

/** Normalized skill (parsed from markdown in the harness). */
export const SkillSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  /** Short one-liner for system-prompt stubs (lazy loading). */
  description: z.string().optional(),
  /** When-to-use hint shown in stubs so the model knows when to load this skill. */
  hint: z.string().optional(),
  goal: z.string(),
  constraints: z.array(z.string()),
  tools: z.array(z.string()),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
});

export type Skill = z.infer<typeof SkillSchema>;

/** POST /v1/skills body — id and slug are system-generated. */
export const SkillCreateBodySchema = SkillSchema.omit({ id: true, slug: true });

export type SkillCreateBody = z.infer<typeof SkillCreateBodySchema>;
