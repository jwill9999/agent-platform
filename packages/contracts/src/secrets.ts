import { z } from 'zod';

/** Reference to stored secret material (value never in this object). */
export const SecretRefSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
});

export type SecretRef = z.infer<typeof SecretRefSchema>;
