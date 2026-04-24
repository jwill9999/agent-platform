import { z } from 'zod';

export const DodContractSchema = z.object({
  criteria: z.array(z.string()).min(1),
  evidence: z.array(z.string()),
  passed: z.boolean(),
  failedCriteria: z.array(z.string()).default([]),
});

export type DodContract = z.infer<typeof DodContractSchema>;
