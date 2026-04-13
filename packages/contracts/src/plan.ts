import { z } from 'zod';

export const TaskSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  toolIds: z.array(z.string()).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const PlanSchema = z.object({
  id: z.string().min(1),
  tasks: z.array(TaskSchema),
});

export type Plan = z.infer<typeof PlanSchema>;
